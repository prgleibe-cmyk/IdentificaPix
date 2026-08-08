import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeBackup } from '../services/backup.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const rawConnectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING;
const isValidConnectionString = typeof rawConnectionString === 'string' && 
  (rawConnectionString.startsWith('postgres://') || rawConnectionString.startsWith('postgresql://'));

const connectionString = isValidConnectionString ? rawConnectionString : null;

let poolConfig: pg.PoolConfig;

if (connectionString) {
  poolConfig = {
    connectionString,
    ssl: connectionString.includes('supabase') || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  };
} else {
  poolConfig = {
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    database: process.env.PGDATABASE || process.env.DB_DATABASE || 'contributors',
  };
}

const pool = new pg.Pool(poolConfig);

async function main() {
  console.log('[Backup Script] Starting PostgreSQL backup process...');
  try {
    const result = await executeBackup(pool);
    if (result.success) {
      console.log('[Backup Script] Backup completed successfully:', result.filename);
      process.exit(0);
    } else {
      console.error('[Backup Script] Backup failed:', result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('[Backup Script] Fatal error running backup:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
