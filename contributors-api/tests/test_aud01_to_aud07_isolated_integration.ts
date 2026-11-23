/**
 * Suíte Real de Integração HTTP + Banco Isolado (/tmp SQLite) — Etapa 9 (AUD-08)
 * Cobre integralmente: AUD-01, AUD-02, AUD-03, AUD-04 (D-1 A / D-2 A), AUD-05, AUD-06, AUD-07
 * e as Decisões 1, 2 e 3 + P1-A / P2-A / P4-A / P5-A.
 *
 * Isolamento garantido via D-4 (A): process.env.CONTRIBUTORS_SQLITE_PATH aponta exclusivamente
 * para /tmp/, nunca lendo nem gravando em data/contributors_local.sqlite ou PostgreSQL ativo.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const tmpDbPath = path.join(os.tmpdir(), `identificapix_aud08_isolated_${Date.now()}_${process.pid}.sqlite`);
const canonicalDbPath = path.resolve(process.cwd(), 'data', 'contributors_local.sqlite');
const canonicalExistedBefore = fs.existsSync(canonicalDbPath);
const canonicalMtimeBefore = canonicalExistedBefore ? fs.statSync(canonicalDbPath).mtimeMs : null;

// Configura isolamento ANTES do carregamento dinâmico de server.ts
process.env.NODE_ENV = 'test';
process.env.CONTRIBUTORS_SQLITE_PATH = tmpDbPath;
process.env.DATABASE_URL = 'postgresql://isolated_noop:noop@127.0.0.1:1/isolated_noop';
process.env.PGHOST = '127.0.0.1';
process.env.PGPORT = '1';
process.env.JWT_SECRET = 'aud08_isolated_test_secret_2026';

async function apiJson(
  baseUrl: string,
  method: string,
  urlPath: string,
  token: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function runSuite() {
  const { app, pool } = await import('../server.js');
  const { generateAccessToken } = await import('../auth/utils/jwt.utils.js');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  let passed = 0;
  let failed = 0;
  const t = {
    test: async (name: string, fn: () => Promise<void>) => {
      try {
        await fn();
        passed++;
        console.log(`✅ PASS: ${name}`);
      } catch (err: any) {
        failed++;
        console.error(`❌ FAIL: ${name}`);
        console.error(err?.stack || err);
      }
    }
  };

  // Fixtures de dois tenants completamente isolados
  const ownerAId = '11111111-1111-4111-8111-111111111111';
  const ownerBId = '22222222-2222-4222-8222-222222222222';
  const secAId = '33333333-3333-4333-8333-333333333333';
  const secANoChurchesId = '33333333-3333-4333-8333-444444444444';

  const churchA1 = 'aaaaaaaa-1111-4111-8111-111111111111';
  const churchA2 = 'aaaaaaaa-2222-4222-8222-222222222222';
  const churchA3 = 'aaaaaaaa-3333-4333-8333-333333333333';
  const churchAOpenDel = 'aaaaaaaa-4444-4444-8444-444444444444';
  const churchB1 = 'bbbbbbbb-1111-4111-8111-111111111111';

  const bankA1 = 'baaaaaaa-1111-4111-8111-111111111111';
  const bankA2 = 'baaaaaaa-2222-4222-8222-222222222222';
  const bankAOpenDel = 'baaaaaaa-3333-4333-8333-333333333333';
  const bankB1 = 'bbbbbbbb-b111-4111-8111-111111111111';

  const ownerAToken = generateAccessToken({
    userId: ownerAId,
    email: 'owner-a@test.local',
    ownerId: ownerAId,
    role: 'owner',
    permissions: ['all'],
    churchId: churchA1
  }).token;

  const ownerBToken = generateAccessToken({
    userId: ownerBId,
    email: 'owner-b@test.local',
    ownerId: ownerBId,
    role: 'owner',
    permissions: ['all'],
    churchId: churchB1
  }).token;

  const secAToken = generateAccessToken({
    userId: secAId,
    email: 'sec-a@test.local',
    ownerId: ownerAId,
    role: 'secondary',
    permissions: ['view', 'create', 'edit', 'delete', 'lancar_dados', 'editar_lancamentos', 'excluir_lancamentos', 'confirmar_final', 'reports'],
    allowedChurchIds: [churchA1],
    allowedBankIds: [bankA1],
    churchId: churchA1
  }).token;

  const secANoChurchesToken = generateAccessToken({
    userId: secANoChurchesId,
    email: 'sec-a-empty@test.local',
    ownerId: ownerAId,
    role: 'secondary',
    permissions: ['view', 'create', 'edit', 'delete', 'lancar_dados', 'confirmar_final'],
    allowedChurchIds: [],
    allowedBankIds: [],
    churchId: undefined
  }).token;

  // Seed inicial no banco isolado (via SmartPool -> /tmp SQLite)
  await pool.query('INSERT INTO churches (id, user_id, name) VALUES ($1, $2, $3)', [churchA1, ownerAId, 'Igreja A1 Sede']);
  await pool.query('INSERT INTO churches (id, user_id, name) VALUES ($1, $2, $3)', [churchA2, ownerAId, 'Igreja A2 Filial']);
  await pool.query('INSERT INTO churches (id, user_id, name) VALUES ($1, $2, $3)', [churchA3, ownerAId, 'Igreja A3 MultiMes']);
  await pool.query('INSERT INTO churches (id, user_id, name) VALUES ($1, $2, $3)', [churchAOpenDel, ownerAId, 'Igreja A4 Sem Historico']);
  await pool.query('INSERT INTO churches (id, user_id, name) VALUES ($1, $2, $3)', [churchB1, ownerBId, 'Igreja B1 Outro Tenant']);

  await pool.query('INSERT INTO banks (id, user_id, name) VALUES ($1, $2, $3)', [bankA1, ownerAId, 'Banco A1']);
  await pool.query('INSERT INTO banks (id, user_id, name) VALUES ($1, $2, $3)', [bankA2, ownerAId, 'Banco A2']);
  await pool.query('INSERT INTO banks (id, user_id, name) VALUES ($1, $2, $3)', [bankAOpenDel, ownerAId, 'Banco A3 Sem Historico']);
  await pool.query('INSERT INTO banks (id, user_id, name) VALUES ($1, $2, $3)', [bankB1, ownerBId, 'Banco B1 Outro Tenant']);

  try {
    // =========================================================================
    // 1. AUD-02: Isolamento estrito de usuários secundários (Igrejas & Bancos)
    // =========================================================================
    await t.test('[AUD-02] Isolamento de congregações e bancos para usuários secundários (transactions + financial_records)', async () => {
      // Cria transações em A1/bankA1, A2/bankA1 e A1/bankA2 como Owner A
      const txA1B1 = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 100,
        description: 'Dizimo A1 Bank1',
        type: 'income',
        church_id: churchA1,
        bank_id: bankA1,
        transaction_date: '2026-08-05',
        reference_date: '2026-08-05',
        status: 'identified'
      });
      assert.equal(txA1B1.status, 201);

      const txA2B1 = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 200,
        description: 'Dizimo A2 Bank1',
        type: 'income',
        church_id: churchA2,
        bank_id: bankA1,
        transaction_date: '2026-08-05',
        reference_date: '2026-08-05',
        status: 'identified'
      });
      assert.equal(txA2B1.status, 201);

      const txA1B2 = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 150,
        description: 'Dizimo A1 Bank2',
        type: 'income',
        church_id: churchA1,
        bank_id: bankA2,
        transaction_date: '2026-08-06',
        reference_date: '2026-08-06',
        status: 'identified'
      });
      assert.equal(txA1B2.status, 201);

      // Secundário A (só A1 + bankA1) NÃO pode editar tx de A2 mesmo sendo do mesmo ownerId
      const putA2 = await apiJson(baseUrl, 'PUT', `/api/v1/consolidated_transactions/${txA2B1.data.id}`, secAToken, {
        description: 'Tentativa Invasao A2'
      });
      assert.equal(putA2.status, 403, `Secundário não pode editar tx de congregação não autorizada (recebido ${putA2.status})`);

      // Secundário A (só bankA1) NÃO pode editar tx de bankA2
      const putB2 = await apiJson(baseUrl, 'PUT', `/api/v1/consolidated_transactions/${txA1B2.data.id}`, secAToken, {
        description: 'Tentativa Invasao Bank2'
      });
      assert.equal(putB2.status, 403, `Secundário não pode editar tx de banco não autorizado (recebido ${putB2.status})`);

      // Secundário sem nenhuma congregação (allowedChurchIds: []) falha fechado (403)
      const putEmpty = await apiJson(baseUrl, 'PUT', `/api/v1/consolidated_transactions/${txA1B1.data.id}`, secANoChurchesToken, {
        description: 'Tentativa Sem Congregacao'
      });
      assert.equal(putEmpty.status, 403);

      // Secundário A PODE editar tx legítima de A1 + bankA1
      const putA1Ok = await apiJson(baseUrl, 'PUT', `/api/v1/consolidated_transactions/${txA1B1.data.id}`, secAToken, {
        description: 'Dizimo A1 Bank1 Atualizado'
      });
      assert.equal(putA1Ok.status, 200);

      // Financial record em A2: Secundário A não pode editar nem excluir
      const finA2 = await apiJson(baseUrl, 'POST', '/api/v1/financial_records', ownerAToken, {
        church_id: churchA2,
        title: 'Conta Luz A2',
        amount: 320,
        type: 'expense',
        due_date: '2026-08-10'
      });
      assert.equal(finA2.status, 201);

      const delFinA2Sec = await apiJson(baseUrl, 'DELETE', `/api/v1/financial_records/${finA2.data.id}`, secAToken);
      assert.equal(delFinA2Sec.status, 403);
    });

    // =========================================================================
    // 2. AUD-01 + Decisão 1 + P1-A + P2-A: confirm-batch
    // =========================================================================
    await t.test('[AUD-01 + Decisão 1 + P1-A + P2-A] confirm-batch bloqueia cross-tenant, mutação de já confirmado, desbloqueio por secundário e bloqueia exato (Data, Igreja)', async () => {
      const txOpen = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 500,
        description: 'Oferta Especial Dia 10',
        type: 'income',
        church_id: churchA1,
        bank_id: bankA1,
        transaction_date: '2026-11-10',
        reference_date: '2026-11-10',
        status: 'identified'
      });
      assert.equal(txOpen.status, 201);
      const txId = txOpen.data.id;

      // Cross-tenant: Owner A tentando injetar churchB1 em confirm-batch -> 403
      const crossChurch = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', ownerAToken, {
        ids: [txId],
        isConfirmed: true,
        churchId: churchB1
      });
      assert.equal(crossChurch.status, 403);

      // Cross-tenant: Owner A tentando injetar bankB1 em confirm-batch -> 403
      const crossBank = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', ownerAToken, {
        ids: [txId],
        isConfirmed: true,
        bankId: bankB1
      });
      assert.equal(crossBank.status, 403);

      // Confirmação legítima pelo Owner A -> 200
      const confirmOk = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', ownerAToken, {
        ids: [txId],
        isConfirmed: true
      });
      assert.equal(confirmOk.status, 200);

      // Mutação de registro JÁ CONFIRMADO via confirm-batch (mudando churchId ou bankId) -> 422 TRANSACTION_CONFIRMED_LOCKED
      const mutateConfirmed = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', ownerAToken, {
        ids: [txId],
        isConfirmed: true,
        churchId: churchA2
      });
      assert.equal(mutateConfirmed.status, 422);
      assert.equal(mutateConfirmed.data?.error, 'TRANSACTION_CONFIRMED_LOCKED');

      // P1-A: Secundário A tentando desbloquear (isConfirmed: false) -> 403
      const secUnlock = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', secAToken, {
        ids: [txId],
        isConfirmed: false
      });
      assert.equal(secUnlock.status, 403);

      // Decisão 1 + P2-A: Dia (2026-11-10, churchA1) bloqueia novo lançamento MESMO em outro banco (bankA2)
      const blockedSameDayOtherBank = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 75,
        description: 'Tentativa Mesmo Dia Outro Banco',
        type: 'income',
        church_id: churchA1,
        bank_id: bankA2,
        transaction_date: '2026-11-10',
        reference_date: '2026-11-10',
        status: 'identified'
      });
      assert.equal(blockedSameDayOtherBank.status, 422);
      assert.equal(blockedSameDayOtherBank.data?.error, 'DAY_CONFIRMED_LOCKED');

      // Decisão 1: Outra data na mesma igreja (2026-11-11, churchA1) continua liberada -> 201
      const allowedOtherDate = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 80,
        description: 'Lancamento Outro Dia A1',
        type: 'income',
        church_id: churchA1,
        bank_id: bankA1,
        transaction_date: '2026-11-11',
        reference_date: '2026-11-11',
        status: 'identified'
      });
      assert.equal(allowedOtherDate.status, 201);

      // Decisão 1: Mesma data em outra igreja (2026-11-10, churchA2) continua liberada -> 201
      const allowedOtherChurch = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 90,
        description: 'Lancamento Mesmo Dia A2',
        type: 'income',
        church_id: churchA2,
        bank_id: bankA1,
        transaction_date: '2026-11-10',
        reference_date: '2026-11-10',
        status: 'identified'
      });
      assert.equal(allowedOtherChurch.status, 201);
    });

    // =========================================================================
    // 3. AUD-03 + Decisão 2 + P4-A: POST /church-closings anti-injeção & ACID
    // =========================================================================
    await t.test('[AUD-03 + Decisão 2 + P4-A] POST /church-closings bloqueia status=reopened, cross-tenant targetChurchId, colisão de leg ID e fecha ACID', async () => {
      const opTx = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 1000,
        description: 'Entrada Julho A2',
        type: 'income',
        church_id: churchA2,
        bank_id: bankA1,
        transaction_date: '2026-07-15',
        reference_date: '2026-07-15',
        status: 'identified'
      });
      assert.equal(opTx.status, 201);

      // 3.1 Status inválido 'reopened' -> 400
      const badStatus = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA2,
        year: 2026,
        month: 7,
        status: 'reopened'
      });
      assert.equal(badStatus.status, 400);

      // 3.2 targetChurchId cross-tenant (churchB1) -> 403
      const badTarget = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA2,
        year: 2026,
        month: 7,
        status: 'closed',
        targetChurchId: churchB1,
        transferredBalance: 500
      });
      assert.equal(badTarget.status, 403);

      // 3.3 transferTransactions com church_id cross-tenant -> 403
      const badLegTenant = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA2,
        year: 2026,
        month: 7,
        status: 'closed',
        transferredBalance: 500,
        transferTransactions: [{
          id: crypto.randomUUID(),
          church_id: churchB1,
          amount: 500,
          type: 'income',
          description: 'Injecao Cross-Tenant',
          transaction_date: '2026-08-01',
          reference_date: '2026-08-01'
        }]
      });
      assert.equal(badLegTenant.status, 403);

      // 3.4 Colisão de ID com transação operacional existente -> 409 CLOSING_LEG_ID_CONFLICT
      const badLegCollision = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA2,
        year: 2026,
        month: 7,
        status: 'closed',
        transferredBalance: 500,
        transferTransactions: [{
          id: opTx.data.id,
          church_id: churchA2,
          amount: -500,
          type: 'expense',
          description: 'Colisao ID Operacional',
          transaction_date: '2026-07-31',
          reference_date: '2026-07-31'
        }]
      });
      assert.equal(badLegCollision.status, 409);
      assert.equal(badLegCollision.data?.error, 'CLOSING_LEG_ID_CONFLICT');

      // 3.5 Fechamento legítimo enviando status='draft' (P4-A normaliza para 'closed')
      const legOutId = crypto.randomUUID();
      const closeOk = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA2,
        year: 2026,
        month: 7,
        status: 'draft',
        totalIncome: 1000,
        totalExpenses: 0,
        finalBalance: 1000,
        transferredBalance: 1000,
        transferTransactions: [{
          id: legOutId,
          church_id: churchA2,
          bank_id: bankA1,
          amount: -1000,
          type: 'expense',
          description: '[FECHAMENTO] Julho 2026',
          transaction_date: '2026-07-31',
          reference_date: '2026-07-31',
          report_id: 'tentativa-forjar-report-id'
        }]
      });
      assert.equal(closeOk.status, 201);
      assert.equal(closeOk.data?.status, 'closed', 'P4-A deve normalizar draft -> closed');

      // Confere que a transação operacional foi confirmada e a perna recebeu report_id forçado do fechamento
      const opAfter = await pool.query('SELECT is_confirmed, status FROM consolidated_transactions WHERE id = $1', [opTx.data.id]);
      assert.equal(Boolean(opAfter.rows[0]?.is_confirmed), true);
      assert.equal(opAfter.rows[0]?.status, 'resolved');

      const legAfter = await pool.query('SELECT source, report_id FROM consolidated_transactions WHERE id = $1', [legOutId]);
      assert.equal(legAfter.rows[0]?.source, 'closing');
      assert.equal(legAfter.rows[0]?.report_id, closeOk.data.id, 'report_id da perna deve ser forçado pelo backend para o ID do fechamento');

      // Novo lançamento no mês fechado bloqueado com 422 PERIOD_CLOSED
      const blockedInClosed = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 50,
        description: 'Tentativa em Julho Fechado',
        type: 'income',
        church_id: churchA2,
        bank_id: bankA1,
        transaction_date: '2026-07-20',
        reference_date: '2026-07-20',
        status: 'identified'
      });
      assert.equal(blockedInClosed.status, 422);
      assert.equal(blockedInClosed.data?.error, 'PERIOD_CLOSED');
    });

    // =========================================================================
    // 4. AUD-05 + Decisão 3 + P5-A: Multi-mês, Múltiplos fechamentos & Reabertura
    // =========================================================================
    await t.test('[AUD-05 + Decisão 3 + P5-A] Fechamento personalizado multi-mês, sobreposição e reabertura preservando fechamento bancário independente', async () => {
      // 4.1 Transações em Setembro e Outubro na igreja A3
      const txSep = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 400,
        description: 'Tx Setembro 25 A3',
        type: 'income',
        church_id: churchA3,
        bank_id: bankA1,
        transaction_date: '2026-09-25',
        reference_date: '2026-09-25',
        status: 'identified'
      });
      assert.equal(txSep.status, 201);

      const txOctIn = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 300,
        description: 'Tx Outubro 05 A3',
        type: 'income',
        church_id: churchA3,
        bank_id: bankA2,
        transaction_date: '2026-10-05',
        reference_date: '2026-10-05',
        status: 'identified'
      });
      assert.equal(txOctIn.status, 201);

      // Confirma individualmente txSep antes do fechamento multi-mês (testa Decisão 3 na reabertura)
      const confSep = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', ownerAToken, {
        ids: [txSep.data.id],
        isConfirmed: true
      });
      assert.equal(confSep.status, 200);

      // Fecha intervalo personalizado multi-mês: 2026-09-20 a 2026-10-10
      const customClose = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA3,
        year: 2026,
        month: 9,
        periodType: 'custom',
        startDate: '2026-09-20',
        endDate: '2026-10-10',
        status: 'closed'
      });
      assert.equal(customClose.status, 201);

      // Bloqueia em 2026-10-05 (mês seguinte coberto pelo custom!)
      const blockedOct = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 20,
        description: 'Tentativa 05/10 Bloqueado',
        type: 'income',
        church_id: churchA3,
        bank_id: bankA1,
        transaction_date: '2026-10-05',
        reference_date: '2026-10-05',
        status: 'identified'
      });
      assert.equal(blockedOct.status, 422);
      assert.equal(blockedOct.data?.error, 'PERIOD_CLOSED');

      // GET /church-closings/:churchId/2026/10?start_date=2026-10-05&end_date=2026-10-05 encontra fechamento multi-mês
      const getOverlap = await apiJson(
        baseUrl,
        'GET',
        `/api/v1/church-closings/${churchA3}/2026/10?start_date=2026-10-05&end_date=2026-10-05`,
        ownerAToken
      );
      assert.equal(getOverlap.status, 200);
      assert.equal(getOverlap.data?.id, customClose.data.id);

      // Reabre o fechamento multi-mês -> reverte tanto txSep (que era confirmada individualmente!) quanto txOctIn
      const reopenMulti = await apiJson(baseUrl, 'POST', '/api/v1/church-closings/reopen', ownerAToken, {
        churchId: churchA3,
        year: 2026,
        month: 9,
        closingId: customClose.data.id,
        reason: 'Teste reabertura multi-mês'
      });
      assert.equal(reopenMulti.status, 200);
      assert.ok(Array.isArray(reopenMulti.data?.reopenedClosingIds) && reopenMulti.data.reopenedClosingIds.includes(customClose.data.id));

      const txSepAfter = await pool.query('SELECT is_confirmed, status FROM consolidated_transactions WHERE id = $1', [txSep.data.id]);
      const txOctAfter = await pool.query('SELECT is_confirmed, status FROM consolidated_transactions WHERE id = $1', [txOctIn.data.id]);
      assert.equal(Boolean(txSepAfter.rows[0]?.is_confirmed), false, 'Decisão 3: confirmação individual dentro do período reaberto deve ser revertida');
      assert.equal(Boolean(txOctAfter.rows[0]?.is_confirmed), false, 'Tx no segundo mês do intervalo multi-mês deve ser revertida');

      // 4.2 P5-A: Fechamento bancário independente (bankA1) + fechamento consolidado (null) no mesmo mês (Dezembro 2026)
      const txDecBank1 = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 600,
        description: 'Tx Dez Bank1 Protegida P5-A',
        type: 'income',
        church_id: churchA3,
        bank_id: bankA1,
        transaction_date: '2026-12-10',
        reference_date: '2026-12-10',
        status: 'identified'
      });
      const txDecBank2 = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 700,
        description: 'Tx Dez Bank2 Consolidada',
        type: 'income',
        church_id: churchA3,
        bank_id: bankA2,
        transaction_date: '2026-12-12',
        reference_date: '2026-12-12',
        status: 'identified'
      });
      assert.equal(txDecBank1.status, 201);
      assert.equal(txDecBank2.status, 201);

      const closeBank1Dec = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA3,
        bankId: bankA1,
        year: 2026,
        month: 12,
        status: 'closed'
      });
      assert.equal(closeBank1Dec.status, 201);

      const closeConsDec = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA3,
        bankId: null,
        year: 2026,
        month: 12,
        status: 'closed'
      });
      assert.equal(closeConsDec.status, 201);

      // Reabre APENAS o fechamento consolidado de Dezembro
      const reopenConsDec = await apiJson(baseUrl, 'POST', '/api/v1/church-closings/reopen', ownerAToken, {
        churchId: churchA3,
        bankId: null,
        year: 2026,
        month: 12,
        reason: 'Teste P5-A'
      });
      assert.equal(reopenConsDec.status, 200);

      const decB1After = await pool.query('SELECT is_confirmed FROM consolidated_transactions WHERE id = $1', [txDecBank1.data.id]);
      const decB2After = await pool.query('SELECT is_confirmed FROM consolidated_transactions WHERE id = $1', [txDecBank2.data.id]);
      assert.equal(Boolean(decB1After.rows[0]?.is_confirmed), true, 'P5-A: tx coberta por fechamento bancário independente ativo deve permanecer confirmada');
      assert.equal(Boolean(decB2After.rows[0]?.is_confirmed), false, 'Decisão 3: tx sem fechamento bancário independente deve ser revertida');
    });

    // =========================================================================
    // 5. AUD-04 (D-1 A + D-2 A): Bypasses indiretos
    // =========================================================================
    await t.test('[AUD-04 + D-1(A) + D-2(A)] Bloqueios em hard delete de contribuinte, cleanup-invalids, delete de banco/igreja, saved_reports e splits', async () => {
      // 5.1 Contribuinte ligado a transação confirmada
      const contribProtected = await apiJson(baseUrl, 'POST', '/api/v1/contributors', ownerAToken, {
        canonical_name: 'Contribuinte Protegido AUD04',
        cpf: '12345678901',
        church_id: churchA1
      });
      assert.equal(contribProtected.status, 201);
      const contribId = contribProtected.data.id;

      const reportIdProtected = crypto.randomUUID();
      const txLinked = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 250,
        description: 'Dizimo Contribuinte Protegido',
        type: 'income',
        church_id: churchA1,
        bank_id: bankA1,
        contributor_id: contribId,
        report_id: reportIdProtected,
        transaction_date: '2026-06-15',
        reference_date: '2026-06-15',
        status: 'identified'
      });
      assert.equal(txLinked.status, 201);

      const confLinked = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', ownerAToken, {
        ids: [txLinked.data.id],
        isConfirmed: true
      });
      assert.equal(confLinked.status, 200);

      // Hard delete de contribuinte com tx confirmada -> 422 CONTRIBUTOR_HAS_CONFIRMED_TRANSACTIONS
      const hardDelContrib = await apiJson(baseUrl, 'DELETE', `/api/v1/contributors/${contribId}?hard=true`, ownerAToken);
      assert.equal(hardDelContrib.status, 422);
      assert.equal(hardDelContrib.data?.error, 'CONTRIBUTOR_HAS_CONFIRMED_TRANSACTIONS');

      // 5.2 D-2 (A): DELETE /banks/:id e DELETE /churches/:id com histórico confirmado/fechado bloqueados
      const delBankProtected = await apiJson(baseUrl, 'DELETE', `/api/v1/banks/${bankA1}`, ownerAToken);
      assert.equal(delBankProtected.status, 422);
      assert.ok(['BANK_HAS_CLOSINGS', 'BANK_HAS_CONFIRMED_TRANSACTIONS'].includes(delBankProtected.data?.error));

      const delChurchProtected = await apiJson(baseUrl, 'DELETE', `/api/v1/churches/${churchA1}`, ownerAToken);
      assert.equal(delChurchProtected.status, 422);
      assert.ok(['CHURCH_HAS_CLOSINGS', 'CHURCH_HAS_CONFIRMED_TRANSACTIONS'].includes(delChurchProtected.data?.error));

      // Banco e igreja SEM histórico ainda podem ser excluídos legitimamente
      const delBankOpen = await apiJson(baseUrl, 'DELETE', `/api/v1/banks/${bankAOpenDel}`, ownerAToken);
      assert.equal(delBankOpen.status, 200);
      const delChurchOpen = await apiJson(baseUrl, 'DELETE', `/api/v1/churches/${churchAOpenDel}`, ownerAToken);
      assert.equal(delChurchOpen.status, 200);

      // 5.3 D-1 (A): Relatório salvo explícito contendo tx confirmada é imutável (POST upsert, PUT, DELETE -> 422)
      // Insere o relatório salvo explícito já vinculado ao reportIdProtected
      await pool.query(
        'INSERT INTO saved_reports (id, name, record_count, user_id, church_id, data) VALUES ($1, $2, $3, $4, $5, $6)',
        [reportIdProtected, 'Relatorio Homologado Junho', 1, ownerAId, churchA1, JSON.stringify({ results: [] })]
      );

      const postOverwriteRep = await apiJson(baseUrl, 'POST', '/api/v1/saved_reports', ownerAToken, {
        id: reportIdProtected,
        name: 'Tentativa Sobrescrever Relatorio',
        record_count: 0,
        church_id: churchA1,
        data: { results: [] }
      });
      assert.equal(postOverwriteRep.status, 422);
      assert.equal(postOverwriteRep.data?.error, 'REPORT_HAS_CONFIRMED_TRANSACTIONS');

      const putRep = await apiJson(baseUrl, 'PUT', `/api/v1/saved_reports/${reportIdProtected}`, ownerAToken, {
        name: 'Tentativa Editar Relatorio',
        data: { results: [] }
      });
      assert.equal(putRep.status, 422);
      assert.equal(putRep.data?.error, 'REPORT_HAS_CONFIRMED_TRANSACTIONS');

      const delRep = await apiJson(baseUrl, 'DELETE', `/api/v1/saved_reports/${reportIdProtected}`, ownerAToken);
      assert.equal(delRep.status, 422);
      assert.equal(delRep.data?.error, 'REPORT_HAS_CONFIRMED_TRANSACTIONS');

      // D-1 (A): [SESSÃO_ATIVA] continua permitindo autosave contínuo via POST e PUT
      const liveSessionId = crypto.randomUUID();
      const postLive = await apiJson(baseUrl, 'POST', '/api/v1/saved_reports', ownerAToken, {
        id: liveSessionId,
        name: '[SESSÃO_ATIVA]',
        record_count: 1,
        church_id: churchA1,
        data: { results: [{ isConfirmed: true, church: { id: churchA1 }, transaction: { id: txLinked.data.id, date: '2026-06-15' } }] }
      });
      assert.ok([200, 201].includes(postLive.status), `[SESSÃO_ATIVA] deve permitir POST autosave (recebido ${postLive.status})`);

      const putLive = await apiJson(baseUrl, 'PUT', `/api/v1/saved_reports/${liveSessionId}`, ownerAToken, {
        name: '[SESSÃO_ATIVA]',
        record_count: 2,
        data: { results: [] }
      });
      assert.equal(putLive.status, 200, `[SESSÃO_ATIVA] deve permitir PUT autosave (recebido ${putLive.status})`);

      // 5.4 PUT /consolidated_transactions/:id com splits em igreja fechada bloqueia confirmação pura
      // churchA2 está fechada em Julho 2026 (teste 3). Cria tx aberta em churchA1 em Julho 2026 e tenta confirmar com split em churchA2
      const txSplitId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO consolidated_transactions (
          id, user_id, church_id, bank_id, amount, description, type, status, is_confirmed,
          transaction_date, reference_date, splits
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10, $11)`,
        [
          txSplitId, ownerAId, churchA1, bankA1, 300, 'Rateio com Julho A2 Fechado', 'income', 'identified',
          '2026-07-18', '2026-07-18',
          JSON.stringify([{ churchId: churchA2, amount: 150 }])
        ]
      );

      const confirmSplitClosed = await apiJson(baseUrl, 'PUT', `/api/v1/consolidated_transactions/${txSplitId}`, ownerAToken, {
        is_confirmed: true
      });
      assert.equal(confirmSplitClosed.status, 422);
      assert.equal(confirmSplitClosed.data?.error, 'PERIOD_CLOSED');
    });

    // =========================================================================
    // 6. AUD-07: financial_records ACID + proteção de bank_transaction_id
    // =========================================================================
    await t.test('[AUD-07] financial_records bloqueia desvinculação, edição e exclusão quando ligado a bank_transaction_id confirmado', async () => {
      // Cria transação bancária em Maio (aberta) e vincula um financial_record com due_date em Abril (outro mês aberto)
      const bankTx = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: -450,
        description: 'Pagamento Energia Maio',
        type: 'expense',
        church_id: churchA1,
        bank_id: bankA1,
        transaction_date: '2026-05-10',
        reference_date: '2026-05-10',
        status: 'identified'
      });
      assert.equal(bankTx.status, 201);

      const finLinked = await apiJson(baseUrl, 'POST', '/api/v1/financial_records', ownerAToken, {
        church_id: churchA1,
        title: 'Fatura Energia Maio',
        amount: 450,
        type: 'expense',
        due_date: '2026-04-28',
        payment_date: '2026-04-28',
        bank_transaction_id: bankTx.data.id
      });
      assert.equal(finLinked.status, 201);

      // Agora confirma a transação bancária (2026-05-10)
      const confBankTx = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', ownerAToken, {
        ids: [bankTx.data.id],
        isConfirmed: true
      });
      assert.equal(confBankTx.status, 200);

      // Tentativa 1: Desvincular bank_transaction_id = null -> 422 TRANSACTION_CONFIRMED
      const unlinkAttempt = await apiJson(baseUrl, 'PUT', `/api/v1/financial_records/${finLinked.data.id}`, ownerAToken, {
        bank_transaction_id: null
      });
      assert.equal(unlinkAttempt.status, 422);
      assert.equal(unlinkAttempt.data?.error, 'TRANSACTION_CONFIRMED');

      // Tentativa 2: Editar título/valor -> 422 TRANSACTION_CONFIRMED
      const editAttempt = await apiJson(baseUrl, 'PUT', `/api/v1/financial_records/${finLinked.data.id}`, ownerAToken, {
        title: 'Tentativa Alterar Valor',
        amount: 999
      });
      assert.equal(editAttempt.status, 422);
      assert.equal(editAttempt.data?.error, 'TRANSACTION_CONFIRMED');

      // Tentativa 3: Excluir o financial_record -> 422 TRANSACTION_CONFIRMED
      const deleteAttempt = await apiJson(baseUrl, 'DELETE', `/api/v1/financial_records/${finLinked.data.id}`, ownerAToken);
      assert.equal(deleteAttempt.status, 422);
      assert.equal(deleteAttempt.data?.error, 'TRANSACTION_CONFIRMED');

      // Tentativa 4: Criar novo financial_record apontando para bankTx já confirmado -> 422 TRANSACTION_CONFIRMED
      const createLinkedToConfirmed = await apiJson(baseUrl, 'POST', '/api/v1/financial_records', ownerAToken, {
        church_id: churchA1,
        title: 'Novo Registro Em Tx Confirmada',
        amount: 100,
        type: 'expense',
        due_date: '2026-04-20',
        bank_transaction_id: bankTx.data.id
      });
      assert.equal(createLinkedToConfirmed.status, 422);
      assert.equal(createLinkedToConfirmed.data?.error, 'TRANSACTION_CONFIRMED');

      // Registro financeiro aberto sem vínculo confirmado continua editável e excluível
      const finOpen = await apiJson(baseUrl, 'POST', '/api/v1/financial_records', ownerAToken, {
        church_id: churchA1,
        title: 'Registro Aberto Abril',
        amount: 120,
        type: 'expense',
        due_date: '2026-04-15'
      });
      assert.equal(finOpen.status, 201);
      const updOpen = await apiJson(baseUrl, 'PUT', `/api/v1/financial_records/${finOpen.data.id}`, ownerAToken, {
        title: 'Registro Aberto Abril Editado'
      });
      assert.equal(updOpen.status, 200);
      const delOpen = await apiJson(baseUrl, 'DELETE', `/api/v1/financial_records/${finOpen.data.id}`, ownerAToken);
      assert.equal(delOpen.status, 200);
    });

    // =========================================================================
    // 7. AUD-06: Concorrência ACID e coordenação de locks no LocalSqliteEngine
    // =========================================================================
    await t.test('[AUD-06] Concorrência simultânea entre POST /church-closings e escritas paralelas sem SQLITE_BUSY nem commit parcial', async () => {
      // Dispara fechamento de Março/2026 (churchA3) simultaneamente com 6 escritas concorrentes no mesmo mês
      const closePromise = apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA3,
        year: 2026,
        month: 3,
        status: 'closed'
      });

      const writePromises = [1, 2, 3].map((idx) =>
        apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
          amount: 10 * idx,
          description: `Corrida Tx ${idx}`,
          type: 'income',
          church_id: churchA3,
          bank_id: bankA1,
          transaction_date: `2026-03-0${idx}`,
          reference_date: `2026-03-0${idx}`,
          status: 'identified'
        })
      );

      const finPromises = [1, 2, 3].map((idx) =>
        apiJson(baseUrl, 'POST', '/api/v1/financial_records', ownerAToken, {
          church_id: churchA3,
          title: `Corrida Fin ${idx}`,
          amount: 15 * idx,
          type: 'expense',
          due_date: `2026-03-1${idx}`
        })
      );

      const [closeRes, ...otherRes] = await Promise.all([closePromise, ...writePromises, ...finPromises]);
      assert.equal(closeRes.status, 201, `Fechamento concorrente deve concluir com 201 (recebido ${closeRes.status}: ${JSON.stringify(closeRes.data)})`);

      for (const r of otherRes) {
        assert.ok(
          r.status === 201 || r.status === 422,
          `Escrita concorrente deve concluir atomicamente com 201 (antes do fechamento) ou 422 (após fechamento), nunca 500/SQLITE_BUSY (recebido ${r.status}: ${JSON.stringify(r.data)})`
        );
      }

      // Garante invariante: nenhuma transação de Março/2026 em churchA3 ficou sem is_confirmed = true após o fechamento!
      const unconfirmedAfterClose = await pool.query(
        `SELECT id FROM consolidated_transactions
         WHERE church_id = $1 AND substr(COALESCE(reference_date, transaction_date), 1, 7) = '2026-03'
           AND COALESCE(is_confirmed, 0) = 0`,
        [churchA3]
      );
      assert.equal(
        unconfirmedAfterClose.rows.length,
        0,
        `Invariante ACID violada: existem transações não confirmadas após fechamento concorrente (${unconfirmedAfterClose.rows.length})`
      );
    });

    // =========================================================================
    // 8. ETAPA 10 (DIFF-01, DIFF-02, DIFF-03): Escopo por banco na reabertura,
    //    tipagem estrita PG (UUID/TIMESTAMP/JSONB) e lock não-bloqueante de destino
    // =========================================================================
    await t.test('[ETAPA-10 / DIFF-01..DIFF-03] Reabertura via closingId preserva outros bancos, coerção estrita PG e lock não-bloqueante de destino', async () => {
      // 8.1 DIFF-01: Fechamento bancário (bankA1) em Novembro/2026 + tx confirmada em bankA2 no mesmo mês
      const txNovBank1 = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 410,
        description: 'Tx Nov Bank1 Fechamento Bancario',
        type: 'income',
        church_id: churchA3,
        bank_id: bankA1,
        transaction_date: '2026-11-05',
        reference_date: '2026-11-05',
        status: 'identified'
      });
      const txNovBank2 = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 520,
        description: 'Tx Nov Bank2 Confirmada Independentemente',
        type: 'income',
        church_id: churchA3,
        bank_id: bankA2,
        transaction_date: '2026-11-06',
        reference_date: '2026-11-06',
        status: 'identified'
      });
      assert.equal(txNovBank1.status, 201);
      assert.equal(txNovBank2.status, 201);

      const confNovBank2 = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', ownerAToken, {
        ids: [txNovBank2.data.id],
        isConfirmed: true
      });
      assert.equal(confNovBank2.status, 200);

      const closeNovBank1 = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA3,
        bankId: bankA1,
        year: 2026,
        month: 11,
        status: 'closed'
      });
      assert.equal(closeNovBank1.status, 201);

      // Reabre passando APENAS closingId (SEM bankId!) -> deve derivar bankA1 da linha e NÃO tocar em bankA2
      const reopenByIdOnly = await apiJson(baseUrl, 'POST', '/api/v1/church-closings/reopen', ownerAToken, {
        churchId: churchA3,
        year: 2026,
        month: 11,
        closingId: closeNovBank1.data.id,
        reason: 'Teste DIFF-01 closingId sem bankId'
      });
      assert.equal(reopenByIdOnly.status, 200);
      assert.equal(reopenByIdOnly.data?.bankId, bankA1, 'DIFF-01: resposta deve refletir bank_id real do fechamento reaberto');

      const novB1After = await pool.query('SELECT is_confirmed FROM consolidated_transactions WHERE id = $1', [txNovBank1.data.id]);
      const novB2After = await pool.query('SELECT is_confirmed FROM consolidated_transactions WHERE id = $1', [txNovBank2.data.id]);
      assert.equal(Boolean(novB1After.rows[0]?.is_confirmed), false, 'DIFF-01: tx do banco reaberto (bankA1) deve ser revertida');
      assert.equal(Boolean(novB2After.rows[0]?.is_confirmed), true, 'DIFF-01: tx confirmada de OUTRO banco (bankA2) deve permanecer confirmada');

      // 8.2 DIFF-02: confirm-batch normaliza bank_id sentinela não-UUID ("manual") para null (evita PG 22P02)
      const txManualBank = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions', ownerAToken, {
        amount: 95,
        description: 'Tx Manual Normalizacao UUID',
        type: 'income',
        church_id: churchA3,
        transaction_date: '2026-11-18',
        reference_date: '2026-11-18',
        status: 'identified'
      });
      assert.equal(txManualBank.status, 201);

      const confSentinelBank = await apiJson(baseUrl, 'POST', '/api/v1/consolidated_transactions/confirm-batch', ownerAToken, {
        ids: [txManualBank.data.id],
        isConfirmed: true,
        bankId: 'manual'
      });
      assert.equal(confSentinelBank.status, 200);
      const manualAfter = await pool.query('SELECT bank_id, is_confirmed FROM consolidated_transactions WHERE id = $1', [txManualBank.data.id]);
      assert.equal(manualAfter.rows[0]?.bank_id ?? null, null, 'DIFF-02: sentinela "manual" não pode ser gravada em coluna UUID bank_id');
      assert.equal(Boolean(manualAfter.rows[0]?.is_confirmed), true);

      // 8.3 DIFF-02: PUT/DELETE financial_records com ID não-UUID retorna 404 (nunca 500 22P02);
      // e PUT com payment_date="" + attachments string JSON faz coerção segura para null sem dupla serialização
      const putNotFound = await apiJson(baseUrl, 'PUT', '/api/v1/financial_records/not-a-valid-uuid', ownerAToken, {
        title: 'Inexistente'
      });
      assert.equal(putNotFound.status, 404);
      const delNotFound = await apiJson(baseUrl, 'DELETE', '/api/v1/financial_records/not-a-valid-uuid', ownerAToken);
      assert.equal(delNotFound.status, 404);

      const postInvalidFinId = await apiJson(baseUrl, 'POST', '/api/v1/financial_records', ownerAToken, {
        id: 'not-a-valid-uuid',
        church_id: churchA3,
        title: 'ID Invalido',
        amount: 50,
        type: 'expense',
        due_date: '2026-04-12'
      });
      assert.equal(postInvalidFinId.status, 400);

      const finCoerce = await apiJson(baseUrl, 'POST', '/api/v1/financial_records', ownerAToken, {
        church_id: churchA3,
        title: 'Coercao PG',
        amount: 80,
        type: 'expense',
        due_date: '2026-04-14',
        payment_date: '2026-04-14'
      });
      assert.equal(finCoerce.status, 201);
      const rawAttJson = JSON.stringify([{ name: 'recibo.pdf' }]);
      const putCoerce = await apiJson(baseUrl, 'PUT', `/api/v1/financial_records/${finCoerce.data.id}`, ownerAToken, {
        payment_date: '',
        attachments: rawAttJson
      });
      assert.equal(putCoerce.status, 200);
      const coercedRow = await pool.query('SELECT payment_date, attachments FROM financial_records WHERE id = $1', [finCoerce.data.id]);
      assert.equal(coercedRow.rows[0]?.payment_date ?? null, null, 'DIFF-02: payment_date="" deve virar null em PUT');
      assert.equal(String(coercedRow.rows[0]?.attachments), rawAttJson, 'DIFF-02: attachments string JSON não deve sofrer dupla serialização');

      // 8.4 DIFF-02: transferTransactions com ID não-UUID é rejeitado com 400 VALIDATION_ERROR
      const badLegUuidClose = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
        churchId: churchA3,
        year: 2026,
        month: 2,
        status: 'closed',
        transferredBalance: 50,
        transferTransactions: [{
          id: 'not-a-uuid-leg',
          church_id: churchA3,
          amount: -50,
          type: 'expense',
          description: 'Perna ID Invalido',
          transaction_date: '2026-02-28',
          reference_date: '2026-02-28'
        }]
      });
      assert.equal(badLegUuidClose.status, 400);

      // 8.5 DIFF-03: Fechamento com transferência para destino sob lock exclusivo retorna 409 CLOSING_IN_PROGRESS sem deadlock
      const lockHolderClient = await pool.connect();
      const hashStr = (str: string) => {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        return h;
      };
      const k1 = hashStr(`church:${churchA1}`);
      const k2 = hashStr(`period:all:2026:2`);
      try {
        // Simula fechamento concorrente travando churchA1 em 2026-02 (mesma chave de getClosingLockKeys)
        const held = await lockHolderClient.query('SELECT pg_try_advisory_lock($1, $2) as acquired', [k1, k2]);
        assert.equal(Boolean(held.rows[0]?.acquired), true);

        const conflictDestClose = await apiJson(baseUrl, 'POST', '/api/v1/church-closings', ownerAToken, {
          churchId: churchA3,
          year: 2026,
          month: 2,
          status: 'closed',
          targetChurchId: churchA1,
          transferredBalance: 100
        });
        assert.equal(conflictDestClose.status, 409, `DIFF-03: destino travado deve retornar 409 sem deadlock (recebido ${conflictDestClose.status}: ${JSON.stringify(conflictDestClose.data)})`);
        assert.equal(conflictDestClose.data?.error, 'CLOSING_IN_PROGRESS');
      } finally {
        try { await lockHolderClient.query('SELECT pg_advisory_unlock($1, $2)', [k1, k2]); } catch (_) {}
        lockHolderClient.release();
      }
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      (pool as any).localEngine?.db?.close?.();
    } catch (_) {}
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        if (fs.existsSync(`${tmpDbPath}${suffix}`)) {
          fs.unlinkSync(`${tmpDbPath}${suffix}`);
        }
      } catch (_) {}
    }
  }

  // Confirmação absoluta de isolamento (D-4 A): data/contributors_local.sqlite permaneceu intocado
  if (canonicalExistedBefore) {
    assert.equal(
      fs.statSync(canonicalDbPath).mtimeMs,
      canonicalMtimeBefore,
      'ERRO CRÍTICO DE ISOLAMENTO: data/contributors_local.sqlite foi modificado!'
    );
  }

  console.log(`\n=== RESUMO INTEGRAÇÃO ISOLADA AUD-01..AUD-07: ${passed}/${passed + failed} aprovados (${failed} falhas) ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error('❌ ERRO FATAL NA SUÍTE ISOLADA:', err);
  process.exit(1);
});
