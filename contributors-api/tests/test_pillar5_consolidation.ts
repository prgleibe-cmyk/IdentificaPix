import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import { validateTransactionSplits } from '../auth/utils/tenant.context.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runPillar5Consolidation() {
  console.log('========================================================================');
  console.log('🏛️ BATERIA CONSOLIDADA DE HOMOLOGAÇÃO — PILAR 5 (OPERAÇÕES FINANCEIRAS)');
  console.log('   INTEGRIDADE DE SALDOS, RATEIOS, FECHAMENTOS E CONCILIAÇÃO BANCÁRIA');
  console.log('========================================================================\n');

  const ownerId = '00000000-0000-0000-0000-000000000001';
  const secondaryId = '00000000-0000-0000-0000-000000000002';
  const otherOwnerId = '00000000-0000-0000-0000-000000000999';

  const churchA = '00000000-0000-0000-0000-000000000001';
  const churchB = '00000000-0000-0000-0000-000000000002';
  const churchForbidden = '00000000-0000-0000-0000-000000000999';

  const bankTest = 'banco-pilar5-001';
  const year = 2026;
  const closedMonth = 8; // Agosto 2026
  const openMonth = 9;   // Setembro 2026

  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  // Limpeza prévia
  try {
    db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-p5%'").run();
    db.prepare("DELETE FROM church_closings WHERE id LIKE 'closing_test-p5%'").run();
    db.prepare("DELETE FROM financial_records WHERE id LIKE 'rec-p5%'").run();
  } catch (_) {}

  // Criar congregações no SQLite se não existirem
  try {
    db.prepare("INSERT OR IGNORE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA, ownerId, 'Igreja Central P5');
    db.prepare("INSERT OR IGNORE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchB, ownerId, 'Congregação B P5');
    db.prepare("INSERT OR IGNORE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchForbidden, otherOwnerId, 'Igreja Outra Org');
    db.prepare("INSERT OR IGNORE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankTest, ownerId, 'Banco P5');
  } catch (_) {}

  // Criar período contábil fechado para Agosto 2026
  const closedClosingId = `closing_test-p5_${churchA}_${bankTest}_${year}_${closedMonth}`;
  db.prepare(`
    INSERT OR REPLACE INTO church_closings (id, church_id, bank_id, year, month, status, final_balance, transferred_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'closed', 2500.00, 1500.00, datetime('now'), datetime('now'))
  `).run(closedClosingId, churchA, bankTest, year, closedMonth);

  // Inserir transações de teste no período fechado e no período aberto
  db.prepare(`
    INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, bank_id, transaction_date, amount, type, status, description, row_hash, report_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('test-p5-tx-closed-1', ownerId, churchA, bankTest, '2026-08-15', 500.00, 'credit', 'pending', 'Dízimo Agosto', 'hash-closed-1', null);

  db.prepare(`
    INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, bank_id, transaction_date, amount, type, status, description, row_hash, report_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('test-p5-tx-closing-leg', ownerId, churchA, bankTest, '2026-08-31', -1500.00, 'debit', 'confirmed', 'Transporte de Saldo Fechamento', 'closing-test-p5-hash', closedClosingId, 'closing');

  db.prepare(`
    INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, bank_id, transaction_date, amount, type, status, description, row_hash, report_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('test-p5-tx-open-1', ownerId, churchA, bankTest, '2026-09-10', 800.00, 'credit', 'pending', 'Oferta Setembro Aberto', 'hash-open-1', null);

  // Iniciar servidor de teste
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
    churchId: churchA
  }).token;

  const secondaryToken = generateAccessToken({
    userId: secondaryId,
    email: 'sec@test.com',
    ownerId: ownerId,
    role: 'secondary',
    permissions: ['view', 'create', 'edit'],
    allowedChurchIds: [churchA, churchB],
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
    // -----------------------------------------------------------------
    // TESTE 1: Integridade Algébrica e Tenant dos Rateios (validateTransactionSplits)
    // -----------------------------------------------------------------
    console.log('--- ETAPA 1: Integridade Matemática dos Rateios (Splits) ---');

    const splitOk = validateTransactionSplits(
      [{ churchId: churchA, amount: 60 }, { churchId: churchB, amount: 40 }],
      100,
      { isOwner: false, isSecondaryUser: true, allowedChurchIds: [churchA, churchB] } as any
    );
    assert(splitOk.isValid === true, 'Rateio com soma exata 60 + 40 = 100 é validado');

    const splitDivergent = validateTransactionSplits(
      [{ churchId: churchA, amount: 60 }, { churchId: churchB, amount: 39 }],
      100,
      { isOwner: false, isSecondaryUser: true, allowedChurchIds: [churchA, churchB] } as any
    );
    assert(splitDivergent.isValid === false && splitDivergent.error === 'SPLITS_SUM_MISMATCH', 'Rateio divergente (60 + 39 != 100) é rejeitado com SPLITS_SUM_MISMATCH');

    const splitForbidden = validateTransactionSplits(
      [{ churchId: churchA, amount: 50 }, { churchId: churchForbidden, amount: 50 }],
      100,
      { isOwner: false, isSecondaryUser: true, allowedChurchIds: [churchA, churchB] } as any
    );
    assert(splitForbidden.isValid === false && splitForbidden.error === 'SPLITS_CHURCH_NOT_ALLOWED', 'Rateio envolvendo congregação não autorizada é rejeitado com SPLITS_CHURCH_NOT_ALLOWED');

    // -----------------------------------------------------------------
    // TESTE 2: Enforcement de Rateios na API de Transações
    // -----------------------------------------------------------------
    console.log('\n--- ETAPA 2: Enforcement de Rateios no CRUD de Transações ---');

    const resTxBadSplit = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryToken}` },
      body: JSON.stringify({
        id: 'test-p5-bad-split',
        church_id: churchA,
        bank_id: bankTest,
        transaction_date: '2026-09-12',
        amount: 200,
        type: 'credit',
        description: 'Rateio Inválido',
        splits: [{ churchId: churchA, amount: 150 }] // Falta 50
      })
    });
    assert(resTxBadSplit.status === 400, `POST transação com rateio divergente rejeitado com HTTP 400 (Recebido: ${resTxBadSplit.status})`);

    const resTxGoodSplit = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryToken}` },
      body: JSON.stringify({
        id: 'test-p5-good-split',
        church_id: churchA,
        bank_id: bankTest,
        transaction_date: '2026-09-12',
        amount: 200,
        type: 'credit',
        description: 'Rateio Válido',
        splits: [
          { churchId: churchA, amount: 120 },
          { churchId: churchB, amount: 80 }
        ]
      })
    });
    assert([200, 201].includes(resTxGoodSplit.status), `POST transação com rateio correto aceito com sucesso (HTTP ${resTxGoodSplit.status})`);

    // -----------------------------------------------------------------
    // TESTE 3: Imutabilidade Estrita em Períodos Fechados
    // -----------------------------------------------------------------
    console.log('\n--- ETAPA 3: Imutabilidade Estrita em Períodos Fechados ---');

    // Edição de transação pendente em período fechado
    const resEditClosed = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-p5-tx-closed-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        description: 'Tentativa de adulterar transação em período fechado',
        amount: 999
      })
    });
    assert(resEditClosed.status === 422, `Tentativa de PUT em período fechado rejeitada com HTTP 422 (Recebido: ${resEditClosed.status})`);

    // Tentativa de mover transação de período aberto para período fechado
    const resMoveToClosed = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-p5-tx-open-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        transaction_date: '2026-08-20' // Recua para o mês fechado
      })
    });
    assert(resMoveToClosed.status === 422, `Tentativa de retroagir transação para período fechado bloqueada com HTTP 422 (Recebido: ${resMoveToClosed.status})`);

    // -----------------------------------------------------------------
    // TESTE 4: Blindagem das Pernas Contábeis de Fechamento (PB-007)
    // -----------------------------------------------------------------
    console.log('\n--- ETAPA 4: Blindagem das Pernas de Fechamento (CLOSING_LEG_PROTECTED) ---');

    const resPutClosingLeg = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-p5-tx-closing-leg`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ amount: -2000 })
    });
    assert(resPutClosingLeg.status === 403, `Tentativa de PUT em perna contábil rejeitada com HTTP 403 CLOSING_LEG_PROTECTED (Recebido: ${resPutClosingLeg.status})`);

    const resDeleteClosingLeg = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-p5-tx-closing-leg`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert(resDeleteClosingLeg.status === 403, `Tentativa de DELETE em perna contábil rejeitada com HTTP 403 CLOSING_LEG_PROTECTED (Recebido: ${resDeleteClosingLeg.status})`);

    // -----------------------------------------------------------------
    // TESTE 5: Conciliação Bancária Segura em Contas a Pagar / Receber
    // -----------------------------------------------------------------
    console.log('\n--- ETAPA 5: Integridade da Conciliação Bancária em financial_records ---');

    // Tentar vincular transação bancária que está em período fechado
    const resFinClosedLink = await fetch(`${baseUrl}/api/v1/financial_records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        id: 'rec-p5-closed-link',
        church_id: churchA,
        title: 'Despesa com Vínculo Inválido',
        type: 'payable',
        amount: 500,
        due_date: '2026-09-20',
        bank_transaction_id: 'test-p5-tx-closed-1' // Período fechado!
      })
    });
    assert(resFinClosedLink.status === 422, `POST financial_records vinculando transação de período fechado bloqueado com HTTP 422 (Recebido: ${resFinClosedLink.status})`);

    // Vínculo legítimo com transação de período aberto
    const resFinOpenLink = await fetch(`${baseUrl}/api/v1/financial_records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        id: 'rec-p5-open-link',
        church_id: churchA,
        title: 'Despesa com Vínculo Legítimo',
        type: 'payable',
        amount: 800,
        due_date: '2026-09-20',
        bank_transaction_id: 'test-p5-tx-open-1'
      })
    });
    assert([200, 201].includes(resFinOpenLink.status), `POST financial_records vinculando transação em período aberto aceito com HTTP ${resFinOpenLink.status}`);

    // -----------------------------------------------------------------
    // TESTE 6: Concorrência Simultânea e Consistência Transacional de Saldos
    // -----------------------------------------------------------------
    console.log('\n--- ETAPA 6: Concorrência Simultânea e Consistência Transacional ---');

    const concurrentRequests = Array.from({ length: 10 }, (_, i) => {
      const isCredit = i % 2 === 0;
      const amt = isCredit ? 100 : 50;
      return fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          id: `test-p5-conc-${i}`,
          church_id: churchA,
          bank_id: bankTest,
          transaction_date: '2026-09-15',
          amount: amt,
          type: isCredit ? 'credit' : 'debit',
          description: `Transação Concorrente ${i}`,
          status: 'confirmed'
        })
      });
    });

    const concurrentResults = await Promise.all(concurrentRequests);
    const allSuccessful = concurrentResults.every(r => [200, 201].includes(r.status));
    assert(allSuccessful, '10 transações financeiras simultâneas processadas com sucesso concorrente (200/201)');

    // Verificar se todas as 10 transações persistem no banco sem perda de dados
    const countConc = db.prepare("SELECT COUNT(*) as total FROM consolidated_transactions WHERE id LIKE 'test-p5-conc%'").get() as any;
    assert(countConc.total === 10, `Exatamente 10 transações persistidas no banco SQLite (encontradas: ${countConc.total})`);

    // Calcular balanço líquido das 10 transações (5 créditos de 100 = 500, 5 débitos de 50 = 250 -> saldo 250)
    const sumResult = db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as credits,
        SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as debits
      FROM consolidated_transactions WHERE id LIKE 'test-p5-conc%'
    `).get() as any;
    assert(sumResult.credits === 500 && sumResult.debits === 250, `Consistência matemática íntegra: Créditos R$ ${sumResult.credits},00 | Débitos R$ ${sumResult.debits},00`);

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO DA HOMOLOGAÇÃO DO PILAR 5: ${passed} APROVADOS, ${failed} FALHAS`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    try {
      db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-p5%'").run();
      db.prepare("DELETE FROM church_closings WHERE id LIKE 'closing_test-p5%'").run();
      db.prepare("DELETE FROM financial_records WHERE id LIKE 'rec-p5%'").run();
    } catch (_) {}
    server.close();
  }
}

runPillar5Consolidation().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
