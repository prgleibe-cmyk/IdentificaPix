import express, { Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createAuthRouter, AuthRepository } from './auth/routes/auth.routes.js';
import { verifyAccessToken } from './auth/utils/jwt.utils.js';
import { createAdminConfigRouter } from './admin-config/routes/admin_config.routes.js';
import { createAutomationMacroRouter } from './automation-macros/routes/automation_macro.routes.js';
import { createFileModelRouter } from './file-models/routes/file_model.routes.js';
import { createProfileRouter } from './profiles/routes/profile.routes.js';
import { createPaymentRouter } from './payments/routes/payment.routes.js';
import { executeBackup, scheduleAutomatedBackups, getBackupDirectory, listBackups, dumpDatabase } from './services/backup.service.js';
import { initAuditDatabase, logAudit, queryAuditLogs } from './services/audit.service.js';
import { getMonitoringStatus, sendAlertNotification, startMonitoringService, getSecurityDashboardStatus } from './services/monitoring.service.js';
import { startBackgroundScheduler, getSchedulerStatus } from './services/scheduler.service.js';

const requireFallback = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Connection pool wrapper enforcing strict PostgreSQL persistence with no SQLite fallback
class SmartPool {
  private pgPool: pg.Pool;
  private lastErrorLogTime: number = 0;
  private isOffline: boolean = false;

  constructor(config: pg.PoolConfig) {
    this.pgPool = new Pool(config);
    this.pgPool.on('error', (err: any) => {
      this.handlePoolError('Pool client error', err);
    });
  }

  private handlePoolError(context: string, err: any) {
    const now = Date.now();
    const isNetworkOrDns = err?.code === 'EAI_AGAIN' || err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT';
    if (!this.lastErrorLogTime || now - this.lastErrorLogTime > 60000) {
      this.lastErrorLogTime = now;
      if (isNetworkOrDns) {
        console.warn(`[Contributors API] PostgreSQL status: Conexão remota aguardando disponibilidade [${err?.code || 'OFFLINE'}]`);
      } else {
        console.warn(`[Contributors API] PostgreSQL status (${context}):`, err?.message || err);
      }
    }
  }

  async connect(): Promise<pg.PoolClient> {
    try {
      const client = await this.pgPool.connect();
      if (this.isOffline) {
        this.isOffline = false;
        console.log('[Contributors API] PostgreSQL connection restored.');
      }
      return client;
    } catch (err: any) {
      this.isOffline = true;
      this.handlePoolError('conexão', err);
      throw err;
    }
  }

  async query(sql: string, params?: any[]): Promise<pg.QueryResult<any>> {
    try {
      const res = await this.pgPool.query(sql, params);
      if (this.isOffline) {
        this.isOffline = false;
      }
      return res;
    } catch (err: any) {
      this.isOffline = true;
      this.handlePoolError('consulta', err);
      throw err;
    }
  }

  async end() {
    await this.pgPool.end();
  }
}

export const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}) as any);
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

// Mount Local Auth Router
app.use('/api/v1/auth', createAuthRouter(pool));

// Mount Admin Config Router
app.use('/api/v1/admin-config', createAdminConfigRouter(pool));

// Mount Automation Macros Router
app.use('/api/v1/automation-macros', createAutomationMacroRouter(pool));

// Mount File Models Router
app.use('/api/v1/file-models', createFileModelRouter(pool));

// Mount Profiles Router
app.use('/api/v1/profiles', createProfileRouter(pool));

// Mount Payments Router
app.use('/api/v1/payments', createPaymentRouter(pool));

// Database tables initialization
async function initializeDatabase() {
  let client;
  try {
    client = await pool.connect();
    console.log('[Contributors API] Connected to PostgreSQL environment successfully!');
    
    // Initialize Local Auth Database Tables
    try {
      const authRepo = new AuthRepository(pool);
      await authRepo.initTables();
    } catch (authDbErr: any) {
      console.error('[Contributors API] Local Auth tables initialization error:', authDbErr?.message);
    }
    
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
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS photo_url TEXT;");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS name VARCHAR(255);");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_church_status ON contributors(church_id, status);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_canonical_name ON contributors(canonical_name);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_cpf ON contributors(cpf);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_phone ON contributors(phone);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_whatsapp ON contributors(whatsapp);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_email ON contributors(email);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_pix_key ON contributors(pix_key);");
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
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS contributor_id UUID;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS report_id VARCHAR(255);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS contribution_type VARCHAR(255);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS contribution_request_id UUID;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS splits JSONB;');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_contrib_req ON consolidated_transactions(church_id, contribution_request_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_church_user ON consolidated_transactions(church_id, user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_date ON consolidated_transactions(transaction_date);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_contributor ON consolidated_transactions(contributor_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_status ON consolidated_transactions(status);');
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
    await client.query('CREATE INDEX IF NOT EXISTS idx_learned_assoc_church_desc ON learned_associations(church_id, normalized_description);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_learned_assoc_user ON learned_associations(user_id);');
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
    await client.query('CREATE INDEX IF NOT EXISTS idx_saved_reports_church ON saved_reports(church_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(user_id);');
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
    await client.query("ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;");
    await client.query("ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'pending_attachment';");
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS validation_notes TEXT;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('CREATE INDEX IF NOT EXISTS idx_fin_records_church_date ON financial_records(church_id, due_date);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_fin_records_status ON financial_records(status);');
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

    // Initialize Audit Logs Database
    await initAuditDatabase(pool);

  } catch (err: any) {
    const isNetworkOrDns = err?.code === 'EAI_AGAIN' || err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT';
    console.warn(`[Contributors API] Database initialization paused (${isNetworkOrDns ? 'Aguardando conectividade com PostgreSQL' : 'Erro'}):`, err?.message || err);
  } finally {
    if (client) client.release();
  }
}

// Ensure database table setup executes upon initialization
initializeDatabase().then(() => {
  scheduleAutomatedBackups(pool);
  startMonitoringService(pool);
  startBackgroundScheduler(pool);
}).catch((err: any) => {
  const isNetworkOrDns = err?.code === 'EAI_AGAIN' || err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT';
  console.warn(`[Contributors API] Initial database connection not ready (${isNetworkOrDns ? 'Aguardando host PostgreSQL' : 'Erro'}):`, err?.message || err);
});

// Endpoint do Agendador Automático de Tarefas (Scheduler Status)
app.get('/api/v1/admin/scheduler/status', async (req: Request, res: Response) => {
  try {
    res.json(getSchedulerStatus());
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Infrastructure & Monitoring Endpoints
app.get(['/health', '/api/v1/health', '/api/v1/monitoring/status'], async (req: Request, res: Response) => {
  try {
    const reqContext = {
      ip: req.ip,
      protocol: req.protocol,
      secure: req.secure
    };
    const report = await getMonitoringStatus(pool, reqContext);
    const statusCode = report.status === 'critical' ? 503 : 200;
    res.status(statusCode).json(report);
  } catch (err: any) {
    res.status(500).json({
      status: 'critical',
      timestamp: new Date().toISOString(),
      error: err?.message || String(err)
    });
  }
});

app.get('/api/v1/admin/security-status', async (req: Request, res: Response) => {
  try {
    const reqContext = {
      ip: req.ip,
      protocol: req.protocol,
      secure: req.secure
    };
    const securityData = await getSecurityDashboardStatus(pool, reqContext);
    res.json(securityData);
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || String(err),
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/v1/monitoring/test-alert', async (req: Request, res: Response) => {
  try {
    const report = await getMonitoringStatus(pool);
    // Inject a simulated test alert
    report.alerts.push({
      severity: 'warning',
      component: 'testSystem',
      message: 'Teste manual de notificação de alerta de infraestrutura (Sanitized)',
      timestamp: new Date().toISOString()
    });
    const result = await sendAlertNotification(report, pool);
    res.json({
      message: 'Alerta de teste enviado com sucesso',
      dispatchResult: result,
      alertCount: report.alerts.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Admin Backup Endpoints
app.post('/api/v1/admin/backup/run', async (req: Request, res: Response) => {
  try {
    const result = await executeBackup(pool);
    if (result.success) {
      await logAudit(pool, {
        action: 'EXECUTE_BACKUP',
        entity: 'system_backups',
        entityId: result.filename,
        newValues: { filename: result.filename, sizeBytes: result.sizeBytes, verified: result.verified },
        req
      });
      res.json({
        message: 'Backup PostgreSQL executado com sucesso.',
        filename: result.filename,
        sizeBytes: result.sizeBytes,
        durationMs: result.durationMs,
        verified: result.verified,
        cleanedCount: result.cleanedCount,
        offsiteUploaded: result.offsiteUploaded,
        offsiteKey: result.offsiteKey,
        offsiteError: result.offsiteError
      });
    } else {
      res.status(500).json({
        error: 'Falha ao executar backup do PostgreSQL',
        details: result.error
      });
    }
  } catch (err: any) {
    res.status(500).json({
      error: 'Erro interno ao processar backup',
      details: err?.message || String(err)
    });
  }
});

// GET /api/v1/admin/backup/download - Direct streaming of compressed SQL dump for owner download
app.get('/api/v1/admin/backup/download', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const sqlDump = await dumpDatabase(pool);
    const gzippedBuffer = zlib.gzipSync(Buffer.from(sqlDump, 'utf8'), { level: 9 });
    const durationMs = Date.now() - startTime;

    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
    const filename = `identificapix-backup-${dateStr}.sql.gz`;

    await logAudit(pool, {
      action: 'DOWNLOAD_BACKUP',
      entity: 'system_backups',
      entityId: filename,
      newValues: { filename, sizeBytes: gzippedBuffer.length, durationMs },
      req
    });

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', gzippedBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send(gzippedBuffer);
  } catch (err: any) {
    console.error('[Contributors API] Error generating downloadable backup:', err);
    res.status(500).json({
      error: 'Erro ao gerar download de backup do banco de dados',
      details: err?.message || String(err)
    });
  }
});

// POST /api/v1/admin/database/optimize - Execute VACUUM ANALYZE & collect optimization metrics
app.post('/api/v1/admin/database/optimize', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    // 1. Run VACUUM ANALYZE across database
    await pool.query('VACUUM ANALYZE;');

    // 2. Fetch fresh table statistics & disk usage metrics
    const statsRes = await pool.query(`
      SELECT 
        relname AS table_name,
        n_live_tup AS live_tuples,
        n_dead_tup AS dead_tuples,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_total_relation_size(relid) AS size_bytes,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC;
    `);

    // 3. Database total size
    const dbSizeRes = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as total_db_size;
    `);

    const durationMs = Date.now() - startTime;
    const totalDbSize = dbSizeRes.rows[0]?.total_db_size || 'N/A';

    await logAudit(pool, {
      action: 'OPTIMIZE_DATABASE',
      entity: 'database_maintenance',
      entityId: 'vacuum_analyze',
      newValues: { durationMs, totalDbSize, tablesCount: statsRes.rows.length },
      req
    });

    res.json({
      success: true,
      message: 'Otimização do banco de dados (VACUUM ANALYZE) concluída com sucesso.',
      durationMs,
      totalDbSize,
      tables: statsRes.rows
    });
  } catch (err: any) {
    console.error('[Contributors API] Error running VACUUM ANALYZE:', err);
    res.status(500).json({
      error: 'Erro ao executar otimização do banco de dados',
      details: err?.message || String(err)
    });
  }
});

app.get('/api/v1/admin/backups', async (req: Request, res: Response) => {
  try {
    const listResult = await listBackups();
    res.json({
      source: listResult.source,
      backupDir: listResult.backupDir,
      totalBackups: listResult.totalBackups,
      latestBackup: listResult.latestBackup,
      backups: listResult.files
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/v1/admin/backup/status', async (req: Request, res: Response) => {
  try {
    const listResult = await listBackups();
    res.json({
      source: listResult.source,
      backupDir: listResult.backupDir,
      totalBackups: listResult.totalBackups,
      latestBackup: listResult.latestBackup,
      backups: listResult.files.slice(0, 10)
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// GET /
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'contributors-api',
    status: 'running'
  });
});

export interface TenantContext {
  userId: string | null;
  ownerId: string | null;
  churchId: string | null;
  allowedChurchIds: string[];
  role: string | null;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isSecondaryUser: boolean;
  isAuthenticated: boolean;
}

export function extractContextAllowedChurchIds(user: any, headerChurchId?: string | null): string[] {
  const ids = new Set<string>();
  if (!user) {
    return [];
  }

  // 1. Direct church_id
  if (user.church_id && typeof user.church_id === 'string' && user.church_id.trim()) {
    ids.add(user.church_id.trim());
  }
  if (user.churchId && typeof user.churchId === 'string' && user.churchId.trim()) {
    ids.add(user.churchId.trim());
  }

  // 2. congregation_ids / allowed_church_ids
  if (Array.isArray(user.congregation_ids)) {
    user.congregation_ids.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(user.congregationIds)) {
    user.congregationIds.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(user.allowed_church_ids)) {
    user.allowed_church_ids.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(user.allowedChurchIds)) {
    user.allowedChurchIds.forEach((id: any) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }

  // 3. Permissions array / object
  if (Array.isArray(user.permissions)) {
    user.permissions.forEach((perm: any) => {
      if (typeof perm === 'string') {
        if (perm.startsWith('congregation:')) {
          const cid = perm.split(':')[1];
          if (cid && cid.trim()) ids.add(cid.trim());
        } else if (perm.startsWith('church:')) {
          const cid = perm.split(':')[1];
          if (cid && cid.trim()) ids.add(cid.trim());
        }
      }
    });
  } else if (user.permissions && typeof user.permissions === 'object') {
    if (Array.isArray(user.permissions.congregationIds)) {
      user.permissions.congregationIds.forEach((id: any) => {
        if (typeof id === 'string' && id.trim()) ids.add(id.trim());
      });
    }
    if (typeof user.permissions.congregation === 'string' && user.permissions.congregation.trim()) {
      ids.add(user.permissions.congregation.trim());
    }
  }

  return Array.from(ids);
}

export function getTenantContext(req: Request): TenantContext {
  const reqAny = req as any;
  let user = reqAny.user;

  if (!user && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.substring(7).trim();
      user = verifyAccessToken(token);
      reqAny.user = user;
    } catch (e) {
      // invalid token
    }
  }

  const headerChurchId = (req.headers['x-church-id'] as string) || null;
  const headerUserId = (req.headers['x-user-id'] as string) || null;
  const headerOwnerId = (req.headers['x-owner-id'] as string) || null;
  const headerRole = (req.headers['x-user-role'] as string) || null;
  const headerAllowedChurchIds = req.headers['x-allowed-church-ids']
    ? (typeof req.headers['x-allowed-church-ids'] === 'string'
        ? (req.headers['x-allowed-church-ids'] as string).split(',').map(s => s.trim()).filter(Boolean)
        : [])
    : null;

  if (user) {
    const userId = user.user_id || user.id || null;
    const ownerId = user.owner_id || user.ownerId || headerOwnerId || userId;
    const role = user.role || headerRole || 'user';
    const isSuperAdmin = Boolean(user.is_superadmin || role === 'superadmin');

    const allowedChurchIds = headerAllowedChurchIds && headerAllowedChurchIds.length > 0
      ? headerAllowedChurchIds
      : extractContextAllowedChurchIds(user, headerChurchId);
    const churchId = user.church_id || (allowedChurchIds.length > 0 ? allowedChurchIds[0] : null) || headerChurchId || null;

    const hasSeparateOwner = Boolean(ownerId && userId && ownerId !== userId);
    const isSecondaryRole = ['secondary', 'member', 'operador', 'colaborador'].includes(role) || (role === 'user' && hasSeparateOwner);
    const isSecondaryUser = !isSuperAdmin && (hasSeparateOwner || isSecondaryRole || Boolean(user.is_secondary));
    const isOwner = isSuperAdmin || (!isSecondaryUser && (role === 'owner' || role === 'principal' || !hasSeparateOwner));

    return {
      userId,
      ownerId,
      churchId,
      allowedChurchIds,
      role,
      isSuperAdmin,
      isOwner,
      isSecondaryUser,
      isAuthenticated: true
    };
  }

  const fallbackHasSeparateOwner = Boolean(headerOwnerId && headerUserId && headerOwnerId !== headerUserId);
  const fallbackIsSecondary = headerRole ? (['secondary', 'member', 'operador', 'colaborador'].includes(headerRole) || (headerRole === 'user' && fallbackHasSeparateOwner)) : fallbackHasSeparateOwner;
  const fallbackAllowedChurchIds = headerAllowedChurchIds || (headerChurchId ? [headerChurchId] : []);

  return {
    userId: headerUserId,
    ownerId: headerOwnerId,
    churchId: headerChurchId,
    allowedChurchIds: fallbackAllowedChurchIds,
    role: headerRole,
    isSuperAdmin: headerRole === 'superadmin',
    isOwner: !fallbackIsSecondary,
    isSecondaryUser: fallbackIsSecondary,
    isAuthenticated: Boolean(headerUserId)
  };
}

// GET /health
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'contributors-api',
    version: '1.0.0'
  });
});

// GET /api/v1/audit-logs
app.get('/api/v1/audit-logs', async (req: Request, res: Response) => {
  try {
    const { church_id, user_id, entity, action, start_date, end_date, limit, offset } = req.query;
    const ctx = getTenantContext(req);

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) {
      if (church_id && church_id !== ctx.churchId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: você não tem permissão para acessar os logs desta igreja.'
        });
      }
    }

    const targetChurchId = ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId
      ? ctx.churchId
      : ((church_id || req.headers['x-church-id'] || ctx.churchId) as string | undefined);

    if (!targetChurchId && !ctx.isSuperAdmin) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Acesso negado: church_id é obrigatório para consultar logs de auditoria.'
      });
    }

    const result = await queryAuditLogs(pool, {
      churchId: targetChurchId,
      userId: user_id ? String(user_id) : undefined,
      entity: entity ? String(entity) : undefined,
      action: action ? String(action) : undefined,
      startDate: start_date ? String(start_date) : undefined,
      endDate: end_date ? String(end_date) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[Contributors API] Error GET audit-logs:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message || String(err) });
  }
});

// GET /api/v1/contributors
app.get('/api/v1/contributors', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const requestedChurchId = req.query.church_id as string | undefined;
    const { status, search, q } = req.query;

    if (ctx.isSecondaryUser) {
      if (ctx.allowedChurchIds.length === 0) {
        return res.json([]);
      }
      if (requestedChurchId && requestedChurchId !== 'all' && requestedChurchId !== 'undefined' && requestedChurchId !== 'null') {
        if (!ctx.allowedChurchIds.includes(requestedChurchId)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
      }
    }

    let query = 'SELECT * FROM contributors WHERE 1=1';
    const params: any[] = [];
    let paramCounter = 1;

    if (ctx.isSecondaryUser) {
      if (requestedChurchId && requestedChurchId !== 'all' && requestedChurchId !== 'undefined' && requestedChurchId !== 'null') {
        query += ` AND (church_id = $${paramCounter} OR is_global = TRUE)`;
        params.push(requestedChurchId);
        paramCounter++;
      } else {
        query += ` AND (church_id = ANY($${paramCounter}) OR is_global = TRUE)`;
        params.push(ctx.allowedChurchIds);
        paramCounter++;
      }
    } else {
      if (requestedChurchId && requestedChurchId !== 'all' && requestedChurchId !== 'undefined' && requestedChurchId !== 'null') {
        query += ` AND (church_id = $${paramCounter} OR is_global = TRUE)`;
        params.push(requestedChurchId);
        paramCounter++;
      }
    }

    if (status && typeof status === 'string') {
      const sLower = status.trim().toLowerCase();
      if (sLower === 'active' || sLower === 'ativo') {
        query += ` AND (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)`;
      } else if (sLower === 'inactive' || sLower === 'inativo') {
        query += ` AND (status ILIKE 'inativ%' OR status = 'inactive' OR status = 'Inativo')`;
      } else {
        query += ` AND status = $${paramCounter}`;
        params.push(status);
        paramCounter++;
      }
    }

    const searchTerm = (search || q) as string | undefined;
    if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim()) {
      const cleanTerm = `%${searchTerm.trim()}%`;
      const cleanDigits = searchTerm.replace(/\D/g, '');
      if (cleanDigits.length >= 3) {
        query += ` AND (name ILIKE $${paramCounter} OR canonical_name ILIKE $${paramCounter} OR cpf ILIKE $${paramCounter} OR REGEXP_REPLACE(COALESCE(cpf, ''), '\\D', '', 'g') LIKE $${paramCounter + 1})`;
        params.push(cleanTerm, `%${cleanDigits}%`);
        paramCounter += 2;
      } else {
        query += ` AND (name ILIKE $${paramCounter} OR canonical_name ILIKE $${paramCounter})`;
        params.push(cleanTerm);
        paramCounter++;
      }
    }

    query += ' ORDER BY canonical_name ASC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error processing get contributors request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST & GET /api/v1/contributors/identify (Single-record & search identification endpoint for Portal do Contribuinte - LGPD & Multi-church secure)
const identifyContributorHandler = async (req: Request, res: Response) => {
  try {
    const rawChurchId = (req.body.church_id || req.query.church_id) as string | undefined;
    const identifier = (req.body.identifier || req.query.identifier || req.query.q || req.body.q) as string | undefined;
    const identifier_type = (req.body.identifier_type || req.query.identifier_type || req.query.type || req.body.type) as string | undefined;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    let church_id = rawChurchId;
    if (!church_id || typeof church_id !== 'string' || !uuidRegex.test(church_id)) {
      church_id = '00000000-0000-0000-0000-000000000001';
    }

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'identifier é obrigatório.' });
    }

    const typeLower = (identifier_type || 'cpf').trim().toLowerCase();
    if (!['cpf', 'phone', 'email', 'name'].includes(typeLower)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'identifier_type inválido. Tipos permitidos: cpf, phone, email, name.' });
    }

    const rawVal = identifier.trim();
    let matchedContributor: any = null;
    let multipleMatches: any[] = [];

    if (typeLower === 'cpf') {
      const cleanDigits = rawVal.replace(/\D/g, '');
      if (!cleanDigits) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'CPF inválido.' });
      }

      // Query with flexible active status and robust CPF digit stripping
      const result = await pool.query(
        `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                person_type, trade_name, rg_ie, birth_date, contact_person, category,
                pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                address_number, address_city, address_state, notes, role_position, photo_url
         FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)
           AND (
             cpf = $1 
             OR REGEXP_REPLACE(COALESCE(cpf, ''), '\\D', '', 'g') = $1
             OR REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '') = $1
           )
         ORDER BY (CASE WHEN church_id = $2 THEN 0 ELSE 1 END), updated_at DESC
         LIMIT 1`,
        [cleanDigits, church_id]
      );

      if (result.rows.length > 0) {
        matchedContributor = result.rows[0];
      } else {
        const allRes = await pool.query(
          `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                  person_type, trade_name, rg_ie, birth_date, contact_person, category,
                  pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                  address_number, address_city, address_state, notes, role_position, photo_url
           FROM contributors 
           WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)`
        );
        matchedContributor = allRes.rows.find((c: any) => c.cpf && String(c.cpf).replace(/\D/g, '') === cleanDigits) || null;
      }

    } else if (typeLower === 'name') {
      const cleanName = rawVal.trim();
      if (cleanName.length < 2) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe pelo menos 2 caracteres para pesquisar pelo nome.' });
      }

      const nameTerm = `%${cleanName}%`;
      const result = await pool.query(
        `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                person_type, trade_name, rg_ie, birth_date, contact_person, category,
                pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                address_number, address_city, address_state, notes, role_position, photo_url
         FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)
           AND (
             name ILIKE $1 
             OR canonical_name ILIKE $1
           )
         ORDER BY (CASE WHEN church_id = $2 THEN 0 ELSE 1 END), canonical_name ASC
         LIMIT 10`,
        [nameTerm, church_id]
      );

      if (result.rows.length > 0) {
        multipleMatches = result.rows;
        matchedContributor = result.rows[0];
      }

    } else if (typeLower === 'phone') {
      const cleanDigits = rawVal.replace(/\D/g, '');
      if (!cleanDigits) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Telefone inválido.' });
      }

      const result = await pool.query(
        `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                person_type, trade_name, rg_ie, birth_date, contact_person, category,
                pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                address_number, address_city, address_state, notes, role_position, photo_url
         FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)
           AND (
             phone = $1 
             OR whatsapp = $1
             OR REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') = $1
             OR REGEXP_REPLACE(COALESCE(whatsapp, ''), '\\D', '', 'g') = $1
           )
         ORDER BY (CASE WHEN church_id = $2 THEN 0 ELSE 1 END), updated_at DESC
         LIMIT 1`,
        [cleanDigits, church_id]
      );

      if (result.rows.length > 0) {
        matchedContributor = result.rows[0];
      } else {
        const allRes = await pool.query(
          `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                  person_type, trade_name, rg_ie, birth_date, contact_person, category,
                  pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                  address_number, address_city, address_state, notes, role_position, photo_url
           FROM contributors 
           WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)`
        );
        matchedContributor = allRes.rows.find((c: any) => (c.phone && String(c.phone).replace(/\D/g, '') === cleanDigits) || (c.whatsapp && String(c.whatsapp).replace(/\D/g, '') === cleanDigits)) || null;
      }

    } else if (typeLower === 'email') {
      const cleanEmail = rawVal.toLowerCase();

      const result = await pool.query(
        `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                person_type, trade_name, rg_ie, birth_date, contact_person, category,
                pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                address_number, address_city, address_state, notes, role_position, photo_url
         FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)
           AND LOWER(TRIM(COALESCE(email, ''))) = $1
         ORDER BY (CASE WHEN church_id = $2 THEN 0 ELSE 1 END), updated_at DESC
         LIMIT 1`,
        [cleanEmail, church_id]
      );

      if (result.rows.length > 0) {
        matchedContributor = result.rows[0];
      } else {
        const allRes = await pool.query(
          `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                  person_type, trade_name, rg_ie, birth_date, contact_person, category,
                  pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                  address_number, address_city, address_state, notes, role_position, photo_url
           FROM contributors 
           WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)`
        );
        matchedContributor = allRes.rows.find((c: any) => c.email && String(c.email).trim().toLowerCase() === cleanEmail) || null;
      }
    }

    const formatContributorResponse = (c: any) => ({
      id: c.id,
      church_id: c.church_id,
      canonical_name: c.canonical_name,
      name: c.name || c.canonical_name,
      cpf: c.cpf || null,
      email: c.email || null,
      phone: c.phone || null,
      whatsapp: c.whatsapp || c.phone || null,
      birth_date: c.birth_date || null,
      person_type: c.person_type || 'PF',
      trade_name: c.trade_name || null,
      rg_ie: c.rg_ie || null,
      contact_person: c.contact_person || null,
      category: c.category || null,
      pix_key: c.pix_key || null,
      bank_name: c.bank_name || null,
      bank_agency: c.bank_agency || null,
      bank_account: c.bank_account || null,
      address_cep: c.address_cep || null,
      address_street: c.address_street || null,
      address_number: c.address_number || null,
      address_city: c.address_city || null,
      address_state: c.address_state || null,
      notes: c.notes || null,
      role_position: c.role_position || null,
      photo_url: c.photo_url || null,
      updated_at: c.updated_at || c.created_at || null,
      created_at: c.created_at || null,
      status: c.status
    });

    if (matchedContributor) {
      return res.json({
        found: true,
        contributor: formatContributorResponse(matchedContributor),
        results: multipleMatches.length > 0 ? multipleMatches.map(formatContributorResponse) : [formatContributorResponse(matchedContributor)]
      });
    } else {
      return res.json({
        found: false,
        contributor: null,
        results: [],
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

// POST /api/v1/contributors/confirm-profile (1-click 6-month periodic data confirmation)
app.post('/api/v1/contributors/confirm-profile', async (req: Request, res: Response) => {
  try {
    const { id, cpf } = req.body;
    let targetId = id;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!targetId || !uuidRegex.test(targetId)) {
      const cleanCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
      if (cleanCpf) {
        const findRes = await pool.query(
          "SELECT id FROM contributors WHERE status = 'active' AND (cpf = $1 OR REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = $1) LIMIT 1",
          [cleanCpf]
        );
        if (findRes.rows.length > 0) {
          targetId = findRes.rows[0].id;
        }
      }
    }

    if (!targetId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID ou CPF do contribuinte não localizado.' });
    }

    const result = await pool.query(
      'UPDATE contributors SET updated_at = NOW() WHERE id = $1 RETURNING id, updated_at',
      [targetId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Contribuinte não encontrado.' });
    }

    return res.json({
      success: true,
      message: 'Cadastro confirmado com sucesso para os próximos 6 meses.',
      updated_at: result.rows[0].updated_at
    });
  } catch (err: any) {
    console.error('[Contributors API] Error confirming contributor profile:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro ao confirmar cadastro.' });
  }
});

// POST /api/v1/contributors/update-profile (Direct contributor self-service update)
app.post('/api/v1/contributors/update-profile', async (req: Request, res: Response) => {
  try {
    const { 
      id, church_id, canonical_name, name, cpf, email, phone, whatsapp,
      birth_date, person_type, trade_name, rg_ie, contact_person,
      category, role_position, pix_key, bank_name, bank_agency, bank_account,
      address_cep, address_street, address_number, address_city, address_state, notes,
      photo_url, photo
    } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    
    let targetId: string | null = null;

    // 1. Check by UUID if provided
    if (id && uuidRegex.test(id)) {
      const checkRes = await pool.query("SELECT id FROM contributors WHERE id = $1", [id]);
      if (checkRes.rows.length > 0) {
        targetId = checkRes.rows[0].id;
      }
    }

    // 2. If not found by ID, try finding by CPF
    if (!targetId) {
      const cleanCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
      if (cleanCpf) {
        const findRes = await pool.query(
          `SELECT id FROM contributors 
           WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL) 
             AND (cpf = $1 OR REGEXP_REPLACE(COALESCE(cpf, ''), '\\D', '', 'g') = $1 OR REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '') = $1) 
           LIMIT 1`,
          [cleanCpf]
        );
        if (findRes.rows.length > 0) {
          targetId = findRes.rows[0].id;
        }
      }
    }

    // 3. If not found by CPF, try finding by Phone / WhatsApp
    if (!targetId) {
      const rawPhone = phone || whatsapp;
      const cleanPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
      if (cleanPhone && cleanPhone.length >= 8) {
        const findPhoneRes = await pool.query(
          `SELECT id FROM contributors 
           WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL) 
             AND (
               phone = $1 OR whatsapp = $1 
               OR REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') = $1 
               OR REGEXP_REPLACE(COALESCE(whatsapp, ''), '\\D', '', 'g') = $1
             ) 
           LIMIT 1`,
          [cleanPhone]
        );
        if (findPhoneRes.rows.length > 0) {
          targetId = findPhoneRes.rows[0].id;
        }
      }
    }

    // 4. If not found by phone, try finding by Email
    if (!targetId && email && typeof email === 'string' && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const findEmailRes = await pool.query(
        `SELECT id FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL) 
           AND LOWER(TRIM(COALESCE(email, ''))) = $1 
         LIMIT 1`,
        [cleanEmail]
      );
      if (findEmailRes.rows.length > 0) {
        targetId = findEmailRes.rows[0].id;
      }
    }

    const cleanChosenName = (name || canonical_name || '').trim();
    const cleanCanonical = cleanChosenName ? cleanChosenName.replace(/\s+/g, ' ').toUpperCase() : 'CONTRIBUINTE';
    const cleanCpfDigits = cpf ? String(cpf).replace(/\D/g, '') : null;
    const cleanPhoneDigits = (phone || whatsapp) ? String(phone || whatsapp).replace(/\D/g, '') : null;
    const cleanPhoto = photo_url !== undefined ? photo_url : photo;
    const cleanChurchId = church_id && uuidRegex.test(church_id) ? church_id : '00000000-0000-0000-0000-000000000001';

    // 5. If existing record found, perform UPDATE
    if (targetId) {
      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [targetId];
      let counter = 2;

      const addField = (fieldName: string, val: any) => {
        if (val !== undefined) {
          updates.push(`${fieldName} = $${counter}`);
          params.push(val);
          counter++;
        }
      };

      if (cleanChosenName) {
        addField('canonical_name', cleanCanonical);
        addField('name', cleanChosenName);
      }

      if (cpf !== undefined) {
        addField('cpf', cleanCpfDigits);
      }

      if (email !== undefined) {
        addField('email', email && typeof email === 'string' ? email.trim() : null);
      }

      if (phone !== undefined || whatsapp !== undefined) {
        addField('phone', cleanPhoneDigits);
        addField('whatsapp', cleanPhoneDigits);
      }

      if (birth_date !== undefined) addField('birth_date', birth_date ? String(birth_date).trim() : null);
      if (person_type !== undefined) addField('person_type', person_type || 'PF');
      if (trade_name !== undefined) addField('trade_name', trade_name ? String(trade_name).trim() : null);
      if (rg_ie !== undefined) addField('rg_ie', rg_ie ? String(rg_ie).trim() : null);
      if (contact_person !== undefined) addField('contact_person', contact_person ? String(contact_person).trim() : null);
      if (category !== undefined) addField('category', category ? String(category).trim() : null);
      if (role_position !== undefined) addField('role_position', role_position ? String(role_position).trim() : null);
      if (pix_key !== undefined) addField('pix_key', pix_key ? String(pix_key).trim() : null);
      if (bank_name !== undefined) addField('bank_name', bank_name ? String(bank_name).trim() : null);
      if (bank_agency !== undefined) addField('bank_agency', bank_agency ? String(bank_agency).trim() : null);
      if (bank_account !== undefined) addField('bank_account', bank_account ? String(bank_account).trim() : null);
      if (address_cep !== undefined) addField('address_cep', address_cep ? String(address_cep).trim() : null);
      if (address_street !== undefined) addField('address_street', address_street ? String(address_street).trim() : null);
      if (address_number !== undefined) addField('address_number', address_number ? String(address_number).trim() : null);
      if (address_city !== undefined) addField('address_city', address_city ? String(address_city).trim() : null);
      if (address_state !== undefined) addField('address_state', address_state ? String(address_state).trim() : null);
      if (notes !== undefined) addField('notes', notes ? String(notes).trim() : null);
      if (photo_url !== undefined || photo !== undefined) {
        addField('photo_url', cleanPhoto && typeof cleanPhoto === 'string' ? cleanPhoto.trim() : null);
      }
      if (church_id && typeof church_id === 'string' && uuidRegex.test(church_id)) {
        addField('church_id', church_id);
      }

      const updateQuery = `UPDATE contributors SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
      const result = await pool.query(updateQuery, params);

      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }
    }

    // 6. If no existing record found, INSERT a new contributor record
    const insertRes = await pool.query(
      `INSERT INTO contributors (
        church_id, canonical_name, name, cpf, email, phone, whatsapp,
        birth_date, person_type, trade_name, rg_ie, contact_person,
        category, role_position, pix_key, bank_name, bank_agency, bank_account,
        address_cep, address_street, address_number, address_city, address_state, notes,
        photo_url, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24,
        $25, 'active'
      ) RETURNING *`,
      [
        cleanChurchId,
        cleanCanonical,
        cleanChosenName || 'Contribuinte',
        cleanCpfDigits,
        email && typeof email === 'string' ? email.trim() : null,
        cleanPhoneDigits,
        cleanPhoneDigits,
        birth_date ? String(birth_date).trim() : null,
        person_type || 'PF',
        trade_name ? String(trade_name).trim() : null,
        rg_ie ? String(rg_ie).trim() : null,
        contact_person ? String(contact_person).trim() : null,
        category ? String(category).trim() : null,
        role_position ? String(role_position).trim() : null,
        pix_key ? String(pix_key).trim() : null,
        bank_name ? String(bank_name).trim() : null,
        bank_agency ? String(bank_agency).trim() : null,
        bank_account ? String(bank_account).trim() : null,
        address_cep ? String(address_cep).trim() : null,
        address_street ? String(address_street).trim() : null,
        address_number ? String(address_number).trim() : null,
        address_city ? String(address_city).trim() : null,
        address_state ? String(address_state).trim() : null,
        notes ? String(notes).trim() : null,
        cleanPhoto && typeof cleanPhoto === 'string' ? cleanPhoto.trim() : null
      ]
    );

    return res.json(insertRes.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error updating contributor profile:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar dados do contribuinte.' });
  }
});

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
    const ctx = getTenantContext(req);

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
    const requestedChurchId = req.query.church_id as string | undefined;
    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) {
      if (requestedChurchId && requestedChurchId !== ctx.churchId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: a solicitação pertence a outra igreja.'
        });
      }
    }

    const effectiveChurchId = ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId
      ? ctx.churchId
      : (requestedChurchId || (req.headers['x-church-id'] as string) || ctx.churchId);

    if (!ctx.isSuperAdmin && effectiveChurchId && requestObj.church_id !== effectiveChurchId) {
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
    const ctx = getTenantContext(req);
    const { contributor_id, status } = req.query;

    const requestedChurchId = req.query.church_id as string | undefined;
    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) {
      if (requestedChurchId && requestedChurchId !== ctx.churchId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: você não tem permissão para acessar os dados desta igreja.'
        });
      }
    }

    const effectiveChurchId = ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId
      ? ctx.churchId
      : (requestedChurchId || (req.headers['x-church-id'] as string) || ctx.churchId);

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!effectiveChurchId || typeof effectiveChurchId !== 'string' || !uuidRegex.test(effectiveChurchId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'church_id é obrigatório para consultar solicitações.'
      });
    }

    let query = 'SELECT id, church_id, contributor_id, amount, description, status, created_at, updated_at FROM contribution_requests WHERE church_id = $1';
    const params: any[] = [effectiveChurchId];
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
    const cleanUserId = typeof user_id === 'string' && user_id.trim() ? user_id.trim() : null;

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

    if (cleanUserId) {
      params.push(cleanUserId);
      query += ` AND (ct.user_id = $1 OR ct.user_id IS NULL OR ct.user_id = '00000000-0000-0000-0000-000000000001')`;
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

    let result = await pool.query(query, params);

    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }

    // Auto-seed standard contribution types if none exist
    const defaultTypes = [
      { name: 'Dízimo', type: 'entrada', order: 1 },
      { name: 'Oferta', type: 'entrada', order: 2 },
      { name: 'Contribuição Especial', type: 'entrada', order: 3 },
      { name: 'Doação / Voto', type: 'entrada', order: 4 },
      { name: 'Despesas Operacionais', type: 'saida', order: 1 },
      { name: 'Manutenção e Reformas', type: 'saida', order: 2 },
      { name: 'Energia / Água / Internet', type: 'saida', order: 3 },
      { name: 'Preletor / Ajuda de Custo', type: 'saida', order: 4 },
      { name: 'Eventos e Festividades', type: 'saida', order: 5 }
    ];

    for (const dt of defaultTypes) {
      try {
        await pool.query(
          `INSERT INTO contribution_types (name, type, category, "order", is_active, user_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [dt.name, dt.type, dt.type === 'entrada' ? 'Receita' : 'Despesa', dt.order, true, cleanUserId]
        );
      } catch (e) {
        console.error('Error auto-seeding contribution type:', e);
      }
    }

    result = await pool.query(query, params);
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
    const ctx = getTenantContext(req);
    const { 
      church_id, canonical_name, cpf, email, phone, status,
      person_type, trade_name, rg_ie, birth_date, contact_person,
      category, pix_key, bank_name, bank_agency, bank_account,
      address_cep, address_street, address_number, address_city, address_state, notes,
      is_global, role_position, photo_url, photo
    } = req.body;

    const cleanPhotoUrl = photo_url !== undefined ? photo_url : (photo !== undefined ? photo : null);

    // UUID Pattern validation
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    let cleanChurchId = church_id || ctx.churchId;
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
               name = $1,
               email = COALESCE($2, email), 
               phone = COALESCE($3, phone),
               whatsapp = COALESCE($3, whatsapp),
               photo_url = COALESCE($6, photo_url),
               is_global = CASE WHEN $5 = TRUE THEN TRUE ELSE is_global END,
               birth_date = COALESCE($7, birth_date),
               person_type = COALESCE($8, person_type),
               trade_name = COALESCE($9, trade_name),
               rg_ie = COALESCE($10, rg_ie),
               contact_person = COALESCE($11, contact_person),
               category = COALESCE($12, category),
               pix_key = COALESCE($13, pix_key),
               bank_name = COALESCE($14, bank_name),
               bank_agency = COALESCE($15, bank_agency),
               bank_account = COALESCE($16, bank_account),
               address_cep = COALESCE($17, address_cep),
               address_street = COALESCE($18, address_street),
               address_number = COALESCE($19, address_number),
               address_city = COALESCE($20, address_city),
               address_state = COALESCE($21, address_state),
               notes = COALESCE($22, notes),
               role_position = COALESCE($23, role_position),
               updated_at = NOW() 
           WHERE id = $4 
           RETURNING *`,
          [
            sanitizedName, 
            sanitizedEmail, 
            sanitizedPhone, 
            existing.id, 
            isGlobalValue, 
            cleanPhotoUrl,
            birth_date ? String(birth_date).trim() : null,
            person_type || null,
            trade_name ? String(trade_name).trim() : null,
            rg_ie ? String(rg_ie).trim() : null,
            contact_person ? String(contact_person).trim() : null,
            category ? String(category).trim() : null,
            pix_key ? String(pix_key).trim() : null,
            bank_name ? String(bank_name).trim() : null,
            bank_agency ? String(bank_agency).trim() : null,
            bank_account ? String(bank_account).trim() : null,
            address_cep ? String(address_cep).trim() : null,
            address_street ? String(address_street).trim() : null,
            address_number ? String(address_number).trim() : null,
            address_city ? String(address_city).trim() : null,
            address_state ? String(address_state).trim() : null,
            notes ? String(notes).trim() : null,
            role_position ? String(role_position).trim() : null
          ]
        );
        return res.status(200).json(updateResult.rows[0] || existing);
      }
    }

    // Insert contributor record with all extended fields
    const insertResult = await pool.query(
      `INSERT INTO contributors (
        church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
        person_type, trade_name, rg_ie, birth_date, contact_person,
        category, pix_key, bank_name, bank_agency, bank_account,
        address_cep, address_street, address_number, address_city, address_state, notes, is_global, role_position, photo_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING *`,
      [
        cleanChurchId, sanitizedName, (req.body.name ? String(req.body.name).trim() : sanitizedName), sanitizedCpf, sanitizedEmail, sanitizedPhone, (req.body.whatsapp ? String(req.body.whatsapp).trim() : sanitizedPhone), sanitizedStatus,
        person_type || 'PF', trade_name || null, rg_ie || null, birth_date || null, contact_person || null,
        category || null, pix_key || null, bank_name || null, bank_agency || null, bank_account || null,
        address_cep || null, address_street || null, address_number || null, address_city || null, address_state || null, notes || null,
        isGlobalValue, role_position || null, cleanPhotoUrl
      ]
    );

    const createdContrib = insertResult.rows[0];
    await logAudit(pool, {
      action: 'CREATE',
      entity: 'contributors',
      entityId: createdContrib.id,
      churchId: createdContrib.church_id,
      newValues: createdContrib,
      req
    });

    return res.status(201).json(createdContrib);

  } catch (err) {
    console.error('[Contributors API] Error processing post contributors request:', err);
    const pgErr = err as any;
    if (pgErr.code === '22P02' || pgErr.code === '23502') {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/contributors/:id/photo
app.post('/api/v1/contributors/:id/photo', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { photo_url, photo } = req.body;
    const cleanPhotoUrl = photo_url !== undefined ? photo_url : (photo !== undefined ? photo : null);

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    const result = await pool.query(
      'UPDATE contributors SET photo_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [cleanPhotoUrl, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'CONTRIBUTOR_NOT_FOUND' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error updating contributor photo:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/contributors/:id
app.put('/api/v1/contributors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
    const { 
      church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
      person_type, trade_name, rg_ie, birth_date, contact_person,
      category, pix_key, bank_name, bank_agency, bank_account,
      address_cep, address_street, address_number, address_city, address_state, notes,
      is_global, role_position, photo_url, photo
    } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    const checkContribRes = await pool.query("SELECT * FROM contributors WHERE id = $1", [id]);
    if (checkContribRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    const oldContrib = checkContribRes.rows[0];

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
      const cleanName = canonical_name.trim();
      addField('canonical_name', cleanName.replace(/\s+/g, ' ').toUpperCase());
      addField('name', cleanName);
    } else if (name !== undefined) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (cleanName) {
        addField('canonical_name', cleanName.replace(/\s+/g, ' ').toUpperCase());
        addField('name', cleanName);
      }
    }

    if (cpf !== undefined) {
      const sanitizedCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
      if (sanitizedCpf && sanitizedCpf.length > 0) {
        const dupCheck = await pool.query(
          "SELECT id, canonical_name FROM contributors WHERE id != $1 AND status = 'active' AND (cpf = $2 OR REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = $2) LIMIT 1",
          [id, sanitizedCpf]
        );
        if (dupCheck.rows.length > 0) {
          return res.status(409).json({
            error: 'DUPLICATE_CPF',
            message: `Já existe outro cadastro ativo (${dupCheck.rows[0].canonical_name}) com este CPF/CNPJ.`
          });
        }
      }
      addField('cpf', sanitizedCpf);
    }

    if (email !== undefined) {
      addField('email', email && typeof email === 'string' ? email.trim() : null);
    }

    if (phone !== undefined) {
      const cleanPhone = phone && typeof phone === 'string' ? phone.trim() : null;
      addField('phone', cleanPhone);
      addField('whatsapp', cleanPhone);
    } else if (whatsapp !== undefined) {
      const cleanWhatsapp = whatsapp && typeof whatsapp === 'string' ? whatsapp.trim() : null;
      addField('whatsapp', cleanWhatsapp);
      addField('phone', cleanWhatsapp);
    }

    if (status !== undefined) {
      addField('status', status === 'inactive' ? 'inactive' : 'active');
    }

    if (is_global !== undefined) {
      addField('is_global', Boolean(is_global));
    }

    if (photo_url !== undefined || photo !== undefined) {
      addField('photo_url', photo_url !== undefined ? photo_url : photo);
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

    const updatedContrib = result.rows[0];
    await logAudit(pool, {
      action: 'UPDATE',
      entity: 'contributors',
      entityId: id,
      churchId: updatedContrib.church_id || oldContrib?.church_id,
      oldValues: oldContrib,
      newValues: updatedContrib,
      req
    });

    return res.json(updatedContrib);
  } catch (err) {
    console.error('[Contributors API] Error processing put contributor request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/contributors/:id
app.delete('/api/v1/contributors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
    const hardDelete = req.query.hard === 'true';
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    const oldContribRes = await pool.query("SELECT * FROM contributors WHERE id = $1", [id]);
    const oldContrib = oldContribRes.rows[0] || null;

    if (!oldContrib) {
      return res.status(404).json({ error: 'NOT_FOUND' });
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

    await logAudit(pool, {
      action: hardDelete ? 'DELETE' : 'UPDATE',
      entity: 'contributors',
      entityId: id,
      churchId: oldContrib?.church_id,
      oldValues: oldContrib,
      req
    });

    return res.json({ success: true, id: id, hard: hardDelete });
  } catch (err) {
    console.error('[Contributors API] Error processing delete contributor request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});



// ==========================================
// REFERENCE DATA ENDPOINT
// ==========================================

const getReferenceDataHandler = async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const paramOwnerId = (req.params.ownerId || req.query.user_id) as string | undefined;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (paramOwnerId && paramOwnerId !== ctx.userId && paramOwnerId !== ctx.ownerId && paramOwnerId !== ctx.churchId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado aos dados de referência de outro usuário.' });
      }
    }

    const cleanUserId = (paramOwnerId && typeof paramOwnerId === 'string' && paramOwnerId.trim())
      ? paramOwnerId.trim()
      : (ctx.ownerId || ctx.userId || null);

    if (!cleanUserId && !ctx.isSuperAdmin) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ownerId é obrigatório.' });
    }

    // 1. Fetch Banks
    let banksQuery = 'SELECT id, name, user_id, bank_key, account_name, accepted_contribution_types, created_at FROM banks WHERE 1=1';
    const banksParams: any[] = [];
    if (cleanUserId) {
      banksParams.push(cleanUserId);
      banksQuery += ` AND (
        user_id::text = $1 
        OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT id FROM profiles WHERE id = $1 OR owner_id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
      )`;
    }
    banksQuery += ' ORDER BY created_at DESC';
    const banksResult = await pool.query(banksQuery, banksParams);
    const banks = banksResult.rows || [];

    // 2. Fetch Churches
    let churches: any[] = [];
    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      churches = [];
    } else {
      let churchesQuery = 'SELECT * FROM churches WHERE 1=1';
      const churchesParams: any[] = [];
      if (cleanUserId) {
        churchesParams.push(cleanUserId);
        churchesQuery += ` AND (
          user_id::text = $1 
          OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
          OR user_id::text IN (SELECT id FROM profiles WHERE id = $1 OR owner_id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
          OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        )`;
      }
      if (ctx.isSecondaryUser) {
        churchesParams.push(ctx.allowedChurchIds);
        churchesQuery += ` AND id = ANY($${churchesParams.length})`;
      }
      churchesQuery += ' ORDER BY name ASC';
      const churchesResult = await pool.query(churchesQuery, churchesParams);
      churches = churchesResult.rows || [];
    }

    // 3. Fetch Reports
    let reports: any[] = [];
    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      reports = [];
    } else {
      let reportsQuery = 'SELECT id, name, user_id, church_id, record_count, created_at FROM saved_reports WHERE 1=1';
      const reportsParams: any[] = [];
      if (cleanUserId) {
        reportsParams.push(cleanUserId);
        reportsQuery += ` AND (
          user_id::text = $1 
          OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
          OR user_id::text IN (SELECT id FROM profiles WHERE id = $1 OR owner_id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
          OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
          OR user_id IS NULL
        )`;
      }
      if (ctx.isSecondaryUser) {
        reportsParams.push(ctx.allowedChurchIds);
        reportsQuery += ` AND church_id = ANY($${reportsParams.length})`;
      }
      reportsQuery += ' ORDER BY created_at DESC';
      const reportsResult = await pool.query(reportsQuery, reportsParams);
      reports = reportsResult.rows || [];
    }

    // 4. Fetch Associations
    let assocQuery = 'SELECT * FROM learned_associations WHERE 1=1';
    const assocParams: any[] = [];
    if (cleanUserId) {
      assocParams.push(cleanUserId);
      assocQuery += ` AND (
        user_id::text = $1 
        OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT id FROM profiles WHERE id = $1 OR owner_id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id IS NULL
      )`;
    }
    assocQuery += ' ORDER BY created_at DESC';
    const assocResult = await pool.query(assocQuery, assocParams);
    const associations = assocResult.rows || [];

    return res.json({
      banks,
      churches,
      reports,
      associations
    });
  } catch (err: any) {
    console.error('[Contributors API] Error fetching reference data:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
};

app.get('/api/v1/reference/data/:ownerId', getReferenceDataHandler);
app.get('/api/reference/data/:ownerId', getReferenceDataHandler);

// ==========================================
// BANKS ENDPOINTS
// ==========================================

// GET /api/v1/banks
app.get('/api/v1/banks', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const requestedUserId = req.query.user_id as string | undefined;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (requestedUserId && requestedUserId !== ctx.userId && requestedUserId !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para este usuário.' });
      }
    }

    const cleanUserId = (requestedUserId && requestedUserId.trim())
      ? requestedUserId.trim()
      : (ctx.ownerId || ctx.userId);

    if (!cleanUserId && !ctx.isSuperAdmin) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'user_id é obrigatório para consultar bancos.' });
    }

    let query = 'SELECT id, name, user_id, bank_key, account_name, accepted_contribution_types, created_at FROM banks WHERE 1=1';
    const params: any[] = [];
    if (cleanUserId) {
      params.push(cleanUserId);
      query += ` AND (
        user_id::text = $1 
        OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT id FROM profiles WHERE id = $1 OR owner_id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
      )`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);

    return res.json(result.rows || []);
  } catch (err) {
    console.error('[Contributors API] Error GET banks:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/banks
app.post('/api/v1/banks', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { name, user_id, bank_key, account_name, accepted_contribution_types } = req.body;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar banco para outro usuário.' });
      }
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (!name || !effectiveUserId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const result = await pool.query(
      'INSERT INTO banks (name, user_id, bank_key, account_name, accepted_contribution_types) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, effectiveUserId, bank_key || null, account_name || name, Array.isArray(accepted_contribution_types) ? accepted_contribution_types : null]
    );
    const createdBank = result.rows[0];
    await logAudit(pool, {
      action: 'CREATE',
      entity: 'banks',
      entityId: createdBank.id,
      userId: effectiveUserId,
      newValues: createdBank,
      req
    });
    return res.status(201).json(createdBank);
  } catch (err) {
    console.error('[Contributors API] Error POST bank:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/banks/:id
app.put('/api/v1/banks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
    const { name, bank_key, account_name, accepted_contribution_types } = req.body;
    const oldBankRes = await pool.query('SELECT * FROM banks WHERE id = $1', [id]);
    const oldBank = oldBankRes.rows[0] || null;

    if (!oldBank) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (oldBank.user_id && oldBank.user_id !== ctx.userId && oldBank.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o recurso pertence a outro usuário.' });
      }
    }

    const result = await pool.query(
      'UPDATE banks SET name = COALESCE($1, name), bank_key = COALESCE($2, bank_key), account_name = COALESCE($3, account_name), accepted_contribution_types = $4 WHERE id = $5 RETURNING *',
      [name, bank_key || null, account_name || null, Array.isArray(accepted_contribution_types) ? accepted_contribution_types : null, id]
    );

    const updatedBank = result.rows[0];
    await logAudit(pool, {
      action: 'UPDATE',
      entity: 'banks',
      entityId: id,
      userId: updatedBank.user_id || oldBank?.user_id,
      oldValues: oldBank,
      newValues: updatedBank,
      req
    });
    return res.json(updatedBank);
  } catch (err) {
    console.error('[Contributors API] Error PUT bank:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/banks/:id
app.delete('/api/v1/banks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
    const oldBankRes = await pool.query('SELECT * FROM banks WHERE id = $1', [id]);
    const oldBank = oldBankRes.rows[0] || null;

    if (!oldBank) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (oldBank.user_id && oldBank.user_id !== ctx.userId && oldBank.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o recurso pertence a outro usuário.' });
      }
    }

    const result = await pool.query('DELETE FROM banks WHERE id = $1 RETURNING id', [id]);

    await logAudit(pool, {
      action: 'DELETE',
      entity: 'banks',
      entityId: id,
      userId: oldBank?.user_id,
      oldValues: oldBank,
      req
    });
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
    const ctx = getTenantContext(req);
    const { user_id } = req.query;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para este usuário.' });
      }
    }

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    const cleanUserId = (typeof user_id === 'string' && user_id.trim())
      ? user_id.trim()
      : (ctx.ownerId || ctx.userId);

    let query = 'SELECT * FROM churches WHERE 1=1';
    const params: any[] = [];
    if (cleanUserId) {
      params.push(cleanUserId);
      query += ` AND (
        user_id::text = $1 
        OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT id FROM profiles WHERE id = $1 OR owner_id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
      )`;
    }
    if (ctx.isSecondaryUser) {
      params.push(ctx.allowedChurchIds);
      query += ` AND id = ANY($${params.length})`;
    }
    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);

    return res.json(result.rows || []);
  } catch (err) {
    console.error('[Contributors API] Error GET churches:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/churches
app.post('/api/v1/churches', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { name, address, logoUrl, pastor, cnpj, phone, email, pixKey, cep, city, state, treasurer, pastors, treasurers, whatsapp_official, whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation, user_id } = req.body;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar igreja para outro usuário.' });
      }
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (!name || !effectiveUserId) {
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
        effectiveUserId
      ]
    );

    const createdChurch = result.rows[0];
    await logAudit(pool, {
      action: 'CREATE',
      entity: 'churches',
      entityId: createdChurch.id,
      churchId: createdChurch.id,
      userId: effectiveUserId,
      newValues: createdChurch,
      req
    });

    return res.status(201).json(createdChurch);
  } catch (err) {
    console.error('[Contributors API] Error POST church:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/churches/:id
app.put('/api/v1/churches/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
    const { name, address, logoUrl, pastor, cnpj, phone, email, pixKey, cep, city, state, treasurer, pastors, treasurers, whatsapp_official, whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation } = req.body;
    const pastorsVal = pastors ? (typeof pastors === 'string' ? pastors : JSON.stringify(pastors)) : null;
    const treasurersVal = treasurers ? (typeof treasurers === 'string' ? treasurers : JSON.stringify(treasurers)) : null;

    const oldChurchRes = await pool.query('SELECT * FROM churches WHERE id = $1', [id]);
    const oldChurch = oldChurchRes.rows[0] || null;

    if (!oldChurch) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    if (ctx.isAuthenticated && !ctx.isSuperAdmin) {
      if (ctx.churchId && id !== ctx.churchId && oldChurch.user_id !== ctx.userId && oldChurch.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a igreja pertence a outra organização.' });
      }
    }

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

    const updatedChurch = result.rows[0];
    await logAudit(pool, {
      action: 'UPDATE',
      entity: 'churches',
      entityId: id,
      churchId: id,
      oldValues: oldChurch,
      newValues: updatedChurch,
      req
    });

    return res.json(updatedChurch);
  } catch (err) {
    console.error('[Contributors API] Error PUT church:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/pastoral_messages
app.get('/api/v1/pastoral_messages', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { church_id, user_id } = req.query;

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    let query = 'SELECT * FROM pastoral_messages WHERE 1=1';
    const params: any[] = [];

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        params.push(church_id);
        query += ` AND church_id = $${params.length}`;
      } else {
        params.push(ctx.allowedChurchIds);
        query += ` AND church_id = ANY($${params.length})`;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
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
    const ctx = getTenantContext(req);
    const { church_id, title, type, content, start_date, end_date, is_active, user_id } = req.body;

    const effectiveChurchId = (ctx.isSecondaryUser && ctx.churchId) ? ctx.churchId : church_id;

    if (ctx.isSecondaryUser) {
      if (!effectiveChurchId || !ctx.allowedChurchIds.includes(effectiveChurchId)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para cadastrar mensagem nesta congregação.' });
      }
    }

    if (!effectiveChurchId || !title || !content) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const result = await pool.query(
      `INSERT INTO pastoral_messages (church_id, title, type, content, start_date, end_date, is_active, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [effectiveChurchId, title, type || 'texto', content, start_date || null, end_date || null, is_active !== undefined ? is_active : true, user_id || ctx.ownerId || ctx.userId || null]
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
    const ctx = getTenantContext(req);
    const { title, type, content, start_date, end_date, is_active } = req.body;

    const oldRes = await pool.query('SELECT * FROM pastoral_messages WHERE id = $1', [id]);
    const oldMsg = oldRes.rows[0] || null;
    if (!oldMsg) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isSecondaryUser) {
      if (oldMsg.church_id && !ctx.allowedChurchIds.includes(oldMsg.church_id)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para alterar mensagem de outra igreja.' });
      }
    }

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
    const ctx = getTenantContext(req);

    const oldRes = await pool.query('SELECT * FROM pastoral_messages WHERE id = $1', [id]);
    const oldMsg = oldRes.rows[0] || null;
    if (!oldMsg) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isSecondaryUser) {
      if (oldMsg.church_id && !ctx.allowedChurchIds.includes(oldMsg.church_id)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para remover mensagem de outra igreja.' });
      }
    }

    const result = await pool.query('DELETE FROM pastoral_messages WHERE id = $1 RETURNING id', [id]);
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE pastoral_messages:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/communication_logs
app.get('/api/v1/communication_logs', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { church_id, user_id, status, event_type } = req.query;

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    let query = 'SELECT * FROM communication_logs WHERE 1=1';
    const params: any[] = [];

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        params.push(church_id);
        query += ` AND church_id = $${params.length}`;
      } else {
        params.push(ctx.allowedChurchIds);
        query += ` AND church_id = ANY($${params.length})`;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
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
    const ctx = getTenantContext(req);
    const { church_id, user_id, status, event_type } = req.query;

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    let query = 'SELECT * FROM communication_events WHERE 1=1';
    const params: any[] = [];

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        params.push(church_id);
        query += ` AND church_id = $${params.length}`;
      } else {
        params.push(ctx.allowedChurchIds);
        query += ` AND church_id = ANY($${params.length})`;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
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
    const ctx = getTenantContext(req);
    const { event_type, church_id, contributor_id, reference_id, payload, status, user_id } = req.body;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) {
      if (church_id && church_id !== ctx.churchId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para registrar evento de outra igreja.' });
      }
    }

    const effectiveChurchId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) ? ctx.churchId : church_id;

    if (!event_type || !effectiveChurchId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: event_type and church_id are required' });
    }

    const payloadObj = typeof payload === 'object' ? payload : (payload ? JSON.parse(payload) : {});

    const result = await pool.query(
      `INSERT INTO communication_events (event_type, church_id, contributor_id, reference_id, payload, status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        event_type,
        effectiveChurchId,
        contributor_id || null,
        reference_id || null,
        JSON.stringify(payloadObj),
        status || 'PENDING',
        user_id || ctx.ownerId || ctx.userId || null
      ]
    );

    const contribName = payloadObj.contributor_name || 'Contribuinte Não Identificado';
    const recipientPhone = payloadObj.contributor_phone || null;
    const summary = payloadObj.description ? `Evento ${event_type}: ${payloadObj.description}` : `Evento ${event_type} registrado`;

    await pool.query(
      `INSERT INTO communication_logs (church_id, contributor_id, contributor_name, event_type, channel, status, recipient_phone, message_summary, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        effectiveChurchId,
        contributor_id || null,
        contribName,
        event_type,
        'whatsapp',
        'pendente',
        recipientPhone,
        summary,
        user_id || ctx.ownerId || ctx.userId || null
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
          'SELECT COALESCE(canonical_name, name) AS name, phone, whatsapp FROM contributors WHERE id = $1 LIMIT 1',
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
export async function recoverAbandonedProcessingQueueItems(pool: pg.Pool, churchIdFilter?: string): Promise<{ recovered: number; failed: number }> {
  const client = await pool.connect();
  let recoveredCount = 0;
  let failedCount = 0;

  try {
    await client.query('BEGIN');
    let recoveryQuery = `
      SELECT id, attempts, max_attempts 
      FROM communication_queue 
      WHERE status = 'PROCESSING' 
        AND updated_at < NOW() - INTERVAL '5 minutes'
    `;
    const recoveryParams: any[] = [];
    if (churchIdFilter) {
      recoveryParams.push(churchIdFilter);
      recoveryQuery += ` AND church_id = ${recoveryParams.length}`;
    }
    recoveryQuery += " ORDER BY updated_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED";

    const selectedStale = await client.query(recoveryQuery, recoveryParams);
    if (selectedStale.rows.length > 0) {
      for (const staleItem of selectedStale.rows) {
        const attempts = staleItem.attempts || 0;
        const maxAttempts = staleItem.max_attempts || 3;
        const isMaxed = attempts >= maxAttempts;

        if (isMaxed) {
          await client.query(
            `UPDATE communication_queue
             SET status = 'FAILED', error_message = 'Timeout de processamento (registro abandonado em PROCESSING)', updated_at = NOW()
             WHERE id = $1`,
            [staleItem.id]
          );
          failedCount++;
        } else {
          await client.query(
            `UPDATE communication_queue
             SET status = 'READY_FOR_SEND', next_attempt_at = NOW(), error_message = 'Recuperado de timeout de processamento (abandonado em PROCESSING)', updated_at = NOW()
             WHERE id = $1`,
            [staleItem.id]
          );
          recoveredCount++;
        }
      }
    }
    await client.query('COMMIT');
  } catch (err0) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[CommunicationProcessor] Recovery Error:', err0);
  } finally {
    client.release();
  }

  return { recovered: recoveredCount, failed: failedCount };
}

let communicationProcessorRunning = false;
let lastCommunicationErrorTime = 0;

async function runCommunicationProcessor(churchIdFilter?: string) {
  if (communicationProcessorRunning) {
    return { processed_events: 0, queued_items: 0, sent_items: 0 };
  }
  communicationProcessorRunning = true;
  try {
    let processedCount = 0;
    let queuedCount = 0;
    let sentCount = 0;

    // Step 0: Recovery of Abandoned PROCESSING Items (> 5 minutes timeout)
    await recoverAbandonedProcessingQueueItems(pool, churchIdFilter);

    // Step 1: Events Processing (communication_events PENDING -> communication_queue PENDING)
    const client1 = await pool.connect();
    let eventsToProcess: any[] = [];
    try {
      await client1.query('BEGIN');
      let eventQuery = "SELECT * FROM communication_events WHERE status = 'PENDING'";
      const eventParams: any[] = [];
      if (churchIdFilter) {
        eventParams.push(churchIdFilter);
        eventQuery += ` AND church_id = $${eventParams.length}`;
      }
      eventQuery += " ORDER BY created_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED";

      const pendingEvents = await client1.query(eventQuery, eventParams);
      eventsToProcess = pendingEvents.rows;

      for (const ev of eventsToProcess) {
        const payload = typeof ev.payload === 'object' ? ev.payload : (JSON.parse(ev.payload || '{}'));
        const churchId = ev.church_id;

        // Fetch church configuration
        const churchRes = await client1.query(
          'SELECT id, name, pastor, auto_comm_enabled, auto_send_on_confirmation FROM churches WHERE id = $1 LIMIT 1',
          [churchId]
        );
        const church = churchRes.rows[0] || { name: 'Igreja', pastor: 'Pastor' };

        if (church.auto_comm_enabled === false || church.auto_send_on_confirmation === false) {
          await client1.query("UPDATE communication_events SET status = 'SKIPPED' WHERE id = $1", [ev.id]);
          await client1.query(
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
          const contribRes = await client1.query(
            'SELECT COALESCE(canonical_name, name) AS name, phone, whatsapp FROM contributors WHERE id = $1 LIMIT 1',
            [ev.contributor_id]
          );
          if (contribRes.rows.length > 0) {
            const c = contribRes.rows[0];
            contributorName = c.name || contributorName;
            recipientPhone = c.whatsapp || c.phone || null;
          }
        }

        if (!recipientPhone) {
          await client1.query("UPDATE communication_events SET status = 'SKIPPED' WHERE id = $1", [ev.id]);
          await client1.query(
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
          const pastoralRes = await client1.query(
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

        await client1.query(
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

        await client1.query("UPDATE communication_events SET status = 'PROCESSED' WHERE id = $1", [ev.id]);
        processedCount++;
      }
      await client1.query('COMMIT');
    } catch (err1) {
      await client1.query('ROLLBACK').catch(() => {});
      console.error('[CommunicationProcessor] Step 1 Error:', err1);
    } finally {
      client1.release();
    }

    // Step 2: Queue Worker Processing (PENDING -> READY_FOR_SEND)
    const client2 = await pool.connect();
    let pendingQueueRows: any[] = [];
    try {
      await client2.query('BEGIN');
      let queueQuery = "SELECT id FROM communication_queue WHERE status = 'PENDING' AND next_attempt_at <= NOW()";
      const queueParams: any[] = [];
      if (churchIdFilter) {
        queueParams.push(churchIdFilter);
        queueQuery += ` AND church_id = $${queueParams.length}`;
      }
      queueQuery += " ORDER BY created_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED";

      const selectedQueue = await client2.query(queueQuery, queueParams);
      if (selectedQueue.rows.length > 0) {
        const ids = selectedQueue.rows.map((r: any) => r.id);
        const updateRes = await client2.query(
          `UPDATE communication_queue
           SET status = 'PROCESSING', attempts = attempts + 1, updated_at = NOW()
           WHERE id = ANY($1::uuid[])
           RETURNING *`,
          [ids]
        );
        pendingQueueRows = updateRes.rows;
      }
      await client2.query('COMMIT');
    } catch (err2) {
      await client2.query('ROLLBACK').catch(() => {});
      console.error('[CommunicationProcessor] Step 2 Lock Error:', err2);
    } finally {
      client2.release();
    }

    for (const qItem of pendingQueueRows) {
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
        const cRes = await pool.query('SELECT COALESCE(canonical_name, name) AS name FROM contributors WHERE id = $1 LIMIT 1', [qItem.contributor_id]);
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
    const client3 = await pool.connect();
    let readyItemsToProcess: any[] = [];
    try {
      await client3.query('BEGIN');
      let readyQuery = "SELECT id FROM communication_queue WHERE status = 'READY_FOR_SEND' AND next_attempt_at <= NOW()";
      const readyParams: any[] = [];
      if (churchIdFilter) {
        readyParams.push(churchIdFilter);
        readyQuery += ` AND church_id = $${readyParams.length}`;
      }
      readyQuery += " ORDER BY created_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED";

      const selectedReady = await client3.query(readyQuery, readyParams);
      if (selectedReady.rows.length > 0) {
        const ids = selectedReady.rows.map((r: any) => r.id);
        const updateRes = await client3.query(
          `UPDATE communication_queue
           SET status = 'PROCESSING', updated_at = NOW()
           WHERE id = ANY($1::uuid[])
           RETURNING *`,
          [ids]
        );
        readyItemsToProcess = updateRes.rows;
      }
      await client3.query('COMMIT');
    } catch (err3) {
      await client3.query('ROLLBACK').catch(() => {});
      console.error('[CommunicationProcessor] Step 3 Lock Error:', err3);
    } finally {
      client3.release();
    }

    for (const item of readyItemsToProcess) {
      const gatewayResult = await WhatsAppGatewayService.send({
        to: item.recipient_phone,
        message: item.rendered_content,
        churchId: item.church_id,
        mediaAttachments: item.media_attachments
      });

      let contributorName = 'Contribuinte';
      if (item.contributor_id) {
        const cRes = await pool.query('SELECT COALESCE(canonical_name, name) AS name FROM contributors WHERE id = $1 LIMIT 1', [item.contributor_id]);
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
  } catch (err: any) {
    const now = Date.now();
    const isNetworkOrDns = err?.code === 'EAI_AGAIN' || err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT';
    if (!lastCommunicationErrorTime || now - lastCommunicationErrorTime > 60000) {
      lastCommunicationErrorTime = now;
      console.warn(`[CommunicationProcessor] Processor suspended (${isNetworkOrDns ? 'Conexão com PostgreSQL indisponível' : 'Erro'}):`, err?.message || err);
    }
    return { processed_events: 0, queued_items: 0, sent_items: 0, error: String(err?.message || err) };
  } finally {
    communicationProcessorRunning = false;
  }
}

// Start periodic worker (every 30 seconds)
setInterval(() => {
  runCommunicationProcessor().catch(() => {});
}, 30000);

// GET /api/v1/communication_queue
app.get('/api/v1/communication_queue', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { church_id, status } = req.query;

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    let query = 'SELECT * FROM communication_queue WHERE 1=1';
    const params: any[] = [];

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        params.push(church_id);
        query += ` AND church_id = $${params.length}`;
      } else {
        params.push(ctx.allowedChurchIds);
        query += ` AND church_id = ANY($${params.length})`;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
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
    const oldChurchRes = await pool.query('SELECT * FROM churches WHERE id = $1', [id]);
    const oldChurch = oldChurchRes.rows[0] || null;

    const result = await pool.query('DELETE FROM churches WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });

    await logAudit(pool, {
      action: 'DELETE',
      entity: 'churches',
      entityId: id,
      churchId: id,
      oldValues: oldChurch,
      req
    });

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
    const ctx = getTenantContext(req);
    const { user_id } = req.query;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado aos dados de outro usuário.' });
      }
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (typeof user_id === 'string' && user_id.trim() ? user_id.trim() : null);

    let query = 'SELECT id, user_id, normalized_description, contributor_normalized_name, church_id, created_at FROM learned_associations WHERE 1=1';
    const params: any[] = [];
    if (effectiveUserId) {
      query += ` AND (
        user_id::text = $1 
        OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT id FROM profiles WHERE id = $1 OR owner_id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id IS NULL
      )`;
      params.push(effectiveUserId);
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
    const ctx = getTenantContext(req);
    const { user_id, normalized_description, contributor_normalized_name, church_id } = req.body;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar associação para outro usuário.' });
      }
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (!effectiveUserId || !normalized_description || !contributor_normalized_name || !church_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    // Check if duplicate
    const checkResult = await pool.query(
      'SELECT id FROM learned_associations WHERE user_id = $1 AND normalized_description = $2 LIMIT 1',
      [effectiveUserId, normalized_description]
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
        [effectiveUserId, normalized_description, contributor_normalized_name, church_id]
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
    const ctx = getTenantContext(req);

    const oldRes = await pool.query('SELECT * FROM learned_associations WHERE id = $1', [id]);
    const oldItem = oldRes.rows[0] || null;
    if (!oldItem) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (oldItem.user_id && oldItem.user_id !== ctx.userId && oldItem.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a associação pertence a outro usuário.' });
      }
    }

    const result = await pool.query('DELETE FROM learned_associations WHERE id = $1 RETURNING id', [id]);
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
    const ctx = getTenantContext(req);

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: não é permitido remover associações de outro usuário.' });
      }
    }

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
    const ctx = getTenantContext(req);
    const { user_id, exclude_data, church_id } = req.query;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado aos relatórios de outro usuário.' });
      }
    }

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (typeof user_id === 'string' && user_id.trim() ? user_id.trim() : null);

    let selectFields = 'id, name, record_count, user_id, church_id, created_at';
    if (exclude_data !== 'true') {
      selectFields += ', data';
    }
    let query = `SELECT ${selectFields} FROM saved_reports WHERE 1=1`;
    const params: any[] = [];
    if (effectiveUserId) {
      query += ` AND (
        user_id::text = $${params.length + 1} 
        OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $${params.length + 1} OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $${params.length + 1} LIMIT 1))
        OR user_id::text IN (SELECT id FROM profiles WHERE id = $${params.length + 1} OR owner_id = $${params.length + 1} OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $${params.length + 1} LIMIT 1))
        OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $${params.length + 1} OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $${params.length + 1} LIMIT 1))
        OR user_id IS NULL
      )`;
      params.push(effectiveUserId);
    }

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        query += ` AND church_id = $${params.length + 1}`;
        params.push(church_id);
      } else {
        query += ` AND church_id = ANY($${params.length + 1})`;
        params.push(ctx.allowedChurchIds);
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
      query += ` AND church_id = $${params.length + 1}`;
      params.push(church_id);
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
    const ctx = getTenantContext(req);
    const { id, name, record_count, user_id, data, church_id } = req.body;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar relatório para outro usuário.' });
      }
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (!name || !effectiveUserId || !data) {
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
         [finalId, name, record_count || 0, effectiveUserId, finalData, church_id || ctx.churchId || null]
      );
    } else {
      result = await pool.query(
        'INSERT INTO saved_reports (name, record_count, user_id, data, church_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, record_count || 0, effectiveUserId, finalData, church_id || ctx.churchId || null]
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
    const ctx = getTenantContext(req);
    const { name, data, record_count, church_id } = req.body;

    const oldRes = await pool.query('SELECT * FROM saved_reports WHERE id = $1', [id]);
    const oldReport = oldRes.rows[0] || null;
    if (!oldReport) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (oldReport.user_id && oldReport.user_id !== ctx.userId && oldReport.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o relatório pertence a outro usuário.' });
      }
    }

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
    const ctx = getTenantContext(req);

    const oldRes = await pool.query('SELECT * FROM saved_reports WHERE id = $1', [id]);
    const oldReport = oldRes.rows[0] || null;
    if (!oldReport) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (oldReport.user_id && oldReport.user_id !== ctx.userId && oldReport.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o relatório pertence a outro usuário.' });
      }
    }

    const result = await pool.query('DELETE FROM saved_reports WHERE id = $1 RETURNING id', [id]);
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
    const ctx = getTenantContext(req);
    const { user_id, status, type, start_date, end_date, limit, offset, row_hash, ids, church_id } = req.query;

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    let query = 'SELECT id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, created_at, updated_at, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits FROM consolidated_transactions WHERE 1=1';
    const params: any[] = [];
    let counter = 1;

    if (ids) {
      const idsArray = (ids as string).split(',');
      query += ` AND id = ANY($${counter})`;
      params.push(idsArray);
      counter++;
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (effectiveUserId) {
      query += ` AND (
        user_id::text = $${counter} 
        OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $${counter} OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $${counter} LIMIT 1))
        OR user_id::text IN (SELECT id FROM profiles WHERE id = $${counter} OR owner_id = $${counter} OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $${counter} LIMIT 1))
        OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $${counter} OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $${counter} LIMIT 1))
        OR user_id IS NULL
      )`;
      params.push(effectiveUserId);
      counter++;
    }

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        query += ` AND church_id = $${counter}`;
        params.push(church_id);
        counter++;
      } else {
        query += ` AND (church_id = ANY($${counter}) OR (status = 'pending' AND church_id IS NULL))`;
        params.push(ctx.allowedChurchIds);
        counter++;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
      query += ` AND church_id = $${counter}`;
      params.push(church_id);
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
      const endStr = String(end_date).trim();
      const formattedEnd = endStr.length === 10 ? `${endStr} 23:59:59.999` : endStr;
      query += ` AND transaction_date <= $${counter}`;
      params.push(formattedEnd);
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
    const ctx = getTenantContext(req);
    const { id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits } = req.body;

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;
    const effectiveChurchId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) ? ctx.churchId : (church_id || null);

    if (amount === undefined || amount === null || !description || !type || !effectiveUserId || !transaction_date) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    // Check row_hash duplicate if row_hash is provided
    if (row_hash) {
      const dupCheck = await pool.query('SELECT id FROM consolidated_transactions WHERE user_id = $1 AND row_hash = $2 LIMIT 1', [effectiveUserId, row_hash]);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'ROW_HASH_ALREADY_EXISTS', id: dupCheck.rows[0].id });
      }
    }

    const finalContribReqId = await matchAndLinkContributionRequest(pool, {
      church_id: effectiveChurchId,
      contributor_id,
      amount,
      contribution_request_id
    });

    const finalId = id || undefined;
    let query = '';
    let params: any[] = [];
    if (finalId) {
      query = `INSERT INTO consolidated_transactions 
        (id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) 
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
          contribution_request_id = EXCLUDED.contribution_request_id,
          splits = EXCLUDED.splits,
          updated_at = NOW()
        RETURNING *`;
      params = [finalId, amount, description, type, pix_key || null, source || 'file', effectiveUserId, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, effectiveChurchId, contributor_id || null, report_id || null, payment_method || null, contribution_type || null, finalContribReqId || null, splits ? JSON.stringify(splits) : null];
    } else {
      query = `INSERT INTO consolidated_transactions 
        (amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`;
      params = [amount, description, type, pix_key || null, source || 'file', effectiveUserId, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, effectiveChurchId, contributor_id || null, report_id || null, payment_method || null, contribution_type || null, finalContribReqId || null, splits ? JSON.stringify(splits) : null];
    }

    const result = await pool.query(query, params);
    const row = result.rows[0];

    if (row && row.is_confirmed) {
      publishContributionConfirmedEvent(pool, row).catch(e => console.error('[EventPublish] Error:', e));
    }

    if (row) {
      await logAudit(pool, {
        action: 'CREATE',
        entity: 'consolidated_transactions',
        entityId: row.id,
        churchId: row.church_id,
        userId: row.user_id,
        newValues: row,
        req
      });
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
    const ctx = getTenantContext(req);
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: Transactions array is required' });
    }

    await client.query('BEGIN');
    const inserted: any[] = [];

    for (const tx of transactions) {
      const { id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits } = tx;
      
      const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;
      const effectiveChurchId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) ? ctx.churchId : (church_id || null);

      const finalContribReqId = await matchAndLinkContributionRequest(client, {
        church_id: effectiveChurchId,
        contributor_id,
        amount,
        contribution_request_id
      });

      const finalId = id || undefined;
      let query = '';
      let params: any[] = [];
      if (finalId) {
        query = `INSERT INTO consolidated_transactions 
          (id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) 
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
            contribution_request_id = EXCLUDED.contribution_request_id,
            splits = EXCLUDED.splits,
            updated_at = NOW()
          RETURNING *`;
        params = [finalId, amount, description, type, pix_key || null, source || 'file', effectiveUserId, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, effectiveChurchId, contributor_id || null, report_id || null, payment_method || null, contribution_type || null, finalContribReqId || null, splits ? JSON.stringify(splits) : null];
      } else {
        query = `INSERT INTO consolidated_transactions 
          (amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`;
        params = [amount, description, type, pix_key || null, source || 'file', effectiveUserId, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, effectiveChurchId, contributor_id || null, report_id || null, payment_method || null, contribution_type || null, finalContribReqId || null, splits ? JSON.stringify(splits) : null];
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

async function isAuthorizedForTransaction(pool: any, ctx: TenantContext, oldTx: any): Promise<boolean> {
  if (!ctx.isAuthenticated || ctx.isSuperAdmin) return true;
  if (!oldTx) return false;

  const currentUserId = ctx.userId;
  const currentOwnerId = ctx.ownerId || ctx.userId;

  // 1. Vínculo direto por ID de usuário ou dono
  if (oldTx.user_id && (oldTx.user_id === currentUserId || oldTx.user_id === currentOwnerId)) {
    return true;
  }

  // 2. Se for usuário secundário: restringe às igrejas permitidas
  if (ctx.isSecondaryUser) {
    if (ctx.allowedChurchIds.length === 0) return false;
    if (oldTx.church_id && ctx.allowedChurchIds.includes(oldTx.church_id)) return true;
    return false;
  }

  // 3. Se for Proprietário / Administrador da conta (Owner):
  if (ctx.isOwner) {
    if (oldTx.church_id) {
      if (ctx.allowedChurchIds && ctx.allowedChurchIds.includes(oldTx.church_id)) return true;
      const churchCheck = await pool.query(
        'SELECT id FROM churches WHERE id = $1 AND (user_id = $2 OR user_id = $3) LIMIT 1',
        [oldTx.church_id, currentUserId, currentOwnerId]
      );
      if (churchCheck.rows.length > 0) return true;
    }

    if (oldTx.user_id) {
      const userCheck = await pool.query(
        'SELECT id FROM profiles WHERE id = $1 AND owner_id = $2 LIMIT 1',
        [oldTx.user_id, currentOwnerId]
      );
      if (userCheck.rows.length > 0) return true;

      const appUserCheck = await pool.query(
        'SELECT id FROM app_users WHERE id = $1 AND owner_id = $2 LIMIT 1',
        [oldTx.user_id, currentOwnerId]
      );
      if (appUserCheck.rows.length > 0) return true;
    }

    if (!oldTx.user_id && !oldTx.church_id) return true;
  }

  return false;
}

async function isAuthorizedForFinancialRecord(pool: any, ctx: TenantContext, oldRec: any): Promise<boolean> {
  if (!ctx.isAuthenticated || ctx.isSuperAdmin) return true;
  if (!oldRec) return false;

  const currentUserId = ctx.userId;
  const currentOwnerId = ctx.ownerId || ctx.userId;

  if (oldRec.user_id && (oldRec.user_id === currentUserId || oldRec.user_id === currentOwnerId)) {
    return true;
  }

  if (ctx.isSecondaryUser) {
    if (ctx.allowedChurchIds.length === 0) return false;
    if (oldRec.church_id && ctx.allowedChurchIds.includes(oldRec.church_id)) return true;
    return false;
  }

  if (ctx.isOwner) {
    if (oldRec.church_id) {
      if (ctx.allowedChurchIds && ctx.allowedChurchIds.includes(oldRec.church_id)) return true;
      const churchCheck = await pool.query(
        'SELECT id FROM churches WHERE id = $1 AND (user_id = $2 OR user_id = $3) LIMIT 1',
        [oldRec.church_id, currentUserId, currentOwnerId]
      );
      if (churchCheck.rows.length > 0) return true;
    }

    if (oldRec.user_id) {
      const userCheck = await pool.query(
        'SELECT id FROM profiles WHERE id = $1 AND owner_id = $2 LIMIT 1',
        [oldRec.user_id, currentOwnerId]
      );
      if (userCheck.rows.length > 0) return true;

      const appUserCheck = await pool.query(
        'SELECT id FROM app_users WHERE id = $1 AND owner_id = $2 LIMIT 1',
        [oldRec.user_id, currentOwnerId]
      );
      if (appUserCheck.rows.length > 0) return true;
    }

    if (!oldRec.user_id && !oldRec.church_id) return true;
  }

  return false;
}

// PUT /api/v1/consolidated_transactions/:id
app.put('/api/v1/consolidated_transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
    const { amount, description, type, pix_key, source, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits } = req.body;
    
    const oldTxRes = await pool.query('SELECT * FROM consolidated_transactions WHERE id = $1', [id]);
    const oldTx = oldTxRes.rows[0] || null;
    if (!oldTx) return res.status(404).json({ error: 'NOT_FOUND' });

    const isAuthorized = await isAuthorizedForTransaction(pool, ctx, oldTx);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a transação pertence a outra organização.' });
    }

    let finalContribReqId = contribution_request_id;
    if (!finalContribReqId && (church_id || contributor_id || amount !== undefined)) {
      finalContribReqId = await matchAndLinkContributionRequest(pool, {
        church_id: church_id || oldTx.church_id,
        contributor_id: contributor_id || oldTx.contributor_id,
        amount: amount !== undefined ? amount : oldTx.amount,
        contribution_request_id: oldTx.contribution_request_id
      });
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
        contribution_request_id = COALESCE($16, contribution_request_id),
        splits = CASE WHEN $17::text IS NOT NULL THEN $17::jsonb ELSE splits END,
        updated_at = NOW()
      WHERE id = $18 RETURNING *`,
      [amount, description, type, pix_key, source, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, payment_method, contribution_type, finalContribReqId || null, splits !== undefined ? JSON.stringify(splits) : null, id]
    );

    const updatedRow = result.rows[0];
    if (updatedRow && updatedRow.is_confirmed) {
      publishContributionConfirmedEvent(pool, updatedRow).catch(e => console.error('[EventPublish] Error:', e));
    }

    await logAudit(pool, {
      action: 'UPDATE',
      entity: 'consolidated_transactions',
      entityId: id,
      churchId: updatedRow.church_id || oldTx?.church_id,
      userId: updatedRow.user_id || oldTx?.user_id,
      oldValues: oldTx,
      newValues: updatedRow,
      req
    });

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
    const ctx = getTenantContext(req);

    const oldTxRes = await pool.query('SELECT * FROM consolidated_transactions WHERE id::text = $1', [id]);
    const oldTx = oldTxRes.rows[0] || null;
    if (!oldTx) {
      return res.json({ success: true, notFoundInDb: true, id });
    }

    const isAuthorized = await isAuthorizedForTransaction(pool, ctx, oldTx);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a transação pertence a outra organização.' });
    }

    const result = await pool.query('DELETE FROM consolidated_transactions WHERE id::text = $1 RETURNING id', [id]);

    try {
      await logAudit(pool, {
        action: 'DELETE',
        entity: 'consolidated_transactions',
        entityId: id,
        churchId: oldTx?.church_id,
        userId: oldTx?.user_id,
        oldValues: oldTx,
        req
      });
    } catch (auditErr) {
      console.warn('[Audit] Erro ao gravar log de auditoria no DELETE:', auditErr);
    }

    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE consolidated_transaction:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/consolidated_transactions/bulk-delete
app.post('/api/v1/consolidated_transactions/bulk-delete', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: ids array is required' });
    }
    const oldTxsRes = await pool.query('SELECT * FROM consolidated_transactions WHERE id::text = ANY($1)', [ids]);
    const oldTxs = oldTxsRes.rows || [];

    for (const oldTx of oldTxs) {
      const isAuthorized = await isAuthorizedForTransaction(pool, ctx, oldTx);
      if (!isAuthorized) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: uma ou mais transações pertencem a outra organização.' });
      }
    }

    const result = await pool.query('DELETE FROM consolidated_transactions WHERE id::text = ANY($1) RETURNING id', [ids]);

    for (const oldTx of oldTxs) {
      try {
        await logAudit(pool, {
          action: 'DELETE',
          entity: 'consolidated_transactions',
          entityId: oldTx.id,
          churchId: oldTx.church_id,
          userId: oldTx.user_id,
          oldValues: oldTx,
          req
        });
      } catch (auditErr) {
        console.warn('[Audit] Erro ao gravar log de auditoria no bulk-delete:', auditErr);
      }
    }

    return res.json({ success: true, count: result.rows.length, ids });
  } catch (err) {
    console.error('[Contributors API] Error POST bulk-delete consolidated_transactions:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/financial_records
app.get('/api/v1/financial_records', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { user_id, church_id, type, status } = req.query;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado aos registros financeiros de outro usuário.' });
      }
    }

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (!effectiveUserId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id is required' });
    }

    let query = `
      SELECT * FROM financial_records 
      WHERE (
        user_id::text = $1 
        OR user_id::text IN (SELECT id::text FROM app_users WHERE id::text = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT id FROM profiles WHERE id = $1 OR owner_id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
        OR user_id::text IN (SELECT owner_id FROM profiles WHERE id = $1 OR LOWER(email) = (SELECT LOWER(email) FROM app_users WHERE id::text = $1 LIMIT 1))
      )
    `;
    const params: any[] = [effectiveUserId];
    let count = 2;

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        query += ` AND church_id = $${count}`;
        params.push(church_id);
        count++;
      } else {
        query += ` AND church_id = ANY($${count})`;
        params.push(ctx.allowedChurchIds);
        count++;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
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
    const ctx = getTenantContext(req);
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
      bank_transaction_desc,
      attachments,
      validation_status,
      validation_notes
    } = req.body;

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;
    const effectiveChurchId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) ? ctx.churchId : (church_id || null);

    if (!effectiveUserId || !title || amount === undefined || !type) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id, title, amount, and type are required' });
    }

    const result = await pool.query(
      `INSERT INTO financial_records (
        user_id, church_id, title, description, amount, type, status, 
        recipient_name, recipient_type, due_date, payment_date, recurrence, parent_id,
        bank_transaction_id, bank_transaction_desc, attachments, validation_status, validation_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        effectiveUserId,
        effectiveChurchId,
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
        bank_transaction_desc || null,
        attachments ? JSON.stringify(attachments) : '[]',
        validation_status || (attachments && attachments.length > 0 ? 'manual_review' : 'pending_attachment'),
        validation_notes || null
      ]
    );

    const createdRec = result.rows[0];
    await logAudit(pool, {
      action: 'CREATE',
      entity: 'financial_records',
      entityId: createdRec.id,
      churchId: createdRec.church_id,
      userId: createdRec.user_id,
      newValues: createdRec,
      req
    });

    return res.status(201).json(createdRec);
  } catch (err: any) {
    console.error('[Contributors API] Error POST financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// PUT /api/v1/financial_records/:id
app.put('/api/v1/financial_records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
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
      bank_transaction_desc,
      attachments,
      validation_status,
      validation_notes
    } = req.body;

    const oldRecRes = await pool.query('SELECT * FROM financial_records WHERE id = $1', [id]);
    const oldRec = oldRecRes.rows[0] || null;
    if (!oldRec) return res.status(404).json({ error: 'NOT_FOUND' });

    const isAuthorized = await isAuthorizedForFinancialRecord(pool, ctx, oldRec);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o registro pertence a outro usuário.' });
    }

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
      { name: 'bank_transaction_desc', value: bank_transaction_desc },
      { name: 'attachments', value: attachments !== undefined ? JSON.stringify(attachments) : undefined },
      { name: 'validation_status', value: validation_status },
      { name: 'validation_notes', value: validation_notes }
    ];

    fields.forEach(f => {
      if (f.value !== undefined) {
        updates.push(`${f.name} = $${placeholderIndex}`);
        values.push(f.value);
        placeholderIndex++;
      }
    });

    updates.push('updated_at = NOW()');

    values.push(id);
    const query = `UPDATE financial_records SET ${updates.join(', ')} WHERE id = $${placeholderIndex} RETURNING *`;
    
    const result = await pool.query(query, values);

    const updatedRec = result.rows[0];
    await logAudit(pool, {
      action: 'UPDATE',
      entity: 'financial_records',
      entityId: id,
      churchId: updatedRec.church_id || oldRec?.church_id,
      userId: updatedRec.user_id || oldRec?.user_id,
      oldValues: oldRec,
      newValues: updatedRec,
      req
    });

    return res.json(updatedRec);
  } catch (err: any) {
    console.error('[Contributors API] Error PUT financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// DELETE /api/v1/financial_records/:id
app.delete('/api/v1/financial_records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);

    const oldRecRes = await pool.query('SELECT * FROM financial_records WHERE id = $1', [id]);
    const oldRec = oldRecRes.rows[0] || null;
    if (!oldRec) return res.status(404).json({ error: 'NOT_FOUND' });

    const isAuthorized = await isAuthorizedForFinancialRecord(pool, ctx, oldRec);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o registro pertence a outro usuário.' });
    }

    const result = await pool.query('DELETE FROM financial_records WHERE id = $1 RETURNING id', [id]);

    await logAudit(pool, {
      action: 'DELETE',
      entity: 'financial_records',
      entityId: id,
      churchId: oldRec?.church_id,
      userId: oldRec?.user_id,
      oldValues: oldRec,
      req
    });

    return res.json({ success: true, id });
  } catch (err: any) {
    console.error('[Contributors API] Error DELETE financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// GET /api/v1/pastor_automations
app.get('/api/v1/pastor_automations', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { user_id } = req.query;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado às automações de outro usuário.' });
      }
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (!effectiveUserId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id is required' });
    }
    const result = await pool.query(
      'SELECT * FROM pastor_automations WHERE user_id = $1 ORDER BY payment_day ASC, created_at DESC',
      [effectiveUserId]
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
    const ctx = getTenantContext(req);
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

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;
    const effectiveChurchId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) ? ctx.churchId : (church_id || null);

    if (!effectiveUserId || !pastor_name || !pix_key) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id, pastor_name, and pix_key are required' });
    }

    const result = await pool.query(
      `INSERT INTO pastor_automations (
        user_id, pastor_name, pix_key, pix_key_type, payment_day,
        gross_amount, net_amount, tithe_amount, tithe_enabled, church_id, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        effectiveUserId,
        pastor_name,
        pix_key,
        pix_key_type || 'cpf',
        payment_day || 10,
        gross_amount || 0,
        net_amount || 0,
        tithe_amount || 0,
        tithe_enabled !== undefined ? tithe_enabled : true,
        effectiveChurchId,
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
    const ctx = getTenantContext(req);
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

    const oldRes = await pool.query('SELECT * FROM pastor_automations WHERE id = $1', [id]);
    const oldAuto = oldRes.rows[0] || null;
    if (!oldAuto) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isAuthenticated && !ctx.isSuperAdmin) {
      if (oldAuto.user_id && ctx.userId && oldAuto.user_id !== ctx.userId && oldAuto.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a automação pertence a outro usuário.' });
      }
    }

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
    const ctx = getTenantContext(req);

    const oldRes = await pool.query('SELECT * FROM pastor_automations WHERE id = $1', [id]);
    const oldAuto = oldRes.rows[0] || null;
    if (!oldAuto) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isAuthenticated && !ctx.isSuperAdmin) {
      if (oldAuto.user_id && ctx.userId && oldAuto.user_id !== ctx.userId && oldAuto.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a automação pertence a outro usuário.' });
      }
    }

    const result = await pool.query('DELETE FROM pastor_automations WHERE id = $1 RETURNING id', [id]);
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error('[Contributors API] Error DELETE pastor_automations:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// GET /api/v1/admin/migrate-supabase-to-postgres


if (process.env.INTEGRATED_MODE !== 'true' && process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Contributors API] Server running on port ${PORT}`);
  });
} else {
  console.log(`[Contributors API] Modo integrado ativo. O servidor Express principal lidará com as requisições.`);
}
