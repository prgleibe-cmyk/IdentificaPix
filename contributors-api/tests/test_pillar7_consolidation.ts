import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import { parseAmountSafely, ExportService } from '../../services/ExportService.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runPillar7Consolidation() {
  console.log('========================================================================');
  console.log('🏛️ BATERIA CONSOLIDADA DE HOMOLOGAÇÃO — PILAR 7');
  console.log('   RELATÓRIOS, FECHAMENTOS CONTÁBEIS E EXPORTAÇÕES (PDF, EXCEL, LIVRO CAIXA)');
  console.log('========================================================================\n');

  const ownerId = '12121212-1212-4212-a212-121212121212';
  const otherOwnerId = '34343434-3434-4343-a343-343434343434';
  const secondaryId = '56565656-5656-4565-a565-565656565656';

  const churchAllowed = '78787878-7878-4787-a787-787878787878';
  const churchRestricted = '90909090-9090-4909-a909-909090909090';
  const churchForeign = 'abababab-abab-4bab-abab-abababababab';

  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  // Limpeza
  try {
    db.prepare("DELETE FROM saved_reports WHERE id LIKE 'test-p7%'").run();
    db.prepare("DELETE FROM churches WHERE id IN (?, ?, ?)").run(churchAllowed, churchRestricted, churchForeign);
  } catch (_) {}

  // Setup de congregações
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchAllowed, ownerId, 'Igreja Autorizada P7');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchRestricted, ownerId, 'Igreja Restrita P7');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchForeign, otherOwnerId, 'Igreja Invasora P7');

  // Inicializar servidor de teste
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const ownerToken = generateAccessToken({
    userId: ownerId,
    email: 'owner@pilar7.test',
    ownerId,
    role: 'owner',
    permissions: ['all'],
    churchId: churchAllowed
  }).token;

  const secondaryToken = generateAccessToken({
    userId: secondaryId,
    email: 'sec@pilar7.test',
    ownerId,
    role: 'secondary',
    permissions: ['view', 'create', 'reports'],
    allowedChurchIds: [churchAllowed],
    churchId: churchAllowed
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
    // ETAPA 1: Segurança Multi-tenant no Ciclo de Vida de saved_reports
    // -------------------------------------------------------------
    console.log('--- ETAPA 1: Segurança Multi-tenant em saved_reports ---');

    // POST com igreja de outra organização
    const resPostForeign = await fetch(`${baseUrl}/api/v1/saved_reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        id: 'test-p7-foreign',
        name: 'Relatório Invasor',
        church_id: churchForeign,
        data: { test: true }
      })
    });
    assert(resPostForeign.status === 403, `Tentativa de associar relatório a igreja alheia bloqueada com HTTP 403 (Recebido: ${resPostForeign.status})`);

    // POST legítimo por secundário
    const resPostSecOk = await fetch(`${baseUrl}/api/v1/saved_reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryToken}` },
      body: JSON.stringify({
        id: 'test-p7-sec-ok',
        name: 'Relatório Legítimo Secundário',
        church_id: churchAllowed,
        data: { totals: { income: 500 } }
      })
    });
    assert(resPostSecOk.status === 201, `Secundário salvando relatório em congregação autorizada aceito com HTTP 201`);

    // PUT com congregação proibida
    const resPutSecForb = await fetch(`${baseUrl}/api/v1/saved_reports/test-p7-sec-ok`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryToken}` },
      body: JSON.stringify({ church_id: churchRestricted })
    });
    assert(resPutSecForb.status === 403, `Secundário tentando transferir relatório para igreja proibida bloqueado com HTTP 403`);

    // DELETE legítimo
    const resDelSecOk = await fetch(`${baseUrl}/api/v1/saved_reports/test-p7-sec-ok`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secondaryToken}` }
    });
    assert(resDelSecOk.status === 200, `Secundário excluindo relatório permitido aceito com HTTP 200`);

    // -------------------------------------------------------------
    // ETAPA 2: Rigor Numérico e Imunidade a NaN em Exportações
    // -------------------------------------------------------------
    console.log('\n--- ETAPA 2: Rigor Numérico (parseAmountSafely) ---');

    assert(parseAmountSafely('1.250,50') === 1250.5, 'String formatada brasileira 1.250,50 convertida com precisão');
    assert(parseAmountSafely('R$ 300,00') === 300.0, 'String com símbolo monetário R$ 300,00 convertida');
    assert(parseAmountSafely('- 150,00') === -150.0, 'Valor negativo com espaço convertido preservando o sinal');
    assert(parseAmountSafely('texto_sem_numero') === 0, 'Entrada textual anômala retorna 0 sem gerar NaN');

    // -------------------------------------------------------------
    // ETAPA 3: Equação Contábil Fundamental do Livro Caixa
    // -------------------------------------------------------------
    console.log('\n--- ETAPA 3: Integridade da Equação Fundamental do Livro Caixa ---');

    const transactions = [
      { id: 'p7-tx-1', date: '2026-11-01', amount: '800,00', type: 'credit', paymentMethod: 'PIX', category: 'Dízimos' },
      { id: 'p7-tx-2', date: '2026-11-02', amount: '250,00', type: 'credit', paymentMethod: 'DINHEIRO', category: 'Ofertas' },
      { id: 'p7-tx-3', date: '2026-11-03', amount: '350,00', type: 'expense', paymentMethod: 'BOLETO', category: 'Água e Esgoto' },
      { id: 'p7-tx-4', date: '2026-11-04', amount: '150,00', type: 'expense', paymentMethod: 'PIX', category: 'Material Escola Bíblica' },
      { id: 'p7-tx-5', date: '2026-11-05', amount: '500,00', type: 'credit', paymentMethod: 'TED', category: 'Transferência Recebida' },
      { id: 'p7-tx-6', date: '2026-11-06', amount: '200,00', type: 'expense', paymentMethod: 'TED', category: 'Transferência Enviada' }
    ];

    const allHistorical = [
      { id: 'hist-1', date: '2026-10-20', amount: 1000.0, type: 'credit' },
      { id: 'hist-2', date: '2026-10-25', amount: 300.0, type: 'expense' }
    ];

    const b = ExportService.calculateLivroCaixaBreakdown(transactions, allHistorical, '2026-11-01');

    assert(b.saldoAnterior === 700.0, `Saldo anterior apurado do histórico (1000 - 300 = R$ 700,00): R$ ${b.saldoAnterior}`);
    assert(b.entradasPix === 800.0, `Entradas Pix: R$ ${b.entradasPix}`);
    assert(b.entradasDinheiro === 250.0, `Entradas Dinheiro: R$ ${b.entradasDinheiro}`);
    assert(b.totalEntradas === 1050.0, `Total Entradas operacionais: R$ ${b.totalEntradas}`);
    assert(b.transfRecebidas === 500.0, `Transferências recebidas: R$ ${b.transfRecebidas}`);
    assert(b.saidasPix === 150.0, `Saídas Pix: R$ ${b.saidasPix}`);
    assert(b.saidasBoletoFaturas === 350.0, `Saídas Boletos: R$ ${b.saidasBoletoFaturas}`);
    assert(b.transfEnviadas === 200.0, `Transferências enviadas: R$ ${b.transfEnviadas}`);
    assert(b.totalSaidas === 500.0, `Total Saídas operacionais: R$ ${b.totalSaidas}`);

    // Equação contábil: Saldo Final = 700 (ant) + (1050 + 500) (entradas+transf) - (500 + 200) (saídas+transf) = 700 + 1550 - 700 = 1550.00
    assert(b.saldoFinal === 1550.0, `Saldo final exatamente balanceado em R$ 1.550,00 (apurado: R$ ${b.saldoFinal})`);

    // -------------------------------------------------------------
    // ETAPA 4: Regra Blindada 3 — Integridade sobre Massa Não-Paginada
    // -------------------------------------------------------------
    console.log('\n--- ETAPA 4: Regra Blindada 3 — Processamento de 100% dos Registros Filtrados ---');

    // Criação de 150 itens (equivalente a 3 páginas no DOM)
    const largeSet = Array.from({ length: 150 }, (_, i) => ({
      id: `p7-item-${i}`,
      date: '2026-11-07',
      amount: 20.0,
      type: 'credit',
      paymentMethod: 'PIX'
    }));

    const bLarge = ExportService.calculateLivroCaixaBreakdown(largeSet);
    assert(bLarge.totalEntradas === 3000.0, `Cálculo de 150 transações somou R$ 3.000,00 integralmente sem sofrer corte de paginação de 50 itens`);

    // -------------------------------------------------------------
    // ETAPA 5: Rateios (Splits) e Decomposição Contábil
    // -------------------------------------------------------------
    console.log('\n--- ETAPA 5: Rateios Contábeis de Múltiplas Congregações ---');

    const splitTransaction = [
      {
        id: 'p7-split-tx',
        date: '2026-11-08',
        amount: '1.500,00',
        type: 'credit',
        paymentMethod: 'PIX',
        splits: [
          { churchId: churchAllowed, amount: '900,00', paymentMethod: 'PIX', contributionType: 'Dízimo Sede' },
          { churchId: churchRestricted, amount: '600,00', paymentMethod: 'PIX', contributionType: 'Dízimo Filial' }
        ]
      }
    ];

    const bSplit = ExportService.calculateLivroCaixaBreakdown(splitTransaction);
    assert(bSplit.entradasPix === 1500.0, `Soma das parcelas de rateio (900 + 600 = R$ 1.500,00) preservada integralmente`);

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO DA HOMOLOGAÇÃO DO PILAR 7: ${passed} APROVADOS, ${failed} FALHAS`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    try {
      db.prepare("DELETE FROM saved_reports WHERE id LIKE 'test-p7%'").run();
      db.prepare("DELETE FROM churches WHERE id IN (?, ?, ?)").run(churchAllowed, churchRestricted, churchForeign);
    } catch (_) {}
    server.close();
  }
}

runPillar7Consolidation().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
