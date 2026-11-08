import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP082Subetapa22Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE ATOMICIDADE ACID — OP-08.2 SUB-ETAPA 2.2');
  console.log('   TRANSAÇÃO ATÔMICA ACID NAS ROTAS DE REABERTURA (DELETE E POST)');
  console.log('========================================================================\n');

  const ownerId = '00000000-0000-0000-0000-000000000001';
  const secUserId = '00000000-0000-0000-0000-000000000002';
  const churchOriginId = '00000000-0000-0000-0000-000000000001';
  const churchDestId = '00000000-0000-0000-0000-000000000099';

  const bankA = 'banco-bradesco-001';
  const bankB = 'banco-itau-002';
  const year = 2026;
  const month = 11;

  // Setup baseline
  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

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

  const secToken = generateAccessToken({
    userId: secUserId,
    email: 'sec@test.com',
    ownerId: ownerId,
    role: 'secondary_user',
    permissions: ['read'],
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
    // CENÁRIO 1: Preparação de Fechamento com Duas Pernas para Banco A e Banco B
    // -------------------------------------------------------------
    console.log('--- CENÁRIO 1: Fechamento com Duas Pernas Contábeis (Banco A e Banco B) ---');

    // Fechar Banco A
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
        transferredBalance: 1500,
        targetChurchId: churchDestId,
        targetChurchName: 'Igreja Sede',
        notes: 'Fechamento Banco A'
      })
    });
    assert(resCloseA.status === 201, `Fechamento Banco A criado com sucesso (HTTP ${resCloseA.status})`);

    // Fechar Banco B
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
        transferredBalance: 2800,
        targetChurchId: churchDestId,
        targetChurchName: 'Igreja Sede',
        notes: 'Fechamento Banco B'
      })
    });
    assert(resCloseB.status === 201, `Fechamento Banco B criado com sucesso (HTTP ${resCloseB.status})`);

    // Verificar se ambas as pernas do Banco A e Banco B existem
    const closingAId = `closing_${churchOriginId}_${bankA}_${year}_${month}`;
    const closingBId = `closing_${churchOriginId}_${bankB}_${year}_${month}`;

    const txsABefore = db.prepare('SELECT * FROM consolidated_transactions WHERE report_id = ?').all(closingAId);
    const txsBBefore = db.prepare('SELECT * FROM consolidated_transactions WHERE report_id = ?').all(closingBId);

    assert(txsABefore.length === 2, `Banco A possui exatamente 2 pernas gravadas (encontradas: ${txsABefore.length})`);
    assert(txsBBefore.length === 2, `Banco B possui exatamente 2 pernas gravadas (encontradas: ${txsBBefore.length})`);

    // -------------------------------------------------------------
    // CENÁRIO 2: Reabertura Atômica via POST /church-closings/reopen para Banco A
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Reabertura Atômica via POST /church-closings/reopen (Banco A) ---');
    const resReopenA = await fetch(`${baseUrl}/api/v1/church-closings/reopen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        churchId: churchOriginId,
        bankId: bankA,
        year,
        month
      })
    });
    assert(resReopenA.status === 200, `POST /church-closings/reopen retornou HTTP 200 (status: ${resReopenA.status})`);
    const reopenDataA = await resReopenA.json();
    assert(reopenDataA.status === 'reopened', 'Status retornado é "reopened"');

    // Verificar no banco: status de Banco A mudou para reopened
    const closingARow = db.prepare('SELECT status FROM church_closings WHERE id = ?').get(closingAId) as any;
    assert(closingARow && closingARow.status === 'reopened', 'Registro de church_closings do Banco A está com status "reopened"');

    // Verificar no banco: pernas contábeis do Banco A foram 100% removidas
    const txsAAfter = db.prepare('SELECT * FROM consolidated_transactions WHERE report_id = ?').all(closingAId);
    assert(txsAAfter.length === 0, `As duas pernas do Banco A foram removidas atomicamente (restantes: ${txsAAfter.length})`);

    // -------------------------------------------------------------
    // CENÁRIO 3: Não-Regressão — Preservação Absoluta das Pernas do Banco B
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Preservação das Pernas do Banco B ---');
    const txsBAfter = db.prepare('SELECT * FROM consolidated_transactions WHERE report_id = ?').all(closingBId);
    assert(txsBAfter.length === 2, `As duas pernas do Banco B continuam estritamente intactas (encontradas: ${txsBAfter.length})`);

    const closingBRow = db.prepare('SELECT status FROM church_closings WHERE id = ?').get(closingBId) as any;
    assert(closingBRow && closingBRow.status === 'closed', 'Status do fechamento do Banco B permanece "closed"');

    // -------------------------------------------------------------
    // CENÁRIO 4: Reabertura Atômica via DELETE /church-closings/:churchId/:year/:month para Banco B
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Reabertura Atômica via DELETE (Banco B) ---');
    const resDeleteB = await fetch(`${baseUrl}/api/v1/church-closings/${churchOriginId}/${year}/${month}?bank_id=${bankB}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${ownerToken}`
      }
    });
    assert(resDeleteB.status === 200, `DELETE retornou HTTP 200 (status: ${resDeleteB.status})`);
    const deleteDataB = await resDeleteB.json();
    assert(deleteDataB.status === 'reopened', 'Status retornado é "reopened"');

    const closingBRowAfter = db.prepare('SELECT status FROM church_closings WHERE id = ?').get(closingBId) as any;
    assert(closingBRowAfter && closingBRowAfter.status === 'reopened', 'Registro de church_closings do Banco B está com status "reopened"');

    const txsBAfterDelete = db.prepare('SELECT * FROM consolidated_transactions WHERE report_id = ?').all(closingBId);
    assert(txsBAfterDelete.length === 0, `As duas pernas do Banco B foram removidas atomicamente (restantes: ${txsBAfterDelete.length})`);

    // -------------------------------------------------------------
    // CENÁRIO 5: Proteção de Segurança e Controle de Acesso (OP-08.1 / PB-008)
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 5: Proteção de Segurança e Permissões ---');

    // Reabertura sem token (401)
    const resNoToken = await fetch(`${baseUrl}/api/v1/church-closings/${churchOriginId}/${year}/${month}?bank_id=${bankA}`, {
      method: 'DELETE'
    });
    assert(resNoToken.status === 401, `DELETE sem autenticação bloqueado com HTTP 401 (status: ${resNoToken.status})`);

    // Reabertura por usuário secundário (403)
    const resSecDelete = await fetch(`${baseUrl}/api/v1/church-closings/${churchOriginId}/${year}/${month}?bank_id=${bankA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secToken}` }
    });
    assert(resSecDelete.status === 403, `DELETE por usuário secundário bloqueado com HTTP 403 (status: ${resSecDelete.status})`);

    const resSecPost = await fetch(`${baseUrl}/api/v1/church-closings/reopen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secToken}`
      },
      body: JSON.stringify({
        churchId: churchOriginId,
        bankId: bankA,
        year,
        month
      })
    });
    assert(resSecPost.status === 403, `POST /reopen por usuário secundário bloqueado com HTTP 403 (status: ${resSecPost.status})`);

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO FINAL: ${passed} APROVADOS, ${failed} FALHAS`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    server.close();
  }
}

runOP082Subetapa22Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
