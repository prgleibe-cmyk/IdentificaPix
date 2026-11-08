import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP09Subetapa4Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE PREVENÇÃO CONTRA BOLA/IDOR — OP-09 SUB-ETAPA 4');
  console.log('   BLINDAGEM CONTRA INJEÇÃO DE CONGREGAÇÃO DE TERCEIROS NA CRIAÇÃO');
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
      db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-op09-sub4-%'").run();
      db.prepare("DELETE FROM financial_records WHERE id LIKE 'test-op09-sub4-%'").run();
      db.prepare("DELETE FROM churches WHERE id IN ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')").run();
      db.prepare("DELETE FROM banks WHERE id IN ('bank-tenant-a-01', 'bank-tenant-b-01')").run();
    } catch (_) {}
  }

  cleanupDb();

  // Inserir congregações dos dois tenants
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA, ownerA, 'Igreja Central Tenant A');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchB, ownerB, 'Igreja Central Tenant B');

  // Inserir bancos
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankA, ownerA, 'Banco A');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankB, ownerB, 'Banco B');

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
    // CENÁRIO 1: Owner B tenta criar transação avulsa apontando para church_id da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 1: Tentativa de injeção de church_id de terceiro no POST /consolidated_transactions ---');
    const resPostTx1 = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({
        id: 'test-op09-sub4-tx-fake1',
        amount: 500.00,
        description: 'Injeção Cross-Tenant',
        type: 'income',
        church_id: churchA,
        transaction_date: '2026-11-15'
      })
    });
    assert(resPostTx1.status === 403, `Owner B recebe 403 Forbidden ao tentar cadastrar transação em igreja de outra organização (Status: ${resPostTx1.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 2: Secundário B tenta criar transação avulsa com church_id da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Tentativa de criação por Secundário com congregação alheia ---');
    const resPostTx2 = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecUserB}`
      },
      body: JSON.stringify({
        id: 'test-op09-sub4-tx-fake2',
        amount: 250.00,
        description: 'Tentativa Secundário',
        type: 'income',
        church_id: churchA,
        transaction_date: '2026-11-15'
      })
    });
    assert(resPostTx2.status === 403, `Usuário Secundário recebe 403 Forbidden ao tentar cadastrar transação fora de suas congregações autorizadas (Status: ${resPostTx2.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 3: Owner B tenta bulk insert com uma transação apontando para church_id da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Tentativa de injeção cross-tenant no POST bulk de transações ---');
    const resBulk1 = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({
        transactions: [
          {
            id: 'test-op09-sub4-bulk-tx1',
            amount: 100.00,
            description: 'Item legítimo B',
            type: 'income',
            church_id: churchB,
            transaction_date: '2026-11-15'
          },
          {
            id: 'test-op09-sub4-bulk-tx2',
            amount: 999.00,
            description: 'Item injetado na Org A',
            type: 'income',
            church_id: churchA,
            transaction_date: '2026-11-15'
          }
        ]
      })
    });
    assert(resBulk1.status === 403, `POST bulk contendo igreja de outro tenant é bloqueado com 403 Forbidden (Status: ${resBulk1.status})`);

    // Verificar se o rollback atômico impediu que o item legítimo fosse gravado sozinho
    const checkTx1 = db.prepare("SELECT id FROM consolidated_transactions WHERE id = 'test-op09-sub4-bulk-tx1'").get();
    assert(!checkTx1, `[ATOMIC ROLLBACK] Nenhuma transação do lote foi gravada após rejeição por 403 Forbidden`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 4: Owner B tenta criar financial_record com church_id da Org A
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Tentativa de injeção cross-tenant no POST /financial_records ---');
    const resPostRec1 = await fetch(`${baseUrl}/api/v1/financial_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`
      },
      body: JSON.stringify({
        title: 'Despesa Forjada na Org A',
        amount: 800.00,
        type: 'expense',
        church_id: churchA,
        due_date: '2026-11-20'
      })
    });
    assert(resPostRec1.status === 403, `Owner B recebe 403 Forbidden ao tentar criar financial_record na congregação da Org A (Status: ${resPostRec1.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 5: Secundário B tenta criar financial_record com congregação não autorizada
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 5: Tentativa de criação por Secundário com congregação não autorizada ---');
    const resPostRec2 = await fetch(`${baseUrl}/api/v1/financial_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecUserB}`
      },
      body: JSON.stringify({
        title: 'Despesa Secundário Ilegal',
        amount: 300.00,
        type: 'expense',
        church_id: churchA,
        due_date: '2026-11-20'
      })
    });
    assert(resPostRec2.status === 403, `Usuário Secundário recebe 403 Forbidden ao criar financial_record fora de suas congregações (Status: ${resPostRec2.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 6: Operação Legítima - Owner A cria transação em sua própria congregação
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 6: Operação Legítima / Criação de transação por Owner A ---');
    const resLegitTx = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({
        id: 'test-op09-sub4-tx-legit',
        amount: 150.00,
        description: 'Dízimo Legítimo Org A',
        type: 'income',
        church_id: churchA,
        transaction_date: '2026-11-15'
      })
    });
    assert(resLegitTx.status === 201, `Owner A cria com sucesso transação em sua própria congregação (Status: ${resLegitTx.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 7: Operação Legítima - Owner A cria financial_record em sua própria congregação
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 7: Operação Legítima / Criação de financial_record por Owner A ---');
    const resLegitRec = await fetch(`${baseUrl}/api/v1/financial_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({
        title: 'Aluguel do Salão Org A',
        amount: 1200.00,
        type: 'expense',
        church_id: churchA,
        due_date: '2026-11-20'
      })
    });
    assert(resLegitRec.status === 201, `Owner A cria com sucesso financial_record em sua congregação (Status: ${resLegitRec.status})`);

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO DA SUB-ETAPA 4: ${passed} passaram, ${failed} falharam.`);
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

runOP09Subetapa4Tests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
