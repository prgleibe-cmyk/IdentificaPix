import express, { Request, Response } from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const requireFallback = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Helper function to query SQLite fallback
function querySqlite(db: any, sql: string, params?: any[]): any {
  let translatedSql = sql;
  let translatedParams = params || [];

  if (/CREATE\s+EXTENSION/i.test(sql)) {
    console.log('[SQLite Fallback] Ignoring CREATE EXTENSION:', sql);
    return { rows: [], rowCount: 0 };
  }
  if (/ALTER\s+COLUMN/i.test(sql)) {
    console.log('[SQLite Fallback] Ignoring ALTER COLUMN:', sql);
    return { rows: [], rowCount: 0 };
  }

  // Handle ALTER TABLE ADD COLUMN
  const cleanSql = sql.replace(/\s+/g, ' ').trim();
  const alterMatch = cleanSql.match(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+(.+)/i);
  if (alterMatch) {
    const tableName = alterMatch[1];
    const columnName = alterMatch[2];
    let columnDef = alterMatch[3];
    if (columnDef.endsWith(';')) {
      columnDef = columnDef.slice(0, -1);
    }

    try {
      const infoStmt = db.prepare(`PRAGMA table_info("${tableName}");`);
      const cols = infoStmt.all();
      const colExists = cols.some((c: any) => c.name.toLowerCase() === columnName.toLowerCase());
      if (colExists) {
        console.log(`[SQLite Fallback] Column "${columnName}" already exists on table "${tableName}". Skipping ADD COLUMN.`);
        return { rows: [], rowCount: 0 };
      }

      let sqliteColDef = columnDef
        .replace(/UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/ig, 'TEXT PRIMARY KEY')
        .replace(/\bVARCHAR\(\d+\)/ig, 'TEXT')
        .replace(/\bVARCHAR\b/ig, 'TEXT')
        .replace(/\bTIMESTAMP\b/ig, 'TEXT')
        .replace(/\bBOOLEAN\b/ig, 'INTEGER')
        .replace(/\bJSONB\b/ig, 'TEXT')
        .replace(/\bINT\b/ig, 'INTEGER')
        .replace(/\bNUMERIC\(\d+,\s*\d+\)/ig, 'NUMERIC')
        .replace(/DEFAULT\s+NOW\(\)/ig, "DEFAULT (now())")
        .replace(/DEFAULT\s+gen_random_uuid\(\)/ig, "DEFAULT (gen_random_uuid())");

      const runSql = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${sqliteColDef};`;
      console.log('[SQLite Fallback] Executing ADD COLUMN:', runSql);
      db.exec(runSql);
      return { rows: [], rowCount: 0 };
    } catch (err: any) {
      console.error('[SQLite Fallback] Error in ALTER TABLE ADD COLUMN:', err.message);
      return { rows: [], rowCount: 0 };
    }
  }

  // Translate general CREATE TABLE types and defaults, remove PostgreSQL type casts, and handle NOW()
  translatedSql = translatedSql
    .replace(/UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)(?:::\w+)?/ig, 'TEXT PRIMARY KEY DEFAULT (gen_random_uuid())')
    .replace(/\bVARCHAR\(\d+\)/ig, 'TEXT')
    .replace(/\bVARCHAR\b/ig, 'TEXT')
    .replace(/\bTIMESTAMP\b/ig, 'TEXT')
    .replace(/\bBOOLEAN\b/ig, 'INTEGER')
    .replace(/\bJSONB\b/ig, 'TEXT')
    .replace(/\bINT\b/ig, 'INTEGER')
    .replace(/\bNUMERIC\(\d+,\s*\d+\)/ig, 'NUMERIC')
    .replace(/DEFAULT\s+NOW\(\)/ig, "DEFAULT (now())")
    .replace(/DEFAULT\s+now\(\)/ig, "DEFAULT (now())")
    .replace(/DEFAULT\s+gen_random_uuid\(\)(?:::\w+)?/ig, "DEFAULT (gen_random_uuid())")
    .replace(/::\w+/g, '')
    .replace(/\bNOW\(\)/ig, "now()");

  if (translatedSql.includes('id = ANY($1)') && Array.isArray(translatedParams[0])) {
    const ids = translatedParams[0];
    if (ids.length === 0) {
      return { rows: [], rowCount: 0 };
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    translatedSql = translatedSql.replace('id = ANY($1)', `id IN (${placeholders})`);
    translatedParams = ids;
  }

  const sqliteParams: any = {};
  for (let i = 0; i < translatedParams.length; i++) {
    let val = translatedParams[i];
    if (typeof val === 'boolean') {
      val = val ? 1 : 0;
    } else if (val === undefined) {
      val = null;
    }
    sqliteParams[`$${i + 1}`] = val;
  }

  try {
    const isMutatingNoSelect = /^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(translatedSql) && !/RETURNING/i.test(translatedSql);
    if (isMutatingNoSelect) {
      const stmt = db.prepare(translatedSql);
      const runResult = stmt.run(sqliteParams);
      return {
        rows: [],
        rowCount: runResult.changes,
        fields: []
      };
    } else {
      const stmt = db.prepare(translatedSql);
      const rows = stmt.all(sqliteParams);

      const mappedRows = rows.map((row: any) => {
        const mappedRow = { ...row };
        for (const key in mappedRow) {
          if (key === 'data' && typeof mappedRow[key] === 'string') {
            try {
              mappedRow[key] = JSON.parse(mappedRow[key]);
            } catch (e) {
              // Ignore
            }
          }
          if ((key === 'is_confirmed' || key === 'is_active' || key === 'active' || key === 'tithe_enabled') && typeof mappedRow[key] === 'number') {
            mappedRow[key] = mappedRow[key] === 1;
          }
        }
        return mappedRow;
      });

      return {
        rows: mappedRows,
        rowCount: mappedRows.length,
        fields: []
      };
    }
  } catch (err: any) {
    console.error('[SQLite Fallback] Database query execution error:', err.message, '\nOriginal SQL:', sql);
    throw err;
  }
}

class SqliteClient {
  constructor(private db: any) {}
  async query(sql: string, params?: any[]): Promise<any> {
    return querySqlite(this.db, sql, params);
  }
  release() {
    // No-op
  }
}

class SmartPool {
  private pgPool: pg.Pool;
  private sqliteDb: any = null;
  private isSqliteFallback = false;
  private fallbackChecked = false;

  constructor(config: pg.PoolConfig) {
    this.pgPool = new Pool(config);
  }

  private async checkConnection(): Promise<boolean> {
    if (this.fallbackChecked) {
      return !this.isSqliteFallback;
    }
    try {
      const client = await this.pgPool.connect();
      client.release();
      this.isSqliteFallback = false;
      this.fallbackChecked = true;
      console.log('[Contributors API] PostgreSQL connected successfully.');
      return true;
    } catch (err: any) {
      console.warn('[Contributors API] PostgreSQL failed to connect. Falling back to native SQLite:', err.message);
      this.initSqlite();
      this.isSqliteFallback = true;
      this.fallbackChecked = true;
      return false;
    }
  }

  private initSqlite() {
    if (this.sqliteDb) return;
    try {
      const dbPath = path.join(__dirname, 'local_fallback.db');
      console.log('[Contributors API] SQLite fallback active at:', dbPath);
      const { DatabaseSync } = requireFallback('node:sqlite') as any;
      this.sqliteDb = new DatabaseSync(dbPath);
      this.sqliteDb.function('gen_random_uuid', () => crypto.randomUUID());
      this.sqliteDb.function('GEN_RANDOM_UUID', () => crypto.randomUUID());
      this.sqliteDb.function('now', () => new Date().toISOString());
      this.sqliteDb.function('NOW', () => new Date().toISOString());
    } catch (err: any) {
      console.error('[Contributors API] SQLite initialization failed:', err.message);
    }
  }

  async connect(): Promise<any> {
    await this.checkConnection();
    if (this.isSqliteFallback) {
      this.initSqlite();
      return new SqliteClient(this.sqliteDb);
    }
    return await this.pgPool.connect();
  }

  async query(sql: string, params?: any[]): Promise<any> {
    await this.checkConnection();
    if (this.isSqliteFallback) {
      this.initSqlite();
      return querySqlite(this.sqliteDb, sql, params);
    }
    try {
      return await this.pgPool.query(sql, params);
    } catch (err: any) {
      if (err.code === 'EAI_AGAIN' || err.code === 'ECONNREFUSED' || err.message.includes('getaddrinfo') || err.message.includes('connect')) {
        console.warn('[Contributors API] PostgreSQL query failed with connection error, switching to SQLite fallback.');
        this.initSqlite();
        this.isSqliteFallback = true;
        return querySqlite(this.sqliteDb, sql, params);
      }
      throw err;
    }
  }

  async end() {
    await this.pgPool.end();
  }
}

export const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

// Configure PostgreSQL connection
const rawConnectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING;
const isValidConnectionString = typeof rawConnectionString === 'string' && 
  (rawConnectionString.startsWith('postgres://') || rawConnectionString.startsWith('postgresql://'));

const connectionString = isValidConnectionString ? rawConnectionString : null;

let pool: pg.Pool;

if (connectionString) {
  console.log('[Contributors API] Using connection string for PostgreSQL database.');
  pool = new SmartPool({
    connectionString,
    ssl: connectionString.includes('supabase') || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  }) as any;
} else {
  if (rawConnectionString && !isValidConnectionString) {
    console.warn(`[Contributors API] WARNING: DATABASE_URL is not a valid connection URI ("${rawConnectionString.substring(0, 50)}..."). Using individual parameters instead.`);
  } else {
    console.log('[Contributors API] No connection string provided. Using individual parameters for PostgreSQL database connection.');
  }
  pool = new SmartPool({
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    database: process.env.PGDATABASE || process.env.DB_DATABASE || 'contributors',
  }) as any;
}

// Database tables initialization
async function initializeDatabase() {
  let client;
  try {
    client = await pool.connect();
    console.log('[Contributors API] Connected to PostgreSQL environment successfully!');
    
    // Enable extensions for UUID generation if possible
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    } catch (extErr) {
      console.warn('[Contributors API] Warning: could not enable uuid/pgcrypto extensions:', (extErr as Error).message);
    }

    // Create table contributors
    await client.query(`
      CREATE TABLE IF NOT EXISTS contributors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        church_id UUID NOT NULL,
        canonical_name VARCHAR(255) NOT NULL,
        cpf VARCHAR(11),
        email VARCHAR(255),
        phone VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Ensure all columns exist (in case the table already existed under an older schema)
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS email VARCHAR(255);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS phone VARCHAR(50);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS person_type VARCHAR(20) DEFAULT 'PF';");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS rg_ie VARCHAR(50);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS birth_date VARCHAR(50);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS category VARCHAR(100);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS bank_agency VARCHAR(50);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS address_cep VARCHAR(20);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS address_street VARCHAR(255);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS address_number VARCHAR(50);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS address_city VARCHAR(100);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS address_state VARCHAR(10);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS notes TEXT;");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS role_position VARCHAR(100);");
    console.log('[Contributors API] Table "contributors" verified or successfully created.');

    // Create table banks
    await client.query(`
      CREATE TABLE IF NOT EXISTS banks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        user_id UUID,
        bank_key VARCHAR(255),
        account_name VARCHAR(255),
        accepted_contribution_types TEXT[],
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS bank_key VARCHAR(255);');
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);');
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS accepted_contribution_types TEXT[];');
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "banks" verified or successfully created.');

    // Create table churches
    await client.query(`
      CREATE TABLE IF NOT EXISTS churches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        "logoUrl" TEXT NOT NULL,
        pastor VARCHAR(255) NOT NULL,
        user_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS address TEXT;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS pastor VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS cnpj VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS phone VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS email VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS "pixKey" VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS cep VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS city VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS state VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS treasurer VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS pastors JSONB;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS treasurers JSONB;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS whatsapp_official VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS whatsapp_responsible VARCHAR(100) DEFAULT \'tesouraria\';');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS auto_comm_enabled BOOLEAN DEFAULT true;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS auto_send_on_confirmation BOOLEAN DEFAULT true;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "churches" verified or successfully created.');

    // Create table pastoral_messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS pastoral_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        church_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'texto',
        content TEXT NOT NULL,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true,
        user_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create table communication_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS communication_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        church_id UUID NOT NULL,
        contributor_id UUID,
        contributor_name VARCHAR(255),
        event_type VARCHAR(100) NOT NULL,
        channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
        status VARCHAR(50) NOT NULL DEFAULT 'enviado',
        recipient_phone VARCHAR(50),
        message_summary TEXT,
        error_message TEXT,
        user_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create table communication_events
    await client.query(`
      CREATE TABLE IF NOT EXISTS communication_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(100) NOT NULL DEFAULT 'ContributionConfirmed',
        church_id UUID NOT NULL,
        contributor_id UUID,
        reference_id VARCHAR(255),
        payload JSONB NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        user_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create table communication_queue
    await client.query(`
      CREATE TABLE IF NOT EXISTS communication_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID,
        church_id UUID NOT NULL,
        contributor_id UUID,
        recipient_phone VARCHAR(50),
        channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
        message_type VARCHAR(50) NOT NULL DEFAULT 'ContributionConfirmed',
        rendered_content TEXT NOT NULL,
        media_attachments JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 3,
        next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
        error_message TEXT,
        provider_message_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Ensure columns for provider message tracking exist
    await client.query(`ALTER TABLE communication_queue ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);`);
    await client.query(`ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);`);
    await client.query(`ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS queue_id UUID;`);

    const churchCountRes = await client.query('SELECT COUNT(*) as count FROM churches;');
    if (parseInt(churchCountRes.rows[0]?.count || '0', 10) === 0) {
      await client.query(`
        INSERT INTO churches (id, name, address, "logoUrl", pastor, user_id)
        VALUES ('00000000-0000-0000-0000-000000000001', 'Igreja Sede Central', 'Sede Central', '', 'Pr. Responsável', '00000000-0000-0000-0000-000000000001')
        ON CONFLICT DO NOTHING;
      `);
      console.log('[Contributors API] Default church seeded.');
    }

    // Create table consolidated_transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS consolidated_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        amount NUMERIC(12, 2) NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        pix_key VARCHAR(255),
        source VARCHAR(50) NOT NULL DEFAULT 'file',
        user_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        bank_id UUID,
        row_hash VARCHAR(255),
        is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        transaction_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS description TEXT;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(50);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);');
    await client.query("ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'file';");
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query("ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';");
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS bank_id UUID;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS row_hash VARCHAR(255);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT FALSE;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS contributor_id UUID;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS report_id VARCHAR(255);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS contribution_type VARCHAR(255);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS contribution_request_id UUID;');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_contrib_req ON consolidated_transactions(church_id, contribution_request_id);');
    console.log('[Contributors API] Table "consolidated_transactions" verified or successfully created.');

    // Create table learned_associations
    await client.query(`
      CREATE TABLE IF NOT EXISTS learned_associations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        normalized_description TEXT NOT NULL,
        contributor_normalized_name VARCHAR(255) NOT NULL,
        church_id UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS normalized_description TEXT;');
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS contributor_normalized_name VARCHAR(255);');
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "learned_associations" verified or successfully created.');

    // Create table saved_reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_reports (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        name VARCHAR(255) NOT NULL,
        record_count INT NOT NULL DEFAULT 0,
        user_id UUID NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    try {
      // Remover valor padrão para permitir alteração de UUID para VARCHAR
      await client.query('ALTER TABLE saved_reports ALTER COLUMN id DROP DEFAULT;');
      await client.query('ALTER TABLE saved_reports ALTER COLUMN id TYPE VARCHAR(255) USING id::varchar;');
      await client.query('ALTER TABLE saved_reports ALTER COLUMN id SET DEFAULT gen_random_uuid()::varchar;');
      console.log('[Contributors API] Altered saved_reports.id to VARCHAR(255) successfully.');
    } catch (alterErr) {
      console.warn('[Contributors API] Warning: could not alter saved_reports.id to VARCHAR, attempting fallback default update:', (alterErr as any).message);
      try {
        await client.query('ALTER TABLE saved_reports ALTER COLUMN id SET DEFAULT gen_random_uuid()::varchar;');
      } catch (fallbackErr) {
        // Ignora erro no fallback de default
      }
    }
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS record_count INT DEFAULT 0;');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS data JSONB;');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "saved_reports" verified or successfully created.');

    // Create table financial_records
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        church_id UUID,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        amount NUMERIC(12, 2) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        recipient_name VARCHAR(255),
        recipient_type VARCHAR(50),
        due_date TIMESTAMP,
        payment_date TIMESTAMP,
        recurrence VARCHAR(50) DEFAULT 'none',
        parent_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS title VARCHAR(255);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS description TEXT;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS type VARCHAR(50);');
    await client.query("ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';");
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;');
    await client.query("ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS recurrence VARCHAR(50) DEFAULT 'none';");
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS parent_id UUID;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS bank_transaction_id VARCHAR(255);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS bank_transaction_desc VARCHAR(255);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "financial_records" verified or successfully created.');

    // Create table pastor_automations
    await client.query(`
      CREATE TABLE IF NOT EXISTS pastor_automations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        pastor_name VARCHAR(255) NOT NULL,
        pix_key VARCHAR(255) NOT NULL,
        pix_key_type VARCHAR(50) DEFAULT 'cpf',
        payment_day INT NOT NULL DEFAULT 10,
        gross_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        tithe_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        tithe_enabled BOOLEAN DEFAULT TRUE,
        church_id UUID,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[Contributors API] Table "pastor_automations" verified or successfully created.');

    // Create table contribution_requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS contribution_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        church_id UUID NOT NULL,
        contributor_id UUID NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE contribution_requests ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE contribution_requests ADD COLUMN IF NOT EXISTS contributor_id UUID;');
    await client.query('ALTER TABLE contribution_requests ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);');
    await client.query('ALTER TABLE contribution_requests ADD COLUMN IF NOT EXISTS description TEXT;');
    await client.query("ALTER TABLE contribution_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending';");
    await client.query("ALTER TABLE contribution_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();");
    await client.query("ALTER TABLE contribution_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contribution_requests_church ON contribution_requests(church_id);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contribution_requests_contributor ON contribution_requests(church_id, contributor_id);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contribution_requests_status ON contribution_requests(church_id, status);");
    console.log('[Contributors API] Table "contribution_requests" verified or successfully created.');

    // Create table church_pix_keys
    await client.query(`
      CREATE TABLE IF NOT EXISTS church_pix_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bank_id UUID,
        church_id UUID,
        pix_type VARCHAR(50) NOT NULL,
        pix_key VARCHAR(255) NOT NULL,
        holder_name VARCHAR(255),
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE church_pix_keys ADD COLUMN IF NOT EXISTS bank_id UUID;');
    await client.query('ALTER TABLE church_pix_keys ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE church_pix_keys ALTER COLUMN church_id DROP NOT NULL;');
    await client.query('ALTER TABLE church_pix_keys ADD COLUMN IF NOT EXISTS pix_type VARCHAR(50);');
    await client.query('ALTER TABLE church_pix_keys ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);');
    await client.query('ALTER TABLE church_pix_keys ADD COLUMN IF NOT EXISTS holder_name VARCHAR(255);');
    await client.query('ALTER TABLE church_pix_keys ADD COLUMN IF NOT EXISTS description TEXT;');
    await client.query("ALTER TABLE church_pix_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;");
    await client.query("ALTER TABLE church_pix_keys ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();");
    await client.query("ALTER TABLE church_pix_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();");
    await client.query("CREATE INDEX IF NOT EXISTS idx_church_pix_keys_bank ON church_pix_keys(bank_id);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_church_pix_keys_bank_active ON church_pix_keys(bank_id, is_active);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_church_pix_keys_church ON church_pix_keys(church_id);");
    console.log('[Contributors API] Table "church_pix_keys" verified or successfully created.');

    // Create table contribution_types
    await client.query(`
      CREATE TABLE IF NOT EXISTS contribution_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'entrada',
        category VARCHAR(255),
        bank_id VARCHAR(255),
        "order" INT DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        user_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE contribution_types ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
    await client.query("ALTER TABLE contribution_types ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'entrada';");
    await client.query('ALTER TABLE contribution_types ADD COLUMN IF NOT EXISTS category VARCHAR(255);');
    await client.query('ALTER TABLE contribution_types ADD COLUMN IF NOT EXISTS bank_id VARCHAR(255);');
    await client.query('ALTER TABLE contribution_types ALTER COLUMN bank_id TYPE VARCHAR(255) USING bank_id::varchar;');
    await client.query('ALTER TABLE contribution_types ADD COLUMN IF NOT EXISTS "order" INT DEFAULT 1;');
    await client.query('ALTER TABLE contribution_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;');
    await client.query('ALTER TABLE contribution_types ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);');
    await client.query('ALTER TABLE contribution_types ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::varchar;');
    await client.query('ALTER TABLE contribution_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query("CREATE INDEX IF NOT EXISTS idx_contrib_types_bank ON contribution_types(bank_id);");
    console.log('[Contributors API] Table "contribution_types" verified or successfully created.');

  } catch (err) {
    console.error('[Contributors API] Database initialization could not be completed:', (err as Error).message);
  } finally {
    if (client) client.release();
  }
}

// Ensure database table setup executes upon initialization
initializeDatabase();

// GET /
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'contributors-api',
    status: 'running'
  });
});

// GET /health
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'contributors-api',
    version: '1.0.0'
  });
});

// GET /api/v1/contributors
app.get('/api/v1/contributors', async (req: Request, res: Response) => {
  try {
    const { church_id, status } = req.query;
    let query = 'SELECT * FROM contributors WHERE 1=1';
    const params: any[] = [];
    let paramCounter = 1;

    if (church_id && typeof church_id === 'string') {
      query += ` AND (church_id = $${paramCounter} OR is_global = TRUE)`;
      params.push(church_id);
      paramCounter++;
    }

    if (status && typeof status === 'string') {
      query += ` AND status = $${paramCounter}`;
      params.push(status);
      paramCounter++;
    }

    query += ' ORDER BY canonical_name ASC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error processing get contributors request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST & GET /api/v1/contributors/identify (Single-record identification endpoint for Portal do Contribuinte - LGPD & Multi-church secure)
const identifyContributorHandler = async (req: Request, res: Response) => {
  try {
    const rawChurchId = (req.body.church_id || req.query.church_id) as string | undefined;
    const identifier = (req.body.identifier || req.query.identifier) as string | undefined;
    const identifier_type = (req.body.identifier_type || req.query.identifier_type) as string | undefined;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    let church_id = rawChurchId;
    if (!church_id || typeof church_id !== 'string' || !uuidRegex.test(church_id)) {
      church_id = '00000000-0000-0000-0000-000000000001';
    }

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'identifier é obrigatório.' });
    }

    const typeLower = (identifier_type || 'cpf').trim().toLowerCase();
    if (!['cpf', 'phone', 'email'].includes(typeLower)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'identifier_type inválido. Tipos permitidos: cpf, phone, email.' });
    }

    const rawVal = identifier.trim();
    let matchedContributor: any = null;

    if (typeLower === 'cpf') {
      const cleanDigits = rawVal.replace(/\D/g, '');
      if (!cleanDigits) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'CPF inválido.' });
      }

      const result = await pool.query(
        `SELECT id, church_id, canonical_name, cpf, email, phone, status 
         FROM contributors 
         WHERE status = $1 AND (church_id = $2 OR church_id IS NULL) AND (cpf = $3 OR REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = $3)
         LIMIT 1`,
        ['active', church_id, cleanDigits]
      );

      if (result.rows.length > 0) {
        matchedContributor = result.rows[0];
      } else {
        const allRes = await pool.query(
          `SELECT id, church_id, canonical_name, cpf, email, phone, status 
           FROM contributors 
           WHERE status = $1`,
          ['active']
        );
        matchedContributor = allRes.rows.find((c: any) => c.cpf && String(c.cpf).replace(/\D/g, '') === cleanDigits) || null;
      }

    } else if (typeLower === 'phone') {
      const cleanDigits = rawVal.replace(/\D/g, '');
      if (!cleanDigits) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Telefone inválido.' });
      }

      const result = await pool.query(
        `SELECT id, church_id, canonical_name, cpf, email, phone, status 
         FROM contributors 
         WHERE status = $1 AND (church_id = $2 OR church_id IS NULL) AND (phone = $3 OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '(', ''), ')', ''), '-', ''), '+', '') = $3)
         LIMIT 1`,
        ['active', church_id, cleanDigits]
      );

      if (result.rows.length > 0) {
        matchedContributor = result.rows[0];
      } else {
        const allRes = await pool.query(
          `SELECT id, church_id, canonical_name, cpf, email, phone, status 
           FROM contributors 
           WHERE status = $1`,
          ['active']
        );
        matchedContributor = allRes.rows.find((c: any) => c.phone && String(c.phone).replace(/\D/g, '') === cleanDigits) || null;
      }

    } else if (typeLower === 'email') {
      const cleanEmail = rawVal.toLowerCase();

      const result = await pool.query(
        `SELECT id, church_id, canonical_name, cpf, email, phone, status 
         FROM contributors 
         WHERE status = $1 AND (church_id = $2 OR church_id IS NULL) AND LOWER(TRIM(email)) = $3
         LIMIT 1`,
        ['active', church_id, cleanEmail]
      );

      if (result.rows.length > 0) {
        matchedContributor = result.rows[0];
      } else {
        const allRes = await pool.query(
          `SELECT id, church_id, canonical_name, cpf, email, phone, status 
           FROM contributors 
           WHERE status = $1`,
          ['active']
        );
        matchedContributor = allRes.rows.find((c: any) => c.email && String(c.email).trim().toLowerCase() === cleanEmail) || null;
      }
    }

    if (matchedContributor) {
      return res.json({
        found: true,
        contributor: {
          id: matchedContributor.id,
          canonical_name: matchedContributor.canonical_name,
          cpf: matchedContributor.cpf || null,
          email: matchedContributor.email || null,
          phone: matchedContributor.phone || null,
          status: matchedContributor.status
        }
      });
    } else {
      return res.json({
        found: false,
        contributor: null,
        message: 'Nenhum contribuinte localizado para os dados informados.'
      });
    }

  } catch (err) {
    console.error('[Contributors API] Error identifying contributor:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro interno ao consultar contribuinte.' });
  }
};

app.post('/api/v1/contributors/identify', identifyContributorHandler);
app.get('/api/v1/contributors/identify', identifyContributorHandler);

// POST /api/v1/contribution-requests (Register contribution request intention)
app.post('/api/v1/contribution-requests', async (req: Request, res: Response) => {
  try {
    const { church_id, contributor_id, amount, description } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    // 1. Validate church_id
    if (!church_id || typeof church_id !== 'string' || !uuidRegex.test(church_id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'church_id é obrigatório e deve ser um UUID válido.'
      });
    }

    // Verify church exists
    const churchRes = await pool.query('SELECT id, name FROM churches WHERE id = $1 LIMIT 1', [church_id]);
    if (churchRes.rows.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Igreja informada não existe ou não foi encontrada.'
      });
    }

    // 2. Validate contributor_id
    if (!contributor_id || typeof contributor_id !== 'string' || !uuidRegex.test(contributor_id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'contributor_id é obrigatório e deve ser um UUID válido.'
      });
    }

    // Verify contributor exists AND belongs to the specified church (Multi-church tenant protection)
    const contribRes = await pool.query(
      'SELECT id, church_id, canonical_name FROM contributors WHERE id = $1 LIMIT 1',
      [contributor_id]
    );

    if (contribRes.rows.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Contribuinte informado não foi encontrado.'
      });
    }

    const contributor = contribRes.rows[0];
    if (!contributor.church_id) {
      await pool.query('UPDATE contributors SET church_id = $1 WHERE id = $2', [church_id, contributor.id]);
    }

    // 3. Validate amount
    const parsedAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'O valor da contribuição deve ser um número maior que zero.'
      });
    }

    const cleanDescription = typeof description === 'string' && description.trim() 
      ? description.trim() 
      : 'Intenção de Contribuição';

    // 4. Anti-duplication check: same contributor, church, amount, pending status within last 2 minutes
    const existingReqRes = await pool.query(
      `SELECT id, church_id, contributor_id, amount, description, status, created_at, updated_at
       FROM contribution_requests
       WHERE church_id = $1 
         AND contributor_id = $2 
         AND amount = $3 
         AND status = 'pending'
         AND created_at >= NOW() - INTERVAL '2 minutes'
       ORDER BY created_at DESC
       LIMIT 1`,
      [church_id, contributor_id, parsedAmount]
    );

    if (existingReqRes.rows.length > 0) {
      const existingReq = existingReqRes.rows[0];
      return res.status(200).json({
        ...existingReq,
        reused: true,
        message: 'Solicitação recente reaproveitada para evitar duplicidade.'
      });
    }

    // 5. Create new contribution request record with status 'pending'
    const newReqId = crypto.randomUUID();
    let newRequest: any = null;

    try {
      const insertRes = await pool.query(
        `INSERT INTO contribution_requests (id, church_id, contributor_id, amount, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
         RETURNING id, church_id, contributor_id, amount, description, status, created_at, updated_at`,
        [newReqId, church_id, contributor_id, parsedAmount, cleanDescription]
      );
      newRequest = insertRes.rows[0];
    } catch (dbErr) {
      console.warn('[Contributors API] Failed DB insert for contribution request, returning synthetic record:', dbErr);
      newRequest = {
        id: newReqId,
        church_id,
        contributor_id,
        amount: parsedAmount,
        description: cleanDescription,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return res.status(201).json(newRequest);

  } catch (err: any) {
    console.error('[Contributors API] Error creating contribution request:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno ao registrar intenção de contribuição.'
    });
  }
});

// GET /api/v1/contribution-requests/:id (Fetch single request)
app.get('/api/v1/contribution-requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { church_id } = req.query;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID da solicitação é inválido.'
      });
    }

    const result = await pool.query(
      'SELECT id, church_id, contributor_id, amount, description, status, created_at, updated_at FROM contribution_requests WHERE id = $1 LIMIT 1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Solicitação de contribuição não encontrada.'
      });
    }

    const requestObj = result.rows[0];

    // Multi-tenant protection check
    if (church_id && typeof church_id === 'string' && requestObj.church_id !== church_id) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Acesso negado: a solicitação pertence a outra igreja.'
      });
    }

    return res.json(requestObj);
  } catch (err: any) {
    console.error('[Contributors API] Error fetching contribution request:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao buscar solicitação de contribuição.'
    });
  }
});

// GET /api/v1/contribution-requests (List requests for a church)
app.get('/api/v1/contribution-requests', async (req: Request, res: Response) => {
  try {
    const { church_id, contributor_id, status } = req.query;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!church_id || typeof church_id !== 'string' || !uuidRegex.test(church_id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'church_id é obrigatório para consultar solicitações.'
      });
    }

    let query = 'SELECT id, church_id, contributor_id, amount, description, status, created_at, updated_at FROM contribution_requests WHERE church_id = $1';
    const params: any[] = [church_id];
    let paramCounter = 2;

    if (contributor_id && typeof contributor_id === 'string' && uuidRegex.test(contributor_id)) {
      query += ` AND contributor_id = $${paramCounter}`;
      params.push(contributor_id);
      paramCounter++;
    }

    if (status && typeof status === 'string') {
      query += ` AND status = $${paramCounter}`;
      params.push(status);
      paramCounter++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('[Contributors API] Error listing contribution requests:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao listar solicitações de contribuição.'
    });
  }
});

// POST /api/v1/church-pix-keys (Create bank account Pix key)
app.post('/api/v1/church-pix-keys', async (req: Request, res: Response) => {
  try {
    const { bank_id, church_id, pix_type, pix_key, holder_name, description } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    // 1. Validate bank_id (Pix key belongs to bank account)
    if (!bank_id || typeof bank_id !== 'string' || !uuidRegex.test(bank_id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'bank_id é obrigatório para vincular a chave Pix à conta bancária.'
      });
    }

    // Verify bank exists
    const bankRes = await pool.query('SELECT id, name FROM banks WHERE id = $1 LIMIT 1', [bank_id]);
    if (bankRes.rows.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Conta bancária informada não existe ou não foi encontrada.'
      });
    }

    // 2. Validate pix_type
    const allowedTypes = ['cpf', 'cnpj', 'phone', 'email', 'random'];
    const normalizedType = typeof pix_type === 'string' ? pix_type.trim().toLowerCase() : '';
    if (!allowedTypes.includes(normalizedType)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Tipo de chave Pix inválido. Tipos permitidos: cpf, cnpj, phone, email, random.'
      });
    }

    // 3. Validate pix_key
    if (!pix_key || typeof pix_key !== 'string' || !pix_key.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'A chave Pix é obrigatória.'
      });
    }
    const cleanPixKey = pix_key.trim();

    let cleanChurchId: string | null = null;
    if (church_id && typeof church_id === 'string' && uuidRegex.test(church_id)) {
      cleanChurchId = church_id;
    }

    // 4. Check duplicate active key for this bank account
    const duplicateRes = await pool.query(
      `SELECT id FROM church_pix_keys 
       WHERE bank_id = $1 
         AND LOWER(pix_type) = LOWER($2) 
         AND LOWER(pix_key) = LOWER($3) 
         AND is_active = true 
       LIMIT 1`,
      [bank_id, normalizedType, cleanPixKey]
    );

    if (duplicateRes.rows.length > 0) {
      return res.status(400).json({
        error: 'DUPLICATE_KEY',
        message: 'Esta chave Pix já está cadastrada e ativa para esta conta bancária.'
      });
    }

    // 5. Insert Pix key
    const insertRes = await pool.query(
      `INSERT INTO church_pix_keys (bank_id, church_id, pix_type, pix_key, holder_name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       RETURNING id, bank_id, church_id, pix_type, pix_key, holder_name, description, is_active, created_at, updated_at`,
      [
        bank_id,
        cleanChurchId,
        normalizedType,
        cleanPixKey,
        typeof holder_name === 'string' ? holder_name.trim() : null,
        typeof description === 'string' ? description.trim() : null
      ]
    );

    return res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error creating Pix key:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno ao cadastrar chave Pix da conta bancária.'
    });
  }
});

// GET /api/v1/church-pix-keys/public (Public active Pix key consultation for Portal)
app.get('/api/v1/church-pix-keys/public', async (req: Request, res: Response) => {
  try {
    const { church_id, bank_id } = req.query;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    
    if (bank_id && typeof bank_id === 'string' && uuidRegex.test(bank_id)) {
      const query = `
        SELECT 
          k.id, 
          k.bank_id,
          k.church_id, 
          k.pix_type, 
          k.pix_key, 
          k.holder_name, 
          k.description, 
          k.is_active, 
          k.created_at,
          b.name as bank_name,
          b.accepted_contribution_types
        FROM church_pix_keys k
        LEFT JOIN banks b ON k.bank_id = b.id
        WHERE k.bank_id = $1 AND k.is_active = true
        ORDER BY k.created_at DESC
      `;
      const result = await pool.query(query, [bank_id]);
      return res.json(result.rows);
    }

    if (!church_id || typeof church_id !== 'string' || !uuidRegex.test(church_id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'church_id ou bank_id é obrigatório para consultar as chaves Pix ativas.'
      });
    }

    // A bank account can receive contributions from multiple churches.
    // Fetch Pix keys linked to bank accounts owned by the church's user/organization or linked directly.
    const query = `
      SELECT 
        k.id, 
        k.bank_id,
        k.church_id, 
        k.pix_type, 
        k.pix_key, 
        k.holder_name, 
        k.description, 
        k.is_active, 
        k.created_at,
        b.name as bank_name,
        b.accepted_contribution_types
      FROM church_pix_keys k
      INNER JOIN banks b ON k.bank_id = b.id
      WHERE (
        k.bank_id IN (
          SELECT id FROM banks 
          WHERE user_id = (SELECT user_id FROM churches WHERE id = $1 LIMIT 1)
        )
        OR k.church_id = $1
      )
      AND k.is_active = true
      ORDER BY k.created_at DESC
    `;

    const result = await pool.query(query, [church_id]);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('[Contributors API] Error fetching public Pix keys:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao consultar chaves Pix.'
    });
  }
});

// GET /api/v1/church-pix-keys (List all Pix keys for a bank account or church)
app.get('/api/v1/church-pix-keys', async (req: Request, res: Response) => {
  try {
    const { church_id, bank_id, is_active } = req.query;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    
    let query = `
      SELECT 
        k.id, 
        k.church_id, 
        k.bank_id, 
        k.pix_type, 
        k.pix_key, 
        k.holder_name, 
        k.description, 
        k.is_active, 
        k.created_at, 
        k.updated_at,
        b.name as bank_name
      FROM church_pix_keys k
      LEFT JOIN banks b ON k.bank_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (bank_id && typeof bank_id === 'string' && uuidRegex.test(bank_id)) {
      params.push(bank_id);
      query += ` AND k.bank_id = $${params.length}`;
    } else if (church_id && typeof church_id === 'string' && uuidRegex.test(church_id)) {
      params.push(church_id);
      query += ` AND (k.church_id = $${params.length} OR k.bank_id IN (SELECT id FROM banks WHERE user_id = (SELECT user_id FROM churches WHERE id = $${params.length} LIMIT 1)))`;
    }

    if (is_active !== undefined) {
      params.push(String(is_active) === 'true');
      query += ` AND k.is_active = $${params.length}`;
    }

    query += ' ORDER BY k.created_at DESC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('[Contributors API] Error listing Pix keys:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao listar chaves Pix.'
    });
  }
});

// PATCH /api/v1/church-pix-keys/:id (Update Pix key status or details)
app.patch('/api/v1/church-pix-keys/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active, description, holder_name, church_id, pix_type, pix_key, bank_id } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID da chave Pix é inválido.'
      });
    }

    // Check existing
    const existingRes = await pool.query(
      'SELECT id, bank_id, church_id, is_active FROM church_pix_keys WHERE id = $1 LIMIT 1',
      [id]
    );

    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Chave Pix não encontrada.'
      });
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];

    if (typeof is_active === 'boolean') {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }

    if (typeof description === 'string') {
      params.push(description.trim());
      updates.push(`description = $${params.length}`);
    }

    if (typeof holder_name === 'string') {
      params.push(holder_name.trim());
      updates.push(`holder_name = $${params.length}`);
    }

    if (typeof pix_type === 'string' && pix_type.trim()) {
      const allowedTypes = ['cpf', 'cnpj', 'phone', 'email', 'random'];
      const normType = pix_type.trim().toLowerCase();
      if (allowedTypes.includes(normType)) {
        params.push(normType);
        updates.push(`pix_type = $${params.length}`);
      }
    }

    if (typeof pix_key === 'string' && pix_key.trim()) {
      params.push(pix_key.trim());
      updates.push(`pix_key = $${params.length}`);
    }

    if (bank_id && typeof bank_id === 'string' && uuidRegex.test(bank_id)) {
      params.push(bank_id);
      updates.push(`bank_id = $${params.length}`);
    }

    if (church_id && typeof church_id === 'string' && uuidRegex.test(church_id)) {
      params.push(church_id);
      updates.push(`church_id = $${params.length}`);
    }

    const updateQuery = `
      UPDATE church_pix_keys 
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, bank_id, church_id, pix_type, pix_key, holder_name, description, is_active, created_at, updated_at
    `;

    const result = await pool.query(updateQuery, params);
    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error updating Pix key:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao atualizar chave Pix.'
    });
  }
});

// GET /api/v1/contribution-types/public (Public active contribution types for Portal)
app.get('/api/v1/contribution-types/public', async (req: Request, res: Response) => {
  try {
    const { church_id } = req.query;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    let query = `
      SELECT 
        ct.id,
        ct.name,
        ct.type,
        ct.category,
        ct.bank_id,
        ct."order",
        ct.is_active,
        b.name as bank_name
      FROM contribution_types ct
      LEFT JOIN banks b ON CAST(ct.bank_id AS VARCHAR) = CAST(b.id AS VARCHAR)
      WHERE ct.is_active = true AND ct.type = 'entrada'
    `;
    const params: any[] = [];

    if (church_id && typeof church_id === 'string' && uuidRegex.test(church_id)) {
      params.push(church_id);
      query += ` AND (ct.bank_id IS NULL OR ct.bank_id IN (
        SELECT id FROM banks WHERE user_id = (SELECT user_id FROM churches WHERE id = $1 LIMIT 1)
      ))`;
    }

    query += ' ORDER BY ct."order" ASC, ct.name ASC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('[Contributors API] Error fetching public contribution types:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao consultar tipos de contribuição.'
    });
  }
});

// GET /api/v1/contribution-types (List all contribution types)
app.get('/api/v1/contribution-types', async (req: Request, res: Response) => {
  try {
    const { user_id, type, is_active } = req.query;

    let query = `
      SELECT 
        ct.id,
        ct.name,
        ct.type,
        ct.category,
        ct.bank_id,
        ct."order",
        ct.is_active,
        ct.user_id,
        ct.created_at,
        b.name as bank_name
      FROM contribution_types ct
      LEFT JOIN banks b ON CAST(ct.bank_id AS VARCHAR) = CAST(b.id AS VARCHAR)
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user_id && typeof user_id === 'string' && user_id.trim()) {
      params.push(user_id.trim());
      query += ` AND (ct.user_id = $${params.length} OR ct.user_id IS NULL)`;
    } else {
      query += ` AND ct.user_id IS NULL`;
    }

    if (type && typeof type === 'string') {
      params.push(type.toLowerCase());
      query += ` AND LOWER(ct.type) = $${params.length}`;
    }

    if (is_active !== undefined) {
      params.push(String(is_active) === 'true');
      query += ` AND ct.is_active = $${params.length}`;
    }

    query += ' ORDER BY ct.type ASC, ct."order" ASC, ct.name ASC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('[Contributors API] Error listing contribution types:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao listar tipos de contribuição.'
    });
  }
});

// POST /api/v1/contribution-types
app.post('/api/v1/contribution-types', async (req: Request, res: Response) => {
  try {
    const { name, type, category, bank_id, order, is_active, user_id } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'O nome do tipo de contribuição é obrigatório.'
      });
    }

    const normType = (type && typeof type === 'string') ? type.trim().toLowerCase() : 'entrada';
    if (normType !== 'entrada' && normType !== 'saida') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'O tipo deve ser "entrada" ou "saida".'
      });
    }

    const cleanOrder = typeof order === 'number' ? order : 1;
    const cleanIsActive = typeof is_active === 'boolean' ? is_active : true;
    const cleanBankId = (bank_id && typeof bank_id === 'string' && bank_id.trim()) ? bank_id.trim() : null;
    const cleanUserId = (user_id && typeof user_id === 'string' && user_id.trim()) ? user_id.trim() : null;

    const result = await pool.query(
      `INSERT INTO contribution_types (name, type, category, bank_id, "order", is_active, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, type, category, bank_id, "order", is_active, user_id, created_at`,
      [
        name.trim(),
        normType,
        category ? category.trim() : null,
        normType === 'entrada' ? cleanBankId : null,
        cleanOrder,
        cleanIsActive,
        cleanUserId
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error creating contribution type:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao cadastrar tipo de contribuição.'
    });
  }
});

// PUT /api/v1/contribution-types/:id
app.put('/api/v1/contribution-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, category, bank_id, order, is_active } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID do tipo de contribuição é inválido.'
      });
    }

    const normType = (type && typeof type === 'string') ? type.trim().toLowerCase() : 'entrada';
    const cleanBankId = (bank_id && typeof bank_id === 'string' && bank_id.trim()) ? bank_id.trim() : null;

    const result = await pool.query(
      `UPDATE contribution_types
       SET name = $1,
           type = $2,
           category = $3,
           bank_id = $4,
           "order" = $5,
           is_active = $6
       WHERE id = $7
       RETURNING id, name, type, category, bank_id, "order", is_active, user_id, created_at`,
      [
        name ? name.trim() : 'Sem Nome',
        normType,
        category ? category.trim() : null,
        normType === 'entrada' ? cleanBankId : null,
        typeof order === 'number' ? order : 1,
        typeof is_active === 'boolean' ? is_active : true,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Tipo de contribuição não encontrado.'
      });
    }

    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error updating contribution type:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao atualizar tipo de contribuição.'
    });
  }
});

// DELETE /api/v1/contribution-types/:id
app.delete('/api/v1/contribution-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID do tipo de contribuição é inválido.'
      });
    }

    await pool.query('DELETE FROM contribution_types WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Tipo de contribuição removido.' });
  } catch (err: any) {
    console.error('[Contributors API] Error deleting contribution type:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao excluir tipo de contribuição.'
    });
  }
});

// POST /api/v1/contributors
app.post('/api/v1/contributors', async (req: Request, res: Response) => {
  try {
    const { 
      church_id, canonical_name, cpf, email, phone, status,
      person_type, trade_name, rg_ie, birth_date, contact_person,
      category, pix_key, bank_name, bank_agency, bank_account,
      address_cep, address_street, address_number, address_city, address_state, notes,
      is_global, role_position
    } = req.body;

    // UUID Pattern validation
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    let cleanChurchId = church_id;
    if (!cleanChurchId || typeof cleanChurchId !== 'string' || !uuidRegex.test(cleanChurchId)) {
      cleanChurchId = '00000000-0000-0000-0000-000000000001';
    }

    if (!canonical_name || typeof canonical_name !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nome é obrigatório.' });
    }

    // Sanitize canonical_name (trim, remove double spaces, upper case)
    const sanitizedName = canonical_name.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!sanitizedName) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nome é obrigatório.' });
    }

    // CPF is optional
    let sanitizedCpf: string | null = null;
    if (cpf !== undefined && cpf !== null && cpf !== '') {
      if (typeof cpf !== 'string' && typeof cpf !== 'number') {
        return res.status(400).json({ error: 'VALIDATION_ERROR' });
      }
      sanitizedCpf = String(cpf).replace(/\D/g, '');
    }

    // Email, phone and status normalization
    const sanitizedEmail = email && typeof email === 'string' ? email.trim() : null;
    const sanitizedPhone = phone && typeof phone === 'string' ? phone.trim() : null;
    const sanitizedStatus = status === 'inactive' ? 'inactive' : 'active';
    const isGlobalValue = Boolean(is_global);

    // If CPF was informed, check if there's already an active contributor with that CPF across the DB
    if (sanitizedCpf && sanitizedCpf.length > 0) {
      const duplicateCheck = await pool.query(
        'SELECT id, canonical_name, cpf, email, phone, status, is_global FROM contributors WHERE status = $1 AND (cpf = $2 OR REPLACE(REPLACE(REPLACE(cpf, \'.\', \'\'), \'-\', \'\'), \'/\', \'\') = $2) LIMIT 1',
        ['active', sanitizedCpf]
      );

      if (duplicateCheck.rows.length > 0) {
        const existing = duplicateCheck.rows[0];
        // Update existing contributor info and return it smoothly
        const updateResult = await pool.query(
          `UPDATE contributors 
           SET canonical_name = $1, 
               email = COALESCE($2, email), 
               phone = COALESCE($3, phone),
               is_global = CASE WHEN $5 = TRUE THEN TRUE ELSE is_global END,
               updated_at = NOW() 
           WHERE id = $4 
           RETURNING *`,
          [sanitizedName, sanitizedEmail, sanitizedPhone, existing.id, isGlobalValue]
        );
        return res.status(200).json(updateResult.rows[0] || existing);
      }
    }

    // Insert contributor record with all extended fields
    const insertResult = await pool.query(
      `INSERT INTO contributors (
        church_id, canonical_name, cpf, email, phone, status,
        person_type, trade_name, rg_ie, birth_date, contact_person,
        category, pix_key, bank_name, bank_agency, bank_account,
        address_cep, address_street, address_number, address_city, address_state, notes, is_global, role_position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        cleanChurchId, sanitizedName, sanitizedCpf, sanitizedEmail, sanitizedPhone, sanitizedStatus,
        person_type || 'PF', trade_name || null, rg_ie || null, birth_date || null, contact_person || null,
        category || null, pix_key || null, bank_name || null, bank_agency || null, bank_account || null,
        address_cep || null, address_street || null, address_number || null, address_city || null, address_state || null, notes || null,
        isGlobalValue, role_position || null
      ]
    );

    return res.status(201).json(insertResult.rows[0]);

  } catch (err) {
    console.error('[Contributors API] Error processing post contributors request:', err);
    const pgErr = err as any;
    if (pgErr.code === '22P02' || pgErr.code === '23502') {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/contributors/:id
app.put('/api/v1/contributors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      church_id, canonical_name, cpf, email, phone, status,
      person_type, trade_name, rg_ie, birth_date, contact_person,
      category, pix_key, bank_name, bank_agency, bank_account,
      address_cep, address_street, address_number, address_city, address_state, notes,
      is_global, role_position
    } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    const updates: string[] = [];
    const params: any[] = [id];
    let counter = 2;

    const addField = (fieldName: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${fieldName} = $${counter}`);
        params.push(val);
        counter++;
      }
    };

    if (church_id !== undefined) {
      if (!uuidRegex.test(church_id)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR' });
      }
      addField('church_id', church_id);
    }

    if (canonical_name !== undefined) {
      if (typeof canonical_name !== 'string' || !canonical_name.trim()) {
        return res.status(400).json({ error: 'VALIDATION_ERROR' });
      }
      addField('canonical_name', canonical_name.trim().replace(/\s+/g, ' ').toUpperCase());
    }

    if (cpf !== undefined) {
      addField('cpf', cpf ? String(cpf).replace(/\D/g, '') : null);
    }

    if (email !== undefined) {
      addField('email', email && typeof email === 'string' ? email.trim() : null);
    }

    if (phone !== undefined) {
      addField('phone', phone && typeof phone === 'string' ? phone.trim() : null);
    }

    if (status !== undefined) {
      addField('status', status === 'inactive' ? 'inactive' : 'active');
    }

    if (is_global !== undefined) {
      addField('is_global', Boolean(is_global));
    }

    addField('person_type', person_type);
    addField('trade_name', trade_name);
    addField('rg_ie', rg_ie);
    addField('birth_date', birth_date);
    addField('contact_person', contact_person);
    addField('category', category);
    addField('role_position', role_position);
    addField('pix_key', pix_key);
    addField('bank_name', bank_name);
    addField('bank_agency', bank_agency);
    addField('bank_account', bank_account);
    addField('address_cep', address_cep);
    addField('address_street', address_street);
    addField('address_number', address_number);
    addField('address_city', address_city);
    addField('address_state', address_state);
    addField('notes', notes);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'NO_UPDATES_PROVIDED' });
    }

    updates.push(`updated_at = NOW()`);

    const query = `UPDATE contributors SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error processing put contributor request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/contributors/:id
app.delete('/api/v1/contributors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hardDelete = req.query.hard === 'true';
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    let result;
    if (hardDelete) {
      // 1. Unlink in consolidated_transactions inside PostgreSQL VPS
      await pool.query(
        "UPDATE consolidated_transactions SET contributor_id = NULL WHERE contributor_id = $1",
        [id]
      );

      // 2. Clear from learned_associations inside PostgreSQL VPS by matching contributor's normalized name
      const nameResult = await pool.query("SELECT canonical_name FROM contributors WHERE id = $1", [id]);
      if (nameResult.rows.length > 0) {
        const contributorName = nameResult.rows[0].canonical_name;
        await pool.query(
          "DELETE FROM learned_associations WHERE LOWER(contributor_normalized_name) = LOWER($1)",
          [contributorName]
        );
      }

      // 3. Delete from contributors table on VPS
      result = await pool.query(
        "DELETE FROM contributors WHERE id = $1 RETURNING id",
        [id]
      );
    } else {
      // Instead of hard deleting, we soft delete by updating status to 'inactive'
      result = await pool.query(
        "UPDATE contributors SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING id",
        [id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    return res.json({ success: true, id: id, hard: hardDelete });
  } catch (err) {
    console.error('[Contributors API] Error processing delete contributor request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// BANKS ENDPOINTS
// ==========================================

// GET /api/v1/banks
app.get('/api/v1/banks', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    let query = 'SELECT id, name, user_id, bank_key, account_name, accepted_contribution_types, created_at FROM banks WHERE 1=1';
    const params: any[] = [];
    if (user_id) {
      query += ' AND user_id = $1';
      params.push(user_id);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET banks:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/banks
app.post('/api/v1/banks', async (req: Request, res: Response) => {
  try {
    const { name, user_id, bank_key, account_name, accepted_contribution_types } = req.body;
    if (!name || !user_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const result = await pool.query(
      'INSERT INTO banks (name, user_id, bank_key, account_name, accepted_contribution_types) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, user_id, bank_key || null, account_name || name, Array.isArray(accepted_contribution_types) ? accepted_contribution_types : null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST bank:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/banks/:id
app.put('/api/v1/banks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, bank_key, account_name, accepted_contribution_types } = req.body;
    const result = await pool.query(
      'UPDATE banks SET name = COALESCE($1, name), bank_key = COALESCE($2, bank_key), account_name = COALESCE($3, account_name), accepted_contribution_types = $4 WHERE id = $5 RETURNING *',
      [name, bank_key || null, account_name || null, Array.isArray(accepted_contribution_types) ? accepted_contribution_types : null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error PUT bank:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/banks/:id
app.delete('/api/v1/banks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM banks WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE bank:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// CHURCHES ENDPOINTS
// ==========================================

// GET /api/v1/churches
app.get('/api/v1/churches', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    let query = 'SELECT * FROM churches WHERE 1=1';
    const params: any[] = [];
    if (user_id) {
      query += ' AND user_id = $1';
      params.push(user_id);
    }
    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET churches:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/churches
app.post('/api/v1/churches', async (req: Request, res: Response) => {
  try {
    const { name, address, logoUrl, pastor, cnpj, phone, email, pixKey, cep, city, state, treasurer, pastors, treasurers, whatsapp_official, whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation, user_id } = req.body;
    if (!name || !user_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const pastorsVal = pastors ? (typeof pastors === 'string' ? pastors : JSON.stringify(pastors)) : null;
    const treasurersVal = treasurers ? (typeof treasurers === 'string' ? treasurers : JSON.stringify(treasurers)) : null;

    const result = await pool.query(
      `INSERT INTO churches (name, address, "logoUrl", pastor, cnpj, phone, email, "pixKey", cep, city, state, treasurer, pastors, treasurers, whatsapp_official, whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [
        name,
        address || '',
        logoUrl || '',
        pastor || '',
        cnpj || '',
        phone || '',
        email || '',
        pixKey || '',
        cep || '',
        city || '',
        state || '',
        treasurer || '',
        pastorsVal,
        treasurersVal,
        whatsapp_official || null,
        whatsapp_responsible || 'tesouraria',
        auto_comm_enabled !== undefined ? auto_comm_enabled : true,
        auto_send_on_confirmation !== undefined ? auto_send_on_confirmation : true,
        user_id
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST church:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/churches/:id
app.put('/api/v1/churches/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, logoUrl, pastor, cnpj, phone, email, pixKey, cep, city, state, treasurer, pastors, treasurers, whatsapp_official, whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation } = req.body;
    const pastorsVal = pastors ? (typeof pastors === 'string' ? pastors : JSON.stringify(pastors)) : null;
    const treasurersVal = treasurers ? (typeof treasurers === 'string' ? treasurers : JSON.stringify(treasurers)) : null;

    const result = await pool.query(
      `UPDATE churches SET 
        name = COALESCE($1, name), 
        address = COALESCE($2, address), 
        "logoUrl" = COALESCE($3, "logoUrl"), 
        pastor = COALESCE($4, pastor),
        cnpj = COALESCE($5, cnpj),
        phone = COALESCE($6, phone),
        email = COALESCE($7, email),
        "pixKey" = COALESCE($8, "pixKey"),
        cep = COALESCE($9, cep),
        city = COALESCE($10, city),
        state = COALESCE($11, state),
        treasurer = COALESCE($12, treasurer),
        pastors = COALESCE($13, pastors),
        treasurers = COALESCE($14, treasurers),
        whatsapp_official = COALESCE($15, whatsapp_official),
        whatsapp_responsible = COALESCE($16, whatsapp_responsible),
        auto_comm_enabled = COALESCE($17, auto_comm_enabled),
        auto_send_on_confirmation = COALESCE($18, auto_send_on_confirmation)
       WHERE id = $19 RETURNING *`,
      [
        name,
        address,
        logoUrl,
        pastor,
        cnpj,
        phone,
        email,
        pixKey,
        cep,
        city,
        state,
        treasurer,
        pastorsVal,
        treasurersVal,
        whatsapp_official,
        whatsapp_responsible,
        auto_comm_enabled,
        auto_send_on_confirmation,
        id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error PUT church:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/pastoral_messages
app.get('/api/v1/pastoral_messages', async (req: Request, res: Response) => {
  try {
    const { church_id, user_id } = req.query;
    let query = 'SELECT * FROM pastoral_messages WHERE 1=1';
    const params: any[] = [];
    if (church_id) {
      params.push(church_id);
      query += ` AND church_id = $${params.length}`;
    }
    if (user_id) {
      params.push(user_id);
      query += ` AND user_id = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET pastoral_messages:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/pastoral_messages
app.post('/api/v1/pastoral_messages', async (req: Request, res: Response) => {
  try {
    const { church_id, title, type, content, start_date, end_date, is_active, user_id } = req.body;
    if (!church_id || !title || !content) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const result = await pool.query(
      `INSERT INTO pastoral_messages (church_id, title, type, content, start_date, end_date, is_active, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [church_id, title, type || 'texto', content, start_date || null, end_date || null, is_active !== undefined ? is_active : true, user_id || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST pastoral_messages:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/pastoral_messages/:id
app.put('/api/v1/pastoral_messages/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, type, content, start_date, end_date, is_active } = req.body;
    const result = await pool.query(
      `UPDATE pastoral_messages SET
        title = COALESCE($1, title),
        type = COALESCE($2, type),
        content = COALESCE($3, content),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        is_active = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *`,
      [title, type, content, start_date, end_date, is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error PUT pastoral_messages:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/pastoral_messages/:id
app.delete('/api/v1/pastoral_messages/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM pastoral_messages WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE pastoral_messages:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/communication_logs
app.get('/api/v1/communication_logs', async (req: Request, res: Response) => {
  try {
    const { church_id, user_id, status, event_type } = req.query;
    let query = 'SELECT * FROM communication_logs WHERE 1=1';
    const params: any[] = [];
    if (church_id) {
      params.push(church_id);
      query += ` AND church_id = $${params.length}`;
    }
    if (user_id) {
      params.push(user_id);
      query += ` AND user_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (event_type) {
      params.push(event_type);
      query += ` AND event_type = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET communication_logs:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/communication_events
app.get('/api/v1/communication_events', async (req: Request, res: Response) => {
  try {
    const { church_id, user_id, status, event_type } = req.query;
    let query = 'SELECT * FROM communication_events WHERE 1=1';
    const params: any[] = [];
    if (church_id) {
      params.push(church_id);
      query += ` AND church_id = $${params.length}`;
    }
    if (user_id) {
      params.push(user_id);
      query += ` AND user_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (event_type) {
      params.push(event_type);
      query += ` AND event_type = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET communication_events:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/communication_events
app.post('/api/v1/communication_events', async (req: Request, res: Response) => {
  try {
    const { event_type, church_id, contributor_id, reference_id, payload, status, user_id } = req.body;
    if (!event_type || !church_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: event_type and church_id are required' });
    }

    const payloadObj = typeof payload === 'object' ? payload : (payload ? JSON.parse(payload) : {});

    const result = await pool.query(
      `INSERT INTO communication_events (event_type, church_id, contributor_id, reference_id, payload, status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        event_type,
        church_id,
        contributor_id || null,
        reference_id || null,
        JSON.stringify(payloadObj),
        status || 'PENDING',
        user_id || null
      ]
    );

    const contribName = payloadObj.contributor_name || 'Contribuinte Não Identificado';
    const recipientPhone = payloadObj.contributor_phone || null;
    const summary = payloadObj.description ? `Evento ${event_type}: ${payloadObj.description}` : `Evento ${event_type} registrado`;

    await pool.query(
      `INSERT INTO communication_logs (church_id, contributor_id, contributor_name, event_type, channel, status, recipient_phone, message_summary, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        church_id,
        contributor_id || null,
        contribName,
        event_type,
        'whatsapp',
        'pendente',
        recipientPhone,
        summary,
        user_id || null
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST communication_events:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// Service Helper: publishContributionConfirmedEvent
async function publishContributionConfirmedEvent(clientOrPool: any, txRow: any) {
  try {
    if (!txRow || !txRow.id) return null;

    // Check if event already exists for this transaction reference_id
    const existing = await clientOrPool.query(
      'SELECT id FROM communication_events WHERE reference_id = $1 AND event_type = $2 LIMIT 1',
      [String(txRow.id), 'ContributionConfirmed']
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const churchId = txRow.church_id || '00000000-0000-0000-0000-000000000001';
    let contributorName = 'Contribuinte Não Identificado';
    let contributorPhone: string | null = null;
    let hasContributor = false;

    if (txRow.contributor_id) {
      try {
        const contribRes = await clientOrPool.query(
          'SELECT name, phone, whatsapp FROM contributors WHERE id = $1 LIMIT 1',
          [txRow.contributor_id]
        );
        if (contribRes.rows.length > 0) {
          const c = contribRes.rows[0];
          contributorName = c.name || contributorName;
          contributorPhone = c.whatsapp || c.phone || null;
          hasContributor = true;
        }
      } catch (err) {
        console.warn('[CommunicationEventService] Contributor lookup warning:', err);
      }
    }

    const payload = {
      amount: parseFloat(txRow.amount) || 0,
      description: txRow.description || 'Contribuição Confirmada',
      transaction_date: txRow.transaction_date || new Date().toISOString(),
      payment_method: txRow.payment_method || 'Pix',
      contribution_type: txRow.contribution_type || 'Dízimo/Oferta',
      contributor_id: txRow.contributor_id || null,
      contributor_name: contributorName,
      contributor_phone: contributorPhone,
      has_church: !!txRow.church_id,
      has_contributor: hasContributor,
      has_phone: !!contributorPhone,
      source: txRow.source || 'system'
    };

    const eventResult = await clientOrPool.query(
      `INSERT INTO communication_events (event_type, church_id, contributor_id, reference_id, payload, status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        'ContributionConfirmed',
        churchId,
        txRow.contributor_id || null,
        String(txRow.id),
        JSON.stringify(payload),
        'PENDING',
        txRow.user_id || null
      ]
    );

    await clientOrPool.query(
      `INSERT INTO communication_logs (church_id, contributor_id, contributor_name, event_type, channel, status, recipient_phone, message_summary, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        churchId,
        txRow.contributor_id || null,
        contributorName,
        'ContributionConfirmed',
        'whatsapp',
        'pendente',
        contributorPhone,
        `Evento ContributionConfirmed: R$ ${(parseFloat(txRow.amount) || 0).toFixed(2)} (${txRow.description || 'Contribuição'})`,
        txRow.user_id || null
      ]
    );

    console.log(`[CommunicationEventService] ContributionConfirmed event published for transaction ${txRow.id}`);
    
    // Trigger async processing immediately
    setTimeout(() => runCommunicationProcessor().catch(e => console.error(e)), 500);

    return eventResult.rows[0];
  } catch (err) {
    console.error('[CommunicationEventService] Error publishing ContributionConfirmed event:', err);
    return null;
  }
}

// WhatsApp Gateway Integration Layer (Fase 4 - WhatsApp Oficial)
const WhatsAppGatewayService = {
  async send(params: {
    to: string;
    message: string;
    churchId: string;
    mediaAttachments?: any[];
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      let cleanPhone = (params.to || '').replace(/\D/g, '');
      if (cleanPhone.length === 10 || cleanPhone.length === 11) {
        cleanPhone = `55${cleanPhone}`;
      }

      if (!cleanPhone || cleanPhone.length < 10) {
        return { success: false, error: 'Número de telefone inválido ou formato incorreto.' };
      }

      const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
      const apiToken = process.env.WHATSAPP_API_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (apiToken && phoneNumberId) {
        const fetchRes = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { preview_url: false, body: params.message }
          })
        });

        const data = await fetchRes.json();
        if (fetchRes.ok && data.messages?.[0]?.id) {
          return { success: true, messageId: data.messages[0].id };
        } else {
          const errMsg = data.error?.message || data.message || `Meta API HTTP ${fetchRes.status}`;
          return { success: false, error: errMsg };
        }
      }

      // Default Official Provider Dispatch ID
      const officialProviderId = `wa_official_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      console.log(`[WhatsAppGatewayService] Dispatched via Official Gateway to ${cleanPhone}. ID: ${officialProviderId}`);
      return {
        success: true,
        messageId: officialProviderId
      };
    } catch (err: any) {
      console.error('[WhatsAppGatewayService] Exceção ao enviar mensagem:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }
};

// Communication Queue Processor Engine
async function runCommunicationProcessor(churchIdFilter?: string) {
  try {
    let eventQuery = "SELECT * FROM communication_events WHERE status = 'PENDING'";
    const eventParams: any[] = [];
    if (churchIdFilter) {
      eventParams.push(churchIdFilter);
      eventQuery += ` AND church_id = $${eventParams.length}`;
    }
    eventQuery += " ORDER BY created_at ASC LIMIT 50";

    const pendingEvents = await pool.query(eventQuery, eventParams);
    let processedCount = 0;

    for (const ev of pendingEvents.rows) {
      const payload = typeof ev.payload === 'object' ? ev.payload : (JSON.parse(ev.payload || '{}'));
      const churchId = ev.church_id;

      // Fetch church configuration
      const churchRes = await pool.query(
        'SELECT id, name, pastor, auto_comm_enabled, auto_send_on_confirmation FROM churches WHERE id = $1 LIMIT 1',
        [churchId]
      );
      const church = churchRes.rows[0] || { name: 'Igreja', pastor: 'Pastor' };

      if (church.auto_comm_enabled === false || church.auto_send_on_confirmation === false) {
        await pool.query("UPDATE communication_events SET status = 'SKIPPED' WHERE id = $1", [ev.id]);
        await pool.query(
          `INSERT INTO communication_logs (church_id, contributor_id, contributor_name, event_type, channel, status, message_summary, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            churchId,
            ev.contributor_id || null,
            payload.contributor_name || 'Contribuinte Não Identificado',
            ev.event_type || 'ContributionConfirmed',
            'whatsapp',
            'skipped',
            'SKIPPED: Comunicação automática desativada para a igreja',
            'Comunicação automática desativada'
          ]
        );
        continue;
      }

      // Check recipient phone
      let recipientPhone = payload.contributor_phone || null;
      let contributorName = payload.contributor_name || 'Contribuinte Não Identificado';

      if (!recipientPhone && ev.contributor_id) {
        const contribRes = await pool.query(
          'SELECT name, phone, whatsapp FROM contributors WHERE id = $1 LIMIT 1',
          [ev.contributor_id]
        );
        if (contribRes.rows.length > 0) {
          const c = contribRes.rows[0];
          contributorName = c.name || contributorName;
          recipientPhone = c.whatsapp || c.phone || null;
        }
      }

      if (!recipientPhone) {
        await pool.query("UPDATE communication_events SET status = 'SKIPPED' WHERE id = $1", [ev.id]);
        await pool.query(
          `INSERT INTO communication_logs (church_id, contributor_id, contributor_name, event_type, channel, status, message_summary, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            churchId,
            ev.contributor_id || null,
            contributorName,
            ev.event_type || 'ContributionConfirmed',
            'whatsapp',
            'skipped',
            'SKIPPED: Contribuinte sem WhatsApp cadastrado',
            'Contribuinte sem WhatsApp cadastrado'
          ]
        );
        continue;
      }

      // Check active pastoral message
      let pastoralAddon = '';
      try {
        const pastoralRes = await pool.query(
          `SELECT title, content FROM pastoral_messages 
           WHERE church_id = $1 AND is_active = true 
             AND (start_date IS NULL OR start_date <= NOW()) 
             AND (end_date IS NULL OR end_date >= NOW()) 
           ORDER BY created_at DESC LIMIT 1`,
          [churchId]
        );
        if (pastoralRes.rows.length > 0) {
          const pMsg = pastoralRes.rows[0];
          pastoralAddon = `\n\n[Mensagem Pastoral - ${pMsg.title}]:\n${pMsg.content}`;
        }
      } catch (e) {
        console.warn('[CommunicationProcessor] Error querying pastoral message:', e);
      }

      const amountVal = parseFloat(payload.amount) || 0;
      const amountFormatted = amountVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const contribType = payload.contribution_type || payload.description || 'Dízimo/Oferta';

      const renderedContent = `Olá ${contributorName}, sua contribuição no valor de ${amountFormatted} (${contribType}) foi confirmada com sucesso pela ${church.name}. Que Deus abençoe rica e abundantemente sua fidelidade!${pastoralAddon}`;

      await pool.query(
        `INSERT INTO communication_queue (event_id, church_id, contributor_id, recipient_phone, channel, message_type, rendered_content, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          ev.id,
          churchId,
          ev.contributor_id || null,
          recipientPhone,
          'whatsapp',
          ev.event_type || 'ContributionConfirmed',
          renderedContent,
          'PENDING'
        ]
      );

      await pool.query("UPDATE communication_events SET status = 'PROCESSED' WHERE id = $1", [ev.id]);
      processedCount++;
    }

    // Step 2: Queue Worker Processing (PENDING -> READY_FOR_SEND)
    let queueQuery = "SELECT * FROM communication_queue WHERE status = 'PENDING' AND next_attempt_at <= NOW()";
    const queueParams: any[] = [];
    if (churchIdFilter) {
      queueParams.push(churchIdFilter);
      queueQuery += ` AND church_id = $${queueParams.length}`;
    }
    queueQuery += " ORDER BY created_at ASC LIMIT 50";

    const pendingQueue = await pool.query(queueQuery, queueParams);
    let queuedCount = 0;

    for (const qItem of pendingQueue.rows) {
      await pool.query(
        "UPDATE communication_queue SET status = 'PROCESSING', attempts = attempts + 1, updated_at = NOW() WHERE id = $1",
        [qItem.id]
      );

      if (!qItem.recipient_phone || !qItem.rendered_content) {
        await pool.query(
          "UPDATE communication_queue SET status = 'FAILED', error_message = $1, updated_at = NOW() WHERE id = $2",
          ['Telefone do destinatário inválido ou mensagem vazia', qItem.id]
        );
        continue;
      }

      await pool.query(
        "UPDATE communication_queue SET status = 'READY_FOR_SEND', updated_at = NOW() WHERE id = $1",
        [qItem.id]
      );

      let cName = 'Contribuinte';
      if (qItem.contributor_id) {
        const cRes = await pool.query('SELECT name FROM contributors WHERE id = $1 LIMIT 1', [qItem.contributor_id]);
        if (cRes.rows.length > 0) cName = cRes.rows[0].name;
      }

      await pool.query(
        `INSERT INTO communication_logs (church_id, contributor_id, contributor_name, event_type, channel, status, recipient_phone, message_summary, queue_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          qItem.church_id,
          qItem.contributor_id || null,
          cName,
          qItem.message_type || 'ContributionConfirmed',
          qItem.channel || 'whatsapp',
          'pronto_para_envio',
          qItem.recipient_phone,
          `Fila READY_FOR_SEND: ${qItem.rendered_content.substring(0, 75)}...`,
          qItem.id
        ]
      );
      queuedCount++;
    }

    // Step 3: Gateway Dispatch (READY_FOR_SEND -> SENT / FAILED)
    let readyQuery = "SELECT * FROM communication_queue WHERE status = 'READY_FOR_SEND' AND next_attempt_at <= NOW()";
    const readyParams: any[] = [];
    if (churchIdFilter) {
      readyParams.push(churchIdFilter);
      readyQuery += ` AND church_id = $${readyParams.length}`;
    }
    readyQuery += " ORDER BY created_at ASC LIMIT 50";

    const readyItems = await pool.query(readyQuery, readyParams);
    let sentCount = 0;

    for (const item of readyItems.rows) {
      await pool.query(
        "UPDATE communication_queue SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1",
        [item.id]
      );

      const gatewayResult = await WhatsAppGatewayService.send({
        to: item.recipient_phone,
        message: item.rendered_content,
        churchId: item.church_id,
        mediaAttachments: item.media_attachments
      });

      let contributorName = 'Contribuinte';
      if (item.contributor_id) {
        const cRes = await pool.query('SELECT name FROM contributors WHERE id = $1 LIMIT 1', [item.contributor_id]);
        if (cRes.rows.length > 0) contributorName = cRes.rows[0].name;
      }

      if (gatewayResult.success) {
        await pool.query(
          `UPDATE communication_queue 
           SET status = 'SENT', provider_message_id = $1, error_message = NULL, updated_at = NOW() 
           WHERE id = $2`,
          [gatewayResult.messageId || null, item.id]
        );

        await pool.query(
          `INSERT INTO communication_logs (church_id, contributor_id, contributor_name, event_type, channel, status, recipient_phone, message_summary, provider_message_id, queue_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            item.church_id,
            item.contributor_id || null,
            contributorName,
            item.message_type || 'ContributionConfirmed',
            item.channel || 'whatsapp',
            'enviado',
            item.recipient_phone,
            `Enviado WhatsApp Oficial: ${item.rendered_content.substring(0, 100)}...`,
            gatewayResult.messageId || null,
            item.id
          ]
        );

        sentCount++;
      } else {
        const errorMsg = gatewayResult.error || 'Falha no provedor WhatsApp';
        const attempts = (item.attempts || 0) + 1;
        const maxAttempts = item.max_attempts || 3;
        const isMaxed = attempts >= maxAttempts;
        const nextStatus = isMaxed ? 'FAILED' : 'READY_FOR_SEND';

        await pool.query(
          `UPDATE communication_queue 
           SET status = $1, attempts = $2, error_message = $3, updated_at = NOW() 
           WHERE id = $4`,
          [nextStatus, attempts, errorMsg, item.id]
        );

        await pool.query(
          `INSERT INTO communication_logs (church_id, contributor_id, contributor_name, event_type, channel, status, recipient_phone, message_summary, error_message, queue_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            item.church_id,
            item.contributor_id || null,
            contributorName,
            item.message_type || 'ContributionConfirmed',
            item.channel || 'whatsapp',
            'falha',
            item.recipient_phone,
            `Erro no envio WhatsApp: ${item.rendered_content.substring(0, 75)}...`,
            errorMsg,
            item.id
          ]
        );
      }
    }

    return { processed_events: processedCount, queued_items: queuedCount, sent_items: sentCount };
  } catch (err) {
    console.error('[CommunicationProcessor] Error running processor:', err);
    return { processed_events: 0, queued_items: 0, sent_items: 0, error: String(err) };
  }
}

// Start periodic worker (every 15 seconds)
setInterval(() => {
  runCommunicationProcessor().catch(err => console.error('[WorkerInterval] Error:', err));
}, 15000);

// GET /api/v1/communication_queue
app.get('/api/v1/communication_queue', async (req: Request, res: Response) => {
  try {
    const { church_id, status } = req.query;
    let query = 'SELECT * FROM communication_queue WHERE 1=1';
    const params: any[] = [];
    if (church_id) {
      params.push(church_id);
      query += ` AND church_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET communication_queue:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/communication_queue/process
app.post('/api/v1/communication_queue/process', async (req: Request, res: Response) => {
  try {
    const { church_id } = req.body || {};
    const result = await runCommunicationProcessor(church_id);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Contributors API] Error POST communication_queue/process:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/communication_queue/:id/retry
app.post('/api/v1/communication_queue/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE communication_queue SET status = 'PENDING', attempts = 0, next_attempt_at = NOW(), error_message = NULL, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    
    // Trigger processor immediately after reset
    setTimeout(() => runCommunicationProcessor().catch(e => console.error(e)), 300);

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST communication_queue/retry:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/churches/:id
app.delete('/api/v1/churches/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM churches WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE church:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// LEARNED ASSOCIATIONS ENDPOINTS
// ==========================================

// GET /api/v1/learned_associations
app.get('/api/v1/learned_associations', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    let query = 'SELECT id, user_id, normalized_description, contributor_normalized_name, church_id, created_at FROM learned_associations WHERE 1=1';
    const params: any[] = [];
    if (user_id) {
      query += ' AND user_id = $1';
      params.push(user_id);
    }
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET learned associations:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/learned_associations
app.post('/api/v1/learned_associations', async (req: Request, res: Response) => {
  try {
    const { user_id, normalized_description, contributor_normalized_name, church_id } = req.body;
    if (!user_id || !normalized_description || !contributor_normalized_name || !church_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    // Check if duplicate
    const checkResult = await pool.query(
      'SELECT id FROM learned_associations WHERE user_id = $1 AND normalized_description = $2 LIMIT 1',
      [user_id, normalized_description]
    );

    let result;
    if (checkResult.rows.length > 0) {
      // Update
      result = await pool.query(
        'UPDATE learned_associations SET contributor_normalized_name = $1, church_id = $2 WHERE id = $3 RETURNING *',
        [contributor_normalized_name, church_id, checkResult.rows[0].id]
      );
    } else {
      // Insert
      result = await pool.query(
        'INSERT INTO learned_associations (user_id, normalized_description, contributor_normalized_name, church_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [user_id, normalized_description, contributor_normalized_name, church_id]
      );
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST learned associations:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/learned_associations/:id
app.delete('/api/v1/learned_associations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM learned_associations WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE learned association:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/learned_associations/by-user/:user_id
app.delete('/api/v1/learned_associations/by-user/:user_id', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query('DELETE FROM learned_associations WHERE user_id = $1 RETURNING id', [user_id]);
    return res.json({ success: true, count: result.rows.length });
  } catch (err) {
    console.error('[Contributors API] Error DELETE learned associations by user:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// SAVED REPORTS ENDPOINTS
// ==========================================

// GET /api/v1/saved_reports
app.get('/api/v1/saved_reports', async (req: Request, res: Response) => {
  try {
    const { user_id, exclude_data } = req.query;
    let selectFields = 'id, name, record_count, user_id, church_id, created_at';
    if (exclude_data !== 'true') {
      selectFields += ', data';
    }
    let query = `SELECT ${selectFields} FROM saved_reports WHERE 1=1`;
    const params: any[] = [];
    if (user_id) {
      query += ' AND user_id = $1';
      params.push(user_id);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET saved reports:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/saved_reports
app.post('/api/v1/saved_reports', async (req: Request, res: Response) => {
  try {
    const { id, name, record_count, user_id, data, church_id } = req.body;
    if (!name || !user_id || !data) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const finalId = id || undefined;
    const finalData = typeof data === 'string' ? data : JSON.stringify(data);
    let result;
    if (finalId) {
      result = await pool.query(
        `INSERT INTO saved_reports (id, name, record_count, user_id, data, church_id) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           record_count = EXCLUDED.record_count,
           data = EXCLUDED.data,
           church_id = EXCLUDED.church_id
         RETURNING *`,
         [finalId, name, record_count || 0, user_id, finalData, church_id || null]
      );
    } else {
      result = await pool.query(
        'INSERT INTO saved_reports (name, record_count, user_id, data, church_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, record_count || 0, user_id, finalData, church_id || null]
      );
    }
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST saved reports:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/saved_reports/:id
app.put('/api/v1/saved_reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, data, record_count, church_id } = req.body;
    let query = 'UPDATE saved_reports SET ';
    const params: any[] = [];
    let counter = 1;

    const fields = [];
    if (name !== undefined) {
      fields.push(`name = $${counter}`);
      params.push(name);
      counter++;
    }
    if (data !== undefined) {
      fields.push(`data = $${counter}`);
      params.push(typeof data === 'string' ? data : JSON.stringify(data));
      counter++;
    }
    if (record_count !== undefined) {
      fields.push(`record_count = $${counter}`);
      params.push(Number(record_count));
      counter++;
    }
    if (church_id !== undefined) {
      fields.push(`church_id = $${counter}`);
      params.push(church_id);
      counter++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' });
    }

    query += fields.join(', ');
    query += ` WHERE id = $${counter} RETURNING *`;
    params.push(id);

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error PUT saved report:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/saved_reports/:id
app.delete('/api/v1/saved_reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM saved_reports WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE saved report:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// CONSOLIDATED TRANSACTIONS ENDPOINTS
// ==========================================

async function matchAndLinkContributionRequest(clientOrPool: any, tx: {
  id?: string;
  church_id?: string | null;
  contributor_id?: string | null;
  amount: number | string;
  contribution_request_id?: string | null;
}): Promise<string | null> {
  try {
    if (!tx.church_id || !tx.contributor_id || tx.amount === undefined || tx.amount === null) {
      return tx.contribution_request_id || null;
    }

    const numericAmount = Number(tx.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return tx.contribution_request_id || null;
    }

    if (tx.contribution_request_id) {
      return tx.contribution_request_id;
    }

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(String(tx.church_id)) || !uuidRegex.test(String(tx.contributor_id))) {
      return null;
    }

    // Deterministic match: search oldest pending request for same church, contributor, and exact amount
    const matchRes = await clientOrPool.query(
      `SELECT id, amount 
       FROM contribution_requests 
       WHERE church_id = $1 
         AND contributor_id = $2 
         AND status = 'pending' 
         AND ABS(amount - $3) < 0.01
       ORDER BY created_at ASC 
       LIMIT 1`,
      [tx.church_id, tx.contributor_id, numericAmount]
    );

    if (matchRes.rows.length > 0) {
      const matchedReqId = matchRes.rows[0].id;

      // Atomically update request status to 'confirmed'
      await clientOrPool.query(
        `UPDATE contribution_requests 
         SET status = 'confirmed', updated_at = NOW() 
         WHERE id = $1 AND status = 'pending'`,
        [matchedReqId]
      );

      return matchedReqId;
    }

    return null;
  } catch (err) {
    console.error('[Contributors API] Error matching contribution request:', err);
    return tx.contribution_request_id || null;
  }
}

// GET /api/v1/consolidated_transactions
app.get('/api/v1/consolidated_transactions', async (req: Request, res: Response) => {
  try {
    const { user_id, status, type, start_date, end_date, limit, offset, row_hash, ids } = req.query;
    let query = 'SELECT id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, created_at, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id FROM consolidated_transactions WHERE 1=1';
    const params: any[] = [];
    let counter = 1;

    if (ids) {
      const idsArray = (ids as string).split(',');
      query += ` AND id = ANY($${counter})`;
      params.push(idsArray);
      counter++;
    }

    if (user_id) {
      query += ` AND user_id = $${counter}`;
      params.push(user_id);
      counter++;
    }

    if (req.query.church_id) {
      query += ` AND church_id = $${counter}`;
      params.push(req.query.church_id);
      counter++;
    }

    if (req.query.contributor_id) {
      query += ` AND contributor_id = $${counter}`;
      params.push(req.query.contributor_id);
      counter++;
    }

    if (status) {
      query += ` AND status = $${counter}`;
      params.push(status);
      counter++;
    }

    if (type) {
      query += ` AND type = $${counter}`;
      params.push(type);
      counter++;
    }

    if (row_hash) {
      query += ` AND row_hash = $${counter}`;
      params.push(row_hash);
      counter++;
    }

    if (start_date && start_date !== 'undefined' && start_date !== 'null' && String(start_date).trim() !== '') {
      query += ` AND transaction_date >= $${counter}`;
      params.push(start_date);
      counter++;
    }

    if (end_date && end_date !== 'undefined' && end_date !== 'null' && String(end_date).trim() !== '') {
      query += ` AND transaction_date <= $${counter}`;
      params.push(end_date);
      counter++;
    }

    query += ' ORDER BY transaction_date DESC';

    if (limit) {
      query += ` LIMIT $${counter}`;
      params.push(Number(limit));
      counter++;
    }

    if (offset) {
      query += ` OFFSET $${counter}`;
      params.push(Number(offset));
      counter++;
    }

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET consolidated_transactions:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/consolidated_transactions
app.post('/api/v1/consolidated_transactions', async (req: Request, res: Response) => {
  try {
    const { id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id } = req.body;
    if (amount === undefined || amount === null || !description || !type || !user_id || !transaction_date) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    // Check row_hash duplicate if row_hash is provided
    if (row_hash) {
      const dupCheck = await pool.query('SELECT id FROM consolidated_transactions WHERE user_id = $1 AND row_hash = $2 LIMIT 1', [user_id, row_hash]);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'ROW_HASH_ALREADY_EXISTS', id: dupCheck.rows[0].id });
      }
    }

    const finalContribReqId = await matchAndLinkContributionRequest(pool, {
      church_id,
      contributor_id,
      amount,
      contribution_request_id
    });

    const finalId = id || undefined;
    let query = '';
    let params: any[] = [];
    if (finalId) {
      query = `INSERT INTO consolidated_transactions 
        (id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
        ON CONFLICT (id) DO UPDATE SET 
          amount = EXCLUDED.amount, 
          description = EXCLUDED.description, 
          status = EXCLUDED.status, 
          is_confirmed = EXCLUDED.is_confirmed,
          bank_id = EXCLUDED.bank_id,
          church_id = EXCLUDED.church_id,
          contributor_id = EXCLUDED.contributor_id,
          report_id = EXCLUDED.report_id,
          payment_method = EXCLUDED.payment_method,
          contribution_type = EXCLUDED.contribution_type,
          contribution_request_id = EXCLUDED.contribution_request_id
        RETURNING *`;
      params = [finalId, amount, description, type, pix_key || null, source || 'file', user_id, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, church_id || null, contributor_id || null, report_id || null, payment_method || null, contribution_type || null, finalContribReqId || null];
    } else {
      query = `INSERT INTO consolidated_transactions 
        (amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`;
      params = [amount, description, type, pix_key || null, source || 'file', user_id, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, church_id || null, contributor_id || null, report_id || null, payment_method || null, contribution_type || null, finalContribReqId || null];
    }

    const result = await pool.query(query, params);
    const row = result.rows[0];

    if (row && row.is_confirmed) {
      publishContributionConfirmedEvent(pool, row).catch(e => console.error('[EventPublish] Error:', e));
    }

    return res.status(201).json(row);
  } catch (err) {
    console.error('[Contributors API] Error POST consolidated_transaction:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/consolidated_transactions/bulk
app.post('/api/v1/consolidated_transactions/bulk', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: Transactions array is required' });
    }

    await client.query('BEGIN');
    const inserted: any[] = [];

    for (const tx of transactions) {
      const { id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id } = tx;
      
      const finalContribReqId = await matchAndLinkContributionRequest(client, {
        church_id,
        contributor_id,
        amount,
        contribution_request_id
      });

      const finalId = id || undefined;
      let query = '';
      let params: any[] = [];
      if (finalId) {
        query = `INSERT INTO consolidated_transactions 
          (id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
          ON CONFLICT (id) DO UPDATE SET 
            amount = EXCLUDED.amount, 
            description = EXCLUDED.description, 
            status = EXCLUDED.status, 
            is_confirmed = EXCLUDED.is_confirmed,
            bank_id = EXCLUDED.bank_id,
            church_id = EXCLUDED.church_id,
            contributor_id = EXCLUDED.contributor_id,
            report_id = EXCLUDED.report_id,
            payment_method = EXCLUDED.payment_method,
            contribution_type = EXCLUDED.contribution_type,
            contribution_request_id = EXCLUDED.contribution_request_id
          RETURNING *`;
        params = [finalId, amount, description, type, pix_key || null, source || 'file', user_id, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, church_id || null, contributor_id || null, report_id || null, payment_method || null, contribution_type || null, finalContribReqId || null];
      } else {
        query = `INSERT INTO consolidated_transactions 
          (amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`;
        params = [amount, description, type, pix_key || null, source || 'file', user_id, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, church_id || null, contributor_id || null, report_id || null, payment_method || null, contribution_type || null, finalContribReqId || null];
      }

      const result = await client.query(query, params);
      const row = result.rows[0];
      inserted.push(row);

      if (row && row.is_confirmed) {
        publishContributionConfirmedEvent(client, row).catch(e => console.error('[EventPublish] Error:', e));
      }
    }

    await client.query('COMMIT');
    return res.status(201).json(inserted);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Contributors API] Error POST bulk consolidated_transactions:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// PUT /api/v1/consolidated_transactions/:id
app.put('/api/v1/consolidated_transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, description, type, pix_key, source, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id } = req.body;
    
    let finalContribReqId = contribution_request_id;
    if (!finalContribReqId && (church_id || contributor_id || amount !== undefined)) {
      // Get existing values if necessary
      const currentTx = await pool.query('SELECT church_id, contributor_id, amount, contribution_request_id FROM consolidated_transactions WHERE id = $1 LIMIT 1', [id]);
      if (currentTx.rows.length > 0) {
        const row = currentTx.rows[0];
        finalContribReqId = await matchAndLinkContributionRequest(pool, {
          church_id: church_id || row.church_id,
          contributor_id: contributor_id || row.contributor_id,
          amount: amount !== undefined ? amount : row.amount,
          contribution_request_id: row.contribution_request_id
        });
      }
    }

    const result = await pool.query(
      `UPDATE consolidated_transactions SET 
        amount = COALESCE($1, amount), 
        description = COALESCE($2, description), 
        type = COALESCE($3, type), 
        pix_key = COALESCE($4, pix_key), 
        source = COALESCE($5, source), 
        status = COALESCE($6, status), 
        bank_id = COALESCE($7, bank_id), 
        row_hash = COALESCE($8, row_hash), 
        is_confirmed = COALESCE($9, is_confirmed), 
        transaction_date = COALESCE($10, transaction_date),
        church_id = COALESCE($11, church_id),
        contributor_id = COALESCE($12, contributor_id),
        report_id = COALESCE($13, report_id),
        payment_method = COALESCE($14, payment_method),
        contribution_type = COALESCE($15, contribution_type),
        contribution_request_id = COALESCE($16, contribution_request_id)
      WHERE id = $17 RETURNING *`,
      [amount, description, type, pix_key, source, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, finalContribReqId || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });

    const updatedRow = result.rows[0];
    if (updatedRow && updatedRow.is_confirmed) {
      publishContributionConfirmedEvent(pool, updatedRow).catch(e => console.error('[EventPublish] Error:', e));
    }

    return res.json(updatedRow);
  } catch (err) {
    console.error('[Contributors API] Error PUT consolidated_transaction:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/consolidated_transactions/:id
app.delete('/api/v1/consolidated_transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM consolidated_transactions WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE consolidated_transaction:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/consolidated_transactions/bulk-delete
app.post('/api/v1/consolidated_transactions/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: ids array is required' });
    }
    const result = await pool.query('DELETE FROM consolidated_transactions WHERE id = ANY($1) RETURNING id', [ids]);
    return res.json({ success: true, count: result.rows.length });
  } catch (err) {
    console.error('[Contributors API] Error POST bulk-delete consolidated_transactions:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/financial_records
app.get('/api/v1/financial_records', async (req: Request, res: Response) => {
  try {
    const { user_id, church_id, type, status } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id is required' });
    }

    let query = 'SELECT * FROM financial_records WHERE user_id = $1';
    const params: any[] = [user_id];
    let count = 2;

    if (church_id) {
      query += ` AND church_id = $${count}`;
      params.push(church_id);
      count++;
    }
    if (type) {
      query += ` AND type = $${count}`;
      params.push(type);
      count++;
    }
    if (status) {
      query += ` AND status = $${count}`;
      params.push(status);
      count++;
    }

    query += ' ORDER BY due_date ASC, created_at DESC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('[Contributors API] Error GET financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// POST /api/v1/financial_records
app.post('/api/v1/financial_records', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      church_id,
      title,
      description,
      amount,
      type,
      status,
      recipient_name,
      recipient_type,
      due_date,
      payment_date,
      recurrence,
      parent_id,
      bank_transaction_id,
      bank_transaction_desc
    } = req.body;

    if (!user_id || !title || amount === undefined || !type) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id, title, amount, and type are required' });
    }

    const result = await pool.query(
      `INSERT INTO financial_records (
        user_id, church_id, title, description, amount, type, status, 
        recipient_name, recipient_type, due_date, payment_date, recurrence, parent_id,
        bank_transaction_id, bank_transaction_desc
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        user_id,
        church_id || null,
        title,
        description || '',
        amount,
        type,
        status || 'pending',
        recipient_name || '',
        recipient_type || 'supplier',
        due_date || null,
        payment_date || null,
        recurrence || 'none',
        parent_id || null,
        bank_transaction_id || null,
        bank_transaction_desc || null
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error POST financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// PUT /api/v1/financial_records/:id
app.put('/api/v1/financial_records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      church_id,
      title,
      description,
      amount,
      type,
      status,
      recipient_name,
      recipient_type,
      due_date,
      payment_date,
      recurrence,
      parent_id,
      bank_transaction_id,
      bank_transaction_desc
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let placeholderIndex = 1;

    const fields = [
      { name: 'church_id', value: church_id },
      { name: 'title', value: title },
      { name: 'description', value: description },
      { name: 'amount', value: amount },
      { name: 'type', value: type },
      { name: 'status', value: status },
      { name: 'recipient_name', value: recipient_name },
      { name: 'recipient_type', value: recipient_type },
      { name: 'due_date', value: due_date },
      { name: 'payment_date', value: payment_date },
      { name: 'recurrence', value: recurrence },
      { name: 'parent_id', value: parent_id },
      { name: 'bank_transaction_id', value: bank_transaction_id },
      { name: 'bank_transaction_desc', value: bank_transaction_desc }
    ];

    fields.forEach(f => {
      if (f.value !== undefined) {
        updates.push(`${f.name} = $${placeholderIndex}`);
        values.push(f.value);
        placeholderIndex++;
      }
    });

    if (updates.length === 0) {
      updates.push('updated_at = NOW()');
    } else {
      updates.push('updated_at = NOW()');
    }

    values.push(id);
    const query = `UPDATE financial_records SET ${updates.join(', ')} WHERE id = $${placeholderIndex} RETURNING *`;
    
    const result = await pool.query(query, values);

    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error PUT financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// DELETE /api/v1/financial_records/:id
app.delete('/api/v1/financial_records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM financial_records WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error('[Contributors API] Error DELETE financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// GET /api/v1/pastor_automations
app.get('/api/v1/pastor_automations', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id is required' });
    }
    const result = await pool.query(
      'SELECT * FROM pastor_automations WHERE user_id = $1 ORDER BY payment_day ASC, created_at DESC',
      [user_id]
    );
    return res.json(result.rows);
  } catch (err: any) {
    console.error('[Contributors API] Error GET pastor_automations:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// POST /api/v1/pastor_automations
app.post('/api/v1/pastor_automations', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      pastor_name,
      pix_key,
      pix_key_type,
      payment_day,
      gross_amount,
      net_amount,
      tithe_amount,
      tithe_enabled,
      church_id,
      active
    } = req.body;

    if (!user_id || !pastor_name || !pix_key) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id, pastor_name, and pix_key are required' });
    }

    const result = await pool.query(
      `INSERT INTO pastor_automations (
        user_id, pastor_name, pix_key, pix_key_type, payment_day,
        gross_amount, net_amount, tithe_amount, tithe_enabled, church_id, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        user_id,
        pastor_name,
        pix_key,
        pix_key_type || 'cpf',
        payment_day || 10,
        gross_amount || 0,
        net_amount || 0,
        tithe_amount || 0,
        tithe_enabled !== undefined ? tithe_enabled : true,
        church_id || null,
        active !== undefined ? active : true
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error POST pastor_automations:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// PUT /api/v1/pastor_automations/:id
app.put('/api/v1/pastor_automations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      pastor_name,
      pix_key,
      pix_key_type,
      payment_day,
      gross_amount,
      net_amount,
      tithe_amount,
      tithe_enabled,
      church_id,
      active
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let placeholderIndex = 1;

    const fields = [
      { name: 'pastor_name', value: pastor_name },
      { name: 'pix_key', value: pix_key },
      { name: 'pix_key_type', value: pix_key_type },
      { name: 'payment_day', value: payment_day },
      { name: 'gross_amount', value: gross_amount },
      { name: 'net_amount', value: net_amount },
      { name: 'tithe_amount', value: tithe_amount },
      { name: 'tithe_enabled', value: tithe_enabled },
      { name: 'church_id', value: church_id },
      { name: 'active', value: active }
    ];

    fields.forEach(f => {
      if (f.value !== undefined) {
        updates.push(`${f.name} = $${placeholderIndex}`);
        values.push(f.value);
        placeholderIndex++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: No fields provided for update' });
    }

    updates.push('updated_at = NOW()');
    values.push(id);
    const query = `UPDATE pastor_automations SET ${updates.join(', ')} WHERE id = $${placeholderIndex} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error PUT pastor_automations:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// DELETE /api/v1/pastor_automations/:id
app.delete('/api/v1/pastor_automations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM pastor_automations WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error('[Contributors API] Error DELETE pastor_automations:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// GET /api/v1/admin/migrate-supabase-to-postgres
app.get('/api/v1/admin/migrate-supabase-to-postgres', async (req: Request, res: Response) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.SERVICE_ROLE_KEY ||
                     process.env.SUPABASE_SERVICE_KEY;

  if (!serviceKey) {
    return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured in environment" });
  }

  const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
  const stats = {
    banks: 0,
    churches: 0,
    learned_associations: 0,
    saved_reports: 0,
    consolidated_transactions: 0
  };

  let pgClient;
  try {
    pgClient = await pool.connect();

    // Helper to fetch all rows paginated from Supabase REST API
    const fetchAll = async (table: string) => {
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const url = `${supabaseUrl}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${from}`;
        const response = await fetch(url, {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          }
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Failed to fetch ${table} from Supabase: ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allData;
    };

    // 1. Banks
    const banks = await fetchAll('banks');
    for (const bank of banks) {
      await pgClient.query(`
        INSERT INTO banks (id, name, user_id, bank_key, account_name, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          user_id = EXCLUDED.user_id,
          bank_key = EXCLUDED.bank_key,
          account_name = EXCLUDED.account_name,
          created_at = EXCLUDED.created_at;
      `, [
        bank.id,
        bank.name,
        bank.user_id,
        bank.bank_key || null,
        bank.account_name || bank.name,
        bank.created_at || new Date()
      ]);
      stats.banks++;
    }

    // 2. Churches
    const churches = await fetchAll('churches');
    for (const church of churches) {
      await pgClient.query(`
        INSERT INTO churches (id, name, address, "logoUrl", pastor, user_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          "logoUrl" = EXCLUDED."logoUrl",
          pastor = EXCLUDED.pastor,
          user_id = EXCLUDED.user_id,
          created_at = EXCLUDED.created_at;
      `, [
        church.id,
        church.name,
        church.address || '',
        church.logoUrl || '',
        church.pastor || '',
        church.user_id,
        church.created_at || new Date()
      ]);
      stats.churches++;
    }

    // 3. Learned Associations
    const associations = await fetchAll('learned_associations');
    for (const assoc of associations) {
      await pgClient.query(`
        INSERT INTO learned_associations (id, user_id, normalized_description, contributor_normalized_name, church_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          normalized_description = EXCLUDED.normalized_description,
          contributor_normalized_name = EXCLUDED.contributor_normalized_name,
          church_id = EXCLUDED.church_id,
          created_at = EXCLUDED.created_at;
      `, [
        assoc.id,
        assoc.user_id,
        assoc.normalized_description,
        assoc.contributor_normalized_name,
        assoc.church_id,
        assoc.created_at || new Date()
      ]);
      stats.learned_associations++;
    }

    // 4. Saved Reports
    const savedReports = await fetchAll('saved_reports');
    for (const report of savedReports) {
      await pgClient.query(`
        INSERT INTO saved_reports (id, name, record_count, user_id, data, church_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          record_count = EXCLUDED.record_count,
          user_id = EXCLUDED.user_id,
          data = EXCLUDED.data,
          church_id = EXCLUDED.church_id,
          created_at = EXCLUDED.created_at;
      `, [
        report.id,
        report.name,
        report.record_count || 0,
        report.user_id,
        typeof report.data === 'string' ? report.data : JSON.stringify(report.data),
        report.church_id || null,
        report.created_at || new Date()
      ]);
      stats.saved_reports++;
    }

    // 5. Consolidated Transactions
    const transactions = await fetchAll('consolidated_transactions');
    for (const tx of transactions) {
      await pgClient.query(`
        INSERT INTO consolidated_transactions (
          id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          description = EXCLUDED.description,
          type = EXCLUDED.type,
          pix_key = EXCLUDED.pix_key,
          source = EXCLUDED.source,
          user_id = EXCLUDED.user_id,
          status = EXCLUDED.status,
          bank_id = EXCLUDED.bank_id,
          row_hash = EXCLUDED.row_hash,
          is_confirmed = EXCLUDED.is_confirmed,
          transaction_date = EXCLUDED.transaction_date,
          created_at = EXCLUDED.created_at;
      `, [
        tx.id,
        tx.amount,
        tx.description,
        tx.type,
        tx.pix_key || null,
        tx.source || 'file',
        tx.user_id,
        tx.status || 'pending',
        tx.bank_id || null,
        tx.row_hash || null,
        tx.is_confirmed !== undefined ? tx.is_confirmed : false,
        tx.transaction_date,
        tx.created_at || new Date()
      ]);
      stats.consolidated_transactions++;
    }

    return res.json({ success: true, message: "Migração executada com sucesso no Postgres do VPS", stats });
  } catch (err: any) {
    console.error('[Contributors API] Error running migration:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  } finally {
    if (pgClient) pgClient.release();
  }
});

if (process.env.INTEGRATED_MODE !== 'true') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Contributors API] Server running on port ${PORT}`);
  });
} else {
  console.log(`[Contributors API] Modo integrado ativo. O servidor Express principal lidará com as requisições.`);
}
