import { OFXParser } from '../../core/parsers/OFXParser.js';
import { processFileContent } from '../../services/processingService.js';

async function runOP14ParsersRobustnessTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE ROBUSTEZ DOS PARSERS — OP-14 (SUB-ETAPA 6.2)');
  console.log('   DECODIFICAÇÃO SGML/XML, TIMEZONES, VALORES MONETÁRIOS E PAYLOADS RESILIENTES');
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

  const parser = new OFXParser();

  // -------------------------------------------------------------
  // CENÁRIO 1: Decodificação de Entidades SGML/XML (&amp;, &quot;, &lt;, &gt;, &#39;)
  // -------------------------------------------------------------
  console.log('--- CENÁRIO 1: Decodificação de Entidades SGML/XML ---');

  const ofxWithEntities = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEVERSION:100
NEWFILEVERSION:100

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261015120000[-03:EST]
            <TRNAMT>+ 250.00
            <NAME>BAR &amp; RESTAURANTE LTDA
            <MEMO>PAGTO &quot;SERVIÇOS&quot; &lt;PIX&gt;
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20261016</DTPOSTED>
            <TRNAMT>- 1.450,75</TRNAMT>
            <PAYEE>JOÃO D&#39;AVILA &amp; FILHOS</PAYEE>
            <NAME>COMPRA MATERIAIS</NAME>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

  const drafts1 = parser.parse({
    sourceName: 'extrato_entidades.ofx',
    fileType: 'OFX' as any,
    content: ofxWithEntities,
    timestamp: new Date().toISOString()
  });

  assert(drafts1.length === 2, `Exatamente 2 transações extraídas com entidades (encontradas: ${drafts1.length})`);
  assert(drafts1[0].rawDescription.includes('BAR & RESTAURANTE LTDA'), 'Entidade &amp; decodificada para "&" no NAME');
  assert(drafts1[0].rawDescription.includes('"SERVIÇOS"'), 'Entidade &quot; decodificada para aspas duplas no MEMO');
  assert(drafts1[0].rawDescription.includes('<PIX>'), 'Entidades &lt; e &gt; decodificadas no MEMO');
  assert(drafts1[1].rawDescription.includes("JOÃO D'AVILA & FILHOS"), 'Entidades &#39; e &amp; decodificadas no PAYEE');

  // -------------------------------------------------------------
  // CENÁRIO 2: Resiliência a Fusos Horários e Variações de Data
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 2: Higienização e Normalização de Datas ---');

  assert(drafts1[0].rawDate === '2026-10-15', `Timestamp 20261015120000[-03:EST] normalizado para ISO 2026-10-15 (recebido: ${drafts1[0].rawDate})`);
  assert(drafts1[1].rawDate === '2026-10-16', `Data compacta 20261016 normalizada para ISO 2026-10-16 (recebido: ${drafts1[1].rawDate})`);

  // Data em formato ISO prévio e formato brasileiro
  const ofxDatesVaried = `
<STMTTRN>
  <TRNTYPE>OTHER
  <DTPOSTED>2026-11-20
  <TRNAMT>100.00
  <NAME>DATA ISO
</STMTTRN>
<STMTTRN>
  <TRNTYPE>OTHER
  <DTPOSTED>25/12/2026
  <TRNAMT>200.00
  <NAME>DATA BRASILEIRA
</STMTTRN>
`;

  const draftsDates = parser.parse({
    sourceName: 'extrato_datas.ofx',
    fileType: 'OFX' as any,
    content: ofxDatesVaried,
    timestamp: new Date().toISOString()
  });

  assert(draftsDates[0].rawDate === '2026-11-20', `Data ISO mantida: ${draftsDates[0].rawDate}`);
  assert(draftsDates[1].rawDate === '2026-12-25', `Data BR 25/12/2026 convertida para ISO: ${draftsDates[1].rawDate}`);

  // -------------------------------------------------------------
  // CENÁRIO 3: Higienização Numérica Monetária (Vírgula, Ponto, Espaços e Sinais)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 3: Higienização de Valores Monetários ---');

  assert(drafts1[0].rawAmount === '250.00', `Valor "+ 250.00" sanitizado para "250.00" (recebido: ${drafts1[0].rawAmount})`);
  assert(drafts1[1].rawAmount === '-1450.75', `Valor brasileiro "- 1.450,75" sanitizado para "-1450.75" (recebido: ${drafts1[1].rawAmount})`);

  const ofxAmounts = `
<STMTTRN>
  <TRNTYPE>CREDIT
  <DTPOSTED>20260101
  <TRNAMT>   + 5.000,50   
  <NAME>VALOR BR COM ESPAÇOS
</STMTTRN>
<STMTTRN>
  <TRNTYPE>DEBIT
  <DTPOSTED>20260102
  <TRNAMT>-0,99
  <NAME>VALOR CENTAVOS
</STMTTRN>
`;

  const draftsAmounts = parser.parse({
    sourceName: 'extrato_valores.ofx',
    fileType: 'OFX' as any,
    content: ofxAmounts,
    timestamp: new Date().toISOString()
  });

  assert(draftsAmounts[0].rawAmount === '5000.50', `Valor "+ 5.000,50" convertido para "5000.50" (recebido: ${draftsAmounts[0].rawAmount})`);
  assert(draftsAmounts[1].rawAmount === '-0.99', `Valor "-0,99" convertido para "-0.99" (recebido: ${draftsAmounts[1].rawAmount})`);

  // -------------------------------------------------------------
  // CENÁRIO 4: Pipeline Completo com processFileContent
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 4: Integração com Pipeline de Processamento (processFileContent) ---');

  const result = await processFileContent(ofxWithEntities, 'extrato_real.ofx');
  assert(result.transactions.length === 2, `processFileContent gerou 2 transações (recebido: ${result.transactions.length})`);
  assert(result.transactions[0].amount === 250.00, `Transação 1 possui amount numérico 250.00 (recebido: ${result.transactions[0].amount})`);
  assert(result.transactions[1].amount === -1450.75, `Transação 2 possui amount numérico -1450.75 (recebido: ${result.transactions[1].amount})`);
  assert(result.transactions[0].date === '2026-10-15', `Transação 1 possui data formatada 2026-10-15`);
  assert(result.transactions[1].date === '2026-10-16', `Transação 2 possui data formatada 2026-10-16`);

  // -------------------------------------------------------------
  // CENÁRIO 5: Rejeição Graciosa de Payloads Inválidos ou Corrompidos
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 5: Rejeição Graciosa de Payloads Corrompidos ---');

  const emptyDrafts = parser.parse({
    sourceName: 'vazio.ofx',
    fileType: 'OFX' as any,
    content: '',
    timestamp: new Date().toISOString()
  });
  assert(emptyDrafts.length === 0, 'Arquivo vazio retorna lista vazia sem quebrar');

  const noTrnDrafts = parser.parse({
    sourceName: 'sem_trn.ofx',
    fileType: 'OFX' as any,
    content: '<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>',
    timestamp: new Date().toISOString()
  });
  assert(noTrnDrafts.length === 0, 'OFX sem tags <STMTTRN> retorna lista vazia de forma segura');

  let nonOfxRejected = false;
  try {
    await processFileContent('CONTEUDO CSV COMUM', 'arquivo.csv');
  } catch (err: any) {
    nonOfxRejected = true;
    assert(err.message.includes('exclusivamente extratos bancários no formato OFX'), 'Arquivo não-OFX rejeitado com mensagem explicativa');
  }
  assert(nonOfxRejected, 'Tentativa de enviar arquivo não-OFX foi estritamente interceptada');

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO DA SUB-ETAPA 6.2: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOP14ParsersRobustnessTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
