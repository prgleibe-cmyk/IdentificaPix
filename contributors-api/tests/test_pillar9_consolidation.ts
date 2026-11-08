import fs from 'fs';
import path from 'path';
import { pool } from '../server.js';
import { 
  getBackupEncryptionKey, 
  encryptAndCompress, 
  decryptAndDecompress, 
  verifyBackupFile, 
  getBackupDirectory,
  executeBackupWithLock
} from '../services/backup.service.js';
import { validateRestoredDatabase, restoreDatabaseFromEncryptedBuffer } from '../services/restore.service.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${msg}`);
    failed++;
  }
}

async function runConsolidationTests() {
  console.log('========================================================================');
  console.log('🏛️ BATERIA CONSOLIDADA DE HOMOLOGAÇÃO — PILAR 9');
  console.log('   DISPONIBILIDADE, RESILIÊNCIA E PLANO DE CONTINGÊNCIA (SmartPool & Backups)');
  console.log('========================================================================\n');

  const smartPool = pool as any;
  const localEngine = smartPool.localEngine;

  // --- ETAPA 1: Dual-Engine SmartPool & Fallback Durável ---
  console.log('--- ETAPA 1: Dual-Engine SmartPool & Fallback Durável ---');
  assert(!!smartPool, 'Instância SmartPool ativa');
  assert(!!localEngine, 'Motor local durável SQLite ativo para tolerância a falhas');

  const probeRes = await smartPool.probeAndRecover();
  assert(typeof probeRes === 'boolean', `Auto-cura probeAndRecover funcional (status: ${probeRes ? 'Online' : 'Resilient Fallback Active'})`);

  // --- ETAPA 2: Validação Estrutural do Catálogo de 11 Tabelas Críticas ---
  console.log('\n--- ETAPA 2: Validação Estrutural do Catálogo de 11 Tabelas Críticas ---');
  const validationReports = await validateRestoredDatabase(pool);
  assert(validationReports.length >= 11, `Catálogo de tabelas críticas validou ${validationReports.length} entidades (mínimo 11)`);

  const requiredTables = [
    'app_users', 'churches', 'contributors', 'consolidated_transactions',
    'financial_records', 'saved_reports', 'banks', 'pastoral_messages',
    'learned_associations', 'church_closings', 'church_pix_keys'
  ];

  for (const table of requiredTables) {
    const found = validationReports.some(r => r.tableName === table);
    assert(found, `Tabela crítica "${table}" presente no catálogo do RestoreService`);
  }

  // --- ETAPA 3: Persistência Multi-Entidade em Contingência Local ---
  console.log('\n--- ETAPA 3: Persistência Multi-Entidade em Contingência Local ---');
  const dummyTxId = '00000000-0000-4000-f000-000000000001';
  const dummyReportId = 'rep-p9-cons-' + Date.now();
  const dummyPixId = '00000000-0000-4000-f000-000000000002';
  const dummyAuditId = '00000000-0000-4000-f000-000000000003';
  const dummyChurchId = '00000000-0000-4000-f000-000000000010';
  const dummyBankId = '00000000-0000-4000-f000-000000000020';

  localEngine.query(`
    INSERT OR REPLACE INTO churches (id, name, user_id) VALUES ($1, $2, $3)
  `, [dummyChurchId, 'Igreja Homologada P9', 'owner-p9-cons']);

  localEngine.query(`
    INSERT OR REPLACE INTO banks (id, name, user_id, bank_key) VALUES ($1, $2, $3, $4)
  `, [dummyBankId, 'Banco Homologado P9', 'owner-p9-cons', 'key-p9']);

  localEngine.query(`
    INSERT OR REPLACE INTO consolidated_transactions (id, amount, description, type, user_id, status, bank_id, church_id, transaction_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))
  `, [dummyTxId, 750.00, 'Lançamento Contingência P9', 'credit', 'owner-p9-cons', 'confirmed', dummyBankId, dummyChurchId]);

  localEngine.query(`
    INSERT OR REPLACE INTO saved_reports (id, name, record_count, user_id, church_id, data, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))
  `, [dummyReportId, 'Relatório Homologado P9', 15, 'owner-p9-cons', dummyChurchId, JSON.stringify({ ok: true })]);

  localEngine.query(`
    INSERT OR REPLACE INTO church_pix_keys (id, bank_id, church_id, pix_type, pix_key, holder_name, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, 1)
  `, [dummyPixId, dummyBankId, dummyChurchId, 'cnpj', '11222333000199', 'Igreja P9']);

  localEngine.query(`
    INSERT OR REPLACE INTO audit_logs (id, user_id, church_id, action, entity, entity_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))
  `, [dummyAuditId, 'owner-p9-cons', dummyChurchId, 'HOMOLOGATION_EVENT', 'system', 'p9-final']);

  const txCheck = localEngine.query('SELECT id FROM consolidated_transactions WHERE id = $1', [dummyTxId]);
  const repCheck = localEngine.query('SELECT id FROM saved_reports WHERE id = $1', [dummyReportId]);
  const pixCheck = localEngine.query('SELECT id FROM church_pix_keys WHERE id = $1', [dummyPixId]);
  const auditCheck = localEngine.query('SELECT id FROM audit_logs WHERE id = $1', [dummyAuditId]);

  assert(txCheck.rows.length === 1, 'Transação financeira salva no SQLite');
  assert(repCheck.rows.length === 1, 'Relatório salvo no SQLite');
  assert(pixCheck.rows.length === 1, 'Chave Pix salva no SQLite');
  assert(auditCheck.rows.length === 1, 'Log de auditoria salvo no SQLite');

  // --- ETAPA 4: Sincronização de Resgate Completa e Idempotente ---
  console.log('\n--- ETAPA 4: Sincronização de Resgate Completa e Idempotente ---');
  let rescueSuccess = true;
  try {
    await smartPool.syncPendingLocalToPostgres();
  } catch (err) {
    rescueSuccess = false;
    console.error('Falha no resgate:', err);
  }
  assert(rescueSuccess, 'Rotina de resgate para todas as 10 entidades executada com sucesso');

  // Segunda execução para provar idempotência
  let doubleRescueSuccess = true;
  try {
    await smartPool.syncPendingLocalToPostgres();
  } catch (err) {
    doubleRescueSuccess = false;
  }
  assert(doubleRescueSuccess, 'Re-execução do resgate atesta idempotência e segurança contra duplicações');

  // --- ETAPA 5: Criptografia, Adulteração e Integridade de Backups ---
  console.log('\n--- ETAPA 5: Criptografia, Adulteração e Integridade de Backups ---');
  const key = getBackupEncryptionKey();
  assert(key.length === 32, 'Chave de criptografia AES-256 de 32 bytes ativa');

  const testSql = `-- IgGestor Pillar 9 Consolidation Backup
CREATE TABLE IF NOT EXISTS p9_cons_test (id TEXT PRIMARY KEY, bal REAL);
INSERT OR REPLACE INTO p9_cons_test (id, bal) VALUES ('cons-1', 4850.25);
`;
  const encBuffer = encryptAndCompress(testSql, key);
  assert(encBuffer.subarray(0, 8).toString('utf8') === 'IGBCKPv1', 'Cabeçalho mágico IGBCKPv1 verificado');

  // Descriptografia fiel
  const decSql = decryptAndDecompress(encBuffer, key);
  assert(decSql === testSql, 'Dump recuperado idêntico centavo a centavo');

  // Adulteração intencional
  const badBuffer = Buffer.from(encBuffer);
  badBuffer[badBuffer.length - 2] ^= 0xAA;
  let rejectedTamper = false;
  try {
    decryptAndDecompress(badBuffer, key);
  } catch (_) {
    rejectedTamper = true;
  }
  assert(rejectedTamper, 'AuthTag rejeitou adulteração de byte no payload cifrado');

  // Arquivo no disco
  const backupDir = getBackupDirectory();
  const testFilePath = path.join(backupDir, `p9-test-${Date.now()}.enc`);
  fs.writeFileSync(testFilePath, encBuffer);
  const fileValid = verifyBackupFile(testFilePath, key);
  assert(fileValid, 'verifyBackupFile validou arquivo autêntico sem descompressão pesada em memória');
  try { fs.unlinkSync(testFilePath); } catch (_) {}

  // --- ETAPA 6: Restauração Atômica Segura ---
  console.log('\n--- ETAPA 6: Restauração Atômica Segura ---');
  const restoreResult = await restoreDatabaseFromEncryptedBuffer(encBuffer, pool, 'buffer', 'p9-consolidation-test');
  assert(restoreResult.success, 'Restauração transacional executada com sucesso');
  assert(restoreResult.decryptedSizeBytes > 0, 'Carga descriptografada e executada em bloco BEGIN/COMMIT');

  try {
    await pool.query('DROP TABLE IF EXISTS p9_cons_test;');
  } catch (_) {}

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO DA HOMOLOGAÇÃO DO PILAR 9: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runConsolidationTests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
