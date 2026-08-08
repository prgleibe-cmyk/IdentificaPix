import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { execFile } from 'child_process';
import { promisify } from 'util';
import pg from 'pg';
import { 
  S3Client, 
  PutObjectCommand, 
  HeadObjectCommand, 
  ListObjectsV2Command, 
  DeleteObjectCommand 
} from '@aws-sdk/client-s3';

const execFileAsync = promisify(execFile);

const MAGIC_HEADER = Buffer.from('IGBCKPv1', 'utf8'); // 8 bytes
const IV_LENGTH = 12; // 12 bytes for AES-256-GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes for AES-256-GCM

export interface BackupResult {
  success: boolean;
  filename: string;
  filepath: string;
  sizeBytes: number;
  durationMs: number;
  error?: string;
  verified?: boolean;
  cleanedCount?: number;
  offsiteUploaded?: boolean;
  offsiteKey?: string;
  offsiteError?: string;
}

export function getBackupEncryptionKey(): Buffer {
  const passphrase = process.env.BACKUP_ENCRYPTION_KEY || process.env.BACKUP_KEY || process.env.JWT_SECRET || 'iggestor-default-secure-backup-key-2026';
  if (!process.env.BACKUP_ENCRYPTION_KEY && !process.env.BACKUP_KEY) {
    console.warn('[BackupService] WARNING: BACKUP_ENCRYPTION_KEY env variable not explicitly set. Using derived key from system secret.');
  }
  // Derive a strong 32-byte key using scrypt
  return crypto.scryptSync(passphrase, 'iggestor-backup-salt-v1', 32);
}

export function getBackupDirectory(): string {
  const customDir = process.env.BACKUP_DIR;
  if (customDir) {
    return path.isAbsolute(customDir) ? customDir : path.resolve(process.cwd(), customDir);
  }
  return path.resolve(process.cwd(), 'backups');
}

/**
 * Pure TypeScript SQL Dumper used as a safe fallback when pg_dump CLI is not present in container
 */
export async function dumpDatabasePureNode(pool: pg.Pool): Promise<string> {
  const client = await pool.connect();
  try {
    const timestamp = new Date().toISOString();
    let sqlOutput = `-- IgGestor PostgreSQL Backup\n`;
    sqlOutput += `-- Generated At: ${timestamp}\n`;
    sqlOutput += `SET statement_timeout = 0;\nSET lock_timeout = 0;\nSET client_encoding = 'UTF8';\n\n`;

    // Fetch all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);

    for (const tableName of tables) {
      sqlOutput += `-- Table: public."${tableName}"\n`;
      
      // Get table columns
      const colsRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position ASC;
      `, [tableName]);

      const columns = colsRes.rows.map(c => c.column_name);
      if (columns.length === 0) continue;

      const escapedCols = columns.map(c => `"${c}"`).join(', ');

      // Fetch table rows
      const rowsRes = await client.query(`SELECT * FROM "${tableName}";`);
      
      if (rowsRes.rows.length > 0) {
        sqlOutput += `TRUNCATE TABLE "${tableName}" CASCADE;\n`;

        for (const row of rowsRes.rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return String(val);
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') {
              const str = JSON.stringify(val).replace(/'/g, "''");
              return `'${str}'::jsonb`;
            }
            const escapedStr = String(val).replace(/'/g, "''");
            return `'${escapedStr}'`;
          });

          sqlOutput += `INSERT INTO "${tableName}" (${escapedCols}) VALUES (${values.join(', ')});\n`;
        }
      }
      sqlOutput += `\n`;
    }

    return sqlOutput;
  } finally {
    client.release();
  }
}

/**
 * Attempts pg_dump CLI first; if not found or fails, falls back to dumpDatabasePureNode
 */
export async function dumpDatabase(pool: pg.Pool): Promise<string> {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING;
  
  if (connectionString) {
    try {
      const { stdout } = await execFileAsync('pg_dump', ['--clean', '--if-exists', '--no-owner', '--no-privileges', connectionString], {
        maxBuffer: 100 * 1024 * 1024 // 100MB buffer
      });
      if (stdout && stdout.trim().length > 0) {
        return stdout;
      }
    } catch (err: any) {
      console.warn('[BackupService] pg_dump CLI execution skipped or unavailable. Falling back to pure Node dumper.', err?.message || err);
    }
  }

  // Pure Node SQL Dumper fallback
  return await dumpDatabasePureNode(pool);
}

/**
 * Compresses (gzip) and encrypts (AES-256-GCM) the dump text
 */
export function encryptAndCompress(sqlDump: string, key: Buffer): Buffer {
  const gzippedBuffer = zlib.gzipSync(Buffer.from(sqlDump, 'utf8'), { level: 9 });

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encryptedPayload = Buffer.concat([cipher.update(gzippedBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Packet format: [MAGIC_HEADER 8B] [IV 12B] [AUTH_TAG 16B] [ENCRYPTED_PAYLOAD]
  return Buffer.concat([MAGIC_HEADER, iv, authTag, encryptedPayload]);
}

/**
 * Decrypts and decompresses an encrypted backup buffer
 */
export function decryptAndDecompress(encryptedBuffer: Buffer, key: Buffer): string {
  if (encryptedBuffer.length < MAGIC_HEADER.length + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid backup file format: file too small');
  }

  const magic = encryptedBuffer.subarray(0, MAGIC_HEADER.length);
  if (!magic.equals(MAGIC_HEADER)) {
    throw new Error('Invalid backup file format: magic header mismatch');
  }

  let offset = MAGIC_HEADER.length;
  const iv = encryptedBuffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const authTag = encryptedBuffer.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;

  const encryptedPayload = encryptedBuffer.subarray(offset);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decryptedCompressed = Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);
  const decompressedString = zlib.gunzipSync(decryptedCompressed).toString('utf8');

  return decompressedString;
}

/**
 * Verifies that an encrypted backup file exists, size > 0, and can be decrypted correctly
 */
export function verifyBackupFile(filePath: string, key: Buffer): boolean {
  if (!fs.existsSync(filePath)) return false;
  const stats = fs.statSync(filePath);
  if (stats.size === 0) return false;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const sqlDump = decryptAndDecompress(fileBuffer, key);
    return sqlDump.includes('IgGestor') || sqlDump.includes('SET ') || sqlDump.includes('INSERT INTO') || sqlDump.length > 0;
  } catch (err: any) {
    console.error('[BackupService] Verification failed for backup file:', filePath, err?.message || err);
    return false;
  }
}

/**
 * Cleans old backup files according to retention policy
 */
export function cleanOldBackups(backupDir: string, retentionDays = 7, maxFiles = 14): number {
  if (!fs.existsSync(backupDir)) return 0;

  const files = fs.readdirSync(backupDir);
  const backupFiles = files
    .filter(f => f.startsWith('backup-') && f.endsWith('.enc'))
    .map(f => {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      return { filename: f, path: fullPath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs); // Sort newest first

  const nowMs = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  let removedCount = 0;

  backupFiles.forEach((file, index) => {
    const isTooOld = (nowMs - file.mtimeMs) > maxAgeMs;
    const isExceedingMaxCount = index >= maxFiles;

    if (isTooOld || isExceedingMaxCount) {
      try {
        fs.unlinkSync(file.path);
        removedCount++;
      } catch (err: any) {
        console.error('[BackupService] Error deleting old backup file:', file.filename, err?.message || err);
      }
    }
  });

  return removedCount;
}

/**
 * Returns S3 client instance if credentials are provided in environment
 */
export function getS3Client(): { client: S3Client; bucket: string; prefix: string } | null {
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.S3_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
  const prefix = (process.env.S3_PREFIX || 'backups/').replace(/^\/+/, '');

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const s3Client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
  });

  return { client: s3Client, bucket, prefix };
}

/**
 * Uploads encrypted backup buffer to offsite S3-compatible Object Storage
 */
export async function uploadBackupToS3(filename: string, encryptedBuffer: Buffer): Promise<{ uploaded: boolean; key?: string; error?: string }> {
  const s3Config = getS3Client();
  if (!s3Config) {
    return {
      uploaded: false,
      error: 'S3 offsite credentials not configured (S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY missing)'
    };
  }

  const { client, bucket, prefix } = s3Config;

  // Build key hierarchy e.g. backups/2026/08/backup-2026-08-08-120000.sql.gz.enc
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const s3Key = `${normalizedPrefix}${year}/${month}/${filename}`;

  try {
    // 1. Put object to private bucket
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: encryptedBuffer,
      ContentType: 'application/octet-stream',
      ACL: 'private' // Ensures object remains strictly private
    }));

    // 2. Confirm object existence remotely via HeadObject
    await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: s3Key
    }));

    console.log(`[BackupService] OFFSITE SUCCESS: Backup uploaded to S3 bucket "${bucket}" at key "${s3Key}".`);
    return { uploaded: true, key: s3Key };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.warn(`[BackupService] OFFSITE WARNING: Failed to upload backup to S3 offsite storage:`, errorMsg);
    // Return failure result WITHOUT throwing or deleting local backup
    return { uploaded: false, error: errorMsg };
  }
}

/**
 * Main function to execute PostgreSQL backup with compression, encryption, retention, and offsite upload
 */
export async function executeBackup(pool: pg.Pool): Promise<BackupResult> {
  const startTime = Date.now();
  const backupDir = getBackupDirectory();

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${dateStr}.sql.gz.enc`;
    const filepath = path.join(backupDir, filename);

    const key = getBackupEncryptionKey();

    // 1. Generate SQL dump
    const sqlDump = await dumpDatabase(pool);

    // 2. Compress & Encrypt
    const encryptedBuffer = encryptAndCompress(sqlDump, key);

    // 3. Save to local persistent VPS backup directory
    fs.writeFileSync(filepath, encryptedBuffer);

    // 4. Validate integrity
    const isVerified = verifyBackupFile(filepath, key);
    if (!isVerified) {
      throw new Error('Backup integrity validation failed after writing file');
    }

    // 5. Apply retention cleaning locally
    const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 7);
    const maxFiles = Number(process.env.BACKUP_MAX_FILES || 14);
    const cleanedCount = cleanOldBackups(backupDir, retentionDays, maxFiles);

    // 6. Upload encrypted backup to offsite S3 object storage (if configured)
    const offsiteResult = await uploadBackupToS3(filename, encryptedBuffer);

    const durationMs = Date.now() - startTime;
    const sizeBytes = encryptedBuffer.length;

    console.log(`[BackupService] SUCCESS: Created encrypted PostgreSQL backup "${filename}" (${(sizeBytes / 1024).toFixed(1)} KB) in ${durationMs}ms. Local cleanup: ${cleanedCount}. Offsite status: ${offsiteResult.uploaded ? 'Uploaded (' + offsiteResult.key + ')' : 'Not Uploaded (' + (offsiteResult.error || 'N/A') + ')'}`);

    return {
      success: true,
      filename,
      filepath,
      sizeBytes,
      durationMs,
      verified: true,
      cleanedCount,
      offsiteUploaded: offsiteResult.uploaded,
      offsiteKey: offsiteResult.key,
      offsiteError: offsiteResult.error
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err?.message || String(err);
    console.error(`[BackupService] ERROR: Backup failed after ${durationMs}ms:`, errorMessage);

    return {
      success: false,
      filename: '',
      filepath: '',
      sizeBytes: 0,
      durationMs,
      error: errorMessage
    };
  }
}

/**
 * Schedules daily backup execution in Node process if enabled via env
 */
export function scheduleAutomatedBackups(pool: pg.Pool): void {
  const enabled = process.env.BACKUP_SCHEDULE_ENABLED === 'true' || process.env.NODE_ENV === 'production';
  if (!enabled) {
    console.log('[BackupService] Automated in-process backup schedule disabled (set BACKUP_SCHEDULE_ENABLED=true to enable).');
    return;
  }

  console.log('[BackupService] Initializing automated daily PostgreSQL backup schedule...');
  
  // Run once on startup (after a short delay to let DB initialize)
  setTimeout(() => {
    executeBackup(pool).catch(e => console.error('[BackupService] Scheduled backup error:', e));
  }, 10000);

  // Run every 24 hours
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    executeBackup(pool).catch(e => console.error('[BackupService] Scheduled backup error:', e));
  }, TWENTY_FOUR_HOURS_MS);
}
