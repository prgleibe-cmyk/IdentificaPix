import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { 
  getBackupEncryptionKey, 
  decryptAndDecompress, 
  getBackupDirectory,
  getS3Client
} from './backup.service.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export interface TableValidationReport {
  tableName: string;
  exists: boolean;
  rowCount: number;
}

export interface RestoreResult {
  success: boolean;
  sourceType: 'local_file' | 's3_object' | 'buffer';
  sourceIdentifier: string;
  decryptedSizeBytes: number;
  durationMs: number;
  tablesValidated: TableValidationReport[];
  totalTables: number;
  totalRowsRestored: number;
  error?: string;
}

const CRITICAL_TABLES = [
  'app_users',
  'churches',
  'contributors',
  'consolidated_transactions',
  'financial_records',
  'saved_reports',
  'banks',
  'pastoral_messages',
  'learned_associations'
];

/**
 * Downloads an encrypted backup object from S3 if configured
 */
export async function downloadBackupFromS3(s3Key: string): Promise<Buffer> {
  const s3Config = getS3Client();
  if (!s3Config) {
    throw new Error('S3 credentials not configured in environment variables');
  }

  const { client, bucket } = s3Config;
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key
  });

  const response = await client.send(command);
  if (!response.Body) {
    throw new Error(`S3 object Body is empty for key "${s3Key}"`);
  }

  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}

/**
 * Validates restored database structure and critical tables
 */
export async function validateRestoredDatabase(targetPool: pg.Pool): Promise<TableValidationReport[]> {
  const reports: TableValidationReport[] = [];

  for (const tableName of CRITICAL_TABLES) {
    try {
      // Check table existence
      const existRes = await targetPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `, [tableName]);

      const exists = existRes.rows[0]?.exists === true;

      let rowCount = 0;
      if (exists) {
        const countRes = await targetPool.query(`SELECT COUNT(*)::int as count FROM "${tableName}";`);
        rowCount = countRes.rows[0]?.count || 0;
      }

      reports.push({
        tableName,
        exists,
        rowCount
      });
    } catch (err: any) {
      reports.push({
        tableName,
        exists: false,
        rowCount: 0
      });
    }
  }

  return reports;
}

/**
 * Restores PostgreSQL database in an ISOLATED target pool from an encrypted backup buffer
 */
export async function restoreDatabaseFromEncryptedBuffer(
  encryptedBuffer: Buffer, 
  targetPool: pg.Pool, 
  sourceType: 'local_file' | 's3_object' | 'buffer' = 'buffer',
  sourceIdentifier = 'in-memory-buffer'
): Promise<RestoreResult> {
  const startTime = Date.now();

  try {
    // 1. Decrypt & Decompress using derived encryption key
    const key = getBackupEncryptionKey();
    const sqlDump = decryptAndDecompress(encryptedBuffer, key);
    const decryptedSizeBytes = Buffer.byteLength(sqlDump, 'utf8');

    // 2. Parse and execute SQL statements
    // Filter out comments and blank lines
    const rawStatements = sqlDump
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    const client = await targetPool.connect();
    try {
      await client.query('BEGIN;');
      for (const statement of rawStatements) {
        await client.query(statement);
      }
      await client.query('COMMIT;');
    } catch (execErr: any) {
      await client.query('ROLLBACK;').catch(() => {});
      throw new Error(`Failed to execute SQL dump during restoration: ${execErr?.message || execErr}`);
    } finally {
      client.release();
    }

    // 3. Validate restored tables & count rows
    const validationReports = await validateRestoredDatabase(targetPool);
    const totalTables = validationReports.filter(r => r.exists).length;
    const totalRowsRestored = validationReports.reduce((acc, r) => acc + r.rowCount, 0);

    const durationMs = Date.now() - startTime;

    console.log(`[RestoreService] SUCCESS: Restored ${totalTables} critical tables (${totalRowsRestored} total records) from ${sourceType} (${sourceIdentifier}) in ${durationMs}ms.`);

    return {
      success: true,
      sourceType,
      sourceIdentifier,
      decryptedSizeBytes,
      durationMs,
      tablesValidated: validationReports,
      totalTables,
      totalRowsRestored
    };

  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err?.message || String(err);
    console.error(`[RestoreService] ERROR: Restoration failed after ${durationMs}ms:`, errorMsg);

    return {
      success: false,
      sourceType,
      sourceIdentifier,
      decryptedSizeBytes: 0,
      durationMs,
      tablesValidated: [],
      totalTables: 0,
      totalRowsRestored: 0,
      error: errorMsg
    };
  }
}

/**
 * Restores PostgreSQL from a local encrypted backup file into an isolated target pool
 */
export async function restoreFromLocalFile(filePath: string, targetPool: pg.Pool): Promise<RestoreResult> {
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      sourceType: 'local_file',
      sourceIdentifier: filePath,
      decryptedSizeBytes: 0,
      durationMs: 0,
      tablesValidated: [],
      totalTables: 0,
      totalRowsRestored: 0,
      error: `Local backup file does not exist at path: ${filePath}`
    };
  }

  const encryptedBuffer = fs.readFileSync(filePath);
  return restoreDatabaseFromEncryptedBuffer(encryptedBuffer, targetPool, 'local_file', path.basename(filePath));
}

/**
 * Restores PostgreSQL from an S3 offsite object into an isolated target pool
 */
export async function restoreFromS3Object(s3Key: string, targetPool: pg.Pool): Promise<RestoreResult> {
  try {
    const encryptedBuffer = await downloadBackupFromS3(s3Key);
    return restoreDatabaseFromEncryptedBuffer(encryptedBuffer, targetPool, 's3_object', s3Key);
  } catch (err: any) {
    return {
      success: false,
      sourceType: 's3_object',
      sourceIdentifier: s3Key,
      decryptedSizeBytes: 0,
      durationMs: 0,
      tablesValidated: [],
      totalTables: 0,
      totalRowsRestored: 0,
      error: `Failed to download or restore from S3 key "${s3Key}": ${err?.message || err}`
    };
  }
}
