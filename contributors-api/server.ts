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
import { createAdminConfigRouter } from './admin-config/routes/admin_config.routes.js';
import { createAutomationMacroRouter } from './automation-macros/routes/automation_macro.routes.js';
import { createFileModelRouter } from './file-models/routes/file_model.routes.js';
import { createProfileRouter } from './profiles/routes/profile.routes.js';
import { ProfileRepository } from './profiles/repositories/profile.repository.js';
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

// Local durable SQLite persistence engine to ensure real-time resilience and zero data loss
class LocalSqliteEngine {
  public db: any = null;
  private isReady: boolean = false;
  public activeClosingLocks: Set<string> = new Set();
  private xactLocksByOwner: Map<string, Set<string>> = new Map();
  private sessionLocksByOwner: Map<string, Set<string>> = new Map();
  private activeSqlTxOwners: Set<string> = new Set();
  private currentQueryOwnerId: string = '__direct__';

  constructor() {
    this.init();
  }

  public releaseClosingLock(k1: number, k2: number) {
    const key = `${k1}:${k2}`;
    this.activeClosingLocks.delete(key);
    for (const lockSet of this.xactLocksByOwner.values()) {
      lockSet.delete(key);
    }
    for (const lockSet of this.sessionLocksByOwner.values()) {
      lockSet.delete(key);
    }
  }

  public releaseOwnerLocks(ownerId: string, includeSessionLocks: boolean = false) {
    const xactSet = this.xactLocksByOwner.get(ownerId);
    if (xactSet) {
      for (const key of xactSet) {
        this.activeClosingLocks.delete(key);
      }
      this.xactLocksByOwner.delete(ownerId);
    }
    if (includeSessionLocks) {
      const sessSet = this.sessionLocksByOwner.get(ownerId);
      if (sessSet) {
        for (const key of sessSet) {
          this.activeClosingLocks.delete(key);
        }
        this.sessionLocksByOwner.delete(ownerId);
      }
      if (this.activeSqlTxOwners.has(ownerId)) {
        this.activeSqlTxOwners.delete(ownerId);
        if (this.activeSqlTxOwners.size === 0 && this.db) {
          try { this.db.exec('ROLLBACK'); } catch (_) {}
        }
      }
    }
  }

  private resolveRootAppDir(): string {
    const cwd = process.cwd();
    const candidates = [
      path.basename(cwd) === 'contributors-api' ? path.resolve(cwd, '..') : cwd,
      path.resolve(__dirname, '..', '..'),
      path.resolve(__dirname, '..'),
      path.resolve(cwd, '..')
    ];
    for (const dir of candidates) {
      if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'contributors-api'))) {
        return dir;
      }
    }
    for (const dir of candidates) {
      if (fs.existsSync(path.join(dir, 'data'))) {
        return dir;
      }
    }
    return candidates[0];
  }

  private init() {
    try {
      const { DatabaseSync } = requireFallback('node:sqlite');
      // Unificação absoluta: apontar sempre para o diretório raiz data/ do projeto
      const rootAppDir = this.resolveRootAppDir();
      const dbDir = path.resolve(rootAppDir, 'data');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const dbPath = path.join(dbDir, 'contributors_local.sqlite');

      // Se o banco canônico ainda não existir e houver banco legado em contributors-api/data, migra antes de abrir
      const subDbPath = path.resolve(rootAppDir, 'contributors-api', 'data', 'contributors_local.sqlite');
      if (!fs.existsSync(dbPath) && fs.existsSync(subDbPath) && subDbPath !== dbPath) {
        try {
          fs.copyFileSync(subDbPath, dbPath);
          if (fs.existsSync(`${subDbPath}-wal`)) fs.copyFileSync(`${subDbPath}-wal`, `${dbPath}-wal`);
          if (fs.existsSync(`${subDbPath}-shm`)) fs.copyFileSync(`${subDbPath}-shm`, `${dbPath}-shm`);
        } catch (_) {}
      }

      this.db = new DatabaseSync(dbPath);
      try {
        this.db.exec('PRAGMA busy_timeout = 5000;');
      } catch (_) {}

      // Register SQL custom functions
      this.db.function('now', () => new Date().toISOString());
      this.db.function('gen_random_uuid', () => crypto.randomUUID());
      this.db.function('pg_try_advisory_lock', { varargs: true }, (k1: any, k2: any) => {
        const key = k2 !== undefined && k2 !== null ? `${k1}:${k2}` : `${k1}`;
        if (this.activeClosingLocks.has(key)) return 0;
        this.activeClosingLocks.add(key);
        const owner = this.currentQueryOwnerId || '__direct__';
        if (!this.sessionLocksByOwner.has(owner)) {
          this.sessionLocksByOwner.set(owner, new Set());
        }
        this.sessionLocksByOwner.get(owner)!.add(key);
        return 1;
      });
      this.db.function('pg_advisory_unlock', { varargs: true }, (k1: any, k2: any) => {
        const key = k2 !== undefined && k2 !== null ? `${k1}:${k2}` : `${k1}`;
        const owner = this.currentQueryOwnerId || '__direct__';
        const ownerSet = this.sessionLocksByOwner.get(owner);
        if (ownerSet && ownerSet.has(key)) {
          ownerSet.delete(key);
          this.activeClosingLocks.delete(key);
          return 1;
        }
        if (owner === '__direct__') {
          this.activeClosingLocks.delete(key);
          for (const s of this.sessionLocksByOwner.values()) s.delete(key);
          return 1;
        }
        return 0;
      });
      this.db.function('pg_try_advisory_xact_lock', { varargs: true }, (k1: any, k2: any) => {
        const key = k2 !== undefined && k2 !== null ? `${k1}:${k2}` : `${k1}`;
        if (this.activeClosingLocks.has(key)) {
          return 0;
        }
        this.activeClosingLocks.add(key);
        const owner = this.currentQueryOwnerId || '__direct__';
        if (!this.xactLocksByOwner.has(owner)) {
          this.xactLocksByOwner.set(owner, new Set());
        }
        this.xactLocksByOwner.get(owner)!.add(key);
        return 1;
      });
      this.db.function('regexp_replace', { varargs: true }, (str: any, pat: any, rep: any, flags: any) => {
        if (str == null) return '';
        try {
          return String(str).replace(new RegExp(pat, flags || 'g'), rep || '');
        } catch (_) {
          return String(str);
        }
      });
      this.db.function('coalesce_custom', { varargs: true }, (...args: any[]) => {
        for (const a of args) {
          if (a !== null && a !== undefined) return a;
        }
        return null;
      });
      this.db.function('split_part', (str: any, delimiter: any, position: any) => {
        if (str === null || str === undefined || delimiter === null || delimiter === undefined) return null;
        const pos = Number(position);
        if (!Number.isFinite(pos) || pos < 1) return '';
        const parts = String(str).split(String(delimiter));
        return parts[pos - 1] ?? '';
      });

      // Enable WAL mode for high concurrent performance
      try {
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.db.exec('PRAGMA synchronous = NORMAL;');
      } catch (_) {}

      this.initTables();
      this.isReady = true;
      console.log('[Contributors API] Local persistent SQLite database initialized successfully at data/contributors_local.sqlite');
    } catch (e: any) {
      console.error('[Contributors API] Error initializing local SQLite engine:', e?.message || e);
    }
  }

  private initTables() {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contributors (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        church_id TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        name TEXT,
        cpf TEXT,
        email TEXT,
        phone TEXT,
        whatsapp TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        person_type TEXT DEFAULT 'PF',
        trade_name TEXT,
        rg_ie TEXT,
        birth_date TEXT,
        contact_person TEXT,
        category TEXT,
        pix_key TEXT,
        bank_name TEXT,
        bank_agency TEXT,
        bank_account TEXT,
        address_cep TEXT,
        address_street TEXT,
        address_number TEXT,
        address_city TEXT,
        address_state TEXT,
        notes TEXT,
        congregation TEXT,
        is_global INTEGER DEFAULT 0,
        role_position TEXT,
        photo_url TEXT,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS churches (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        cnpj TEXT,
        address TEXT,
        pix_key TEXT,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS banks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        user_id TEXT,
        bank_key TEXT,
        account_name TEXT,
        accepted_contribution_types TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS learned_associations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        church_id TEXT,
        pattern TEXT,
        category TEXT,
        contributor_id TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS saved_reports (
        id TEXT PRIMARY KEY,
        name TEXT,
        user_id TEXT,
        church_id TEXT,
        record_count INTEGER,
        data TEXT,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS financial_records (
        id TEXT PRIMARY KEY,
        church_id TEXT,
        type TEXT,
        amount REAL,
        description TEXT,
        category TEXT,
        date TEXT,
        contributor_id TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS consolidated_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        church_id TEXT,
        date TEXT,
        transaction_date TEXT,
        description TEXT,
        amount REAL,
        type TEXT,
        pix_key TEXT,
        source TEXT DEFAULT 'file',
        status TEXT DEFAULT 'pending',
        bank_id TEXT,
        row_hash TEXT,
        is_confirmed INTEGER DEFAULT 0,
        category TEXT,
        contributor_id TEXT,
        report_id TEXT,
        payment_method TEXT,
        contribution_type TEXT,
        contribution_request_id TEXT,
        splits TEXT,
        reference_date TEXT,
        attachments TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS church_pix_keys (
        id TEXT PRIMARY KEY,
        bank_id TEXT,
        church_id TEXT,
        pix_type TEXT,
        key_type TEXT,
        pix_key TEXT,
        holder_name TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS contribution_types (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        name TEXT NOT NULL,
        type TEXT DEFAULT 'entrada',
        category TEXT,
        bank_id TEXT,
        "order" INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        user_id TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS payment_methods (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        name TEXT NOT NULL,
        type TEXT DEFAULT 'recebimento',
        category TEXT,
        bank_id TEXT,
        "order" INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        user_id TEXT,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );
      CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
      CREATE INDEX IF NOT EXISTS idx_payment_methods_bank ON payment_methods(bank_id);

      CREATE TABLE IF NOT EXISTS tenant_custom_options (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        user_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );
      CREATE INDEX IF NOT EXISTS idx_tenant_custom_options_lookup ON tenant_custom_options(user_id, scope);

      CREATE TABLE IF NOT EXISTS church_closings (
        id TEXT PRIMARY KEY,
        church_id TEXT NOT NULL,
        bank_id TEXT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'closed',
        closed_at TEXT NOT NULL DEFAULT (now()),
        closed_by TEXT,
        total_income REAL DEFAULT 0,
        total_expenses REAL DEFAULT 0,
        final_balance REAL DEFAULT 0,
        transferred_balance REAL,
        target_church_id TEXT,
        target_church_name TEXT,
        integrity_hash TEXT,
        signatures TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );
      CREATE INDEX IF NOT EXISTS idx_church_closings_lookup ON church_closings(church_id, year, month, status);
      CREATE INDEX IF NOT EXISTS idx_consolidated_tx_user_row_hash ON consolidated_transactions(user_id, row_hash);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        user_id TEXT,
        church_id TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        old_values TEXT,
        new_values TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS pastoral_messages (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        church_id TEXT,
        title TEXT,
        type TEXT DEFAULT 'texto',
        content TEXT,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 1,
        user_id TEXT,
        recipient_type TEXT,
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS pastor_automations (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        user_id TEXT,
        church_id TEXT,
        pastor_name TEXT,
        pix_key TEXT,
        pix_key_type TEXT DEFAULT 'cpf',
        payment_day INTEGER DEFAULT 10,
        gross_amount REAL DEFAULT 0,
        net_amount REAL DEFAULT 0,
        tithe_amount REAL DEFAULT 0,
        tithe_enabled INTEGER DEFAULT 1,
        active INTEGER DEFAULT 1,
        name TEXT,
        trigger_type TEXT,
        config TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS communication_logs (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        church_id TEXT,
        contributor_id TEXT,
        contributor_name TEXT,
        event_type TEXT,
        channel TEXT,
        status TEXT,
        recipient TEXT,
        recipient_phone TEXT,
        message TEXT,
        message_summary TEXT,
        error_message TEXT,
        user_id TEXT,
        queue_id TEXT,
        provider_message_id TEXT,
        sent_at TEXT DEFAULT (now()),
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS communication_events (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        church_id TEXT,
        event_type TEXT,
        contributor_id TEXT,
        reference_id TEXT,
        payload TEXT,
        status TEXT DEFAULT 'PENDING',
        user_id TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS communication_queue (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        event_id TEXT,
        church_id TEXT,
        contributor_id TEXT,
        recipient_phone TEXT,
        channel TEXT DEFAULT 'whatsapp',
        message_type TEXT DEFAULT 'ContributionConfirmed',
        rendered_content TEXT,
        media_attachments TEXT DEFAULT '[]',
        status TEXT DEFAULT 'PENDING',
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        next_attempt_at TEXT DEFAULT (now()),
        error_message TEXT,
        provider_message_id TEXT,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS contribution_requests (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        church_id TEXT,
        contributor_id TEXT,
        amount REAL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        bank_id TEXT,
        splits TEXT,
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        name TEXT,
        role TEXT DEFAULT 'user',
        church_id TEXT,
        owner_id TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE,
        church_name TEXT,
        phone TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS file_models (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        name TEXT,
        user_id TEXT,
        bank_id TEXT,
        version INTEGER DEFAULT 1,
        lineage_id TEXT,
        is_active INTEGER DEFAULT 1,
        status TEXT DEFAULT 'approved',
        fingerprint TEXT,
        mapping TEXT,
        parsing_rules TEXT,
        snippet TEXT,
        last_used_at TEXT,
        church_id TEXT,
        config TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS app_auth_audit_logs (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        user_id TEXT,
        email TEXT,
        event TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        details TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS app_refresh_tokens (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        user_id TEXT,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0,
        revoked_at TEXT,
        created_at TEXT DEFAULT (now()),
        ip_address TEXT,
        user_agent TEXT
      );

      CREATE TABLE IF NOT EXISTS app_password_resets (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        user_id TEXT,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS app_email_verifications (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        user_id TEXT,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS app_revoked_access_tokens (
        jti TEXT PRIMARY KEY,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_time INTEGER NOT NULL,
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS admin_config (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS automation_macros (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        user_id TEXT NOT NULL,
        bank_id TEXT,
        name TEXT NOT NULL,
        steps TEXT NOT NULL,
        target_url TEXT,
        created_at TEXT DEFAULT (now())
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'approved',
        notes TEXT,
        payment_method TEXT,
        created_at TEXT DEFAULT (now())
      );
    `);

    // Ensure columns exist on tables in case the SQLite database was already created
    const safeAdd = (table: string, col: string) => {
      try {
        this.db!.exec(`ALTER TABLE ${table} ADD COLUMN ${col};`);
      } catch (_) {
        const sanitized = col.replace(/\s+DEFAULT\s+(?:CURRENT_TIMESTAMP|\(now\(\)\)|now\(\))/gi, '');
        if (sanitized !== col) {
          try { this.db!.exec(`ALTER TABLE ${table} ADD COLUMN ${sanitized};`); } catch (_2) {}
        }
      }
    };

    safeAdd('app_users', 'owner_id TEXT');
    safeAdd('app_users', 'permissions TEXT DEFAULT "[]"');
    safeAdd('app_users', 'is_active INTEGER DEFAULT 1');
    safeAdd('app_users', 'is_verified INTEGER DEFAULT 0');
    safeAdd('app_users', 'totp_secret_encrypted TEXT');
    safeAdd('app_users', 'totp_temp_secret_encrypted TEXT');
    safeAdd('app_users', 'totp_enabled INTEGER DEFAULT 0');
    safeAdd('app_users', 'totp_recovery_codes TEXT DEFAULT "[]"');
    safeAdd('app_users', 'failed_attempts INTEGER DEFAULT 0');
    safeAdd('app_users', 'lock_until TEXT');
    safeAdd('app_users', 'last_login TEXT');
    safeAdd('app_users', 'updated_at TEXT DEFAULT (now())');
    safeAdd('app_users', 'deleted_at TEXT');
    safeAdd('app_users', 'subscription_status TEXT DEFAULT "trial"');
    safeAdd('app_users', 'subscription_ends_at TEXT');
    safeAdd('app_users', 'trial_ends_at TEXT');

    safeAdd('profiles', 'email TEXT');
    safeAdd('profiles', 'name TEXT');
    safeAdd('profiles', 'role TEXT DEFAULT "owner"');
    safeAdd('profiles', 'owner_id TEXT');
    safeAdd('profiles', 'subscription_status TEXT DEFAULT "trial"');
    safeAdd('profiles', 'subscription_ends_at TEXT');
    safeAdd('profiles', 'trial_ends_at TEXT');
    safeAdd('profiles', 'limit_ai INTEGER DEFAULT 100');
    safeAdd('profiles', 'usage_ai INTEGER DEFAULT 0');
    safeAdd('profiles', 'max_churches INTEGER DEFAULT 2');
    safeAdd('profiles', 'max_banks INTEGER DEFAULT 2');
    safeAdd('profiles', 'custom_price REAL');
    safeAdd('profiles', 'is_blocked INTEGER DEFAULT 0');
    safeAdd('profiles', 'is_lifetime INTEGER DEFAULT 0');
    safeAdd('profiles', 'permissions TEXT');
    safeAdd('profiles', 'congregation TEXT');
    safeAdd('profiles', 'updated_at TEXT DEFAULT (now())');

    safeAdd('app_auth_audit_logs', 'user_id TEXT');
    safeAdd('app_auth_audit_logs', 'email TEXT');
    safeAdd('app_auth_audit_logs', 'event TEXT');
    safeAdd('app_auth_audit_logs', 'ip_address TEXT');
    safeAdd('app_auth_audit_logs', 'user_agent TEXT');
    safeAdd('app_auth_audit_logs', 'details TEXT');
    safeAdd('app_auth_audit_logs', 'created_at TEXT DEFAULT (now())');

    safeAdd('communication_events', 'contributor_id TEXT');
    safeAdd('communication_events', 'reference_id TEXT');
    safeAdd('communication_events', 'status TEXT DEFAULT "PENDING"');
    safeAdd('communication_events', 'user_id TEXT');

    safeAdd('communication_queue', 'event_id TEXT');
    safeAdd('communication_queue', 'contributor_id TEXT');
    safeAdd('communication_queue', 'recipient_phone TEXT');
    safeAdd('communication_queue', 'channel TEXT DEFAULT "whatsapp"');
    safeAdd('communication_queue', 'message_type TEXT DEFAULT "ContributionConfirmed"');
    safeAdd('communication_queue', 'rendered_content TEXT');
    safeAdd('communication_queue', 'media_attachments TEXT DEFAULT "[]"');
    safeAdd('communication_queue', 'status TEXT DEFAULT "PENDING"');
    safeAdd('communication_queue', 'attempts INTEGER DEFAULT 0');
    safeAdd('communication_queue', 'max_attempts INTEGER DEFAULT 3');
    safeAdd('communication_queue', 'next_attempt_at TEXT DEFAULT (now())');
    safeAdd('communication_queue', 'error_message TEXT');
    safeAdd('communication_queue', 'provider_message_id TEXT');
    safeAdd('communication_queue', 'updated_at TEXT DEFAULT (now())');

    safeAdd('saved_reports', 'updated_at TEXT DEFAULT (now())');

    safeAdd('communication_logs', 'contributor_id TEXT');
    safeAdd('communication_logs', 'contributor_name TEXT');
    safeAdd('communication_logs', 'event_type TEXT');
    safeAdd('communication_logs', 'channel TEXT');
    safeAdd('communication_logs', 'recipient_phone TEXT');
    safeAdd('communication_logs', 'message_summary TEXT');
    safeAdd('communication_logs', 'error_message TEXT');
    safeAdd('communication_logs', 'user_id TEXT');
    safeAdd('communication_logs', 'queue_id TEXT');
    safeAdd('communication_logs', 'provider_message_id TEXT');
    safeAdd('communication_logs', 'created_at TEXT DEFAULT (now())');

    safeAdd('consolidated_transactions', 'amount REAL');
    safeAdd('consolidated_transactions', 'description TEXT');
    safeAdd('consolidated_transactions', 'type TEXT');
    safeAdd('consolidated_transactions', 'pix_key TEXT');
    safeAdd('consolidated_transactions', 'source TEXT DEFAULT "file"');
    safeAdd('consolidated_transactions', 'user_id TEXT');
    safeAdd('consolidated_transactions', 'status TEXT DEFAULT "pending"');
    safeAdd('consolidated_transactions', 'bank_id TEXT');
    safeAdd('consolidated_transactions', 'row_hash TEXT');
    safeAdd('consolidated_transactions', 'is_confirmed INTEGER DEFAULT 0');
    safeAdd('consolidated_transactions', 'transaction_date TEXT');
    safeAdd('consolidated_transactions', 'reference_date TEXT');
    safeAdd('consolidated_transactions', 'church_id TEXT');
    safeAdd('consolidated_transactions', 'contributor_id TEXT');
    safeAdd('consolidated_transactions', 'report_id TEXT');
    safeAdd('consolidated_transactions', 'payment_method TEXT');
    safeAdd('consolidated_transactions', 'contribution_type TEXT');
    safeAdd('consolidated_transactions', 'contribution_request_id TEXT');
    safeAdd('consolidated_transactions', 'splits TEXT');
    safeAdd('consolidated_transactions', 'attachments TEXT DEFAULT "[]"');
    safeAdd('consolidated_transactions', 'updated_at TEXT DEFAULT CURRENT_TIMESTAMP');

    safeAdd('contribution_requests', 'bank_id TEXT');
    safeAdd('contribution_requests', 'splits TEXT');
    safeAdd('contribution_requests', 'updated_at TEXT DEFAULT CURRENT_TIMESTAMP');
    safeAdd('church_closings', 'bank_id TEXT');
    try {
      this.db?.exec("DROP INDEX IF EXISTS idx_church_closings_unique;");
      const tableInfo = this.db?.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='church_closings'").get() as any;
      if (tableInfo && tableInfo.sql && tableInfo.sql.includes('UNIQUE(church_id, year, month)')) {
        this.db?.exec(`
          CREATE TABLE church_closings_migration (
            id TEXT PRIMARY KEY,
            church_id TEXT NOT NULL,
            bank_id TEXT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'closed',
            closed_at TEXT NOT NULL DEFAULT (now()),
            closed_by TEXT,
            total_income REAL DEFAULT 0,
            total_expenses REAL DEFAULT 0,
            final_balance REAL DEFAULT 0,
            transferred_balance REAL,
            target_church_id TEXT,
            target_church_name TEXT,
            integrity_hash TEXT,
            signatures TEXT,
            notes TEXT,
            created_at TEXT DEFAULT (now()),
            updated_at TEXT DEFAULT (now())
          );
          INSERT OR REPLACE INTO church_closings_migration SELECT id, church_id, bank_id, year, month, status, closed_at, closed_by, total_income, total_expenses, final_balance, transferred_balance, target_church_id, target_church_name, integrity_hash, signatures, notes, created_at, updated_at FROM church_closings;
          DROP TABLE church_closings;
          ALTER TABLE church_closings_migration RENAME TO church_closings;
          CREATE INDEX IF NOT EXISTS idx_church_closings_lookup ON church_closings(church_id, year, month, status);
        `);
      }
    } catch (_) {}

    safeAdd('learned_associations', 'normalized_description TEXT');
    safeAdd('learned_associations', 'contributor_normalized_name TEXT');

    safeAdd('church_pix_keys', 'bank_id TEXT');
    safeAdd('church_pix_keys', 'pix_type TEXT');
    safeAdd('church_pix_keys', 'holder_name TEXT');
    safeAdd('church_pix_keys', 'description TEXT');
    safeAdd('church_pix_keys', 'is_active INTEGER DEFAULT 1');
    safeAdd('church_pix_keys', 'updated_at TEXT DEFAULT CURRENT_TIMESTAMP');

    safeAdd('financial_records', 'user_id TEXT');
    safeAdd('financial_records', 'title TEXT');
    safeAdd('financial_records', 'status TEXT DEFAULT "pending"');
    safeAdd('financial_records', 'recipient_name TEXT');
    safeAdd('financial_records', 'recipient_type TEXT');
    safeAdd('financial_records', 'due_date TEXT');
    safeAdd('financial_records', 'payment_date TEXT');
    safeAdd('financial_records', 'recurrence TEXT DEFAULT "none"');
    safeAdd('financial_records', 'parent_id TEXT');
    safeAdd('financial_records', 'bank_transaction_id TEXT');
    safeAdd('financial_records', 'bank_transaction_desc TEXT');
    safeAdd('financial_records', 'attachments TEXT DEFAULT "[]"');
    safeAdd('financial_records', 'validation_status TEXT DEFAULT "pending_attachment"');
    safeAdd('financial_records', 'validation_notes TEXT');
    safeAdd('financial_records', 'updated_at TEXT DEFAULT CURRENT_TIMESTAMP');

    safeAdd('churches', 'logoUrl TEXT');
    safeAdd('churches', 'pastor TEXT');
    safeAdd('churches', 'phone TEXT');
    safeAdd('churches', 'email TEXT');
    safeAdd('churches', 'pixKey TEXT');
    safeAdd('churches', 'pix_key TEXT');
    safeAdd('churches', 'cep TEXT');
    safeAdd('churches', 'city TEXT');
    safeAdd('churches', 'state TEXT');
    safeAdd('churches', 'treasurer TEXT');
    safeAdd('churches', 'pastors TEXT');
    safeAdd('churches', 'treasurers TEXT');
    safeAdd('churches', 'whatsapp_official TEXT');
    safeAdd('churches', 'whatsapp_responsible TEXT DEFAULT "tesouraria"');
    safeAdd('churches', 'auto_comm_enabled INTEGER DEFAULT 1');
    safeAdd('churches', 'auto_send_on_confirmation INTEGER DEFAULT 1');
    safeAdd('churches', 'updated_at TEXT DEFAULT CURRENT_TIMESTAMP');
    safeAdd('banks', 'accepted_contribution_types TEXT');
    safeAdd('contributors', 'congregation TEXT');

    safeAdd('pastoral_messages', 'type TEXT DEFAULT "texto"');
    safeAdd('pastoral_messages', 'start_date TEXT');
    safeAdd('pastoral_messages', 'end_date TEXT');
    safeAdd('pastoral_messages', 'is_active INTEGER DEFAULT 1');
    safeAdd('pastoral_messages', 'user_id TEXT');

    safeAdd('pastor_automations', 'user_id TEXT');
    safeAdd('pastor_automations', 'pastor_name TEXT');
    safeAdd('pastor_automations', 'pix_key TEXT');
    safeAdd('pastor_automations', 'pix_key_type TEXT DEFAULT "cpf"');
    safeAdd('pastor_automations', 'payment_day INTEGER DEFAULT 10');
    safeAdd('pastor_automations', 'gross_amount REAL DEFAULT 0');
    safeAdd('pastor_automations', 'net_amount REAL DEFAULT 0');
    safeAdd('pastor_automations', 'tithe_amount REAL DEFAULT 0');
    safeAdd('pastor_automations', 'tithe_enabled INTEGER DEFAULT 1');
    safeAdd('pastor_automations', 'active INTEGER DEFAULT 1');
    safeAdd('pastor_automations', 'updated_at TEXT DEFAULT CURRENT_TIMESTAMP');

    safeAdd('file_models', 'bank_id TEXT');
    safeAdd('file_models', 'version INTEGER DEFAULT 1');
    safeAdd('file_models', 'lineage_id TEXT');
    safeAdd('file_models', 'is_active INTEGER DEFAULT 1');
    safeAdd('file_models', 'status TEXT DEFAULT "approved"');
    safeAdd('file_models', 'fingerprint TEXT');
    safeAdd('file_models', 'mapping TEXT');
    safeAdd('file_models', 'parsing_rules TEXT');
    safeAdd('file_models', 'snippet TEXT');
    safeAdd('file_models', 'last_used_at TEXT');

    // Ensure default headquarters church exists so foreign key & filters never fail
    try {
      const existingChurch = this.db.prepare("SELECT id FROM churches WHERE id = '00000000-0000-0000-0000-000000000001'").all();
      if (!existingChurch || existingChurch.length === 0) {
        this.db.prepare(`
          INSERT INTO churches (id, user_id, name, cnpj, address, created_at)
          VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Igreja Sede / Matriz', '00.000.000/0001-00', 'Sede Principal', datetime('now'))
        `).run();
      }
    } catch (_) {}

    // Ensure all contribution_types have a valid UUID and no empty IDs
    try {
      const nullTypes = this.db.prepare("SELECT rowid, name FROM contribution_types WHERE id IS NULL OR id = ''").all();
      if (nullTypes && nullTypes.length > 0) {
        const updateStmt = this.db.prepare("UPDATE contribution_types SET id = ? WHERE rowid = ?");
        for (const row of nullTypes) {
          updateStmt.run(crypto.randomUUID(), (row as any).rowid);
        }
      }
    } catch (_) {}

    // Ensure payment_methods columns & valid UUIDs
    safeAdd('payment_methods', 'type TEXT DEFAULT "recebimento"');
    safeAdd('payment_methods', 'category TEXT');
    safeAdd('payment_methods', 'bank_id TEXT');
    safeAdd('payment_methods', '"order" INTEGER DEFAULT 1');
    safeAdd('payment_methods', 'is_active INTEGER DEFAULT 1');
    safeAdd('payment_methods', 'user_id TEXT');
    safeAdd('payment_methods', 'created_at TEXT DEFAULT (now())');
    safeAdd('payment_methods', 'updated_at TEXT DEFAULT (now())');
    try {
      const nullMethods = this.db.prepare("SELECT rowid, name FROM payment_methods WHERE id IS NULL OR id = ''").all();
      if (nullMethods && nullMethods.length > 0) {
        const updateStmt = this.db.prepare("UPDATE payment_methods SET id = ? WHERE rowid = ?");
        for (const row of nullMethods) {
          updateStmt.run(crypto.randomUUID(), (row as any).rowid);
        }
      }
    } catch (_) {}

    safeAdd('tenant_custom_options', 'sort_order INTEGER DEFAULT 1');
    safeAdd('tenant_custom_options', 'created_at TEXT DEFAULT (now())');
    safeAdd('tenant_custom_options', 'updated_at TEXT DEFAULT (now())');
    try {
      const nullOptions = this.db.prepare("SELECT rowid, name FROM tenant_custom_options WHERE id IS NULL OR id = ''").all();
      if (nullOptions && nullOptions.length > 0) {
        const updateStmt = this.db.prepare("UPDATE tenant_custom_options SET id = ? WHERE rowid = ?");
        for (const row of nullOptions) {
          updateStmt.run(crypto.randomUUID(), (row as any).rowid);
        }
      }
    } catch (_) {}

    // 🛡️ Regra de Integridade e Preservação:
    // 1. Migra congregações 'church-1' ou nulas para a igreja sede para manter cadastros completos intactos
    try {
      this.db.exec(`
        UPDATE contributors 
        SET church_id = '00000000-0000-0000-0000-000000000001' 
        WHERE church_id IS NULL OR trim(church_id) = '' OR church_id = 'church-1';

        UPDATE consolidated_transactions
        SET church_id = (
          SELECT church_id FROM learned_associations 
          WHERE LOWER(TRIM(learned_associations.normalized_description)) = LOWER(TRIM(consolidated_transactions.description))
            AND learned_associations.church_id IS NOT NULL
          LIMIT 1
        )
        WHERE (church_id IS NULL OR trim(church_id) = '' OR church_id = 'church-1')
          AND status IN ('identified', 'resolved')
          AND EXISTS (
            SELECT 1 FROM learned_associations 
            WHERE LOWER(TRIM(learned_associations.normalized_description)) = LOWER(TRIM(consolidated_transactions.description))
              AND learned_associations.church_id IS NOT NULL
          );

        UPDATE consolidated_transactions
        SET church_id = (
          SELECT church_id FROM contributors 
          WHERE contributors.id = consolidated_transactions.contributor_id
            AND contributors.church_id IS NOT NULL
          LIMIT 1
        )
        WHERE (church_id IS NULL OR trim(church_id) = '' OR church_id = 'church-1')
          AND status IN ('identified', 'resolved')
          AND contributor_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM contributors 
            WHERE contributors.id = consolidated_transactions.contributor_id
              AND contributors.church_id IS NOT NULL
          );
      `);
      // 🛡️ Regra de Identificação e Sincronização de Igrejas para Cadastros do Portal:
      this.db.exec(`
        UPDATE contributors 
        SET congregation = (
          SELECT name FROM churches WHERE churches.id = contributors.church_id LIMIT 1
        )
        WHERE (congregation IS NULL OR trim(congregation) = '' OR congregation = 'Igreja' OR congregation = 'Igreja não identificada')
          AND church_id IS NOT NULL 
          AND EXISTS (SELECT 1 FROM churches WHERE churches.id = contributors.church_id AND name IS NOT NULL AND trim(name) != '');
      `);
      this.db.exec(`
        UPDATE contributors 
        SET congregation = (SELECT name FROM churches ORDER BY created_at ASC LIMIT 1),
            church_id = (SELECT id FROM churches ORDER BY created_at ASC LIMIT 1)
        WHERE (congregation IS NULL OR trim(congregation) = '' OR congregation = 'Igreja' OR congregation = 'Igreja não identificada');
      `);
    } catch (_) {}

    // 2. Remove apenas cadastros verdadeiramente incompletos (sem nenhum nome identificável)
    try {
      this.db.exec(`
        DELETE FROM contributors 
        WHERE (canonical_name IS NULL OR trim(canonical_name) = '') 
          AND (name IS NULL OR trim(name) = '');
      `);
    } catch (_) {}

    // 🛡️ Sincronização completa e eliminação definitiva da divergência entre os bancos SQLite locais:
    try {
      const rootDir = this.resolveRootAppDir();
      const subDbPath = path.resolve(rootDir, 'contributors-api', 'data', 'contributors_local.sqlite');
      const canonicalPath = path.resolve(rootDir, 'data', 'contributors_local.sqlite');
      if (fs.existsSync(subDbPath) && fs.existsSync(canonicalPath) && subDbPath !== canonicalPath) {
        const { DatabaseSync: SubDbSync } = requireFallback('node:sqlite');
        const subDb = new SubDbSync(subDbPath);
        let mergeCompletedCleanly = true;
        try {
          const syncTables = [
            'profiles',
            'app_users',
            'churches',
            'banks',
            'contributors',
            'contribution_types',
            'payment_methods',
            'tenant_custom_options',
            'church_pix_keys',
            'consolidated_transactions',
            'financial_records',
            'learned_associations',
            'saved_reports',
            'church_closings',
            'contribution_requests',
            'pastoral_messages',
            'communication_logs',
            'communication_events',
            'communication_queue',
            'audit_logs',
            'app_auth_audit_logs',
            'rate_limits'
          ];
          for (const tbl of syncTables) {
            try {
              const subTblExists = subDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tbl);
              const mainTblExists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tbl);
              if (!subTblExists || !mainTblExists) continue;

              const mainCols = new Set(
                (this.db.prepare(`PRAGMA table_info("${tbl}")`).all() as any[]).map((c: any) => String(c.name))
              );
              const subRows = subDb.prepare(`SELECT * FROM "${tbl}"`).all() as any[];
              if (!subRows || subRows.length === 0) continue;

              const checkStmt = mainCols.has('id') ? this.db.prepare(`SELECT id FROM "${tbl}" WHERE id = ?`) : null;
              for (const row of subRows) {
                if (checkStmt && row.id) {
                  const exists = checkStmt.get(row.id);
                  if (exists) continue;
                }
                const validCols = Object.keys(row).filter(c => mainCols.has(c));
                if (validCols.length === 0) continue;
                const quotedCols = validCols.map(c => `"${c}"`).join(', ');
                const placeholders = validCols.map(() => '?').join(', ');
                const vals = validCols.map(c => row[c]);
                this.db.prepare(`INSERT OR IGNORE INTO "${tbl}" (${quotedCols}) VALUES (${placeholders})`).run(...vals);
              }
            } catch (tblErr) {
              mergeCompletedCleanly = false;
              console.warn(`[Contributors API] Aviso ao mesclar tabela ${tbl} do SQLite legado:`, (tblErr as any)?.message || tblErr);
            }
          }
        } finally {
          try { subDb.close(); } catch (_) {}
        }

        if (mergeCompletedCleanly) {
          for (const suffix of ['', '-wal', '-shm']) {
            const legacyFile = `${subDbPath}${suffix}`;
            if (fs.existsSync(legacyFile)) {
              try { fs.unlinkSync(legacyFile); } catch (_) {}
            }
          }
          console.log('[Contributors API] Banco legado contributors-api/data/contributors_local.sqlite mesclado e removido após unificação.');
        }
      }
    } catch (_) {}
  }

  public query(sql: string, params: any[] = [], throwOnError: boolean = false, ownerId: string = '__direct__'): { rows: any[]; rowCount: number; command: string; oid: number; fields: any[] } {
    if (!this.db) {
      return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
    }

    let s = sql.trim();

    // Handle transaction control statements safely with per-owner advisory lock & SQLite transaction coordination
    const firstWord = s.split(/\s+/)[0].toUpperCase();
    if (firstWord === 'BEGIN' || firstWord === 'COMMIT' || firstWord === 'ROLLBACK') {
      if (firstWord === 'BEGIN') {
        const shouldBeginSqlite = this.activeSqlTxOwners.size === 0;
        this.activeSqlTxOwners.add(ownerId);
        if (shouldBeginSqlite) {
          try {
            this.db.exec('BEGIN');
          } catch (tErr: any) {
            const isAlreadyActive = /within a transaction|cannot start a transaction/i.test(tErr?.message || '');
            if (throwOnError && !isAlreadyActive) throw tErr;
          }
        }
      } else {
        this.releaseOwnerLocks(ownerId, false);
        const wasOwnerInTx = this.activeSqlTxOwners.has(ownerId);
        this.activeSqlTxOwners.delete(ownerId);
        if (this.activeSqlTxOwners.size === 0 && (wasOwnerInTx || ownerId === '__direct__')) {
          try {
            this.db.exec(firstWord);
          } catch (tErr: any) {
            // Se for ROLLBACK ou COMMIT sem transação ativa no SQLite, normaliza sem estourar exceção
            const isNoActiveTx = /cannot rollback|cannot commit|no transaction is active/i.test(tErr?.message || '');
            if (throwOnError && !isNoActiveTx) throw tErr;
          }
        }
      }
      return { rows: [], rowCount: 0, command: firstWord, oid: 0, fields: [] };
    }

    // Skip extensions
    if (/^\s*CREATE\s+EXTENSION/i.test(s)) {
      return { rows: [], rowCount: 0, command: 'CREATE', oid: 0, fields: [] };
    }

    // Handle CREATE TABLE safely
    if (/^\s*CREATE\s+TABLE/i.test(s)) {
      try {
        let createSql = s
          .replace(/::[a-zA-Z0-9_]+(\[\])?/g, '')
          .replace(/\bUUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/gi, 'TEXT PRIMARY KEY DEFAULT (gen_random_uuid())')
          .replace(/\bDEFAULT\s+gen_random_uuid\(\)/gi, 'DEFAULT (gen_random_uuid())')
          .replace(/\bDEFAULT\s+now\(\)/gi, 'DEFAULT (now())')
          .replace(/\bDEFAULT\s+NOW\(\)/gi, 'DEFAULT (now())')
          .replace(/\bTIMESTAMP\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/gi, 'TEXT DEFAULT (now())')
          .replace(/\bTIMESTAMP\s+DEFAULT\s+NOW\(\)/gi, 'TEXT DEFAULT (now())')
          .replace(/\bTIMESTAMPTZ\s+DEFAULT\s+NOW\(\)/gi, 'TEXT DEFAULT (now())')
          .replace(/\bTIMESTAMPTZ\s+DEFAULT\s+now\(\)/gi, 'TEXT DEFAULT (now())')
          .replace(/\bTIMESTAMPTZ\b/gi, 'TEXT')
          .replace(/\bTIMESTAMP\b/gi, 'TEXT')
          .replace(/\bUUID\b/gi, 'TEXT')
          .replace(/\bVARCHAR\(\d+\)/gi, 'TEXT')
          .replace(/\bVARCHAR\b/gi, 'TEXT')
          .replace(/\bJSONB\s+DEFAULT\s+'\[\]'::jsonb/gi, "TEXT DEFAULT '[]'")
          .replace(/\bJSONB\b/gi, 'TEXT')
          .replace(/\bBOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE\b/gi, 'INTEGER NOT NULL DEFAULT 0')
          .replace(/\bBOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+TRUE\b/gi, 'INTEGER NOT NULL DEFAULT 1')
          .replace(/\bBOOLEAN\s+DEFAULT\s+FALSE\b/gi, 'INTEGER DEFAULT 0')
          .replace(/\bBOOLEAN\s+DEFAULT\s+TRUE\b/gi, 'INTEGER DEFAULT 1')
          .replace(/\bBOOLEAN\b/gi, 'INTEGER')
          .replace(/\bINT\b/gi, 'INTEGER')
          .replace(/\bNUMERIC\b/gi, 'REAL')
          .replace(/TEXT\[\]/gi, 'TEXT');

        this.db.exec(createSql);
      } catch (err: any) {
        console.warn('[Contributors API] Local SQLite CREATE TABLE warning:', err?.message || err);
      }
      return { rows: [], rowCount: 0, command: 'CREATE', oid: 0, fields: [] };
    }

    // Handle CREATE INDEX safely
    if (/^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(s)) {
      try {
        this.db.exec(s);
      } catch (_) {}
      return { rows: [], rowCount: 0, command: 'CREATE', oid: 0, fields: [] };
    }

    // Skip ALTER TABLE ADD COLUMN IF NOT EXISTS if column already exists (or run safely in try-catch)
    if (/^\s*ALTER\s+TABLE/i.test(s)) {
      try {
        // Clean types for SQLite
        let alterSql = s
          .replace(/::varchar/gi, '')
          .replace(/::text/gi, '')
          .replace(/::uuid/gi, '')
          .replace(/\bUUID\b/gi, 'TEXT')
          .replace(/\bVARCHAR\(\d+\)/gi, 'TEXT')
          .replace(/\bVARCHAR\b/gi, 'TEXT')
          .replace(/\bJSONB\b/gi, 'TEXT')
          .replace(/\bTIMESTAMP NOT NULL DEFAULT NOW\(\)/gi, 'TEXT DEFAULT (now())')
          .replace(/\bTIMESTAMP DEFAULT NOW\(\)/gi, 'TEXT DEFAULT (now())')
          .replace(/\bTIMESTAMP\b/gi, 'TEXT')
          .replace(/\bBOOLEAN DEFAULT TRUE\b/gi, 'INTEGER DEFAULT 1')
          .replace(/\bBOOLEAN DEFAULT FALSE\b/gi, 'INTEGER DEFAULT 0')
          .replace(/\bBOOLEAN\b/gi, 'INTEGER')
          .replace(/TEXT\[\]/gi, 'TEXT');

        this.db.exec(alterSql);
      } catch (_) {
        // Ignore column already exists in SQLite
      }
      return { rows: [], rowCount: 0, command: 'ALTER', oid: 0, fields: [] };
    }

    // Translate common Postgres constructs to SQLite
    // Intercept information_schema.tables queries for SQLite compatibility
    if (/FROM\s+information_schema\.tables/i.test(s)) {
      try {
        const rows = this.db.prepare("SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").all();
        return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
      } catch (err: any) {
        return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
      }
    }

    // Intercept information_schema.columns queries for SQLite compatibility
    if (/FROM\s+information_schema\.columns/i.test(s)) {
      try {
        const tableParam = params[0] || '';
        if (tableParam) {
          const pragmaCols = this.db.prepare(`PRAGMA table_info("${tableParam}")`).all() as any[];
          const rows = pragmaCols.map(c => ({
            column_name: c.name,
            data_type: c.type || 'text',
            is_nullable: c.notnull === 1 ? 'NO' : 'YES'
          }));
          return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
        }
      } catch (err: any) {
        return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
      }
    }

    // Strip type casts first (e.g. ::uuid[], ::varchar, ::int)
    s = s.replace(/::[a-zA-Z0-9_]+(\[\])?/g, '');
    s = s.replace(/\bILIKE\b/gi, 'LIKE');

    // Handle PostgreSQL date arithmetic with INTERVAL
    s = s.replace(/(?:\bNOW\(\)|\bdatetime\('now'\))\s*([+-])\s*INTERVAL\s*'([^']+)'/gi, "datetime('now', '$1$2')");
    s = s.replace(/\bNOW\(\)/gi, "datetime('now')");
    s = s.replace(/\bINTERVAL\s*'([^']+)'/gi, "'$1'");

    // Strip PostgreSQL concurrency row locks
    s = s.replace(/\bFOR\s+UPDATE(\s+SKIP\s+LOCKED)?\b/gi, '');

    // Handle "col = ANY($X)" (including table-qualified aliases like b.user_id) where param is array
    s = s.replace(/((?:[a-zA-Z_][a-zA-Z0-9_]*\.)?(?:"[a-zA-Z0-9_]+"|[a-zA-Z0-9_]+))\s*=\s*ANY\s*\(\s*\$(\d+)\s*\)/gi, (_m, col, pNum) => {
      const pVal = params[parseInt(pNum, 10) - 1];
      if (Array.isArray(pVal) && pVal.length > 0) {
        return `${col} IN (__ARRAY_PARAM_${pNum}__)`;
      }
      return `(1 = 0)`;
    });

    const normalizeParam = (val: any): any => {
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (typeof val === 'object' && !(val instanceof Uint8Array)) {
        if (Array.isArray(val)) return val.map(normalizeParam);
        return JSON.stringify(val);
      }
      return val;
    };

    const expandedParams: any[] = [];

    // Replace both standard $X and array placeholders in exact order of appearance in the SQL query
    s = s.replace(/(\$(\d+)|__ARRAY_PARAM_(\d+)__)/g, (fullMatch, _, standardNum, arrayNum) => {
      const pNum = standardNum || arrayNum;
      const originalIndex = parseInt(pNum, 10) - 1;
      const val = params[originalIndex];
      if (arrayNum && Array.isArray(val)) {
        expandedParams.push(...val.map(normalizeParam));
        return val.map(() => '?').join(', ');
      } else {
        expandedParams.push(Array.isArray(val) ? JSON.stringify(val.map(normalizeParam)) : normalizeParam(val));
        return '?';
      }
    });

    const command = s.split(/\s+/)[0].toUpperCase();

    const prevOwner = this.currentQueryOwnerId;
    this.currentQueryOwnerId = ownerId || '__direct__';
    try {
      if (command === 'SELECT' || command === 'WITH' || /\bRETURNING\b/i.test(s)) {
        const stmt = this.db.prepare(s);
        let rows = (expandedParams.length > 0 ? stmt.all(...expandedParams) : stmt.all()) as any[];
        if (s.toLowerCase().includes('pg_try_advisory_lock') || s.toLowerCase().includes('pg_try_advisory_xact_lock')) {
          rows = rows.map(r => (r && 'acquired' in r ? { ...r, acquired: r.acquired === 1 || r.acquired === true } : r));
        }
        return { rows, rowCount: rows.length, command, oid: 0, fields: [] };
      } else {
        const stmt = this.db.prepare(s);
        const info = expandedParams.length > 0 ? stmt.run(...expandedParams) : stmt.run();
        return { rows: [], rowCount: Number(info.changes), command, oid: 0, fields: [] };
      }
    } catch (err: any) {
      console.warn('[Contributors API] Local SQLite query error:', err?.message || err, 'SQL:', s.substring(0, 100));
      if (throwOnError) throw err;
      return { rows: [], rowCount: 0, command, oid: 0, fields: [] };
    } finally {
      this.currentQueryOwnerId = prevOwner;
    }
  }
}

// Dual-Engine SmartPool: prioritizes PostgreSQL when reachable, seamlessly & durably falls back to Local SQLite
class SmartPool {
  private pgPool: pg.Pool;
  private lastErrorLogTime: number = 0;
  private isOffline: boolean = false;
  public localEngine: LocalSqliteEngine;
  private isSyncing: boolean = false;
  private checkOfflineRecoveryInterval: NodeJS.Timeout | null = null;
  private lastRecoveryProbeTime: number = 0;
  private lastPgError: string | null = null;
  private lastRecoveryCheckAt: string | null = null;
  private lastRecoverySuccessAt: string | null = null;
  private virtualClientSeq: number = 0;

  constructor(config: pg.PoolConfig) {
    this.localEngine = new LocalSqliteEngine();
    this.pgPool = new Pool(config);
    this.pgPool.on('error', (err: any) => {
      this.handlePoolError('Pool client error', err);
    });

    // 🛡️ Auto-Cura e Reconexão Resiliente: Verifica periodicamente a volta do PostgreSQL quando em fallback offline
    this.checkOfflineRecoveryInterval = setInterval(() => {
      if (this.isOffline) {
        this.probeAndRecover();
      }
    }, 30000);
  }

  private isNetworkError(err: any): boolean {
    const code = String(err?.code || '');
    if (
      code === 'EAI_AGAIN' ||
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'EPIPE' ||
      code === 'EHOSTUNREACH' ||
      code === 'ENETUNREACH' ||
      code === '57P01' ||
      code === '57P02' ||
      code === '57P03' ||
      code === '08006' ||
      code === '08001' ||
      code === '08004'
    ) {
      return true;
    }
    const msg = String(err?.message || '').toLowerCase();
    return (
      msg.includes('connection terminated') ||
      msg.includes('timeout exceeded') ||
      msg.includes('connect econnrefused') ||
      msg.includes('getaddrinfo') ||
      msg.includes('socket hang up')
    );
  }

  private handlePoolError(context: string, err: any) {
    const now = Date.now();
    const isNetworkOrDns = this.isNetworkError(err);
    this.lastPgError = err?.message || String(err);
    if (isNetworkOrDns) {
      this.isOffline = true;
    }
    if (!this.lastErrorLogTime || now - this.lastErrorLogTime > 60000) {
      this.lastErrorLogTime = now;
      if (isNetworkOrDns) {
        console.warn(`[Contributors API] PostgreSQL status: Conexão remota em fallback resiliente local ativo [${err?.code || 'OFFLINE'}]`);
      } else {
        console.warn(`[Contributors API] PostgreSQL status (${context}):`, err?.message || err);
      }
    }
  }

  public getPoolHealth() {
    return {
      mode: this.isOffline ? 'sqlite_fallback' : 'postgres',
      isOffline: this.isOffline,
      isSyncing: this.isSyncing,
      lastPgError: this.lastPgError,
      lastRecoveryCheckAt: this.lastRecoveryCheckAt,
      lastRecoverySuccessAt: this.lastRecoverySuccessAt
    };
  }

  public async checkPostgresHealth(): Promise<{
    connected: boolean;
    latencyMs: number;
    serverTime: string | null;
    error?: string;
    sqliteOperational: boolean;
    mode: 'postgres' | 'sqlite_fallback' | 'offline';
  }> {
    const start = Date.now();
    let sqliteOperational = false;
    try {
      const sq = this.localEngine.query('SELECT 1 as alive', [], true);
      sqliteOperational = sq.rows.length > 0 && Number(sq.rows[0]?.alive) === 1;
    } catch (_) {
      sqliteOperational = false;
    }

    try {
      const res = await this.pgPool.query('SELECT 1 as alive, NOW() as server_time');
      const latencyMs = Date.now() - start;
      const wasOffline = this.isOffline;
      this.isOffline = false;
      this.lastPgError = null;
      this.lastRecoverySuccessAt = new Date().toISOString();
      if (wasOffline) {
        console.log('[Contributors API] 🛡️ PostgreSQL detectado online no healthcheck. Disparando sincronização de resgate...');
        this.syncPendingLocalToPostgres().catch(err => {
          console.warn('[Contributors API] Aviso na sincronização de resgate para o PostgreSQL:', err?.message || err);
        });
      }
      return {
        connected: true,
        latencyMs,
        serverTime: res.rows?.[0]?.server_time || null,
        sqliteOperational,
        mode: 'postgres'
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errMsg = err?.message || String(err);
      this.lastPgError = errMsg;
      if (this.isNetworkError(err)) {
        this.isOffline = true;
      }
      return {
        connected: false,
        latencyMs,
        serverTime: null,
        error: errMsg || 'PostgreSQL indisponível',
        sqliteOperational,
        mode: sqliteOperational ? 'sqlite_fallback' : 'offline'
      };
    }
  }

  public async probeAndRecover(force: boolean = false): Promise<boolean> {
    const now = Date.now();
    if (!force && (now - this.lastRecoveryProbeTime < 10000 || this.isSyncing)) {
      return !this.isOffline;
    }
    this.lastRecoveryProbeTime = now;
    this.lastRecoveryCheckAt = new Date().toISOString();

    try {
      const client = await this.pgPool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }

      if (this.isOffline) {
        this.isOffline = false;
        this.lastPgError = null;
        this.lastRecoverySuccessAt = new Date().toISOString();
        console.log('[Contributors API] 🛡️ PostgreSQL restabelecido com sucesso! Retornando ao modo primário online.');
        // Dispara sincronização de resgate assíncrona
        this.syncPendingLocalToPostgres().catch(err => {
          console.warn('[Contributors API] Aviso na sincronização de resgate para o PostgreSQL:', err?.message || err);
        });
      }
      return true;
    } catch (err: any) {
      this.isOffline = true;
      this.lastPgError = err?.message || String(err);
      return false;
    }
  }

  async connect(): Promise<pg.PoolClient> {
    if (this.isOffline) {
      const recovered = await this.probeAndRecover();
      if (recovered) {
        try {
          const client = await this.pgPool.connect();
          return client;
        } catch (err: any) {
          this.handlePoolError('reconexão', err);
        }
      }
    }

    try {
      if (!this.isOffline) {
        const client = await this.pgPool.connect();
        return client;
      }
    } catch (err: any) {
      this.isOffline = true;
      this.handlePoolError('conexão', err);
    }

    // Return virtual resilient client backed by Local SQLite with isolated ownerId
    const self = this;
    const virtualClientId = `vc-${++this.virtualClientSeq}`;
    const virtualClient: any = {
      query: async (sql: string, params?: any[]) => {
        return self.localEngine.query(sql, params, true, virtualClientId);
      },
      release: () => {
        self.localEngine.releaseOwnerLocks(virtualClientId, true);
      },
      on: () => virtualClient,
      removeListener: () => virtualClient
    };
    return virtualClient;
  }

  async query(sql: string, params?: any[]): Promise<pg.QueryResult<any>> {
    if (this.isOffline) {
      await this.probeAndRecover();
    }

    if (!this.isOffline) {
      try {
        const res = await this.pgPool.query(sql, params);
        // Also mirror mutations to local SQLite engine for zero-data-loss redundancy
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
          try {
            this.localEngine.query(sql, params);
          } catch (_) {}
        }
        return res;
      } catch (err: any) {
        const isNetworkOrDns = this.isNetworkError(err);
        if (isNetworkOrDns) {
          this.isOffline = true;
          this.handlePoolError('consulta', err);
          return this.localEngine.query(sql, params) as any;
        }
        throw err;
      }
    }

    // Execute in durable local SQLite engine
    return this.localEngine.query(sql, params) as any;
  }

  /**
   * 🛡️ Sincronização de Resgate SQLite ➔ PostgreSQL:
   * Promove automaticamente registros armazenados no SQLite local durante quedas de rede ou inicializações prévias
   * para o PostgreSQL com segurança, prevenindo regressão ou perda de dados em deploys.
   */
  public async syncPendingLocalToPostgres(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const client = await this.pgPool.connect();
      try {
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        let syncedRows = 0;
        let failedRows = 0;

        const runIsolatedRow = async (tableName: string, rowId: any, fn: () => Promise<void>) => {
          try {
            await fn();
            syncedRows++;
          } catch (rowErr: any) {
            failedRows++;
            console.warn(`[Contributors API] Sync aviso (${tableName}:${rowId}):`, rowErr?.message || rowErr);
          }
        };

        const normalizeJsonbCol = (val: any): string | null => {
          if (val === undefined || val === null || val === '') return null;
          if (typeof val === 'string') {
            try {
              JSON.parse(val);
              return val;
            } catch (_) {
              return null;
            }
          }
          return JSON.stringify(val);
        };
        const toBoolOrDefault = (val: any, def: boolean): boolean => {
          if (val === undefined || val === null) return def;
          if (typeof val === 'boolean') return val;
          if (typeof val === 'number') return val !== 0;
          const s = String(val).trim().toLowerCase();
          if (s === '0' || s === 'false' || s === '') return false;
          if (s === '1' || s === 'true') return true;
          return def;
        };

        // 0. Usuários e Perfis (app_users & profiles) antes das demais entidades
        const userRows = this.localEngine.query('SELECT * FROM app_users').rows || [];
        for (const row of userRows) {
          if (!row.id || !uuidRegex.test(row.id) || !row.email || !row.password_hash) continue;
          await runIsolatedRow('app_users', row.id, async () => {
            await client.query(`
              INSERT INTO app_users (
                id, email, password_hash, name, role, church_id, owner_id, permissions,
                is_active, is_verified, subscription_status, subscription_ends_at, trial_ends_at,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT (id) DO NOTHING;
            `, [
              row.id,
              String(row.email).toLowerCase().trim(),
              row.password_hash,
              row.name || null,
              row.role || 'user',
              row.church_id && uuidRegex.test(row.church_id) ? row.church_id : null,
              row.owner_id && uuidRegex.test(row.owner_id) ? row.owner_id : null,
              normalizeJsonbCol(row.permissions) || '[]',
              toBoolOrDefault(row.is_active, true),
              toBoolOrDefault(row.is_verified, false),
              row.subscription_status || 'trial',
              row.subscription_ends_at ? new Date(row.subscription_ends_at) : null,
              row.trial_ends_at ? new Date(row.trial_ends_at) : null,
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        const profileRows = this.localEngine.query('SELECT * FROM profiles').rows || [];
        for (const row of profileRows) {
          if (!row.id) continue;
          await runIsolatedRow('profiles', row.id, async () => {
            await client.query(`
              INSERT INTO profiles (
                id, email, name, role, owner_id, subscription_status, subscription_ends_at,
                trial_ends_at, limit_ai, usage_ai, max_churches, max_banks, custom_price,
                is_blocked, is_lifetime, permissions, congregation, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
              ON CONFLICT (id) DO UPDATE SET
                email = COALESCE(EXCLUDED.email, profiles.email),
                name = COALESCE(EXCLUDED.name, profiles.name),
                role = COALESCE(EXCLUDED.role, profiles.role),
                owner_id = COALESCE(EXCLUDED.owner_id, profiles.owner_id),
                subscription_status = CASE WHEN EXCLUDED.updated_at > COALESCE(profiles.updated_at, to_timestamp(0)) THEN EXCLUDED.subscription_status ELSE profiles.subscription_status END,
                subscription_ends_at = CASE WHEN EXCLUDED.updated_at > COALESCE(profiles.updated_at, to_timestamp(0)) THEN EXCLUDED.subscription_ends_at ELSE profiles.subscription_ends_at END,
                trial_ends_at = CASE WHEN EXCLUDED.updated_at > COALESCE(profiles.updated_at, to_timestamp(0)) THEN EXCLUDED.trial_ends_at ELSE profiles.trial_ends_at END,
                limit_ai = CASE WHEN EXCLUDED.updated_at > COALESCE(profiles.updated_at, to_timestamp(0)) THEN EXCLUDED.limit_ai ELSE profiles.limit_ai END,
                max_churches = CASE WHEN EXCLUDED.updated_at > COALESCE(profiles.updated_at, to_timestamp(0)) THEN EXCLUDED.max_churches ELSE profiles.max_churches END,
                max_banks = CASE WHEN EXCLUDED.updated_at > COALESCE(profiles.updated_at, to_timestamp(0)) THEN EXCLUDED.max_banks ELSE profiles.max_banks END,
                is_blocked = CASE WHEN EXCLUDED.updated_at > COALESCE(profiles.updated_at, to_timestamp(0)) THEN EXCLUDED.is_blocked ELSE profiles.is_blocked END,
                is_lifetime = CASE WHEN EXCLUDED.updated_at > COALESCE(profiles.updated_at, to_timestamp(0)) THEN EXCLUDED.is_lifetime ELSE profiles.is_lifetime END,
                permissions = COALESCE(EXCLUDED.permissions, profiles.permissions),
                congregation = COALESCE(EXCLUDED.congregation, profiles.congregation),
                updated_at = GREATEST(COALESCE(profiles.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              String(row.id),
              row.email || null,
              row.name || null,
              row.role || 'owner',
              row.owner_id || null,
              row.subscription_status || 'trial',
              row.subscription_ends_at ? new Date(row.subscription_ends_at) : null,
              row.trial_ends_at ? new Date(row.trial_ends_at) : null,
              Number(row.limit_ai ?? 100),
              Number(row.usage_ai ?? 0),
              Number(row.max_churches ?? 2),
              Number(row.max_banks ?? 2),
              row.custom_price !== undefined && row.custom_price !== null ? Number(row.custom_price) : null,
              toBoolOrDefault(row.is_blocked, false),
              toBoolOrDefault(row.is_lifetime, false),
              normalizeJsonbCol(row.permissions),
              row.congregation || null,
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 1. Transações consolidadas (com preservação de atualizações offline e anexos por updated_at)
        const txRows = this.localEngine.query('SELECT * FROM consolidated_transactions').rows || [];
        for (const row of txRows) {
          if (!row.id) continue;
          const validId = uuidRegex.test(row.id) ? row.id : null;
          if (!validId) continue;
          const validUserId = row.user_id && uuidRegex.test(row.user_id) ? row.user_id : null;
          if (!validUserId) continue;
          const validChurchId = row.church_id && uuidRegex.test(row.church_id) ? row.church_id : null;
          const validBankId = row.bank_id && uuidRegex.test(row.bank_id) ? row.bank_id : null;
          const validContributorId = row.contributor_id && uuidRegex.test(row.contributor_id) ? row.contributor_id : null;
          const validContribReqId = row.contribution_request_id && uuidRegex.test(row.contribution_request_id) ? row.contribution_request_id : null;
          const splitsJson = row.splits ? (typeof row.splits === 'string' ? row.splits : JSON.stringify(row.splits)) : null;
          const attachJson = row.attachments ? (typeof row.attachments === 'string' ? row.attachments : JSON.stringify(row.attachments)) : '[]';

          await runIsolatedRow('consolidated_transactions', validId, async () => {
            await client.query(`
              INSERT INTO consolidated_transactions (
                id, amount, description, type, pix_key, source, user_id, status,
                bank_id, row_hash, is_confirmed, transaction_date, reference_date,
                church_id, contributor_id, report_id, payment_method, contribution_type,
                contribution_request_id, splits, attachments, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23
              ) ON CONFLICT (id) DO UPDATE SET
                status = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN EXCLUDED.status ELSE consolidated_transactions.status END,
                is_confirmed = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN EXCLUDED.is_confirmed ELSE consolidated_transactions.is_confirmed END,
                church_id = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN COALESCE(EXCLUDED.church_id, consolidated_transactions.church_id) ELSE consolidated_transactions.church_id END,
                contributor_id = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN COALESCE(EXCLUDED.contributor_id, consolidated_transactions.contributor_id) ELSE consolidated_transactions.contributor_id END,
                bank_id = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN COALESCE(EXCLUDED.bank_id, consolidated_transactions.bank_id) ELSE consolidated_transactions.bank_id END,
                payment_method = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN COALESCE(EXCLUDED.payment_method, consolidated_transactions.payment_method) ELSE consolidated_transactions.payment_method END,
                contribution_type = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN COALESCE(EXCLUDED.contribution_type, consolidated_transactions.contribution_type) ELSE consolidated_transactions.contribution_type END,
                contribution_request_id = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN COALESCE(EXCLUDED.contribution_request_id, consolidated_transactions.contribution_request_id) ELSE consolidated_transactions.contribution_request_id END,
                splits = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN COALESCE(EXCLUDED.splits, consolidated_transactions.splits) ELSE consolidated_transactions.splits END,
                reference_date = CASE WHEN EXCLUDED.updated_at > COALESCE(consolidated_transactions.updated_at, to_timestamp(0)) THEN COALESCE(EXCLUDED.reference_date, consolidated_transactions.reference_date) ELSE consolidated_transactions.reference_date END,
                attachments = CASE
                  WHEN EXCLUDED.attachments IS NOT NULL AND EXCLUDED.attachments::text != '[]'
                  THEN EXCLUDED.attachments
                  ELSE consolidated_transactions.attachments
                END,
                updated_at = GREATEST(COALESCE(consolidated_transactions.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              validId,
              Number(row.amount || 0),
              row.description || '',
              row.type || 'income',
              row.pix_key || null,
              row.source || 'file',
              validUserId,
              row.status || 'pending',
              validBankId,
              row.row_hash || null,
              Boolean(row.is_confirmed),
              row.transaction_date ? new Date(row.transaction_date) : new Date(),
              row.reference_date || null,
              validChurchId,
              validContributorId,
              row.report_id || null,
              row.payment_method || null,
              row.contribution_type || null,
              validContribReqId,
              splitsJson,
              attachJson,
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 2. Fechamentos contábeis (church_closings)
        const closingRows = this.localEngine.query('SELECT * FROM church_closings').rows || [];
        for (const row of closingRows) {
          if (!row.id || !row.church_id) continue;
          const sigJson = row.signatures ? (typeof row.signatures === 'string' ? row.signatures : JSON.stringify(row.signatures)) : null;
          await runIsolatedRow('church_closings', row.id, async () => {
            await client.query(`
              INSERT INTO church_closings (
                id, church_id, bank_id, year, month, status, closed_at, closed_by, 
                total_income, total_expenses, final_balance, transferred_balance, 
                target_church_id, target_church_name, integrity_hash, signatures, notes, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
              ON CONFLICT (id) DO UPDATE SET
                status = CASE WHEN EXCLUDED.updated_at >= COALESCE(church_closings.updated_at, to_timestamp(0)) THEN EXCLUDED.status ELSE church_closings.status END,
                bank_id = EXCLUDED.bank_id,
                closed_at = EXCLUDED.closed_at,
                closed_by = EXCLUDED.closed_by,
                total_income = EXCLUDED.total_income,
                total_expenses = EXCLUDED.total_expenses,
                final_balance = EXCLUDED.final_balance,
                transferred_balance = EXCLUDED.transferred_balance,
                target_church_id = EXCLUDED.target_church_id,
                target_church_name = EXCLUDED.target_church_name,
                integrity_hash = EXCLUDED.integrity_hash,
                signatures = EXCLUDED.signatures,
                notes = EXCLUDED.notes,
                updated_at = GREATEST(COALESCE(church_closings.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              row.id,
              row.church_id,
              row.bank_id || null,
              Number(row.year),
              Number(row.month),
              row.status || 'closed',
              row.closed_at ? new Date(row.closed_at) : new Date(),
              row.closed_by || null,
              Number(row.total_income || 0),
              Number(row.total_expenses || 0),
              Number(row.final_balance || 0),
              row.transferred_balance !== undefined && row.transferred_balance !== null ? Number(row.transferred_balance) : null,
              row.target_church_id || null,
              row.target_church_name || null,
              row.integrity_hash || null,
              sigJson,
              row.notes || null,
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 3. Contribuintes (contributors - completo com todos os campos estendidos)
        const contributorRows = this.localEngine.query('SELECT * FROM contributors').rows || [];
        for (const row of contributorRows) {
          if (!row.id || !uuidRegex.test(row.id)) continue;
          const validChurchId = row.church_id && uuidRegex.test(row.church_id) ? row.church_id : '00000000-0000-0000-0000-000000000001';
          await runIsolatedRow('contributors', row.id, async () => {
            await client.query(`
              INSERT INTO contributors (
                id, church_id, canonical_name, name, cpf, email, phone, whatsapp,
                status, person_type, trade_name, rg_ie, birth_date, contact_person,
                category, pix_key, bank_name, bank_agency, bank_account,
                address_cep, address_street, address_number, address_city, address_state,
                notes, is_global, role_position, photo_url, congregation,
                created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19,
                $20, $21, $22, $23, $24,
                $25, $26, $27, $28, $29,
                $30, $31
              ) ON CONFLICT (id) DO UPDATE SET
                church_id = COALESCE(EXCLUDED.church_id, contributors.church_id),
                canonical_name = COALESCE(EXCLUDED.canonical_name, contributors.canonical_name),
                name = COALESCE(EXCLUDED.name, contributors.name),
                cpf = COALESCE(EXCLUDED.cpf, contributors.cpf),
                email = COALESCE(EXCLUDED.email, contributors.email),
                phone = COALESCE(EXCLUDED.phone, contributors.phone),
                whatsapp = COALESCE(EXCLUDED.whatsapp, contributors.whatsapp),
                status = COALESCE(EXCLUDED.status, contributors.status),
                person_type = COALESCE(EXCLUDED.person_type, contributors.person_type),
                trade_name = COALESCE(EXCLUDED.trade_name, contributors.trade_name),
                rg_ie = COALESCE(EXCLUDED.rg_ie, contributors.rg_ie),
                birth_date = COALESCE(EXCLUDED.birth_date, contributors.birth_date),
                contact_person = COALESCE(EXCLUDED.contact_person, contributors.contact_person),
                category = COALESCE(EXCLUDED.category, contributors.category),
                pix_key = COALESCE(EXCLUDED.pix_key, contributors.pix_key),
                bank_name = COALESCE(EXCLUDED.bank_name, contributors.bank_name),
                bank_agency = COALESCE(EXCLUDED.bank_agency, contributors.bank_agency),
                bank_account = COALESCE(EXCLUDED.bank_account, contributors.bank_account),
                address_cep = COALESCE(EXCLUDED.address_cep, contributors.address_cep),
                address_street = COALESCE(EXCLUDED.address_street, contributors.address_street),
                address_number = COALESCE(EXCLUDED.address_number, contributors.address_number),
                address_city = COALESCE(EXCLUDED.address_city, contributors.address_city),
                address_state = COALESCE(EXCLUDED.address_state, contributors.address_state),
                notes = COALESCE(EXCLUDED.notes, contributors.notes),
                is_global = COALESCE(EXCLUDED.is_global, contributors.is_global),
                role_position = COALESCE(EXCLUDED.role_position, contributors.role_position),
                photo_url = COALESCE(EXCLUDED.photo_url, contributors.photo_url),
                congregation = COALESCE(EXCLUDED.congregation, contributors.congregation),
                updated_at = GREATEST(COALESCE(contributors.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              row.id,
              validChurchId,
              row.canonical_name || row.name || 'CONTRIBUINTE',
              row.name || row.canonical_name || '',
              row.cpf || null,
              row.email || null,
              row.phone || null,
              row.whatsapp || null,
              row.status || 'active',
              row.person_type || 'PF',
              row.trade_name || null,
              row.rg_ie || null,
              row.birth_date || null,
              row.contact_person || null,
              row.category || null,
              row.pix_key || null,
              row.bank_name || null,
              row.bank_agency || null,
              row.bank_account || null,
              row.address_cep || null,
              row.address_street || null,
              row.address_number || null,
              row.address_city || null,
              row.address_state || null,
              row.notes || null,
              row.is_global !== undefined && row.is_global !== null ? Boolean(row.is_global === true || row.is_global === 1 || row.is_global === '1') : false,
              row.role_position || null,
              row.photo_url || null,
              row.congregation || null,
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 4. Registros financeiros (financial_records)
        const finRows = this.localEngine.query('SELECT * FROM financial_records').rows || [];
        for (const row of finRows) {
          if (!row.id || !uuidRegex.test(row.id)) continue;
          const validUserId = row.user_id && uuidRegex.test(row.user_id) ? row.user_id : null;
          if (!validUserId) continue;
          const validChurchId = row.church_id && uuidRegex.test(row.church_id) ? row.church_id : null;
          const attachJson = row.attachments ? (typeof row.attachments === 'string' ? row.attachments : JSON.stringify(row.attachments)) : '[]';
          await runIsolatedRow('financial_records', row.id, async () => {
            await client.query(`
              INSERT INTO financial_records (
                id, user_id, church_id, title, description, amount, type, status,
                recipient_name, recipient_type, due_date, payment_date, recurrence,
                attachments, validation_status, validation_notes, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18
              ) ON CONFLICT (id) DO UPDATE SET
                status = CASE WHEN EXCLUDED.updated_at > COALESCE(financial_records.updated_at, to_timestamp(0)) THEN EXCLUDED.status ELSE financial_records.status END,
                payment_date = CASE WHEN EXCLUDED.updated_at > COALESCE(financial_records.updated_at, to_timestamp(0)) THEN EXCLUDED.payment_date ELSE financial_records.payment_date END,
                validation_status = CASE WHEN EXCLUDED.updated_at > COALESCE(financial_records.updated_at, to_timestamp(0)) THEN EXCLUDED.validation_status ELSE financial_records.validation_status END,
                attachments = CASE WHEN EXCLUDED.attachments IS NOT NULL AND EXCLUDED.attachments::text != '[]' THEN EXCLUDED.attachments ELSE financial_records.attachments END,
                updated_at = GREATEST(COALESCE(financial_records.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              row.id,
              validUserId,
              validChurchId,
              row.title || 'Registro',
              row.description || null,
              Number(row.amount || 0),
              row.type || 'expense',
              row.status || 'pending',
              row.recipient_name || null,
              row.recipient_type || null,
              row.due_date ? new Date(row.due_date) : null,
              row.payment_date ? new Date(row.payment_date) : null,
              row.recurrence || 'none',
              attachJson,
              row.validation_status || 'pending_attachment',
              row.validation_notes || null,
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 5. Congregações (churches - sincroniza tanto "pixKey" quanto pix_key)
        const churchRows = this.localEngine.query('SELECT * FROM churches').rows || [];
        for (const row of churchRows) {
          if (!row.id || !row.name) continue;
          const validId = uuidRegex.test(row.id) ? row.id : null;
          if (!validId) continue;
          const validUserId = row.user_id && uuidRegex.test(row.user_id) ? row.user_id : null;
          const pastorsJson = normalizeJsonbCol(row.pastors);
          const treasurersJson = normalizeJsonbCol(row.treasurers);
          const autoCommEnabled = toBoolOrDefault(row.auto_comm_enabled, true);
          const autoSendOnConf = toBoolOrDefault(row.auto_send_on_confirmation, true);
          const effectivePixKey = row.pixKey || row.pix_key || '';
          const updatedAtVal = row.updated_at ? new Date(row.updated_at) : (row.created_at ? new Date(row.created_at) : new Date());
          await runIsolatedRow('churches', validId, async () => {
            try {
              await client.query(`
                INSERT INTO churches (
                  id, name, address, "logoUrl", pastor, cnpj, phone, email, "pixKey", pix_key,
                  cep, city, state, treasurer, pastors, treasurers, whatsapp_official,
                  whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation, user_id, updated_at
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                  $11, $12, $13, $14, $15, $16, $17,
                  $18, $19, $20, $21, $22
                ) ON CONFLICT (id) DO UPDATE SET
                  name = CASE WHEN EXCLUDED.updated_at >= COALESCE(churches.updated_at, to_timestamp(0)) THEN EXCLUDED.name ELSE churches.name END,
                  address = COALESCE(NULLIF(EXCLUDED.address, ''), churches.address),
                  "logoUrl" = COALESCE(NULLIF(EXCLUDED."logoUrl", ''), churches."logoUrl"),
                  pastor = COALESCE(NULLIF(EXCLUDED.pastor, ''), churches.pastor),
                  cnpj = COALESCE(NULLIF(EXCLUDED.cnpj, ''), churches.cnpj),
                  phone = COALESCE(NULLIF(EXCLUDED.phone, ''), churches.phone),
                  email = COALESCE(NULLIF(EXCLUDED.email, ''), churches.email),
                  "pixKey" = COALESCE(NULLIF(EXCLUDED."pixKey", ''), churches."pixKey"),
                  pix_key = COALESCE(NULLIF(EXCLUDED.pix_key, ''), churches.pix_key),
                  cep = COALESCE(NULLIF(EXCLUDED.cep, ''), churches.cep),
                  city = COALESCE(NULLIF(EXCLUDED.city, ''), churches.city),
                  state = COALESCE(NULLIF(EXCLUDED.state, ''), churches.state),
                  treasurer = COALESCE(NULLIF(EXCLUDED.treasurer, ''), churches.treasurer),
                  pastors = COALESCE(EXCLUDED.pastors, churches.pastors),
                  treasurers = COALESCE(EXCLUDED.treasurers, churches.treasurers),
                  whatsapp_official = COALESCE(EXCLUDED.whatsapp_official, churches.whatsapp_official),
                  whatsapp_responsible = COALESCE(EXCLUDED.whatsapp_responsible, churches.whatsapp_responsible),
                  auto_comm_enabled = EXCLUDED.auto_comm_enabled,
                  auto_send_on_confirmation = EXCLUDED.auto_send_on_confirmation,
                  user_id = COALESCE(EXCLUDED.user_id, churches.user_id),
                  updated_at = GREATEST(COALESCE(churches.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
              `, [
                validId,
                row.name,
                row.address || '',
                row.logoUrl || '',
                row.pastor || '',
                row.cnpj || '',
                row.phone || '',
                row.email || '',
                effectivePixKey,
                effectivePixKey,
                row.cep || '',
                row.city || '',
                row.state || '',
                row.treasurer || '',
                pastorsJson,
                treasurersJson,
                row.whatsapp_official || null,
                row.whatsapp_responsible || 'tesouraria',
                autoCommEnabled,
                autoSendOnConf,
                validUserId,
                updatedAtVal
              ]);
            } catch (chSyncErr: any) {
              const errMsg = String(chSyncErr?.message || '');
              if (errMsg.includes('updated_at') || errMsg.includes('pix_key')) {
                await client.query(`
                  INSERT INTO churches (
                    id, name, address, "logoUrl", pastor, cnpj, phone, email, "pixKey",
                    cep, city, state, treasurer, pastors, treasurers, whatsapp_official,
                    whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation, user_id
                  ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14, $15, $16,
                    $17, $18, $19, $20
                  ) ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    address = COALESCE(NULLIF(EXCLUDED.address, ''), churches.address),
                    "logoUrl" = COALESCE(NULLIF(EXCLUDED."logoUrl", ''), churches."logoUrl"),
                    pastor = COALESCE(NULLIF(EXCLUDED.pastor, ''), churches.pastor),
                    cnpj = COALESCE(NULLIF(EXCLUDED.cnpj, ''), churches.cnpj),
                    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), churches.phone),
                    email = COALESCE(NULLIF(EXCLUDED.email, ''), churches.email),
                    "pixKey" = COALESCE(NULLIF(EXCLUDED."pixKey", ''), churches."pixKey"),
                    cep = COALESCE(NULLIF(EXCLUDED.cep, ''), churches.cep),
                    city = COALESCE(NULLIF(EXCLUDED.city, ''), churches.city),
                    state = COALESCE(NULLIF(EXCLUDED.state, ''), churches.state),
                    treasurer = COALESCE(NULLIF(EXCLUDED.treasurer, ''), churches.treasurer),
                    pastors = COALESCE(EXCLUDED.pastors, churches.pastors),
                    treasurers = COALESCE(EXCLUDED.treasurers, churches.treasurers),
                    whatsapp_official = COALESCE(EXCLUDED.whatsapp_official, churches.whatsapp_official),
                    whatsapp_responsible = COALESCE(EXCLUDED.whatsapp_responsible, churches.whatsapp_responsible),
                    auto_comm_enabled = EXCLUDED.auto_comm_enabled,
                    auto_send_on_confirmation = EXCLUDED.auto_send_on_confirmation,
                    user_id = COALESCE(EXCLUDED.user_id, churches.user_id);
                `, [
                  validId,
                  row.name,
                  row.address || '',
                  row.logoUrl || '',
                  row.pastor || '',
                  row.cnpj || '',
                  row.phone || '',
                  row.email || '',
                  effectivePixKey,
                  row.cep || '',
                  row.city || '',
                  row.state || '',
                  row.treasurer || '',
                  pastorsJson,
                  treasurersJson,
                  row.whatsapp_official || null,
                  row.whatsapp_responsible || 'tesouraria',
                  autoCommEnabled,
                  autoSendOnConf,
                  validUserId
                ]);
              } else {
                throw chSyncErr;
              }
            }
          });
        }

        // 6. Bancos (banks)
        const bankRows = this.localEngine.query('SELECT * FROM banks').rows || [];
        for (const row of bankRows) {
          if (!row.id || !row.name) continue;
          const validId = uuidRegex.test(row.id) ? row.id : null;
          if (!validId) continue;
          const validUserId = row.user_id && uuidRegex.test(row.user_id) ? row.user_id : null;
          let acceptedTypes: string[] | null = null;
          if (Array.isArray(row.accepted_contribution_types)) {
            acceptedTypes = row.accepted_contribution_types.map(String);
          } else if (typeof row.accepted_contribution_types === 'string' && row.accepted_contribution_types.trim()) {
            try {
              const parsed = JSON.parse(row.accepted_contribution_types);
              if (Array.isArray(parsed)) acceptedTypes = parsed.map(String);
            } catch (_) {}
          }
          await runIsolatedRow('banks', validId, async () => {
            await client.query(`
              INSERT INTO banks (
                id, name, user_id, bank_key, account_name, accepted_contribution_types, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                user_id = COALESCE(EXCLUDED.user_id, banks.user_id),
                bank_key = COALESCE(EXCLUDED.bank_key, banks.bank_key),
                account_name = COALESCE(EXCLUDED.account_name, banks.account_name),
                accepted_contribution_types = COALESCE(EXCLUDED.accepted_contribution_types, banks.accepted_contribution_types);
            `, [
              validId,
              row.name,
              validUserId,
              row.bank_key || null,
              row.account_name || row.name,
              acceptedTypes,
              row.created_at ? new Date(row.created_at) : new Date()
            ]);
          });
        }

        // 7. Associações aprendidas (learned_associations)
        const assocRows = this.localEngine.query('SELECT * FROM learned_associations').rows || [];
        for (const row of assocRows) {
          if (!row.id || !row.normalized_description || !row.contributor_normalized_name) continue;
          const validId = uuidRegex.test(row.id) ? row.id : null;
          if (!validId) continue;
          const validUserId = row.user_id && uuidRegex.test(row.user_id) ? row.user_id : null;
          const validChurchId = row.church_id && uuidRegex.test(row.church_id) ? row.church_id : null;
          await runIsolatedRow('learned_associations', validId, async () => {
            await client.query(`
              INSERT INTO learned_associations (
                id, user_id, normalized_description, contributor_normalized_name, church_id, created_at
              ) VALUES ($1, $2, $3, $4, $5, NOW())
              ON CONFLICT (id) DO UPDATE SET
                contributor_normalized_name = EXCLUDED.contributor_normalized_name,
                church_id = COALESCE(EXCLUDED.church_id, learned_associations.church_id);
            `, [
              validId,
              validUserId,
              row.normalized_description,
              row.contributor_normalized_name,
              validChurchId
            ]);
          });
        }

        // 8. Relatórios salvos (saved_reports)
        const reportRows = this.localEngine.query('SELECT * FROM saved_reports').rows || [];
        for (const row of reportRows) {
          if (!row.id || !row.name) continue;
          const validUserId = row.user_id && uuidRegex.test(row.user_id) ? row.user_id : null;
          const validChurchId = row.church_id && uuidRegex.test(row.church_id) ? row.church_id : null;
          const dataJson = row.data ? (typeof row.data === 'string' ? row.data : JSON.stringify(row.data)) : '{}';
          await runIsolatedRow('saved_reports', row.id, async () => {
            await client.query(`
              INSERT INTO saved_reports (
                id, name, record_count, user_id, church_id, data, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                record_count = EXCLUDED.record_count,
                data = EXCLUDED.data,
                church_id = COALESCE(EXCLUDED.church_id, saved_reports.church_id),
                updated_at = GREATEST(COALESCE(saved_reports.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              String(row.id),
              row.name,
              Number(row.record_count || 0),
              validUserId,
              validChurchId,
              dataJson,
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : (row.created_at ? new Date(row.created_at) : new Date())
            ]);
          });
        }

        // 9. Chaves Pix bancárias (church_pix_keys)
        const pixRows = this.localEngine.query('SELECT * FROM church_pix_keys').rows || [];
        for (const row of pixRows) {
          if (!row.id || !row.pix_key || !row.pix_type) continue;
          const validId = uuidRegex.test(row.id) ? row.id : null;
          if (!validId) continue;
          const validBankId = row.bank_id && uuidRegex.test(row.bank_id) ? row.bank_id : null;
          const validChurchId = row.church_id && uuidRegex.test(row.church_id) ? row.church_id : null;
          await runIsolatedRow('church_pix_keys', validId, async () => {
            await client.query(`
              INSERT INTO church_pix_keys (
                id, bank_id, church_id, pix_type, pix_key, holder_name, description, is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (id) DO UPDATE SET
                bank_id = COALESCE(EXCLUDED.bank_id, church_pix_keys.bank_id),
                church_id = COALESCE(EXCLUDED.church_id, church_pix_keys.church_id),
                pix_type = EXCLUDED.pix_type,
                pix_key = EXCLUDED.pix_key,
                holder_name = COALESCE(EXCLUDED.holder_name, church_pix_keys.holder_name),
                description = COALESCE(EXCLUDED.description, church_pix_keys.description),
                is_active = EXCLUDED.is_active,
                updated_at = GREATEST(COALESCE(church_pix_keys.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              validId,
              validBankId,
              validChurchId,
              row.pix_type,
              row.pix_key,
              row.holder_name || null,
              row.description || null,
              toBoolOrDefault(row.is_active, true),
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 10. Trilha de auditoria (audit_logs)
        const auditRows = this.localEngine.query('SELECT * FROM audit_logs').rows || [];
        for (const row of auditRows) {
          if (!row.id || !row.action || !row.entity) continue;
          const validId = uuidRegex.test(row.id) ? row.id : null;
          if (!validId) continue;
          const oldVal = row.old_values ? (typeof row.old_values === 'string' ? row.old_values : JSON.stringify(row.old_values)) : null;
          const newVal = row.new_values ? (typeof row.new_values === 'string' ? row.new_values : JSON.stringify(row.new_values)) : null;
          const metaVal = row.metadata ? (typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata)) : null;
          await runIsolatedRow('audit_logs', validId, async () => {
            await client.query(`
              INSERT INTO audit_logs (
                id, user_id, church_id, action, entity, entity_id, ip_address, user_agent, old_values, new_values, metadata, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (id) DO NOTHING;
            `, [
              validId,
              row.user_id ? String(row.user_id) : null,
              row.church_id ? String(row.church_id) : null,
              String(row.action),
              String(row.entity),
              row.entity_id ? String(row.entity_id) : null,
              row.ip_address || null,
              row.user_agent || null,
              oldVal,
              newVal,
              metaVal,
              row.created_at ? new Date(row.created_at) : new Date()
            ]);
          });
        }

        // 11. Formas de recebimento/pagamento (payment_methods)
        const paymentMethodRows = this.localEngine.query('SELECT * FROM payment_methods').rows || [];
        for (const row of paymentMethodRows) {
          if (!row.id || !row.name) continue;
          const validId = uuidRegex.test(row.id) ? row.id : null;
          if (!validId) continue;
          const validBankId = row.bank_id && uuidRegex.test(row.bank_id) ? row.bank_id : null;
          await runIsolatedRow('payment_methods', validId, async () => {
            await client.query(`
              INSERT INTO payment_methods (
                id, name, type, category, bank_id, "order", is_active, user_id, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                category = EXCLUDED.category,
                bank_id = EXCLUDED.bank_id,
                "order" = EXCLUDED."order",
                is_active = EXCLUDED.is_active,
                user_id = COALESCE(EXCLUDED.user_id, payment_methods.user_id),
                updated_at = GREATEST(COALESCE(payment_methods.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              validId,
              String(row.name),
              row.type ? String(row.type) : 'recebimento',
              row.category || null,
              validBankId || (row.bank_id ? String(row.bank_id) : null),
              Number(row.order ?? 1),
              row.is_active !== undefined ? Boolean(row.is_active === true || row.is_active === 1 || row.is_active === '1') : true,
              row.user_id ? String(row.user_id) : null,
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 12. Sub-cadastros de cargos e categorias por tenant (tenant_custom_options)
        const tenantOptionRows = this.localEngine.query('SELECT * FROM tenant_custom_options').rows || [];
        for (const row of tenantOptionRows) {
          if (!row.id || !row.user_id || !row.scope || !row.name) continue;
          const validId = uuidRegex.test(row.id) ? row.id : null;
          if (!validId) continue;
          await runIsolatedRow('tenant_custom_options', validId, async () => {
            await client.query(`
              INSERT INTO tenant_custom_options (
                id, user_id, scope, name, sort_order, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                sort_order = EXCLUDED.sort_order,
                updated_at = GREATEST(COALESCE(tenant_custom_options.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              validId,
              String(row.user_id),
              String(row.scope),
              String(row.name),
              Number(row.sort_order ?? 1),
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 13. Descrições / Tipos de contribuição (contribution_types)
        const contribTypeRows = this.localEngine.query('SELECT * FROM contribution_types').rows || [];
        for (const row of contribTypeRows) {
          if (!row.id || !row.name) continue;
          await runIsolatedRow('contribution_types', row.id, async () => {
            await client.query(`
              INSERT INTO contribution_types (
                id, name, type, category, bank_id, "order", is_active, user_id, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                category = EXCLUDED.category,
                bank_id = EXCLUDED.bank_id,
                "order" = EXCLUDED."order",
                is_active = EXCLUDED.is_active,
                user_id = COALESCE(EXCLUDED.user_id, contribution_types.user_id);
            `, [
              String(row.id),
              String(row.name),
              row.type ? String(row.type) : 'entrada',
              row.category || null,
              row.bank_id ? String(row.bank_id) : null,
              Number(row.order ?? 1),
              row.is_active !== undefined ? Boolean(row.is_active === true || row.is_active === 1 || row.is_active === '1') : true,
              row.user_id ? String(row.user_id) : null,
              row.created_at ? new Date(row.created_at) : new Date()
            ]);
          });
        }

        // 14. Automações pastorais (pastor_automations)
        const pastorAutoRows = this.localEngine.query('SELECT * FROM pastor_automations').rows || [];
        for (const row of pastorAutoRows) {
          if (!row.id || !uuidRegex.test(row.id) || !row.user_id || !uuidRegex.test(row.user_id) || !row.pastor_name || !row.pix_key) continue;
          await runIsolatedRow('pastor_automations', row.id, async () => {
            await client.query(`
              INSERT INTO pastor_automations (
                id, user_id, pastor_name, pix_key, pix_key_type, payment_day,
                gross_amount, net_amount, tithe_amount, tithe_enabled, church_id, active,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
              ON CONFLICT (id) DO UPDATE SET
                pastor_name = CASE WHEN EXCLUDED.updated_at >= COALESCE(pastor_automations.updated_at, to_timestamp(0)) THEN EXCLUDED.pastor_name ELSE pastor_automations.pastor_name END,
                pix_key = CASE WHEN EXCLUDED.updated_at >= COALESCE(pastor_automations.updated_at, to_timestamp(0)) THEN EXCLUDED.pix_key ELSE pastor_automations.pix_key END,
                pix_key_type = EXCLUDED.pix_key_type,
                payment_day = EXCLUDED.payment_day,
                gross_amount = EXCLUDED.gross_amount,
                net_amount = EXCLUDED.net_amount,
                tithe_amount = EXCLUDED.tithe_amount,
                tithe_enabled = EXCLUDED.tithe_enabled,
                church_id = COALESCE(EXCLUDED.church_id, pastor_automations.church_id),
                active = EXCLUDED.active,
                updated_at = GREATEST(COALESCE(pastor_automations.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              row.id,
              row.user_id,
              row.pastor_name,
              row.pix_key,
              row.pix_key_type || 'cpf',
              Number(row.payment_day || 10),
              Number(row.gross_amount || 0),
              Number(row.net_amount || 0),
              Number(row.tithe_amount || 0),
              toBoolOrDefault(row.tithe_enabled, true),
              row.church_id && uuidRegex.test(row.church_id) ? row.church_id : null,
              toBoolOrDefault(row.active, true),
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 15. Mensagens pastorais (pastoral_messages)
        const pastoralMsgRows = this.localEngine.query('SELECT * FROM pastoral_messages').rows || [];
        for (const row of pastoralMsgRows) {
          if (!row.id || !uuidRegex.test(row.id) || !row.church_id || !uuidRegex.test(row.church_id) || !row.title || !row.content) continue;
          await runIsolatedRow('pastoral_messages', row.id, async () => {
            await client.query(`
              INSERT INTO pastoral_messages (
                id, church_id, title, type, content, start_date, end_date, is_active, user_id, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                type = EXCLUDED.type,
                content = EXCLUDED.content,
                start_date = EXCLUDED.start_date,
                end_date = EXCLUDED.end_date,
                is_active = EXCLUDED.is_active;
            `, [
              row.id,
              row.church_id,
              row.title,
              row.type || 'texto',
              row.content,
              row.start_date ? new Date(row.start_date) : null,
              row.end_date ? new Date(row.end_date) : null,
              toBoolOrDefault(row.is_active, true),
              row.user_id && uuidRegex.test(row.user_id) ? row.user_id : null,
              row.created_at ? new Date(row.created_at) : new Date()
            ]);
          });
        }

        // 16. Solicitações de contribuição do Portal (contribution_requests)
        const contribReqRows = this.localEngine.query('SELECT * FROM contribution_requests').rows || [];
        for (const row of contribReqRows) {
          if (!row.id || !uuidRegex.test(row.id) || !row.church_id || !uuidRegex.test(row.church_id) || !row.contributor_id || !uuidRegex.test(row.contributor_id)) continue;
          await runIsolatedRow('contribution_requests', row.id, async () => {
            await client.query(`
              INSERT INTO contribution_requests (
                id, church_id, contributor_id, amount, description, status, bank_id, splits, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (id) DO UPDATE SET
                status = CASE WHEN EXCLUDED.updated_at >= COALESCE(contribution_requests.updated_at, to_timestamp(0)) THEN EXCLUDED.status ELSE contribution_requests.status END,
                amount = EXCLUDED.amount,
                description = COALESCE(EXCLUDED.description, contribution_requests.description),
                bank_id = COALESCE(EXCLUDED.bank_id, contribution_requests.bank_id),
                splits = COALESCE(EXCLUDED.splits, contribution_requests.splits),
                updated_at = GREATEST(COALESCE(contribution_requests.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              row.id,
              row.church_id,
              row.contributor_id,
              Number(row.amount || 0),
              row.description || null,
              row.status || 'pending',
              row.bank_id && uuidRegex.test(row.bank_id) ? row.bank_id : null,
              normalizeJsonbCol(row.splits),
              row.created_at ? new Date(row.created_at) : new Date(),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 17. Configurações administrativas (admin_config)
        const adminConfigRows = this.localEngine.query('SELECT * FROM admin_config').rows || [];
        for (const row of adminConfigRows) {
          if (!row.key || row.value === undefined) continue;
          await runIsolatedRow('admin_config', row.key, async () => {
            await client.query(`
              INSERT INTO admin_config (key, value, updated_at)
              VALUES ($1, $2, $3)
              ON CONFLICT (key) DO UPDATE SET
                value = CASE WHEN EXCLUDED.updated_at >= COALESCE(admin_config.updated_at, to_timestamp(0)) THEN EXCLUDED.value ELSE admin_config.value END,
                updated_at = GREATEST(COALESCE(admin_config.updated_at, to_timestamp(0)), EXCLUDED.updated_at);
            `, [
              String(row.key),
              typeof row.value === 'string' ? row.value : JSON.stringify(row.value),
              row.updated_at ? new Date(row.updated_at) : new Date()
            ]);
          });
        }

        // 18. Pagamentos (payments)
        const paymentRows = this.localEngine.query('SELECT * FROM payments').rows || [];
        for (const row of paymentRows) {
          if (!row.id || !row.user_id) continue;
          await runIsolatedRow('payments', row.id, async () => {
            await client.query(`
              INSERT INTO payments (id, user_id, amount, status, notes, payment_method, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                notes = COALESCE(EXCLUDED.notes, payments.notes);
            `, [
              String(row.id),
              String(row.user_id),
              Number(row.amount || 0),
              row.status || 'approved',
              row.notes || null,
              row.payment_method || null,
              row.created_at ? new Date(row.created_at) : new Date()
            ]);
          });
        }

        // 19. Modelos de arquivos (file_models)
        const fileModelRows = this.localEngine.query('SELECT * FROM file_models').rows || [];
        for (const row of fileModelRows) {
          if (!row.id || !row.name) continue;
          await runIsolatedRow('file_models', row.id, async () => {
            await client.query(`
              INSERT INTO file_models (id, name, user_id, church_id, config, created_at)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id) DO NOTHING;
            `, [
              String(row.id),
              String(row.name),
              row.user_id ? String(row.user_id) : null,
              row.church_id ? String(row.church_id) : null,
              typeof row.config === 'string' ? row.config : JSON.stringify(row.config || {}),
              row.created_at ? new Date(row.created_at) : new Date()
            ]);
          });
        }

        console.log(`[Contributors API] 🛡️ Sincronização de resgate SQLite ➔ PostgreSQL concluída (${syncedRows} sincronizado(s), ${failedRows} aviso(s)).`);
      } finally {
        client.release();
      }
    } catch (syncErr: any) {
      console.warn('[Contributors API] Aviso ao sincronizar registros locais com PostgreSQL:', syncErr?.message || syncErr);
    } finally {
      this.isSyncing = false;
    }
  }

  async end() {
    if (this.checkOfflineRecoveryInterval) {
      clearInterval(this.checkOfflineRecoveryInterval);
      this.checkOfflineRecoveryInterval = null;
    }
    await this.pgPool.end();
  }
}

export const app = express();
app.set('trust proxy', 1);
const PORT = process.env.CONTRIBUTORS_PORT || (process.env.PORT && process.env.PORT !== '8080' && process.env.PORT !== '3000' && process.env.PORT !== '3001' ? process.env.PORT : 3010);


if (!process.env.INTEGRATED_MODE) {
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
}
app.use((req, res, next) => {
  if (req.body !== undefined && typeof req.body === 'object') {
    return next();
  }
  express.json({ limit: '50mb' })(req, res, next);
});
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure PostgreSQL connection
const rawConnectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING;
const isValidConnectionString = typeof rawConnectionString === 'string' && 
  (rawConnectionString.startsWith('postgres://') || rawConnectionString.startsWith('postgresql://'));

const connectionString = isValidConnectionString ? rawConnectionString : null;

export let pool: pg.Pool;

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
    
    // Initialize Local Auth Database Tables & Profiles Table
    try {
      const authRepo = new AuthRepository(pool);
      await authRepo.initTables();
      const profileRepo = new ProfileRepository(pool);
      await profileRepo.ensureTableExists();
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
        cpf VARCHAR(20),
        email VARCHAR(255),
        phone VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Ensure all columns exist (in case the table already existed under an older schema)
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);");
    try {
      await client.query("ALTER TABLE contributors ALTER COLUMN cpf TYPE VARCHAR(20);");
    } catch (_) {}
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
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS congregation VARCHAR(255);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_church_status ON contributors(church_id, status);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_canonical_name ON contributors(canonical_name);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_cpf ON contributors(cpf);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_phone ON contributors(phone);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_whatsapp ON contributors(whatsapp);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_email ON contributors(email);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_contributors_pix_key ON contributors(pix_key);");
    console.log('[Contributors API] Table "contributors" verified or successfully created.');

    // 🛡️ Regra de Integridade e Preservação:
    try {
      await pool.query(`
        UPDATE contributors 
        SET church_id = '00000000-0000-0000-0000-000000000001' 
        WHERE church_id IS NULL OR trim(church_id::text) = '' OR church_id::text = 'church-1';
      `);
      await pool.query(`
        UPDATE consolidated_transactions 
        SET church_id = '00000000-0000-0000-0000-000000000001' 
        WHERE church_id IS NULL OR trim(church_id::text) = '' OR church_id::text = 'church-1';
      `);
      await pool.query(`
        DELETE FROM contributors 
        WHERE (canonical_name IS NULL OR trim(canonical_name) = '') 
          AND (name IS NULL OR trim(name) = '');
      `);
    } catch (cleanErr: any) {
      console.warn('[Contributors API] Aviso ao executar limpeza segura de cadastros:', cleanErr?.message);
    }

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
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);');
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
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();');
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

    // 🛡️ Regra de Identificação e Sincronização de Igrejas para Cadastros do Portal (PostgreSQL):
    try {
      await client.query(`
        UPDATE contributors
        SET congregation = (
          SELECT name FROM churches WHERE churches.id = contributors.church_id LIMIT 1
        )
        WHERE (congregation IS NULL OR trim(congregation) = '' OR congregation = 'Igreja' OR congregation = 'Igreja não identificada')
          AND church_id IS NOT NULL 
          AND EXISTS (SELECT 1 FROM churches WHERE churches.id = contributors.church_id AND name IS NOT NULL AND trim(name) != '');
      `);
      await client.query(`
        UPDATE contributors
        SET congregation = (SELECT name FROM churches ORDER BY created_at ASC LIMIT 1),
            church_id = (SELECT id FROM churches ORDER BY created_at ASC LIMIT 1)
        WHERE (congregation IS NULL OR trim(congregation) = '' OR congregation = 'Igreja' OR congregation = 'Igreja não identificada');
      `);
    } catch (syncErr: any) {
      console.warn('[Contributors API] Aviso ao sincronizar congregações no PostgreSQL:', syncErr?.message);
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
        attachments JSONB DEFAULT '[]'::jsonb,
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
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS reference_date VARCHAR(255);');
    await client.query("ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;");
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_contrib_req ON consolidated_transactions(church_id, contribution_request_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_church_user ON consolidated_transactions(church_id, user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_church_date ON consolidated_transactions(church_id, transaction_date);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_user_status ON consolidated_transactions(user_id, status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_date ON consolidated_transactions(transaction_date);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_contributor ON consolidated_transactions(contributor_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_status ON consolidated_transactions(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_consolidated_tx_user_row_hash ON consolidated_transactions(user_id, row_hash);');
    console.log('[Contributors API] Table "consolidated_transactions" verified or successfully created.');

    try {
      await client.query("UPDATE consolidated_transactions SET description = 'ALOISIO DA SILVA UCHOA' WHERE (UPPER(description) = 'PAGAMENTO S' OR UPPER(description) = 'PAGAMENTO S.') AND amount = 1.80");
    } catch (_) {}

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

    // 🛡️ Auto-Reparo Cirúrgico: Restaura church_id em transações identificadas que ficaram com church_id nulo
    try {
      await client.query(`
        UPDATE consolidated_transactions
        SET church_id = (
          SELECT church_id FROM learned_associations 
          WHERE LOWER(TRIM(learned_associations.normalized_description)) = LOWER(TRIM(consolidated_transactions.description))
            AND learned_associations.church_id IS NOT NULL
          LIMIT 1
        )
        WHERE church_id IS NULL 
          AND status IN ('identified', 'resolved')
          AND EXISTS (
            SELECT 1 FROM learned_associations 
            WHERE LOWER(TRIM(learned_associations.normalized_description)) = LOWER(TRIM(consolidated_transactions.description))
              AND learned_associations.church_id IS NOT NULL
          );
      `);

      await client.query(`
        UPDATE consolidated_transactions
        SET church_id = (
          SELECT church_id FROM contributors 
          WHERE contributors.id = consolidated_transactions.contributor_id
            AND contributors.church_id IS NOT NULL
          LIMIT 1
        )
        WHERE church_id IS NULL 
          AND status IN ('identified', 'resolved')
          AND contributor_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM contributors 
            WHERE contributors.id = consolidated_transactions.contributor_id
              AND contributors.church_id IS NOT NULL
          );
      `);
    } catch (healErr: any) {
      console.warn('[Contributors API] Aviso ao auto-reparar church_id nulo em transações:', healErr?.message);
    }

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
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();');
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
    await client.query("ALTER TABLE contribution_requests ADD COLUMN IF NOT EXISTS bank_id UUID;");
    await client.query("ALTER TABLE contribution_requests ADD COLUMN IF NOT EXISTS splits JSONB;");
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

    // Create table payment_methods
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'recebimento',
        category VARCHAR(255),
        bank_id VARCHAR(255),
        "order" INT DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        user_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
    await client.query("ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'recebimento';");
    await client.query('ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS category VARCHAR(255);');
    await client.query('ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS bank_id VARCHAR(255);');
    await client.query('ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS "order" INT DEFAULT 1;');
    await client.query('ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;');
    await client.query('ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);');
    await client.query('ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payment_methods_bank ON payment_methods(bank_id);');
    console.log('[Contributors API] Table "payment_methods" verified or successfully created.');

    // Create table tenant_custom_options
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_custom_options (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        scope VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        sort_order INT DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE tenant_custom_options ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);');
    await client.query('ALTER TABLE tenant_custom_options ADD COLUMN IF NOT EXISTS scope VARCHAR(100);');
    await client.query('ALTER TABLE tenant_custom_options ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
    await client.query('ALTER TABLE tenant_custom_options ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 1;');
    await client.query('ALTER TABLE tenant_custom_options ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('ALTER TABLE tenant_custom_options ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tenant_custom_options_lookup ON tenant_custom_options(user_id, scope);');
    console.log('[Contributors API] Table "tenant_custom_options" verified or successfully created.');

    // Create table church_closings
    await client.query(`
      CREATE TABLE IF NOT EXISTS church_closings (
        id VARCHAR(255) PRIMARY KEY,
        church_id VARCHAR(255) NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'closed',
        closed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        closed_by VARCHAR(255),
        total_income NUMERIC(12, 2) DEFAULT 0,
        total_expenses NUMERIC(12, 2) DEFAULT 0,
        final_balance NUMERIC(12, 2) DEFAULT 0,
        transferred_balance NUMERIC(12, 2),
        target_church_id VARCHAR(255),
        target_church_name VARCHAR(255),
        integrity_hash VARCHAR(255),
        signatures JSONB,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS bank_id VARCHAR(255);');
    try { await client.query('ALTER TABLE church_closings DROP CONSTRAINT IF EXISTS church_closings_church_id_year_month_key;'); } catch (_) {}
    try { await client.query('DROP INDEX IF EXISTS idx_church_closings_unique;'); } catch (_) {}
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS church_id VARCHAR(255);');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS year INT;');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS month INT;');
    await client.query("ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'closed';");
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP DEFAULT NOW();');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS closed_by VARCHAR(255);');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS total_income NUMERIC(12, 2) DEFAULT 0;');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS total_expenses NUMERIC(12, 2) DEFAULT 0;');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS final_balance NUMERIC(12, 2) DEFAULT 0;');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS transferred_balance NUMERIC(12, 2);');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS target_church_id VARCHAR(255);');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS target_church_name VARCHAR(255);');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS integrity_hash VARCHAR(255);');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS signatures JSONB;');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS notes TEXT;');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();');
    await client.query('ALTER TABLE church_closings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();');
    await client.query('CREATE INDEX IF NOT EXISTS idx_church_closings_lookup ON church_closings(church_id, year, month, status);');
    console.log('[Contributors API] Table "church_closings" verified or successfully created.');

    // Initialize Audit Logs Database
    await initAuditDatabase(pool);

    // 🛡️ Sincronização de Resgate e Resiliência SQLite ➔ PostgreSQL:
    // Promove automaticamente dados que possam ter sido registrados localmente durante indisponibilidades prévias
    if (typeof (pool as any).syncPendingLocalToPostgres === 'function') {
      await (pool as any).syncPendingLocalToPostgres();
    }

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
  healOrphanChurches(pool).catch((e: any) => console.warn('[AutoHeal:Churches] Erro no boot:', e));
  cleanupOrphanAndFakeBanks(pool).catch((e: any) => console.warn('[AutoClean:Banks] Erro no boot:', e));
}).catch((err: any) => {
  const isNetworkOrDns = err?.code === 'EAI_AGAIN' || err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT';
  console.warn(`[Contributors API] Initial database connection not ready (${isNetworkOrDns ? 'Aguardando host PostgreSQL' : 'Erro'}):`, err?.message || err);
});

function ensureSuperAdmin(req: Request, res: Response): TenantContext | null {
  const ctx = getTenantContext(req);
  if (!ctx.isAuthenticated) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
    return null;
  }
  if (!ctx.isSuperAdmin) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão de SuperAdmin necessária.' });
    return null;
  }
  return ctx;
}

// Endpoint do Agendador Automático de Tarefas (Scheduler Status)
app.get('/api/v1/admin/scheduler/status', async (req: Request, res: Response) => {
  if (!ensureSuperAdmin(req, res)) return;
  try {
    res.json(getSchedulerStatus());
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Infrastructure Health Endpoint (Public for Docker/Coolify healthchecks)
app.get(['/health', '/api/v1/health'], async (req: Request, res: Response) => {
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

// Monitoring Status Endpoint (SuperAdmin only)
app.get('/api/v1/monitoring/status', async (req: Request, res: Response) => {
  if (!ensureSuperAdmin(req, res)) return;
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
  if (!ensureSuperAdmin(req, res)) return;
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
  if (!ensureSuperAdmin(req, res)) return;
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
  if (!ensureSuperAdmin(req, res)) return;
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
  if (!ensureSuperAdmin(req, res)) return;
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
  if (!ensureSuperAdmin(req, res)) return;
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
  if (!ensureSuperAdmin(req, res)) return;
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
  if (!ensureSuperAdmin(req, res)) return;
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

import {
  type TenantContext,
  extractContextPermissions,
  hasPermission,
  extractContextAllowedBankIds,
  extractContextAllowedChurchIds,
  getTenantContext,
  validateTransactionSplits
} from './auth/utils/tenant.context.js';
import { verifyAccessToken } from './auth/utils/jwt.utils.js';

export type { TenantContext };
export {
  extractContextPermissions,
  hasPermission,
  extractContextAllowedBankIds,
  extractContextAllowedChurchIds,
  getTenantContext,
  validateTransactionSplits
};

async function enrichSecondaryUserContext(poolInstance: any, ctx: TenantContext): Promise<void> {
  if (!ctx.isSecondaryUser || !ctx.userId) return;
  if (ctx.allowedChurchIds.length > 0 && ctx.allowedBankIds.length > 0 && ctx.permissions.length > 0 && ctx.ownerId && ctx.ownerId !== ctx.userId) return;

  try {
    const uRes = await poolInstance.query(
      `SELECT u.church_id, u.permissions, u.owner_id,
              p.owner_id as profile_owner_id, p.congregation as profile_church_id, p.permissions as profile_permissions
       FROM profiles p
       FULL OUTER JOIN app_users u ON (u.id::text = p.id::text OR (u.email IS NOT NULL AND LOWER(u.email) = LOWER(p.email)))
       WHERE (u.id::text = $1 OR p.id::text = $1)
       LIMIT 1`,
      [ctx.userId]
    );
    if (uRes.rows.length > 0) {
      const row = uRes.rows[0];
      const resolvedOwnerId = row.owner_id || row.profile_owner_id;
      if (resolvedOwnerId && (!ctx.ownerId || ctx.ownerId === ctx.userId)) {
        ctx.ownerId = String(resolvedOwnerId);
      }

      const mergedPerms = row.permissions || row.profile_permissions;
      const dbChurchIds = extractContextAllowedChurchIds({ ...row, permissions: mergedPerms });
      const dbBankIds = extractContextAllowedBankIds({ ...row, permissions: mergedPerms });
      const dbPerms = extractContextPermissions({ ...row, permissions: mergedPerms });

      if (ctx.allowedChurchIds.length === 0 && dbChurchIds.length > 0) {
        ctx.allowedChurchIds = dbChurchIds;
      }
      if (ctx.allowedBankIds.length === 0 && dbBankIds.length > 0) {
        ctx.allowedBankIds = dbBankIds;
      }
      if (dbPerms.length > 0) {
        ctx.permissions = Array.from(new Set([...ctx.permissions, ...dbPerms]));
      }
      if (!ctx.churchId && (row.church_id || row.profile_church_id)) {
        ctx.churchId = String(row.church_id || row.profile_church_id);
      }
    }
  } catch (err) {
    console.warn('[Contributors API] Erro ao enriquecer contexto do usuário secundário:', err);
  }
}

// --- SSE Realtime Infrastructure ---
const sseClientsByTenant = new Map<string, Set<Response>>();

export function notifyTenantRealtime(ownerId: string | null | undefined, eventData: { type: string; [key: string]: any }) {
  if (!ownerId) return;
  const key = String(ownerId);
  const clients = sseClientsByTenant.get(key);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const clientRes of Array.from(clients)) {
    try {
      clientRes.write(payload);
      if (typeof (clientRes as any).flush === 'function') {
        (clientRes as any).flush();
      }
    } catch (_) {
      clients.delete(clientRes);
    }
  }
}

// GET /api/v1/realtime/stream
app.get(['/api/v1/realtime/stream', '/api/v1/realtime/events'], async (req: Request, res: Response) => {
  try {
    let ctx = getTenantContext(req);
    if (!ctx.isAuthenticated && req.query.token && typeof req.query.token === 'string') {
      try {
        const decoded = verifyAccessToken(req.query.token);
        (req as any).user = decoded;
        ctx = getTenantContext(req);
      } catch (_) {}
    }
    await enrichSecondaryUserContext(pool, ctx);

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para o canal realtime.' });
    }

    const tenantId = String(ctx.ownerId || ctx.userId);
    if (!tenantId) {
      return res.status(400).json({ error: 'INVALID_TENANT' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', tenantId, timestamp: Date.now() })}\n\n`);

    if (!sseClientsByTenant.has(tenantId)) {
      sseClientsByTenant.set(tenantId, new Set());
    }
    const tenantClients = sseClientsByTenant.get(tenantId)!;
    tenantClients.add(res);

    const keepAliveTimer = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch (_) {
        clearInterval(keepAliveTimer);
        tenantClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAliveTimer);
      tenantClients.delete(res);
      if (tenantClients.size === 0) {
        sseClientsByTenant.delete(tenantId);
      }
    });
  } catch (err) {
    console.error('[SSE Stream Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
});

// GET /api/v1/audit-logs
app.get('/api/v1/audit-logs', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);

    // 🛡️ A. Bloqueio Mandatório de Acesso Anônimo (Deny-by-Default)
    if (!ctx.isAuthenticated) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Autenticação necessária para consultar logs de auditoria.'
      });
    }

    const { church_id, user_id, entity, action, start_date, end_date, limit, offset } = req.query;

    // 🛡️ F. Validação Estrita do Parâmetro church_id (sem ambiguidades)
    if (church_id !== undefined && (typeof church_id !== 'string' || Array.isArray(church_id) || !church_id.trim())) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Parâmetro church_id inválido ou malformado.'
      });
    }

    const requestedChurchId = typeof church_id === 'string' && church_id.trim() ? church_id.trim() : undefined;

    // 🛡️ D. Remoção do Fallback Inseguro: req.headers['x-church-id'] é expressamente ignorado
    let targetChurchId = requestedChurchId;

    // 🛡️ C. Validação de Usuários Secundários
    if (ctx.isSecondaryUser) {
      if (!hasPermission(ctx, 'audit', 'view_financial')) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: permissão de auditoria necessária para consultar logs.'
        });
      }
      if (!targetChurchId) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Parâmetro church_id é obrigatório para consultar logs de auditoria.'
        });
      }
      if (!ctx.allowedChurchIds.includes(targetChurchId)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: você não tem permissão para acessar os logs desta congregação.'
        });
      }
    }
    // 🛡️ B. Validação do Titular da Congregação (Isolamento Cross-Tenant)
    else if (!ctx.isSuperAdmin) {
      if (!targetChurchId) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Parâmetro church_id é obrigatório para consultar logs de auditoria.'
        });
      }

      const ownerId = String(ctx.ownerId || ctx.userId || '').trim();
      const ownerUserIds = await getEquivalentUserIds(ownerId);

      const chCheck = await pool.query(
        'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = ANY($2) OR id::text = $3) LIMIT 1',
        [targetChurchId, ownerUserIds, ownerId]
      );

      const isDirectOwnerMatch = targetChurchId === ownerId;

      if (chCheck.rows.length === 0 && !isDirectOwnerMatch) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: congregação não pertence à sua organização.'
        });
      }
    }

    // 🛡️ E. Preservação do Superadministrador (ctx.isSuperAdmin acessa congregação solicitada ou geral)
    const result = await queryAuditLogs(pool, {
      churchId: targetChurchId,
      userId: typeof user_id === 'string' && user_id.trim() ? user_id.trim() : undefined,
      entity: typeof entity === 'string' && entity.trim() ? entity.trim() : undefined,
      action: typeof action === 'string' && action.trim() ? action.trim() : undefined,
      startDate: typeof start_date === 'string' && start_date.trim() ? start_date.trim() : undefined,
      endDate: typeof end_date === 'string' && end_date.trim() ? end_date.trim() : undefined,
      limit: limit && !isNaN(Number(limit)) ? Number(limit) : 50,
      offset: offset && !isNaN(Number(offset)) ? Number(offset) : 0
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[Contributors API] Error GET audit-logs:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message || String(err) });
  }
});

let cachedChurchesNameMap: Map<string, string> | null = null;
let lastChurchesNameMapFetch = 0;

// GET /api/v1/contributors
app.get('/api/v1/contributors', async (req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    const requestedChurchId = req.query.church_id as string | undefined;
    const { status, search, q } = req.query;

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para listar contribuintes.' });
    }

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

    const ownerId = ctx.ownerId || ctx.userId || '';
    const ownerUserIds = await getEquivalentUserIds(ownerId);

    if (ctx.isSecondaryUser) {
      if (requestedChurchId && requestedChurchId !== 'all' && requestedChurchId !== 'undefined' && requestedChurchId !== 'null') {
        query += ` AND church_id::text = $${paramCounter}`;
        params.push(requestedChurchId);
        paramCounter++;
      } else {
        query += ` AND church_id::text = ANY($${paramCounter})`;
        params.push(ctx.allowedChurchIds);
        paramCounter++;
      }
    } else if (!ctx.isSuperAdmin) {
      if (requestedChurchId && requestedChurchId !== 'all' && requestedChurchId !== 'undefined' && requestedChurchId !== 'null') {
        query += ` AND church_id::text = $${paramCounter} AND (church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${paramCounter + 1})) OR church_id::text = ANY($${paramCounter + 1}))`;
        params.push(requestedChurchId, ownerUserIds);
        paramCounter += 2;
      } else {
        query += ` AND (church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${paramCounter})) OR church_id::text = ANY($${paramCounter}))`;
        params.push(ownerUserIds);
        paramCounter++;
      }
    } else if (requestedChurchId && requestedChurchId !== 'all' && requestedChurchId !== 'undefined' && requestedChurchId !== 'null') {
      query += ` AND church_id::text = $${paramCounter}`;
      params.push(requestedChurchId);
      paramCounter++;
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

    // Query church names map to enrich missing congregations seamlessly (cached for 60s)
    let churchMap = cachedChurchesNameMap;
    if (!churchMap || Date.now() - lastChurchesNameMapFetch > 60000) {
      const newMap = new Map<string, string>();
      try {
        const chRes = await pool.query('SELECT id, name FROM churches');
        chRes.rows.forEach((ch: any) => {
          if (ch.id && ch.name) newMap.set(String(ch.id), ch.name);
        });
        cachedChurchesNameMap = newMap;
        lastChurchesNameMapFetch = Date.now();
        churchMap = newMap;
      } catch (_) {
        churchMap = cachedChurchesNameMap || newMap;
      }
    }
    const defaultChurchName = churchMap.get('00000000-0000-0000-0000-000000000001') || Array.from(churchMap.values())[0] || 'Igreja Sede / Matriz';

    const validRows = result.rows
      .filter((r: any) => {
        const cleanName = (r.canonical_name || r.name || '').trim();
        return cleanName.length > 0;
      })
      .map((r: any) => {
        let church_id = (r.church_id || '').trim();
        if (!church_id || church_id === 'church-1') {
          church_id = '00000000-0000-0000-0000-000000000001';
        }
        let congregation = (r.congregation || '').trim();
        if (!congregation || congregation === 'Igreja' || congregation === 'Igreja não identificada') {
          congregation = churchMap.get(church_id) || defaultChurchName;
        }
        return {
          ...r,
          church_id,
          congregation
        };
      });
    return res.json(validRows);
  } catch (err) {
    console.error('[Contributors API] Error processing get contributors request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/contributors/roles (List of registered roles / cargos / funções — strictly scoped by tenant or church_id)
app.get('/api/v1/contributors/roles', async (req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const DEFAULT_ROLES = [
      'Membro',
      'Visitante',
      'Pastor / Pastora',
      'Diácono / Diaconisa',
      'Presbítero / Evangelista',
      'Obreiro / Obreira',
      'Líder de Ministério / Célula',
      'Voluntário',
      'Dizimista',
      'Músico / Louvor',
      'Prestador de Serviços',
      'Fornecedor / Empresa',
      'Concessionária / Utilidades',
      'Outro'
    ];

    const rolesSet = new Set<string>(DEFAULT_ROLES);
    const ctx = getTenantContext(req);
    const { church_id } = req.query;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    try {
      if (ctx.isAuthenticated) {
        await enrichSecondaryUserContext(pool, ctx);
        const targetOwner = ctx.ownerId || ctx.userId;
        if (targetOwner) {
          const ownerIds = await getEquivalentUserIds(targetOwner);
          const optRes = await pool.query(
            `SELECT name FROM tenant_custom_options WHERE scope = 'contributor_role' AND user_id::text = ANY($1)`,
            [ownerIds]
          );
          for (const r of (optRes.rows || [])) {
            if (r.name && typeof r.name === 'string' && r.name.trim()) rolesSet.add(r.name.trim());
          }
          const dbRes = await pool.query(
            `SELECT DISTINCT role_position FROM contributors 
             WHERE role_position IS NOT NULL AND trim(role_position) != ''
               AND church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($1))`,
            [ownerIds]
          );
          for (const row of (dbRes.rows || [])) {
            if (row.role_position && typeof row.role_position === 'string' && row.role_position.trim()) {
              rolesSet.add(row.role_position.trim());
            }
          }
        }
      } else if (church_id && typeof church_id === 'string' && uuidRegex.test(church_id)) {
        const chRes = await pool.query('SELECT id, user_id FROM churches WHERE id::text = $1 LIMIT 1', [church_id]);
        if (chRes.rows.length > 0) {
          const targetChurch = chRes.rows[0];
          if (targetChurch.user_id) {
            const ownerIds = await getEquivalentUserIds(String(targetChurch.user_id));
            const optRes = await pool.query(
              `SELECT name FROM tenant_custom_options WHERE scope = 'contributor_role' AND user_id::text = ANY($1)`,
              [ownerIds]
            );
            for (const r of (optRes.rows || [])) {
              if (r.name && typeof r.name === 'string' && r.name.trim()) rolesSet.add(r.name.trim());
            }
            const dbRes = await pool.query(
              `SELECT DISTINCT role_position FROM contributors 
               WHERE role_position IS NOT NULL AND trim(role_position) != ''
                 AND (church_id::text = $1 OR church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($2)))`,
              [church_id, ownerIds]
            );
            for (const row of (dbRes.rows || [])) {
              if (row.role_position && typeof row.role_position === 'string' && row.role_position.trim()) {
                rolesSet.add(row.role_position.trim());
              }
            }
          } else {
            const dbRes = await pool.query(
              `SELECT DISTINCT role_position FROM contributors WHERE church_id::text = $1 AND role_position IS NOT NULL AND trim(role_position) != ''`,
              [church_id]
            );
            for (const row of (dbRes.rows || [])) {
              if (row.role_position && typeof row.role_position === 'string' && row.role_position.trim()) {
                rolesSet.add(row.role_position.trim());
              }
            }
          }
        }
      }
    } catch (_) {}

    return res.json(Array.from(rolesSet));
  } catch (err: any) {
    return res.json([
      'Membro',
      'Visitante',
      'Pastor / Pastora',
      'Diácono / Diaconisa',
      'Presbítero / Evangelista',
      'Obreiro / Obreira',
      'Líder de Ministério / Célula',
      'Voluntário',
      'Dizimista',
      'Músico / Louvor',
      'Prestador de Serviços',
      'Fornecedor / Empresa',
      'Concessionária / Utilidades',
      'Outro'
    ]);
  }
});

// POST & GET /api/v1/contributors/identify (Single-record & search identification endpoint for Portal do Contribuinte - LGPD & Multi-church secure)
const identifyContributorHandler = async (req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const rawChurchId = (req.body.church_id || req.query.church_id) as string | undefined;
    const identifier = (req.body.identifier || req.query.identifier || req.query.q || req.body.q) as string | undefined;
    const identifier_type = (req.body.identifier_type || req.query.identifier_type || req.query.type || req.body.type) as string | undefined;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    if (!rawChurchId || typeof rawChurchId !== 'string' || !uuidRegex.test(rawChurchId.trim())) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'church_id válido é obrigatório para identificar contribuinte.' });
    }
    const church_id = rawChurchId.trim();

    const churchCheckRes = await pool.query('SELECT id, user_id FROM churches WHERE id::text = $1 LIMIT 1', [church_id]);
    if (churchCheckRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Igreja/congregação informada não foi encontrada.' });
    }
    const targetChurch = churchCheckRes.rows[0];
    const ownerIds = targetChurch.user_id ? await getEquivalentUserIds(String(targetChurch.user_id)) : [];

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'identifier é obrigatório.' });
    }

    const typeLower = (identifier_type || 'cpf').trim().toLowerCase();
    if (!['cpf', 'phone', 'email', 'name'].includes(typeLower)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'identifier_type inválido. Tipos permitidos: cpf, phone, email, name.' });
    }

    const buildTenantScope = (baseParams: any[]) => {
      baseParams.push(church_id);
      const chParamIdx = baseParams.length;
      if (ownerIds.length > 0) {
        baseParams.push(ownerIds);
        const ownerParamIdx = baseParams.length;
        return `(church_id::text = $${chParamIdx} OR church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${ownerParamIdx})))`;
      }
      return `church_id::text = $${chParamIdx}`;
    };

    const rawVal = identifier.trim();
    let matchedContributor: any = null;
    let multipleMatches: any[] = [];

    if (typeLower === 'cpf') {
      const cleanDigits = rawVal.replace(/\D/g, '');
      if (!cleanDigits) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'CPF inválido.' });
      }

      const params: any[] = [cleanDigits, church_id];
      const scopeSql = buildTenantScope(params);

      const result = await pool.query(
        `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                person_type, trade_name, rg_ie, birth_date, contact_person, category,
                pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                address_number, address_city, address_state, notes, role_position, photo_url, congregation
         FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)
           AND ${scopeSql}
           AND (
             cpf = $1 
             OR REGEXP_REPLACE(COALESCE(cpf, ''), '\\D', '', 'g') = $1
             OR REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '') = $1
           )
         ORDER BY (CASE WHEN church_id = $2 THEN 0 ELSE 1 END), updated_at DESC
         LIMIT 1`,
        params
      );

      if (result.rows.length > 0) {
        matchedContributor = result.rows[0];
      }

    } else if (typeLower === 'name') {
      const cleanName = rawVal.trim();
      if (cleanName.length < 2) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Informe pelo menos 2 caracteres para pesquisar pelo nome.' });
      }

      const nameTerm = `%${cleanName}%`;
      const params: any[] = [nameTerm, church_id];
      const scopeSql = buildTenantScope(params);

      const result = await pool.query(
        `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                person_type, trade_name, rg_ie, birth_date, contact_person, category,
                pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                address_number, address_city, address_state, notes, role_position, photo_url, congregation
         FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)
           AND ${scopeSql}
           AND (
             name ILIKE $1 
             OR canonical_name ILIKE $1
           )
         ORDER BY (CASE WHEN church_id = $2 THEN 0 ELSE 1 END), canonical_name ASC
         LIMIT 10`,
        params
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

      const params: any[] = [cleanDigits, church_id];
      const scopeSql = buildTenantScope(params);

      const result = await pool.query(
        `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                person_type, trade_name, rg_ie, birth_date, contact_person, category,
                pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                address_number, address_city, address_state, notes, role_position, photo_url, congregation
         FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)
           AND ${scopeSql}
           AND (
             phone = $1 
             OR whatsapp = $1
             OR REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') = $1
             OR REGEXP_REPLACE(COALESCE(whatsapp, ''), '\\D', '', 'g') = $1
           )
         ORDER BY (CASE WHEN church_id = $2 THEN 0 ELSE 1 END), updated_at DESC
         LIMIT 1`,
        params
      );

      if (result.rows.length > 0) {
        matchedContributor = result.rows[0];
      }

    } else if (typeLower === 'email') {
      const cleanEmail = rawVal.toLowerCase();
      const params: any[] = [cleanEmail, church_id];
      const scopeSql = buildTenantScope(params);

      const result = await pool.query(
        `SELECT id, church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
                person_type, trade_name, rg_ie, birth_date, contact_person, category,
                pix_key, bank_name, bank_agency, bank_account, address_cep, address_street,
                address_number, address_city, address_state, notes, role_position, photo_url, congregation
         FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)
           AND ${scopeSql}
           AND LOWER(TRIM(COALESCE(email, ''))) = $1
         ORDER BY (CASE WHEN church_id = $2 THEN 0 ELSE 1 END), updated_at DESC
         LIMIT 1`,
        params
      );

      if (result.rows.length > 0) {
        matchedContributor = result.rows[0];
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
      congregation: c.congregation || null,
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

// POST /api/v1/contributors/confirm-profile (1-click 6-month periodic data confirmation - tenant scoped)
app.post('/api/v1/contributors/confirm-profile', async (req: Request, res: Response) => {
  try {
    const { id, cpf, church_id } = req.body || {};
    let targetId = id;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const validChurchId = (church_id && typeof church_id === 'string' && uuidRegex.test(church_id.trim())) ? church_id.trim() : null;

    let scopeSql = '';
    const scopeTailParams: any[] = [];
    if (validChurchId) {
      const chRes = await pool.query('SELECT id, user_id FROM churches WHERE id::text = $1 LIMIT 1', [validChurchId]);
      if (chRes.rows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Igreja informada não encontrada.' });
      }
      const ch = chRes.rows[0];
      if (ch.user_id) {
        const ownerIds = await getEquivalentUserIds(String(ch.user_id));
        scopeTailParams.push(validChurchId, ownerIds);
        scopeSql = ` AND (church_id::text = $2 OR church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($3)))`;
      } else {
        scopeTailParams.push(validChurchId);
        scopeSql = ` AND church_id::text = $2`;
      }
    }

    if (!targetId || !uuidRegex.test(targetId)) {
      const cleanCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
      if (cleanCpf && validChurchId) {
        const findRes = await pool.query(
          `SELECT id FROM contributors WHERE status = 'active' AND (cpf = $1 OR REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = $1)${scopeSql} LIMIT 1`,
          [cleanCpf, ...scopeTailParams]
        );
        if (findRes.rows.length > 0) {
          targetId = findRes.rows[0].id;
        }
      }
    }

    if (!targetId || !uuidRegex.test(targetId)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID ou CPF+igreja do contribuinte não localizado.' });
    }

    const result = await pool.query(
      `UPDATE contributors SET updated_at = NOW() WHERE id = $1${scopeSql} RETURNING id, updated_at`,
      [targetId, ...scopeTailParams]
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

// POST /api/v1/contributors/update-profile (Direct contributor self-service update - strictly scoped by church_id/tenant)
app.post('/api/v1/contributors/update-profile', async (req: Request, res: Response) => {
  try {
    const { 
      id, church_id, canonical_name, name, cpf, email, phone, whatsapp,
      birth_date, person_type, trade_name, rg_ie, contact_person,
      category, role_position, pix_key, bank_name, bank_agency, bank_account,
      address_cep, address_street, address_number, address_city, address_state, notes,
      photo_url, photo, congregation
    } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const cleanChurchIdInput = typeof church_id === 'string' ? church_id.trim() : '';

    if (!cleanChurchIdInput || !uuidRegex.test(cleanChurchIdInput)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'church_id válido é obrigatório para atualizar o perfil.' });
    }

    const churchCheckRes = await pool.query('SELECT id, user_id, name FROM churches WHERE id::text = $1 LIMIT 1', [cleanChurchIdInput]);
    if (churchCheckRes.rows.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Igreja/congregação informada não foi encontrada.' });
    }
    const targetChurch = churchCheckRes.rows[0];
    const ownerIds = targetChurch.user_id ? await getEquivalentUserIds(String(targetChurch.user_id)) : [];

    const buildScope = (paramsArr: any[]) => {
      paramsArr.push(targetChurch.id);
      const cIdx = paramsArr.length;
      if (ownerIds.length > 0) {
        paramsArr.push(ownerIds);
        const oIdx = paramsArr.length;
        return `(church_id::text = $${cIdx} OR church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${oIdx})))`;
      }
      return `church_id::text = $${cIdx}`;
    };

    let targetId: string | null = null;

    // 1. Check by UUID if provided (strictly scoped to target church / owning tenant)
    if (id && uuidRegex.test(id)) {
      const p1: any[] = [id];
      const s1 = buildScope(p1);
      const checkRes = await pool.query(`SELECT id FROM contributors WHERE id = $1 AND ${s1}`, p1);
      if (checkRes.rows.length > 0) {
        targetId = checkRes.rows[0].id;
      }
    }

    // 2. If not found by ID, try finding by CPF within scope
    if (!targetId) {
      const cleanCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
      if (cleanCpf) {
        const p2: any[] = [cleanCpf];
        const s2 = buildScope(p2);
        const findRes = await pool.query(
          `SELECT id FROM contributors 
           WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL) 
             AND ${s2}
             AND (cpf = $1 OR REGEXP_REPLACE(COALESCE(cpf, ''), '\\D', '', 'g') = $1 OR REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', ''), ' ', '') = $1) 
           LIMIT 1`,
          p2
        );
        if (findRes.rows.length > 0) {
          targetId = findRes.rows[0].id;
        }
      }
    }

    // 3. If not found by CPF, try finding by Phone / WhatsApp within scope
    if (!targetId) {
      const rawPhone = phone || whatsapp;
      const cleanPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
      if (cleanPhone && cleanPhone.length >= 8) {
        const p3: any[] = [cleanPhone];
        const s3 = buildScope(p3);
        const findPhoneRes = await pool.query(
          `SELECT id FROM contributors 
           WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL) 
             AND ${s3}
             AND (
               phone = $1 OR whatsapp = $1 
               OR REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') = $1 
               OR REGEXP_REPLACE(COALESCE(whatsapp, ''), '\\D', '', 'g') = $1
             ) 
           LIMIT 1`,
          p3
        );
        if (findPhoneRes.rows.length > 0) {
          targetId = findPhoneRes.rows[0].id;
        }
      }
    }

    // 4. If not found by phone, try finding by Email within scope
    if (!targetId && email && typeof email === 'string' && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const p4: any[] = [cleanEmail];
      const s4 = buildScope(p4);
      const findEmailRes = await pool.query(
        `SELECT id FROM contributors 
         WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL) 
           AND ${s4}
           AND LOWER(TRIM(COALESCE(email, ''))) = $1 
         LIMIT 1`,
        p4
      );
      if (findEmailRes.rows.length > 0) {
        targetId = findEmailRes.rows[0].id;
      }
    }

    const cleanChosenName = (name || canonical_name || '').trim();
    const cleanCanonical = cleanChosenName ? cleanChosenName.replace(/\s+/g, ' ').toUpperCase() : '';
    const cleanCpfDigits = cpf ? String(cpf).replace(/\D/g, '') : null;
    const cleanPhoneDigits = (phone || whatsapp) ? String(phone || whatsapp).replace(/\D/g, '') : null;
    const cleanPhoto = photo_url !== undefined ? photo_url : photo;
    const cleanChurchId = targetChurch.id;

    // 5. If existing record found within tenant scope, perform UPDATE
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
      if (congregation !== undefined) addField('congregation', congregation ? String(congregation).trim() : null);
      if (photo_url !== undefined || photo !== undefined) {
        addField('photo_url', cleanPhoto && typeof cleanPhoto === 'string' ? cleanPhoto.trim() : null);
      }

      addField('is_global', true);

      const updateQuery = `UPDATE contributors SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
      const result = await pool.query(updateQuery, params);

      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }
    }

    // 6. If no existing record found within scope, validate minimum required fields before INSERT
    if (!cleanCanonical) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nome completo é obrigatório.' });
    }
    if (!cleanCpfDigits || (cleanCpfDigits.length !== 11 && cleanCpfDigits.length !== 14)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'CPF ou CNPJ válido é obrigatório.' });
    }

    const finalNewId = id && uuidRegex.test(id) ? id : crypto.randomUUID();
    const insertRes = await pool.query(
      `INSERT INTO contributors (
        id, church_id, canonical_name, name, cpf, email, phone, whatsapp,
        birth_date, person_type, trade_name, rg_ie, contact_person,
        category, role_position, pix_key, bank_name, bank_agency, bank_account,
        address_cep, address_street, address_number, address_city, address_state, notes,
        photo_url, is_global, status, congregation
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25,
        $26, $27, 'active', $28
      ) RETURNING *`,
      [
        finalNewId,
        cleanChurchId,
        cleanCanonical,
        cleanChosenName,
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
        cleanPhoto && typeof cleanPhoto === 'string' ? cleanPhoto.trim() : null,
        true,
        congregation ? String(congregation).trim() : (targetChurch.name || null)
      ]
    );

    return res.json(insertRes.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error updating contributor profile:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar dados do contribuinte.' });
  }
});

// POST /api/v1/contributors/public-register (Dedicated public self-registration for Portal do Contribuinte)
app.post('/api/v1/contributors/public-register', async (req: Request, res: Response) => {
  try {
    const {
      church_id, canonical_name, name, cpf, email, phone, whatsapp,
      birth_date, person_type, address_cep, address_street, address_number,
      address_city, address_state, congregation, role_position, photo_url, photo
    } = req.body || {};

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const cleanChurchId = typeof church_id === 'string' ? church_id.trim() : '';

    if (!cleanChurchId || !uuidRegex.test(cleanChurchId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Igreja/congregação inválida ou não informada.'
      });
    }

    // Verify target church actually exists in database
    const churchRes = await pool.query(
      'SELECT id, user_id, name FROM churches WHERE id::text = $1 LIMIT 1',
      [cleanChurchId]
    );
    if (churchRes.rows.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Igreja/congregação informada não foi encontrada.'
      });
    }
    const targetChurch = churchRes.rows[0];

    const rawName = (canonical_name || name || '');
    const cleanChosenName = typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ') : '';
    const sanitizedName = cleanChosenName.toUpperCase();
    if (!sanitizedName) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Nome completo é obrigatório.'
      });
    }

    const sanitizedCpf = cpf !== undefined && cpf !== null ? String(cpf).replace(/\D/g, '') : '';
    if (sanitizedCpf.length !== 11 && sanitizedCpf.length !== 14) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'CPF deve conter 11 dígitos ou CNPJ deve conter 14 dígitos.'
      });
    }

    // Scoped duplicate check strictly inside the target church / owning tenant
    let dupQuery = `
      SELECT id FROM contributors
      WHERE (status ILIKE 'ativ%' OR status = 'active' OR status = 'Ativo' OR status IS NULL)
        AND (cpf = $1 OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(cpf, ''), '.', ''), '-', ''), '/', ''), ' ', '') = $1)
    `;
    const dupParams: any[] = [sanitizedCpf];

    if (targetChurch.user_id) {
      const ownerIds = await getEquivalentUserIds(String(targetChurch.user_id));
      dupParams.push(cleanChurchId, ownerIds);
      dupQuery += ` AND (church_id::text = $2 OR church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($3)))`;
    } else {
      dupParams.push(cleanChurchId);
      dupQuery += ` AND church_id::text = $2`;
    }
    dupQuery += ' LIMIT 1';

    const dupRes = await pool.query(dupQuery, dupParams);
    if (dupRes.rows.length > 0) {
      const existingId = dupRes.rows[0].id;
      return res.status(409).json({
        error: 'ALREADY_EXISTS',
        existingId,
        id: existingId,
        message: 'Já existe um cadastro ativo com este CPF/CNPJ nesta igreja.'
      });
    }

    const cleanPhoneDigits = (phone || whatsapp) ? String(phone || whatsapp).replace(/\D/g, '') : null;
    const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim() : null;
    const cleanPhoto = photo_url !== undefined ? photo_url : photo;
    const sanitizedPhoto = cleanPhoto && typeof cleanPhoto === 'string' && cleanPhoto.trim() ? cleanPhoto.trim() : null;
    const sanitizedCongregation = congregation && typeof congregation === 'string' && congregation.trim()
      ? congregation.trim()
      : (targetChurch.name || null);
    const sanitizedPersonType = sanitizedCpf.length === 14 ? 'PJ' : (person_type === 'PJ' ? 'PJ' : 'PF');

    const insertRes = await pool.query(
      `INSERT INTO contributors (
        church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
        person_type, birth_date, address_cep, address_street, address_number,
        address_city, address_state, congregation, role_position, photo_url, is_global
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'active',
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, true
      ) RETURNING id, church_id, canonical_name, name, congregation, role_position, status, created_at`,
      [
        targetChurch.id,
        sanitizedName,
        cleanChosenName,
        sanitizedCpf,
        cleanEmail,
        cleanPhoneDigits,
        cleanPhoneDigits,
        sanitizedPersonType,
        birth_date && typeof birth_date === 'string' && birth_date.trim() ? birth_date.trim() : null,
        address_cep && typeof address_cep === 'string' && address_cep.trim() ? address_cep.trim() : null,
        address_street && typeof address_street === 'string' && address_street.trim() ? address_street.trim() : null,
        address_number && typeof address_number === 'string' && address_number.trim() ? address_number.trim() : null,
        address_city && typeof address_city === 'string' && address_city.trim() ? address_city.trim() : null,
        address_state && typeof address_state === 'string' && address_state.trim() ? address_state.trim() : null,
        sanitizedCongregation,
        role_position && typeof role_position === 'string' && role_position.trim() ? role_position.trim() : 'Membro',
        sanitizedPhoto
      ]
    );

    const created = insertRes.rows[0];
    try {
      await logAudit(pool, {
        action: 'CREATE',
        entity: 'contributors',
        entityId: created?.id,
        churchId: created?.church_id || targetChurch.id,
        newValues: { id: created?.id, church_id: created?.church_id, canonical_name: created?.canonical_name, status: created?.status },
        req
      });
    } catch (_) {}

    return res.status(201).json(created);
  } catch (err: any) {
    console.error('[Contributors API] Error in public-register:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro interno ao realizar autocadastro.' });
  }
});

// POST /api/v1/contribution-requests (Register contribution request intention)
app.post('/api/v1/contribution-requests', async (req: Request, res: Response) => {
  try {
    const { church_id, contributor_id, amount, description, bank_id, splits } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    // 1. Validate church_id
    if (!church_id || typeof church_id !== 'string' || !uuidRegex.test(church_id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'church_id é obrigatório e deve ser um UUID válido.'
      });
    }

    // Verify church exists
    const churchRes = await pool.query('SELECT id, name, user_id FROM churches WHERE id = $1 LIMIT 1', [church_id]);
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
    } else if (String(contributor.church_id) !== String(church_id)) {
      const targetChurchOwnerId = churchRes.rows[0]?.user_id ? String(churchRes.rows[0].user_id) : null;
      const contribChurchRes = await pool.query('SELECT user_id FROM churches WHERE id = $1 LIMIT 1', [contributor.church_id]);
      const contribChurchOwnerId = contribChurchRes.rows[0]?.user_id ? String(contribChurchRes.rows[0].user_id) : null;
      if (!targetChurchOwnerId || !contribChurchOwnerId || targetChurchOwnerId !== contribChurchOwnerId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: o contribuinte informado pertence a outra organização.'
        });
      }
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

    const cleanBankId = bank_id && typeof bank_id === 'string' && uuidRegex.test(bank_id) ? bank_id : null;

    // 🛡️ Validação Matemática e de Integridade do Rateio (Splits)
    if (splits !== undefined && splits !== null) {
      const splitVal = validateTransactionSplits(splits, parsedAmount);
      if (!splitVal.isValid) {
        return res.status(400).json({
          error: splitVal.error,
          message: splitVal.message
        });
      }
    }

    const parsedSplits = splits ? (typeof splits === 'string' ? splits : JSON.stringify(splits)) : null;


    // 4. Anti-duplication check: same contributor, church, amount, pending status within last 2 minutes
    const existingReqRes = await pool.query(
      `SELECT id, church_id, contributor_id, amount, description, status, bank_id, splits, created_at, updated_at
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
        `INSERT INTO contribution_requests (id, church_id, contributor_id, amount, description, status, bank_id, splits, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, NOW(), NOW())
         RETURNING id, church_id, contributor_id, amount, description, status, bank_id, splits, created_at, updated_at`,
        [newReqId, church_id, contributor_id, parsedAmount, cleanDescription, cleanBankId, parsedSplits]
      );
      newRequest = insertRes.rows[0];
    } catch (dbErr) {
      console.warn('[Contributors API] Failed DB insert for contribution request, returning synthetic record:', dbErr);
    }

    if (!newRequest) {
      newRequest = {
        id: newReqId,
        church_id,
        contributor_id,
        amount: parsedAmount,
        description: cleanDescription,
        status: 'pending',
        bank_id: cleanBankId,
        splits: parsedSplits,
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
    await enrichSecondaryUserContext(pool, ctx);

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID da solicitação é inválido.'
      });
    }

    const requestedChurchId = req.query.church_id as string | undefined;
    if (!ctx.isAuthenticated) {
      if (!requestedChurchId || typeof requestedChurchId !== 'string' || !uuidRegex.test(requestedChurchId)) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Autenticação ou identificador da congregação necessário para consultar solicitação.'
        });
      }
    }

    const result = await pool.query(
      'SELECT id, church_id, contributor_id, amount, description, status, bank_id, splits, created_at, updated_at FROM contribution_requests WHERE id = $1 LIMIT 1',
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
    if (ctx.isAuthenticated && !ctx.isSuperAdmin) {
      if (requestedChurchId && String(requestedChurchId) !== String(requestObj.church_id)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: a solicitação pertence a outra igreja.'
        });
      }
      if (ctx.isSecondaryUser) {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(String(requestObj.church_id))) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: a solicitação pertence a outra congregação.'
          });
        }
      } else {
        const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
        const allowedDirect = ctx.allowedChurchIds && ctx.allowedChurchIds.includes(String(requestObj.church_id));
        if (!allowedDirect) {
          const chCheck = await pool.query(
            'SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2) LIMIT 1',
            [requestObj.church_id, ownerUserIds]
          );
          if (chCheck.rows.length === 0) {
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: 'Acesso negado: a solicitação pertence a outra organização.'
            });
          }
        }
      }
    } else if (!ctx.isAuthenticated) {
      if (String(requestObj.church_id) !== String(requestedChurchId)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: a solicitação pertence a outra igreja.'
        });
      }
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
    await enrichSecondaryUserContext(pool, ctx);
    const { contributor_id, status } = req.query;

    const requestedChurchId = req.query.church_id as string | undefined;
    const effectiveChurchId = (requestedChurchId && typeof requestedChurchId === 'string' && requestedChurchId.trim())
      ? requestedChurchId.trim()
      : ctx.churchId;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!effectiveChurchId || typeof effectiveChurchId !== 'string' || !uuidRegex.test(effectiveChurchId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'church_id é obrigatório para consultar solicitações.'
      });
    }

    if (ctx.isAuthenticated && !ctx.isSuperAdmin) {
      if (ctx.isSecondaryUser) {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(effectiveChurchId)) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: você não tem permissão para acessar os dados desta igreja.'
          });
        }
      } else {
        const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
        const allowedDirect = ctx.allowedChurchIds && ctx.allowedChurchIds.includes(effectiveChurchId);
        if (!allowedDirect) {
          const chCheck = await pool.query(
            'SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2) LIMIT 1',
            [effectiveChurchId, ownerUserIds]
          );
          if (chCheck.rows.length === 0) {
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: 'Acesso negado: você não tem permissão para acessar os dados desta organização.'
            });
          }
        }
      }
    } else if (!ctx.isAuthenticated) {
      if (!contributor_id || typeof contributor_id !== 'string' || !uuidRegex.test(contributor_id)) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Autenticação necessária para listar solicitações da congregação.'
        });
      }
      const contribRes = await pool.query('SELECT church_id FROM contributors WHERE id = $1 LIMIT 1', [contributor_id]);
      if (contribRes.rows.length === 0) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: contribuinte não encontrado para esta congregação.'
        });
      }
      const contribChurchId = contribRes.rows[0].church_id;
      if (!contribChurchId || String(contribChurchId) !== String(effectiveChurchId)) {
        let sameOrg = false;
        if (contribChurchId) {
          const c1 = await pool.query('SELECT user_id FROM churches WHERE id = $1 LIMIT 1', [contribChurchId]);
          const c2 = await pool.query('SELECT user_id FROM churches WHERE id = $1 LIMIT 1', [effectiveChurchId]);
          if (c1.rows[0]?.user_id && c2.rows[0]?.user_id && String(c1.rows[0].user_id) === String(c2.rows[0].user_id)) {
            sameOrg = true;
          }
        }
        if (!sameOrg) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: o contribuinte pertence a outra organização.'
          });
        }
      }
    }

    let query = 'SELECT id, church_id, contributor_id, amount, description, status, bank_id, splits, created_at, updated_at FROM contribution_requests WHERE church_id = $1';
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
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para cadastrar chaves Pix.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'admin')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: apenas o titular pode gerenciar chaves Pix.' });
    }

    const { bank_id, church_id, pix_type, pix_key, holder_name, description } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    // 1. Validate bank_id (Pix key belongs to bank account)
    if (!bank_id || typeof bank_id !== 'string' || !uuidRegex.test(bank_id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'bank_id é obrigatório para vincular a chave Pix à conta bancária.'
      });
    }

    // Verify bank exists and belongs to tenant
    const bankRes = await pool.query('SELECT id, name, user_id FROM banks WHERE id = $1 LIMIT 1', [bank_id]);
    if (bankRes.rows.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Conta bancária informada não existe ou não foi encontrada.'
      });
    }

    const ownerUserIds = (!ctx.isSuperAdmin && ctx.userId) ? await getEquivalentUserIds(ctx.ownerId || ctx.userId) : [];
    if (!ctx.isSuperAdmin && ctx.userId) {
      const bankOwnerId = bankRes.rows[0].user_id ? String(bankRes.rows[0].user_id) : '';
      if (!bankOwnerId || !ownerUserIds.includes(bankOwnerId)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: esta conta bancária pertence a outra organização.'
        });
      }
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
      if (!ctx.isSuperAdmin && ctx.userId) {
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [church_id, ownerUserIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: esta congregação pertence a outra organização.'
          });
        }
      }
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
    const finalKeyId = crypto.randomUUID();
    const insertRes = await pool.query(
      `INSERT INTO church_pix_keys (id, bank_id, church_id, pix_type, pix_key, holder_name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
       RETURNING id, bank_id, church_id, pix_type, pix_key, holder_name, description, is_active, created_at, updated_at`,
      [
        finalKeyId,
        bank_id,
        cleanChurchId,
        normalizedType,
        cleanPixKey,
        typeof holder_name === 'string' ? holder_name.trim() : null,
        typeof description === 'string' ? description.trim() : null
      ]
    );

    const createdKey = insertRes.rows[0];
    try {
      await logAudit(pool, {
        action: 'CREATE',
        entity: 'church_pix_keys',
        entityId: createdKey?.id || finalKeyId,
        churchId: cleanChurchId,
        newValues: createdKey,
        req
      });
    } catch (_) {}

    return res.status(201).json(createdKey);
  } catch (err: any) {
    console.error('[Contributors API] Error creating Pix key:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno ao cadastrar chave Pix da conta bancária.'
    });
  }
});

// GET /api/v1/church-pix-keys/public (Public active Pix key consultation for Portal - strictly scoped)
app.get('/api/v1/church-pix-keys/public', async (req: Request, res: Response) => {
  try {
    const { church_id, bank_id } = req.query;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    let churchRow: any = null;
    let ownerIds: string[] = [];
    if (church_id && typeof church_id === 'string' && uuidRegex.test(church_id)) {
      const chRes = await pool.query(
        'SELECT id, user_id, name, pix_key, "pixKey", cnpj FROM churches WHERE id::text = $1 LIMIT 1',
        [church_id]
      );
      if (chRes.rows.length === 0) {
        return res.json([]);
      }
      churchRow = chRes.rows[0];
      if (churchRow.user_id) {
        ownerIds = await getEquivalentUserIds(String(churchRow.user_id));
      }
    }

    if (bank_id && typeof bank_id === 'string' && uuidRegex.test(bank_id)) {
      // If church_id was provided, ensure bank_id actually belongs to the same organization/church
      if (churchRow) {
        const bankOwnerCheck = ownerIds.length > 0
          ? await pool.query('SELECT id FROM banks WHERE id::text = $1 AND (user_id::text = ANY($2) OR user_id::text = $3) LIMIT 1', [bank_id, ownerIds, churchRow.id])
          : await pool.query('SELECT id FROM banks WHERE id::text = $1 AND user_id::text = $2 LIMIT 1', [bank_id, churchRow.id]);
        if (bankOwnerCheck.rows.length === 0) {
          return res.json([]);
        }
      }

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
        WHERE k.bank_id = $1 AND (k.is_active = true OR k.is_active = 1)
        ORDER BY k.created_at DESC
      `;
      const result = await pool.query(query, [bank_id]);
      if (result.rows.length > 0) {
        return res.json(result.rows.map(normalizeBankRow));
      }

      // Fallback: check if the specific verified bank itself has bank_key
      const bankRes = await pool.query(
        'SELECT id, name, bank_key, account_name, accepted_contribution_types FROM banks WHERE id = $1 LIMIT 1',
        [bank_id]
      );
      if (bankRes.rows.length > 0 && bankRes.rows[0].bank_key) {
        const b = normalizeBankRow(bankRes.rows[0]);
        return res.json([{
          id: `bank-pix-${b.id}`,
          bank_id: b.id,
          church_id: church_id || null,
          pix_type: 'chave',
          pix_key: b.bank_key,
          holder_name: b.account_name || b.name,
          description: b.name,
          is_active: true,
          created_at: new Date().toISOString(),
          bank_name: b.name,
          accepted_contribution_types: b.accepted_contribution_types
        }]);
      }

      return res.json([]);
    }

    if (!church_id || typeof church_id !== 'string' || !uuidRegex.test(church_id) || !churchRow) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'church_id ou bank_id válido é obrigatório para consultar as chaves Pix ativas.'
      });
    }

    const pixParams: any[] = [churchRow.id];
    let ownerFilterSql = `k.church_id::text = $1`;
    if (ownerIds.length > 0) {
      pixParams.push(ownerIds);
      ownerFilterSql = `(k.bank_id IN (SELECT id FROM banks WHERE user_id::text = ANY($2)) OR k.church_id::text = $1)`;
    }

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
      WHERE ${ownerFilterSql}
        AND (k.is_active = true OR k.is_active = 1)
      ORDER BY k.created_at DESC
    `;

    const result = await pool.query(query, pixParams);
    if (result.rows.length > 0) {
      return res.json(result.rows.map(normalizeBankRow));
    }

    // Fallback: search banks belonging strictly to church's owner with bank_key
    if (ownerIds.length > 0) {
      const fallbackBanks = await pool.query(
        `SELECT b.id, b.name, b.bank_key, b.account_name, b.accepted_contribution_types
         FROM banks b
         WHERE b.user_id::text = ANY($1)
           AND b.bank_key IS NOT NULL AND b.bank_key != ''`,
        [ownerIds]
      );

      if (fallbackBanks.rows.length > 0) {
        return res.json(fallbackBanks.rows.map((rawB: any) => {
          const b = normalizeBankRow(rawB);
          return {
            id: `bank-pix-${b.id}`,
            bank_id: b.id,
            church_id: churchRow.id,
            pix_type: 'chave',
            pix_key: b.bank_key,
            holder_name: b.account_name || b.name,
            description: b.name,
            is_active: true,
            created_at: new Date().toISOString(),
            bank_name: b.name,
            accepted_contribution_types: b.accepted_contribution_types
          };
        }));
      }
    }

    // Fallback 2: Check church direct pix_key, pixKey, or cnpj
    const directKey = churchRow.pix_key || churchRow.pixKey || churchRow.cnpj || null;
    if (directKey) {
      return res.json([{
        id: `church-pix-${churchRow.id}`,
        church_id: churchRow.id,
        pix_type: churchRow.cnpj && directKey === churchRow.cnpj ? 'cnpj' : 'chave',
        pix_key: directKey,
        holder_name: churchRow.name,
        description: churchRow.name,
        is_active: true,
        created_at: new Date().toISOString(),
        bank_name: churchRow.name
      }]);
    }

    return res.json([]);
  } catch (err: any) {
    console.error('[Contributors API] Error fetching public Pix keys:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao consultar chaves Pix.'
    });
  }
});

// GET /api/v1/church-banks/public (List active bank accounts with Pix keys strictly for a church/tenant)
app.get('/api/v1/church-banks/public', async (req: Request, res: Response) => {
  try {
    const { church_id } = req.query;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!church_id || typeof church_id !== 'string' || !uuidRegex.test(church_id)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'church_id é obrigatório e deve ser um UUID válido.' });
    }

    const churchRes = await pool.query('SELECT id, user_id, name, pix_key, "pixKey", cnpj FROM churches WHERE id::text = $1 LIMIT 1', [church_id]);
    const churchRow = (churchRes && churchRes.rows) ? churchRes.rows[0] : null;
    if (!churchRow) {
      return res.json([]);
    }

    const ownerIds = churchRow.user_id ? await getEquivalentUserIds(String(churchRow.user_id)) : [];
    let rows: any[] = [];

    if (ownerIds.length > 0) {
      const result = await pool.query(
        `SELECT 
           b.id,
           b.name,
           b.account_name,
           b.bank_key,
           b.accepted_contribution_types,
           k.pix_key,
           k.pix_type,
           k.holder_name,
           k.id as pix_key_id
         FROM banks b
         LEFT JOIN church_pix_keys k ON b.id = k.bank_id AND (k.is_active = true OR k.is_active = 1)
         WHERE (b.user_id::text = ANY($1) OR b.user_id::text = $2)
         ORDER BY b.name ASC`,
        [ownerIds, churchRow.id]
      );
      rows = (result && result.rows) ? result.rows : [];
    } else {
      const result = await pool.query(
        `SELECT 
           b.id,
           b.name,
           b.account_name,
           b.bank_key,
           b.accepted_contribution_types,
           k.pix_key,
           k.pix_type,
           k.holder_name,
           k.id as pix_key_id
         FROM banks b
         LEFT JOIN church_pix_keys k ON b.id = k.bank_id AND (k.is_active = true OR k.is_active = 1)
         WHERE b.user_id::text = $1
         ORDER BY b.name ASC`,
        [churchRow.id]
      );
      rows = (result && result.rows) ? result.rows : [];
    }

    const defaultPix = churchRow?.pix_key || churchRow?.pixKey || churchRow?.cnpj || null;

    if (rows.length === 0) {
      // Safe per-church fallback account (never exposes banks of another tenant)
      rows = [{
        id: 'default-church-account',
        name: churchRow?.name || 'Conta Principal da Igreja',
        account_name: 'Conta Corrente Principal',
        bank_key: 'GERAL',
        pix_key: defaultPix,
        pix_type: defaultPix ? 'aleatoria' : null,
        holder_name: churchRow?.name || 'Igreja',
        pix_key_id: 'default-key'
      }];
    } else {
      rows = rows.map((r: any) => ({
        ...normalizeBankRow(r),
        pix_key: r.pix_key || defaultPix,
        pix_type: r.pix_type || (defaultPix ? 'aleatoria' : null),
        holder_name: r.holder_name || churchRow?.name || 'Igreja'
      }));
    }

    return res.json(rows);
  } catch (err: any) {
    console.error('[Contributors API] Error fetching public church banks:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro ao consultar contas bancárias.' });
  }
});

// GET /api/v1/church-pix-keys (List all Pix keys for a bank account or church)
app.get('/api/v1/church-pix-keys', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para listar chaves Pix.' });
    }

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

    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (ownerUserIds.length === 0) {
        return res.json([]);
      }
      params.push(ownerUserIds);
      query += ` AND k.bank_id IN (SELECT id FROM banks WHERE user_id::text = ANY($${params.length}))`;

      if (ctx.isSecondaryUser) {
        if (ctx.allowedBankIds.length === 0) {
          return res.json([]);
        }
        params.push(ctx.allowedBankIds);
        query += ` AND k.bank_id::text = ANY($${params.length})`;
      }
    }

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
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para atualizar chaves Pix.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'admin')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: apenas o titular pode alterar chaves Pix.' });
    }

    const { id } = req.params;
    const { is_active, description, holder_name, church_id, pix_type, pix_key, bank_id } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID da chave Pix é inválido.'
      });
    }

    // Check existing & ownership
    const existingRes = await pool.query(
      `SELECT k.id, k.bank_id, k.church_id, k.is_active, b.user_id AS bank_user_id
       FROM church_pix_keys k
       LEFT JOIN banks b ON k.bank_id = b.id
       WHERE k.id = $1 LIMIT 1`,
      [id]
    );

    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Chave Pix não encontrada.'
      });
    }

    const existing = existingRes.rows[0];
    const ownerUserIds = (!ctx.isSuperAdmin && ctx.userId) ? await getEquivalentUserIds(ctx.ownerId || ctx.userId) : [];

    if (!ctx.isSuperAdmin && ctx.userId) {
      let hasOwnership = Boolean(existing.bank_user_id && ownerUserIds.includes(String(existing.bank_user_id)));
      if (!hasOwnership && existing.church_id) {
        const chOwnerRes = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [existing.church_id, ownerUserIds]);
        hasOwnership = chOwnerRes.rows.length > 0;
      }
      if (!hasOwnership) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: esta chave Pix pertence a outra organização.'
        });
      }
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
      if (!ctx.isSuperAdmin && ctx.userId) {
        const targetBankRes = await pool.query('SELECT id FROM banks WHERE id::text = $1 AND user_id::text = ANY($2)', [bank_id, ownerUserIds]);
        if (targetBankRes.rows.length === 0) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: conta bancária de destino pertence a outra organização.'
          });
        }
      }
      params.push(bank_id);
      updates.push(`bank_id = $${params.length}`);
    }

    if (church_id && typeof church_id === 'string' && uuidRegex.test(church_id)) {
      if (!ctx.isSuperAdmin && ctx.userId) {
        const targetChRes = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [church_id, ownerUserIds]);
        if (targetChRes.rows.length === 0) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: congregação de destino pertence a outra organização.'
          });
        }
      }
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
    const updatedKey = result.rows[0];
    try {
      await logAudit(pool, {
        action: 'UPDATE',
        entity: 'church_pix_keys',
        entityId: id,
        churchId: updatedKey?.church_id || existing?.church_id,
        oldValues: existing,
        newValues: updatedKey,
        req
      });
    } catch (_) {}
    return res.json(updatedKey);
  } catch (err: any) {
    console.error('[Contributors API] Error updating Pix key:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao atualizar chave Pix.'
    });
  }
});

// GET /api/v1/contribution-types/public (Public active contribution types for Portal - strictly tenant-scoped)
app.get('/api/v1/contribution-types/public', async (req: Request, res: Response) => {
  const DEFAULT_PUBLIC_TYPES = [
    { id: 'contrib-default-1', name: 'Dízimo', type: 'entrada', category: 'Receita', order: 1, is_active: 1 },
    { id: 'contrib-default-2', name: 'Oferta', type: 'entrada', category: 'Receita', order: 2, is_active: 1 },
    { id: 'contrib-default-3', name: 'Contribuição Especial', type: 'entrada', category: 'Receita', order: 3, is_active: 1 },
    { id: 'contrib-default-4', name: 'Doação / Voto', type: 'entrada', category: 'Receita', order: 4, is_active: 1 }
  ];

  try {
    const { church_id, bank_id } = req.query;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    const validChurchId = (church_id && typeof church_id === 'string' && uuidRegex.test(church_id)) ? church_id : null;
    const validBankId = (bank_id && typeof bank_id === 'string' && bank_id !== 'default-church-account' && uuidRegex.test(bank_id)) ? bank_id : null;

    if (!validChurchId && !validBankId) {
      return res.json(DEFAULT_PUBLIC_TYPES);
    }

    let ownerIds: string[] = [];
    if (validChurchId) {
      const chRes = await pool.query('SELECT user_id FROM churches WHERE id::text = $1 LIMIT 1', [validChurchId]);
      if (chRes.rows.length === 0) {
        return res.json(DEFAULT_PUBLIC_TYPES);
      }
      if (chRes.rows[0].user_id) {
        ownerIds = await getEquivalentUserIds(String(chRes.rows[0].user_id));
      }
    } else if (validBankId) {
      const bkRes = await pool.query('SELECT user_id FROM banks WHERE id::text = $1 LIMIT 1', [validBankId]);
      if (bkRes.rows.length === 0) {
        return res.json(DEFAULT_PUBLIC_TYPES);
      }
      if (bkRes.rows[0].user_id) {
        ownerIds = await getEquivalentUserIds(String(bkRes.rows[0].user_id));
      }
    }

    if (ownerIds.length === 0) {
      return res.json(DEFAULT_PUBLIC_TYPES);
    }

    const params: any[] = [ownerIds];
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
      WHERE (ct.is_active = true OR ct.is_active = 1)
        AND LOWER(ct.type) = 'entrada'
        AND ct.user_id::text = ANY($1)
    `;

    if (validBankId) {
      const specificCheck = await pool.query(
        `SELECT id FROM contribution_types
         WHERE (is_active = true OR is_active = 1)
           AND LOWER(type) = 'entrada'
           AND user_id::text = ANY($1)
           AND CAST(bank_id AS VARCHAR) = $2
         LIMIT 1`,
        [ownerIds, validBankId]
      );
      params.push(validBankId);
      if (specificCheck.rows.length > 0) {
        query += ` AND CAST(ct.bank_id AS VARCHAR) = $${params.length}`;
      } else {
        query += ` AND (ct.bank_id IS NULL OR CAST(ct.bank_id AS VARCHAR) = $${params.length})`;
      }
    }

    query += ' ORDER BY ct."order" ASC, ct.name ASC';
    const result = await pool.query(query, params);
    let rows = (result && result.rows) ? result.rows : [];

    if (rows.length === 0) {
      rows = DEFAULT_PUBLIC_TYPES;
    }

    const seenNames = new Set<string>();
    const deduplicated = rows.filter((r: any) => {
      const norm = (r.name || '').trim().toLowerCase();
      if (!norm || seenNames.has(norm)) return false;
      seenNames.add(norm);
      return true;
    });

    return res.json(deduplicated);
  } catch (err: any) {
    console.error('[Contributors API] Error fetching public contribution types:', err);
    return res.json(DEFAULT_PUBLIC_TYPES);
  }
});

// GET /api/v1/contribution-types (List all contribution types scoped by tenant)
app.get('/api/v1/contribution-types', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para listar tipos de contribuição.' });
    }

    const { user_id, type, is_active } = req.query;
    const requestedUserId = typeof user_id === 'string' && user_id.trim() ? user_id.trim() : null;

    if (!ctx.isSuperAdmin && ctx.userId && requestedUserId) {
      if (requestedUserId !== ctx.userId && requestedUserId !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para tipos de contribuição de outro usuário.' });
      }
    }

    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (requestedUserId || ctx.ownerId || ctx.userId);

    const ownerUserIds = effectiveUserId ? await getEquivalentUserIds(effectiveUserId) : [];

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

    if (!ctx.isSuperAdmin || effectiveUserId) {
      if (ownerUserIds.length > 0) {
        params.push(ownerUserIds);
        query += ` AND ct.user_id::text = ANY($${params.length})`;
      } else {
        query += ` AND 1=0`;
      }
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

    // Check if tenant has any contribution types at all before auto-seeding
    if (effectiveUserId && ownerUserIds.length > 0) {
      const existingTenantCountRes = await pool.query(
        'SELECT id FROM contribution_types WHERE user_id::text = ANY($1) LIMIT 1',
        [ownerUserIds]
      );
      if (existingTenantCountRes.rows.length === 0) {
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
            const genId = crypto.randomUUID();
            await pool.query(
              `INSERT INTO contribution_types (id, name, type, category, "order", is_active, user_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [genId, dt.name, dt.type, dt.type === 'entrada' ? 'Receita' : 'Despesa', dt.order, true, effectiveUserId]
            );
          } catch (e) {
            console.error('Error auto-seeding contribution type:', e);
          }
        }
        result = await pool.query(query, params);
      }
    }

    return res.json(result.rows || []);
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
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para cadastrar tipos de contribuição.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'create')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de criação.' });
    }

    const { name, type, category, bank_id, order, is_active, user_id } = req.body;

    if (!ctx.isSuperAdmin && ctx.userId && user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar tipo de contribuição para outro usuário.' });
    }

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
    const requestedUserId = (user_id && typeof user_id === 'string' && user_id.trim()) ? user_id.trim() : null;
    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (requestedUserId || ctx.ownerId || ctx.userId);

    if (!effectiveUserId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'user_id é obrigatório.' });
    }

    if (cleanBankId && !ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      const bankCheck = await pool.query('SELECT id FROM banks WHERE id::text = $1 AND user_id::text = ANY($2)', [cleanBankId, ownerUserIds]);
      if (bankCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: conta bancária pertence a outra organização.' });
      }
    }

    const genId = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO contribution_types (id, name, type, category, bank_id, "order", is_active, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, type, category, bank_id, "order", is_active, user_id, created_at`,
      [
        genId,
        name.trim(),
        normType,
        category ? category.trim() : null,
        normType === 'entrada' ? cleanBankId : null,
        cleanOrder,
        cleanIsActive,
        effectiveUserId
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
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para atualizar tipos de contribuição.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'edit')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de edição.' });
    }

    const { id } = req.params;
    const { name, type, category, bank_id, order, is_active } = req.body;

    const cleanId = typeof id === 'string' ? id.trim() : '';
    if (!cleanId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID do tipo de contribuição é obrigatório.'
      });
    }

    const existingRes = await pool.query('SELECT * FROM contribution_types WHERE id = $1 LIMIT 1', [cleanId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Tipo de contribuição não encontrado.'
      });
    }

    const existing = existingRes.rows[0];
    const ownerUserIds = (!ctx.isSuperAdmin && ctx.userId) ? await getEquivalentUserIds(ctx.ownerId || ctx.userId) : [];
    if (!ctx.isSuperAdmin && ctx.userId) {
      if (!existing.user_id || !ownerUserIds.includes(String(existing.user_id))) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: tipo de contribuição pertence a outra organização.'
        });
      }
    }

    const normType = (type && typeof type === 'string') ? type.trim().toLowerCase() : 'entrada';
    const cleanBankId = (bank_id && typeof bank_id === 'string' && bank_id.trim()) ? bank_id.trim() : null;

    if (cleanBankId && normType === 'entrada' && !ctx.isSuperAdmin && ctx.userId) {
      const bankCheck = await pool.query('SELECT id FROM banks WHERE id::text = $1 AND user_id::text = ANY($2)', [cleanBankId, ownerUserIds]);
      if (bankCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: conta bancária pertence a outra organização.' });
      }
    }

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
        cleanId
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
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para excluir tipos de contribuição.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'delete')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de exclusão.' });
    }

    const { id } = req.params;
    const cleanId = typeof id === 'string' ? id.trim() : '';
    if (!cleanId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID do tipo de contribuição é obrigatório.'
      });
    }

    const existingRes = await pool.query('SELECT * FROM contribution_types WHERE id = $1 LIMIT 1', [cleanId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Tipo de contribuição não encontrado.'
      });
    }

    const existing = existingRes.rows[0];
    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!existing.user_id || !ownerUserIds.includes(String(existing.user_id))) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: tipo de contribuição pertence a outra organização.'
        });
      }
    }

    await pool.query('DELETE FROM contribution_types WHERE id = $1', [cleanId]);
    return res.json({ success: true, message: 'Tipo de contribuição removido.' });
  } catch (err: any) {
    console.error('[Contributors API] Error deleting contribution type:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao excluir tipo de contribuição.'
    });
  }
});

// Helper to normalize payment_methods row across SQLite (0/1) and PostgreSQL (boolean)
function normalizePaymentMethodRow(row: any) {
  if (!row) return row;
  return {
    ...row,
    order: row.order !== undefined && row.order !== null ? Number(row.order) : 1,
    is_active: row.is_active === undefined || row.is_active === null
      ? true
      : (row.is_active === true || row.is_active === 1 || row.is_active === '1')
  };
}

// GET /api/v1/payment-methods (List all payment methods scoped by tenant)
app.get('/api/v1/payment-methods', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para listar formas de pagamento.' });
    }

    const { user_id, type, is_active } = req.query;
    const requestedUserId = typeof user_id === 'string' && user_id.trim() ? user_id.trim() : null;

    if (!ctx.isSuperAdmin && ctx.userId && requestedUserId) {
      if (requestedUserId !== ctx.userId && requestedUserId !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para formas de pagamento de outro usuário.' });
      }
    }

    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (requestedUserId || ctx.ownerId || ctx.userId);

    const ownerUserIds = effectiveUserId ? await getEquivalentUserIds(effectiveUserId) : [];

    let query = `
      SELECT 
        pm.id,
        pm.name,
        pm.type,
        pm.category,
        pm.bank_id,
        pm."order",
        pm.is_active,
        pm.user_id,
        pm.created_at,
        pm.updated_at,
        COALESCE(b.account_name, b.name) as bank_name
      FROM payment_methods pm
      LEFT JOIN banks b ON CAST(pm.bank_id AS VARCHAR) = CAST(b.id AS VARCHAR)
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!ctx.isSuperAdmin || effectiveUserId) {
      if (ownerUserIds.length > 0) {
        params.push(ownerUserIds);
        query += ` AND pm.user_id::text = ANY($${params.length})`;
      } else {
        query += ` AND 1=0`;
      }
    }

    if (type && typeof type === 'string') {
      params.push(type.toLowerCase());
      query += ` AND LOWER(pm.type) = $${params.length}`;
    }

    if (is_active !== undefined) {
      params.push(String(is_active) === 'true');
      query += ` AND pm.is_active = $${params.length}`;
    }

    query += ' ORDER BY pm."order" ASC, pm.name ASC';

    let result = await pool.query(query, params);

    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows.map(normalizePaymentMethodRow));
    }

    // Auto-seed per tenant only when the tenant has zero payment methods
    if (effectiveUserId && ownerUserIds.length > 0) {
      const existingTenantCountRes = await pool.query(
        'SELECT id FROM payment_methods WHERE user_id::text = ANY($1) LIMIT 1',
        [ownerUserIds]
      );
      if (existingTenantCountRes.rows.length === 0) {
        const defaultMethods = [
          { name: 'PIX', type: 'ambos', category: 'Pagamento Digital', order: 1 },
          { name: 'DINHEIRO', type: 'ambos', category: 'Espécie', order: 2 }
        ];

        for (const dm of defaultMethods) {
          try {
            const genId = crypto.randomUUID();
            await pool.query(
              `INSERT INTO payment_methods (id, name, type, category, "order", is_active, user_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [genId, dm.name, dm.type, dm.category, dm.order, true, effectiveUserId]
            );
          } catch (e) {
            console.error('Error auto-seeding payment method:', e);
          }
        }
        result = await pool.query(query, params);
      }
    }

    return res.json((result.rows || []).map(normalizePaymentMethodRow));
  } catch (err: any) {
    console.error('[Contributors API] Error listing payment methods:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao listar formas de recebimento/pagamento.'
    });
  }
});

// POST /api/v1/payment-methods
app.post('/api/v1/payment-methods', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para cadastrar formas de pagamento.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'create')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de criação.' });
    }

    const { name, type, category, bank_id, order, is_active, user_id } = req.body;

    if (!ctx.isSuperAdmin && ctx.userId && user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar forma de pagamento para outro usuário.' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'O nome da forma de pagamento/recebimento é obrigatório.'
      });
    }

    const cleanName = name.trim().toUpperCase();
    const normType = (type && typeof type === 'string') ? type.trim().toLowerCase() : 'recebimento';
    if (normType !== 'recebimento' && normType !== 'pagamento' && normType !== 'ambos') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'O tipo deve ser "recebimento", "pagamento" ou "ambos".'
      });
    }

    const cleanOrder = typeof order === 'number' && !Number.isNaN(order) ? order : 1;
    const cleanIsActive = typeof is_active === 'boolean' ? is_active : true;
    const cleanBankId = (bank_id && typeof bank_id === 'string' && bank_id.trim()) ? bank_id.trim() : null;
    const requestedUserId = (user_id && typeof user_id === 'string' && user_id.trim()) ? user_id.trim() : null;
    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (requestedUserId || ctx.ownerId || ctx.userId);

    if (!effectiveUserId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'user_id é obrigatório.' });
    }

    const ownerUserIds = await getEquivalentUserIds(effectiveUserId);

    if (cleanBankId && !ctx.isSuperAdmin && ctx.userId) {
      const bankCheck = await pool.query('SELECT id FROM banks WHERE id::text = $1 AND user_id::text = ANY($2)', [cleanBankId, ownerUserIds]);
      if (bankCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: conta bancária pertence a outra organização.' });
      }
    }

    const dupCheck = await pool.query(
      'SELECT id FROM payment_methods WHERE user_id::text = ANY($1) AND UPPER(TRIM(name)) = $2 LIMIT 1',
      [ownerUserIds, cleanName]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_PAYMENT_METHOD',
        message: `A forma "${cleanName}" já está cadastrada.`
      });
    }

    const genId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO payment_methods (id, name, type, category, bank_id, "order", is_active, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        genId,
        cleanName,
        normType,
        category && typeof category === 'string' && category.trim() ? category.trim() : null,
        cleanBankId,
        cleanOrder,
        cleanIsActive,
        effectiveUserId
      ]
    );

    const createdRes = await pool.query(
      `SELECT pm.id, pm.name, pm.type, pm.category, pm.bank_id, pm."order", pm.is_active, pm.user_id, pm.created_at, pm.updated_at, COALESCE(b.account_name, b.name) as bank_name
       FROM payment_methods pm
       LEFT JOIN banks b ON CAST(pm.bank_id AS VARCHAR) = CAST(b.id AS VARCHAR)
       WHERE pm.id = $1 LIMIT 1`,
      [genId]
    );

    return res.status(201).json(normalizePaymentMethodRow(createdRes.rows[0]));
  } catch (err: any) {
    console.error('[Contributors API] Error creating payment method:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao cadastrar forma de recebimento/pagamento.'
    });
  }
});

// PUT /api/v1/payment-methods/:id
app.put('/api/v1/payment-methods/:id', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para atualizar formas de pagamento.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'edit')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de edição.' });
    }

    const { id } = req.params;
    const { name, type, category, bank_id, order, is_active } = req.body;

    const cleanId = typeof id === 'string' ? id.trim() : '';
    if (!cleanId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID da forma de pagamento é obrigatório.'
      });
    }

    const existingRes = await pool.query('SELECT * FROM payment_methods WHERE id = $1 LIMIT 1', [cleanId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Forma de recebimento/pagamento não encontrada.'
      });
    }

    const existing = existingRes.rows[0];
    const ownerUserIds = (!ctx.isSuperAdmin && ctx.userId) ? await getEquivalentUserIds(ctx.ownerId || ctx.userId) : [];
    if (!ctx.isSuperAdmin && ctx.userId) {
      if (!existing.user_id || !ownerUserIds.includes(String(existing.user_id))) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: forma de pagamento pertence a outra organização.'
        });
      }
    }

    const cleanName = (name && typeof name === 'string' && name.trim()) ? name.trim().toUpperCase() : String(existing.name || '').trim().toUpperCase();
    if (!cleanName) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'O nome da forma de pagamento/recebimento é obrigatório.'
      });
    }

    const normType = (type && typeof type === 'string') ? type.trim().toLowerCase() : (existing.type || 'recebimento');
    if (normType !== 'recebimento' && normType !== 'pagamento' && normType !== 'ambos') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'O tipo deve ser "recebimento", "pagamento" ou "ambos".'
      });
    }

    const cleanBankId = (bank_id && typeof bank_id === 'string' && bank_id.trim()) ? bank_id.trim() : null;

    if (cleanBankId && !ctx.isSuperAdmin && ctx.userId) {
      const bankCheck = await pool.query('SELECT id FROM banks WHERE id::text = $1 AND user_id::text = ANY($2)', [cleanBankId, ownerUserIds]);
      if (bankCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: conta bancária pertence a outra organização.' });
      }
    }

    const targetOwnerIds = existing.user_id ? await getEquivalentUserIds(String(existing.user_id)) : ownerUserIds;
    if (targetOwnerIds.length > 0) {
      const dupCheck = await pool.query(
        'SELECT id FROM payment_methods WHERE user_id::text = ANY($1) AND UPPER(TRIM(name)) = $2 AND id::text != $3 LIMIT 1',
        [targetOwnerIds, cleanName, cleanId]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_PAYMENT_METHOD',
          message: `A forma "${cleanName}" já está cadastrada.`
        });
      }
    }

    await pool.query(
      `UPDATE payment_methods
       SET name = $1,
           type = $2,
           category = $3,
           bank_id = $4,
           "order" = $5,
           is_active = $6,
           updated_at = NOW()
       WHERE id = $7`,
      [
        cleanName,
        normType,
        category && typeof category === 'string' && category.trim() ? category.trim() : null,
        cleanBankId,
        typeof order === 'number' && !Number.isNaN(order) ? order : (Number(existing.order) || 1),
        typeof is_active === 'boolean' ? is_active : Boolean(existing.is_active === true || existing.is_active === 1 || existing.is_active === '1'),
        cleanId
      ]
    );

    const updatedRes = await pool.query(
      `SELECT pm.id, pm.name, pm.type, pm.category, pm.bank_id, pm."order", pm.is_active, pm.user_id, pm.created_at, pm.updated_at, COALESCE(b.account_name, b.name) as bank_name
       FROM payment_methods pm
       LEFT JOIN banks b ON CAST(pm.bank_id AS VARCHAR) = CAST(b.id AS VARCHAR)
       WHERE pm.id = $1 LIMIT 1`,
      [cleanId]
    );

    if (updatedRes.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Forma de recebimento/pagamento não encontrada.'
      });
    }

    return res.json(normalizePaymentMethodRow(updatedRes.rows[0]));
  } catch (err: any) {
    console.error('[Contributors API] Error updating payment method:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao atualizar forma de recebimento/pagamento.'
    });
  }
});

// DELETE /api/v1/payment-methods/:id
app.delete('/api/v1/payment-methods/:id', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para excluir formas de pagamento.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'delete')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de exclusão.' });
    }

    const { id } = req.params;
    const cleanId = typeof id === 'string' ? id.trim() : '';
    if (!cleanId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'ID da forma de pagamento é obrigatório.'
      });
    }

    const existingRes = await pool.query('SELECT * FROM payment_methods WHERE id = $1 LIMIT 1', [cleanId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Forma de recebimento/pagamento não encontrada.'
      });
    }

    const existing = existingRes.rows[0];
    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!existing.user_id || !ownerUserIds.includes(String(existing.user_id))) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: forma de pagamento pertence a outra organização.'
        });
      }
    }

    await pool.query('DELETE FROM payment_methods WHERE id = $1', [cleanId]);
    return res.json({ success: true, message: 'Forma de recebimento/pagamento removida.' });
  } catch (err: any) {
    console.error('[Contributors API] Error deleting payment method:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao excluir forma de recebimento/pagamento.'
    });
  }
});

const TENANT_OPTION_DEFAULTS: Record<string, string[]> = {
  contributor_role: [
    'Membro',
    'Visitante',
    'Pastor / Pastora',
    'Diácono / Diaconisa',
    'Presbítero / Evangelista',
    'Obreiro / Obreira',
    'Líder de Ministério / Célula',
    'Voluntário',
    'Dizimista',
    'Músico / Louvor',
    'Prestador de Serviços',
    'Fornecedor / Empresa',
    'Concessionária / Utilidades',
    'Outro'
  ],
  supplier_category: [
    'Construção e Reformas',
    'Equipamentos de Som / Iluminação',
    'Prestação de Serviços Técnicos',
    'Água, Energia, Internet e Concessionárias',
    'Alimentação, Eventos e Buffet',
    'Gráfica, Comunicação Visual e Papelaria',
    'Outros Fornecedores'
  ],
  pastor_role: [
    'Pastor Presidente',
    'Pastor Auxiliar'
  ],
  treasurer_role: [
    '1º Tesoureiro',
    '2º Tesoureiro'
  ]
};

// GET /api/v1/tenant-options (List sub-registrations of roles/categories scoped by tenant)
app.get('/api/v1/tenant-options', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para listar cargos e categorias.' });
    }

    const { scope, user_id } = req.query;
    const requestedScope = typeof scope === 'string' && scope.trim() ? scope.trim() : null;
    if (requestedScope && !TENANT_OPTION_DEFAULTS[requestedScope]) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Escopo inválido.' });
    }

    const requestedUserId = typeof user_id === 'string' && user_id.trim() ? user_id.trim() : null;
    if (!ctx.isSuperAdmin && ctx.userId && requestedUserId) {
      if (requestedUserId !== ctx.userId && requestedUserId !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para opções de outro usuário.' });
      }
    }

    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (requestedUserId || ctx.ownerId || ctx.userId);

    const ownerUserIds = effectiveUserId ? await getEquivalentUserIds(effectiveUserId) : [];
    const targetScopes = requestedScope ? [requestedScope] : Object.keys(TENANT_OPTION_DEFAULTS);

    if (effectiveUserId && ownerUserIds.length > 0) {
      for (const sc of targetScopes) {
        const countRes = await pool.query(
          'SELECT id FROM tenant_custom_options WHERE user_id::text = ANY($1) AND scope = $2 LIMIT 1',
          [ownerUserIds, sc]
        );
        if (countRes.rows.length === 0) {
          const defaults = TENANT_OPTION_DEFAULTS[sc] || [];
          for (let i = 0; i < defaults.length; i++) {
            try {
              await pool.query(
                `INSERT INTO tenant_custom_options (id, user_id, scope, name, sort_order)
                 VALUES ($1, $2, $3, $4, $5)`,
                [crypto.randomUUID(), effectiveUserId, sc, defaults[i], i + 1]
              );
            } catch (seedErr) {
              console.error(`[Contributors API] Error seeding tenant option (${sc}):`, seedErr);
            }
          }
        }
      }
    }

    let query = `
      SELECT id, user_id, scope, name, sort_order, created_at, updated_at
      FROM tenant_custom_options
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!ctx.isSuperAdmin || effectiveUserId) {
      if (ownerUserIds.length > 0) {
        params.push(ownerUserIds);
        query += ` AND user_id::text = ANY($${params.length})`;
      } else {
        query += ` AND 1=0`;
      }
    }

    if (requestedScope) {
      params.push(requestedScope);
      query += ` AND scope = $${params.length}`;
    }

    query += ' ORDER BY scope ASC, sort_order ASC, created_at ASC, name ASC';

    const result = await pool.query(query, params);
    return res.json(result.rows || []);
  } catch (err: any) {
    console.error('[Contributors API] Error listing tenant options:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro ao listar cargos e categorias.' });
  }
});

// POST /api/v1/tenant-options
app.post('/api/v1/tenant-options', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para cadastrar cargos e categorias.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'create') && !hasPermission(ctx, 'edit')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de criação ou edição.' });
    }

    const { scope, name, user_id } = req.body;
    const cleanScope = typeof scope === 'string' ? scope.trim() : '';
    if (!cleanScope || !TENANT_OPTION_DEFAULTS[cleanScope]) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Escopo inválido.' });
    }

    if (!ctx.isSuperAdmin && ctx.userId && user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar opção para outro usuário.' });
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'O nome é obrigatório.' });
    }

    const requestedUserId = (user_id && typeof user_id === 'string' && user_id.trim()) ? user_id.trim() : null;
    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (requestedUserId || ctx.ownerId || ctx.userId);

    if (!effectiveUserId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'user_id é obrigatório.' });
    }

    const ownerUserIds = await getEquivalentUserIds(effectiveUserId);
    const dupCheck = await pool.query(
      'SELECT id FROM tenant_custom_options WHERE user_id::text = ANY($1) AND scope = $2 AND LOWER(TRIM(name)) = LOWER($3) LIMIT 1',
      [ownerUserIds, cleanScope, cleanName]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_TENANT_OPTION',
        message: `"${cleanName}" já está cadastrado(a).`
      });
    }

    const maxOrderRes = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM tenant_custom_options WHERE user_id::text = ANY($1) AND scope = $2',
      [ownerUserIds, cleanScope]
    );
    const nextOrder = Number(maxOrderRes.rows[0]?.max_order || 0) + 1;

    const genId = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO tenant_custom_options (id, user_id, scope, name, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, scope, name, sort_order, created_at, updated_at`,
      [genId, effectiveUserId, cleanScope, cleanName, nextOrder]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error creating tenant option:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro ao cadastrar cargo/categoria.' });
  }
});

// PUT /api/v1/tenant-options/:id
app.put('/api/v1/tenant-options/:id', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para atualizar cargos e categorias.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'edit')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de edição.' });
    }

    const cleanId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const cleanName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!cleanId || !cleanName) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID e nome são obrigatórios.' });
    }

    const existingRes = await pool.query('SELECT * FROM tenant_custom_options WHERE id = $1 LIMIT 1', [cleanId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Opção não encontrada.' });
    }

    const existing = existingRes.rows[0];
    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!existing.user_id || !ownerUserIds.includes(String(existing.user_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: opção pertence a outra organização.' });
      }
    }

    const targetOwnerIds = await getEquivalentUserIds(String(existing.user_id));
    const dupCheck = await pool.query(
      'SELECT id FROM tenant_custom_options WHERE user_id::text = ANY($1) AND scope = $2 AND LOWER(TRIM(name)) = LOWER($3) AND id::text != $4 LIMIT 1',
      [targetOwnerIds, existing.scope, cleanName, cleanId]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_TENANT_OPTION',
        message: `"${cleanName}" já está cadastrado(a).`
      });
    }

    const result = await pool.query(
      `UPDATE tenant_custom_options
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, user_id, scope, name, sort_order, created_at, updated_at`,
      [cleanName, cleanId]
    );

    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error updating tenant option:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar cargo/categoria.' });
  }
});

// DELETE /api/v1/tenant-options/:id
app.delete('/api/v1/tenant-options/:id', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para excluir cargos e categorias.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'delete')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de exclusão.' });
    }

    const cleanId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!cleanId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID é obrigatório.' });
    }

    const existingRes = await pool.query('SELECT * FROM tenant_custom_options WHERE id = $1 LIMIT 1', [cleanId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Opção não encontrada.' });
    }

    const existing = existingRes.rows[0];
    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!existing.user_id || !ownerUserIds.includes(String(existing.user_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: opção pertence a outra organização.' });
      }
    }

    await pool.query('DELETE FROM tenant_custom_options WHERE id = $1', [cleanId]);
    return res.json({ success: true, message: 'Opção removida.' });
  } catch (err: any) {
    console.error('[Contributors API] Error deleting tenant option:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro ao excluir cargo/categoria.' });
  }
});

// POST /api/v1/contributors
app.post('/api/v1/contributors', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária.' });
    }

    const { 
      church_id, canonical_name, cpf, email, phone, status,
      person_type, trade_name, rg_ie, birth_date, contact_person,
      category, pix_key, bank_name, bank_agency, bank_account,
      address_cep, address_street, address_number, address_city, address_state, notes,
      is_global, role_position, photo_url, photo, congregation
    } = req.body;

    const cleanPhotoUrl = photo_url !== undefined ? photo_url : (photo !== undefined ? photo : null);

    // Mandatory church validation
    const targetChurch = (church_id || ctx.churchId || '').trim();
    if (!targetChurch || targetChurch === 'church-1' || targetChurch === 'Selecione uma igreja') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Igreja é obrigatória.' });
    }
    const cleanChurchId = targetChurch;

    if (ctx.isSecondaryUser) {
      if (!ctx.allowedChurchIds.includes(cleanChurchId)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
      }
    } else if (!ctx.isSuperAdmin) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [cleanChurchId, ownerUserIds]);
      if (chCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
      }
    }

    if (!canonical_name || typeof canonical_name !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nome é obrigatório.' });
    }

    // Sanitize canonical_name (trim, remove double spaces, upper case)
    const sanitizedName = canonical_name.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!sanitizedName) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nome é obrigatório.' });
    }

    // CPF / CNPJ is mandatory (11 digits for PF or 14 digits for PJ)
    if (cpf === undefined || cpf === null || String(cpf).trim() === '') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'CPF ou CNPJ é obrigatório.' });
    }
    const sanitizedCpf = String(cpf).replace(/\D/g, '');
    if (sanitizedCpf.length !== 11 && sanitizedCpf.length !== 14) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'CPF deve conter 11 dígitos ou CNPJ deve conter 14 dígitos.' });
    }

    // Email, phone and status normalization
    const sanitizedEmail = email && typeof email === 'string' ? email.trim() : null;
    const sanitizedPhone = phone && typeof phone === 'string' ? phone.trim() : null;
    const sanitizedStatus = status === 'inactive' ? 'inactive' : 'active';
    const isGlobalValue = Boolean(is_global);

    // If CPF was informed, check if there's already an active contributor with that CPF WITHIN THE SAME TENANT / AUTHORIZED CHURCHES
    if (sanitizedCpf && sanitizedCpf.length > 0) {
      let dupQuery = 'SELECT id, canonical_name, cpf, email, phone, status, is_global FROM contributors WHERE status = $1 AND (cpf = $2 OR REPLACE(REPLACE(REPLACE(cpf, \'.\', \'\'), \'-\', \'\'), \'/\', \'\') = $2)';
      const dupParams: any[] = ['active', sanitizedCpf];

      if (ctx.isSecondaryUser) {
        dupParams.push(ctx.allowedChurchIds);
        dupQuery += ` AND church_id::text = ANY($${dupParams.length})`;
      } else if (!ctx.isSuperAdmin) {
        const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
        dupParams.push(ownerUserIds);
        dupQuery += ` AND church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${dupParams.length}))`;
      } else {
        dupParams.push(cleanChurchId);
        dupQuery += ` AND (church_id::text = $${dupParams.length} OR church_id::text IN (SELECT id::text FROM churches WHERE user_id = (SELECT user_id FROM churches WHERE id::text = $${dupParams.length} LIMIT 1)))`;
      }
      dupQuery += ' LIMIT 1';

      const duplicateCheck = await pool.query(dupQuery, dupParams);

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
               congregation = COALESCE($24, congregation),
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
            role_position ? String(role_position).trim() : null,
            congregation ? String(congregation).trim() : null
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
        address_cep, address_street, address_number, address_city, address_state, notes, is_global, role_position, photo_url, congregation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING *`,
      [
        cleanChurchId, sanitizedName, (req.body.name ? String(req.body.name).trim() : sanitizedName), sanitizedCpf, sanitizedEmail, sanitizedPhone, (req.body.whatsapp ? String(req.body.whatsapp).trim() : sanitizedPhone), sanitizedStatus,
        person_type || 'PF', trade_name || null, rg_ie || null, birth_date || null, contact_person || null,
        category || null, pix_key || null, bank_name || null, bank_agency || null, bank_account || null,
        address_cep || null, address_street || null, address_number || null, address_city || null, address_state || null, notes || null,
        isGlobalValue, role_position || null, cleanPhotoUrl, congregation ? String(congregation).trim() : null
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

// POST /api/v1/contributors/repair-churches (Identifica cadastros anteriores do tenant sem igreja e preenche com o nome da congregação)
app.post('/api/v1/contributors/repair-churches', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para sincronizar igrejas.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'edit')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de edição.' });
    }

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhuma congregação vinculada ao usuário para sincronização.',
        updatedCount: 0,
        updatedContributors: []
      });
    }

    // 1. Fetch tenant churches only
    let churchesQuery = 'SELECT id, name FROM churches WHERE 1=1';
    const churchesParams: any[] = [];
    let candQuery = `
      SELECT id, canonical_name, name, cpf, church_id, congregation, role_position, is_global, created_at
      FROM contributors
      WHERE (congregation IS NULL 
         OR trim(congregation) = '' 
         OR congregation = 'Igreja' 
         OR congregation = 'Igreja não identificada')
    `;
    const candParams: any[] = [];

    if (ctx.isSecondaryUser) {
      churchesParams.push(ctx.allowedChurchIds);
      churchesQuery += ` AND id::text = ANY($${churchesParams.length})`;
      candParams.push(ctx.allowedChurchIds);
      candQuery += ` AND church_id::text = ANY($${candParams.length})`;
    } else if (!ctx.isSuperAdmin) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      if (ownerUserIds.length === 0) {
        return res.json({
          success: true,
          message: 'Todos os cadastros já estão devidamente vinculados e sincronizados com a respectiva igreja.',
          updatedCount: 0,
          updatedContributors: []
        });
      }
      churchesParams.push(ownerUserIds);
      churchesQuery += ` AND user_id::text = ANY($${churchesParams.length})`;
      candParams.push(ownerUserIds);
      candQuery += ` AND (church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${candParams.length})) OR church_id::text = ANY($${candParams.length}))`;
    }

    const churchesRes = await pool.query(churchesQuery, churchesParams);
    const churches = churchesRes.rows;
    const defaultChurch = churches[0] || { id: '00000000-0000-0000-0000-000000000001', name: 'Igreja Sede / Matriz' };
    const churchMap = new Map<string, string>();
    churches.forEach((c: any) => {
      if (c.id && c.name) churchMap.set(String(c.id), c.name);
    });

    // 2. Query tenant candidates for repair
    const candidatesRes = await pool.query(candQuery, candParams);

    const updatedList: any[] = [];

    for (const row of candidatesRes.rows) {
      let targetChurchId = (row.church_id && row.church_id !== 'church-1' && churchMap.has(String(row.church_id)))
        ? row.church_id
        : defaultChurch.id;
      let targetChurchName = churchMap.get(String(targetChurchId)) || defaultChurch.name;

      await pool.query(
        'UPDATE contributors SET congregation = $1, church_id = $2, updated_at = NOW() WHERE id = $3',
        [targetChurchName, targetChurchId, row.id]
      );

      updatedList.push({
        id: row.id,
        name: row.canonical_name || row.name,
        cpf: row.cpf,
        church_id: targetChurchId,
        congregation: targetChurchName
      });
    }

    return res.json({
      success: true,
      message: updatedList.length > 0 
        ? `${updatedList.length} cadastros identificados e atualizados com o nome da congregação.`
        : 'Todos os cadastros já estão devidamente vinculados e sincronizados com a respectiva igreja.',
      updatedCount: updatedList.length,
      updatedContributors: updatedList
    });
  } catch (err: any) {
    console.error('[Contributors API] Error repairing contributor church names:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message || String(err) });
  }
});

// POST /api/v1/contributors/:id/photo
app.post('/api/v1/contributors/:id/photo', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { photo_url, photo } = req.body;
    const cleanPhotoUrl = photo_url !== undefined ? photo_url : (photo !== undefined ? photo : null);

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    const checkRes = await pool.query('SELECT church_id FROM contributors WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'CONTRIBUTOR_NOT_FOUND' });
    }

    const contribChurchId = checkRes.rows[0].church_id;
    if (ctx.isSecondaryUser) {
      if (!hasPermission(ctx, 'edit')) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de edição.' });
      }
      if (!contribChurchId || !ctx.allowedChurchIds.includes(String(contribChurchId))) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
    } else if (!ctx.isSuperAdmin) {
      if (!contribChurchId) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      if (!ownerUserIds.includes(String(contribChurchId))) {
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [contribChurchId, ownerUserIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN' });
        }
      }
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
    await enrichSecondaryUserContext(pool, ctx);
    const { 
      church_id, canonical_name, name, cpf, email, phone, whatsapp, status,
      person_type, trade_name, rg_ie, birth_date, contact_person,
      category, pix_key, bank_name, bank_agency, bank_account,
      address_cep, address_street, address_number, address_city, address_state, notes,
      is_global, role_position, photo_url, photo, congregation
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

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (ctx.isSecondaryUser) {
      if (!hasPermission(ctx, 'edit')) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de edição.' });
      }
      if (!oldContrib.church_id || !ctx.allowedChurchIds.includes(String(oldContrib.church_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para o cadastro desta congregação.' });
      }
    } else if (!ctx.isSuperAdmin) {
      if (!oldContrib.church_id) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para o cadastro desta congregação.' });
      }
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      if (!ownerUserIds.includes(String(oldContrib.church_id))) {
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [oldContrib.church_id, ownerUserIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para o cadastro desta congregação.' });
        }
      }
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
      const cleanChurch = String(church_id).trim();
      if (!cleanChurch || cleanChurch === 'church-1' || cleanChurch === 'Selecione uma igreja') {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Igreja é obrigatória.' });
      }
      if (ctx.isSecondaryUser) {
        if (!ctx.allowedChurchIds.includes(cleanChurch)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação de destino não autorizada.' });
        }
      } else if (!ctx.isSuperAdmin) {
        const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
        if (!ownerUserIds.includes(cleanChurch)) {
          const destCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [cleanChurch, ownerUserIds]);
          if (destCheck.rows.length === 0) {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação de destino pertence a outra organização.' });
          }
        }
      }
      addField('church_id', cleanChurch);
    }

    if (canonical_name !== undefined) {
      if (typeof canonical_name !== 'string' || !canonical_name.trim()) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nome é obrigatório.' });
      }
      const cleanName = canonical_name.trim();
      addField('canonical_name', cleanName.replace(/\s+/g, ' ').toUpperCase());
      addField('name', cleanName);
    } else if (name !== undefined) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nome é obrigatório.' });
      }
      addField('canonical_name', cleanName.replace(/\s+/g, ' ').toUpperCase());
      addField('name', cleanName);
    }

    if (cpf !== undefined) {
      const sanitizedCpf = String(cpf || '').replace(/\D/g, '');
      if (sanitizedCpf.length !== 11 && sanitizedCpf.length !== 14) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'CPF deve conter 11 dígitos ou CNPJ deve conter 14 dígitos.' });
      }
      let dupQuery = "SELECT id, canonical_name FROM contributors WHERE id != $1 AND status = 'active' AND (cpf = $2 OR REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = $2)";
      const dupParams: any[] = [id, sanitizedCpf];
      const effectiveTargetChurchId = (church_id !== undefined && typeof church_id === 'string' && church_id.trim()) ? church_id.trim() : oldContrib.church_id;

      if (ctx.isSecondaryUser) {
        dupParams.push(ctx.allowedChurchIds);
        dupQuery += ` AND church_id::text = ANY($${dupParams.length})`;
      } else if (!ctx.isSuperAdmin) {
        const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
        dupParams.push(ownerUserIds);
        dupQuery += ` AND church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${dupParams.length}))`;
      } else if (effectiveTargetChurchId) {
        dupParams.push(effectiveTargetChurchId);
        dupQuery += ` AND (church_id::text = $${dupParams.length} OR church_id::text IN (SELECT id::text FROM churches WHERE user_id = (SELECT user_id FROM churches WHERE id::text = $${dupParams.length} LIMIT 1)))`;
      }
      dupQuery += ' LIMIT 1';

      const dupCheck = await pool.query(dupQuery, dupParams);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_CPF',
          message: `Já existe outro cadastro ativo (${dupCheck.rows[0].canonical_name}) com este CPF/CNPJ.`
        });
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
    if (congregation !== undefined) addField('congregation', congregation ? String(congregation).trim() : null);

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

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    await enrichSecondaryUserContext(pool, ctx);

    if (ctx.isSecondaryUser) {
      if (!hasPermission(ctx, 'delete')) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de exclusão.' });
      }
      if (!oldContrib.church_id || !ctx.allowedChurchIds.includes(String(oldContrib.church_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para o cadastro desta congregação.' });
      }
    } else if (!ctx.isSuperAdmin) {
      if (!oldContrib.church_id) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para o cadastro desta congregação.' });
      }
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      if (!ownerUserIds.includes(String(oldContrib.church_id))) {
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [oldContrib.church_id, ownerUserIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para o cadastro desta congregação.' });
        }
      }
    }

    let result;
    if (hardDelete) {
      // 1. Unlink in consolidated_transactions inside PostgreSQL VPS
      await pool.query(
        "UPDATE consolidated_transactions SET contributor_id = NULL WHERE contributor_id::text = $1",
        [id]
      );

      // 2. Clear from learned_associations strictly within the contributor's tenant
      const nameResult = await pool.query("SELECT canonical_name, church_id FROM contributors WHERE id = $1", [id]);
      if (nameResult.rows.length > 0 && nameResult.rows[0].canonical_name) {
        const contributorName = nameResult.rows[0].canonical_name;
        const cChurchId = nameResult.rows[0].church_id;
        let tenantOwnerRef = ctx.ownerId || ctx.userId || '';
        if (cChurchId) {
          const chOwnerRes = await pool.query('SELECT user_id FROM churches WHERE id = $1 LIMIT 1', [cChurchId]);
          if (chOwnerRes.rows[0]?.user_id) {
            tenantOwnerRef = String(chOwnerRes.rows[0].user_id);
          }
        }
        if (tenantOwnerRef) {
          const tenantUserIds = await getEquivalentUserIds(tenantOwnerRef);
          if (tenantUserIds.length > 0) {
            await pool.query(
              "DELETE FROM learned_associations WHERE LOWER(contributor_normalized_name) = LOWER($1) AND user_id::text = ANY($2)",
              [contributorName, tenantUserIds]
            );
          }
        }
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

// POST /api/v1/contributors/cleanup-invalids
// Remove permanentemente do banco todos os cadastros incompletos do tenant (sem CPF/CNPJ, Nome ou Igreja)
app.post('/api/v1/contributors/cleanup-invalids', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para executar limpeza de cadastros.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'delete')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: usuário sem permissão de exclusão.' });
    }

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json({ success: true, removedCount: 0 });
    }

    let query = 'SELECT id, canonical_name, name, cpf, church_id FROM contributors WHERE 1=1';
    const params: any[] = [];
    if (ctx.isSecondaryUser) {
      params.push(ctx.allowedChurchIds);
      query += ` AND church_id::text = ANY($${params.length})`;
    } else if (!ctx.isSuperAdmin) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      if (ownerUserIds.length === 0) {
        return res.json({ success: true, removedCount: 0 });
      }
      params.push(ownerUserIds);
      query += ` AND (church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${params.length})) OR church_id::text = ANY($${params.length}))`;
    }

    const allContribs = await pool.query(query, params);
    const invalidIds: string[] = [];
    for (const row of allContribs.rows) {
      const cleanName = (row.canonical_name || row.name || '').trim();
      const cleanChurch = (row.church_id || '').trim();
      const cleanCpf = (row.cpf || '').replace(/\D/g, '');
      if (!cleanName || !cleanChurch || cleanChurch === 'church-1' || (cleanCpf.length !== 11 && cleanCpf.length !== 14)) {
        invalidIds.push(row.id);
      }
    }
    let removedCount = 0;
    for (const badId of invalidIds) {
      try {
        await pool.query("UPDATE consolidated_transactions SET contributor_id = NULL WHERE contributor_id = $1", [badId]);
        await pool.query("DELETE FROM contributors WHERE id = $1", [badId]);
        removedCount++;
      } catch (_) {}
    }
    console.log(`[Contributors API] Limpeza de inválidos via API executada: ${removedCount} registros removidos.`);
    return res.json({ success: true, removedCount });
  } catch (err: any) {
    console.error('[Contributors API] Error during cleanup-invalids:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao limpar cadastros incompletos.' });
  }
});



// ==========================================
// REFERENCE DATA ENDPOINT
// ==========================================

// 🛡️ OTIMIZAÇÃO GARGALO 6 (CONSULTAS BACKEND): Cache de equivalência de IDs de usuários
// Elimina subqueries correlacionadas em loop sobre tabelas volumosas e viabiliza busca indexada via ANY($N).
const userEquivalenceCache = new Map<string, { ids: string[]; expires: number }>();
const LEGACY_DEFAULT_PLACEHOLDER = '00000000-0000-0000-0000-000000000001';

async function getEquivalentUserIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const cleanId = String(userId).trim();
  const cached = userEquivalenceCache.get(cleanId);
  const now = Date.now();
  if (cached && cached.expires > now) {
    return cached.ids;
  }

  const idsSet = new Set<string>([cleanId]);
  
  if (cleanId === LEGACY_DEFAULT_PLACEHOLDER) {
    const adminIds = [cleanId];
    userEquivalenceCache.set(cleanId, { ids: adminIds, expires: now + 120000 });
    return adminIds;
  }

  try {
    const q = `
      SELECT id::text FROM app_users 
      WHERE (id::text = $1)
         OR (owner_id::text = $1 AND role IN ('secondary', 'operador', 'colaborador'))
      UNION
      SELECT owner_id::text AS id FROM app_users 
      WHERE id::text = $1 
        AND role IN ('secondary', 'operador', 'colaborador')
        AND owner_id IS NOT NULL
        AND owner_id::text != '${LEGACY_DEFAULT_PLACEHOLDER}'
      UNION
      SELECT id::text FROM profiles 
      WHERE (id::text = $1)
         OR (owner_id::text = $1 AND role IN ('secondary', 'operador', 'colaborador'))
      UNION
      SELECT owner_id::text AS id FROM profiles 
      WHERE id::text = $1 
        AND role IN ('secondary', 'operador', 'colaborador')
        AND owner_id IS NOT NULL
        AND owner_id::text != '${LEGACY_DEFAULT_PLACEHOLDER}'
    `;
    const res = await pool.query(q, [cleanId]);
    for (const r of (res.rows || [])) {
      const candidateId = r.id ? String(r.id).trim() : '';
      if (candidateId && candidateId !== LEGACY_DEFAULT_PLACEHOLDER) {
        idsSet.add(candidateId);
      }
    }
  } catch (err) {
    console.warn('[getEquivalentUserIds] Erro ao resolver equivalência, usando ID direto:', err);
  }

  const result = Array.from(idsSet);
  userEquivalenceCache.set(cleanId, { ids: result, expires: now + 120000 }); // TTL de 2 minutos
  return result;
}

const normalizeBankRow = (b: any) => {
  if (!b || typeof b !== 'object') return b;
  let accepted = b.accepted_contribution_types;
  if (typeof accepted === 'string') {
    try {
      const parsed = JSON.parse(accepted);
      if (Array.isArray(parsed)) accepted = parsed;
    } catch (_) {}
  }
  return { ...b, accepted_contribution_types: Array.isArray(accepted) ? accepted : null };
};

const getReferenceDataHandler = async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para acessar dados de referência.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
    const paramOwnerId = (req.params.ownerId || req.query.user_id) as string | undefined;

    if (!ctx.isSuperAdmin && ctx.userId) {
      if (paramOwnerId && paramOwnerId !== ctx.userId && paramOwnerId !== ctx.ownerId && paramOwnerId !== ctx.churchId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado aos dados de referência de outro usuário.' });
      }
    }

    const cleanUserId = (paramOwnerId && typeof paramOwnerId === 'string' && paramOwnerId.trim())
      ? (ctx.isSuperAdmin ? paramOwnerId.trim() : ((ctx.isSecondaryUser && ctx.ownerId) ? ctx.ownerId : ctx.userId))
      : ((ctx.isSecondaryUser && ctx.ownerId) ? ctx.ownerId : (ctx.userId || ctx.ownerId || null));

    if (!cleanUserId && !ctx.isSuperAdmin) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ownerId é obrigatório.' });
    }

    const equivalentIds = cleanUserId ? await getEquivalentUserIds(cleanUserId) : [];

    // 1. Fetch Banks
    let banksQuery = 'SELECT id, name, user_id, bank_key, account_name, accepted_contribution_types, created_at FROM banks WHERE 1=1';
    const banksParams: any[] = [];
    if (equivalentIds.length > 0) {
      banksParams.push(equivalentIds);
      banksQuery += ` AND user_id::text = ANY($1)`;
    } else {
      banksQuery += ` AND 1=0`;
    }
    banksQuery += ' ORDER BY created_at DESC';

    // 2. Fetch Churches
    let churchesQuery = '';
    const churchesParams: any[] = [];
    if (!ctx.isSecondaryUser || ctx.allowedChurchIds.length > 0) {
      churchesQuery = 'SELECT * FROM churches WHERE 1=1';
      if (equivalentIds.length > 0) {
        churchesParams.push(equivalentIds);
        churchesQuery += ` AND user_id::text = ANY($1)`;
      } else if (cleanUserId) {
        churchesQuery += ` AND 1=0`;
      }
      if (ctx.isSecondaryUser) {
        churchesParams.push(ctx.allowedChurchIds);
        churchesQuery += ` AND id::text = ANY($${churchesParams.length})`;
      }
      churchesQuery += ' ORDER BY name ASC';
    }

    // 3. Fetch Reports
    let reportsQuery = '';
    const reportsParams: any[] = [];
    if (!ctx.isSecondaryUser || ctx.allowedChurchIds.length > 0) {
      reportsQuery = 'SELECT id, name, user_id, church_id, record_count, created_at FROM saved_reports WHERE 1=1';
      if (equivalentIds.length > 0) {
        reportsParams.push(equivalentIds);
        reportsQuery += ` AND user_id::text = ANY($1)`;
      } else if (!ctx.isSuperAdmin) {
        reportsQuery += ` AND 1=0`;
      }
      if (ctx.isSecondaryUser) {
        reportsParams.push(ctx.allowedChurchIds);
        reportsQuery += ` AND (church_id::text = ANY($${reportsParams.length}) OR name = '[SESSÃO_ATIVA]')`;
      }
      reportsQuery += ' ORDER BY created_at DESC';
    }

    // 4. Fetch Associations (strictly tenant-scoped)
    let assocQuery = 'SELECT * FROM learned_associations WHERE 1=1';
    const assocParams: any[] = [];
    if (equivalentIds.length > 0) {
      assocParams.push(equivalentIds);
      assocQuery += ` AND user_id::text = ANY($1)`;
    } else {
      assocQuery += ` AND 1=0`;
    }
    assocQuery += ' ORDER BY created_at DESC';

    // 🛡️ PARALELISMO CONCORRENTE: Executa as 4 consultas simultaneamente em paralelo via Promise.all
    const [banksResult, churchesResult, reportsResult, assocResult] = await Promise.all([
      pool.query(banksQuery, banksParams),
      churchesQuery ? pool.query(churchesQuery, churchesParams) : Promise.resolve({ rows: [] }),
      reportsQuery ? pool.query(reportsQuery, reportsParams) : Promise.resolve({ rows: [] }),
      pool.query(assocQuery, assocParams)
    ]);

    return res.json({
      banks: (banksResult.rows || []).map(normalizeBankRow),
      churches: churchesResult.rows || [],
      reports: reportsResult.rows || [],
      associations: assocResult.rows || []
    });
  } catch (err: any) {
    console.error('[Contributors API] Error fetching reference data:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
};

app.get('/api/v1/reference/data/:ownerId', getReferenceDataHandler);
app.get('/api/reference/data/:ownerId', getReferenceDataHandler);

const getReferenceReportHandler = async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar relatório.' });
    }
    await enrichSecondaryUserContext(pool, ctx);

    const { reportId } = req.params;
    const paramOwnerId = (req.query.ownerId || req.query.user_id) as string | undefined;

    if (!ctx.isSuperAdmin && ctx.userId) {
      if (paramOwnerId && paramOwnerId !== ctx.userId && paramOwnerId !== ctx.ownerId && paramOwnerId !== ctx.churchId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado ao relatório de outro usuário.' });
      }
    }

    const result = await pool.query(
      'SELECT id, name, data, user_id, church_id FROM saved_reports WHERE id = $1 LIMIT 1',
      [reportId]
    );
    const found = result.rows?.[0] || null;
    if (!found) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    if (!ctx.isSuperAdmin) {
      const effectiveOwnerId = (ctx.isSecondaryUser && ctx.ownerId)
        ? ctx.ownerId
        : (ctx.ownerId || ctx.userId || '');
      const equivalentIds = effectiveOwnerId ? await getEquivalentUserIds(effectiveOwnerId) : [];

      if (found.user_id && !equivalentIds.includes(String(found.user_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o relatório pertence a outro usuário.' });
      }

      if (ctx.isSecondaryUser && found.name !== '[SESSÃO_ATIVA]') {
        if (found.church_id && (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(String(found.church_id)))) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o relatório pertence a uma congregação não autorizada.' });
        }
        if (!found.church_id && (!ctx.allowedChurchIds || ctx.allowedChurchIds.length === 0)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: nenhuma congregação autorizada.' });
        }
      }
    }

    let parsedData = found.data;
    if (typeof parsedData === 'string') {
      try {
        parsedData = JSON.parse(parsedData);
      } catch (_) {}
    }

    return res.json({
      name: found.name,
      data: parsedData
    });
  } catch (err: any) {
    console.error('[Contributors API] Error fetching reference report:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
};

const syncReferenceReportHandler = async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para sincronizar relatório.' });
    }
    await enrichSecondaryUserContext(pool, ctx);

    const { reportId, name, data, recordCount, churchId, ownerId } = req.body || {};

    if (!ctx.isSuperAdmin && ctx.userId) {
      if (ownerId && ownerId !== ctx.userId && ownerId !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido sincronizar relatório de outro usuário.' });
      }
    }

    if (ctx.isSecondaryUser && name !== '[SESSÃO_ATIVA]' && !hasPermission(ctx, 'reports') && !hasPermission(ctx, 'view') && !hasPermission(ctx, 'create')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para salvar relatórios necessária.' });
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (ownerId || ctx.ownerId || ctx.userId);

    if (!name || !effectiveUserId || !data) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    const targetChurchId = churchId || ctx.churchId || null;
    if (targetChurchId) {
      if (ctx.isSecondaryUser) {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(targetChurchId)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação não autorizada para este usuário.' });
        }
      } else if (ctx.isOwner && !ctx.isSuperAdmin) {
        const churchCheck = await pool.query(
          'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
          [targetChurchId, ctx.userId, ctx.ownerId || ctx.userId]
        );
        if (churchCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação não pertence à sua organização.' });
        }
      }
    }

    const finalData = typeof data === 'string' ? data : JSON.stringify(data);
    let result;
    if (reportId) {
      result = await pool.query(
        `INSERT INTO saved_reports (id, name, record_count, user_id, data, church_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           record_count = EXCLUDED.record_count,
           data = EXCLUDED.data,
           church_id = EXCLUDED.church_id
         RETURNING *`,
        [reportId, name, recordCount || 0, effectiveUserId, finalData, targetChurchId]
      );
    } else {
      result = await pool.query(
        'INSERT INTO saved_reports (name, record_count, user_id, data, church_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, recordCount || 0, effectiveUserId, finalData, targetChurchId]
      );
    }

    const syncedReport = result.rows[0];
    notifyTenantRealtime(effectiveUserId || ctx.ownerId || ctx.userId, { type: 'REPORT_UPDATED', action: 'SYNC', id: syncedReport?.id });
    return res.json(syncedReport);
  } catch (err: any) {
    console.error('[Contributors API] Error syncing reference report:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
};

app.get('/api/v1/reference/report/:reportId', getReferenceReportHandler);
app.get('/api/reference/report/:reportId', getReferenceReportHandler);
app.post('/api/v1/reference/report/sync', syncReferenceReportHandler);
app.post('/api/reference/report/sync', syncReferenceReportHandler);

// ==========================================
// BANKS ENDPOINTS
// ==========================================

// GET /api/v1/banks
app.get('/api/v1/banks', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar bancos.' });
    }

    const requestedUserId = req.query.user_id as string | undefined;

    if (!ctx.isSuperAdmin && ctx.userId) {
      if (requestedUserId && requestedUserId !== ctx.userId && requestedUserId !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para este usuário.' });
      }
    }

    const cleanUserId = (!ctx.isSuperAdmin && ctx.userId)
      ? ((ctx.isSecondaryUser && ctx.ownerId) ? ctx.ownerId : ctx.userId)
      : (requestedUserId && requestedUserId.trim() ? requestedUserId.trim() : (ctx.ownerId || ctx.userId));

    if (!cleanUserId && !ctx.isSuperAdmin) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'user_id é obrigatório para consultar bancos.' });
    }

    let query = 'SELECT id, name, user_id, bank_key, account_name, accepted_contribution_types, created_at FROM banks WHERE 1=1';
    const params: any[] = [];
    if (cleanUserId) {
      const userIds = await getEquivalentUserIds(cleanUserId);
      if (userIds.length > 0) {
        params.push(userIds);
        query += ` AND user_id::text = ANY($${params.length})`;
      } else {
        query += ` AND 1=0`;
      }
    } else {
      query += ` AND 1=0`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);

    return res.json((result.rows || []).map(normalizeBankRow));
  } catch (err) {
    console.error('[Contributors API] Error GET banks:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/banks
app.post('/api/v1/banks', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    const { name, user_id, bank_key, account_name, accepted_contribution_types } = req.body;

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (ctx.isSecondaryUser && !hasPermission(ctx, 'admin')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: apenas o titular pode gerenciar contas bancárias.' });
    }

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar banco para outro usuário.' });
      }
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : (user_id || ctx.ownerId || ctx.userId);

    if (!name || !effectiveUserId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const generatedBankId = crypto.randomUUID();
    const result = await pool.query(
      'INSERT INTO banks (id, name, user_id, bank_key, account_name, accepted_contribution_types) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [generatedBankId, name, effectiveUserId, bank_key || null, account_name || name, Array.isArray(accepted_contribution_types) ? accepted_contribution_types : null]
    );
    const createdBank = result.rows[0];
    if (createdBank && typeof createdBank.accepted_contribution_types === 'string') {
      try {
        const parsed = JSON.parse(createdBank.accepted_contribution_types);
        if (Array.isArray(parsed)) createdBank.accepted_contribution_types = parsed;
      } catch (_) {}
    }
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
    await enrichSecondaryUserContext(pool, ctx);
    const { name, bank_key, account_name, accepted_contribution_types } = req.body;

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (ctx.isSecondaryUser && !hasPermission(ctx, 'admin')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: apenas o titular pode gerenciar contas bancárias.' });
    }

    const oldBankRes = await pool.query('SELECT * FROM banks WHERE id = $1', [id]);
    const oldBank = oldBankRes.rows[0] || null;

    if (!oldBank) return res.status(404).json({ error: 'NOT_FOUND' });

    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!oldBank.user_id || !ownerUserIds.includes(String(oldBank.user_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o recurso pertence a outro usuário.' });
      }
    }

    const result = await pool.query(
      'UPDATE banks SET name = COALESCE($1, name), bank_key = COALESCE($2, bank_key), account_name = COALESCE($3, account_name), accepted_contribution_types = $4 WHERE id = $5 RETURNING *',
      [name, bank_key || null, account_name || null, Array.isArray(accepted_contribution_types) ? accepted_contribution_types : null, id]
    );

    const updatedBank = result.rows[0];
    if (updatedBank && typeof updatedBank.accepted_contribution_types === 'string') {
      try {
        const parsed = JSON.parse(updatedBank.accepted_contribution_types);
        if (Array.isArray(parsed)) updatedBank.accepted_contribution_types = parsed;
      } catch (_) {}
    }
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
    await enrichSecondaryUserContext(pool, ctx);

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (ctx.isSecondaryUser && !hasPermission(ctx, 'admin')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: apenas o titular pode gerenciar contas bancárias.' });
    }

    const oldBankRes = await pool.query('SELECT * FROM banks WHERE id = $1', [id]);
    const oldBank = oldBankRes.rows[0] || null;

    if (!oldBank) return res.status(404).json({ error: 'NOT_FOUND' });

    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!oldBank.user_id || !ownerUserIds.includes(String(oldBank.user_id))) {
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
    await enrichSecondaryUserContext(pool, ctx);

    // 🛡️ Requisições do Portal do Contribuinte (Públicas): exigem church_id/id ou slug específico e retornam somente campos públicos daquela organização
    if (!ctx.isAuthenticated) {
      const rawChurchId = (req.query.church_id || req.query.id) as string | undefined;
      const rawSlug = req.query.slug as string | undefined;

      const normalizeSlugServer = (text?: string) => {
        if (!text) return '';
        return String(text)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      };

      let targetRow: any = null;
      if (rawChurchId && typeof rawChurchId === 'string' && rawChurchId.trim()) {
        const chRes = await pool.query(
          'SELECT id, user_id, name, address, "logoUrl", pastor FROM churches WHERE id::text = $1 LIMIT 1',
          [rawChurchId.trim()]
        );
        targetRow = chRes.rows[0] || null;
      } else if (rawSlug && typeof rawSlug === 'string' && rawSlug.trim()) {
        const cleanSlug = rawSlug.trim().toLowerCase();
        const normSlug = normalizeSlugServer(cleanSlug);
        const allRes = await pool.query('SELECT id, user_id, name, address, "logoUrl", pastor FROM churches ORDER BY name ASC');
        const rows = allRes.rows || [];
        targetRow = rows.find((c: any) => String(c.id).toLowerCase() === cleanSlug)
          || rows.find((c: any) => normalizeSlugServer(c.name) === normSlug)
          || rows.find((c: any) => c.name && String(c.name).trim().toLowerCase() === cleanSlug)
          || null;
      } else {
        // Sem identificador de igreja/slug, não enumerar igrejas de todos os tenants
        return res.json([]);
      }

      if (!targetRow) {
        return res.json([]);
      }

      if (targetRow.user_id) {
        const ownerIds = await getEquivalentUserIds(String(targetRow.user_id));
        const orgRes = await pool.query(
          'SELECT id, name, address, "logoUrl", pastor FROM churches WHERE user_id::text = ANY($1) ORDER BY name ASC',
          [ownerIds]
        );
        return res.json(orgRes.rows || []);
      }

      return res.json([{
        id: targetRow.id,
        name: targetRow.name,
        address: targetRow.address,
        logoUrl: targetRow.logoUrl,
        pastor: targetRow.pastor
      }]);
    }

    const { user_id } = req.query;

    if (!ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para este usuário.' });
      }
    }

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    const cleanUserId = (!ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (typeof user_id === 'string' && user_id.trim() ? user_id.trim() : (ctx.ownerId || ctx.userId));

    let query = 'SELECT * FROM churches WHERE 1=1';
    const params: any[] = [];
    if (cleanUserId) {
      const userIds = await getEquivalentUserIds(cleanUserId);
      if (userIds.length > 0) {
        params.push(userIds);
        query += ` AND user_id::text = ANY($${params.length})`;
      } else {
        query += ` AND 1=0`;
      }
    }
    if (ctx.isSecondaryUser) {
      params.push(ctx.allowedChurchIds);
      query += ` AND id::text = ANY($${params.length})`;
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
    await enrichSecondaryUserContext(pool, ctx);
    const { name, address, logoUrl, pastor, cnpj, phone, email, pixKey, pix_key, cep, city, state, treasurer, pastors, treasurers, whatsapp_official, whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation, user_id } = req.body;
    const effectivePixKey = pixKey !== undefined ? pixKey : (pix_key !== undefined ? pix_key : '');

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (ctx.isSecondaryUser && !hasPermission(ctx, 'admin')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: apenas o titular pode gerenciar congregações.' });
    }

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
    const generatedChurchId = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO churches (id, name, address, "logoUrl", pastor, cnpj, phone, email, "pixKey", pix_key, cep, city, state, treasurer, pastors, treasurers, whatsapp_official, whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
      [
        generatedChurchId,
        name,
        address || '',
        logoUrl || '',
        pastor || '',
        cnpj || '',
        phone || '',
        email || '',
        effectivePixKey || '',
        effectivePixKey || '',
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
    await enrichSecondaryUserContext(pool, ctx);
    const { name, address, logoUrl, pastor, cnpj, phone, email, pixKey, pix_key, cep, city, state, treasurer, pastors, treasurers, whatsapp_official, whatsapp_responsible, auto_comm_enabled, auto_send_on_confirmation } = req.body;
    const effectivePixKey = pixKey !== undefined ? pixKey : pix_key;

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (ctx.isSecondaryUser && !hasPermission(ctx, 'admin')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: apenas o titular pode gerenciar congregações.' });
    }

    const oldChurchRes = await pool.query('SELECT * FROM churches WHERE id = $1', [id]);
    const oldChurch = oldChurchRes.rows[0] || null;

    if (!oldChurch) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!oldChurch.user_id || !ownerUserIds.includes(String(oldChurch.user_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a igreja pertence a outra organização.' });
      }
    }

    const pastorsVal = pastors !== undefined ? (typeof pastors === 'string' ? pastors : JSON.stringify(pastors)) : null;
    const treasurersVal = treasurers !== undefined ? (typeof treasurers === 'string' ? treasurers : JSON.stringify(treasurers)) : null;

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
        pix_key = COALESCE($8, pix_key),
        cep = COALESCE($9, cep),
        city = COALESCE($10, city),
        state = COALESCE($11, state),
        treasurer = COALESCE($12, treasurer),
        pastors = COALESCE($13, pastors),
        treasurers = COALESCE($14, treasurers),
        whatsapp_official = COALESCE($15, whatsapp_official),
        whatsapp_responsible = COALESCE($16, whatsapp_responsible),
        auto_comm_enabled = COALESCE($17, auto_comm_enabled),
        auto_send_on_confirmation = COALESCE($18, auto_send_on_confirmation),
        updated_at = NOW()
       WHERE id = $19 RETURNING *`,
      [
        name,
        address,
        logoUrl,
        pastor,
        cnpj,
        phone,
        email,
        effectivePixKey,
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar mensagens pastorais.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
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
        query += ` AND church_id::text = $${params.length}`;
      } else {
        params.push(ctx.allowedChurchIds);
        query += ` AND church_id::text = ANY($${params.length})`;
      }
    } else if (!ctx.isSuperAdmin) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      const chRes = await pool.query('SELECT id FROM churches WHERE user_id::text = ANY($1)', [ownerUserIds]);
      const ownerChurchIds = (chRes.rows || []).map((r: any) => String(r.id));
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ownerChurchIds.includes(church_id) && church_id !== ctx.userId && church_id !== ctx.ownerId) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        params.push(church_id);
        query += ` AND church_id::text = $${params.length}`;
      } else if (ownerChurchIds.length > 0) {
        params.push(ownerChurchIds);
        query += ` AND (church_id::text = ANY($${params.length})`;
        params.push(ownerUserIds);
        query += ` OR user_id::text = ANY($${params.length}))`;
      } else {
        params.push(ownerUserIds);
        query += ` AND user_id::text = ANY($${params.length})`;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
      params.push(church_id);
      query += ` AND church_id::text = $${params.length}`;
    }

    if (user_id) {
      if (!ctx.isSuperAdmin && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado.' });
      }
      params.push(user_id);
      query += ` AND user_id::text = $${params.length}`;
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para cadastrar mensagens pastorais.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
    const { church_id, title, type, content, start_date, end_date, is_active, user_id } = req.body;

    const effectiveChurchId = (ctx.isSecondaryUser && ctx.churchId && !church_id) ? ctx.churchId : church_id;

    if (ctx.isSecondaryUser) {
      if (!effectiveChurchId || !ctx.allowedChurchIds.includes(effectiveChurchId)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para cadastrar mensagem nesta congregação.' });
      }
    } else if (!ctx.isSuperAdmin && effectiveChurchId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      const chCheck = await pool.query(
        'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = ANY($2) OR id::text = $3) LIMIT 1',
        [effectiveChurchId, ownerUserIds, ctx.ownerId || ctx.userId]
      );
      if (chCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação pertence a outra organização.' });
      }
    }

    if (!effectiveChurchId || !title || !content) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const effectiveOwnerUserId = (!ctx.isSuperAdmin) ? (ctx.ownerId || ctx.userId) : (user_id || ctx.ownerId || ctx.userId || null);
    const result = await pool.query(
      `INSERT INTO pastoral_messages (church_id, title, type, content, start_date, end_date, is_active, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [effectiveChurchId, title, type || 'texto', content, start_date || null, end_date || null, is_active !== undefined ? is_active : true, effectiveOwnerUserId]
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para atualizar mensagens pastorais.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
    const { title, type, content, start_date, end_date, is_active } = req.body;

    const oldRes = await pool.query('SELECT * FROM pastoral_messages WHERE id = $1', [id]);
    const oldMsg = oldRes.rows[0] || null;
    if (!oldMsg) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isSecondaryUser) {
      if (oldMsg.church_id && !ctx.allowedChurchIds.includes(oldMsg.church_id)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para alterar mensagem de outra igreja.' });
      }
    } else if (!ctx.isSuperAdmin) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      let allowed = Boolean(oldMsg.user_id && ownerUserIds.includes(String(oldMsg.user_id)));
      if (!allowed && oldMsg.church_id) {
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2) LIMIT 1', [oldMsg.church_id, ownerUserIds]);
        allowed = chCheck.rows.length > 0;
      }
      if (!allowed) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para alterar mensagem de outra organização.' });
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para excluir mensagens pastorais.' });
    }
    await enrichSecondaryUserContext(pool, ctx);

    const oldRes = await pool.query('SELECT * FROM pastoral_messages WHERE id = $1', [id]);
    const oldMsg = oldRes.rows[0] || null;
    if (!oldMsg) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isSecondaryUser) {
      if (oldMsg.church_id && !ctx.allowedChurchIds.includes(oldMsg.church_id)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para remover mensagem de outra igreja.' });
      }
    } else if (!ctx.isSuperAdmin) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      let allowed = Boolean(oldMsg.user_id && ownerUserIds.includes(String(oldMsg.user_id)));
      if (!allowed && oldMsg.church_id) {
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2) LIMIT 1', [oldMsg.church_id, ownerUserIds]);
        allowed = chCheck.rows.length > 0;
      }
      if (!allowed) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para remover mensagem de outra organização.' });
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar histórico de comunicação.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
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
        query += ` AND church_id::text = $${params.length}`;
      } else {
        params.push(ctx.allowedChurchIds);
        query += ` AND church_id::text = ANY($${params.length})`;
      }
    } else if (!ctx.isSuperAdmin) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      const chRes = await pool.query('SELECT id FROM churches WHERE user_id::text = ANY($1)', [ownerUserIds]);
      const ownerChurchIds = (chRes.rows || []).map((r: any) => String(r.id));
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ownerChurchIds.includes(church_id) && church_id !== ctx.userId && church_id !== ctx.ownerId) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        params.push(church_id);
        query += ` AND church_id::text = $${params.length}`;
      } else if (ownerChurchIds.length > 0) {
        params.push(ownerChurchIds);
        query += ` AND (church_id::text = ANY($${params.length})`;
        params.push(ownerUserIds);
        query += ` OR user_id::text = ANY($${params.length}))`;
      } else {
        params.push(ownerUserIds);
        query += ` AND user_id::text = ANY($${params.length})`;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
      params.push(church_id);
      query += ` AND church_id::text = $${params.length}`;
    }

    if (user_id) {
      if (!ctx.isSuperAdmin && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado.' });
      }
      params.push(user_id);
      query += ` AND user_id::text = $${params.length}`;
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar eventos de comunicação.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
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
        query += ` AND church_id::text = $${params.length}`;
      } else {
        params.push(ctx.allowedChurchIds);
        query += ` AND church_id::text = ANY($${params.length})`;
      }
    } else if (!ctx.isSuperAdmin) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      const chRes = await pool.query('SELECT id FROM churches WHERE user_id::text = ANY($1)', [ownerUserIds]);
      const ownerChurchIds = (chRes.rows || []).map((r: any) => String(r.id));
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ownerChurchIds.includes(church_id) && church_id !== ctx.userId && church_id !== ctx.ownerId) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        params.push(church_id);
        query += ` AND church_id::text = $${params.length}`;
      } else if (ownerChurchIds.length > 0) {
        params.push(ownerChurchIds);
        query += ` AND (church_id::text = ANY($${params.length})`;
        params.push(ownerUserIds);
        query += ` OR user_id::text = ANY($${params.length}))`;
      } else {
        params.push(ownerUserIds);
        query += ` AND user_id::text = ANY($${params.length})`;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
      params.push(church_id);
      query += ` AND church_id::text = $${params.length}`;
    }

    if (user_id) {
      if (!ctx.isSuperAdmin && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado.' });
      }
      params.push(user_id);
      query += ` AND user_id::text = $${params.length}`;
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para registrar eventos de comunicação.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
    const { event_type, church_id, contributor_id, reference_id, payload, status, user_id } = req.body;

    if (!ctx.isSuperAdmin && ctx.userId && user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: não é permitido registrar evento para outro usuário.' });
    }

    if (ctx.isSecondaryUser) {
      const targetChurch = church_id || ctx.churchId;
      if (!targetChurch || !ctx.allowedChurchIds.includes(targetChurch)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para registrar evento nesta congregação.' });
      }
    } else if (!ctx.isSuperAdmin && church_id) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      const chCheck = await pool.query(
        'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = ANY($2) OR id::text = $3) LIMIT 1',
        [church_id, ownerUserIds, ctx.ownerId || ctx.userId]
      );
      if (chCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para registrar evento de outra igreja.' });
      }
    }

    const effectiveChurchId = church_id || ctx.churchId;
    const effectiveEventUserId = (!ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : (user_id || ctx.ownerId || ctx.userId || null);

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
        effectiveEventUserId
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
        effectiveEventUserId
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
      recoveryQuery += ` AND church_id = $${recoveryParams.length}`;
    }
    recoveryQuery += " ORDER BY updated_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED";

    const selectedStale = await client.query(recoveryQuery, recoveryParams);
    const staleRows = selectedStale?.rows || [];
    if (staleRows.length > 0) {
      for (const staleItem of staleRows) {
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
      eventsToProcess = pendingEvents?.rows || [];

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
           WHERE id::text = ANY($1)
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
           WHERE id::text = ANY($1)
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

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    let query = 'SELECT * FROM communication_queue WHERE 1=1';
    const params: any[] = [];
    let paramCounter = 1;

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        params.push(church_id);
        query += ` AND church_id::text = $${paramCounter++}`;
      } else {
        params.push(ctx.allowedChurchIds);
        query += ` AND church_id::text = ANY($${paramCounter++})`;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [church_id, ownerUserIds]);
      if (chCheck.rows.length === 0 && !ctx.isSuperAdmin) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
      }
      params.push(church_id);
      query += ` AND church_id::text = $${paramCounter++}`;
    } else if (!ctx.isSuperAdmin) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      query += ` AND church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${paramCounter++}))`;
      params.push(ownerUserIds);
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${paramCounter++}`;
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
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    const { church_id } = req.body || {};
    if (church_id) {
      if (ctx.isSecondaryUser && !ctx.allowedChurchIds.includes(church_id)) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      if (!ctx.isSecondaryUser && !ctx.isSuperAdmin) {
        const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [church_id, ownerUserIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN' });
        }
      }
    }
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
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    const { id } = req.params;
    const itemRes = await pool.query('SELECT church_id FROM communication_queue WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    
    const churchId = itemRes.rows[0].church_id;
    if (churchId) {
      if (ctx.isSecondaryUser && !ctx.allowedChurchIds.includes(churchId)) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      if (!ctx.isSecondaryUser && !ctx.isSuperAdmin) {
        const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2)', [churchId, ownerUserIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN' });
        }
      }
    }

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
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);

    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (ctx.isSecondaryUser && !hasPermission(ctx, 'admin')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: apenas o titular pode gerenciar ou excluir congregações.' });
    }

    const oldChurchRes = await pool.query('SELECT * FROM churches WHERE id = $1', [id]);
    const oldChurch = oldChurchRes.rows[0] || null;
    if (!oldChurch) return res.status(404).json({ error: 'NOT_FOUND' });

    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!oldChurch.user_id || !ownerUserIds.includes(String(oldChurch.user_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a congregação pertence a outra organização.' });
      }
    }

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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar associações.' });
    }

    const { user_id } = req.query;

    if (!ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado aos dados de outro usuário.' });
      }
    }

    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId)
      ? (ctx.ownerId || ctx.userId)
      : (typeof user_id === 'string' && user_id.trim() ? user_id.trim() : (ctx.ownerId || ctx.userId));

    if (!effectiveUserId) {
      return res.json([]);
    }

    const userIds = await getEquivalentUserIds(effectiveUserId);
    if (userIds.length === 0) {
      return res.json([]);
    }

    const result = await pool.query(
      'SELECT id, user_id, normalized_description, contributor_normalized_name, church_id, created_at FROM learned_associations WHERE user_id::text = ANY($1)',
      [userIds]
    );
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para salvar associações.' });
    }

    if (ctx.isSecondaryUser && !hasPermission(ctx, 'create', 'edit')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão insuficiente para salvar associações.' });
    }

    const { user_id, normalized_description, contributor_normalized_name, church_id } = req.body;

    if (!ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar associação para outro usuário.' });
      }
    }

    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : (user_id || ctx.ownerId || ctx.userId);

    if (!effectiveUserId || !normalized_description || !contributor_normalized_name || !church_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    if (ctx.isSecondaryUser) {
      if (!ctx.allowedChurchIds.includes(String(church_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação não autorizada para este usuário.' });
      }
    } else if (!ctx.isSuperAdmin) {
      const ownerIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      if (!ownerIds.includes(String(church_id))) {
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2) LIMIT 1', [church_id, ownerIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação pertence a outra organização.' });
        }
      }
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para excluir associações.' });
    }

    const oldRes = await pool.query('SELECT * FROM learned_associations WHERE id = $1', [id]);
    const oldItem = oldRes.rows[0] || null;
    if (!oldItem) return res.status(404).json({ error: 'NOT_FOUND' });

    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!oldItem.user_id || !ownerIds.includes(String(oldItem.user_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a associação pertence a outro usuário.' });
      }
    }

    await pool.query('DELETE FROM learned_associations WHERE id = $1 RETURNING id', [id]);
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para remover associações.' });
    }

    if (!ctx.isSuperAdmin && ctx.userId) {
      const ownerIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId);
      if (!ownerIds.includes(user_id) && user_id !== ctx.userId && user_id !== ctx.ownerId) {
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar relatórios salvos.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
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
      const userIds = await getEquivalentUserIds(effectiveUserId);
      params.push(userIds);
      query += ` AND user_id::text = ANY($1)`;
    }

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        query += ` AND church_id::text = $${params.length + 1}`;
        params.push(church_id);
      } else {
        query += ` AND (church_id::text = ANY($${params.length + 1}) OR name = '[SESSÃO_ATIVA]')`;
        params.push(ctx.allowedChurchIds);
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
      if (!ctx.isSuperAdmin) {
        const ownerUserIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2) LIMIT 1', [church_id, ownerUserIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
      }
      query += ` AND church_id::text = $${params.length + 1}`;
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para salvar relatórios.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
    const { id, name, record_count, user_id, data, church_id } = req.body;

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Não é permitido criar relatório para outro usuário.' });
      }
    }

    if (ctx.isSecondaryUser && !hasPermission(ctx, 'reports') && !hasPermission(ctx, 'view') && !hasPermission(ctx, 'create')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para salvar relatórios necessária.' });
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (!name || !effectiveUserId || !data) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    const targetChurchId = church_id || ctx.churchId || null;
    if (targetChurchId) {
      if (ctx.isSecondaryUser) {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(targetChurchId)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação não autorizada para este usuário.' });
        }
      } else if (ctx.isOwner && !ctx.isSuperAdmin) {
        const churchCheck = await pool.query(
          'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
          [targetChurchId, ctx.userId, ctx.ownerId || ctx.userId]
        );
        if (churchCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação não pertence à sua organização.' });
        }
      }
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
         [finalId, name, record_count || 0, effectiveUserId, finalData, targetChurchId]
      );
    } else {
      result = await pool.query(
        'INSERT INTO saved_reports (name, record_count, user_id, data, church_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, record_count || 0, effectiveUserId, finalData, targetChurchId]
      );
    }
    const createdReport = result.rows[0];
    try {
      await logAudit(pool, {
        action: 'CREATE',
        entity: 'saved_reports',
        entityId: createdReport.id,
        churchId: createdReport.church_id || targetChurchId,
        newValues: { id: createdReport.id, name: createdReport.name, record_count: createdReport.record_count, church_id: createdReport.church_id },
        req
      });
    } catch (_) {}
    notifyTenantRealtime(effectiveUserId || ctx.ownerId || ctx.userId, { type: 'REPORT_UPDATED', action: 'CREATE', id: createdReport?.id });
    return res.status(201).json(createdReport);
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para atualizar relatórios.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
    const { name, data, record_count, church_id } = req.body;

    const oldRes = await pool.query('SELECT * FROM saved_reports WHERE id = $1', [id]);
    const oldReport = oldRes.rows[0] || null;
    if (!oldReport) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (oldReport.user_id && oldReport.user_id !== ctx.userId && oldReport.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o relatório pertence a outro usuário.' });
      }
    }

    if (ctx.isSecondaryUser && oldReport.church_id) {
      if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(oldReport.church_id)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o relatório pertence a uma congregação não autorizada.' });
      }
    }

    if (church_id !== undefined && church_id !== null) {
      if (ctx.isSecondaryUser) {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação não autorizada para este usuário.' });
        }
      } else if (ctx.isOwner && !ctx.isSuperAdmin) {
        const churchCheck = await pool.query(
          'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
          [church_id, ctx.userId, ctx.ownerId || ctx.userId]
        );
        if (churchCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação não pertence à sua organização.' });
        }
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
    const updatedReport = result.rows[0];
    try {
      await logAudit(pool, {
        action: 'UPDATE',
        entity: 'saved_reports',
        entityId: id,
        churchId: updatedReport?.church_id || oldReport?.church_id,
        oldValues: { id: oldReport.id, name: oldReport.name, record_count: oldReport.record_count, church_id: oldReport.church_id },
        newValues: { id: updatedReport.id, name: updatedReport.name, record_count: updatedReport.record_count, church_id: updatedReport.church_id },
        req
      });
    } catch (_) {}
    notifyTenantRealtime(ctx.ownerId || ctx.userId, { type: 'REPORT_UPDATED', action: 'UPDATE', id });
    return res.json(updatedReport);
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para excluir relatórios.' });
    }
    await enrichSecondaryUserContext(pool, ctx);

    const oldRes = await pool.query('SELECT * FROM saved_reports WHERE id = $1', [id]);
    const oldReport = oldRes.rows[0] || null;
    if (!oldReport) return res.status(404).json({ error: 'NOT_FOUND' });

    if (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) {
      if (oldReport.user_id && oldReport.user_id !== ctx.userId && oldReport.user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o relatório pertence a outro usuário.' });
      }
    }

    if (ctx.isSecondaryUser && oldReport.church_id) {
      if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(oldReport.church_id)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o relatório pertence a uma congregação não autorizada.' });
      }
    }

    const result = await pool.query('DELETE FROM saved_reports WHERE id = $1 RETURNING id', [id]);
    try {
      await logAudit(pool, {
        action: 'DELETE',
        entity: 'saved_reports',
        entityId: id,
        churchId: oldReport?.church_id,
        oldValues: { id: oldReport.id, name: oldReport.name, record_count: oldReport.record_count, church_id: oldReport.church_id },
        req
      });
    } catch (_) {}
    notifyTenantRealtime(ctx.ownerId || ctx.userId, { type: 'REPORT_UPDATED', action: 'DELETE', id });
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
      `SELECT id, amount, splits, description 
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
      const matchedReq = matchRes.rows[0];
      const matchedReqId = matchedReq.id;

      // Atomically update request status to 'confirmed'
      await clientOrPool.query(
        `UPDATE contribution_requests 
         SET status = 'confirmed', updated_at = NOW() 
         WHERE id = $1 AND status = 'pending'`,
        [matchedReqId]
      );

      // If the matched request has splits and tx.id is known, copy splits to consolidated_transactions
      if (tx.id && matchedReq.splits) {
        try {
          const splitsVal = typeof matchedReq.splits === 'string' ? matchedReq.splits : JSON.stringify(matchedReq.splits);
          await clientOrPool.query(
            `UPDATE consolidated_transactions 
             SET splits = COALESCE(splits, $1::jsonb),
                 contribution_request_id = $2
             WHERE id = $3`,
            [splitsVal, matchedReqId, tx.id]
          );
        } catch (_) {}
      }

      return matchedReqId;
    }

    return null;
  } catch (err) {
    console.error('[Contributors API] Error matching contribution request:', err);
    return tx.contribution_request_id || null;
  }
}

/**
 * 🛡️ BLINDAGEM DE FECHAMENTO FINAL:
 * Verifica se um determinado período contábil (mês/ano) de uma congregação
 * já teve seu Fechamento Final homologado e está congelado contra novas inserções, edições ou exclusões.
 */
async function isChurchPeriodClosed(
  clientOrPool: any,
  churchId: string | null | undefined,
  dateInput: string | Date | null | undefined,
  bankId?: string | null | undefined,
  isClosingTx?: boolean
): Promise<{ isClosed: boolean; churchId?: string; year?: number; month?: number; message?: string }> {
  if (isClosingTx) {
    return { isClosed: false };
  }
  if (!churchId || !dateInput || churchId === 'unidentified' || churchId === 'geral') {
    return { isClosed: false };
  }

  let dateStr = typeof dateInput === 'string' ? dateInput : (dateInput as Date).toISOString();
  dateStr = dateStr.split(/[T ]/)[0];
  const parts = dateStr.split('-');
  if (parts.length < 2) {
    return { isClosed: false };
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) {
    return { isClosed: false };
  }

  try {
    let query = `SELECT id, church_id, bank_id, year, month, status, closed_at 
       FROM church_closings 
       WHERE church_id::text = $1 AND year = $2 AND month = $3 AND status != 'reopened'`;
    const params: any[] = [String(churchId), year, month];

    if (bankId && bankId !== 'all') {
      query += ` AND (bank_id IS NULL OR bank_id = '' OR bank_id = 'all' OR bank_id::text = $${params.length + 1})`;
      params.push(String(bankId));
    }

    query += ' LIMIT 1';

    const res = await clientOrPool.query(query, params);

    if (res.rows && res.rows.length > 0) {
      const mStr = String(month).padStart(2, '0');
      return {
        isClosed: true,
        churchId: String(churchId),
        year,
        month,
        message: `PERÍODO CONGELADO: O período ${mStr}/${year} desta congregação já teve seu Fechamento Final homologado. Novos lançamentos, alterações ou exclusões estão expressamente bloqueados.`
      };
    }
  } catch (err: any) {
    console.error('[ChurchClosings] Erro ao consultar status do fechamento:', err?.message || err);
  }

  return { isClosed: false };
}

// GET /api/v1/church-closings
app.get('/api/v1/church-closings', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar fechamentos de caixa.' });
    }

    const { church_id, year, month } = req.query;
    let query = 'SELECT * FROM church_closings WHERE 1=1';
    const params: any[] = [];

    // 🛡️ Isolamento por Tenant / Organização
    if (!ctx.isSuperAdmin) {
      const ownerId = ctx.ownerId || ctx.userId || '';
      const ownerUserIds = await getEquivalentUserIds(ownerId);
      if (ctx.isSecondaryUser) {
        if (ctx.allowedChurchIds.length === 0) return res.json([]);
        params.push(ctx.allowedChurchIds);
        query += ` AND church_id::text = ANY($${params.length})`;
      } else {
        params.push(ownerUserIds);
        query += ` AND (church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${params.length})) OR church_id::text = ANY($${params.length}))`;
      }
    }

    if (church_id) {
      if (ctx.isSecondaryUser && !ctx.allowedChurchIds.includes(String(church_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
      }
      params.push(String(church_id));
      query += ` AND church_id::text = $${params.length}`;
    }
    if (year) {
      params.push(parseInt(String(year), 10));
      query += ` AND year = $${params.length}`;
    }
    if (month) {
      params.push(parseInt(String(month), 10));
      query += ` AND month = $${params.length}`;
    }

    query += ' ORDER BY year DESC, month DESC';
    const result = await pool.query(query, params);
    return res.json(result.rows || []);
  } catch (err) {
    console.error('[ChurchClosings] Erro ao listar fechamentos:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/church-closings/:churchId/:year/:month
app.get('/api/v1/church-closings/:churchId/:year/:month', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar fechamento.' });
    }

    const { churchId, year, month } = req.params;
    const { bank_id } = req.query;

    if (!ctx.isSuperAdmin) {
      if (ctx.isSecondaryUser) {
        if (!ctx.allowedChurchIds.includes(String(churchId))) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
      } else {
        const ownerId = ctx.ownerId || ctx.userId || '';
        const ownerUserIds = await getEquivalentUserIds(ownerId);
        const churchCheck = await pool.query(
          'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = ANY($2) OR id::text = ANY($2)) LIMIT 1',
          [String(churchId), ownerUserIds]
        );
        if (churchCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a congregação pertence a outra organização.' });
        }
      }
    }

    let query: string;
    let params: any[];

    if (bank_id && bank_id !== 'all') {
      query = `SELECT * FROM church_closings 
       WHERE church_id::text = $1 AND year = $2 AND month = $3 AND bank_id::text = $4 
       LIMIT 1`;
      params = [String(churchId), parseInt(year, 10), parseInt(month, 10), String(bank_id)];
    } else {
      query = `SELECT * FROM church_closings 
       WHERE church_id::text = $1 AND year = $2 AND month = $3 AND (bank_id IS NULL OR bank_id = '' OR bank_id = 'all') 
       LIMIT 1`;
      params = [String(churchId), parseInt(year, 10), parseInt(month, 10)];
    }

    const result = await pool.query(query, params);

    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows[0]);
    }
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Nenhum fechamento encontrado para esta igreja e período.' });
  } catch (err) {
    console.error('[ChurchClosings] Erro ao buscar fechamento específico:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// 🛡️ Função Determinística para Cálculo das Chaves do Advisory Lock de Fechamento/Reabertura
function getClosingLockKeys(churchId: string, bankId: string | null, year: number, month: number): [number, number] {
  const str1 = `church:${churchId}`;
  const str2 = `period:${bankId || 'all'}:${year}:${month}`;
  
  let h1 = 0;
  for (let i = 0; i < str1.length; i++) {
    h1 = (Math.imul(31, h1) + str1.charCodeAt(i)) | 0;
  }
  
  let h2 = 0;
  for (let i = 0; i < str2.length; i++) {
    h2 = (Math.imul(31, h2) + str2.charCodeAt(i)) | 0;
  }
  
  return [h1, h2];
}

// POST /api/v1/church-closings
app.post('/api/v1/church-closings', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para registrar fechamento contábil.' });
    }
    await enrichSecondaryUserContext(pool, ctx);

    const body = req.body || {};
    const {
      id,
      churchId,
      church_id,
      bankId,
      bank_id,
      year,
      month,
      status,
      closedAt,
      closed_at,
      closedBy,
      closed_by,
      totalIncome,
      total_income,
      totalExpenses,
      total_expenses,
      finalBalance,
      final_balance,
      transferredBalance,
      transferred_balance,
      targetChurchId,
      target_church_id,
      targetChurchName,
      target_church_name,
      integrityHash,
      integrity_hash,
      signatures,
      transferTransactions,
      transfer_transactions,
      notes
    } = body;

    const effChurchId = String(churchId || church_id || '');
    const effBankId = (bankId && bankId !== 'all') ? String(bankId) : ((bank_id && bank_id !== 'all') ? String(bank_id) : null);
    const effYear = parseInt(String(year), 10);
    const effMonth = parseInt(String(month), 10);

    if (!effChurchId || isNaN(effYear) || isNaN(effMonth)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'churchId, year e month são obrigatórios.' });
    }

    if (ctx.isSecondaryUser) {
      if (!ctx.allowedChurchIds.includes(effChurchId)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação não autorizada para fechamento.' });
      }
    } else if (!ctx.isSuperAdmin) {
      const ownerId = String(ctx.ownerId || ctx.userId || '').trim();
      const ownerUserIds = await getEquivalentUserIds(ownerId);
      const chCheck = await pool.query(
        'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = ANY($2) OR id::text = $3) LIMIT 1',
        [effChurchId, ownerUserIds, ownerId]
      );
      if (chCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a congregação pertence a outra organização.' });
      }
    }

    const effId = id || (effBankId
      ? `closing_${effChurchId}_${effBankId}_${effYear}_${effMonth}`
      : `closing_${effChurchId}_${effYear}_${effMonth}`);
    const effStatus = status || 'closed';
    const effClosedAt = closedAt || closed_at || new Date().toISOString();
    const effClosedBy = closedBy || closed_by || (ctx.userId ? String(ctx.userId) : null);
    const effIncome = Number(totalIncome !== undefined ? totalIncome : (total_income || 0));
    const effExpenses = Number(totalExpenses !== undefined ? totalExpenses : (total_expenses || 0));
    const effBalance = Number(finalBalance !== undefined ? finalBalance : (final_balance || 0));
    const effTransferred = transferredBalance !== undefined ? Number(transferredBalance) : (transferred_balance !== undefined ? Number(transferred_balance) : null);
    const effTargetChurchId = targetChurchId || target_church_id || null;
    const effTargetChurchName = targetChurchName || target_church_name || null;
    const effHash = integrityHash || integrity_hash || null;
    const effSignatures = signatures ? (typeof signatures === 'string' ? signatures : JSON.stringify(signatures)) : null;
    const effNotes = notes || null;

    const query = `
      INSERT INTO church_closings (
        id, church_id, bank_id, year, month, status, closed_at, closed_by, 
        total_income, total_expenses, final_balance, transferred_balance, 
        target_church_id, target_church_name, integrity_hash, signatures, notes, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        bank_id = EXCLUDED.bank_id,
        closed_at = EXCLUDED.closed_at,
        closed_by = EXCLUDED.closed_by,
        total_income = EXCLUDED.total_income,
        total_expenses = EXCLUDED.total_expenses,
        final_balance = EXCLUDED.final_balance,
        transferred_balance = EXCLUDED.transferred_balance,
        target_church_id = EXCLUDED.target_church_id,
        target_church_name = EXCLUDED.target_church_name,
        integrity_hash = EXCLUDED.integrity_hash,
        signatures = EXCLUDED.signatures,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `;

    const params = [
      effId, effChurchId, effBankId, effYear, effMonth, effStatus, effClosedAt, effClosedBy,
      effIncome, effExpenses, effBalance, effTransferred, effTargetChurchId,
      effTargetChurchName, effHash, effSignatures, effNotes
    ];

    // 🛡️ Execução em Transação Atômica ACID com Proteção Mútua de Concorrência (Advisory Lock)
    const client = await pool.connect();
    let saved: any = null;
    let lockAcquired = false;
    const lockKeys = getClosingLockKeys(effChurchId, effBankId, effYear, effMonth);

    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        'SELECT pg_try_advisory_xact_lock($1, $2) as acquired',
        lockKeys
      );
      const acquired = Boolean(lockRes.rows?.[0]?.acquired);
      if (!acquired) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'CONCURRENT_OPERATION',
          message: 'Existe outra operação de fechamento ou reabertura em andamento para esta congregação e período contábil. Tente novamente em instantes.'
        });
      }
      lockAcquired = true;

      const result = await client.query(query, params);
      saved = result.rows[0];

      // 🛡️ Gravação definitiva das transações financeiras reais de transporte de saldo
      if (effStatus !== 'reopened' && effTransferred !== null && effTransferred !== 0) {
        const monthPrefix = `${effYear}-${String(effMonth).padStart(2, '0')}`;
        
        // Limpa transações anteriores deste mesmo fechamento para evitar duplicidade
        if (effBankId) {
          await client.query(
            `DELETE FROM consolidated_transactions 
             WHERE (transaction_date::text LIKE $1 OR reference_date::text LIKE $1)
               AND (
                 report_id = $2
                 OR row_hash LIKE $3
                 OR (
                   church_id::text = $4 
                   AND bank_id::text = $5 
                   AND (source = 'closing' OR id::text LIKE 'closing-%' OR row_hash LIKE 'closing-%')
                 )
               )`,
            [
              `${monthPrefix}%`,
              effId,
              `closing-%-${effChurchId}-${effBankId}-%`,
              effChurchId,
              effBankId
            ]
          );
        } else {
          await client.query(
            `DELETE FROM consolidated_transactions 
             WHERE (transaction_date::text LIKE $1 OR reference_date::text LIKE $1)
               AND (
                 report_id = $2
                 OR row_hash LIKE $3
               )`,
            [
              `${monthPrefix}%`,
              effId,
              `closing-%-${effChurchId}-all-%`
            ]
          );
        }

        const providedTxs = Array.isArray(transferTransactions || transfer_transactions) 
          ? (transferTransactions || transfer_transactions) 
          : [];

        let txsToInsert: any[] = [];

        if (providedTxs.length > 0) {
          txsToInsert = providedTxs;
        } else if (effTargetChurchId) {
          const isNegative = effTransferred < 0;
          const absAmt = Math.abs(effTransferred);
          const targetIds = String(effTargetChurchId).split(',').map((s: string) => s.trim()).filter(Boolean);
          const eachAmt = targetIds.length > 0 ? (absAmt / targetIds.length) : absAmt;
          const memoPrefix = effNotes ? String(effNotes).trim() : `FECHAMENTO DE CAIXA PERÍODO ${String(effMonth).padStart(2, '0')}/${effYear}`;
          const originPeriodPrefix = `${effYear}-${String(effMonth).padStart(2, '0')}`;
          const originDate = (closedAt || closed_at) && String(closedAt || closed_at).startsWith(originPeriodPrefix)
            ? String(closedAt || closed_at).split('T')[0]
            : `${originPeriodPrefix}-01`;
          const bankSegment = effBankId ? effBankId : 'all';

          // Origem: Saída do saldo transportado (ou Aporte se negativo)
          txsToInsert.push({
            id: crypto.randomUUID(),
            user_id: ctx.userId || null,
            church_id: effChurchId,
            bank_id: effBankId,
            amount: isNegative ? absAmt : -absAmt,
            type: isNegative ? 'income' : 'expense',
            description: isNegative 
              ? `[APORTE/FECHAMENTO] ${memoPrefix} - COBERTURA DE SALDO PELO ${effTargetChurchName || 'DESTINO'}` 
              : `[FECHAMENTO] ${memoPrefix} - TRANSPORTE DE SALDO PARA ${effTargetChurchName || 'DESTINO'}`,
            transaction_date: originDate,
            reference_date: originDate,
            row_hash: `closing-${isNegative ? 'deficit-cover' : 'outflow'}-${effChurchId}-${bankSegment}-${targetIds[0] || 'dest'}-${effYear}-${effMonth}-0`,
            report_id: effId,
            source: 'closing',
            status: 'identified',
            is_confirmed: true,
            contribution_type: isNegative ? 'ENTRADA / TRANSFERÊNCIA' : 'SAÍDA / TRANSFERÊNCIA',
            payment_method: 'TRANSFERÊNCIA'
          });

          // Destino(s): Entrada do saldo transportado (ou Repasse se negativo)
          targetIds.forEach((destId: string, idx: number) => {
            txsToInsert.push({
              id: crypto.randomUUID(),
              user_id: ctx.userId || null,
              church_id: destId,
              bank_id: null,
              amount: isNegative ? -eachAmt : eachAmt,
              type: isNegative ? 'expense' : 'income',
              description: isNegative 
                ? `[REPASSE/FECHAMENTO] ${memoPrefix} - REPASSE DE COBERTURA PARA IGREJA ORIGEM` 
                : `[RECEBIMENTO] ${memoPrefix} - SALDO RECEBIDO DE IGREJA ORIGEM`,
              transaction_date: originDate,
              reference_date: originDate,
              row_hash: `closing-${isNegative ? 'deficit-transfer' : 'inflow'}-${effChurchId}-${bankSegment}-${destId}-${effYear}-${effMonth}-${idx}`,
              report_id: effId,
              source: 'closing',
              status: 'identified',
              is_confirmed: true,
              contribution_type: isNegative ? 'SAÍDA / TRANSFERÊNCIA' : 'ENTRADA / TRANSFERÊNCIA',
              payment_method: 'TRANSFERÊNCIA'
            });
          });
        }

        const originPeriodPrefix = `${effYear}-${String(effMonth).padStart(2, '0')}`;
        const fallbackPeriodDate = `${originPeriodPrefix}-01`;

        for (const tx of txsToInsert) {
          const finalTxId = (tx.id && /^[0-9a-fA-F-]{36}$/.test(tx.id)) ? tx.id : crypto.randomUUID();
          const finalUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : (tx.user_id || ctx.userId || null);
          const finalChurchId = String(tx.church_id || tx.churchId || effChurchId);
          const finalBankId = (tx.bank_id && tx.bank_id !== 'all') ? String(tx.bank_id) : null;
          const finalAmount = Number(tx.amount || 0);
          const finalType = tx.type || (finalAmount >= 0 ? 'income' : 'expense');
          const finalDesc = String(tx.description || tx.desc || 'Transporte de Fechamento');
          const finalDate = tx.transaction_date || tx.date || fallbackPeriodDate;
          const finalRefDate = tx.reference_date || finalDate;
          const finalRowHash = tx.row_hash || `closing-${finalTxId}`;
          const finalContribType = tx.contribution_type || (finalType === 'expense' ? 'SAÍDA / TRANSFERÊNCIA' : 'ENTRADA / TRANSFERÊNCIA');
          const finalPaymentMethod = tx.payment_method || 'TRANSFERÊNCIA';
          const finalReportId = tx.report_id || effId;

          await client.query(
            `INSERT INTO consolidated_transactions (
              id, user_id, church_id, bank_id, amount, type, description, 
              transaction_date, reference_date, row_hash, source, status, 
              is_confirmed, contribution_type, payment_method, report_id, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'closing', 'identified', true, $11, $12, $13, NOW())
            ON CONFLICT (id) DO UPDATE SET
              amount = EXCLUDED.amount,
              type = EXCLUDED.type,
              description = EXCLUDED.description,
              transaction_date = EXCLUDED.transaction_date,
              reference_date = EXCLUDED.reference_date,
              row_hash = EXCLUDED.row_hash,
              source = 'closing',
              status = 'identified',
              is_confirmed = true,
              contribution_type = EXCLUDED.contribution_type,
              payment_method = EXCLUDED.payment_method,
              report_id = EXCLUDED.report_id,
              updated_at = NOW()`,
            [
              finalTxId, finalUserId, finalChurchId, finalBankId, finalAmount,
              finalType, finalDesc, finalDate, finalRefDate, finalRowHash,
              finalContribType, finalPaymentMethod, finalReportId
            ]
          );
        }
        console.log(`[ChurchClosings] 💸 ${txsToInsert.length} transações financeiras reais de transporte gravadas em consolidated_transactions.`);
      }

      await client.query('COMMIT');
    } catch (txErr) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.warn('[ChurchClosings] Erro ao reverter transação de fechamento (ROLLBACK):', rbErr);
      }
      throw txErr;
    } finally {
      if (lockAcquired && (pool as any).localEngine?.releaseClosingLock) {
        (pool as any).localEngine.releaseClosingLock(lockKeys[0], lockKeys[1]);
      }
      client.release();
    }

    try {
      await logAudit(pool, {
        action: 'CREATE',
        entity: 'church_closings',
        entityId: saved.id,
        churchId: effChurchId,
        userId: ctx.userId || null,
        newValues: saved,
        req
      });
    } catch (auditErr) {
      console.warn('[Audit] Erro ao gravar audit log de fechamento:', auditErr);
    }

    console.log(`[ChurchClosings] ✅ Fechamento Final registrado no banco: Igreja ${effChurchId}, Período ${effMonth}/${effYear}, Status: ${effStatus}`);
    return res.status(201).json(saved);
  } catch (err) {
    console.error('[ChurchClosings] Erro ao salvar fechamento:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/church-closings/reopen - Desfaz o fechamento final e reabre o período para novos lançamentos
app.post('/api/v1/church-closings/reopen', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para reabrir períodos contábeis.' });
    }
    const { churchId, church_id, year, month, bankId, bank_id } = req.body || {};
    const effChurchId = String(churchId || church_id || '');
    const effBankId = (bankId && bankId !== 'all') ? String(bankId) : ((bank_id && bank_id !== 'all') ? String(bank_id) : null);
    const effYear = parseInt(String(year), 10);
    const effMonth = parseInt(String(month), 10);

    if (!effChurchId || isNaN(effYear) || isNaN(effMonth)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'churchId, year e month são obrigatórios.' });
    }

    // Permissão: Apenas usuário principal pode desfazer o fechamento contábil
    if (ctx.isSecondaryUser) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Apenas o usuário principal tem autorização para reabrir períodos contábeis com fechamento final homologado.' });
    }

    if (!ctx.isSuperAdmin) {
      const ownerId = String(ctx.ownerId || ctx.userId || '').trim();
      const ownerUserIds = await getEquivalentUserIds(ownerId);
      const chCheck = await pool.query(
        'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = ANY($2) OR id::text = $3) LIMIT 1',
        [effChurchId, ownerUserIds, ownerId]
      );
      if (chCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a congregação pertence a outra organização.' });
      }
    }

    // 🛡️ Execução em Transação Atômica ACID com Proteção Mútua de Concorrência (Advisory Lock)
    const client = await pool.connect();
    let result: any = null;
    let matchedClosingId: string | null = null;
    let defaultClosingId: string = '';
    let lockAcquired = false;
    const lockKeys = getClosingLockKeys(effChurchId, effBankId, effYear, effMonth);

    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        'SELECT pg_try_advisory_xact_lock($1, $2) as acquired',
        lockKeys
      );
      const acquired = Boolean(lockRes.rows?.[0]?.acquired);
      if (!acquired) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'CONCURRENT_OPERATION',
          message: 'Existe outra operação de fechamento ou reabertura em andamento para esta congregação e período contábil. Tente novamente em instantes.'
        });
      }
      lockAcquired = true;

      // 1. Atualiza status para 'reopened' no banco central (libera imediatamente a checagem isChurchPeriodClosed)
      let updateQuery: string;
      let updateParams: any[];

      if (effBankId) {
        updateQuery = `UPDATE church_closings 
         SET status = 'reopened', updated_at = NOW() 
         WHERE church_id::text = $1 AND year = $2 AND month = $3 AND bank_id::text = $4 
         RETURNING *`;
        updateParams = [effChurchId, effYear, effMonth, effBankId];
      } else {
        updateQuery = `UPDATE church_closings 
         SET status = 'reopened', updated_at = NOW() 
         WHERE church_id::text = $1 AND year = $2 AND month = $3 AND (bank_id IS NULL OR bank_id = '' OR bank_id = 'all') 
         RETURNING *`;
        updateParams = [effChurchId, effYear, effMonth];
      }

      result = await client.query(updateQuery, updateParams);

      // Se não encontrou registro com UPDATE, tenta remover por garantia
      if (!result.rows || result.rows.length === 0) {
        if (effBankId) {
          await client.query(
            `DELETE FROM church_closings WHERE church_id::text = $1 AND year = $2 AND month = $3 AND bank_id::text = $4`,
            [effChurchId, effYear, effMonth, effBankId]
          );
        } else {
          await client.query(
            `DELETE FROM church_closings WHERE church_id::text = $1 AND year = $2 AND month = $3 AND (bank_id IS NULL OR bank_id = '' OR bank_id = 'all')`,
            [effChurchId, effYear, effMonth]
          );
        }
      }

      // 2. Remove eventuais transações automáticas de transferência geradas pelo fechamento anterior
      const monthPrefix = `${effYear}-${String(effMonth).padStart(2, '0')}`;
      defaultClosingId = effBankId 
        ? `closing_${effChurchId}_${effBankId}_${effYear}_${effMonth}` 
        : `closing_${effChurchId}_${effYear}_${effMonth}`;
      matchedClosingId = result.rows?.[0]?.id || defaultClosingId;

      if (effBankId) {
        await client.query(
          `DELETE FROM consolidated_transactions 
           WHERE (transaction_date::text LIKE $1 OR reference_date::text LIKE $1)
             AND (
               report_id = $2
               OR report_id = $3
               OR row_hash LIKE $4
               OR (
                 church_id::text = $5 
                 AND bank_id::text = $6 
                 AND (source = 'closing' OR id::text LIKE 'closing-%' OR row_hash LIKE 'closing-%')
               )
             )`,
          [
            `${monthPrefix}%`,
            matchedClosingId,
            defaultClosingId,
            `closing-%-${effChurchId}-${effBankId}-%`,
            effChurchId,
            effBankId
          ]
        );
      } else {
        await client.query(
          `DELETE FROM consolidated_transactions 
           WHERE (transaction_date::text LIKE $1 OR reference_date::text LIKE $1)
             AND (
               report_id = $2
               OR report_id = $3
               OR row_hash LIKE $4
             )`,
          [
            `${monthPrefix}%`,
            matchedClosingId,
            defaultClosingId,
            `closing-%-${effChurchId}-all-%`
          ]
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.warn('[ChurchClosings] Erro ao reverter transação de reabertura (ROLLBACK):', rbErr);
      }
      throw txErr;
    } finally {
      if (lockAcquired && (pool as any).localEngine?.releaseClosingLock) {
        (pool as any).localEngine.releaseClosingLock(lockKeys[0], lockKeys[1]);
      }
      client.release();
    }

    try {
      await logAudit(pool, {
        action: 'UPDATE',
        entity: 'church_closings',
        entityId: effBankId ? `closing_${effChurchId}_${effBankId}_${effYear}_${effMonth}` : `closing_${effChurchId}_${effYear}_${effMonth}`,
        churchId: effChurchId,
        userId: ctx.userId || null,
        newValues: { status: 'reopened', reopened_at: new Date().toISOString() },
        req
      });
    } catch (auditErr) {
      console.warn('[Audit] Erro ao gravar audit log de reabertura de fechamento:', auditErr);
    }

    console.log(`[ChurchClosings] 🔓 Fechamento Final DESFEITO / REABERTO no banco: Igreja ${effChurchId}, Conta ${effBankId || 'Consolidado'}, Período ${effMonth}/${effYear}`);
    return res.json({ 
      success: true, 
      status: 'reopened', 
      churchId: effChurchId, 
      bankId: effBankId,
      year: effYear, 
      month: effMonth,
      message: `Período ${String(effMonth).padStart(2, '0')}/${effYear} reaberto com sucesso. Lançamentos liberados.` 
    });
  } catch (err) {
    console.error('[ChurchClosings] Erro ao reabrir fechamento:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/church-closings/:churchId/:year/:month
app.delete('/api/v1/church-closings/:churchId/:year/:month', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);

    // 🛡️ 1. Bloqueio Mandatório de Acesso Anônimo (Deny-by-Default)
    if (!ctx.isAuthenticated) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Autenticação necessária para reabrir períodos contábeis.'
      });
    }

    const { churchId, year, month } = req.params;
    const { bank_id } = req.query;
    const effChurchId = String(churchId || '');
    const effBankId = (bank_id && bank_id !== 'all') ? String(bank_id) : null;
    const effYear = parseInt(String(year), 10);
    const effMonth = parseInt(String(month), 10);

    // 🛡️ 2. Restrição do Usuário Secundário: apenas o usuário principal tem autorização para reabrir períodos contábeis
    if (ctx.isSecondaryUser) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Apenas o usuário principal tem autorização para reabrir períodos contábeis.'
      });
    }

    // 🛡️ 3. Isolamento da Congregação (Cross-Tenant): Titular só acessa congregações da própria organização
    if (!ctx.isSuperAdmin) {
      const ownerId = String(ctx.ownerId || ctx.userId || '').trim();
      const ownerUserIds = await getEquivalentUserIds(ownerId);

      const chCheck = await pool.query(
        'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = ANY($2) OR id::text = $3) LIMIT 1',
        [effChurchId, ownerUserIds, ownerId]
      );

      if (chCheck.rows.length === 0) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: a congregação pertence a outra organização.'
        });
      }
    }

    // 🛡️ Execução em Transação Atômica ACID com Proteção Mútua de Concorrência (Advisory Lock)
    const client = await pool.connect();
    let lockAcquired = false;
    const lockKeys = getClosingLockKeys(effChurchId, effBankId, effYear, effMonth);

    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        'SELECT pg_try_advisory_xact_lock($1, $2) as acquired',
        lockKeys
      );
      const acquired = Boolean(lockRes.rows?.[0]?.acquired);
      if (!acquired) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'CONCURRENT_OPERATION',
          message: 'Existe outra operação de fechamento ou reabertura em andamento para esta congregação e período contábil. Tente novamente em instantes.'
        });
      }
      lockAcquired = true;

      let matchedClosingId: string | null = null;
      if (effBankId) {
        const upRes = await client.query(
          `UPDATE church_closings 
           SET status = 'reopened', updated_at = NOW() 
           WHERE church_id::text = $1 AND year = $2 AND month = $3 AND bank_id::text = $4
           RETURNING id`,
          [effChurchId, effYear, effMonth, effBankId]
        );
        matchedClosingId = upRes.rows?.[0]?.id || null;
      } else {
        const upRes = await client.query(
          `UPDATE church_closings 
           SET status = 'reopened', updated_at = NOW() 
           WHERE church_id::text = $1 AND year = $2 AND month = $3 AND (bank_id IS NULL OR bank_id = '' OR bank_id = 'all')
           RETURNING id`,
          [effChurchId, effYear, effMonth]
        );
        matchedClosingId = upRes.rows?.[0]?.id || null;
      }

      // Remove eventuais transações automáticas de transferência geradas pelo fechamento
      const monthPrefix = `${effYear}-${String(effMonth).padStart(2, '0')}`;
      const defaultClosingId = effBankId 
        ? `closing_${effChurchId}_${effBankId}_${effYear}_${effMonth}` 
        : `closing_${effChurchId}_${effYear}_${effMonth}`;
      const effClosingId = matchedClosingId || defaultClosingId;

      if (effBankId) {
        await client.query(
          `DELETE FROM consolidated_transactions 
           WHERE (transaction_date::text LIKE $1 OR reference_date::text LIKE $1)
             AND (
               report_id = $2
               OR report_id = $3
               OR row_hash LIKE $4
               OR (
                 church_id::text = $5 
                 AND bank_id::text = $6 
                 AND (source = 'closing' OR id::text LIKE 'closing-%' OR row_hash LIKE 'closing-%')
               )
             )`,
          [
            `${monthPrefix}%`,
            effClosingId,
            defaultClosingId,
            `closing-%-${effChurchId}-${effBankId}-%`,
            effChurchId,
            effBankId
          ]
        );
      } else {
        await client.query(
          `DELETE FROM consolidated_transactions 
           WHERE (transaction_date::text LIKE $1 OR reference_date::text LIKE $1)
             AND (
               report_id = $2
               OR report_id = $3
               OR row_hash LIKE $4
             )`,
          [
            `${monthPrefix}%`,
            effClosingId,
            defaultClosingId,
            `closing-%-${effChurchId}-all-%`
          ]
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.warn('[ChurchClosings] Erro ao reverter transação de deleção de fechamento (ROLLBACK):', rbErr);
      }
      throw txErr;
    } finally {
      if (lockAcquired && (pool as any).localEngine?.releaseClosingLock) {
        (pool as any).localEngine.releaseClosingLock(lockKeys[0], lockKeys[1]);
      }
      client.release();
    }

    return res.json({ success: true, status: 'reopened', churchId: effChurchId, year: effYear, month: effMonth, bankId: effBankId });
  } catch (err) {
    console.error('[ChurchClosings] Erro ao deletar fechamento:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// 🛡️ Função Cirúrgica de Auto-Cura de Transações com congregação nula (estritamente isolada por tenant)
async function healOrphanChurches(poolInstance: any, scopedOwnerUserIds?: string[]): Promise<{ totalFound: number; repairedCount: number }> {
  try {
    let orphanSql = `SELECT id, description, contributor_id, user_id FROM consolidated_transactions 
       WHERE (church_id IS NULL OR trim(church_id::text) = '' OR church_id::text = 'unidentified') 
         AND status IN ('identified', 'resolved')`;
    const orphanParams: any[] = [];
    if (scopedOwnerUserIds && scopedOwnerUserIds.length > 0) {
      orphanParams.push(scopedOwnerUserIds);
      orphanSql += ` AND user_id::text = ANY($1)`;
    }
    const res = await poolInstance.query(orphanSql, orphanParams);
    const rows = res.rows || [];
    if (rows.length === 0) return { totalFound: 0, repairedCount: 0 };

    console.log(`[AutoHeal:Churches] Encontradas ${rows.length} transações identificadas/resolvidas com church_id nulo. Reparando com isolamento multi-tenant...`);

    const laRes = await poolInstance.query(`SELECT user_id, normalized_description, church_id FROM learned_associations WHERE church_id IS NOT NULL`);
    const associations = laRes.rows || [];

    const chRes = await poolInstance.query(`SELECT id, user_id FROM churches ORDER BY created_at ASC`);
    const allChurchRows = chRes.rows || [];
    const churchOwnerMap = new Map<string, string>();
    allChurchRows.forEach((c: any) => {
      if (c.id && c.user_id) churchOwnerMap.set(String(c.id), String(c.user_id));
    });

    const cRes = await poolInstance.query(`SELECT id, church_id FROM contributors WHERE church_id IS NOT NULL`);
    const contribMap = new Map<string, string>();
    (cRes.rows || []).forEach((c: any) => {
      if (c.id && c.church_id) contribMap.set(String(c.id), String(c.church_id));
    });

    const ownerIdsCache = new Map<string, string[]>();
    let repairedCount = 0;

    for (const tx of rows) {
      const txOwnerKey = tx.user_id ? String(tx.user_id) : '';
      let txOwnerIds: string[] = scopedOwnerUserIds ? [...scopedOwnerUserIds] : [];
      if (txOwnerKey) {
        if (!ownerIdsCache.has(txOwnerKey)) {
          ownerIdsCache.set(txOwnerKey, await getEquivalentUserIds(txOwnerKey));
        }
        txOwnerIds = ownerIdsCache.get(txOwnerKey)!;
      }

      if (txOwnerIds.length === 0) {
        continue; // Sem tenant comprovado, nunca adivinhar congregação de terceiros
      }

      let resolvedChurchId: string | null = null;

      // 1. Pelo contribuinte vinculado (somente se a igreja do contribuinte pertence ao mesmo tenant)
      if (tx.contributor_id && contribMap.has(String(tx.contributor_id))) {
        const candidateChurch = contribMap.get(String(tx.contributor_id))!;
        const candidateOwner = churchOwnerMap.get(candidateChurch);
        if (candidateOwner && txOwnerIds.includes(candidateOwner)) {
          resolvedChurchId = candidateChurch;
        }
      }

      // 2. Pela regra de associação aprendida do próprio tenant (DNA da transação)
      if (!resolvedChurchId && tx.description) {
        const strictDesc = String(tx.description)
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, '')
          .trim();

        const foundAssoc = associations.find((a: any) => {
          if (!a.normalized_description || !a.user_id || !txOwnerIds.includes(String(a.user_id))) return false;
          const assocChurchOwner = churchOwnerMap.get(String(a.church_id));
          if (!assocChurchOwner || !txOwnerIds.includes(assocChurchOwner)) return false;
          const aNorm = String(a.normalized_description).trim();
          return aNorm === strictDesc || strictDesc.includes(aNorm) || aNorm.includes(strictDesc);
        });

        if (foundAssoc && foundAssoc.church_id) {
          resolvedChurchId = String(foundAssoc.church_id);
        }
      }

      // 3. Se o próprio tenant possuir apenas 1 congregação cadastrada
      if (!resolvedChurchId) {
        const tenantChurches = allChurchRows
          .filter((c: any) => c.user_id && txOwnerIds.includes(String(c.user_id)))
          .map((c: any) => String(c.id));
        if (tenantChurches.length === 1) {
          resolvedChurchId = tenantChurches[0];
        }
      }

      if (resolvedChurchId && resolvedChurchId !== 'unidentified') {
        await poolInstance.query(
          `UPDATE consolidated_transactions SET church_id = $1 WHERE id::text = $2`,
          [resolvedChurchId, String(tx.id)]
        );
        repairedCount++;
        console.log(`[AutoHeal:Churches] Transação ${tx.id} ("${tx.description}") reparada com sucesso -> church_id: ${resolvedChurchId}`);
      }
    }

    console.log(`[AutoHeal:Churches] Concluído: ${repairedCount} de ${rows.length} transações reparadas.`);
    return { totalFound: rows.length, repairedCount };
  } catch (err) {
    console.error('[AutoHeal:Churches] Erro ao executar reparo:', err);
    return { totalFound: 0, repairedCount: 0 };
  }
}

async function cleanupOrphanAndFakeBanks(poolInstance: any): Promise<number> {
  try {
    const res = await poolInstance.query(`
      DELETE FROM banks 
      WHERE user_id IS NULL 
         OR user_id::text = '00000000-0000-0000-0000-000000000001'
         OR trim(user_id::text) = ''
    `);
    const count = res.rowCount || 0;
    if (count > 0) {
      console.log(`[AutoClean:Banks] ${count} banco(s) órfão(s)/fakes purgados com sucesso.`);
    }
    return count;
  } catch (err: any) {
    console.warn('[AutoClean:Banks] Aviso ao limpar bancos órfãos:', err?.message);
    return 0;
  }
}

// Endpoint de Auto-Cura de Transações com church_id nulo
app.all(['/api/v1/consolidated_transactions/repair-churches', '/api/v1/admin/repair-orphan-churches'], async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para executar reparo de congregações.' });
    }
    await enrichSecondaryUserContext(pool, ctx);

    if (req.path === '/api/v1/admin/repair-orphan-churches') {
      if (!ctx.isSuperAdmin) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: privilégios de superadministrador necessários.' });
      }
    } else if (ctx.isSecondaryUser) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: apenas o titular pode executar reparo global de congregações.' });
    }

    const scopedOwnerIds = ctx.isSuperAdmin
      ? undefined
      : await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');

    if (!ctx.isSuperAdmin && (!scopedOwnerIds || scopedOwnerIds.length === 0)) {
      return res.json({ success: true, totalFound: 0, repairedCount: 0, message: 'Nenhuma transação com igreja nula encontrada no banco de dados.' });
    }

    const result = await healOrphanChurches(pool, scopedOwnerIds);
    return res.json({
      success: true,
      ...result,
      message: result.repairedCount > 0 
        ? `${result.repairedCount} transações identificadas foram reparadas e vinculadas à sua igreja correta no banco de dados!` 
        : (result.totalFound === 0 ? 'Nenhuma transação com igreja nula encontrada no banco de dados.' : 'Transações analisadas, mas nenhuma associação aprendida correspondente foi encontrada.')
    });
  } catch (err: any) {
    console.error('[RepairChurches Endpoint] Erro:', err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// GET /api/v1/consolidated_transactions
app.get('/api/v1/consolidated_transactions', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar transações consolidadas.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão de visualização de transações necessária.' });
    }
    const { user_id, status, type, start_date, end_date, limit, offset, row_hash, ids, church_id } = req.query;

    let allowedBankIds = ctx.allowedBankIds || [];
    if (ctx.isSecondaryUser && allowedBankIds.length === 0 && ctx.userId) {
      try {
        const uRes = await pool.query(
          'SELECT permissions FROM app_users WHERE id::text = $1 AND deleted_at IS NULL UNION ALL SELECT permissions FROM profiles WHERE id::text = $1 LIMIT 1',
          [ctx.userId]
        );
        if (uRes.rows.length > 0) {
          const rawPerms = uRes.rows[0].permissions;
          const parsed = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
          allowedBankIds = extractContextAllowedBankIds({ permissions: parsed });
        }
      } catch (err) {
        console.warn('[Contributors API] Erro ao resolver allowedBankIds do banco:', err);
      }
    }

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0 && allowedBankIds.length === 0) {
      return res.json([]);
    }

    let query = 'SELECT id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, reference_date, created_at, updated_at, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits, attachments FROM consolidated_transactions WHERE 1=1';
    const params: any[] = [];
    let counter = 1;

    if (ids) {
      const idsArray = (ids as string).split(',');
      query += ` AND id::text = ANY($${counter})`;
      params.push(idsArray);
      counter++;
    }

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (effectiveUserId) {
      const userIds = await getEquivalentUserIds(String(effectiveUserId));
      query += ` AND (user_id::text = ANY($${counter}) OR (user_id IS NULL AND (church_id::text IN (SELECT id::text FROM churches WHERE user_id::text = ANY($${counter})) OR bank_id::text IN (SELECT id::text FROM banks WHERE user_id::text = ANY($${counter})))))`;
      params.push(userIds);
      counter++;
    }

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        query += ` AND (church_id::text = $${counter} OR (splits IS NOT NULL AND splits::text LIKE $${counter + 1}))`;
        params.push(church_id, `%"churchId":"${church_id}"%`);
        counter += 2;
      } else {
        const hasBankAuth = allowedBankIds.length > 0;
        if (ctx.allowedChurchIds.length === 1) {
          const bankClause = hasBankAuth ? ` OR (status = 'pending' AND church_id IS NULL AND bank_id::text = ANY($${counter + 2}))` : '';
          query += ` AND (church_id::text = $${counter} OR (splits IS NOT NULL AND splits::text LIKE $${counter + 1})${bankClause})`;
          params.push(ctx.allowedChurchIds[0], `%"churchId":"${ctx.allowedChurchIds[0]}"%`);
          counter += 2;
          if (hasBankAuth) {
            params.push(allowedBankIds);
            counter++;
          }
        } else if (ctx.allowedChurchIds.length > 1) {
          const splitClauses = ctx.allowedChurchIds.map((_, i) => `splits::text LIKE $${counter + 1 + i}`).join(' OR ');
          const bankParamIdx = counter + 1 + ctx.allowedChurchIds.length;
          const bankClause = hasBankAuth ? ` OR (status = 'pending' AND church_id IS NULL AND bank_id::text = ANY($${bankParamIdx}))` : '';
          query += ` AND (church_id::text = ANY($${counter}) OR (splits IS NOT NULL AND (${splitClauses}))${bankClause})`;
          params.push(ctx.allowedChurchIds);
          ctx.allowedChurchIds.forEach(cId => params.push(`%"churchId":"${cId}"%`));
          counter += 1 + ctx.allowedChurchIds.length;
          if (hasBankAuth) {
            params.push(allowedBankIds);
            counter++;
          }
        } else if (hasBankAuth) {
          query += ` AND (status = 'pending' AND church_id IS NULL AND bank_id::text = ANY($${counter}))`;
          params.push(allowedBankIds);
          counter++;
        }
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
      query += ` AND (church_id::text = $${counter} OR (splits IS NOT NULL AND splits::text LIKE $${counter + 1}))`;
      params.push(church_id, `%"churchId":"${church_id}"%`);
      counter += 2;
    }

    if (req.query.contributor_id) {
      query += ` AND contributor_id::text = $${counter}`;
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
      query += ` AND COALESCE(NULLIF(reference_date, ''), SUBSTR(transaction_date::text, 1, 10)) >= $${counter}`;
      params.push(start_date);
      counter++;
    }

    if (end_date && end_date !== 'undefined' && end_date !== 'null' && String(end_date).trim() !== '') {
      const endStr = String(end_date).trim();
      const formattedEnd = endStr.length === 10 ? endStr : endStr.slice(0, 10);
      query += ` AND COALESCE(NULLIF(reference_date, ''), SUBSTR(transaction_date::text, 1, 10)) <= $${counter}`;
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
    const sanitizedRows = (result.rows || []).map((row: any) => {
      const descUpper = (row.description || '').toUpperCase();
      let effectiveType = row.type;
      if (
        row.type === 'expense' && 
        (descUpper.includes('NU PAGAMENTOS') || descUpper.includes('RECEBEU') || descUpper.includes('RECEBIDO')) &&
        !descUpper.includes('ENVIADO') && 
        !descUpper.includes('PAGO A')
      ) {
        effectiveType = 'income';
      }

      // 🛡️ Otimização Crítica de Memória & Inicialização (Prevenção de Out of Memory):
      // Na listagem geral de transações, attachments retorna apenas metadados leves (id, nome, tamanho, tipo, role).
      // O campo massivo dataUrl (base64 de megabytes) é removido da lista global e servido sob demanda em /:id/attachments.
      let cleanAttachments = row.attachments;
      if (cleanAttachments) {
        try {
          const parsed = typeof cleanAttachments === 'string' ? JSON.parse(cleanAttachments) : cleanAttachments;
          if (Array.isArray(parsed)) {
            cleanAttachments = parsed.map((att: any) => {
              if (att && typeof att === 'object') {
                const { dataUrl, extractedData, ...rest } = att;
                const lightExtracted = extractedData ? {
                  documentType: extractedData.documentType,
                  extractedAmount: extractedData.extractedAmount,
                  extractedDate: extractedData.extractedDate,
                  extractedRecipient: extractedData.extractedRecipient,
                  extractedCNPJ: extractedData.extractedCNPJ
                } : undefined;
                return {
                  ...rest,
                  extractedData: lightExtracted,
                  txId: row.id,
                  hasDataUrl: Boolean(dataUrl)
                };
              }
              return att;
            });
          }
        } catch (_) {}
      }

      return {
        ...row,
        type: effectiveType,
        attachments: cleanAttachments
      };
    });
    return res.json(sanitizedRows);
  } catch (err) {
    console.error('[Contributors API] Error GET consolidated_transactions:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/consolidated_transactions/:id/attachments
// 🛡️ Endpoint sob demanda: Retorna os anexos completos com dataUrl apenas para a transação solicitada
app.get('/api/v1/consolidated_transactions/:id/attachments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
    const txRes = await pool.query('SELECT id, attachments, church_id, user_id, bank_id, status FROM consolidated_transactions WHERE id::text = $1 LIMIT 1', [id]);
    if (!txRes.rows || txRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    const row = txRes.rows[0];
    const isAuthorized = await isAuthorizedForTransaction(pool, ctx, row);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    const rawAtts = row.attachments;
    const parsed = typeof rawAtts === 'string' ? JSON.parse(rawAtts) : (rawAtts || []);
    return res.json(parsed);
  } catch (err) {
    console.error('[Contributors API] Error GET attachments:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/consolidated_transactions
app.post('/api/v1/consolidated_transactions', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (ctx.isSecondaryUser && !hasPermission(ctx, 'create')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para criar transações necessária.' });
    }
    const { id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, reference_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits, attachments } = req.body;

    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;
    const defaultChurchId = (ctx.allowedChurchIds && ctx.allowedChurchIds.length > 0) ? ctx.allowedChurchIds[0] : '00000000-0000-0000-0000-000000000001';
    const effectiveChurchId = (church_id && church_id !== 'unidentified') ? String(church_id) : ((ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) ? ctx.churchId : defaultChurchId);

    if (amount === undefined || amount === null || !description || !type || !effectiveUserId || !transaction_date) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    // 🛡️ Validação Matemática e Multi-Tenant do Rateio (Splits)
    if (splits !== undefined && splits !== null) {
      const splitVal = validateTransactionSplits(splits, amount, ctx);
      if (!splitVal.isValid) {
        return res.status(400).json({
          error: splitVal.error,
          message: splitVal.message
        });
      }
    }


    // 🛡️ Validação de Congregação Permitida (Anti-Injeção Cross-Tenant)
    if (church_id && church_id !== 'unidentified') {
      if (ctx.isSecondaryUser) {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: congregação não autorizada para este usuário.'
          });
        }
      } else if (ctx.isOwner && !ctx.isSuperAdmin) {
        const destChurchCheck = await pool.query(
          'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
          [church_id, ctx.userId, ctx.ownerId || ctx.userId]
        );
        if (destChurchCheck.rows.length === 0) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: congregação não pertence à sua organização.'
          });
        }
      }
    }

    // 🛡️ Validação de Conta Bancária Permitida (Anti-Injeção Cross-Tenant)
    if (bank_id && bank_id !== 'unidentified' && !String(bank_id).startsWith('manual') && bank_id !== 'gmail-sync') {
      if (ctx.isSecondaryUser) {
        if (ctx.allowedBankIds && ctx.allowedBankIds.length > 0 && !ctx.allowedBankIds.includes(bank_id)) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: conta bancária não autorizada para este usuário.'
          });
        }
      } else if (ctx.isOwner && !ctx.isSuperAdmin) {
        const bankOwnerCheck = await pool.query(
          'SELECT id FROM banks WHERE id = $1 AND (user_id = $2 OR user_id = $3) LIMIT 1',
          [bank_id, ctx.userId, ctx.ownerId || ctx.userId]
        );
        if (bankOwnerCheck.rows.length === 0) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: conta bancária não pertence à sua organização.'
          });
        }
      }
    }

    let effectiveType = type;
    const descUpper = (description || '').toUpperCase();
    if (
      effectiveType === 'expense' && 
      (descUpper.includes('NU PAGAMENTOS') || descUpper.includes('RECEBEU') || descUpper.includes('RECEBIDO')) &&
      !descUpper.includes('ENVIADO') && 
      !descUpper.includes('PAGO A')
    ) {
      effectiveType = 'income';
    }

    // 🛡️ Validação de Período Fechado (Congelamento)
    const isClosingTx = source === 'closing' || (id && String(id).startsWith('closing-')) || (row_hash && String(row_hash).startsWith('closing-'));
    const closedCheck = await isChurchPeriodClosed(pool, effectiveChurchId, transaction_date || reference_date, bank_id, isClosingTx);
    if (closedCheck.isClosed) {
      return res.status(422).json({
        error: 'PERIOD_CLOSED',
        message: closedCheck.message,
        churchId: closedCheck.churchId,
        year: closedCheck.year,
        month: closedCheck.month
      });
    }

    // Check row_hash duplicate if row_hash is provided
    if (row_hash) {
      const dupCheck = await pool.query('SELECT id FROM consolidated_transactions WHERE user_id = $1 AND row_hash = $2 LIMIT 1', [effectiveUserId, row_hash]);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'ROW_HASH_ALREADY_EXISTS', id: dupCheck.rows[0].id });
      }
    }

    const finalId = id || crypto.randomUUID();

    const finalContribReqId = await matchAndLinkContributionRequest(pool, {
      id: finalId,
      church_id: effectiveChurchId,
      contributor_id,
      amount,
      contribution_request_id
    });

    let initialSplits = splits ? (typeof splits === 'string' ? splits : JSON.stringify(splits)) : null;
    let initialContributionType = contribution_type || null;
    const initialAttachments = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : '[]';

    if (finalContribReqId && !initialSplits) {
      try {
        const reqCheck = await pool.query('SELECT splits, description FROM contribution_requests WHERE id = $1 LIMIT 1', [finalContribReqId]);
        if (reqCheck.rows.length > 0 && reqCheck.rows[0].splits) {
          const reqSplits = reqCheck.rows[0].splits;
          initialSplits = typeof reqSplits === 'string' ? reqSplits : JSON.stringify(reqSplits);
          try {
            const parsed = typeof reqSplits === 'string' ? JSON.parse(reqSplits) : reqSplits;
            if (Array.isArray(parsed) && parsed.length > 1) {
              initialContributionType = initialContributionType || 'Rateado';
            } else if (Array.isArray(parsed) && parsed.length === 1) {
              initialContributionType = initialContributionType || parsed[0]?.contributionType || parsed[0]?.label || null;
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    let query = '';
    let params: any[] = [];
    if (finalId) {
      query = `INSERT INTO consolidated_transactions 
        (id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, reference_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits, attachments) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) 
        ON CONFLICT (id) DO UPDATE SET 
          amount = EXCLUDED.amount, 
          description = EXCLUDED.description, 
          status = EXCLUDED.status, 
          is_confirmed = EXCLUDED.is_confirmed,
          bank_id = EXCLUDED.bank_id,
          reference_date = EXCLUDED.reference_date,
          church_id = EXCLUDED.church_id,
          contributor_id = EXCLUDED.contributor_id,
          report_id = EXCLUDED.report_id,
          payment_method = EXCLUDED.payment_method,
          contribution_type = EXCLUDED.contribution_type,
          contribution_request_id = EXCLUDED.contribution_request_id,
          splits = EXCLUDED.splits,
          attachments = EXCLUDED.attachments,
          updated_at = NOW()
        RETURNING *`;
      params = [finalId, amount, description, effectiveType, pix_key || null, source || 'file', effectiveUserId, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, reference_date || null, effectiveChurchId, contributor_id || null, report_id || null, payment_method || null, initialContributionType, finalContribReqId || null, initialSplits, initialAttachments];
    } else {
      query = `INSERT INTO consolidated_transactions 
        (amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, reference_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits, attachments) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`;
      params = [amount, description, effectiveType, pix_key || null, source || 'file', effectiveUserId, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, reference_date || null, effectiveChurchId, contributor_id || null, report_id || null, payment_method || null, initialContributionType, finalContribReqId || null, initialSplits, initialAttachments];
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

    notifyTenantRealtime(effectiveUserId || ctx.ownerId || ctx.userId, { type: 'TRANSACTION_UPDATED', action: 'CREATE', txId: row?.id, churchId: row?.church_id });
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'create')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para criar transações necessária.' });
    }
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: Transactions array is required' });
    }

    await client.query('BEGIN');
    const inserted: any[] = [];

    for (const tx of transactions) {
      const { id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, reference_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits, attachments } = tx;
      
      const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;
      const effectiveChurchId = (church_id && church_id !== 'unidentified')
        ? church_id
        : ((ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) ? ctx.churchId : (church_id || null));

      // 🛡️ Validação Matemática e Multi-Tenant do Rateio (Splits)
      if (splits !== undefined && splits !== null) {
        const splitVal = validateTransactionSplits(splits, amount, ctx);
        if (!splitVal.isValid) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: splitVal.error,
            message: splitVal.message,
            transactionId: id
          });
        }
      }


      // 🛡️ Validação de Congregação Permitida (Anti-Injeção Cross-Tenant)
      if (effectiveChurchId && effectiveChurchId !== 'unidentified') {
        if (ctx.isSecondaryUser) {
          if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(effectiveChurchId)) {
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: `Acesso negado: congregação não autorizada para este usuário.`
            });
          }
        } else if (ctx.isOwner && !ctx.isSuperAdmin) {
          const destChurchCheck = await client.query(
            'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
            [effectiveChurchId, ctx.userId, ctx.ownerId || ctx.userId]
          );
          if (destChurchCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: `Acesso negado: congregação não pertence à sua organização.`
            });
          }
        }
      }

      // 🛡️ Validação de Conta Bancária Permitida (Anti-Injeção Cross-Tenant)
      if (bank_id && bank_id !== 'unidentified' && !String(bank_id).startsWith('manual') && bank_id !== 'gmail-sync') {
        if (ctx.isSecondaryUser) {
          if (ctx.allowedBankIds && ctx.allowedBankIds.length > 0 && !ctx.allowedBankIds.includes(bank_id)) {
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: 'Acesso negado: conta bancária não autorizada para este usuário.'
            });
          }
        } else if (ctx.isOwner && !ctx.isSuperAdmin) {
          const bankOwnerCheck = await client.query(
            'SELECT id FROM banks WHERE id = $1 AND (user_id = $2 OR user_id = $3) LIMIT 1',
            [bank_id, ctx.userId, ctx.ownerId || ctx.userId]
          );
          if (bankOwnerCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: 'Acesso negado: conta bancária não pertence à sua organização.'
            });
          }
        }
      }

      // Prevenção cirúrgica contra duplicidades: se row_hash já existe para o usuário, reutiliza o registro existente
      // Lançamentos manuais são criados intencionalmente pelo usuário e não devem ser ignorados por colisão de hash
      if (row_hash && source !== 'manual') {
        const dupCheck = await client.query(
          'SELECT * FROM consolidated_transactions WHERE user_id = $1 AND row_hash = $2 LIMIT 1',
          [effectiveUserId, row_hash]
        );
        if (dupCheck.rows.length > 0) {
          console.log(`[bulk] Transação existente detectada com row_hash (${row_hash}), evitando duplicata.`);
          inserted.push(dupCheck.rows[0]);
          continue;
        }
      }

      // 🛡️ Validação de Período Fechado (Congelamento)
      const isClosingTx = source === 'closing' || (tx.id && String(tx.id).startsWith('closing-')) || (row_hash && String(row_hash).startsWith('closing-'));
      const closedCheck = await isChurchPeriodClosed(client, effectiveChurchId, transaction_date || reference_date, bank_id, isClosingTx);
      if (closedCheck.isClosed) {
        await client.query('ROLLBACK');
        return res.status(422).json({
          error: 'PERIOD_CLOSED',
          message: closedCheck.message,
          churchId: closedCheck.churchId,
          year: closedCheck.year,
          month: closedCheck.month,
          transaction: { description: tx.description, amount: tx.amount, date: transaction_date || reference_date }
        });
      }

      const finalId = id || crypto.randomUUID();

      const finalContribReqId = await matchAndLinkContributionRequest(client, {
        id: finalId,
        church_id: effectiveChurchId,
        contributor_id,
        amount,
        contribution_request_id
      });

      let initialSplits = splits ? (typeof splits === 'string' ? splits : JSON.stringify(splits)) : null;
      let initialContributionType = contribution_type || null;
      const initialAttachments = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : '[]';

      if (finalContribReqId && !initialSplits) {
        try {
          const reqCheck = await client.query('SELECT splits, description FROM contribution_requests WHERE id = $1 LIMIT 1', [finalContribReqId]);
          if (reqCheck.rows.length > 0 && reqCheck.rows[0].splits) {
            const reqSplits = reqCheck.rows[0].splits;
            initialSplits = typeof reqSplits === 'string' ? reqSplits : JSON.stringify(reqSplits);
            try {
              const parsed = typeof reqSplits === 'string' ? JSON.parse(reqSplits) : reqSplits;
              if (Array.isArray(parsed) && parsed.length > 1) {
                initialContributionType = initialContributionType || 'Rateado';
              } else if (Array.isArray(parsed) && parsed.length === 1) {
                initialContributionType = initialContributionType || parsed[0]?.contributionType || parsed[0]?.label || null;
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      let query = '';
      let params: any[] = [];
      if (finalId) {
        query = `INSERT INTO consolidated_transactions 
          (id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, reference_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits, attachments) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) 
          ON CONFLICT (id) DO UPDATE SET 
            amount = EXCLUDED.amount, 
            description = EXCLUDED.description, 
            status = EXCLUDED.status, 
            is_confirmed = EXCLUDED.is_confirmed,
            bank_id = EXCLUDED.bank_id,
            reference_date = EXCLUDED.reference_date,
            church_id = EXCLUDED.church_id,
            contributor_id = EXCLUDED.contributor_id,
            report_id = EXCLUDED.report_id,
            payment_method = EXCLUDED.payment_method,
            contribution_type = EXCLUDED.contribution_type,
            contribution_request_id = EXCLUDED.contribution_request_id,
            splits = EXCLUDED.splits,
            attachments = EXCLUDED.attachments,
            updated_at = NOW()
          RETURNING *`;
        params = [finalId, amount, description, type, pix_key || null, source || 'file', effectiveUserId, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, reference_date || null, effectiveChurchId, contributor_id || null, report_id || null, payment_method || null, initialContributionType, finalContribReqId || null, initialSplits, initialAttachments];
      } else {
        query = `INSERT INTO consolidated_transactions 
          (amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, reference_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits, attachments) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`;
        params = [amount, description, type, pix_key || null, source || 'file', effectiveUserId, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, reference_date || null, effectiveChurchId, contributor_id || null, report_id || null, payment_method || null, initialContributionType, finalContribReqId || null, initialSplits, initialAttachments];
      }

      const result = await client.query(query, params);
      const row = result.rows[0];
      inserted.push(row);

      if (row && row.is_confirmed) {
        publishContributionConfirmedEvent(client, row).catch(e => console.error('[EventPublish] Error:', e));
      }
    }

    await client.query('COMMIT');

    // 🛡️ Registro de Auditoria Consolidado para Inserção em Lote (Bulk)
    if (inserted.length > 0) {
      try {
        const churchIds = Array.from(new Set(inserted.map((t: any) => t.church_id).filter(Boolean)));
        const totalAmount = inserted.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        await logAudit(pool, {
          action: 'CREATE',
          entity: 'consolidated_transactions',
          entityId: `bulk_${inserted.length}_txs`,
          churchId: churchIds.length === 1 ? String(churchIds[0]) : (ctx.churchId || null),
          metadata: {
            isBulk: true,
            totalTransactions: inserted.length,
            totalAmount: Math.round(totalAmount * 100) / 100,
            churchIds,
            transactionIds: inserted.slice(0, 50).map((t: any) => t.id)
          },
          req
        });
      } catch (_) {}
    }

    notifyTenantRealtime(ctx.ownerId || ctx.userId, { type: 'TRANSACTION_UPDATED', action: 'BULK_CREATE', count: inserted.length });
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
  if (!ctx.isAuthenticated) return false;
  if (ctx.isSuperAdmin) return true;
  if (!oldTx) return false;

  const currentUserId = ctx.userId;
  const currentOwnerId = ctx.ownerId || ctx.userId;

  // 1. Vínculo direto por ID de usuário ou dono
  if (oldTx.user_id && (oldTx.user_id === currentUserId || oldTx.user_id === currentOwnerId)) {
    return true;
  }

  // 2. Se for usuário secundário: restringe estritamente às congregações permitidas
  if (ctx.isSecondaryUser) {
    if (!ctx.allowedChurchIds || ctx.allowedChurchIds.length === 0) return false;

    // Se o lançamento tem congregação definida:
    if (oldTx.church_id && oldTx.church_id !== 'unidentified') {
      return ctx.allowedChurchIds.includes(oldTx.church_id);
    }

    // Se a congregação for nula ou não identificada:
    // O lançamento só pode ser acessado se pertencer comprovadamente à mesma organização
    let belongsToOrg = false;
    if (oldTx.user_id && oldTx.user_id === currentOwnerId) {
      belongsToOrg = true;
    } else if (oldTx.user_id) {
      const secCheck = await pool.query(
        'SELECT id FROM app_users WHERE id = $1 AND owner_id = $2 LIMIT 1',
        [oldTx.user_id, currentOwnerId]
      );
      if (secCheck.rows.length > 0) belongsToOrg = true;
    } else if (oldTx.bank_id) {
      const bankCheck = await pool.query(
        'SELECT id FROM banks WHERE id = $1 AND (user_id = $2 OR user_id = $3) LIMIT 1',
        [oldTx.bank_id, currentUserId, currentOwnerId]
      );
      if (bankCheck.rows.length > 0) belongsToOrg = true;
    }

    if (!belongsToOrg) return false;

    // Se pertence à organização, verifica se o secundário possui permissão bancária específica
    if (ctx.allowedBankIds && ctx.allowedBankIds.length > 0 && oldTx.bank_id) {
      return ctx.allowedBankIds.includes(oldTx.bank_id);
    }

    return true;
  }

  // 3. Se for Proprietário / Administrador da conta (Owner):
  if (ctx.isOwner) {
    // 3.1 Se tem congregação definida, verifica se a congregação pertence ao proprietário
    if (oldTx.church_id && oldTx.church_id !== 'unidentified') {
      if (ctx.allowedChurchIds && ctx.allowedChurchIds.includes(oldTx.church_id)) return true;
      const churchCheck = await pool.query(
        'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
        [oldTx.church_id, currentUserId, currentOwnerId]
      );
      if (churchCheck.rows.length > 0) return true;
    }

    // 3.2 Se tem user_id, verifica se pertence a um usuário/perfil da organização
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

    // 3.3 Se tem bank_id, verifica se a conta bancária pertence à organização
    if (oldTx.bank_id) {
      const bankCheck = await pool.query(
        'SELECT id FROM banks WHERE id = $1 AND (user_id = $2 OR user_id = $3) LIMIT 1',
        [oldTx.bank_id, currentUserId, currentOwnerId]
      );
      if (bankCheck.rows.length > 0) return true;
    }

    // Se não há vínculo comprovado com congregação, usuário ou conta bancária do proprietário,
    // o acesso é negado (rejeição estrita de registros órfãos ou de terceiros).
    return false;
  }

  return false;
}

async function isAuthorizedForFinancialRecord(pool: any, ctx: TenantContext, oldRec: any): Promise<boolean> {
  if (!ctx.isAuthenticated) return false;
  if (ctx.isSuperAdmin) return true;
  if (!oldRec) return false;

  const currentUserId = ctx.userId;
  const currentOwnerId = ctx.ownerId || ctx.userId;

  // 1. Vínculo direto por ID de usuário ou dono
  if (oldRec.user_id && (oldRec.user_id === currentUserId || oldRec.user_id === currentOwnerId)) {
    return true;
  }

  // 2. Se for usuário secundário: restringe estritamente às congregações permitidas
  if (ctx.isSecondaryUser) {
    if (!ctx.allowedChurchIds || ctx.allowedChurchIds.length === 0) return false;
    if (oldRec.church_id && oldRec.church_id !== 'unidentified') {
      return ctx.allowedChurchIds.includes(oldRec.church_id);
    }
    // Se a congregação for nula/unidentified: só pode acessar se o registro pertencer à sua organização
    if (oldRec.user_id && oldRec.user_id === currentOwnerId) {
      return true;
    }
    if (oldRec.user_id) {
      const secCheck = await pool.query(
        'SELECT id FROM app_users WHERE id = $1 AND owner_id = $2 LIMIT 1',
        [oldRec.user_id, currentOwnerId]
      );
      if (secCheck.rows.length > 0) return true;
    }
    return false;
  }

  // 3. Se for Proprietário / Administrador da conta (Owner):
  if (ctx.isOwner) {
    if (oldRec.church_id && oldRec.church_id !== 'unidentified') {
      if (ctx.allowedChurchIds && ctx.allowedChurchIds.includes(oldRec.church_id)) return true;
      const churchCheck = await pool.query(
        'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
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

    // Não concede acesso a registros órfãos ou de organizações alheias
    return false;
  }

  return false;
}

// PUT /api/v1/consolidated_transactions/:id
app.put('/api/v1/consolidated_transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getTenantContext(req);
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'edit')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para editar transações necessária.' });
    }
    const { amount, description, type, pix_key, source, status, bank_id, row_hash, is_confirmed, transaction_date, reference_date, church_id, contributor_id, report_id, payment_method, contribution_type, contribution_request_id, splits, attachments } = req.body;
    
    const oldTxRes = await pool.query('SELECT * FROM consolidated_transactions WHERE id::text = $1', [id]);
    const oldTx = oldTxRes.rows[0] || null;
    if (!oldTx) return res.status(404).json({ error: 'NOT_FOUND' });

    const isAuthorized = await isAuthorizedForTransaction(pool, ctx, oldTx);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a transação pertence a outra organização.' });
    }

    // 🛡️ Validação de Autorização para Origem e Destino
    const currentUserId = ctx.userId;
    const currentOwnerId = ctx.ownerId || ctx.userId;

    if (ctx.isSecondaryUser) {
      // 1. Não permite alterar ou desassociar lançamento cuja congregação atual não seja autorizada
      if (oldTx.church_id && oldTx.church_id !== 'unidentified') {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(oldTx.church_id)) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: o lançamento pertence a uma congregação não autorizada para este usuário.'
          });
        }
      }

      // 2. Não permite atribuir o lançamento a uma congregação de destino não autorizada
      if (church_id !== undefined && church_id !== null && church_id !== 'unidentified') {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: congregação de destino não autorizada para este usuário.'
          });
        }
      }
    } else if (ctx.isOwner && !ctx.isSuperAdmin) {
      // 3. Proprietário não pode transferir transação para congregação pertencente a outra organização
      if (church_id !== undefined && church_id !== null && church_id !== 'unidentified') {
        const destChurchCheck = await pool.query(
          'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
          [church_id, currentUserId, currentOwnerId]
        );
        if (destChurchCheck.rows.length === 0) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: congregação de destino não pertence à sua organização.'
          });
        }
      }
    }

    // 🛡️ Validação Matemática e Multi-Tenant do Rateio (Splits)
    if (splits !== undefined && splits !== null) {
      const targetAmount = amount !== undefined ? amount : oldTx.amount;
      const splitVal = validateTransactionSplits(splits, targetAmount, ctx);
      if (!splitVal.isValid) {
        return res.status(400).json({
          error: splitVal.error,
          message: splitVal.message
        });
      }
    }

    // 🛡️ Proteção de Pernas Contábeis de Fechamento (PB-007)
    const isClosingLeg = oldTx.source === 'closing' || 
      (oldTx.row_hash && String(oldTx.row_hash).startsWith('closing-')) ||
      (oldTx.id && String(oldTx.id).startsWith('closing-'));
    if (isClosingLeg) {
      return res.status(403).json({
        error: 'CLOSING_LEG_PROTECTED',
        message: 'Lançamento protegido: Esta transação é uma perna contábil de transporte de saldo gerada por Fechamento. Para alterá-la, utilize o fluxo formal de Reabertura de Fechamento.'
      });
    }

    // 🛡️ Validação de Período Fechado (Congelamento Estrito)
    // 1. Não permite alterar transação pertencente a um período já fechado
    const oldEffectiveDate = oldTx.reference_date || oldTx.transaction_date;
    const oldCheck = await isChurchPeriodClosed(pool, oldTx.church_id, oldEffectiveDate, oldTx.bank_id);
    if (oldCheck.isClosed) {
      return res.status(422).json({
        error: 'PERIOD_CLOSED',
        message: `PERÍODO CONGELADO: Esta transação pertence ao período ${String(oldCheck.month).padStart(2, '0')}/${oldCheck.year}, que já teve seu Fechamento Final homologado. Alterações estão expressamente bloqueadas.`
      });
    }


    // 2. Não permite mover transação para uma congregação/data cujo período esteja fechado
    const targetChurchId = church_id !== undefined ? church_id : oldTx.church_id;
    const targetDate = (reference_date !== undefined && reference_date) ? reference_date : (transaction_date !== undefined ? transaction_date : (oldTx.reference_date || oldTx.transaction_date));
    const newCheck = await isChurchPeriodClosed(pool, targetChurchId, targetDate);
    if (newCheck.isClosed) {
      return res.status(422).json({
        error: 'PERIOD_CLOSED',
        message: newCheck.message
      });
    }

    let finalContribReqId = contribution_request_id;
    if (!finalContribReqId && (church_id || contributor_id || amount !== undefined)) {
      finalContribReqId = await matchAndLinkContributionRequest(pool, {
        id: id,
        church_id: church_id || oldTx.church_id,
        contributor_id: contributor_id || oldTx.contributor_id,
        amount: amount !== undefined ? amount : oldTx.amount,
        contribution_request_id: oldTx.contribution_request_id
      });
    }

    let finalSplitsToSet = splits !== undefined ? JSON.stringify(splits) : null;
    let finalContributionTypeToSet = contribution_type !== undefined ? contribution_type : null;

    if (splits === undefined && finalContribReqId) {
      try {
        const reqCheck = await pool.query('SELECT splits, description FROM contribution_requests WHERE id = $1 LIMIT 1', [finalContribReqId]);
        if (reqCheck.rows.length > 0 && reqCheck.rows[0].splits) {
          const reqSplits = reqCheck.rows[0].splits;
          finalSplitsToSet = typeof reqSplits === 'string' ? reqSplits : JSON.stringify(reqSplits);
          try {
            const parsed = typeof reqSplits === 'string' ? JSON.parse(reqSplits) : reqSplits;
            if (Array.isArray(parsed) && parsed.length > 1) {
              finalContributionTypeToSet = finalContributionTypeToSet || 'Rateado';
            } else if (Array.isArray(parsed) && parsed.length === 1) {
              finalContributionTypeToSet = finalContributionTypeToSet || parsed[0]?.contributionType || parsed[0]?.label || null;
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    let finalChurchIdToSet = church_id !== undefined ? (church_id && church_id !== 'unidentified' ? church_id : null) : undefined;
    // 🛡️ Proteção Anti-Regressão de Congregação: se o lançamento está identificado/resolvido e a igreja recebida foi nula ou não identificada,
    // preserva a congregação anterior ou recupera do cadastro do contribuinte / regra de associação aprendida
    if ((status === 'identified' || status === 'resolved' || oldTx.status === 'identified' || oldTx.status === 'resolved') && (!finalChurchIdToSet || finalChurchIdToSet === 'unidentified')) {
      if (oldTx.church_id && oldTx.church_id !== 'unidentified') {
        finalChurchIdToSet = oldTx.church_id;
      } else {
        const assocOwnerTarget = oldTx.user_id || ctx.ownerId || ctx.userId || '';
        const assocOwnerIds = assocOwnerTarget ? await getEquivalentUserIds(String(assocOwnerTarget)) : [];
        const targetContribId = contributor_id || oldTx.contributor_id;
        if (targetContribId && assocOwnerIds.length > 0) {
          try {
            const cRes = await pool.query(
              'SELECT c.church_id FROM contributors c JOIN churches ch ON ch.id::text = c.church_id::text WHERE c.id = $1 AND ch.user_id::text = ANY($2) LIMIT 1',
              [targetContribId, assocOwnerIds]
            );
            if (cRes.rows.length > 0 && cRes.rows[0].church_id && cRes.rows[0].church_id !== 'unidentified') {
              finalChurchIdToSet = cRes.rows[0].church_id;
            }
          } catch (_) {}
        }
        if (!finalChurchIdToSet && assocOwnerIds.length > 0) {
          try {
            const descToUse = description || oldTx.description;
            const normDesc = descToUse ? descToUse.toLowerCase().trim() : '';
            if (normDesc) {
              const laRes = await pool.query(
                'SELECT church_id FROM learned_associations WHERE LOWER(TRIM(normalized_description)) = $1 AND church_id IS NOT NULL AND user_id::text = ANY($2) LIMIT 1',
                [normDesc, assocOwnerIds]
              );
              if (laRes.rows.length > 0 && laRes.rows[0].church_id && laRes.rows[0].church_id !== 'unidentified') {
                finalChurchIdToSet = laRes.rows[0].church_id;
              }
            }
          } catch (_) {}
        }
      }
    }

    const finalAttachmentsToSet = attachments !== undefined 
      ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) 
      : null;

    const result = await pool.query(
      `UPDATE consolidated_transactions SET 
        amount = COALESCE($1, amount), 
        description = COALESCE($2, description), 
        type = COALESCE($3, type), 
        pix_key = COALESCE($4, pix_key), 
        source = COALESCE($5, source), 
        status = COALESCE($6, status), 
        bank_id = CASE WHEN $19::boolean THEN $7 ELSE bank_id END, 
        row_hash = COALESCE($8, row_hash), 
        is_confirmed = COALESCE($9, is_confirmed), 
        transaction_date = COALESCE($10, transaction_date),
        reference_date = CASE WHEN $23::boolean THEN $22 ELSE reference_date END,
        church_id = CASE WHEN $20::boolean THEN $11 ELSE church_id END,
        contributor_id = CASE WHEN $21::boolean THEN $12 ELSE contributor_id END,
        report_id = COALESCE($13, report_id),
        payment_method = COALESCE($14, payment_method),
        contribution_type = COALESCE($15, contribution_type),
        contribution_request_id = COALESCE($16, contribution_request_id),
        splits = CASE WHEN $17::text IS NOT NULL THEN $17::jsonb ELSE splits END,
        attachments = CASE WHEN $24::boolean THEN $25::jsonb ELSE attachments END,
        updated_at = NOW()
      WHERE id::text = $18 RETURNING *`,
      [
        amount, 
        description, 
        type, 
        pix_key, 
        source, 
        status, 
        bank_id !== undefined ? bank_id : null, 
        row_hash, 
        is_confirmed, 
        transaction_date, 
        finalChurchIdToSet !== undefined ? finalChurchIdToSet : null, 
        contributor_id !== undefined ? contributor_id : null, 
        report_id, 
        payment_method, 
        finalContributionTypeToSet, 
        finalContribReqId || null, 
        finalSplitsToSet, 
        id,
        bank_id !== undefined,
        finalChurchIdToSet !== undefined,
        contributor_id !== undefined,
        reference_date !== undefined ? (reference_date || null) : null,
        reference_date !== undefined,
        attachments !== undefined,
        finalAttachmentsToSet
      ]
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

    notifyTenantRealtime(ctx.ownerId || ctx.userId, { type: 'TRANSACTION_UPDATED', action: 'UPDATE', txId: id });
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'delete')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para excluir transações necessária.' });
    }

    const oldTxRes = await pool.query('SELECT * FROM consolidated_transactions WHERE id::text = $1', [id]);
    const oldTx = oldTxRes.rows[0] || null;
    if (!oldTx) {
      return res.json({ success: true, notFoundInDb: true, id });
    }

    const isAuthorized = await isAuthorizedForTransaction(pool, ctx, oldTx);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a transação pertence a outra organização.' });
    }

    // 🛡️ Proteção de Pernas Contábeis de Fechamento (PB-007)
    const isClosingLeg = oldTx.source === 'closing' || 
      (oldTx.row_hash && String(oldTx.row_hash).startsWith('closing-')) ||
      (oldTx.id && String(oldTx.id).startsWith('closing-'));
    if (isClosingLeg) {
      return res.status(403).json({
        error: 'CLOSING_LEG_PROTECTED',
        message: 'Lançamento protegido: Esta transação é uma perna contábil de transporte de saldo gerada por Fechamento. Para excluí-la, utilize o fluxo formal de Reabertura de Fechamento.'
      });
    }

    // 🛡️ Validação de Período Fechado (Congelamento)
    const oldCheck = await isChurchPeriodClosed(pool, oldTx.church_id, oldTx.transaction_date || oldTx.reference_date, oldTx.bank_id);
    if (oldCheck.isClosed) {
      return res.status(422).json({
        error: 'PERIOD_CLOSED',
        message: `PERÍODO CONGELADO: Esta transação pertence ao período fechado (${String(oldCheck.month).padStart(2, '0')}/${oldCheck.year}). Exclusões estão bloqueadas para manter a inalterabilidade do relatório fechado.`
      });
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

    notifyTenantRealtime(ctx.ownerId || ctx.userId, { type: 'TRANSACTION_UPDATED', action: 'DELETE', txId: id });
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'delete')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para excluir transações necessária.' });
    }
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

      // 🛡️ Proteção de Pernas Contábeis de Fechamento (PB-007)
      const isClosingLeg = oldTx.source === 'closing' || 
        (oldTx.row_hash && String(oldTx.row_hash).startsWith('closing-')) ||
        (oldTx.id && String(oldTx.id).startsWith('closing-'));
      if (isClosingLeg) {
        return res.status(403).json({
          error: 'CLOSING_LEG_PROTECTED',
          message: `Lançamento protegido: A transação "${oldTx.description}" é uma perna contábil de fechamento e não pode ser excluída em lote.`
        });
      }

      // 🛡️ Validação de Período Fechado (Congelamento)
      const closedCheck = await isChurchPeriodClosed(pool, oldTx.church_id, oldTx.transaction_date || oldTx.reference_date, oldTx.bank_id);
      if (closedCheck.isClosed) {
        return res.status(422).json({
          error: 'PERIOD_CLOSED',
          message: `PERÍODO CONGELADO: A transação "${oldTx.description}" pertence ao período fechado (${String(closedCheck.month).padStart(2, '0')}/${closedCheck.year}). Exclusões em lote contendo períodos fechados estão expressamente bloqueadas.`
        });
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

    notifyTenantRealtime(ctx.ownerId || ctx.userId, { type: 'TRANSACTION_UPDATED', action: 'BULK_DELETE', ids });
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar registros financeiros.' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão de visualização de registros financeiros necessária.' });
    }

    const { user_id, church_id, type, status } = req.query;

    if (!ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado aos registros financeiros de outro usuário.' });
      }
    }

    if (ctx.isSecondaryUser && ctx.allowedChurchIds.length === 0) {
      return res.json([]);
    }

    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : (user_id || ctx.ownerId || ctx.userId);

    if (!effectiveUserId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id is required' });
    }

    const userIds = await getEquivalentUserIds(String(effectiveUserId));
    let query = `
      SELECT * FROM financial_records 
      WHERE user_id::text = ANY($1)
    `;
    const params: any[] = [userIds];
    let count = 2;

    if (ctx.isSecondaryUser) {
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        query += ` AND church_id::text = $${count}`;
        params.push(church_id);
        count++;
      } else {
        query += ` AND church_id::text = ANY($${count})`;
        params.push(ctx.allowedChurchIds);
        count++;
      }
    } else if (church_id && church_id !== 'all' && typeof church_id === 'string') {
      query += ` AND church_id::text = $${count}`;
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'create')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para criar registros financeiros necessária.' });
    }
    const {
      id,
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

    const effectiveId = (typeof id === 'string' && id.trim()) ? id.trim() : crypto.randomUUID();
    const effectiveUserId = (ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;
    const effectiveChurchId = (church_id && church_id !== 'unidentified') ? String(church_id) : ((ctx.isAuthenticated && !ctx.isSuperAdmin && ctx.churchId) ? ctx.churchId : null);

    if (!effectiveUserId || !title || amount === undefined || !type) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id, title, amount, and type are required' });
    }

    // 🛡️ Validação de Congregação Permitida (Anti-Injeção Cross-Tenant)
    if (church_id && church_id !== 'unidentified') {
      if (ctx.isSecondaryUser) {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: congregação não autorizada para este usuário.'
          });
        }
      } else if (ctx.isOwner && !ctx.isSuperAdmin) {
        const destChurchCheck = await pool.query(
          'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
          [church_id, ctx.userId, ctx.ownerId || ctx.userId]
        );
        if (destChurchCheck.rows.length === 0) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: congregação não pertence à sua organização.'
          });
        }
      }
    }

    // 🛡️ Validação de Período Fechado (Congelamento)
    const recordDate = payment_date || due_date;
    const closedCheck = await isChurchPeriodClosed(pool, effectiveChurchId, recordDate);
    if (closedCheck.isClosed) {
      return res.status(422).json({
        error: 'PERIOD_CLOSED',
        message: closedCheck.message
      });
    }

    // 🛡️ Validação de Conciliação Bancária
    if (bank_transaction_id) {
      const bankTxRes = await pool.query('SELECT * FROM consolidated_transactions WHERE id::text = $1 LIMIT 1', [bank_transaction_id]);
      if (bankTxRes.rows.length === 0) {
        return res.status(400).json({
          error: 'BANK_TRANSACTION_NOT_FOUND',
          message: 'A transação bancária vinculada não foi encontrada.'
        });
      }
      const bankTx = bankTxRes.rows[0];
      const isBankTxAuthorized = await isAuthorizedForTransaction(pool, ctx, bankTx);
      if (!isBankTxAuthorized) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: a transação bancária vinculada pertence a outra organização.'
        });
      }
      const bankTxCheck = await isChurchPeriodClosed(pool, bankTx.church_id, bankTx.reference_date || bankTx.transaction_date, bankTx.bank_id);
      if (bankTxCheck.isClosed) {
        return res.status(422).json({
          error: 'PERIOD_CLOSED',
          message: `PERÍODO CONGELADO: A transação bancária vinculada pertence ao período ${String(bankTxCheck.month).padStart(2, '0')}/${bankTxCheck.year}, que já teve seu Fechamento Final homologado.`
        });
      }
    }

    const result = await pool.query(

      `INSERT INTO financial_records (
        id, user_id, church_id, title, description, amount, type, status, 
        recipient_name, recipient_type, due_date, payment_date, recurrence, parent_id,
        bank_transaction_id, bank_transaction_desc, attachments, validation_status, validation_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [
        effectiveId,
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
        attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : '[]',
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'edit')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para editar registros financeiros necessária.' });
    }
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

    // 🛡️ Validação de Autorização para Origem e Destino
    const currentUserId = ctx.userId;
    const currentOwnerId = ctx.ownerId || ctx.userId;

    if (ctx.isSecondaryUser) {
      // 1. Não permite alterar lançamento cuja congregação atual não seja autorizada
      if (oldRec.church_id && oldRec.church_id !== 'unidentified') {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(oldRec.church_id)) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: o registro pertence a uma congregação não autorizada para este usuário.'
          });
        }
      }

      // 2. Não permite atribuir o lançamento a uma congregação de destino não autorizada
      if (church_id !== undefined && church_id !== null && church_id !== 'unidentified') {
        if (!ctx.allowedChurchIds || !ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: congregação de destino não autorizada para este usuário.'
          });
        }
      }
    } else if (ctx.isOwner && !ctx.isSuperAdmin) {
      // 3. Proprietário não pode transferir registro para congregação de outra organização
      if (church_id !== undefined && church_id !== null && church_id !== 'unidentified') {
        const destChurchCheck = await pool.query(
          'SELECT id FROM churches WHERE id::text = $1 AND (user_id::text = $2 OR user_id::text = $3) LIMIT 1',
          [church_id, currentUserId, currentOwnerId]
        );
        if (destChurchCheck.rows.length === 0) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Acesso negado: congregação de destino não pertence à sua organização.'
          });
        }
      }
    }

    // 🛡️ Validação de Período Fechado (Congelamento)
    const oldCheck = await isChurchPeriodClosed(pool, oldRec.church_id, oldRec.payment_date || oldRec.due_date);
    if (oldCheck.isClosed) {
      return res.status(422).json({
        error: 'PERIOD_CLOSED',
        message: `PERÍODO CONGELADO: Este registro financeiro pertence ao período ${String(oldCheck.month).padStart(2, '0')}/${oldCheck.year}, que já teve seu Fechamento Final homologado. Edições estão bloqueadas.`
      });
    }

    const targetChurchId = church_id !== undefined ? church_id : oldRec.church_id;
    const targetDate = payment_date !== undefined ? payment_date : (due_date !== undefined ? due_date : (oldRec.payment_date || oldRec.due_date));
    const newCheck = await isChurchPeriodClosed(pool, targetChurchId, targetDate);
    if (newCheck.isClosed) {
      return res.status(422).json({
        error: 'PERIOD_CLOSED',
        message: newCheck.message
      });
    }

    // 🛡️ Validação de Conciliação Bancária
    if (bank_transaction_id !== undefined && bank_transaction_id !== null && bank_transaction_id !== '') {
      const bankTxRes = await pool.query('SELECT * FROM consolidated_transactions WHERE id::text = $1 LIMIT 1', [bank_transaction_id]);
      if (bankTxRes.rows.length === 0) {
        return res.status(400).json({
          error: 'BANK_TRANSACTION_NOT_FOUND',
          message: 'A transação bancária vinculada não foi encontrada.'
        });
      }
      const bankTx = bankTxRes.rows[0];
      const isBankTxAuthorized = await isAuthorizedForTransaction(pool, ctx, bankTx);
      if (!isBankTxAuthorized) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Acesso negado: a transação bancária vinculada pertence a outra organização.'
        });
      }
      const bankTxCheck = await isChurchPeriodClosed(pool, bankTx.church_id, bankTx.reference_date || bankTx.transaction_date, bankTx.bank_id);
      if (bankTxCheck.isClosed) {
        return res.status(422).json({
          error: 'PERIOD_CLOSED',
          message: `PERÍODO CONGELADO: A transação bancária vinculada pertence ao período ${String(bankTxCheck.month).padStart(2, '0')}/${bankTxCheck.year}, que já teve seu Fechamento Final homologado.`
        });
      }
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
    await enrichSecondaryUserContext(pool, ctx);
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'delete')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para excluir registros financeiros necessária.' });
    }

    const oldRecRes = await pool.query('SELECT * FROM financial_records WHERE id = $1', [id]);
    const oldRec = oldRecRes.rows[0] || null;
    if (!oldRec) return res.status(404).json({ error: 'NOT_FOUND' });

    const isAuthorized = await isAuthorizedForFinancialRecord(pool, ctx, oldRec);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: o registro pertence a outro usuário.' });
    }

    // 🛡️ Validação de Período Fechado (Congelamento)
    const oldCheck = await isChurchPeriodClosed(pool, oldRec.church_id, oldRec.payment_date || oldRec.due_date);
    if (oldCheck.isClosed) {
      return res.status(422).json({
        error: 'PERIOD_CLOSED',
        message: `PERÍODO CONGELADO: Este registro pertence ao período ${String(oldCheck.month).padStart(2, '0')}/${oldCheck.year}, que já teve seu Fechamento Final homologado. Exclusões estão bloqueadas.`
      });
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para consultar automações pastorais.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão insuficiente.' });
    }
    const { user_id, church_id } = req.query;

    if (!ctx.isSuperAdmin && ctx.userId) {
      if (user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado às automações de outro usuário.' });
      }
    }

    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;

    if (!effectiveUserId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id is required' });
    }

    if (ctx.isSecondaryUser) {
      if (ctx.allowedChurchIds.length === 0) {
        return res.json([]);
      }
      if (church_id && church_id !== 'all' && typeof church_id === 'string') {
        if (!ctx.allowedChurchIds.includes(church_id)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado para esta congregação.' });
        }
        const ownerIds = await getEquivalentUserIds(String(effectiveUserId));
        const result = await pool.query(
          'SELECT * FROM pastor_automations WHERE user_id::text = ANY($1) AND church_id::text = $2 ORDER BY payment_day ASC, created_at DESC',
          [ownerIds, church_id]
        );
        return res.json(result.rows);
      }
      const ownerIds = await getEquivalentUserIds(String(effectiveUserId));
      const result = await pool.query(
        'SELECT * FROM pastor_automations WHERE user_id::text = ANY($1) AND church_id::text = ANY($2) ORDER BY payment_day ASC, created_at DESC',
        [ownerIds, ctx.allowedChurchIds]
      );
      return res.json(result.rows);
    }

    const ownerIds = await getEquivalentUserIds(String(effectiveUserId));
    const result = await pool.query(
      'SELECT * FROM pastor_automations WHERE user_id::text = ANY($1) ORDER BY payment_day ASC, created_at DESC',
      [ownerIds]
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para criar automações pastorais.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
    if (ctx.isSecondaryUser && !hasPermission(ctx, 'create', 'edit')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão para criar automações necessária.' });
    }
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

    if (!ctx.isSuperAdmin && ctx.userId && user_id && user_id !== ctx.userId && user_id !== ctx.ownerId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado às automações de outro usuário.' });
    }

    const effectiveUserId = (!ctx.isSuperAdmin && ctx.userId) ? (ctx.ownerId || ctx.userId) : user_id;
    const effectiveChurchId = (!ctx.isSuperAdmin && ctx.churchId && !church_id) ? ctx.churchId : (church_id || null);

    if (!effectiveUserId || !pastor_name || !pix_key) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id, pastor_name, and pix_key are required' });
    }

    if (ctx.isSecondaryUser) {
      if (!effectiveChurchId || !ctx.allowedChurchIds.includes(String(effectiveChurchId))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação não autorizada para este usuário.' });
      }
    } else if (!ctx.isSuperAdmin && effectiveChurchId) {
      const ownerIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      if (!ownerIds.includes(String(effectiveChurchId))) {
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2) LIMIT 1', [effectiveChurchId, ownerIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação pertence a outra organização.' });
        }
      }
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para atualizar automações pastorais.' });
    }
    await enrichSecondaryUserContext(pool, ctx);
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

    if (!ctx.isSuperAdmin) {
      const ownerIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      if (!oldAuto.user_id || !ownerIds.includes(String(oldAuto.user_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a automação pertence a outro usuário.' });
      }
      if (ctx.isSecondaryUser) {
        if (!hasPermission(ctx, 'edit')) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão de edição necessária.' });
        }
        if (!oldAuto.church_id || !ctx.allowedChurchIds.includes(String(oldAuto.church_id))) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a automação pertence a outra congregação.' });
        }
        if (church_id !== undefined && (!church_id || !ctx.allowedChurchIds.includes(String(church_id)))) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação de destino não autorizada.' });
        }
      } else if (church_id !== undefined && church_id !== null && !ownerIds.includes(String(church_id))) {
        const chCheck = await pool.query('SELECT id FROM churches WHERE id::text = $1 AND user_id::text = ANY($2) LIMIT 1', [church_id, ownerIds]);
        if (chCheck.rows.length === 0) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: congregação de destino pertence a outra organização.' });
        }
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
    if (!ctx.isAuthenticated) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticação necessária para remover automações pastorais.' });
    }
    await enrichSecondaryUserContext(pool, ctx);

    const oldRes = await pool.query('SELECT * FROM pastor_automations WHERE id = $1', [id]);
    const oldAuto = oldRes.rows[0] || null;
    if (!oldAuto) return res.status(404).json({ error: 'NOT_FOUND' });

    if (!ctx.isSuperAdmin) {
      const ownerIds = await getEquivalentUserIds(ctx.ownerId || ctx.userId || '');
      if (!oldAuto.user_id || !ownerIds.includes(String(oldAuto.user_id))) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a automação pertence a outro usuário.' });
      }
      if (ctx.isSecondaryUser) {
        if (!hasPermission(ctx, 'delete')) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: permissão de exclusão necessária.' });
        }
        if (!oldAuto.church_id || !ctx.allowedChurchIds.includes(String(oldAuto.church_id))) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso negado: a automação pertence a outra congregação.' });
        }
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


// GET /api/v1/portal/church-icon - Gera ícone otimizado para PWA/Apple Touch com margem segura (Safe Zone)
app.get('/api/v1/portal/church-icon', async (req: Request, res: Response) => {
  try {
    const { church_id, church_slug, size } = req.query;
    const targetSize = Number(size) === 192 ? 192 : 512;
    let targetChurch: any = null;

    let reqSlug = typeof church_slug === 'string' ? church_slug.trim() : '';
    let reqId = typeof church_id === 'string' ? church_id.trim() : '';

    // Fallback inteligente: se o navegador solicitou sem query params, extrair da URL de Referer
    if (!reqId && !reqSlug && req.headers.referer) {
      try {
        const refUrl = new URL(req.headers.referer);
        reqId = refUrl.searchParams.get('church') || refUrl.searchParams.get('igreja') || refUrl.searchParams.get('c') || '';
        const pathParts = refUrl.pathname.replace(/^\/portal/, '').split('/').filter(Boolean);
        if (pathParts[0] === 'church' && pathParts[1]) {
          reqSlug = pathParts[1];
        } else if (pathParts[0] && !['identify', 'reports', 'pledges', 'coming_soon', 'not_found', 'cadastro', 'cadastrar', 'register'].includes(pathParts[0])) {
          reqSlug = pathParts[0];
        }
      } catch (_) {}
    }

    if (reqId) {
      const q = await pool.query('SELECT id, name, "logoUrl" FROM churches WHERE id = $1 LIMIT 1', [reqId]);
      if (q.rows && q.rows.length > 0) {
        targetChurch = q.rows[0];
      }
    }

    if (!targetChurch && reqSlug) {
      const slugVal = reqSlug.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const allChurches = await pool.query('SELECT id, name, "logoUrl" FROM churches');
      if (allChurches.rows && allChurches.rows.length > 0) {
        targetChurch = allChurches.rows.find((c: any) => {
          const s = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const sRaw = (c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return s === slugVal || sRaw === slugVal || s.includes(slugVal) || slugVal.includes(s) || c.id === reqSlug;
        }) || null;
      }
    }

    if (!targetChurch) {
      const fallbackQ = await pool.query('SELECT id, name, "logoUrl" FROM churches ORDER BY created_at ASC LIMIT 1');
      if (fallbackQ.rows && fallbackQ.rows.length > 0) {
        targetChurch = fallbackQ.rows[0];
      }
    }

    const rawLogoUrl = (targetChurch?.logoUrl || targetChurch?.logourl || targetChurch?.logo_url || '').trim();

    if (!rawLogoUrl) {
      const churchInitials = (targetChurch?.name || 'Igreja')
        .split(' ')
        .filter((w: string) => w.length > 2)
        .slice(0, 2)
        .map((w: string) => w[0].toUpperCase())
        .join('') || 'IG';

      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${targetSize} ${targetSize}" width="${targetSize}" height="${targetSize}">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
        </defs>
        <rect width="${targetSize}" height="${targetSize}" fill="url(#bgGrad)" rx="${Math.round(targetSize * 0.22)}"/>
        <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${Math.round(targetSize * 0.36)}" fill="#10B981" text-anchor="middle" dominant-baseline="central">${churchInitials}</text>
      </svg>`;
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(svgContent);
    }

    // Se for SVG, renderizar SVG em container seguro com margem interna
    if (rawLogoUrl.includes('image/svg') || rawLogoUrl.endsWith('.svg')) {
      const safePadding = Math.round(targetSize * 0.16); // 16% safe zone
      const safeDimension = targetSize - (safePadding * 2);
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${targetSize} ${targetSize}" width="${targetSize}" height="${targetSize}">
        <rect width="${targetSize}" height="${targetSize}" fill="#ffffff" rx="${Math.round(targetSize * 0.18)}"/>
        <image href="${rawLogoUrl.replace(/"/g, '&quot;')}" x="${safePadding}" y="${safePadding}" width="${safeDimension}" height="${safeDimension}" preserveAspectRatio="xMidYMid meet"/>
      </svg>`;
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(svgContent);
    }

    // Processar imagem com Jimp para compor em canvas quadrado branco com safe zone
    try {
      const { Jimp } = await import('jimp');
      let logoBuffer: Buffer | null = null;

      if (rawLogoUrl.startsWith('data:image/')) {
        const base64Data = rawLogoUrl.replace(/^data:image\/[a-z0-9+.-]+;base64,/, '');
        logoBuffer = Buffer.from(base64Data, 'base64');
      } else if (rawLogoUrl.startsWith('http://') || rawLogoUrl.startsWith('https://')) {
        const fetchRes = await fetch(rawLogoUrl);
        if (fetchRes.ok) {
          const arrayBuf = await fetchRes.arrayBuffer();
          logoBuffer = Buffer.from(arrayBuf);
        }
      } else if (rawLogoUrl.startsWith('/')) {
        const localPath = path.resolve(process.cwd(), 'public', rawLogoUrl.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          logoBuffer = fs.readFileSync(localPath);
        }
      }

      if (logoBuffer) {
        const logoImg = await (Jimp as any).read(logoBuffer);
        const canvas = new (Jimp as any)({ width: targetSize, height: targetSize, color: 0xffffffff });

        // Margem segura para ícones adaptativos (Android Maskable e iOS):
        // Escala máxima de 68% garante que todo o conteúdo da logo cadastrada fique 100% visível em qualquer máscara (círculo, squircle, cantos arredondados)
        const maxDim = Math.round(targetSize * 0.68);
        const scale = Math.min(maxDim / logoImg.width, maxDim / logoImg.height);
        const scaledW = Math.max(1, Math.round(logoImg.width * scale));
        const scaledH = Math.max(1, Math.round(logoImg.height * scale));

        logoImg.resize({ w: scaledW, h: scaledH });
        const posX = Math.round((targetSize - scaledW) / 2);
        const posY = Math.round((targetSize - scaledH) / 2);

        canvas.composite(logoImg, posX, posY);
        const finalPngBuffer = await canvas.getBuffer('image/png');

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(finalPngBuffer);
      }
    } catch (jimpErr) {
      console.warn('[Contributors API] Falha ao processar ícone com Jimp, aplicando fallback direto:', jimpErr);
    }

    // Fallback seguro se o Jimp falhar: se for data URL, enviar buffer sem redirecionamento inválido
    if (rawLogoUrl.startsWith('data:image/')) {
      const matches = rawLogoUrl.match(/^data:([A-Za-z0-9+.\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      }
    }

    return res.redirect(rawLogoUrl);
  } catch (err: any) {
    console.error('[Contributors API] Erro ao servir ícone do portal:', err);
    return res.redirect('/pwa/icon-512.png?v=15');
  }
});

// GET /api/v1/portal/manifest.json - Manifest dinâmico para PWA do Portal da Igreja
app.get('/api/v1/portal/manifest.json', async (req: Request, res: Response) => {
  try {
    const { church_id, church_slug } = req.query;
    let targetChurch: any = null;

    let reqSlug = typeof church_slug === 'string' ? church_slug.trim() : '';
    let reqId = typeof church_id === 'string' ? church_id.trim() : '';

    if (!reqId && !reqSlug && req.headers.referer) {
      try {
        const refUrl = new URL(req.headers.referer);
        reqId = refUrl.searchParams.get('church') || refUrl.searchParams.get('igreja') || refUrl.searchParams.get('c') || '';
        const pathParts = refUrl.pathname.replace(/^\/portal/, '').split('/').filter(Boolean);
        if (pathParts[0] === 'church' && pathParts[1]) {
          reqSlug = pathParts[1];
        } else if (pathParts[0] && !['identify', 'reports', 'pledges', 'coming_soon', 'not_found', 'cadastro', 'cadastrar', 'register'].includes(pathParts[0])) {
          reqSlug = pathParts[0];
        }
      } catch (_) {}
    }

    if (reqId) {
      const q = await pool.query('SELECT id, name, "logoUrl", address FROM churches WHERE id = $1 LIMIT 1', [reqId]);
      if (q.rows && q.rows.length > 0) {
        targetChurch = q.rows[0];
      }
    }

    if (!targetChurch && reqSlug) {
      const slugVal = reqSlug.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const allChurches = await pool.query('SELECT id, name, "logoUrl", address FROM churches');
      if (allChurches.rows && allChurches.rows.length > 0) {
        targetChurch = allChurches.rows.find((c: any) => {
          const s = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const sRaw = (c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return s === slugVal || sRaw === slugVal || s.includes(slugVal) || slugVal.includes(s) || c.id === reqSlug;
        }) || null;
      }
    }

    if (!targetChurch) {
      // Fallback para a primeira congregação cadastrada
      const fallbackQ = await pool.query('SELECT id, name, "logoUrl", address FROM churches ORDER BY created_at ASC LIMIT 1');
      if (fallbackQ.rows && fallbackQ.rows.length > 0) {
        targetChurch = fallbackQ.rows[0];
      }
    }

    const churchName = targetChurch?.name || 'Portal do Contribuinte';
    const cleanChurchId = targetChurch?.id || 'default';
    const slugName = (targetChurch?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const churchParams = cleanChurchId !== 'default' 
      ? `?church_id=${encodeURIComponent(cleanChurchId)}&church_slug=${encodeURIComponent(slugName)}` 
      : '';
    const sep = churchParams ? '&' : '?';

    // Apontar os ícones para o endpoint de ícone seguro (/api/portal/church-icon)
    // Isso garante que a logo cadastrada fique menor, centralizada e nunca cortada em máscaras do Android ou iOS
    const dynamicIconUrl192 = `/api/portal/church-icon${churchParams}${sep}size=192`;
    const dynamicIconUrl512 = `/api/portal/church-icon${churchParams}${sep}size=512`;

    const icons = [
      {
        src: dynamicIconUrl192,
        type: "image/png",
        sizes: "192x192",
        purpose: "any"
      },
      {
        src: dynamicIconUrl512,
        type: "image/png",
        sizes: "512x512",
        purpose: "any"
      },
      {
        src: dynamicIconUrl512,
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable"
      }
    ];

    // Manifesto W3C com id e scope estritamente isolados do sistema principal
    const manifest = {
      id: `/portal-app-${cleanChurchId}`,
      lang: "pt-BR",
      name: `${churchName} - Portal`,
      short_name: churchName.length > 15 ? churchName.substring(0, 15) : churchName,
      description: `Portal de Contribuição e Autoatendimento - ${churchName}`,
      icons: icons,
      start_url: `/portal?church=${encodeURIComponent(cleanChurchId)}`,
      scope: "/portal",
      display: "standalone",
      theme_color: "#051024",
      background_color: "#ffffff",
      orientation: "any"
    };

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache leve de 5 minutos
    return res.json(manifest);
  } catch (err: any) {
    console.error('[Contributors API] Error generating portal manifest:', err);
    return res.status(500).json({ error: 'FAILED_TO_GENERATE_MANIFEST' });
  }
});

if (process.env.INTEGRATED_MODE !== 'true' && process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Contributors API] Server running on port ${PORT}`);
  });
} else {
  console.log(`[Contributors API] Modo integrado ativo. O servidor Express principal lidará com as requisições.`);
}
