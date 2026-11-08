process.env.NODE_ENV = 'test';
process.env.INTEGRATED_MODE = 'true';

import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runAuditAuthTests() {
  console.log('================================================================');
  console.log('🧪 BATERIA DE TESTES DE AUTORIZAÇÃO DA ROTA GET /api/v1/audit-logs');
  console.log('   (INCLUINDO REFINAMENTO CIRÚRGICO 5.1 - FALLBACK DE TITULARIDADE)');
  console.log('================================================================\n');

  // Test data identifiers mapped to existing pristine organization (Read-Only)
  const ownerA_id = '00000000-0000-0000-0000-000000000001';
  const churchA_id = '00000000-0000-0000-0000-000000000001'; // Pertence ao Titular A (sede legada onde church.id = ownerId)
  const churchA2_id = 'church-allowed-extra-uuid';
  const churchB_id = '00000000-0000-0000-0000-000000000099'; // Não pertence ao Titular A
  const ownerB_id = 'owner-b-alien-uuid';
  const secUser_id = 'secondary-user-operator-uuid';
  const superAdmin_id = 'superadmin-user-uuid';

  // Seed secondary user in app_users linked to ownerA to ensure secUser_id is in ownerUserIds
  try {
    const sqlitePath = 'data/contributors_local.sqlite';
    const db = new DatabaseSync(sqlitePath);
    db.function('now', () => new Date().toISOString());
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        email TEXT,
        owner_id TEXT,
        role TEXT DEFAULT 'user'
      );
    `);
    db.prepare('INSERT OR REPLACE INTO app_users (id, email, owner_id, role) VALUES (?, ?, ?, ?)').run(
      secUser_id,
      'operador.teste@igreja.com',
      ownerA_id,
      'secondary'
    );
    db.close();
  } catch (e: any) {
    console.warn('[SEED WARNING]', e.message);
  }

  // Start ephemeral server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  console.log(`[TEST SERVER] Servidor de teste ouvindo em ${baseUrl}`);

  // Generate tokens
  const tokenOwnerA = generateAccessToken({
    userId: ownerA_id,
    ownerId: ownerA_id,
    role: 'owner',
    permissions: ['all']
  }).token;

  const tokenOwnerB = generateAccessToken({
    userId: ownerB_id,
    ownerId: ownerB_id,
    role: 'owner',
    permissions: ['all']
  }).token;

  const tokenSecondary = generateAccessToken({
    userId: secUser_id,
    ownerId: ownerA_id,
    role: 'secondary',
    permissions: ['view_financial'],
    allowedChurchIds: [churchA_id, churchA2_id]
  }).token;

  const tokenSuperAdmin = generateAccessToken({
    userId: superAdmin_id,
    role: 'superadmin',
    permissions: ['all']
  }).token;

  let passedCount = 0;
  let failedCount = 0;

  async function testScenario(num: number, desc: string, url: string, headers: Record<string, string>, expectedStatus: number, checkBody?: (b: any) => boolean) {
    process.stdout.write(`[CENÁRIO ${num}] ${desc}... `);
    try {
      const res = await fetch(`${baseUrl}${url}`, {
        method: 'GET',
        headers
      });
      const statusOk = res.status === expectedStatus;
      let bodyOk = true;
      let body: any = null;
      try {
        body = await res.json();
      } catch (_) {}

      if (checkBody && body) {
        bodyOk = checkBody(body);
      }

      if (statusOk && bodyOk) {
        console.log(`✅ PASSOU (HTTP ${res.status})`);
        passedCount++;
        return true;
      } else {
        console.log(`❌ FALHOU (Esperado: ${expectedStatus}, Recebido: ${res.status})`, body);
        failedCount++;
        return false;
      }
    } catch (err: any) {
      console.log(`❌ ERRO: ${err.message}`);
      failedCount++;
      return false;
    }
  }

  // 1. Anônimo sem church_id -> 401
  await testScenario(
    1,
    'Anônimo sem church_id',
    '/api/v1/audit-logs',
    {},
    401,
    (b) => b.error === 'UNAUTHORIZED'
  );

  // 2. Anônimo com church_id válido -> 401
  await testScenario(
    2,
    'Anônimo com church_id válido',
    `/api/v1/audit-logs?church_id=${churchA_id}`,
    {},
    401,
    (b) => b.error === 'UNAUTHORIZED'
  );

  // 3. Titular consultando sua própria congregação (sede legada com churches.id = ownerId) -> 200
  await testScenario(
    3,
    'Titular consultando sua própria congregação (fallback legado com church.id = ownerId)',
    `/api/v1/audit-logs?church_id=${churchA_id}`,
    { Authorization: `Bearer ${tokenOwnerA}` },
    200,
    (b) => Array.isArray(b.logs) && typeof b.total === 'number'
  );

  // 4. Titular A consultando congregação que não lhe pertence (ou Titular B consultando igreja A) -> 403
  await testScenario(
    4,
    'Titular A consultando congregação de outro titular (Cross-Tenant)',
    `/api/v1/audit-logs?church_id=${churchB_id}`,
    { Authorization: `Bearer ${tokenOwnerA}` },
    403,
    (b) => b.error === 'FORBIDDEN'
  );

  // 5. Secundário consultando sua primeira congregação permitida -> 200
  await testScenario(
    5,
    'Secundário consultando sua 1ª congregação permitida',
    `/api/v1/audit-logs?church_id=${churchA_id}`,
    { Authorization: `Bearer ${tokenSecondary}` },
    200,
    (b) => Array.isArray(b.logs)
  );

  // 6. Secundário consultando outra congregação também permitida -> 200
  await testScenario(
    6,
    'Secundário consultando sua 2ª congregação permitida',
    `/api/v1/audit-logs?church_id=${churchA2_id}`,
    { Authorization: `Bearer ${tokenSecondary}` },
    200,
    (b) => Array.isArray(b.logs)
  );

  // 7. Secundário consultando congregação não autorizada -> 403
  await testScenario(
    7,
    'Secundário consultando congregação não autorizada',
    `/api/v1/audit-logs?church_id=${churchB_id}`,
    { Authorization: `Bearer ${tokenSecondary}` },
    403,
    (b) => b.error === 'FORBIDDEN'
  );

  // 8. Superadministrador autenticado -> 200
  await testScenario(
    8,
    'Superadministrador autenticado consultando qualquer congregação',
    `/api/v1/audit-logs?church_id=${churchB_id}`,
    { Authorization: `Bearer ${tokenSuperAdmin}` },
    200,
    (b) => Array.isArray(b.logs)
  );

  // 9. Tentativa de ampliar acesso via x-church-id -> Negada (sem token)
  await testScenario(
    9,
    'Tentativa de burlar autenticação via header x-church-id',
    `/api/v1/audit-logs`,
    { 'x-church-id': churchA_id },
    401,
    (b) => b.error === 'UNAUTHORIZED'
  );

  // 10. church_id malformado ou ambíguo -> 400
  await testScenario(
    10,
    'church_id malformado (múltiplos parâmetros/array ambíguo)',
    `/api/v1/audit-logs?church_id=${churchA_id}&church_id=${churchB_id}`,
    { Authorization: `Bearer ${tokenOwnerA}` },
    400,
    (b) => b.error === 'BAD_REQUEST'
  );

  // 11. Preservação de filtros adicionais (entity, action, limit, offset)
  await testScenario(
    11,
    'Preservação de filtros adicionais (entity, action, limit, offset)',
    `/api/v1/audit-logs?church_id=${churchA_id}&entity=financial_records&action=CREATE&limit=10&offset=0`,
    { Authorization: `Bearer ${tokenOwnerA}` },
    200,
    (b) => Array.isArray(b.logs)
  );

  // 12. 🛡️ [REFINAMENTO 5.1]: Titular A solicita o próprio UUID de seu usuário secundário vinculado como church_id -> 403
  await testScenario(
    12,
    'Titular A solicita UUID de seu operador secundário vinculado como church_id (Não é congregação)',
    `/api/v1/audit-logs?church_id=${secUser_id}`,
    { Authorization: `Bearer ${tokenOwnerA}` },
    403,
    (b) => b.error === 'FORBIDDEN' && b.message.includes('não pertence à sua organização')
  );

  console.log(`\n================================================================`);
  console.log(`TOTAL: ${passedCount + failedCount} cenários | APROVADOS: ${passedCount} | FALHAS: ${failedCount}`);
  console.log(`================================================================\n`);

  // Cleanup test user
  try {
    const sqlitePath = 'data/contributors_local.sqlite';
    const db = new DatabaseSync(sqlitePath);
    db.prepare('DELETE FROM app_users WHERE id = ?').run(secUser_id);
    db.close();
  } catch (_) {}

  server.close();

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAuditAuthTests().catch((e) => {
  console.error('ERRO FATAL NA EXECUÇÃO:', e);
  process.exit(1);
});
