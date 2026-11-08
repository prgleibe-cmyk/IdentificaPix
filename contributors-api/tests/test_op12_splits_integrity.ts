import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import { validateTransactionSplits, type TenantContext } from '../auth/utils/tenant.context.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

/**
 * 🧪 BATERIA DE TESTES DE INTEGRIDADE CONTÁBIL — OP-12 (SUB-ETAPA 5.2)
 * BLINDAGEM MATEMÁTICA E MULTI-TENANT DE RATEIOS (SPLITS)
 */

async function runOP12SplitsTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE RATEIOS (SPLITS) — OP-12 SUB-ETAPA 5.2');
  console.log('   INTEGRIDADE MATEMÁTICA E MULTI-TENANT EM TRANSAÇÕES E INTENÇÕES');
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

  const ownerId = '55555555-5555-4555-a555-555555555555';
  const churchAllowedId = '66666666-6666-4666-a666-666666666666';
  const churchForbiddenId = '77777777-7777-4777-a777-777777777777';
  const secondaryUserId = '88888888-8888-4888-a888-888888888888';
  const contribId = '99999999-9999-4999-a999-999999999999';

  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  // Setup de dados no banco local SQLite
  try {
    db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-split-%'").run();
    db.prepare("DELETE FROM contribution_requests WHERE contributor_id = ?").run(contribId);
    db.prepare("DELETE FROM contributors WHERE id = ?").run(contribId);
    db.prepare("DELETE FROM churches WHERE id IN (?, ?)").run(churchAllowedId, churchForbiddenId);
  } catch (_) {}

  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchAllowedId, ownerId, 'Igreja Permitida Splits');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchForbiddenId, ownerId, 'Igreja Proibida Splits');
  db.prepare("INSERT OR REPLACE INTO contributors (id, church_id, canonical_name) VALUES (?, ?, ?)").run(contribId, churchAllowedId, 'Contribuinte Rateio Test');

  // Tokens JWT (.token)
  const ownerToken = generateAccessToken({
    userId: ownerId,
    email: 'owner-splits@iggestor.test',
    ownerId,
    role: 'owner',
    permissions: ['all'],
    churchId: churchAllowedId,
    allowedChurchIds: [churchAllowedId]
  }).token;

  const secondaryToken = generateAccessToken({
    userId: secondaryUserId,
    email: 'secondary-splits@iggestor.test',
    ownerId,
    role: 'secondary',
    churchId: churchAllowedId,
    allowedChurchIds: [churchAllowedId],
    permissions: ['view', 'create', 'edit']
  }).token;

  // Inicializa servidor HTTP na porta dinâmica
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
    console.log('--- CENÁRIO 1: Validação Unidade da Função validateTransactionSplits ---');
    // 1. Splits ausente/nulo
    report('Splits null é considerado válido', validateTransactionSplits(null, 100).isValid === true);
    report('Splits undefined é considerado válido', validateTransactionSplits(undefined, 100).isValid === true);
    report('Splits array vazio é considerado válido', validateTransactionSplits([], 100).isValid === true);

    // 2. JSON malformado
    const malformed = validateTransactionSplits('{ invalid json }', 100);
    report('Splits com JSON inválido é rejeitado', malformed.isValid === false && malformed.error === 'SPLITS_INVALID_JSON');

    // 3. Não é array
    const notArray = validateTransactionSplits(12345 as any, 100);
    report('Splits numérico (não array) é rejeitado', notArray.isValid === false && notArray.error === 'SPLITS_MUST_BE_ARRAY');

    // 4. Parcela com valor zero ou negativo
    const zeroSplit = validateTransactionSplits([
      { amount: 50, contributionType: 'Dízimo' },
      { amount: 0, contributionType: 'Oferta' }
    ], 50);
    report('Parcela com amount zero é rejeitada', zeroSplit.isValid === false && zeroSplit.error === 'SPLITS_INVALID_AMOUNT');

    const negativeSplit = validateTransactionSplits([
      { amount: 60, contributionType: 'Dízimo' },
      { amount: -10, contributionType: 'Oferta' }
    ], 50);
    report('Parcela com amount negativo é rejeitada', negativeSplit.isValid === false && negativeSplit.error === 'SPLITS_INVALID_AMOUNT');

    // 5. Soma divergente (R$ 80 vs R$ 100)
    const sumMismatch = validateTransactionSplits([
      { amount: 40, contributionType: 'Dízimo' },
      { amount: 40, contributionType: 'Oferta' }
    ], 100);
    report('Rateio com soma divergente é rejeitado', sumMismatch.isValid === false && sumMismatch.error === 'SPLITS_SUM_MISMATCH');

    // 6. Soma exata (R$ 70 + R$ 30 = R$ 100)
    const sumExact = validateTransactionSplits([
      { amount: 70, contributionType: 'Dízimo' },
      { amount: 30, contributionType: 'Oferta' }
    ], 100);
    report('Rateio com soma exata é aceito', sumExact.isValid === true);

    // 7. Tolerância de centavos IEEE 754 (R$ 33.33 + R$ 33.33 + R$ 33.34 = R$ 100.00)
    const floatSum = validateTransactionSplits([
      { amount: 33.33, contributionType: 'Dízimo' },
      { amount: 33.33, contributionType: 'Oferta' },
      { amount: 33.34, contributionType: 'Missões' }
    ], 100);
    report('Tolerância de centavos flutuantes aceita', floatSum.isValid === true);

    // 8. Transação de saída (valor negativo -150.00 com splits somando 150.00)
    const expenseSum = validateTransactionSplits([
      { amount: 100, contributionType: 'Água' },
      { amount: 50, contributionType: 'Luz' }
    ], -150);
    report('Transação de despesa negativa aceita com parcelas positivas correspondentes', expenseSum.isValid === true);

    // 9. Multi-tenant: Usuário secundário alocando para congregação não autorizada
    const secCtx: TenantContext = {
      userId: secondaryUserId,
      ownerId,
      churchId: churchAllowedId,
      allowedChurchIds: [churchAllowedId],
      allowedBankIds: [],
      permissions: ['view', 'create', 'edit'],
      role: 'secondary',
      isSuperAdmin: false,
      isOwner: false,
      isSecondaryUser: true,
      isAuthenticated: true
    };

    const forbiddenSplit = validateTransactionSplits([
      { amount: 50, churchId: churchAllowedId, contributionType: 'Dízimo' },
      { amount: 50, churchId: churchForbiddenId, contributionType: 'Missões' }
    ], 100, secCtx);
    report('Secundário tentando split com congregação não autorizada é rejeitado', forbiddenSplit.isValid === false && forbiddenSplit.error === 'SPLITS_CHURCH_NOT_ALLOWED');

    const allowedSplit = validateTransactionSplits([
      { amount: 50, churchId: churchAllowedId, contributionType: 'Dízimo' },
      { amount: 50, churchId: churchAllowedId, contributionType: 'Oferta' }
    ], 100, secCtx);
    report('Secundário com split exclusivo de congregações autorizadas é aceito', allowedSplit.isValid === true);

    console.log('\n--- CENÁRIO 2: Enforcement em POST /api/v1/contribution-requests ---');
    // Requisição com rateio divergente (R$ 100 vs parcelas somando R$ 80)
    const resBadReq = await request('/api/v1/contribution-requests', {
      method: 'POST',
      body: {
        church_id: churchAllowedId,
        contributor_id: contribId,
        amount: 100,
        splits: [
          { amount: 40, contributionType: 'Dízimo' },
          { amount: 40, contributionType: 'Oferta' }
        ]
      }
    });
    report(
      'POST /contribution-requests com rateio divergente rejeitado com 400',
      resBadReq.status === 400 && resBadReq.body?.error === 'SPLITS_SUM_MISMATCH',
      `status: ${resBadReq.status}, error: ${resBadReq.body?.error}`
    );

    // Requisição com rateio matematicamente exato (R$ 100 vs 2x R$ 50)
    const resGoodReq = await request('/api/v1/contribution-requests', {
      method: 'POST',
      body: {
        church_id: churchAllowedId,
        contributor_id: contribId,
        amount: 100,
        description: 'Doação com Rateio Íntegro',
        splits: [
          { amount: 50, contributionType: 'Dízimo' },
          { amount: 50, contributionType: 'Oferta' }
        ]
      }
    });
    report(
      'POST /contribution-requests com rateio exato aceito com 200 ou 201',
      [200, 201].includes(resGoodReq.status),
      `status: ${resGoodReq.status}`
    );

    console.log('\n--- CENÁRIO 3: Enforcement em POST /api/v1/consolidated_transactions ---');
    // 1. Tentativa com rateio divergente
    const resBadSum = await request('/api/v1/consolidated_transactions', {
      method: 'POST',
      token: ownerToken,
      body: {
        id: 'test-split-tx-01',
        amount: 250,
        description: 'Lançamento com Rateio Inválido',
        type: 'income',
        transaction_date: '2026-11-05',
        church_id: churchAllowedId,
        splits: [
          { amount: 100, contributionType: 'Dízimo' },
          { amount: 100, contributionType: 'Oferta' }
        ]
      }
    });
    report(
      'POST /consolidated_transactions com rateio divergente rejeitado com 400',
      resBadSum.status === 400 && resBadSum.body?.error === 'SPLITS_SUM_MISMATCH',
      `status: ${resBadSum.status}, error: ${resBadSum.body?.error}`
    );

    // 2. Tentativa por secundário com congregação proibida dentro do split
    const resForbiddenSec = await request('/api/v1/consolidated_transactions', {
      method: 'POST',
      token: secondaryToken,
      body: {
        id: 'test-split-tx-02',
        amount: 200,
        description: 'Injeção Cross-Tenant via Split',
        type: 'income',
        transaction_date: '2026-11-05',
        church_id: churchAllowedId,
        splits: [
          { amount: 100, churchId: churchAllowedId, contributionType: 'Dízimo' },
          { amount: 100, churchId: churchForbiddenId, contributionType: 'Missões' }
        ]
      }
    });
    report(
      'POST /consolidated_transactions por secundário com igreja proibida no split rejeitado com 400',
      resForbiddenSec.status === 400 && resForbiddenSec.body?.error === 'SPLITS_CHURCH_NOT_ALLOWED',
      `status: ${resForbiddenSec.status}, error: ${resForbiddenSec.body?.error}`
    );

    // 3. Sucesso com rateio íntegro
    const resOk = await request('/api/v1/consolidated_transactions', {
      method: 'POST',
      token: ownerToken,
      body: {
        id: 'test-split-tx-03',
        amount: 300,
        description: 'Lançamento com Rateio Válido',
        type: 'income',
        transaction_date: '2026-11-05',
        church_id: churchAllowedId,
        splits: [
          { amount: 200, contributionType: 'Dízimo' },
          { amount: 100, contributionType: 'Construção' }
        ]
      }
    });
    report(
      'POST /consolidated_transactions com rateio íntegro aceito com 200 ou 201',
      [200, 201].includes(resOk.status),
      `status: ${resOk.status}`
    );


    console.log('\n--- CENÁRIO 4: Enforcement em PUT /api/v1/consolidated_transactions/:id ---');
    const txId = 'test-split-tx-04';
    db.prepare(`
      INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, amount, description, type, transaction_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(txId, ownerId, churchAllowedId, 150, 'Transação Original para Edição', 'income', '2026-11-05', 'confirmed');

    // 1. Atualização com rateio divergente do valor atual (R$ 150 vs parcelas R$ 120)
    const resBadPut = await request(`/api/v1/consolidated_transactions/${txId}`, {
      method: 'PUT',
      token: ownerToken,
      body: {
        splits: [
          { amount: 60, contributionType: 'Dízimo' },
          { amount: 60, contributionType: 'Oferta' }
        ]
      }
    });
    report(
      'PUT /consolidated_transactions/:id com rateio divergente rejeitado com 400',
      resBadPut.status === 400 && resBadPut.body?.error === 'SPLITS_SUM_MISMATCH',
      `status: ${resBadPut.status}, error: ${resBadPut.body?.error}`
    );

    // 2. Atualização com rateio íntegro (R$ 150 = R$ 100 + R$ 50)
    const resGoodPut = await request(`/api/v1/consolidated_transactions/${txId}`, {
      method: 'PUT',
      token: ownerToken,
      body: {
        splits: [
          { amount: 100, contributionType: 'Dízimo' },
          { amount: 50, contributionType: 'Oferta' }
        ]
      }
    });
    report(
      'PUT /consolidated_transactions/:id com rateio íntegro aceito com 200',
      resGoodPut.status === 200,
      `status: ${resGoodPut.status}`
    );

    console.log('\n--- CENÁRIO 5: Enforcement em POST /api/v1/consolidated_transactions/bulk ---');
    // Lote com 1 transação válida e 1 com rateio divergente: deve falhar o lote inteiro (atomicidade)
    const resBulkFail = await request('/api/v1/consolidated_transactions/bulk', {
      method: 'POST',
      token: ownerToken,
      body: {
        transactions: [
          {
            id: 'test-split-tx-bulk-01',
            amount: 100,
            description: 'Item 1 Válido',
            type: 'income',
            transaction_date: '2026-11-05',
            church_id: churchAllowedId,
            splits: [{ amount: 100, contributionType: 'Dízimo' }]
          },
          {
            id: 'test-split-tx-bulk-02',
            amount: 200,
            description: 'Item 2 Divergente',
            type: 'income',
            transaction_date: '2026-11-05',
            church_id: churchAllowedId,
            splits: [{ amount: 150, contributionType: 'Dízimo' }]
          }
        ]
      }
    });
    report(
      'POST /consolidated_transactions/bulk contendo rateio divergente falha com 400',
      resBulkFail.status === 400 && resBulkFail.body?.error === 'SPLITS_SUM_MISMATCH',
      `status: ${resBulkFail.status}, error: ${resBulkFail.body?.error}`
    );

    // Confirma que Item 1 não foi persistido devido ao ROLLBACK
    const checkItem1 = db.prepare('SELECT id FROM consolidated_transactions WHERE id = ?').get('test-split-tx-bulk-01');
    report(
      'Rollback atômico garantiu que Item 1 não foi gravado no banco',
      !checkItem1,
      checkItem1 ? 'Item 1 foi indevidamente gravado' : undefined
    );
  } finally {
    server.close();
  }

  console.log('========================================================================');
  console.log(`📊 RESUMO DA SUB-ETAPA 5.2 (RATEIOS & SPLITS): ${passed} passaram, ${failed} falharam.`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}


runOP12SplitsTests().catch((err) => {
  console.error('Erro fatal nos testes da Sub-etapa 5.2:', err);
  process.exit(1);
});
