import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP09Subetapa3Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE PREVENÇÃO CONTRA BOLA/IDOR — OP-09 SUB-ETAPA 3');
  console.log('   ISOLAMENTO DE MUTAÇÕES DE REGISTROS FINANCEIROS ENTRE TENANTS');
  console.log('========================================================================\n');

  const ownerA = '11111111-1111-1111-1111-111111111111';
  const churchA = '11111111-0000-0000-0000-000000000001';

  const ownerB = '22222222-2222-2222-2222-222222222222';
  const churchB = '22222222-0000-0000-0000-000000000001';
  const secUserB = '22222222-3333-3333-3333-333333333333';

  // SQLite setup
  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  function cleanupDb() {
    try {
      db.prepare("DELETE FROM financial_records WHERE id LIKE 'test-op09-rec%'").run();
      db.prepare("DELETE FROM churches WHERE id IN ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')").run();
    } catch (_) {}
  }

  cleanupDb();

  // Inserir congregações dos dois tenants
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA, ownerA, 'Igreja Central Tenant A');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchB, ownerB, 'Igreja Central Tenant B');

  // Inserir registros financeiros de teste
  // 1. recA_regular: Registro normal da Org A
  db.prepare(`
    INSERT INTO financial_records (id, user_id, church_id, title, amount, type, status, payment_date)
    VALUES ('test-op09-recA-regular', ?, ?, 'Conta de Luz Org A', 350.00, 'expense', 'pending', '2026-11-10')
  `).run(ownerA, churchA);

  // 2. recA_unallocated: Registro sem congregação (church_id NULL) da Org A
  db.prepare(`
    INSERT INTO financial_records (id, user_id, church_id, title, amount, type, status, payment_date)
    VALUES ('test-op09-recA-unalloc', ?, NULL, 'Despesa Geral Org A', 150.00, 'expense', 'pending', '2026-11-11')
  `).run(ownerA);

  // 3. rec_orphan: Registro órfão legado (user_id NULL e church_id NULL)
  db.prepare(`
    INSERT INTO financial_records (id, user_id, church_id, title, amount, type, status, payment_date)
    VALUES ('test-op09-rec-orphan', NULL, NULL, 'Registro Sem Dono', 99.00, 'expense', 'pending', '2026-11-12')
  `).run();

  // 4. recB_regular: Registro normal da Org B
  db.prepare(`
    INSERT INTO financial_records (id, user_id, church_id, title, amount, type, status, payment_date)
    VALUES ('test-op09-recB-regular', ?, ?, 'Manutenção Org B', 200.00, 'expense', 'pending', '2026-11-13')
  `).run(ownerB, churchB);

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

  const tokenSecUserB = generateAccessToken({
    userId: secUserB,
    email: 'secB@test.com',
    ownerId: ownerB,
    role: 'secondary',
    permissions: ['view', 'edit'],
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
    // CENÁRIO 1: Owner B tenta alterar financial_record da Org A (PUT)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 1: Ataque IDOR / PUT em registro financeiro da Org A ---');
    const resPut1 = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-recA-regular`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({ amount: 9999.00, title: 'Hackeado por Tenant B' })
    });
    assert(resPut1.status === 403, `Owner B recebe 403 Forbidden ao tentar alterar financial_record da Org A (Status retornado: ${resPut1.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 2: Owner B tenta deletar financial_record da Org A (DELETE)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Ataque IDOR / DELETE em registro financeiro da Org A ---');
    const resDel1 = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-recA-regular`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerB}` }
    });
    assert(resDel1.status === 403, `Owner B recebe 403 Forbidden ao tentar excluir financial_record da Org A (Status retornado: ${resDel1.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 3: Owner B tenta alterar financial_record sem congregação (church_id NULL) da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Ataque IDOR em registro sem congregação da Org A ---');
    const resPut2 = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-recA-unalloc`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({ title: 'Tentativa de apropriação indevida' })
    });
    assert(resPut2.status === 403, `Owner B recebe 403 Forbidden ao tentar alterar registro sem congregação da Org A (Status retornado: ${resPut2.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 4: Owner B tenta deletar financial_record sem congregação da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Ataque IDOR / DELETE em registro sem congregação da Org A ---');
    const resDel2 = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-recA-unalloc`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerB}` }
    });
    assert(resDel2.status === 403, `Owner B recebe 403 Forbidden ao tentar deletar registro sem congregação da Org A (Status retornado: ${resDel2.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 5: Owner B tenta alterar registro órfão legado (antigo bypass !user_id && !church_id)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 5: Ataque IDOR em registro órfão legado (sem dono e sem congregação) ---');
    const resPutOrphan = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-rec-orphan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({ title: 'Apropriação de Órfão' })
    });
    assert(resPutOrphan.status === 403, `Owner B recebe 403 Forbidden ao tentar alterar registro órfão (Status retornado: ${resPutOrphan.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 6: Owner B tenta deletar registro órfão legado
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 6: Ataque IDOR / DELETE em registro órfão legado ---');
    const resDelOrphan = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-rec-orphan`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerB}` }
    });
    assert(resDelOrphan.status === 403, `Owner B recebe 403 Forbidden ao tentar excluir registro órfão (Status retornado: ${resDelOrphan.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 7: Secundário B tenta alterar registro da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 7: Ataque IDOR por Usuário Secundário da Org B em registro da Org A ---');
    const resPutSec = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-recA-regular`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecUserB}`
      },
      body: JSON.stringify({ amount: 1.00 })
    });
    assert(resPutSec.status === 403, `Usuário Secundário recebe 403 Forbidden ao tentar editar registro da Org A (Status retornado: ${resPutSec.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 8: Secundário B tenta transferir seu próprio registro para congregação da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 8: Tentativa de escalação de congregação por Secundário (destino não autorizado) ---');
    const resCrossSec = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-recB-regular`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecUserB}`
      },
      body: JSON.stringify({ church_id: churchA })
    });
    assert(resCrossSec.status === 403, `Usuário Secundário recebe 403 Forbidden ao tentar atribuir congregação não autorizada (Status retornado: ${resCrossSec.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 9: Owner A tenta transferir seu registro para congregação da Org B (Reatribuição Cross-Tenant)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 9: Tentativa de reatribuição de congregação cross-tenant por Owner A ---');
    const resCrossOwner = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-recA-regular`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({ church_id: churchB })
    });
    assert(resCrossOwner.status === 403, `Owner A recebe 403 Forbidden ao tentar mover registro financeiro para congregação de outro tenant (Status retornado: ${resCrossOwner.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 10: Operação Legítima - Owner A edita seu próprio registro financeiro
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 10: Operação Legítima / PUT por Owner A em seu próprio registro ---');
    const resPutLegit = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-recA-regular`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({ title: 'Conta de Luz Org A Atualizada', amount: 375.50 })
    });
    assert(resPutLegit.status === 200, `Owner A atualiza seu próprio registro financeiro com sucesso (Status: ${resPutLegit.status})`);
    const checkRecA = db.prepare("SELECT title, amount FROM financial_records WHERE id = 'test-op09-recA-regular'").get() as any;
    assert(checkRecA?.title === 'Conta de Luz Org A Atualizada' && checkRecA?.amount === 375.5, `Título e valor foram persistidos corretamente`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 11: Operação Legítima - Owner A deleta seu registro não alocado
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 11: Operação Legítima / DELETE por Owner A em seu registro ---');
    const resDelLegit = await fetch(`${baseUrl}/api/v1/financial_records/test-op09-recA-unalloc`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerA}` }
    });
    assert(resDelLegit.status === 200, `Owner A deleta com sucesso seu registro não alocado (Status: ${resDelLegit.status})`);
    const checkDeleted = db.prepare("SELECT id FROM financial_records WHERE id = 'test-op09-recA-unalloc'").get();
    assert(!checkDeleted, `Registro financeiro foi devidamente removido do banco de dados`);

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO DA SUB-ETAPA 3: ${passed} passaram, ${failed} falharam.`);
    console.log('========================================================================\n');

    cleanupDb();
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    cleanupDb();
    server.close();
  }
}

runOP09Subetapa3Tests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
