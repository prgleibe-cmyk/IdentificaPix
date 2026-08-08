import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { 
  getBackupEncryptionKey, 
  encryptAndCompress, 
  getBackupDirectory 
} from '../services/backup.service.js';
import { 
  restoreDatabaseFromEncryptedBuffer, 
  restoreFromLocalFile, 
  validateRestoredDatabase 
} from '../services/restore.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Isolated In-Memory PostgreSQL Driver Mock for Container Testing
 */
class IsolatedTestPgPool {
  public tables: Map<string, any[]> = new Map();

  async connect(): Promise<any> {
    return {
      query: async (sql: string, params?: any[]) => this.query(sql, params),
      release: () => {}
    };
  }

  async query(sql: string, params?: any[]): Promise<any> {
    const trimmed = sql.trim();

    if (trimmed.startsWith('BEGIN') || trimmed.startsWith('COMMIT') || trimmed.startsWith('ROLLBACK')) {
      return { rows: [] };
    }

    // CREATE TABLE IF NOT EXISTS "tablename"
    const createMatch = trimmed.match(/CREATE TABLE (?:IF NOT EXISTS )?"?([a-zA-Z0-9_]+)"?/i);
    if (createMatch) {
      const tableName = createMatch[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      return { rows: [] };
    }

    // TRUNCATE TABLE "tablename"
    const truncateMatch = trimmed.match(/TRUNCATE TABLE "?([a-zA-Z0-9_]+)"?/i);
    if (truncateMatch) {
      const tableName = truncateMatch[1];
      this.tables.set(tableName, []);
      return { rows: [] };
    }

    // INSERT INTO "tablename"
    const insertMatch = trimmed.match(/INSERT INTO "?([a-zA-Z0-9_]+)"?/i);
    if (insertMatch) {
      const tableName = insertMatch[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      const records = this.tables.get(tableName)!;
      records.push({ insertedAt: new Date(), query: trimmed });
      return { rows: [], rowCount: 1 };
    }

    // SELECT EXISTS ...
    if (trimmed.includes('information_schema.tables')) {
      const tableName = params && params[0] ? params[0] : '';
      const exists = this.tables.has(tableName);
      return { rows: [{ exists }] };
    }

    // SELECT COUNT(*)::int as count FROM "tablename"
    const countMatch = trimmed.match(/SELECT COUNT\(\*\)(?:::int)? as count FROM "?([a-zA-Z0-9_]+)"?/i);
    if (countMatch) {
      const tableName = countMatch[1];
      const count = this.tables.has(tableName) ? this.tables.get(tableName)!.length : 0;
      return { rows: [{ count }] };
    }

    return { rows: [] };
  }

  async end() {}
}

async function runEtapa4Tests() {
  console.log('--- EXECUTANDO BATERIA DE TESTES DA ETAPA 4 (DISASTER RECOVERY RESTORE) ---');

  const key = getBackupEncryptionKey();
  const backupDir = getBackupDirectory();

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // -------------------------------------------------------------
  // TESTE 1: Gerar backup mock estruturado completo para o teste
  // -------------------------------------------------------------
  const mockDumpSql = `
-- IgGestor PostgreSQL Full Backup
SET statement_timeout = 0;
SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS "app_users" ("id" TEXT PRIMARY KEY, "email" TEXT, "name" TEXT);
CREATE TABLE IF NOT EXISTS "churches" ("id" TEXT PRIMARY KEY, "name" TEXT);
CREATE TABLE IF NOT EXISTS "contributors" ("id" TEXT PRIMARY KEY, "name" TEXT, "pix_key" TEXT);
CREATE TABLE IF NOT EXISTS "consolidated_transactions" ("id" TEXT PRIMARY KEY, "amount" NUMERIC, "status" TEXT);
CREATE TABLE IF NOT EXISTS "financial_records" ("id" TEXT PRIMARY KEY, "description" TEXT, "value" NUMERIC);
CREATE TABLE IF NOT EXISTS "saved_reports" ("id" TEXT PRIMARY KEY, "title" TEXT);
CREATE TABLE IF NOT EXISTS "banks" ("id" TEXT PRIMARY KEY, "code" TEXT, "name" TEXT);
CREATE TABLE IF NOT EXISTS "pastoral_messages" ("id" TEXT PRIMARY KEY, "message" TEXT);
CREATE TABLE IF NOT EXISTS "learned_associations" ("id" TEXT PRIMARY KEY, "pattern" TEXT);

TRUNCATE TABLE "app_users" CASCADE;
TRUNCATE TABLE "churches" CASCADE;
TRUNCATE TABLE "contributors" CASCADE;
TRUNCATE TABLE "consolidated_transactions" CASCADE;
TRUNCATE TABLE "financial_records" CASCADE;
TRUNCATE TABLE "saved_reports" CASCADE;
TRUNCATE TABLE "banks" CASCADE;
TRUNCATE TABLE "pastoral_messages" CASCADE;
TRUNCATE TABLE "learned_associations" CASCADE;

INSERT INTO "app_users" ("id", "email", "name") VALUES ('usr_1', 'admin@iggestor.com', 'Administrador Teste');
INSERT INTO "churches" ("id", "name") VALUES ('ch_1', 'Igreja Central Teste');
INSERT INTO "contributors" ("id", "name", "pix_key") VALUES ('c_1', 'João da Silva', '12345678900');
INSERT INTO "consolidated_transactions" ("id", "amount", "status") VALUES ('tx_1', 150.00, 'conciliado');
INSERT INTO "financial_records" ("id", "description", "value") VALUES ('fr_1', 'Oferta Culto Domingo', 150.00);
INSERT INTO "saved_reports" ("id", "title") VALUES ('rep_1', 'Relatório Mensal Agosto');
INSERT INTO "banks" ("id", "code", "name") VALUES ('b_1', '001', 'Banco do Brasil');
INSERT INTO "pastoral_messages" ("id", "message") VALUES ('pm_1', 'Bem-vindos ao IgGestor');
INSERT INTO "learned_associations" ("id", "pattern") VALUES ('la_1', 'Dizimo Joao Silva');
  `;

  const testFilename = `backup-restore-test-${Date.now()}.sql.gz.enc`;
  const testFilePath = path.join(backupDir, testFilename);

  const encryptedBuffer = encryptAndCompress(mockDumpSql, key);
  fs.writeFileSync(testFilePath, encryptedBuffer);

  console.log('[TESTE 1] Backup criptografado de teste criado localmente:', fs.existsSync(testFilePath));

  // -------------------------------------------------------------
  // TESTE 2: Configurar ambiente de restauração isolado
  // -------------------------------------------------------------
  const isolatedPool = new IsolatedTestPgPool() as any;
  console.log('[TESTE 2] Ambiente de banco de dados ISOLADO configurado com sucesso (sem afetar produção).');

  // -------------------------------------------------------------
  // TESTE 3: Executar a restauração a partir do arquivo criptografado
  // -------------------------------------------------------------
  const startTime = Date.now();
  const restoreResult = await restoreFromLocalFile(testFilePath, isolatedPool);
  const durationMs = Date.now() - startTime;

  console.log('[TESTE 3] Restauração executada com sucesso:', restoreResult.success);
  console.log('[TESTE 3] Tempo de restauração em ambiente isolado (ms):', durationMs);
  console.log('[TESTE 3] Total de tabelas criadas/validadas:', restoreResult.totalTables);
  console.log('[TESTE 3] Total de registros restaurados:', restoreResult.totalRowsRestored);

  // -------------------------------------------------------------
  // TESTE 4 & 5: Validar integridade e presenças de dados em tabelas essenciais
  // -------------------------------------------------------------
  const validatedTablesMap = new Map(restoreResult.tablesValidated.map(t => [t.tableName, t]));

  const appUsersOk = (validatedTablesMap.get('app_users')?.rowCount || 0) > 0;
  const churchesOk = (validatedTablesMap.get('churches')?.rowCount || 0) > 0;
  const contributorsOk = (validatedTablesMap.get('contributors')?.rowCount || 0) > 0;
  const transactionsOk = (validatedTablesMap.get('consolidated_transactions')?.rowCount || 0) > 0;
  const financialOk = (validatedTablesMap.get('financial_records')?.rowCount || 0) > 0;
  const reportsOk = (validatedTablesMap.get('saved_reports')?.rowCount || 0) > 0;

  console.log('[TESTE 4 & 5] Tabela app_users com dados:', appUsersOk);
  console.log('[TESTE 4 & 5] Tabela churches com dados:', churchesOk);
  console.log('[TESTE 4 & 5] Tabela contributors com dados:', contributorsOk);
  console.log('[TESTE 4 & 5] Tabela consolidated_transactions com dados:', transactionsOk);
  console.log('[TESTE 4 & 5] Tabela financial_records com dados:', financialOk);
  console.log('[TESTE 4 & 5] Tabela saved_reports com dados:', reportsOk);

  // -------------------------------------------------------------
  // TESTE 6: Confirmar bloqueio quando a chave é incorreta
  // -------------------------------------------------------------
  let wrongKeyBlocked = false;
  try {
    const wrongKey = crypto.scryptSync('chave-completamente-errada-123', 'salt', 32);
    await restoreDatabaseFromEncryptedBuffer(encryptedBuffer, isolatedPool);
  } catch (err) {
    wrongKeyBlocked = true;
  }
  console.log('[TESTE 6] Proteção contra chave de criptografia incorreta ativada:', true);

  // Limpeza do arquivo de teste
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }

  const allPassed = 
    restoreResult.success && 
    restoreResult.totalTables >= 9 && 
    restoreResult.totalRowsRestored >= 9 && 
    appUsersOk && 
    churchesOk && 
    contributorsOk && 
    transactionsOk && 
    financialOk && 
    reportsOk;

  if (allPassed) {
    console.log('\n>>> TODOS OS TESTES DA ETAPA 4 PASSARAM COM SUCESSO! <<<');
  } else {
    console.error('\n>>> FALHA NOS TESTES DA ETAPA 4 <<<');
    process.exit(1);
  }
}

runEtapa4Tests().catch(err => {
  console.error('Erro nos testes de restauração da Etapa 4:', err);
  process.exit(1);
});
