import { parseAmountSafely, ExportService } from '../../services/ExportService.js';

async function runOP17ExportTotalsIntegrityTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES — OP-17 (SUB-ETAPA 7.3)');
  console.log('   INTEGRIDADE DE TOTAIS, RATEIOS E ROBUSTEZ DOS MOTORES DE EXPORTAÇÃO');
  console.log('========================================================================\n');

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

  // -------------------------------------------------------------
  // CENÁRIO 1: Robustez Numérica com parseAmountSafely
  // -------------------------------------------------------------
  console.log('--- CENÁRIO 1: Robustez Numérica com parseAmountSafely ---');

  assert(parseAmountSafely(100.5) === 100.5, 'Número float 100.5 mantido');
  assert(parseAmountSafely('150,75') === 150.75, 'String brasileira "150,75" convertida para 150.75');
  assert(parseAmountSafely('1.450,50') === 1450.5, 'String formatada "1.450,50" convertida para 1450.50');
  assert(parseAmountSafely('R$ 2.500,00') === 2500.0, 'String com símbolo "R$ 2.500,00" convertida para 2500.00');
  assert(parseAmountSafely('- 350,20') === -350.2, 'Valor negativo "- 350,20" convertido com sinal preservado');
  assert(parseAmountSafely(null) === 0, 'Null avaliado para 0');
  assert(parseAmountSafely(undefined) === 0, 'Undefined avaliado para 0');
  assert(parseAmountSafely('invalido') === 0, 'Texto não-numérico avaliado para 0 sem NaN');
  assert(parseAmountSafely(NaN) === 0, 'NaN numérico sanitizado para 0');

  // -------------------------------------------------------------
  // CENÁRIO 2: Equação Fundamental em calculateLivroCaixaBreakdown
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 2: Equação Fundamental de Livro Caixa ---');

  const sampleTxs = [
    {
      id: 'tx-1',
      date: '2026-11-10',
      amount: '500,00',
      type: 'credit',
      paymentMethod: 'PIX',
      category: 'Dízimo'
    },
    {
      id: 'tx-2',
      date: '2026-11-11',
      amount: '200,00',
      type: 'credit',
      paymentMethod: 'DINHEIRO',
      category: 'Oferta'
    },
    {
      id: 'tx-3',
      date: '2026-11-12',
      amount: '150,00',
      type: 'expense',
      paymentMethod: 'PIX',
      category: 'Material Limpeza'
    },
    {
      id: 'tx-4',
      date: '2026-11-13',
      amount: '1.000,00',
      type: 'credit',
      paymentMethod: 'TRANSFERENCIA',
      category: 'Transferência Recebida'
    },
    {
      id: 'tx-5',
      date: '2026-11-14',
      amount: '400,00',
      type: 'expense',
      paymentMethod: 'TED',
      category: 'Repasse Sede'
    }
  ];

  const breakdown = ExportService.calculateLivroCaixaBreakdown(sampleTxs);

  assert(breakdown.entradasPix === 500.0, `Entradas Pix calculadas corretamente: R$ ${breakdown.entradasPix}`);
  assert(breakdown.entradasDinheiro === 200.0, `Entradas Dinheiro calculadas corretamente: R$ ${breakdown.entradasDinheiro}`);
  assert(breakdown.saidasPix === 150.0, `Saídas Pix calculadas corretamente: R$ ${breakdown.saidasPix}`);
  assert(breakdown.transfRecebidas === 1000.0, `Transferências recebidas calculadas corretamente: R$ ${breakdown.transfRecebidas}`);
  assert(breakdown.transfEnviadas === 400.0, `Transferências enviadas calculadas corretamente: R$ ${breakdown.transfEnviadas}`);

  // Validação da equação: saldoFinal = saldoAnterior + totalEntradasPlusTransf - totalSaidasPlusTransf
  const expectedFinal = breakdown.saldoAnterior + breakdown.totalEntradasPlusTransf - breakdown.totalSaidasPlusTransf;
  assert(breakdown.saldoFinal === expectedFinal, `Equação fundamental exata: R$ ${breakdown.saldoFinal} === R$ ${expectedFinal}`);
  assert(breakdown.saldoFinal === (0 + 1700 - 550), `Saldo líquido final confere com R$ 1.150,00`);

  // -------------------------------------------------------------
  // CENÁRIO 3: Rateios Complexos em calculateLivroCaixaBreakdown
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 3: Rateios (Splits) Complexos ---');

  const splitTx = [
    {
      id: 'tx-split-1',
      date: '2026-11-15',
      amount: '1.000,00',
      type: 'credit',
      paymentMethod: 'PIX',
      splits: [
        { churchId: 'church-1', amount: '600,00', paymentMethod: 'PIX', contributionType: 'Dízimo' },
        { churchId: 'church-2', amount: '400,00', paymentMethod: 'DINHEIRO', contributionType: 'Oferta Missões' }
      ]
    }
  ];

  const splitBreakdown = ExportService.calculateLivroCaixaBreakdown(splitTx);
  assert(splitBreakdown.entradasPix === 600.0, `Parcela 1 de Pix R$ 600,00 totalizada`);
  assert(splitBreakdown.entradasDinheiro === 400.0, `Parcela 2 de Dinheiro R$ 400,00 totalizada`);
  assert(splitBreakdown.totalEntradas === 1000.0, `Total do rateio soma exatamente R$ 1.000,00 sem desvio`);

  // -------------------------------------------------------------
  // CENÁRIO 4: Regra Blindada 3 — Totalização de Grande Volume Não-Truncado
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 4: Regra Blindada 3 — Totalização de Todos os Dados Filtrados ---');

  // Simular 120 transações (mais que o limite de 50 itens da página no DOM)
  const largeDataset = Array.from({ length: 120 }, (_, i) => ({
    id: `tx-bulk-${i}`,
    date: '2026-11-20',
    amount: 10,
    type: 'credit',
    paymentMethod: 'PIX'
  }));

  const largeBreakdown = ExportService.calculateLivroCaixaBreakdown(largeDataset);
  assert(largeBreakdown.totalEntradas === 1200, `Totalização calculou todas as 120 transações (R$ 1.200,00), sem truncamento pela página de 50`);

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO DA SUB-ETAPA 7.3: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOP17ExportTotalsIntegrityTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
