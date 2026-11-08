import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

/**
 * 🧪 BATERIA DE TESTES DE INTEGRIDADE CONTÁBIL — OP-13 (SUB-ETAPA 5.3)
 * IMUTABILIDADE DE PERÍODOS FECHADOS, PROTEÇÃO DE PERNAS DE FECHAMENTO E CONCILIAÇÃO
 */

async function runOP13ClosedPeriodsTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE PERÍODOS FECHADOS & PERNAS CONTÁBEIS — OP-13 (5.3)');
  console.log('   IMUTABILIDADE ESTRIFA, PROTEÇÃO DE PERNAS DE FECHAMENTO E CONCILIAÇÃO');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function report(name: string, ok: boolean, detail?: string) {
    if (ok) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const ownerA = '11111111-1111-4111-a111-111111111111';
  const ownerB = '22222222-2222-4222-a222-222222222222';
  const churchA = '33333333-3333-4333-a333-333333333333';
  const churchB = '44444444-4444-4444-a444-444444444444';
  const bankA = 'bank-closed-01';

  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  // Limpeza prévia
  try {
    db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-op13-%'").run();
    db.prepare("DELETE FROM financial_records WHERE id LIKE 'test-op13-%'").run();
    db.prepare("DELETE FROM church_closings WHERE church_id IN (?, ?)").run(churchA, churchB);
    db.prepare("DELETE FROM churches WHERE id IN (?, ?)").run(churchA, churchB);
    db.prepare("DELETE FROM banks WHERE id = ?").run(bankA);
  } catch (_) {}

  // Cadastro de entidades base
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA, ownerA, 'Igreja Alpha');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchB, ownerB, 'Igreja Beta');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankA, ownerA, 'Banco Alpha');

  // Fechamento homologado da Igreja Alpha para Outubro/2026 (2026-10)
  db.prepare(`
    INSERT OR REPLACE INTO church_closings (id, church_id, bank_id, year, month, status, closed_at, total_income, total_expenses, final_balance)
    VALUES (?, ?, ?, 2026, 10, 'closed', '2026-10-31T23:59:59Z', 5000, 2000, 3000)
  `).run(`closing_${churchA}_2026_10`, churchA, 'all');

  // Transações de teste:
  // 1. txClosedUnconfirmed: transação bancária em período fechado com status pending (antigo bypass)
  db.prepare(`
    INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, description, type, transaction_date, source, status, is_confirmed)
    VALUES ('test-op13-tx-unconf-closed', ?, ?, ?, 120.00, 'SMS Pendente Outubro', 'income', '2026-10-15', 'sms', 'pending', 0)
  `).run(ownerA, churchA, bankA);

  // 2. txClosedConfirmed: transação confirmada em período fechado
  db.prepare(`
    INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, description, type, transaction_date, source, status, is_confirmed)
    VALUES ('test-op13-tx-conf-closed', ?, ?, ?, 500.00, 'Dízimo Fechado Outubro', 'income', '2026-10-20', 'manual', 'identified', 1)
  `).run(ownerA, churchA, bankA);

  // 3. txOpen: transação em período aberto (Novembro/2026)
  db.prepare(`
    INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, description, type, transaction_date, source, status, is_confirmed)
    VALUES ('test-op13-tx-open', ?, ?, ?, 350.00, 'Oferta Novembro Aberto', 'income', '2026-11-05', 'manual', 'identified', 1)
  `).run(ownerA, churchA, bankA);

  // 4. txClosingLeg: perna de fechamento contábil de transporte de saldo
  db.prepare(`
    INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, description, type, transaction_date, source, status, is_confirmed, row_hash)
    VALUES ('test-op13-tx-closing-leg', ?, ?, ?, -3000.00, '[FECHAMENTO] TRANSP. SALDO PARA SEDE', 'expense', '2026-10-31', 'closing', 'confirmed', 1, 'closing-outflow-3333-sede-2026-10-0')
  `).run(ownerA, churchA, bankA);

  // 5. txTenantB: transação pertencente à Org B
  db.prepare(`
    INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, amount, description, type, transaction_date, source, status, is_confirmed)
    VALUES ('test-op13-tx-tenant-b', ?, ?, 200.00, 'Transação Tenant B', 'income', '2026-11-05', 'manual', 'identified', 1)
  `).run(ownerB, churchB);

  // Tokens JWT (.token)
  const tokenOwnerA = generateAccessToken({
    userId: ownerA,
    email: 'ownerA@iggestor.test',
    ownerId: ownerA,
    role: 'owner',
    permissions: ['all'],
    churchId: churchA,
    allowedChurchIds: [churchA]
  }).token;

  // Servidor na porta dinâmica
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(path: string, options: { method?: string; token?: string; body?: any }) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  }

  try {
    console.log('--- CENÁRIO 1: Imutabilidade Estrita de Períodos Fechados (PUT) ---');
    // 1. Eliminação do antigo bypass: transação bancária não confirmada em período fechado DEVE ser bloqueada
    const resBypassTry = await request('/api/v1/consolidated_transactions/test-op13-tx-unconf-closed', {
      method: 'PUT',
      token: tokenOwnerA,
      body: {
        description: 'Tentativa de alteração com bypass',
        amount: 150.00
      }
    });
    report(
      'Tentativa de alteração de transação não-confirmada em período fechado é estritamente bloqueada com 422',
      resBypassTry.status === 422 && resBypassTry.body?.error === 'PERIOD_CLOSED',
      `status: ${resBypassTry.status}, error: ${resBypassTry.body?.error}`
    );

    // 2. Transação confirmada em período fechado
    const resConfTry = await request('/api/v1/consolidated_transactions/test-op13-tx-conf-closed', {
      method: 'PUT',
      token: tokenOwnerA,
      body: {
        description: 'Alteração em transação fechada'
      }
    });
    report(
      'Tentativa de alteração de transação confirmada em período fechado bloqueada com 422',
      resConfTry.status === 422 && resConfTry.body?.error === 'PERIOD_CLOSED',
      `status: ${resConfTry.status}, error: ${resConfTry.body?.error}`
    );

    // 3. Tentativa de mover transação de período aberto para período fechado
    const resMoveClosed = await request('/api/v1/consolidated_transactions/test-op13-tx-open', {
      method: 'PUT',
      token: tokenOwnerA,
      body: {
        transaction_date: '2026-10-10' // período fechado
      }
    });
    report(
      'Tentativa de mover lançamento de período aberto para período fechado bloqueada com 422',
      resMoveClosed.status === 422 && resMoveClosed.body?.error === 'PERIOD_CLOSED',
      `status: ${resMoveClosed.status}`
    );

    // 4. Edição legítima em período aberto
    const resOpenEdit = await request('/api/v1/consolidated_transactions/test-op13-tx-open', {
      method: 'PUT',
      token: tokenOwnerA,
      body: {
        description: 'Oferta Novembro Atualizada'
      }
    });
    report(
      'Edição em período aberto permitida com 200',
      resOpenEdit.status === 200,
      `status: ${resOpenEdit.status}`
    );

    console.log('\n--- CENÁRIO 2: Blindagem das Pernas Contábeis de Fechamento (PB-007) ---');
    // 1. Tentativa de edição manual de perna contábil de fechamento
    const resEditClosingLeg = await request('/api/v1/consolidated_transactions/test-op13-tx-closing-leg', {
      method: 'PUT',
      token: tokenOwnerA,
      body: {
        amount: -2500.00
      }
    });
    report(
      'PUT em perna contábil de fechamento (source=closing) bloqueado com 403 CLOSING_LEG_PROTECTED',
      resEditClosingLeg.status === 403 && resEditClosingLeg.body?.error === 'CLOSING_LEG_PROTECTED',
      `status: ${resEditClosingLeg.status}, error: ${resEditClosingLeg.body?.error}`
    );

    // 2. Tentativa de exclusão individual de perna contábil de fechamento
    const resDelClosingLeg = await request('/api/v1/consolidated_transactions/test-op13-tx-closing-leg', {
      method: 'DELETE',
      token: tokenOwnerA
    });
    report(
      'DELETE em perna contábil de fechamento bloqueado com 403 CLOSING_LEG_PROTECTED',
      resDelClosingLeg.status === 403 && resDelClosingLeg.body?.error === 'CLOSING_LEG_PROTECTED',
      `status: ${resDelClosingLeg.status}, error: ${resDelClosingLeg.body?.error}`
    );

    // 3. Tentativa de exclusão em lote contendo perna de fechamento
    const resBulkDelClosingLeg = await request('/api/v1/consolidated_transactions/bulk-delete', {
      method: 'POST',
      token: tokenOwnerA,
      body: {
        ids: ['test-op13-tx-open', 'test-op13-tx-closing-leg']
      }
    });
    report(
      'bulk-delete contendo perna contábil de fechamento bloqueado com 403 CLOSING_LEG_PROTECTED',
      resBulkDelClosingLeg.status === 403 && resBulkDelClosingLeg.body?.error === 'CLOSING_LEG_PROTECTED',
      `status: ${resBulkDelClosingLeg.status}, error: ${resBulkDelClosingLeg.body?.error}`
    );

    console.log('\n--- CENÁRIO 3: Integridade da Conciliação Bancária em financial_records ---');
    // 1. POST com bank_transaction_id inexistente
    const resPostGhostBankTx = await request('/api/v1/financial_records', {
      method: 'POST',
      token: tokenOwnerA,
      body: {
        id: 'test-op13-rec-01',
        title: 'Conta com Banco Fantasma',
        amount: 100,
        type: 'expense',
        due_date: '2026-11-20',
        church_id: churchA,
        bank_transaction_id: 'ghost-tx-uuid-999'
      }
    });
    report(
      'POST /financial_records com bank_transaction_id inexistente rejeitado com 400',
      resPostGhostBankTx.status === 400 && resPostGhostBankTx.body?.error === 'BANK_TRANSACTION_NOT_FOUND',
      `status: ${resPostGhostBankTx.status}, error: ${resPostGhostBankTx.body?.error}`
    );

    // 2. POST com bank_transaction_id de outra organização (cross-tenant)
    const resPostCrossBankTx = await request('/api/v1/financial_records', {
      method: 'POST',
      token: tokenOwnerA,
      body: {
        id: 'test-op13-rec-02',
        title: 'Tentativa de Conciliação Cruzada',
        amount: 200,
        type: 'expense',
        due_date: '2026-11-20',
        church_id: churchA,
        bank_transaction_id: 'test-op13-tx-tenant-b'
      }
    });
    report(
      'POST /financial_records com transação bancária de outra organização bloqueado com 403',
      resPostCrossBankTx.status === 403 && resPostCrossBankTx.body?.error === 'FORBIDDEN',
      `status: ${resPostCrossBankTx.status}, error: ${resPostCrossBankTx.body?.error}`
    );

    // 3. POST com bank_transaction_id pertencente a período fechado
    const resPostClosedBankTx = await request('/api/v1/financial_records', {
      method: 'POST',
      token: tokenOwnerA,
      body: {
        id: 'test-op13-rec-03',
        title: 'Conciliação em Período Fechado',
        amount: 500,
        type: 'expense',
        due_date: '2026-11-20',
        church_id: churchA,
        bank_transaction_id: 'test-op13-tx-conf-closed'
      }
    });
    report(
      'POST /financial_records vinculando transação de período fechado bloqueado com 422',
      resPostClosedBankTx.status === 422 && resPostClosedBankTx.body?.error === 'PERIOD_CLOSED',
      `status: ${resPostClosedBankTx.status}, error: ${resPostClosedBankTx.body?.error}`
    );

    // 4. POST com transação bancária legítima em período aberto
    const resPostValidConciliation = await request('/api/v1/financial_records', {
      method: 'POST',
      token: tokenOwnerA,
      body: {
        id: 'test-op13-rec-04',
        title: 'Conciliação Válida Novembro',
        amount: 350,
        type: 'expense',
        due_date: '2026-11-20',
        church_id: churchA,
        bank_transaction_id: 'test-op13-tx-open'
      }
    });
    report(
      'POST /financial_records vinculando transação legítima em período aberto aceito com 200 ou 201',
      [200, 201].includes(resPostValidConciliation.status),
      `status: ${resPostValidConciliation.status}`
    );

    // 5. PUT /financial_records/:id alterando para transação em período fechado
    const resPutClosedBankTx = await request('/api/v1/financial_records/test-op13-rec-04', {
      method: 'PUT',
      token: tokenOwnerA,
      body: {
        bank_transaction_id: 'test-op13-tx-conf-closed'
      }
    });
    report(
      'PUT /financial_records/:id alterando vínculo para período fechado bloqueado com 422',
      resPutClosedBankTx.status === 422 && resPutClosedBankTx.body?.error === 'PERIOD_CLOSED',
      `status: ${resPutClosedBankTx.status}, error: ${resPutClosedBankTx.body?.error}`
    );
  } finally {
    server.close();
  }

  console.log('========================================================================');
  console.log(`📊 RESUMO DA SUB-ETAPA 5.3 (PERÍODOS FECHADOS & PERNAS CONTÁBEIS): ${passed} passaram, ${failed} falharam.`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runOP13ClosedPeriodsTests().catch((err) => {
  console.error('Erro fatal nos testes da Sub-etapa 5.3:', err);
  process.exit(1);
});
