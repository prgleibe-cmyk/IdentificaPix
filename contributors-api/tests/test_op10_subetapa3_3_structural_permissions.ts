import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP10Subetapa33Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE MATRIZ DE PERMISSÕES — OP-10 SUB-ETAPA 3.3');
  console.log('   BLINDAGEM ESTRUTURAL DE BANCOS, CONGREGAÇÕES E AUDITORIA');
  console.log('========================================================================\n');

  const ownerA = '11111111-1111-1111-1111-111111111111';
  const churchA = '11111111-0000-0000-0000-000000000001';
  const bankA = 'bank-perm-a-01';

  const ownerB = '22222222-2222-2222-2222-222222222222';
  const churchB = '22222222-0000-0000-0000-000000000001';
  const bankB = 'bank-perm-b-01';

  const secUserNoAdmin = '22222222-3333-3333-3333-333333333333';
  const secUserWithAdmin = '22222222-4444-4444-4444-444444444444';
  const secUserWithAudit = '22222222-5555-5555-5555-555555555555';

  // SQLite setup
  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  function cleanupDb() {
    try {
      db.prepare("DELETE FROM churches WHERE id IN ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'test-ch-sec-admin', 'test-ch-owner-a')").run();
      db.prepare("DELETE FROM banks WHERE id IN ('bank-perm-a-01', 'bank-perm-b-01', 'bank-sec-admin-01', 'bank-owner-a-01')").run();
    } catch (_) {}
  }

  cleanupDb();

  // Inserir congregações
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA, ownerA, 'Igreja Tenant A');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchB, ownerB, 'Igreja Tenant B');

  // Inserir bancos
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankA, ownerA, 'Banco Org A');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankB, ownerB, 'Banco Org B');

  // Inserir registro de auditoria para teste
  try {
    db.prepare(`
      INSERT OR REPLACE INTO audit_logs (id, church_id, user_id, action, entity, entity_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run('audit-test-01', churchB, ownerB, 'UPDATE', 'banks', bankB);
  } catch (_) {}

  // Tokens JWT
  const tokenOwnerA = generateAccessToken({
    userId: ownerA,
    email: 'ownerA@test.com',
    ownerId: ownerA,
    role: 'owner',
    permissions: ['all'],
    churchId: churchA,
    allowedChurchIds: [churchA]
  }).token;

  const tokenOwnerB = generateAccessToken({
    userId: ownerB,
    email: 'ownerB@test.com',
    ownerId: ownerB,
    role: 'owner',
    permissions: ['all'],
    churchId: churchB,
    allowedChurchIds: [churchB]
  }).token;

  const tokenSecNoAdmin = generateAccessToken({
    userId: secUserNoAdmin,
    email: 'sec-noadmin@test.com',
    ownerId: ownerB,
    role: 'secondary',
    permissions: ['view', 'edit'], // Não tem admin nem audit
    churchId: churchB,
    allowedChurchIds: [churchB]
  }).token;

  const tokenSecWithAdmin = generateAccessToken({
    userId: secUserWithAdmin,
    email: 'sec-admin@test.com',
    ownerId: ownerB,
    role: 'secondary',
    permissions: ['admin'], // Tem admin
    churchId: churchB,
    allowedChurchIds: [churchB]
  }).token;

  const tokenSecWithAudit = generateAccessToken({
    userId: secUserWithAudit,
    email: 'sec-audit@test.com',
    ownerId: ownerB,
    role: 'secondary',
    permissions: ['view', 'audit'], // Tem audit
    churchId: churchB,
    allowedChurchIds: [churchB]
  }).token;

  // Server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

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

  try {
    // ---------------------------------------------------------------------------------
    // CENÁRIO 1: Usuário Secundário SEM admin tentando gerenciar Bancos
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 1: Bloqueio de Usuário Secundário SEM "admin" em Bancos ---');

    // 1.1 POST /api/v1/banks
    const resPostBankSec = await fetch(`${baseUrl}/api/v1/banks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecNoAdmin}`
      },
      body: JSON.stringify({
        name: 'Banco Tentativa Secundário',
        bank_key: '999'
      })
    });
    assert(
      resPostBankSec.status === 403,
      `POST /api/v1/banks bloqueado com 403 Forbidden para secundário sem "admin" (status: ${resPostBankSec.status})`
    );

    // 1.2 PUT /api/v1/banks/:id
    const resPutBankSec = await fetch(`${baseUrl}/api/v1/banks/${bankB}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecNoAdmin}`
      },
      body: JSON.stringify({
        name: 'Banco Org B Modificado por Secundário'
      })
    });
    assert(
      resPutBankSec.status === 403,
      `PUT /api/v1/banks/${bankB} bloqueado com 403 Forbidden para secundário sem "admin" (status: ${resPutBankSec.status})`
    );

    // 1.3 DELETE /api/v1/banks/:id
    const resDelBankSec = await fetch(`${baseUrl}/api/v1/banks/${bankB}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenSecNoAdmin}`
      }
    });
    assert(
      resDelBankSec.status === 403,
      `DELETE /api/v1/banks/${bankB} bloqueado com 403 Forbidden para secundário sem "admin" (status: ${resDelBankSec.status})`
    );

    // ---------------------------------------------------------------------------------
    // CENÁRIO 2: Usuário Secundário SEM admin tentando gerenciar Congregações
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Bloqueio de Usuário Secundário SEM "admin" em Congregações ---');

    // 2.1 POST /api/v1/churches
    const resPostChurchSec = await fetch(`${baseUrl}/api/v1/churches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecNoAdmin}`
      },
      body: JSON.stringify({
        name: 'Congregação Secundária Fake',
        user_id: ownerB
      })
    });
    assert(
      resPostChurchSec.status === 403,
      `POST /api/v1/churches bloqueado com 403 Forbidden para secundário sem "admin" (status: ${resPostChurchSec.status})`
    );

    // 2.2 PUT /api/v1/churches/:id
    const resPutChurchSec = await fetch(`${baseUrl}/api/v1/churches/${churchB}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecNoAdmin}`
      },
      body: JSON.stringify({
        name: 'Nome de Igreja Alterado por Secundário'
      })
    });
    assert(
      resPutChurchSec.status === 403,
      `PUT /api/v1/churches/${churchB} bloqueado com 403 Forbidden para secundário sem "admin" (status: ${resPutChurchSec.status})`
    );

    // 2.3 DELETE /api/v1/churches/:id
    const resDelChurchSec = await fetch(`${baseUrl}/api/v1/churches/${churchB}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenSecNoAdmin}`
      }
    });
    assert(
      resDelChurchSec.status === 403,
      `DELETE /api/v1/churches/${churchB} bloqueado com 403 Forbidden para secundário sem "admin" (status: ${resDelChurchSec.status})`
    );

    // ---------------------------------------------------------------------------------
    // CENÁRIO 3: Blindagem Cross-Tenant e Autenticação em DELETE /churches/:id
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Blindagem de DELETE /churches/:id contra IDOR e Unauthenticated ---');

    // 3.1 DELETE sem autenticação
    const resDelNoAuth = await fetch(`${baseUrl}/api/v1/churches/${churchB}`, {
      method: 'DELETE'
    });
    assert(
      resDelNoAuth.status === 401,
      `DELETE /api/v1/churches/${churchB} sem token bloqueado com 401 Unauthorized (status: ${resDelNoAuth.status})`
    );

    // 3.2 Owner A tentando deletar Igreja do Owner B (Cross-Tenant Attack)
    const resDelCrossTenant = await fetch(`${baseUrl}/api/v1/churches/${churchB}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`
      }
    });
    assert(
      resDelCrossTenant.status === 403,
      `DELETE /api/v1/churches da Org B pelo Owner A bloqueado com 403 Forbidden (status: ${resDelCrossTenant.status})`
    );

    // ---------------------------------------------------------------------------------
    // CENÁRIO 4: Permissão de Auditoria em GET /api/v1/audit-logs
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Validação de Permissão em GET /api/v1/audit-logs ---');

    // 4.1 Secundário sem 'audit' tentando ler logs
    const resAuditNoPerm = await fetch(`${baseUrl}/api/v1/audit-logs?church_id=${churchB}`, {
      headers: {
        Authorization: `Bearer ${tokenSecNoAdmin}`
      }
    });
    assert(
      resAuditNoPerm.status === 403,
      `GET /api/v1/audit-logs bloqueado com 403 Forbidden para secundário sem "audit" (status: ${resAuditNoPerm.status})`
    );

    // 4.2 Secundário com 'audit' lendo logs da sua igreja permitida
    const resAuditWithPerm = await fetch(`${baseUrl}/api/v1/audit-logs?church_id=${churchB}`, {
      headers: {
        Authorization: `Bearer ${tokenSecWithAudit}`
      }
    });
    assert(
      resAuditWithPerm.status === 200,
      `GET /api/v1/audit-logs permitido com 200 OK para secundário COM permissão "audit" (status: ${resAuditWithPerm.status})`
    );

    // ---------------------------------------------------------------------------------
    // CENÁRIO 5: Titular (Owner) e Secundário COM 'admin' Gerenciando Estruturas
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 5: Operações Permitidas para Owner e Secundário com "admin" ---');

    // 5.1 Owner B criando Banco
    const resPostBankOwner = await fetch(`${baseUrl}/api/v1/banks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({
        id: 'bank-owner-a-01',
        name: 'Banco Criado Pelo Owner B',
        user_id: ownerB
      })
    });
    assert(
      resPostBankOwner.status === 201,
      `POST /api/v1/banks pelo Owner autorizado com 201 Created (status: ${resPostBankOwner.status})`
    );

    // 5.2 Secundário COM 'admin' atualizando Banco da mesma organização
    const resPutBankSecAdmin = await fetch(`${baseUrl}/api/v1/banks/${bankB}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecWithAdmin}`
      },
      body: JSON.stringify({
        name: 'Banco Org B Atualizado por Secundário Admin'
      })
    });
    assert(
      resPutBankSecAdmin.status === 200,
      `PUT /api/v1/banks pelo secundário com "admin" autorizado com 200 OK (status: ${resPutBankSecAdmin.status})`
    );

    // 5.3 Owner B criando congregação
    const resPostChurchOwner = await fetch(`${baseUrl}/api/v1/churches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({
        name: 'Nova Congregação Owner B',
        user_id: ownerB
      })
    });
    assert(
      resPostChurchOwner.status === 201,
      `POST /api/v1/churches pelo Owner autorizado com 201 Created (status: ${resPostChurchOwner.status})`
    );
    const createdChurchId = (await resPostChurchOwner.json()).id;

    // 5.4 Secundário COM 'admin' atualizando congregação
    const resPutChurchAdmin = await fetch(`${baseUrl}/api/v1/churches/${createdChurchId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecWithAdmin}`
      },
      body: JSON.stringify({
        name: 'Congregação Atualizada por Secundário Admin'
      })
    });
    assert(
      resPutChurchAdmin.status === 200,
      `PUT /api/v1/churches pelo secundário com "admin" autorizado com 200 OK (status: ${resPutChurchAdmin.status})`
    );

    // 5.5 Owner B deletando congregação criada
    const resDelChurchOwner = await fetch(`${baseUrl}/api/v1/churches/${createdChurchId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenOwnerB}`
      }
    });
    assert(
      resDelChurchOwner.status === 200,
      `DELETE /api/v1/churches pelo Owner autorizado com 200 OK (status: ${resDelChurchOwner.status})`
    );

  } finally {
    server.close();
    cleanupDb();
  }

  console.log('\n========================================================================');
  console.log(`📊 RESUMO DA SUB-ETAPA 3.3: ${passed} passaram, ${failed} falharam.`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOP10Subetapa33Tests().catch((err) => {
  console.error('Erro fatal executando testes:', err);
  process.exit(1);
});
