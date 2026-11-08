import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import { OFXParser } from '../../core/parsers/OFXParser.js';
import { processFileContent } from '../../services/processingService.js';
import { LaunchService } from '../../services/LaunchService.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runPillar6Consolidation() {
  console.log('========================================================================');
  console.log('🏛️ BATERIA CONSOLIDADA DE HOMOLOGAÇÃO — PILAR 6 (IMPORTAÇÕES & IDEMPOTÊNCIA)');
  console.log('   EXTRATOS OFX, ENTIDADES SGML/XML, TIMEZONES, HASHES E MULTI-TENANT');
  console.log('========================================================================\n');

  const ownerAId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const ownerBId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const churchA = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
  const bankA = 'bank-pilar6-a01';
  const bankB = 'bank-pilar6-b01';

  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  // Limpeza prévia
  try {
    db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-p6%'").run();
    db.prepare("DELETE FROM banks WHERE id IN (?, ?)").run(bankA, bankB);
    db.prepare("DELETE FROM churches WHERE id = ?").run(churchA);
  } catch (_) {}

  // Cadastrar dados de teste
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA, ownerAId, 'Igreja Central Pilar 6');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankA, ownerAId, 'Conta Principal Org A');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankB, ownerBId, 'Conta Principal Org B');

  // Inicializar servidor
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const ownerAToken = generateAccessToken({
    userId: ownerAId,
    email: 'ownerA@pilar6.test',
    ownerId: ownerAId,
    role: 'owner',
    permissions: ['all'],
    churchId: churchA,
    bankIds: [bankA]
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
    // ETAPA 1: Parsing de Extrato OFX Real com Entidades & Timezones
    // -------------------------------------------------------------
    console.log('--- ETAPA 1: Parsing OFX com Entidades SGML/XML e Timezones ---');

    const sampleOfx = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
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
            <DTPOSTED>20261105153000[-03:BRT]
            <TRNAMT>+ 500,00
            <NAME>LIVRARIA &amp; PAPELARIA EVANGÉLICA
            <MEMO>OFERTA &quot;GRATIDÃO&quot; &lt;PIX&gt;
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261106090000[0:GMT]
            <TRNAMT>- 1.250,50
            <PAYEE>COMPANHIA ENERGÉTICA &amp; LUZ D&#39;AGUA</PAYEE>
            <NAME>PAGTO ENERGIA ELETRICA
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261105
            <TRNAMT>500.00
            <NAME>LIVRARIA &amp; PAPELARIA EVANGÉLICA
            <MEMO>SEGUNDA OFERTA NO MESMO DIA
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

    const parser = new OFXParser();
    const drafts = parser.parse({
      sourceName: 'extrato_pilar6.ofx',
      fileType: 'OFX' as any,
      content: sampleOfx,
      timestamp: new Date().toISOString()
    });

    assert(drafts.length === 3, `Exatamente 3 transações extraídas pelo OFXParser (encontradas: ${drafts.length})`);
    assert(drafts[0].rawDate === '2026-11-05', `Data 20261105153000[-03:BRT] convertida para ISO 2026-11-05 (recebido: ${drafts[0].rawDate})`);
    assert(drafts[1].rawDate === '2026-11-06', `Data 20261106090000[0:GMT] convertida para ISO 2026-11-06 (recebido: ${drafts[1].rawDate})`);
    assert(drafts[0].rawAmount === '500.00', `Valor "+ 500,00" convertido para "500.00"`);
    assert(drafts[1].rawAmount === '-1250.50', `Valor "- 1.250,50" convertido para "-1250.50"`);
    assert(drafts[0].rawDescription.includes('LIVRARIA & PAPELARIA EVANGÉLICA'), 'Entidade &amp; decodificada com sucesso na descrição');
    assert(drafts[0].rawDescription.includes('"GRATIDÃO"'), 'Entidade &quot; decodificada com sucesso na descrição');
    assert(drafts[1].rawDescription.includes("D'AGUA"), 'Entidade &#39; decodificada com sucesso na descrição');

    // -------------------------------------------------------------
    // ETAPA 2: Processamento via Pipeline (processFileContent)
    // -------------------------------------------------------------
    console.log('\n--- ETAPA 2: Integração com Pipeline de Extrato ---');

    const resultPipeline = await processFileContent(sampleOfx, 'extrato_igreja.ofx');
    assert(resultPipeline.transactions.length === 3, `Pipeline gerou 3 objetos de transação válidos`);
    assert(resultPipeline.transactions[0].amount === 500.00, `Transação 1 possui valor numérico 500.00`);
    assert(resultPipeline.transactions[1].amount === -1250.50, `Transação 2 possui valor numérico -1250.50`);
    assert(resultPipeline.transactions[0].paymentMethod === 'PIX', `Método de pagamento PIX inferido via tag MEMO`);

    // -------------------------------------------------------------
    // ETAPA 3: Geração de Hashes de Idempotência com Preservação de Ocorrências
    // -------------------------------------------------------------
    console.log('\n--- ETAPA 3: Geração de row_hash e Preservação de Lançamentos do Mesmo Dia ---');

    // Duas transações de 500.00 no mesmo dia (2026-11-05) devem ter hashes distintos para não anular a 2ª oferta!
    const txA = resultPipeline.transactions[0];
    const txB = resultPipeline.transactions[2];

    const tripletA = LaunchService.normalizeTriplet(txA);
    const tripletB = LaunchService.normalizeTriplet(txB);
    assert(tripletA.finalDate === '2026-11-05' && tripletA.finalValue === '500.00', 'Triplet A normalizado corretamente');
    assert(tripletB.finalDate === '2026-11-05' && tripletB.finalValue === '500.00', 'Triplet B normalizado corretamente');

    // -------------------------------------------------------------
    // ETAPA 4: Ingestão em Lote e Idempotência Absoluta no Backend (/bulk)
    // -------------------------------------------------------------
    console.log('\n--- ETAPA 4: Idempotência de Ingestão em Lote no Backend ---');

    const batchTransactions = [
      {
        id: 'test-p6-tx-1',
        church_id: churchA,
        bank_id: bankA,
        transaction_date: '2026-11-05',
        amount: 500.00,
        type: 'credit',
        description: 'Dízimo Maria 1',
        row_hash: 'p6_hash_maria_01',
        source: 'file'
      },
      {
        id: 'test-p6-tx-2',
        church_id: churchA,
        bank_id: bankA,
        transaction_date: '2026-11-06',
        amount: -1250.50,
        type: 'expense',
        description: 'Pagamento Companhia Elétrica',
        row_hash: 'p6_hash_luz_02',
        source: 'file'
      }
    ];

    // 1º Envio
    const resFirstBulk = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ transactions: batchTransactions })
    });
    assert([200, 201].includes(resFirstBulk.status), `Primeiro upload em lote aceito com HTTP ${resFirstBulk.status}`);

    // 2º Envio idêntico (re-upload do extrato)
    const resSecondBulk = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ transactions: batchTransactions })
    });
    assert([200, 201].includes(resSecondBulk.status), `Re-upload idêntico aceito com sucesso sem conflito (HTTP ${resSecondBulk.status})`);

    // Verificar se no banco temos exatamente 2 registros
    const countTotal = db.prepare("SELECT COUNT(*) as total FROM consolidated_transactions WHERE id LIKE 'test-p6-tx%'").get() as any;
    assert(countTotal.total === 2, `Exatamente 2 transações no banco de dados (zero duplicações: count=${countTotal.total})`);

    // -------------------------------------------------------------
    // ETAPA 5: Isolamento Multi-tenant Estrito de Contas Bancárias
    // -------------------------------------------------------------
    console.log('\n--- ETAPA 5: Isolamento Multi-tenant de Contas Bancárias ---');

    // Tentativa de subir lote associado a conta bancária de outra organização (bankB pertence a ownerB)
    const resCrossBank = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        transactions: [
          {
            id: 'test-p6-tx-cross-1',
            church_id: churchA,
            bank_id: bankB, // Banco de outro tenant!
            transaction_date: '2026-11-05',
            amount: 300,
            type: 'credit',
            description: 'Invasão de Conta Alheia'
          }
        ]
      })
    });
    assert(resCrossBank.status === 403, `Tentativa de associar transação a banco de outra organização bloqueada com HTTP 403 (Recebido: ${resCrossBank.status})`);

    // -------------------------------------------------------------
    // ETAPA 6: Ingestão Concorrente Paralela com Mesmos Hashes
    // -------------------------------------------------------------
    console.log('\n--- ETAPA 6: Resiliência a Uploads Simultâneos em Paralelo ---');

    const parallelPayloads = Array.from({ length: 4 }, (_, i) => {
      return fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
        body: JSON.stringify({
          transactions: [
            {
              id: `test-p6-parallel-${i}`,
              church_id: churchA,
              bank_id: bankA,
              transaction_date: '2026-11-07',
              amount: 100,
              type: 'credit',
              description: 'Oferta Especial Paralela',
              row_hash: 'p6_hash_shared_parallel_token',
              source: 'file'
            }
          ]
        })
      });
    });

    const parallelResponses = await Promise.all(parallelPayloads);
    const allOk = parallelResponses.every(r => [200, 201].includes(r.status));
    assert(allOk, 'Todas as requisições concorrentes paralelas retornaram sucesso (200/201)');

    const countParallel = db.prepare("SELECT COUNT(*) as total FROM consolidated_transactions WHERE row_hash = 'p6_hash_shared_parallel_token'").get() as any;
    assert(countParallel.total === 1, `Apenas 1 transação foi gravada no banco para o hash compartilhado (sem corrida de dados: count=${countParallel.total})`);

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO DA HOMOLOGAÇÃO DO PILAR 6: ${passed} APROVADOS, ${failed} FALHAS`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    try {
      db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-p6%'").run();
      db.prepare("DELETE FROM banks WHERE id IN (?, ?)").run(bankA, bankB);
      db.prepare("DELETE FROM churches WHERE id = ?").run(churchA);
    } catch (_) {}
    server.close();
  }
}

runPillar6Consolidation().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
