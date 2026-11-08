import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP082Subetapa23Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE ATOMICIDADE ACID — OP-08.2 SUB-ETAPA 2.3');
  console.log('   TRANSAÇÃO ATÔMICA ACID NA ROTA DE FECHAMENTO (POST /church-closings)');
  console.log('========================================================================\n');

  const ownerId = '00000000-0000-0000-0000-000000000001';
  const churchOriginId = '00000000-0000-0000-0000-000000000001';
  const churchDestId = '00000000-0000-0000-0000-000000000099';

  const bankA = 'banco-bradesco-001';
  const bankB = 'banco-itau-002';
  const year = 2026;
  const month = 10; // Outubro para não colidir com outros testes

  // Setup baseline
  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  // Limpar dados deste período de teste
  db.prepare("DELETE FROM consolidated_transactions WHERE transaction_date LIKE '2026-10%'").run();
  db.prepare("DELETE FROM church_closings WHERE year = 2026 AND month = 10").run();

  // Setup server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const ownerToken = generateAccessToken({
    userId: ownerId,
    email: 'owner@test.com',
    ownerId: ownerId,
    role: 'owner',
    permissions: ['all'],
    churchId: churchOriginId
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
    // CENÁRIO 1: Fechamento Normal Atômico com Duas Pernas (Banco A)
    // -------------------------------------------------------------
    console.log('--- CENÁRIO 1: Fechamento Normal com Saldo Transportado ---');

    const resCloseA = await fetch(`${baseUrl}/api/v1/church-closings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        churchId: churchOriginId,
        bankId: bankA,
        year,
        month,
        transferredBalance: 3500.50,
        targetChurchId: churchDestId,
        targetChurchName: 'Igreja Sede Central',
        notes: 'Fechamento Outubro Banco A'
      })
    });

    assert(resCloseA.status === 201, `Fechamento Banco A criado com sucesso (HTTP ${resCloseA.status})`);
    const dataCloseA = await resCloseA.json();
    assert(dataCloseA.status === 'closed', 'Status do fechamento retornado é "closed"');

    const closingAId = `closing_${churchOriginId}_${bankA}_${year}_${month}`;

    // Verificar se church_closings foi gravado
    const rowClosingA = db.prepare('SELECT * FROM church_closings WHERE id = ?').get(closingAId) as any;
    assert(rowClosingA && rowClosingA.status === 'closed', 'Registro persistido em church_closings com status "closed"');

    // Verificar se as 2 pernas contábeis foram gravadas com o mesmo report_id
    const txsA = db.prepare('SELECT * FROM consolidated_transactions WHERE report_id = ?').all(closingAId);
    assert(txsA.length === 2, `Exatamente 2 pernas gravadas em consolidated_transactions (encontradas: ${txsA.length})`);

    // Verificar se uma perna é saída (-3500.5) e a outra é entrada (+3500.5)
    const outflow = txsA.find((t: any) => t.church_id === churchOriginId);
    const inflow = txsA.find((t: any) => t.church_id === churchDestId);
    assert(outflow && Math.abs(outflow.amount) === 3500.5, 'Perna de origem possui valor correto de R$ 3.500,50');
    assert(inflow && inflow.amount === 3500.5, 'Perna de destino possui valor correto de R$ 3.500,50');

    // -------------------------------------------------------------
    // CENÁRIO 2: Fechamento Sem Saldo Transportado (transferredBalance = 0)
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Fechamento Sem Saldo Transportado (transferredBalance = 0) ---');

    const resCloseB = await fetch(`${baseUrl}/api/v1/church-closings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        churchId: churchOriginId,
        bankId: bankB,
        year,
        month,
        transferredBalance: 0,
        notes: 'Fechamento Saldo Zero'
      })
    });

    assert(resCloseB.status === 201, `Fechamento Saldo Zero criado com sucesso (HTTP ${resCloseB.status})`);
    const closingBId = `closing_${churchOriginId}_${bankB}_${year}_${month}`;
    const rowClosingB = db.prepare('SELECT * FROM church_closings WHERE id = ?').get(closingBId) as any;
    assert(rowClosingB && rowClosingB.status === 'closed', 'church_closings criado para Banco B com status "closed"');

    const txsB = db.prepare('SELECT * FROM consolidated_transactions WHERE report_id = ?').all(closingBId);
    assert(txsB.length === 0, `Nenhum transporte gerado para saldo zero (encontrados: ${txsB.length})`);

    // -------------------------------------------------------------
    // CENÁRIO 3: Atomicidade Integral e Reversão (ROLLBACK) em Falha
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Atomicidade Integral — Reversão se Falhar Inserção de Transportes ---');

    // Tentamos fechar uma conta "banco-com-falha" mas passando um transferTransactions com dados que falham a query
    // (ex: passando um objeto de transação com tipo incompatível para provocar erro ou manipulando id inválido)
    const failBankId = 'banco-falha-999';
    const failClosingId = `closing_${churchOriginId}_${failBankId}_${year}_${month}`;

    // Passamos transferTransactions contendo um registro cujo tipo causará erro ou forçamos um payload que quebre a inserção do transporte
    const resFail = await fetch(`${baseUrl}/api/v1/church-closings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        churchId: churchOriginId,
        bankId: failBankId,
        year,
        month,
        transferredBalance: 1000,
        targetChurchId: churchDestId,
        transferTransactions: [
          // Primeira perna válida
          {
            id: 'valid-tx-uuid-1111-1111-111111111111',
            amount: -1000,
            church_id: churchOriginId,
            description: 'Válido'
          },
          // Segunda perna que causa falha no loop para acionar ROLLBACK
          null as any
        ]
      })
    });

    // Se houve erro na perna, a rota deve capturar e retornar HTTP 500
    // e o mais importante: o registro em church_closings NÃO pode existir no banco!
    console.log(`  ℹ️ Resposta da rota em caso de falha no transporte: HTTP ${resFail.status}`);
    
    // Verificamos no banco se o registro de church_closings foi revertido pelo ROLLBACK
    const rowClosingFail = db.prepare('SELECT * FROM church_closings WHERE id = ?').get(failClosingId);
    assert(!rowClosingFail, `[ATOMIC ROLLBACK] church_closings NÃO existe no banco após falha (revertido com sucesso!)`);

    // Verificamos que a primeira perna não ficou órfã no banco
    const orphanTx = db.prepare('SELECT * FROM consolidated_transactions WHERE id = ?').get('valid-tx-uuid-1111-1111-111111111111');
    assert(!orphanTx, `[ATOMIC ROLLBACK] Nenhuma perna órfã de transporte ficou gravada no banco`);

    // -------------------------------------------------------------
    // CENÁRIO 4: Não-Regressão — Re-fechamento (Idempotência e Atualização Atômica)
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Idempotência — Re-fechar Período Atualiza Dados e Recria Transportes Atomicamente ---');

    const resRefechamento = await fetch(`${baseUrl}/api/v1/church-closings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        churchId: churchOriginId,
        bankId: bankA,
        year,
        month,
        transferredBalance: 4200.00, // Alterou o valor transportado
        targetChurchId: churchDestId,
        targetChurchName: 'Igreja Sede Central Atualizada',
        notes: 'Fechamento Atualizado Banco A'
      })
    });

    assert(resRefechamento.status === 201, `Re-fechamento do Banco A concluído com HTTP ${resRefechamento.status}`);

    const txsARefresh = db.prepare('SELECT * FROM consolidated_transactions WHERE report_id = ?').all(closingAId);
    assert(txsARefresh.length === 2, `Exatamente 2 pernas atômicas persistem após re-fechamento (encontradas: ${txsARefresh.length})`);
    
    const outflowRefreshed = txsARefresh.find((t: any) => t.church_id === churchOriginId);
    assert(outflowRefreshed && Math.abs(outflowRefreshed.amount) === 4200, 'Perna de transporte atualizada com novo valor (R$ 4.200,00)');

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO FINAL: ${passed} APROVADOS, ${failed} FALHAS`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      try {
        db.prepare("DELETE FROM consolidated_transactions WHERE transaction_date LIKE '2026-10%'").run();
        db.prepare("DELETE FROM church_closings WHERE year = 2026 AND month = 10").run();
      } catch (_) {}
      process.exit(0);
    }
  } finally {
    try {
      db.prepare("DELETE FROM consolidated_transactions WHERE transaction_date LIKE '2026-10%'").run();
      db.prepare("DELETE FROM church_closings WHERE year = 2026 AND month = 10").run();
    } catch (_) {}
    server.close();
  }
}

runOP082Subetapa23Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
