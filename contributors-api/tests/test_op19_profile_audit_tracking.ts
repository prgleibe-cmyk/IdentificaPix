import http from 'http';
import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import { queryAuditLogs } from '../services/audit.service.js';

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
  console.log('🧪 BATERIA DE TESTES — OP-19 (SUB-ETAPA 8.3)');
  console.log('   RASTREAMENTO DE AUDITORIA EM MEMBROS E PERFIS (profiles)');
  console.log('========================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const orgOwnerId = 'owner-prof-audit-' + Date.now();
  const churchId = '00000000-0000-4000-c000-000000000003';

  // Seed baseline
  await pool.query(
    'INSERT OR REPLACE INTO churches (id, name, user_id) VALUES ($1, $2, $3)',
    [churchId, 'Congregação Alpha', orgOwnerId]
  );

  const ownerToken = generateAccessToken({
    userId: orgOwnerId,
    email: 'admin@alpha.org',
    role: 'owner',
    ownerId: orgOwnerId,
    churchId: churchId,
    allowedChurchIds: [churchId]
  }).token;

  // --- CENÁRIO 1: Auditoria em POST /api/v1/profiles (CREATE) ---
  console.log('--- CENÁRIO 1: Auditoria em POST /api/v1/profiles (CREATE) ---');
  const memberId = 'mem-' + Date.now();
  const createProfileRes = await fetch(`${baseUrl}/api/v1/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      id: memberId,
      name: 'Operador Financeiro Alpha',
      email: `operador-${Date.now()}@alpha.org`,
      role: 'tesoureiro',
      congregation: churchId,
      owner_id: orgOwnerId
    })
  });

  assert(createProfileRes.status === 200, `POST /profiles retornou HTTP 200 (Recebido: ${createProfileRes.status})`);

  const auditCreate = await queryAuditLogs(pool, {
    churchId: churchId,
    entity: 'profiles',
    action: 'CREATE'
  });

  const foundCreateLog = auditCreate.logs.find(l => l.entity_id === memberId);
  assert(!!foundCreateLog, 'Evento CREATE de profiles registrado na tabela audit_logs');
  assert(foundCreateLog?.action === 'CREATE', 'Ação registrada como CREATE');
  assert(foundCreateLog?.user_id === orgOwnerId, 'user_id gravado com a identidade do titular');
  assert(foundCreateLog?.new_values?.role === 'tesoureiro', 'new_values reflete o cargo atribuído');

  // --- CENÁRIO 2: Auditoria em PUT /api/v1/profiles/:id (UPDATE) ---
  console.log('\n--- CENÁRIO 2: Auditoria em PUT /api/v1/profiles/:id (UPDATE) ---');
  const updateProfileRes = await fetch(`${baseUrl}/api/v1/profiles/${memberId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      name: 'Operador Financeiro Alpha - Promovido',
      role: 'coordenador_financeiro'
    })
  });

  assert(updateProfileRes.status === 200, `PUT /profiles retornou HTTP 200 (Recebido: ${updateProfileRes.status})`);

  const auditUpdate = await queryAuditLogs(pool, {
    churchId: churchId,
    entity: 'profiles',
    action: 'UPDATE'
  });

  const foundUpdateLog = auditUpdate.logs.find(l => l.entity_id === memberId);
  assert(!!foundUpdateLog, 'Evento UPDATE de profiles registrado na tabela audit_logs');
  assert(foundUpdateLog?.old_values?.role === 'tesoureiro', 'old_values reflete o cargo anterior');
  assert(foundUpdateLog?.new_values?.role === 'coordenador_financeiro', 'new_values reflete o novo cargo promovido');

  // --- CENÁRIO 3: Auditoria em DELETE /api/v1/profiles/:id (DELETE) ---
  console.log('\n--- CENÁRIO 3: Auditoria em DELETE /api/v1/profiles/:id (DELETE) ---');
  const deleteProfileRes = await fetch(`${baseUrl}/api/v1/profiles/${memberId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ownerToken}`
    }
  });

  assert(deleteProfileRes.status === 200, `DELETE /profiles retornou HTTP 200 (Recebido: ${deleteProfileRes.status})`);

  const auditDelete = await queryAuditLogs(pool, {
    churchId: churchId,
    entity: 'profiles',
    action: 'DELETE'
  });

  const foundDeleteLog = auditDelete.logs.find(l => l.entity_id === memberId);
  assert(!!foundDeleteLog, 'Evento DELETE de profiles registrado na tabela audit_logs');
  assert(foundDeleteLog?.old_values?.name === 'Operador Financeiro Alpha - Promovido', 'old_values preserva o histórico do perfil removido');

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO DA SUB-ETAPA 8.3: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
