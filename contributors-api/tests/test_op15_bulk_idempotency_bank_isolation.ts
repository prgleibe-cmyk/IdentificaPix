import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP15BulkIdempotencyBankIsolationTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES — OP-15 (SUB-ETAPA 6.3)');
  console.log('   IDEMPOTÊNCIA DE IMPORTAÇÃO EM LOTE E ISOLAMENTO MULTI-TENANT DE BANCOS');
  console.log('========================================================================\n');

  const ownerAId = '11111111-1111-4111-a111-111111111111';
  const ownerBId = '22222222-2222-4222-a222-222222222222';
  const secondaryAId = '33333333-3333-4333-a333-333333333333';

  const churchA = '44444444-4444-4444-a444-444444444444';
  const bankA1 = 'bank-orgA-001';
  const bankA2 = 'bank-orgA-002';
  const bankB1 = 'bank-orgB-999'; // Pertence ao ownerB

  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  // Limpeza prévia
  try {
    db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-op15-%'").run();
    db.prepare("DELETE FROM banks WHERE id IN (?, ?, ?)").run(bankA1, bankA2, bankB1);
    db.prepare("DELETE FROM churches WHERE id = ?").run(churchA);
  } catch (_) {}

  // Cadastrar igrejas e contas bancárias no SQLite
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA, ownerAId, 'Igreja Central OP-15');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankA1, ownerAId, 'Banco Bradesco Org A');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankA2, ownerAId, 'Banco Itaú Org A');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankB1, ownerBId, 'Banco Santander Org B');

  // Inicializar servidor de teste
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Tokens JWT
  const ownerAToken = generateAccessToken({
    userId: ownerAId,
    email: 'ownerA@test.com',
    ownerId: ownerAId,
    role: 'owner',
    permissions: ['all'],
    churchId: churchA
  }).token;

  const secondaryAToken = generateAccessToken({
    userId: secondaryAId,
    email: 'secA@test.com',
    ownerId: ownerAId,
    role: 'secondary',
    permissions: ['view', 'create', 'edit'],
    allowedChurchIds: [churchA],
    allowedBankIds: [bankA1], // Apenas bankA1 autorizado, bankA2 proibido!
    churchId: churchA
  }).token;

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
    // -------------------------------------------------------------
    // CENÁRIO 1: Isolamento de bank_id em POST Unitário
    // -------------------------------------------------------------
    console.log('--- CENÁRIO 1: Isolamento de bank_id no POST Unitário ---');

    // 1.1 Owner A tentando usar banco pertencente a Owner B
    const resUnitForeignBank = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        id: 'test-op15-unit-foreign',
        church_id: churchA,
        bank_id: bankB1, // Banco da Org B!
        transaction_date: '2026-10-10',
        amount: 100,
        type: 'credit',
        description: 'Injeção de Banco Alheio'
      })
    });
    assert(resUnitForeignBank.status === 403, `Owner A tentando usar banco de outra organização bloqueado com HTTP 403 (Recebido: ${resUnitForeignBank.status})`);

    // 1.2 Secundário A tentando usar banco não atribuído nos seus allowedBankIds
    const resUnitSecForbiddenBank = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryAToken}` },
      body: JSON.stringify({
        id: 'test-op15-unit-sec-forbidden',
        church_id: churchA,
        bank_id: bankA2, // Banco da Org A mas NÃO listado em allowedBankIds do secundário!
        transaction_date: '2026-10-10',
        amount: 100,
        type: 'credit',
        description: 'Secundário com Banco Não Permitido'
      })
    });
    assert(resUnitSecForbiddenBank.status === 403, `Secundário A tentando usar banco não autorizado bloqueado com HTTP 403 (Recebido: ${resUnitSecForbiddenBank.status})`);

    // 1.3 Owner A usando seu banco legítimo
    const resUnitOk = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        id: 'test-op15-unit-ok',
        church_id: churchA,
        bank_id: bankA1,
        transaction_date: '2026-10-10',
        amount: 150,
        type: 'credit',
        description: 'Lançamento Unitário Legítimo'
      })
    });
    assert([200, 201].includes(resUnitOk.status), `Owner A usando banco legítimo aceito com sucesso (HTTP ${resUnitOk.status})`);

    // -------------------------------------------------------------
    // CENÁRIO 2: Isolamento de bank_id em POST /bulk
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Isolamento de bank_id no POST /bulk ---');

    // 2.1 Lote contendo banco de outra organização
    const resBulkForeign = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        transactions: [
          {
            id: 'test-op15-bulk-foreign-1',
            church_id: churchA,
            bank_id: bankA1,
            transaction_date: '2026-10-11',
            amount: 50,
            type: 'credit',
            description: 'Item 1 Legítimo'
          },
          {
            id: 'test-op15-bulk-foreign-2',
            church_id: churchA,
            bank_id: bankB1, // Banco alheio!
            transaction_date: '2026-10-11',
            amount: 75,
            type: 'credit',
            description: 'Item 2 Invasor'
          }
        ]
      })
    });
    assert(resBulkForeign.status === 403, `Lote com banco alheio rejeitado com HTTP 403 (Recebido: ${resBulkForeign.status})`);

    // Verificar que o rollback garantiu que o Item 1 não foi inserido
    const checkItem1 = db.prepare("SELECT id FROM consolidated_transactions WHERE id = 'test-op15-bulk-foreign-1'").get();
    assert(!checkItem1, 'Rollback atômico garantiu que nenhuma transação do lote foi persistida');

    // 2.2 Secundário tentando lote com banco proibido
    const resBulkSecForbidden = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryAToken}` },
      body: JSON.stringify({
        transactions: [
          {
            id: 'test-op15-bulk-sec-1',
            church_id: churchA,
            bank_id: bankA2, // Proibido para o secundário!
            transaction_date: '2026-10-11',
            amount: 90,
            type: 'credit',
            description: 'Secundário banco proibido'
          }
        ]
      })
    });
    assert(resBulkSecForbidden.status === 403, `Secundário tentando lote com banco não autorizado rejeitado com HTTP 403 (Recebido: ${resBulkSecForbidden.status})`);

    // -------------------------------------------------------------
    // CENÁRIO 3: Idempotência de row_hash em POST /bulk
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Idempotência de row_hash no POST /bulk ---');

    const bulkPayload = {
      transactions: [
        {
          id: 'test-op15-idem-1',
          church_id: churchA,
          bank_id: bankA1,
          transaction_date: '2026-10-12',
          amount: 300,
          type: 'credit',
          description: 'Dízimo Maria Idempotente',
          row_hash: 'viva_hash_maria_1012',
          source: 'file'
        },
        {
          id: 'test-op15-idem-2',
          church_id: churchA,
          bank_id: bankA1,
          transaction_date: '2026-10-12',
          amount: 120,
          type: 'credit',
          description: 'Oferta João Idempotente',
          row_hash: 'viva_hash_joao_1012',
          source: 'file'
        }
      ]
    };

    // Primeiro envio do lote
    const resBulkFirst = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify(bulkPayload)
    });
    assert([200, 201].includes(resBulkFirst.status), `Primeiro envio do lote aceito com sucesso (HTTP ${resBulkFirst.status})`);
    const dataFirst = await resBulkFirst.json();
    assert(Array.isArray(dataFirst) && dataFirst.length === 2, `Retornadas 2 transações inseridas no primeiro lote`);

    // Segundo envio exato do mesmo lote (simulando re-upload do mesmo extrato OFX)
    const resBulkSecond = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify(bulkPayload)
    });
    assert([200, 201].includes(resBulkSecond.status), `Segundo envio idempotente aceito com HTTP 200/201 (Recebido: ${resBulkSecond.status})`);
    const dataSecond = await resBulkSecond.json();
    assert(Array.isArray(dataSecond) && dataSecond.length === 2, `Retornadas 2 transações existentes sem falha`);

    // Verificar no banco de dados se não houve duplicação de linhas
    const countMaria = db.prepare("SELECT COUNT(*) as count FROM consolidated_transactions WHERE row_hash = 'viva_hash_maria_1012'").get() as any;
    assert(countMaria.count === 1, `Transação de Maria persistida exatamente 1 vez no banco (não duplicou: count=${countMaria.count})`);

    const countJoao = db.prepare("SELECT COUNT(*) as count FROM consolidated_transactions WHERE row_hash = 'viva_hash_joao_1012'").get() as any;
    assert(countJoao.count === 1, `Transação de João persistida exatamente 1 vez no banco (não duplicou: count=${countJoao.count})`);

    // -------------------------------------------------------------
    // CENÁRIO 4: Verificação de Existência do Índice de Otimização
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Verificação do Índice idx_consolidated_tx_user_row_hash ---');

    const indexRows = db.prepare("PRAGMA index_list('consolidated_transactions')").all() as any[];
    const hasRowHashIndex = indexRows.some(idx => idx.name === 'idx_consolidated_tx_user_row_hash');
    assert(hasRowHashIndex, 'Índice idx_consolidated_tx_user_row_hash ativo e verificado no SQLite');

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO DA SUB-ETAPA 6.3: ${passed} APROVADOS, ${failed} FALHAS`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    try {
      db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-op15-%'").run();
      db.prepare("DELETE FROM banks WHERE id IN (?, ?, ?)").run(bankA1, bankA2, bankB1);
      db.prepare("DELETE FROM churches WHERE id = ?").run(churchA);
    } catch (_) {}
    server.close();
  }
}

runOP15BulkIdempotencyBankIsolationTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
