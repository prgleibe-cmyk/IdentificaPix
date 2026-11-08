import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP09Subetapa2Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE PREVENÇÃO CONTRA BOLA/IDOR — OP-09 SUB-ETAPA 2');
  console.log('   ISOLAMENTO DE MUTAÇÕES DE TRANSAÇÕES CONSOLIDADAS ENTRE TENANTS');
  console.log('========================================================================\n');

  const ownerA = '11111111-1111-1111-1111-111111111111';
  const churchA = '11111111-0000-0000-0000-000000000001';
  const bankA = 'bank-tenant-a-01';

  const ownerB = '22222222-2222-2222-2222-222222222222';
  const churchB = '22222222-0000-0000-0000-000000000001';
  const bankB = 'bank-tenant-b-01';
  const secUserB = '22222222-3333-3333-3333-333333333333';

  // SQLite setup
  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  function cleanupDb() {
    try {
      db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-op09-%'").run();
      db.prepare("DELETE FROM churches WHERE id IN ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')").run();
      db.prepare("DELETE FROM banks WHERE id IN ('bank-tenant-a-01', 'bank-tenant-b-01')").run();
    } catch (_) {}
  }

  cleanupDb();

  // Inserir congregações dos dois tenants
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA, ownerA, 'Igreja Central Tenant A');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchB, ownerB, 'Igreja Central Tenant B');

  // Inserir bancos dos dois tenants
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankA, ownerA, 'Banco Bradesco Tenant A');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankB, ownerB, 'Banco Itaú Tenant B');

  // Inserir transações de teste
  // 1. txA_regular: Transação normal da Org A
  db.prepare(`
    INSERT INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, type, description, transaction_date, source, status, is_confirmed)
    VALUES ('test-op09-txA-regular', ?, ?, ?, 100.00, 'income', 'Dizimo Org A', '2026-11-01', 'manual', 'identified', 1)
  `).run(ownerA, churchA, bankA);

  // 2. txA_unallocated: Transação pendente da Org A (sem church_id, mas com user_id da Org A)
  db.prepare(`
    INSERT INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, type, description, transaction_date, source, status, is_confirmed)
    VALUES ('test-op09-txA-unalloc', ?, NULL, ?, 250.00, 'income', 'PIX Pendente Org A', '2026-11-02', 'file', 'pending', 0)
  `).run(ownerA, bankA);

  // 3. txA_null_user: Transação importada da Org A (com church_id, mas user_id NULL)
  db.prepare(`
    INSERT INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, type, description, transaction_date, source, status, is_confirmed)
    VALUES ('test-op09-txA-null-user', NULL, ?, ?, 320.00, 'income', 'Extrato Conciliado Org A', '2026-11-03', 'file', 'identified', 1)
  `).run(churchA, bankA);

  // 4. txA_bank_only: Transação importada sem identificação (user_id NULL e church_id NULL, mas bank_id pertence à Org A)
  db.prepare(`
    INSERT INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, type, description, transaction_date, source, status, is_confirmed)
    VALUES ('test-op09-txA-bank-only', NULL, NULL, ?, 450.00, 'income', 'Extrato Nao Identificado Org A', '2026-11-04', 'file', 'pending', 0)
  `).run(bankA);

  // 5. txB_regular: Transação normal da Org B
  db.prepare(`
    INSERT INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, type, description, transaction_date, source, status, is_confirmed)
    VALUES ('test-op09-txB-regular', ?, ?, ?, 600.00, 'income', 'Oferta Org B', '2026-11-05', 'manual', 'identified', 1)
  `).run(ownerB, churchB, bankB);

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
    allowedChurchIds: [churchB],
    allowedBankIds: [bankB]
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
    // CENÁRIO 1: Owner B tenta alterar transação da Org A (PUT)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 1: Ataque IDOR / PUT em transação regular de outra organização ---');
    const resPut1 = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-op09-txA-regular`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({ amount: 9999.00, description: 'Hackeado por Tenant B' })
    });
    assert(resPut1.status === 403, `Owner B recebe 403 Forbidden ao tentar alterar transação da Org A (Status retornado: ${resPut1.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 2: Owner B tenta deletar transação da Org A (DELETE)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Ataque IDOR / DELETE em transação regular de outra organização ---');
    const resDel1 = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-op09-txA-regular`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerB}` }
    });
    assert(resDel1.status === 403, `Owner B recebe 403 Forbidden ao tentar excluir transação da Org A (Status retornado: ${resDel1.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 3: Owner B tenta alterar transação com user_id NULL da Org A (antigo bypass !oldTx.user_id)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Ataque IDOR em transação com user_id NULL da Org A ---');
    const resPut2 = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-op09-txA-null-user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({ description: 'Tentativa de apropriação indevida' })
    });
    assert(resPut2.status === 403, `Owner B recebe 403 Forbidden mesmo quando user_id da transação é NULL (Status retornado: ${resPut2.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 4: Owner B tenta deletar transação com user_id NULL da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Ataque IDOR / DELETE em transação com user_id NULL da Org A ---');
    const resDel2 = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-op09-txA-null-user`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerB}` }
    });
    assert(resDel2.status === 403, `Owner B recebe 403 Forbidden ao tentar deletar transação importada da Org A (Status retornado: ${resDel2.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 5: Owner B tenta excluir transação pendente/sem congregação da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 5: Ataque IDOR em transação não alocada (church_id NULL) da Org A ---');
    const resDel3 = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-op09-txA-unalloc`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerB}` }
    });
    assert(resDel3.status === 403, `Owner B recebe 403 Forbidden ao tentar excluir transação não alocada da Org A (Status retornado: ${resDel3.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 6: Secundário B tenta excluir transação bancária da Org A (antigo bypass allowedChurchIds.length > 0)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 6: Ataque IDOR por Usuário Secundário em transação sem congregação ---');
    const resDelSec = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-op09-txA-bank-only`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenSecUserB}` }
    });
    assert(resDelSec.status === 403, `Usuário Secundário da Org B recebe 403 Forbidden ao tentar excluir extrato da Org A (Status retornado: ${resDelSec.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 7: Owner A tenta transferir transação para igreja da Org B (Reatribuição Cross-Tenant)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 7: Tentativa de reatribuição de congregação cross-tenant por PUT ---');
    const resCrossPut = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-op09-txA-regular`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({ church_id: churchB })
    });
    assert(resCrossPut.status === 403, `Owner A recebe 403 Forbidden ao tentar mover lançamento para congregação de outro tenant (Status retornado: ${resCrossPut.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 8: Owner B tenta bulk-delete com ID de transação da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 8: Ataque IDOR em bulk-delete contendo ID de outra organização ---');
    const resBulk1 = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({ ids: ['test-op09-txA-regular'] })
    });
    assert(resBulk1.status === 403, `Owner B recebe 403 Forbidden ao tentar bulk-delete com ID da Org A (Status retornado: ${resBulk1.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 9: Owner B tenta bulk-delete misto (ID próprio + ID da Org A) - Atomicidade
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 9: Ataque IDOR em bulk-delete misto (Transação própria + Alheia) ---');
    const resBulkMixed = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({ ids: ['test-op09-txB-regular', 'test-op09-txA-regular'] })
    });
    assert(resBulkMixed.status === 403, `Bulk-delete misto é rejeitado com 403 Forbidden (Status retornado: ${resBulkMixed.status})`);

    // Verificar se a transação do Owner B permaneceu intacta (aborto atômico)
    const checkTxB = db.prepare("SELECT id FROM consolidated_transactions WHERE id = 'test-op09-txB-regular'").get();
    assert(Boolean(checkTxB), `Transação legítima da Org B não foi deletada indevidamente após rejeição do lote misto`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 10: Operação Legítima - Owner A edita sua própria transação
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 10: Operação Legítima / PUT por Owner A em sua própria transação ---');
    const resPutLegit = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-op09-txA-regular`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({ description: 'Dizimo Org A Atualizado Legitimamente' })
    });
    assert(resPutLegit.status === 200, `Owner A atualiza sua própria transação com sucesso (Status: ${resPutLegit.status})`);
    const checkTxA = db.prepare("SELECT description FROM consolidated_transactions WHERE id = 'test-op09-txA-regular'").get() as any;
    assert(checkTxA?.description === 'Dizimo Org A Atualizado Legitimamente', `Descrição da transação foi devidamente persistida`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 11: Operação Legítima - Owner A deleta sua própria transação não alocada
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 11: Operação Legítima / DELETE por Owner A em sua transação ---');
    const resDelLegit = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-op09-txA-unalloc`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerA}` }
    });
    assert(resDelLegit.status === 200, `Owner A deleta com sucesso sua própria transação não alocada (Status: ${resDelLegit.status})`);
    const checkDeleted = db.prepare("SELECT id FROM consolidated_transactions WHERE id = 'test-op09-txA-unalloc'").get();
    assert(!checkDeleted, `Transação foi removida com sucesso do banco de dados`);

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO DA SUB-ETAPA 2: ${passed} passaram, ${failed} falharam.`);
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

runOP09Subetapa2Tests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
