import http from 'http';
import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import { queryAuditLogs, sanitizeAuditData, extractClientIp, extractUserAgent } from '../services/audit.service.js';

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
  console.log('🏛️ BATERIA CONSOLIDADA DE HOMOLOGAÇÃO — PILAR 8');
  console.log('   AUDITORIA, LOGS E RASTREABILIDADE (audit_logs, multi-tenant & security)');
  console.log('========================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const orgA_ownerId = 'owner-p8-' + Date.now();
  const orgA_secId = 'sec-p8-' + Date.now();
  const churchA1 = '00000000-0000-4000-d000-000000000001';
  const churchA2 = '00000000-0000-4000-d000-000000000002';
  const bankA1 = '00000000-0000-4000-d000-000000000010';

  // Seed baseline
  await pool.query(
    'INSERT OR REPLACE INTO churches (id, name, user_id) VALUES ($1, $2, $3)',
    [churchA1, 'Congregação Matriz P8', orgA_ownerId]
  );
  await pool.query(
    'INSERT OR REPLACE INTO churches (id, name, user_id) VALUES ($1, $2, $3)',
    [churchA2, 'Congregação Filial P8', orgA_ownerId]
  );
  await pool.query(
    'INSERT OR REPLACE INTO banks (id, name, user_id, bank_key) VALUES ($1, $2, $3, $4)',
    [bankA1, 'Banco Central P8', orgA_ownerId, 'bc-001']
  );

  const ownerToken = generateAccessToken({
    userId: orgA_ownerId,
    email: 'titular@p8.org',
    role: 'owner',
    ownerId: orgA_ownerId,
    churchId: churchA1,
    allowedChurchIds: [churchA1, churchA2],
    allowedBankIds: [bankA1]
  }).token;

  // Secundário COM permissão de auditoria, mas restrito APENAS à churchA1
  const secTokenWithAudit = generateAccessToken({
    userId: orgA_secId,
    email: 'auditor@p8.org',
    role: 'secondary',
    ownerId: orgA_ownerId,
    churchId: churchA1,
    permissions: ['audit', 'reports'],
    allowedChurchIds: [churchA1] // restrito a churchA1
  }).token;

  // Secundário SEM permissão de auditoria
  const secTokenNoAudit = generateAccessToken({
    userId: 'sec-noaudit-' + Date.now(),
    email: 'noaudit@p8.org',
    role: 'secondary',
    ownerId: orgA_ownerId,
    churchId: churchA1,
    permissions: ['reports'],
    allowedChurchIds: [churchA1]
  }).token;

  // --- ETAPA 1: Sanitização Rigorosa de Dados Sensíveis ---
  console.log('--- ETAPA 1: Sanitização Rigorosa de Dados Sensíveis ---');
  const dirtyData = {
    user: 'tesoureiro',
    password: 'PlainTextPassword123!',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    jwt: 'eyJhbGciOi...',
    secret: 'super-client-secret',
    card_number: '4111111111111111',
    pix_key: 'financeiro@p8.org',
    amount: 5200.75,
    nested: {
      password_hash: '$2b$10$...',
      api_key: 'secret-key-abc',
      safe_note: 'Dízimo Dominical'
    }
  };

  const cleanData = sanitizeAuditData(dirtyData);
  assert(cleanData.password === '[REDACTED]', 'Campo password redigido');
  assert(cleanData.token === '[REDACTED]', 'Campo token redigido');
  assert(cleanData.jwt === '[REDACTED]', 'Campo jwt redigido');
  assert(cleanData.secret === '[REDACTED]', 'Campo secret redigido');
  assert(cleanData.card_number === '[REDACTED]', 'Campo card_number redigido');
  assert(cleanData.nested.password_hash === '[REDACTED]', 'Campo aninhado password_hash redigido');
  assert(cleanData.nested.api_key === '[REDACTED]', 'Campo aninhado api_key redigido');
  assert(cleanData.pix_key === 'financeiro@p8.org', 'Campo pix_key de negócio preservado');
  assert(cleanData.amount === 5200.75, 'Valor monetário numérico preservado');
  assert(cleanData.nested.safe_note === 'Dízimo Dominical', 'Nota de negócio preservada');

  // --- ETAPA 2: Rastreamento de Rede (IP e User-Agent) ---
  console.log('\n--- ETAPA 2: Rastreamento de Rede (IP e User-Agent) ---');
  const mockReqProxy: any = {
    headers: {
      'x-forwarded-for': '203.0.113.195, 10.0.0.1',
      'user-agent': 'IgGestorApp/3.0.0 (SecureClient)'
    }
  };
  const extractedIp = extractClientIp(mockReqProxy);
  const extractedUa = extractUserAgent(mockReqProxy);
  assert(extractedIp === '203.0.113.195', `IP extraído do primeiro salto do proxy x-forwarded-for: ${extractedIp}`);
  assert(extractedUa === 'IgGestorApp/3.0.0 (SecureClient)', `User-Agent capturado corretamente: ${extractedUa}`);

  // --- ETAPA 3: Auditoria em Chaves Pix Bancárias ---
  console.log('\n--- ETAPA 3: Auditoria em Chaves Pix Bancárias ---');
  const pixRes = await fetch(`${baseUrl}/api/v1/church-pix-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
      'X-Forwarded-For': '198.51.100.42',
      'User-Agent': 'PixManagerAuditTest/1.0'
    },
    body: JSON.stringify({
      bank_id: bankA1,
      church_id: churchA1,
      pix_type: 'cnpj',
      pix_key: `123456780001${Date.now().toString().slice(-2)}`,
      holder_name: 'Igreja P8 Matriz'
    })
  });

  assert(pixRes.status === 201, `Criação de chave Pix retornou HTTP 201 (Recebido: ${pixRes.status})`);
  const pixData = await pixRes.json();

  const auditPix = await queryAuditLogs(pool, {
    churchId: churchA1,
    entity: 'church_pix_keys',
    action: 'CREATE'
  });
  const foundPix = auditPix.logs.find(l => l.entity_id === pixData.id);
  assert(!!foundPix, 'Trilha audit_logs gravou evento CREATE de chave Pix');
  assert(foundPix?.ip_address === '198.51.100.42', `IP gravado no log: ${foundPix?.ip_address}`);
  assert(foundPix?.user_agent === 'PixManagerAuditTest/1.0', `User-Agent gravado no log: ${foundPix?.user_agent}`);

  // --- ETAPA 4: Auditoria de Transações em Lote (Bulk) ---
  console.log('\n--- ETAPA 4: Auditoria de Transações em Lote (Bulk) ---');
  const bTx1 = 'tx-p8-1-' + Date.now();
  const bTx2 = 'tx-p8-2-' + Date.now();

  const bulkTxRes = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      transactions: [
        {
          id: bTx1,
          amount: 1000.00,
          description: 'Doação P8 - Lote 1',
          type: 'credit',
          transaction_date: '2026-11-01',
          church_id: churchA1,
          bank_id: bankA1,
          source: 'manual'
        },
        {
          id: bTx2,
          amount: 2500.00,
          description: 'Doação P8 - Lote 2',
          type: 'credit',
          transaction_date: '2026-11-02',
          church_id: churchA1,
          bank_id: bankA1,
          source: 'manual'
        }
      ]
    })
  });

  assert(bulkTxRes.status === 201, `Lote de transações inserido com HTTP 201 (Recebido: ${bulkTxRes.status})`);

  const auditBulk = await queryAuditLogs(pool, {
    churchId: churchA1,
    entity: 'consolidated_transactions',
    action: 'CREATE'
  });
  const foundBulk = auditBulk.logs.find(l => l.entity_id === 'bulk_2_txs');
  assert(!!foundBulk, 'Trilha audit_logs gravou evento consolidado bulk_2_txs');
  assert(foundBulk?.metadata?.totalAmount === 3500.00, `Metadata consolidou montante exato de R$ 3.500,00`);
  assert(foundBulk?.metadata?.totalTransactions === 2, 'Metadata reflete 2 transações no lote');

  // --- ETAPA 5: Auditoria em Perfis / Membros ---
  console.log('\n--- ETAPA 5: Auditoria em Perfis / Membros ---');
  const newMemberId = 'mem-p8-' + Date.now();
  const profRes = await fetch(`${baseUrl}/api/v1/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      id: newMemberId,
      name: 'Tesoureiro Geral P8',
      email: `tesouraria-${Date.now()}@p8.org`,
      role: 'tesoureiro',
      congregation: churchA1,
      owner_id: orgA_ownerId
    })
  });

  assert(profRes.status === 200, `Criação de perfil retornou HTTP 200 (Recebido: ${profRes.status})`);

  const auditProf = await queryAuditLogs(pool, {
    churchId: churchA1,
    entity: 'profiles',
    action: 'CREATE'
  });
  const foundProf = auditProf.logs.find(l => l.entity_id === newMemberId);
  assert(!!foundProf, 'Trilha audit_logs gravou criação do perfil');
  assert(foundProf?.user_id === orgA_ownerId, 'Auditoria vinculada ao titular da organização');

  // --- ETAPA 6: Consulta Segura e Isolamento RBAC / Multi-Tenant em GET /audit-logs ---
  console.log('\n--- ETAPA 6: Consulta Segura e Isolamento RBAC / Multi-Tenant em GET /audit-logs ---');
  // 1. Acesso anônimo negado (HTTP 401)
  const anonRes = await fetch(`${baseUrl}/api/v1/audit-logs?church_id=${churchA1}`);
  assert(anonRes.status === 401, `Acesso anônimo a logs rejeitado com HTTP 401 (Recebido: ${anonRes.status})`);

  // 2. Secundário sem permissão 'audit' negado (HTTP 403)
  const noPermRes = await fetch(`${baseUrl}/api/v1/audit-logs?church_id=${churchA1}`, {
    headers: { 'Authorization': `Bearer ${secTokenNoAudit}` }
  });
  assert(noPermRes.status === 403, `Secundário sem permissão audit bloqueado com HTTP 403 (Recebido: ${noPermRes.status})`);

  // 3. Secundário tentando consultar congregação alheia (churchA2 não autorizada) (HTTP 403)
  const forbidChurchRes = await fetch(`${baseUrl}/api/v1/audit-logs?church_id=${churchA2}`, {
    headers: { 'Authorization': `Bearer ${secTokenWithAudit}` }
  });
  assert(forbidChurchRes.status === 403, `Secundário tentando acessar logs de congregação restrita bloqueado com HTTP 403 (Recebido: ${forbidChurchRes.status})`);

  // 4. Secundário com permissão consultando sua congregação autorizada (churchA1) (HTTP 200)
  const allowedSecRes = await fetch(`${baseUrl}/api/v1/audit-logs?church_id=${churchA1}`, {
    headers: { 'Authorization': `Bearer ${secTokenWithAudit}` }
  });
  assert(allowedSecRes.status === 200, `Secundário com permissão consultando congregação permitida aceito com HTTP 200 (Recebido: ${allowedSecRes.status})`);
  const allowedSecData = await allowedSecRes.json();
  assert(allowedSecData.total > 0 && Array.isArray(allowedSecData.logs), 'Logs retornados com sucesso para o usuário secundário autorizado');

  // --- ETAPA 7: Imutabilidade Estrita da Trilha ---
  console.log('\n--- ETAPA 7: Imutabilidade Estrita da Trilha ---');
  const deleteAuditRes = await fetch(`${baseUrl}/api/v1/audit-logs/qualquer-id`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert(deleteAuditRes.status === 404, `Tentativa de DELETE em audit-logs rejeitada com HTTP 404 (Recebido: ${deleteAuditRes.status})`);

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO DA HOMOLOGAÇÃO DO PILAR 8: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runConsolidationTests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
