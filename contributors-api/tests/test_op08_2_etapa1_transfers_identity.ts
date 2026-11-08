import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP082Etapa1Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE INTEGRIDADE E IDENTIDADE — OP-08.2 ETAPA 1');
  console.log('   IDENTIFICAÇÃO DAS DUAS PERNAS E LIMPEZA SEGURA DOS TRANSPORTES');
  console.log('========================================================================\n');

  const ownerId = '00000000-0000-0000-0000-000000000001';
  const churchOriginId = '00000000-0000-0000-0000-000000000001'; // Congregação Origem
  const churchDestId = '00000000-0000-0000-0000-000000000099';   // Congregação Destino (Sede)
  const otherChurchId = '00000000-0000-0000-0000-000000000777';  // Outra Congregação

  const bankA = 'banco-bradesco-001';
  const bankB = 'banco-itau-002';
  const year = 2026;
  const month = 11;
  const nextMonth = 12;

  // 1. Setup local sqlite baseline
  try {
    const sqlitePath = 'data/contributors_local.sqlite';
    const db = new DatabaseSync(sqlitePath);
    db.function('now', () => new Date().toISOString());

    db.exec(`
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        email TEXT,
        owner_id TEXT,
        role TEXT DEFAULT 'user'
      );
      CREATE TABLE IF NOT EXISTS churches (
        id TEXT PRIMARY KEY,
        name TEXT,
        user_id TEXT
      );
      CREATE TABLE IF NOT EXISTS church_closings (
        id TEXT PRIMARY KEY,
        church_id TEXT,
        year INTEGER,
        month INTEGER,
        bank_id TEXT,
        status TEXT DEFAULT 'closed',
        transferred REAL,
        target_church_id TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS consolidated_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        church_id TEXT,
        date TEXT,
        transaction_date TEXT,
        description TEXT,
        amount REAL,
        type TEXT,
        pix_key TEXT,
        source TEXT DEFAULT 'file',
        status TEXT DEFAULT 'pending',
        bank_id TEXT,
        row_hash TEXT,
        is_confirmed INTEGER DEFAULT 0,
        category TEXT,
        contributor_id TEXT,
        report_id TEXT,
        payment_method TEXT,
        contribution_type TEXT,
        contribution_request_id TEXT,
        splits TEXT,
        reference_date TEXT,
        attachments TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (now()),
        updated_at TEXT DEFAULT (now())
      );
    `);

    // Inserir igrejas vinculadas ao owner
    db.prepare('INSERT OR REPLACE INTO churches (id, name, user_id) VALUES (?, ?, ?)').run(
      churchOriginId, 'Congregação Origem A', ownerId
    );
    db.prepare('INSERT OR REPLACE INTO churches (id, name, user_id) VALUES (?, ?, ?)').run(
      churchDestId, 'Igreja Sede Destino', ownerId
    );
    db.prepare('INSERT OR REPLACE INTO churches (id, name, user_id) VALUES (?, ?, ?)').run(
      otherChurchId, 'Outra Igreja', ownerId
    );

    // Limpar quaisquer transações prévias de teste para os meses 11 e 12
    db.prepare("DELETE FROM consolidated_transactions WHERE transaction_date LIKE '2026-11%' OR transaction_date LIKE '2026-12%'").run();
    db.prepare("DELETE FROM church_closings WHERE year = 2026 AND (month = 11 OR month = 12)").run();

    db.close();
  } catch (err: any) {
    console.warn('[SEED WARNING]', err.message);
  }

  // 2. Start server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  const token = generateAccessToken({
    userId: ownerId,
    ownerId: ownerId,
    role: 'owner',
    permissions: ['all']
  }).token;

  async function requestApi(path: string, options: { method: string; body?: any }) {
    const url = new URL(path, baseUrl);
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        url,
        {
          method: options.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode || 500, body: data ? JSON.parse(data) : {} });
            } catch {
              resolve({ status: res.statusCode || 500, body: data });
            }
          });
        }
      );
      req.on('error', reject);
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  }

  let passedTests = 0;
  let totalTests = 10;

  try {
    // -------------------------------------------------------------------------
    // CENÁRIO 1: Fechamento do Banco A grava report_id igual nas duas pernas
    // -------------------------------------------------------------------------
    console.log('📌 CENÁRIO 1: Fechamento do Banco A grava report_id igual nas duas pernas');
    const resClosingA = await requestApi('/api/v1/church-closings', {
      method: 'POST',
      body: {
        church_id: churchOriginId,
        year,
        month,
        bank_id: bankA,
        status: 'closed',
        transferred_balance: 1500.00,
        target_church_id: churchDestId,
        target_church_name: 'Sede Central',
        notes: 'FECHAMENTO BRADESCO 11/2026'
      }
    });

    if (resClosingA.status !== 200 && resClosingA.status !== 201) {
      throw new Error(`Falha ao fechar Banco A: HTTP ${resClosingA.status} - ${JSON.stringify(resClosingA.body)}`);
    }

    const txsBankA = await pool.query(
      `SELECT id, church_id, bank_id, amount, type, report_id, row_hash, is_confirmed 
       FROM consolidated_transactions 
       WHERE report_id = $1 OR row_hash LIKE $2`,
      [`closing_${churchOriginId}_${bankA}_${year}_${month}`, `closing-%-${churchOriginId}-${bankA}-%`]
    );

    const rowsA = txsBankA.rows || [];
    console.log(`   Transações gravadas para Banco A: ${rowsA.length}`);
    if (rowsA.length !== 2) {
      throw new Error(`Esperava 2 pernas para Banco A, encontrou ${rowsA.length}`);
    }

    const originLegA = rowsA.find((r: any) => String(r.church_id) === churchOriginId);
    const destLegA = rowsA.find((r: any) => String(r.church_id) === churchDestId);

    if (!originLegA || !destLegA) {
      throw new Error('Não encontrou perna de origem ou destino para Banco A.');
    }

    const expectedReportIdA = `closing_${churchOriginId}_${bankA}_${year}_${month}`;
    if (originLegA.report_id !== expectedReportIdA || destLegA.report_id !== expectedReportIdA) {
      throw new Error(`report_id divergente: origem=${originLegA.report_id}, destino=${destLegA.report_id}, esperado=${expectedReportIdA}`);
    }
    if (originLegA.bank_id !== bankA) {
      throw new Error(`Origem Banco A deveria ter bank_id=${bankA}, tem ${originLegA.bank_id}`);
    }
    if (destLegA.bank_id !== null) {
      throw new Error(`Destino Banco A deveria ter bank_id=null (caixa geral destino), tem ${destLegA.bank_id}`);
    }
    if (!originLegA.row_hash.includes(bankA) || !destLegA.row_hash.includes(bankA)) {
      throw new Error(`row_hash não contém discriminador do banco: ${originLegA.row_hash}, ${destLegA.row_hash}`);
    }
    console.log('   ✅ Cenário 1 APROVADO: Ambas as pernas possuem report_id idêntico e discriminador no row_hash.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // CENÁRIO 2: Fechamento do Banco B utiliza identificação independente
    // -------------------------------------------------------------------------
    console.log('📌 CENÁRIO 2: Fechamento do Banco B no mesmo período e preservação do Banco A');
    const resClosingB = await requestApi('/api/v1/church-closings', {
      method: 'POST',
      body: {
        church_id: churchOriginId,
        year,
        month,
        bank_id: bankB,
        status: 'closed',
        transferred_balance: 2800.00,
        target_church_id: churchDestId,
        target_church_name: 'Sede Central',
        notes: 'FECHAMENTO ITAU 11/2026'
      }
    });

    if (resClosingB.status !== 200 && resClosingB.status !== 201) {
      throw new Error(`Falha ao fechar Banco B: HTTP ${resClosingB.status}`);
    }

    const allMonthTxs = await pool.query(
      `SELECT id, church_id, bank_id, amount, report_id, row_hash 
       FROM consolidated_transactions 
       WHERE transaction_date LIKE '2026-11%' AND source = 'closing'`
    );

    const rowsAll = allMonthTxs.rows || [];
    console.log(`   Total de transações de fechamento no mês: ${rowsAll.length}`);
    if (rowsAll.length !== 4) {
      throw new Error(`Esperava 4 transações (2 de A + 2 de B), encontrou ${rowsAll.length}`);
    }

    const expectedReportIdB = `closing_${churchOriginId}_${bankB}_${year}_${month}`;
    const rowsB = rowsAll.filter((r: any) => r.report_id === expectedReportIdB);
    if (rowsB.length !== 2) {
      throw new Error(`Esperava 2 pernas para Banco B, encontrou ${rowsB.length}`);
    }
    const rowsARemain = rowsAll.filter((r: any) => r.report_id === expectedReportIdA);
    if (rowsARemain.length !== 2) {
      throw new Error(`Transportes do Banco A foram corrompidos pelo fechamento do Banco B!`);
    }

    console.log('   ✅ Cenário 2 APROVADO: Banco B criado com identificação independente; Banco A 100% preservado.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // CENÁRIO 3 & 4: Reabertura do Banco A remove somente suas duas pernas e preserva o Banco B
    // -------------------------------------------------------------------------
    console.log('📌 CENÁRIOS 3 & 4: Reabertura do Banco A via DELETE preserva Banco B');
    const resDeleteA = await requestApi(`/api/v1/church-closings/${churchOriginId}/${year}/${month}?bank_id=${bankA}`, {
      method: 'DELETE'
    });

    if (resDeleteA.status !== 200) {
      throw new Error(`Falha ao reabrir Banco A: HTTP ${resDeleteA.status}`);
    }

    const txsAfterDeleteA = await pool.query(
      `SELECT id, church_id, bank_id, amount, report_id, row_hash 
       FROM consolidated_transactions 
       WHERE transaction_date LIKE '2026-11%' AND source = 'closing'`
    );

    const rowsAfterDelA = txsAfterDeleteA.rows || [];
    const remainingA = rowsAfterDelA.filter((r: any) => r.report_id === expectedReportIdA);
    const remainingB = rowsAfterDelA.filter((r: any) => r.report_id === expectedReportIdB);

    if (remainingA.length !== 0) {
      throw new Error(`Pernas do Banco A ainda existem após reabertura: ${remainingA.length}`);
    }
    if (remainingB.length !== 2) {
      throw new Error(`Banco B foi indevidamente apagado na reabertura do Banco A! Restaram ${remainingB.length}`);
    }

    console.log('   ✅ Cenário 3 APROVADO: Pernas do Banco A excluídas com sucesso.');
    passedTests++;
    console.log('   ✅ Cenário 4 APROVADO: Pernas do Banco B rigorosamente preservadas.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // CENÁRIO 5: Reabertura geral remove transportes gerais e preserva os bancos individuais
    // -------------------------------------------------------------------------
    console.log('📌 CENÁRIO 5: Fechamento e Reabertura Geral vs Bancos Individuais');
    // Recria Banco A para ter ambos A e B
    await requestApi('/api/v1/church-closings', {
      method: 'POST',
      body: {
        church_id: churchOriginId,
        year,
        month,
        bank_id: bankA,
        status: 'closed',
        transferred_balance: 1500.00,
        target_church_id: churchDestId
      }
    });

    // Cria fechamento geral (sem bank_id / consolidado)
    const resClosingGeneral = await requestApi('/api/v1/church-closings', {
      method: 'POST',
      body: {
        church_id: churchOriginId,
        year,
        month,
        bank_id: null,
        status: 'closed',
        transferred_balance: 5000.00,
        target_church_id: churchDestId,
        notes: 'FECHAMENTO GERAL CAIXA 11/2026'
      }
    });

    if (resClosingGeneral.status !== 200 && resClosingGeneral.status !== 201) {
      throw new Error(`Falha ao fechar consolidado geral: HTTP ${resClosingGeneral.status}`);
    }

    const expectedReportIdGeneral = `closing_${churchOriginId}_${year}_${month}`;
    const txsBeforeGenDel = await pool.query(
      `SELECT id, report_id FROM consolidated_transactions WHERE transaction_date LIKE '2026-11%' AND source = 'closing'`
    );
    // Espera 2 de A + 2 de B + 2 de Geral = 6
    if (txsBeforeGenDel.rows.length !== 6) {
      throw new Error(`Esperava 6 lançamentos antes da reabertura geral, encontrou ${txsBeforeGenDel.rows.length}`);
    }

    // Executa reabertura geral (sem bank_id) via POST /reopen
    const resReopenGeneral = await requestApi('/api/v1/church-closings/reopen', {
      method: 'POST',
      body: {
        church_id: churchOriginId,
        year,
        month,
        bank_id: null
      }
    });

    if (resReopenGeneral.status !== 200) {
      throw new Error(`Falha ao reabrir consolidado geral via POST reopen: HTTP ${resReopenGeneral.status}`);
    }

    const txsAfterGenReopen = await pool.query(
      `SELECT id, report_id, bank_id FROM consolidated_transactions WHERE transaction_date LIKE '2026-11%' AND source = 'closing'`
    );

    const rowsAfterGen = txsAfterGenReopen.rows || [];
    const genRemaining = rowsAfterGen.filter((r: any) => r.report_id === expectedReportIdGeneral);
    const aRemaining = rowsAfterGen.filter((r: any) => r.report_id === expectedReportIdA);
    const bRemaining = rowsAfterGen.filter((r: any) => r.report_id === expectedReportIdB);

    if (genRemaining.length !== 0) {
      throw new Error(`Transportes do fechamento geral ainda existem após reabertura geral!`);
    }
    if (aRemaining.length !== 2 || bRemaining.length !== 2) {
      throw new Error(`Reabertura geral corrompeu bancos individuais! A=${aRemaining.length}, B=${bRemaining.length}`);
    }

    console.log('   ✅ Cenário 5 APROVADO: Reabertura geral removeu somente transportes gerais e preservou bancos A e B.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // CENÁRIO 6: Perna de destino com bank_id NULL de um transporte bancário não é excluída pela reabertura geral
    // -------------------------------------------------------------------------
    console.log('📌 CENÁRIO 6: Destino com bank_id NULL de Banco A/B sobrevive à reabertura geral');
    const destLegsRemaining = rowsAfterGen.filter((r: any) => String(r.church_id) === churchDestId || r.bank_id === null);
    if (destLegsRemaining.length !== 2) { // 1 perna destino de A + 1 perna destino de B
      throw new Error(`Esperava 2 pernas destino sobreviventes, encontrou ${destLegsRemaining.length}`);
    }
    console.log('   ✅ Cenário 6 APROVADO: Pernas de destino com bank_id NULL de fechamentos bancários foram protegidas.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // CENÁRIO 7: Registros legados ambíguos são preservados
    // -------------------------------------------------------------------------
    console.log('📌 CENÁRIO 7: Preservação de registros manuais / legados ambíguos');
    const legacyManualId = 'legacy-manual-tx-uuid-1111';
    await pool.query(
      `INSERT INTO consolidated_transactions (
        id, user_id, church_id, bank_id, amount, type, description, 
        transaction_date, reference_date, row_hash, source, status, 
        is_confirmed, report_id
      ) VALUES ($1, $2, $3, NULL, 350.00, 'income', 'OFERTA MANUAL DE FECHAMENTO LEGADO', '2026-11-15', '2026-11-15', 'legacy-hash-1111', 'manual', 'identified', 1, NULL)`,
      [legacyManualId, ownerId, churchOriginId]
    );

    // Reabre Banco B
    await requestApi(`/api/v1/church-closings/${churchOriginId}/${year}/${month}?bank_id=${bankB}`, {
      method: 'DELETE'
    });

    // Reabre geral novamente
    await requestApi(`/api/v1/church-closings/${churchOriginId}/${year}/${month}`, {
      method: 'DELETE'
    });

    const checkLegacy = await pool.query(
      `SELECT id FROM consolidated_transactions WHERE id = $1`,
      [legacyManualId]
    );

    if (checkLegacy.rows.length === 0) {
      throw new Error('Registro legado com bank_id NULL e report_id NULL foi indevidamente apagado!');
    }
    console.log('   ✅ Cenário 7 APROVADO: Lançamento manual/legado com bank_id NULL e report_id NULL preservado.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // CENÁRIO 8: Registros de outra congregação ou de outro período são preservados
    // -------------------------------------------------------------------------
    console.log('📌 CENÁRIO 8: Isolamento entre congregações e entre períodos');
    // Cria fechamento em outra congregação no mesmo mês
    await requestApi('/api/v1/church-closings', {
      method: 'POST',
      body: {
        church_id: otherChurchId,
        year,
        month,
        bank_id: bankA,
        status: 'closed',
        transferred_balance: 700.00,
        target_church_id: churchDestId
      }
    });

    // Cria fechamento na mesma congregação no mês seguinte (mês 12)
    await requestApi('/api/v1/church-closings', {
      method: 'POST',
      body: {
        church_id: churchOriginId,
        year,
        month: nextMonth,
        bank_id: bankA,
        status: 'closed',
        transferred_balance: 900.00,
        target_church_id: churchDestId
      }
    });

    // Reabre Banco A no mês 11 na igreja de origem
    await requestApi(`/api/v1/church-closings/${churchOriginId}/${year}/${month}?bank_id=${bankA}`, {
      method: 'DELETE'
    });

    const txsOtherChurch = await pool.query(
      `SELECT id FROM consolidated_transactions WHERE church_id = $1 AND transaction_date LIKE '2026-11%'`,
      [otherChurchId]
    );
    const txsNextMonth = await pool.query(
      `SELECT id FROM consolidated_transactions WHERE church_id = $1 AND transaction_date LIKE '2026-12%'`,
      [churchOriginId]
    );

    if (txsOtherChurch.rows.length === 0) {
      throw new Error('Transações de outra congregação foram apagadas pela reabertura!');
    }
    if (txsNextMonth.rows.length === 0) {
      throw new Error('Transações do mês seguinte foram apagadas pela reabertura do mês anterior!');
    }

    console.log('   ✅ Cenário 8 APROVADO: Isolamento total entre congregações e meses.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // CENÁRIO 9: A Lista Viva não é impactada (regra !tx.report_id)
    // -------------------------------------------------------------------------
    console.log('📌 CENÁRIO 9: Validação da estabilidade da Lista Viva');
    // Na Lista Viva (ConsolidationService): `is_confirmed === false && !tx.report_id`
    // Como os transportes possuem is_confirmed = true e report_id = effId,
    // eles nunca entram na fila de transações pendentes da Lista Viva.
    const month12Txs = await pool.query(
      `SELECT id, is_confirmed, report_id, status FROM consolidated_transactions WHERE transaction_date LIKE '2026-12%'`
    );

    for (const tx of month12Txs.rows) {
      const wouldEnterLivePendingList = (tx.is_confirmed === false || tx.is_confirmed === 0) && !tx.report_id;
      if (wouldEnterLivePendingList) {
        throw new Error(`Transporte contábil entraria na fila pendente da Lista Viva: ${tx.id}`);
      }
      if (!tx.report_id) {
        throw new Error(`Transporte gerado está com report_id nulo: ${tx.id}`);
      }
    }
    console.log('   ✅ Cenário 9 APROVADO: Transportes possuem is_confirmed=1 e report_id preenchido, mantendo estabilidade da Lista Viva.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // CENÁRIO 10: O Livro Caixa continua reconhecendo as duas pernas dos transportes
    // -------------------------------------------------------------------------
    console.log('📌 CENÁRIO 10: Integridade contábil das duas pernas no Livro Caixa');
    const txsM12 = await pool.query(
      `SELECT id, church_id, bank_id, amount, type, report_id, contribution_type 
       FROM consolidated_transactions 
       WHERE report_id = $1`,
      [`closing_${churchOriginId}_${bankA}_${year}_${nextMonth}`]
    );

    if (txsM12.rows.length !== 2) {
      throw new Error(`Esperava 2 pernas para o fechamento do mês 12, encontrou ${txsM12.rows.length}`);
    }

    const outLeg = txsM12.rows.find((t: any) => String(t.church_id) === churchOriginId);
    const inLeg = txsM12.rows.find((t: any) => String(t.church_id) === churchDestId);

    if (!outLeg || !inLeg) {
      throw new Error('Pernas de saída ou entrada ausentes no mês 12');
    }

    if (outLeg.amount !== -900 || outLeg.type !== 'expense') {
      throw new Error(`Perna de saída incorreta: amount=${outLeg.amount}, type=${outLeg.type}`);
    }
    if (inLeg.amount !== 900 || inLeg.type !== 'income') {
      throw new Error(`Perna de entrada incorreta: amount=${inLeg.amount}, type=${inLeg.type}`);
    }
    if (outLeg.amount + inLeg.amount !== 0) {
      throw new Error('Desbalanceamento contábil: soma das duas pernas não é zero.');
    }

    console.log('   ✅ Cenário 10 APROVADO: Duas pernas perfeitamente balanceadas (+900 / -900) e reconhecíveis pelo Livro Caixa.\n');
    passedTests++;

    console.log('========================================================================');
    console.log(`🎉 RESULTADO GERAL: ${passedTests}/${totalTests} CENÁRIOS APROVADOS COM SUCESSO!`);
    console.log('========================================================================\n');
  } finally {
    server.close();
  }
}

runOP082Etapa1Tests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ ERRO NA BATERIA DE TESTES:', err);
    process.exit(1);
  });
