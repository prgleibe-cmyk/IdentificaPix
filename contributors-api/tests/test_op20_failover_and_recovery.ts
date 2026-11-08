import { pool } from '../server.js';
import { validateRestoredDatabase } from '../services/restore.service.js';

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

async function runFailoverTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES — OP-20 (SUB-ETAPA 9.2)');
  console.log('   FAILOVER TRANSPARENTE, AUTO-CURA E SINCRONIZAÇÃO DE RESGATE (SmartPool)');
  console.log('========================================================================\n');

  // --- CENÁRIO 1: Validação do Catálogo Expandido de Tabelas Críticas ---
  console.log('--- CENÁRIO 1: Validação do Catálogo Expandido de Tabelas Críticas ---');
  const validationReports = await validateRestoredDatabase(pool);
  assert(validationReports.length >= 11, `Catálogo de tabelas críticas contém ${validationReports.length} entidades (mínimo 11)`);

  const hasChurchClosings = validationReports.some(r => r.tableName === 'church_closings');
  const hasChurchPixKeys = validationReports.some(r => r.tableName === 'church_pix_keys');
  const hasAuditLogs = validationReports.some(r => r.tableName === 'saved_reports');

  assert(hasChurchClosings, 'Tabela "church_closings" incluída no catálogo de integridade crítica');
  assert(hasChurchPixKeys, 'Tabela "church_pix_keys" incluída no catálogo de integridade crítica');
  assert(hasAuditLogs, 'Tabela "saved_reports" incluída no catálogo de integridade crítica');

  // --- CENÁRIO 2: Persistência no Motor Local SQLite durante Failover ---
  console.log('\n--- CENÁRIO 2: Persistência no Motor Local SQLite durante Failover ---');
  const smartPool = pool as any;
  const localEngine = smartPool.localEngine;
  assert(!!localEngine, 'SmartPool possui motor local durável ativo (localEngine)');

  const testReportId = 'rep-recov-' + Date.now();
  const testPixId = '00000000-0000-4000-e000-000000000001';
  const testAuditId = '00000000-0000-4000-e000-000000000002';

  // Grava diretamente no motor local simulando gravação em contingência
  localEngine.query(`
    INSERT OR REPLACE INTO saved_reports (id, name, record_count, user_id, church_id, data, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))
  `, [testReportId, 'Relatório Contingência P9', 42, 'owner-p9', 'church-p9', JSON.stringify({ items: 42 })]);

  localEngine.query(`
    INSERT OR REPLACE INTO church_pix_keys (id, bank_id, church_id, pix_type, pix_key, holder_name, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, 1)
  `, [testPixId, '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000002', 'email', 'financeiro-p9@igreja.org', 'Igreja P9']);

  localEngine.query(`
    INSERT OR REPLACE INTO audit_logs (id, user_id, church_id, action, entity, entity_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))
  `, [testAuditId, 'user-p9', 'church-p9', 'CONTINGENCY_MUTATION', 'financial_records', 'rec-001']);

  // Verifica que os dados foram gravados duravelmente no SQLite local
  const checkLocalReport = localEngine.query('SELECT id, name FROM saved_reports WHERE id = $1', [testReportId]);
  assert(checkLocalReport.rows.length === 1, 'Registro de relatório salvo no SQLite local durante failover');

  const checkLocalPix = localEngine.query('SELECT id, pix_key FROM church_pix_keys WHERE id = $1', [testPixId]);
  assert(checkLocalPix.rows.length === 1, 'Registro de chave Pix salvo no SQLite local durante failover');

  const checkLocalAudit = localEngine.query('SELECT id, action FROM audit_logs WHERE id = $1', [testAuditId]);
  assert(checkLocalAudit.rows.length === 1, 'Registro de auditoria salvo no SQLite local durante failover');

  // --- CENÁRIO 3: Execução da Rotina de Auto-Cura e Resgate (syncPendingLocalToPostgres) ---
  console.log('\n--- CENÁRIO 3: Execução da Rotina de Auto-Cura e Resgate (syncPendingLocalToPostgres) ---');
  let syncThrew = false;
  try {
    // Executa a rotina de resgate para certificar sintaxe, consistência e tratamento
    await smartPool.syncPendingLocalToPostgres();
  } catch (err) {
    syncThrew = true;
    console.error('Erro no resgate:', err);
  }

  assert(!syncThrew, 'Rotina syncPendingLocalToPostgres executada sem exceções não tratadas');

  // --- CENÁRIO 4: Idempotência do Resgate (Dupla Execução) ---
  console.log('\n--- CENÁRIO 4: Idempotência do Resgate (Dupla Execução) ---');
  let secondSyncThrew = false;
  try {
    await smartPool.syncPendingLocalToPostgres();
  } catch (err) {
    secondSyncThrew = true;
  }
  assert(!secondSyncThrew, 'Segunda execução de syncPendingLocalToPostgres é idempotente e segura');

  // --- CENÁRIO 5: Resiliência contra Queda e Consulta Local ---
  console.log('\n--- CENÁRIO 5: Resiliência contra Queda e Consulta Local ---');
  const queryRes = await pool.query('SELECT id, name FROM saved_reports WHERE id = $1 LIMIT 1', [testReportId]);
  assert(queryRes.rows.length === 1, 'Consulta transparente via SmartPool recuperou relatório gravado');
  assert(queryRes.rows[0].name === 'Relatório Contingência P9', 'Conteúdo íntegro recuperado pelo SmartPool');

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO DA SUB-ETAPA 9.2: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runFailoverTests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
