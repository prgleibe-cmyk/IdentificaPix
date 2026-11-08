import http from 'http';
import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import { queryAuditLogs, sanitizeAuditData } from '../services/audit.service.js';

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

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES — OP-18 (SUB-ETAPA 8.2)');
  console.log('   HARDENING DA TRILHA DE AUDITORIA, LOGS E RASTREABILIDADE (audit_logs)');
  console.log('========================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const orgA_ownerId = 'owner-orgA-' + Date.now();
  const orgA_churchId = '00000000-0000-4000-b000-000000000002';
  const orgA_bankId = '00000000-0000-4000-a000-000000000001';

  // Seed baseline
  await pool.query(
    'INSERT OR REPLACE INTO churches (id, name, user_id) VALUES ($1, $2, $3)',
    [orgA_churchId, 'Igreja Central Org A', orgA_ownerId]
  );
  await pool.query(
    'INSERT OR REPLACE INTO banks (id, name, user_id, bank_key) VALUES ($1, $2, $3, $4)',
    [orgA_bankId, 'Banco do Brasil', orgA_ownerId, 'bb-001']
  );

  const ownerTokenObj = generateAccessToken({
    userId: orgA_ownerId,
    email: 'admin@orga.com',
    role: 'owner',
    ownerId: orgA_ownerId,
    churchId: orgA_churchId,
    allowedChurchIds: [orgA_churchId],
    allowedBankIds: [orgA_bankId]
  });
  const ownerToken = ownerTokenObj.token;

  // --- CENÁRIO 1: Normalização de JSON em queryAuditLogs ---
  console.log('--- CENÁRIO 1: Normalização de JSON em queryAuditLogs ---');
  const sanitized = sanitizeAuditData({
    password: 'supersecretpassword',
    token: 'jwt-token-123456',
    pix_key: 'igreja@pix.com.br',
    amount: 1500.50
  });

  assert(sanitized.password === '[REDACTED]', 'Senha higienizada para [REDACTED]');
  assert(sanitized.token === '[REDACTED]', 'Token higienizado para [REDACTED]');
  assert(sanitized.pix_key === 'igreja@pix.com.br', 'Chave Pix de negócio preservada intacta');
  assert(sanitized.amount === 1500.50, 'Valores numéricos preservados');

  // Inserir registro bruto com string JSON para verificar normalização
  await pool.query(`
    INSERT INTO audit_logs (
      user_id, church_id, action, entity, entity_id, ip_address, user_agent, old_values, new_values, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    orgA_ownerId,
    orgA_churchId,
    'TEST_ACTION',
    'test_entity',
    'test-id-1',
    '127.0.0.1',
    'AuditTester/1.0',
    JSON.stringify({ oldKey: 'oldValue' }),
    JSON.stringify({ newKey: 'newValue' }),
    JSON.stringify({ metaKey: 'metaValue' })
  ]);

  const queryResult = await queryAuditLogs(pool, {
    churchId: orgA_churchId,
    action: 'TEST_ACTION'
  });

  assert(queryResult.total >= 1, 'queryAuditLogs encontrou o registro inserido');
  const foundLog = queryResult.logs.find(l => l.action === 'TEST_ACTION');
  assert(foundLog && typeof foundLog.new_values === 'object' && foundLog.new_values.newKey === 'newValue', 'new_values normalizado como objeto');
  assert(foundLog && typeof foundLog.old_values === 'object' && foundLog.old_values.oldKey === 'oldValue', 'old_values normalizado como objeto');
  assert(foundLog && typeof foundLog.metadata === 'object' && foundLog.metadata.metaKey === 'metaValue', 'metadata normalizado como objeto');

  // --- CENÁRIO 2: Auditoria em church-pix-keys (POST e PATCH) ---
  console.log('\n--- CENÁRIO 2: Auditoria em church-pix-keys (POST e PATCH) ---');
  const postPixRes = await fetch(`${baseUrl}/api/v1/church-pix-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      bank_id: orgA_bankId,
      church_id: orgA_churchId,
      pix_type: 'email',
      pix_key: `contato-${Date.now()}@igreja.com.br`,
      holder_name: 'Igreja Central'
    })
  });

  assert(postPixRes.status === 201, `POST /church-pix-keys retornou HTTP 201 (Recebido: ${postPixRes.status})`);
  const createdPixBody = await postPixRes.json();
  const createdPixKeyId = createdPixBody.id;

  const pixAuditCreate = await queryAuditLogs(pool, {
    churchId: orgA_churchId,
    entity: 'church_pix_keys',
    action: 'CREATE'
  });
  const foundPixCreate = pixAuditCreate.logs.find(l => l.entity_id === createdPixKeyId);
  assert(!!foundPixCreate, 'Evento CREATE de church_pix_keys registrado na tabela audit_logs');
  assert(foundPixCreate?.action === 'CREATE', 'Ação registrada como CREATE');

  // PATCH chave pix
  const patchPixRes = await fetch(`${baseUrl}/api/v1/church-pix-keys/${createdPixKeyId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      description: 'Chave atualizada para dízimos'
    })
  });

  assert(patchPixRes.status === 200, `PATCH /church-pix-keys retornou HTTP 200 (Recebido: ${patchPixRes.status})`);
  const pixAuditUpdate = await queryAuditLogs(pool, {
    churchId: orgA_churchId,
    entity: 'church_pix_keys',
    action: 'UPDATE'
  });
  const foundPixUpdate = pixAuditUpdate.logs.find(l => l.entity_id === createdPixKeyId);
  assert(!!foundPixUpdate, 'Evento UPDATE de church_pix_keys registrado na tabela audit_logs');

  // --- CENÁRIO 3: Auditoria em saved_reports (POST, PUT, DELETE) ---
  console.log('\n--- CENÁRIO 3: Auditoria em saved_reports (POST, PUT, DELETE) ---');
  const reportId = 'rep-audit-' + Date.now();
  const postRepRes = await fetch(`${baseUrl}/api/v1/saved_reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      id: reportId,
      name: 'Relatório Trimestral Auditado',
      church_id: orgA_churchId,
      record_count: 10,
      data: { summary: 'Resumo auditado' }
    })
  });

  assert(postRepRes.status === 201, `POST /saved_reports retornou HTTP 201 (Recebido: ${postRepRes.status})`);

  const repAuditCreate = await queryAuditLogs(pool, {
    churchId: orgA_churchId,
    entity: 'saved_reports',
    action: 'CREATE'
  });
  const foundRepCreate = repAuditCreate.logs.find(l => l.entity_id === reportId);
  assert(!!foundRepCreate, 'Evento CREATE de saved_reports registrado na tabela audit_logs');

  // PUT saved_reports
  const putRepRes = await fetch(`${baseUrl}/api/v1/saved_reports/${reportId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      name: 'Relatório Trimestral Auditado - Revisado',
      record_count: 12
    })
  });

  assert(putRepRes.status === 200, `PUT /saved_reports retornou HTTP 200 (Recebido: ${putRepRes.status})`);

  const repAuditUpdate = await queryAuditLogs(pool, {
    churchId: orgA_churchId,
    entity: 'saved_reports',
    action: 'UPDATE'
  });
  const foundRepUpdate = repAuditUpdate.logs.find(l => l.entity_id === reportId);
  assert(!!foundRepUpdate, 'Evento UPDATE de saved_reports registrado na tabela audit_logs');

  // DELETE saved_reports
  const delRepRes = await fetch(`${baseUrl}/api/v1/saved_reports/${reportId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ownerToken}`
    }
  });

  assert(delRepRes.status === 200, `DELETE /saved_reports retornou HTTP 200 (Recebido: ${delRepRes.status})`);

  const repAuditDelete = await queryAuditLogs(pool, {
    churchId: orgA_churchId,
    entity: 'saved_reports',
    action: 'DELETE'
  });
  const foundRepDelete = repAuditDelete.logs.find(l => l.entity_id === reportId);
  assert(!!foundRepDelete, 'Evento DELETE de saved_reports registrado na tabela audit_logs');

  // --- CENÁRIO 4: Auditoria em consolidated_transactions/bulk ---
  console.log('\n--- CENÁRIO 4: Auditoria em consolidated_transactions/bulk ---');
  const tx1Id = 'tx-b1-' + Date.now();
  const tx2Id = 'tx-b2-' + Date.now();

  const bulkRes = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      transactions: [
        {
          id: tx1Id,
          amount: 250.00,
          description: 'Lote Auditado 1',
          type: 'credit',
          transaction_date: '2026-11-01',
          church_id: orgA_churchId,
          bank_id: orgA_bankId,
          source: 'manual'
        },
        {
          id: tx2Id,
          amount: 150.00,
          description: 'Lote Auditado 2',
          type: 'credit',
          transaction_date: '2026-11-02',
          church_id: orgA_churchId,
          bank_id: orgA_bankId,
          source: 'manual'
        }
      ]
    })
  });

  assert(bulkRes.status === 201, `POST /bulk retornou HTTP 201 (Recebido: ${bulkRes.status})`);

  const bulkAudit = await queryAuditLogs(pool, {
    churchId: orgA_churchId,
    entity: 'consolidated_transactions',
    action: 'CREATE'
  });

  const foundBulkLog = bulkAudit.logs.find(l => l.entity_id === 'bulk_2_txs');
  assert(!!foundBulkLog, 'Evento CREATE consolidado gravado para lote de transações em audit_logs');
  assert(foundBulkLog?.metadata?.isBulk === true, 'Flag isBulk presente no metadata');
  assert(foundBulkLog?.metadata?.totalTransactions === 2, 'Metadata reflete 2 transações inseridas');
  assert(foundBulkLog?.metadata?.totalAmount === 400.00, 'Metadata reflete montante total somado de R$ 400,00');

  // --- CENÁRIO 5: Imutabilidade Estrita da Trilha ---
  console.log('\n--- CENÁRIO 5: Imutabilidade Estrita da Trilha ---');
  const deleteAttempt = await fetch(`${baseUrl}/api/v1/audit-logs/${foundBulkLog?.id || 'fake-id'}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ownerToken}`
    }
  });

  assert(deleteAttempt.status === 404, `Tentativa de DELETE em audit-logs rejeitada com HTTP 404 (Recebido: ${deleteAttempt.status})`);

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO DA SUB-ETAPA 8.2: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
