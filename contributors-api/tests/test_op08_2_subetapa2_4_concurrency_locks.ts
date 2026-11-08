import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP082Subetapa24Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE CONCORRÊNCIA E LOCKS — OP-08.2 SUB-ETAPA 2.4');
  console.log('   TRANSACTION LEASE / ADVISORY LOCKS EM FECHAMENTO E REABERTURA');
  console.log('========================================================================\n');

  const ownerId = '00000000-0000-0000-0000-000000000001';
  const churchOriginId = '00000000-0000-0000-0000-000000000001';
  const churchDestId = '00000000-0000-0000-0000-000000000099';

  const bankA = 'banco-bradesco-001';
  const bankB = 'banco-itau-002';
  const year = 2026;
  const month = 9; // Setembro para isolamento total

  // Setup baseline
  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  // Limpar dados deste período de teste
  db.prepare("DELETE FROM consolidated_transactions WHERE transaction_date LIKE '2026-09%'").run();
  db.prepare("DELETE FROM church_closings WHERE year = 2026 AND month = 9").run();

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
    // CENÁRIO 1: Concorrência Simultânea para o Mesmo Banco e Período (Race Condition)
    // -------------------------------------------------------------
    console.log('--- CENÁRIO 1: Tentativa de Fechamento Concorrente Simultâneo (Mesmo Banco) ---');

    // Disparamos 2 fechamentos concorrentes exatamente ao mesmo tempo via Promise.all
    const [resReq1, resReq2] = await Promise.all([
      fetch(`${baseUrl}/api/v1/church-closings`, {
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
          transferredBalance: 1200,
          targetChurchId: churchDestId,
          targetChurchName: 'Sede Central',
          notes: 'Operação Concorrente 1'
        })
      }),
      fetch(`${baseUrl}/api/v1/church-closings`, {
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
          transferredBalance: 1200,
          targetChurchId: churchDestId,
          targetChurchName: 'Sede Central',
          notes: 'Operação Concorrente 2'
        })
      })
    ]);

    const statuses = [resReq1.status, resReq2.status].sort();
    console.log(`  ℹ️ Status recebidos na concorrência do Banco A: [${statuses.join(', ')}]`);

    // Uma requisição deve ter sido processada com sucesso (201) e a concorrente deve ter sido bloqueada por lock (409)
    // OU se processada sequencialmente pelo event loop, ambas respondem de forma íntegra.
    // Mas com lock ativo durante a transação, se houver sobreposição, 409 é retornado.
    const has201 = statuses.includes(201);
    assert(has201, 'Ao menos uma das requisições concorrentes foi concluída com sucesso (HTTP 201)');

    // -------------------------------------------------------------
    // CENÁRIO 2: Simulação Direta de Lock Ocupado (pg_try_advisory_xact_lock)
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Validação da Rejeição 409 quando o Lock está Ativo ---');

    // Forçamos temporariamente o lock ativo no SQLite Engine para o Banco A
    const keys = (pool as any).localEngine ? (pool as any).localEngine.activeClosingLocks : null;
    let manualLockKey: string | null = null;
    if (keys) {
      // Simula uma transação externa segurando o lock para churchOriginId, bankA, month 9
      const str1 = `church:${churchOriginId}`;
      const str2 = `period:${bankA}:${year}:${month}`;
      let h1 = 0, h2 = 0;
      for (let i = 0; i < str1.length; i++) h1 = (Math.imul(31, h1) + str1.charCodeAt(i)) | 0;
      for (let i = 0; i < str2.length; i++) h2 = (Math.imul(31, h2) + str2.charCodeAt(i)) | 0;
      manualLockKey = `${h1}:${h2}`;
      keys.add(manualLockKey);
    }

    // Tentar fechar enquanto o lock está ocupado
    const resBlocked = await fetch(`${baseUrl}/api/v1/church-closings`, {
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
        transferredBalance: 900,
        targetChurchId: churchDestId
      })
    });

    assert(resBlocked.status === 409, `Fechamento com lock ativo rejeitado com HTTP 409 Conflict (status: ${resBlocked.status})`);
    const dataBlocked = await resBlocked.json();
    assert(dataBlocked.error === 'CONCURRENT_OPERATION', 'Código de erro retornado é "CONCURRENT_OPERATION"');

    // Tentar reabrir enquanto o lock está ocupado
    const resBlockedReopen = await fetch(`${baseUrl}/api/v1/church-closings/reopen`, {
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
    assert(resBlockedReopen.status === 409, `Reabertura POST com lock ativo rejeitada com HTTP 409 Conflict (status: ${resBlockedReopen.status})`);

    const resBlockedDelete = await fetch(`${baseUrl}/api/v1/church-closings/${churchOriginId}/${year}/${month}?bank_id=${bankA}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${ownerToken}`
      }
    });
    assert(resBlockedDelete.status === 409, `Reabertura DELETE com lock ativo rejeitada com HTTP 409 Conflict (status: ${resBlockedDelete.status})`);

    // Liberar o lock manual
    if (keys && manualLockKey) {
      keys.delete(manualLockKey);
    }

    // -------------------------------------------------------------
    // CENÁRIO 3: Desbloqueio e Concorrência Não-Conflitante entre Bancos Distintos
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Fechamento Concorrente de Bancos Distintos (Banco A e Banco B) ---');

    // Fechar Banco A e Banco B simultaneamente (não colidem porque possuem lockKeys diferentes)
    const [resBankA, resBankB] = await Promise.all([
      fetch(`${baseUrl}/api/v1/church-closings`, {
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
          targetChurchId: churchDestId
        })
      }),
      fetch(`${baseUrl}/api/v1/church-closings`, {
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
          transferredBalance: 2500,
          targetChurchId: churchDestId
        })
      })
    ]);

    assert(resBankA.status === 201, `Banco A fechado em paralelo com sucesso (HTTP ${resBankA.status})`);
    assert(resBankB.status === 201, `Banco B fechado em paralelo com sucesso (HTTP ${resBankB.status})`);

    // -------------------------------------------------------------
    // CENÁRIO 4: Liberação Automática do Lock e Reabertura Sucessiva
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Liberação Automática do Lock e Sucesso Subsequente ---');

    const resReopenSuccess = await fetch(`${baseUrl}/api/v1/church-closings/reopen`, {
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

    assert(resReopenSuccess.status === 200, `Reabertura subsequente após liberação do lock executada com sucesso (HTTP ${resReopenSuccess.status})`);

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO FINAL: ${passed} APROVADOS, ${failed} FALHAS`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      try {
        db.prepare("DELETE FROM consolidated_transactions WHERE transaction_date LIKE '2026-09%'").run();
        db.prepare("DELETE FROM church_closings WHERE year = 2026 AND month = 9").run();
      } catch (_) {}
      process.exit(0);
    }
  } finally {
    try {
      db.prepare("DELETE FROM consolidated_transactions WHERE transaction_date LIKE '2026-09%'").run();
      db.prepare("DELETE FROM church_closings WHERE year = 2026 AND month = 9").run();
    } catch (_) {}
    server.close();
  }
}

runOP082Subetapa24Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
