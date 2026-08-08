import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { restoreFromLocalFile, restoreFromS3Object } from '../services/restore.service.js';
import { getBackupDirectory } from '../services/backup.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  console.log('--- IGGESTOR DISASTER RECOVERY RESTORE TOOL ---');

  const targetConnString = process.env.RESTORE_TARGET_DATABASE_URL || process.env.TEST_DATABASE_URL;

  if (!targetConnString) {
    console.error('[ERROR] RESTORE_TARGET_DATABASE_URL environment variable is required to prevent accidental restore on production.');
    console.error('Example usage: RESTORE_TARGET_DATABASE_URL=postgres://user:pass@localhost:5432/test_db npx tsx scripts/restore-backup.ts [file-or-s3-key]');
    process.exit(1);
  }

  const arg = process.argv[2];
  let backupFilePath = '';
  let s3Key = '';

  if (arg) {
    if (arg.startsWith('backups/') || arg.includes('/')) {
      if (fs.existsSync(arg)) {
        backupFilePath = path.resolve(arg);
      } else {
        s3Key = arg;
      }
    } else {
      const localCandidate = path.join(getBackupDirectory(), arg);
      if (fs.existsSync(localCandidate)) {
        backupFilePath = localCandidate;
      } else {
        s3Key = arg;
      }
    }
  } else {
    // Pick latest local backup file automatically if none specified
    const backupDir = getBackupDirectory();
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.enc'))
        .sort()
        .reverse();
      if (files.length > 0) {
        backupFilePath = path.join(backupDir, files[0]);
        console.log(`[Info] No backup specified. Using latest local backup: ${files[0]}`);
      }
    }
  }

  if (!backupFilePath && !s3Key) {
    console.error('[ERROR] No valid backup file or S3 key found to restore.');
    process.exit(1);
  }

  console.log(`[Config] Target Test Database: ${targetConnString.replace(/:[^:@]+@/, ':****@')}`);
  
  const testPool = new pg.Pool({
    connectionString: targetConnString,
    ssl: targetConnString.includes('supabase') || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  try {
    let result;
    if (backupFilePath) {
      console.log(`[Action] Restoring from local backup file: ${backupFilePath}`);
      result = await restoreFromLocalFile(backupFilePath, testPool);
    } else {
      console.log(`[Action] Restoring from S3 key: ${s3Key}`);
      result = await restoreFromS3Object(s3Key, testPool);
    }

    if (result.success) {
      console.log('\n==================================================');
      console.log('    RESTORATION & INTEGRITY CHECK PASSED SUCCESSFULLY');
      console.log('==================================================');
      console.log(`Source Identifier  : ${result.sourceIdentifier}`);
      console.log(`Decrypted Size     : ${(result.decryptedSizeBytes / 1024).toFixed(1)} KB`);
      console.log(`Duration           : ${result.durationMs} ms`);
      console.log(`Total Tables       : ${result.totalTables}`);
      console.log(`Total Rows Restored: ${result.totalRowsRestored}`);
      console.log('\nValidated Critical Tables:');
      result.tablesValidated.forEach(t => {
        console.log(`  - ${t.tableName.padEnd(26)} : ${t.exists ? 'EXISTS' : 'MISSING'} (${t.rowCount} rows)`);
      });
      console.log('==================================================\n');
      process.exit(0);
    } else {
      console.error('\n[ERROR] Restoration failed:', result.error);
      process.exit(1);
    }

  } catch (err) {
    console.error('[ERROR] Unexpected failure during restore operation:', err);
    process.exit(1);
  } finally {
    await testPool.end();
  }
}

main();
