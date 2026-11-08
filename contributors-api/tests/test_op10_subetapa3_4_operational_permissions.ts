import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP10Subetapa34Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE MATRIZ DE PERMISSÕES — OP-10 SUB-ETAPA 3.4');
  console.log('   ENFORCEMENT DE PERMISSÕES OPERACIONAIS: VIEW, CREATE, EDIT, DELETE');
  console.log('========================================================================\n');

  const ownerId = '11111111-1111-1111-1111-111111111111';
  const churchId = '11111111-0000-0000-0000-000000000001';
  const bankId = 'bank-perm-op-01';

  const secUserViewOnly = '22222222-1111-1111-1111-111111111111';
  const secUserCreateOnly = '22222222-2222-2222-2222-222222222222';
  const secUserEditOnly = '22222222-3333-3333-3333-333333333333';
  const secUserDeleteOnly = '22222222-4444-4444-4444-444444444444';

  // SQLite setup
  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  function cleanupDb() {
    try {
      db.prepare("DELETE FROM consolidated_transactions WHERE id LIKE 'test-perm-op-%'").run();
      db.prepare("DELETE FROM financial_records WHERE id LIKE 'test-perm-op-%'").run();
      db.prepare("DELETE FROM churches WHERE id = ?").run(churchId);
      db.prepare("DELETE FROM banks WHERE id = ?").run(bankId);
    } catch (_) {}
  }

  cleanupDb();

  // Inserir igreja e banco
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchId, ownerId, 'Igreja Sede Operacional');
  db.prepare("INSERT OR REPLACE INTO banks (id, user_id, name) VALUES (?, ?, ?)").run(bankId, ownerId, 'Banco Principal');

  // Inserir transação inicial e registro financeiro inicial pertencentes à igreja do owner
  db.prepare(`
    INSERT OR REPLACE INTO consolidated_transactions (id, user_id, church_id, bank_id, amount, description, type, transaction_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('test-perm-op-tx-01', ownerId, churchId, bankId, 100.00, 'Transação Base Operacional', 'income', '2026-11-01');

  db.prepare(`
    INSERT OR REPLACE INTO financial_records (id, user_id, church_id, title, amount, type, status, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('test-perm-op-rec-01', ownerId, churchId, 'Conta Base Operacional', 250.00, 'expense', 'pending', '2026-11-15');

  // Tokens JWT
  const tokenOwner = generateAccessToken({
    userId: ownerId,
    email: 'owner@test.com',
    ownerId,
    role: 'owner',
    permissions: ['all'],
    churchId,
    allowedChurchIds: [churchId]
  }).token;

  const tokenViewOnly = generateAccessToken({
    userId: secUserViewOnly,
    email: 'sec-view@test.com',
    ownerId,
    role: 'secondary',
    permissions: ['view'],
    churchId,
    allowedChurchIds: [churchId]
  }).token;

  const tokenCreateOnly = generateAccessToken({
    userId: secUserCreateOnly,
    email: 'sec-create@test.com',
    ownerId,
    role: 'secondary',
    permissions: ['create'],
    churchId,
    allowedChurchIds: [churchId]
  }).token;

  const tokenEditOnly = generateAccessToken({
    userId: secUserEditOnly,
    email: 'sec-edit@test.com',
    ownerId,
    role: 'secondary',
    permissions: ['edit'], // tem view, create, edit implicitamente
    churchId,
    allowedChurchIds: [churchId]
  }).token;

  const tokenDeleteOnly = generateAccessToken({
    userId: secUserDeleteOnly,
    email: 'sec-delete@test.com',
    ownerId,
    role: 'secondary',
    permissions: ['delete'], // tem view, delete
    churchId,
    allowedChurchIds: [churchId]
  }).token;

  // Server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

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
    // ---------------------------------------------------------------------------------
    // CENÁRIO 1: Usuário VIEW-ONLY (Apenas Leitura)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 1: Usuário Secundário VIEW-ONLY (Apenas Leitura) ---');

    // 1.1 Pode consultar transações
    const resGetTxView = await fetch(`${baseUrl}/api/v1/consolidated_transactions?church_id=${churchId}`, {
      headers: { Authorization: `Bearer ${tokenViewOnly}` }
    });
    assert(resGetTxView.status === 200, `GET /consolidated_transactions permitido para view-only (status: ${resGetTxView.status})`);

    // 1.2 Pode consultar contas a pagar
    const resGetRecView = await fetch(`${baseUrl}/api/v1/financial_records?church_id=${churchId}`, {
      headers: { Authorization: `Bearer ${tokenViewOnly}` }
    });
    assert(resGetRecView.status === 200, `GET /financial_records permitido para view-only (status: ${resGetRecView.status})`);

    // 1.3 Bloqueado ao tentar criar transação avulsa
    const resPostTxView = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenViewOnly}`
      },
      body: JSON.stringify({
        id: 'test-perm-op-tx-view-attempt',
        amount: 50.0,
        description: 'Tentativa Create por View-Only',
        type: 'income',
        transaction_date: '2026-11-02',
        church_id: churchId
      })
    });
    assert(resPostTxView.status === 403, `POST /consolidated_transactions bloqueado para view-only (status: ${resPostTxView.status})`);

    // 1.4 Bloqueado ao tentar criar transações em lote (bulk)
    const resPostBulkView = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenViewOnly}`
      },
      body: JSON.stringify({
        transactions: [
          {
            id: 'test-perm-op-tx-bulk-view-attempt',
            amount: 50.0,
            description: 'Tentativa Bulk por View-Only',
            type: 'income',
            transaction_date: '2026-11-02',
            church_id: churchId
          }
        ]
      })
    });
    assert(resPostBulkView.status === 403, `POST /consolidated_transactions/bulk bloqueado para view-only (status: ${resPostBulkView.status})`);

    // 1.5 Bloqueado ao tentar alterar transação existente
    const resPutTxView = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-perm-op-tx-01`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenViewOnly}`
      },
      body: JSON.stringify({
        description: 'Tentativa Edit por View-Only'
      })
    });
    assert(resPutTxView.status === 403, `PUT /consolidated_transactions/:id bloqueado para view-only (status: ${resPutTxView.status})`);

    // 1.6 Bloqueado ao tentar excluir transação existente
    const resDelTxView = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-perm-op-tx-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenViewOnly}` }
    });
    assert(resDelTxView.status === 403, `DELETE /consolidated_transactions/:id bloqueado para view-only (status: ${resDelTxView.status})`);

    // 1.7 Bloqueado ao tentar exclusão em lote (bulk-delete)
    const resBulkDelTxView = await fetch(`${baseUrl}/api/v1/consolidated_transactions/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenViewOnly}`
      },
      body: JSON.stringify({ ids: ['test-perm-op-tx-01'] })
    });
    assert(resBulkDelTxView.status === 403, `POST /consolidated_transactions/bulk-delete bloqueado para view-only (status: ${resBulkDelTxView.status})`);

    // 1.8 Bloqueado ao tentar criar registro financeiro
    const resPostRecView = await fetch(`${baseUrl}/api/v1/financial_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenViewOnly}`
      },
      body: JSON.stringify({
        title: 'Tentativa Create Rec por View-Only',
        amount: 80.0,
        type: 'expense',
        due_date: '2026-11-20',
        church_id: churchId
      })
    });
    assert(resPostRecView.status === 403, `POST /financial_records bloqueado para view-only (status: ${resPostRecView.status})`);

    // 1.9 Bloqueado ao tentar alterar registro financeiro
    const resPutRecView = await fetch(`${baseUrl}/api/v1/financial_records/test-perm-op-rec-01`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenViewOnly}`
      },
      body: JSON.stringify({ title: 'Tentativa Update Rec por View-Only' })
    });
    assert(resPutRecView.status === 403, `PUT /financial_records/:id bloqueado para view-only (status: ${resPutRecView.status})`);

    // 1.10 Bloqueado ao tentar excluir registro financeiro
    const resDelRecView = await fetch(`${baseUrl}/api/v1/financial_records/test-perm-op-rec-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenViewOnly}` }
    });
    assert(resDelRecView.status === 403, `DELETE /financial_records/:id bloqueado para view-only (status: ${resDelRecView.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 2: Usuário CREATE-ONLY (Inserção sem Edição nem Exclusão)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Usuário Secundário CREATE-ONLY ---');

    // 2.1 Consegue criar transação
    const resPostTxCreate = await fetch(`${baseUrl}/api/v1/consolidated_transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCreateOnly}`
      },
      body: JSON.stringify({
        id: 'test-perm-op-tx-create-01',
        amount: 150.0,
        description: 'Transação Criada por Create-Only',
        type: 'income',
        transaction_date: '2026-11-03',
        church_id: churchId
      })
    });
    assert(resPostTxCreate.status === 201, `POST /consolidated_transactions permitido para create-only (status: ${resPostTxCreate.status})`);

    // 2.2 Consegue criar registro financeiro
    const resPostRecCreate = await fetch(`${baseUrl}/api/v1/financial_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCreateOnly}`
      },
      body: JSON.stringify({
        title: 'Registro Financeiro Criado por Create-Only',
        amount: 200.0,
        type: 'expense',
        due_date: '2026-11-25',
        church_id: churchId
      })
    });
    assert(resPostRecCreate.status === 201, `POST /financial_records permitido para create-only (status: ${resPostRecCreate.status})`);
    const createdRecId = (await resPostRecCreate.json()).id;

    // 2.3 Bloqueado ao tentar editar transação existente
    const resPutTxCreate = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-perm-op-tx-create-01`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCreateOnly}`
      },
      body: JSON.stringify({ description: 'Tentativa de edição por Create-Only' })
    });
    assert(resPutTxCreate.status === 403, `PUT /consolidated_transactions/:id bloqueado para create-only (status: ${resPutTxCreate.status})`);

    // 2.4 Bloqueado ao tentar excluir transação
    const resDelTxCreate = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-perm-op-tx-create-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCreateOnly}` }
    });
    assert(resDelTxCreate.status === 403, `DELETE /consolidated_transactions/:id bloqueado para create-only (status: ${resDelTxCreate.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 3: Usuário EDIT (Edição e Criação, mas sem Exclusão)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Usuário Secundário EDIT (Edição/Criação sem Exclusão) ---');

    // 3.1 Consegue editar transação existente
    const resPutTxEdit = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-perm-op-tx-01`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenEditOnly}`
      },
      body: JSON.stringify({ description: 'Descrição Atualizada por Edit-User' })
    });
    assert(resPutTxEdit.status === 200, `PUT /consolidated_transactions/:id permitido para editor (status: ${resPutTxEdit.status})`);

    // 3.2 Consegue editar registro financeiro existente
    const resPutRecEdit = await fetch(`${baseUrl}/api/v1/financial_records/${createdRecId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenEditOnly}`
      },
      body: JSON.stringify({ title: 'Título Atualizado por Edit-User' })
    });
    assert(resPutRecEdit.status === 200, `PUT /financial_records/:id permitido para editor (status: ${resPutRecEdit.status})`);

    // 3.3 Bloqueado ao tentar excluir transação
    const resDelTxEdit = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-perm-op-tx-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenEditOnly}` }
    });
    assert(resDelTxEdit.status === 403, `DELETE /consolidated_transactions/:id bloqueado para editor sem permissão de delete (status: ${resDelTxEdit.status})`);

    // 3.4 Bloqueado ao tentar excluir registro financeiro
    const resDelRecEdit = await fetch(`${baseUrl}/api/v1/financial_records/${createdRecId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenEditOnly}` }
    });
    assert(resDelRecEdit.status === 403, `DELETE /financial_records/:id bloqueado para editor sem permissão de delete (status: ${resDelRecEdit.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 4: Usuário DELETE (Exclusão Permitida)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Usuário Secundário DELETE ---');

    // 4.1 Consegue excluir transação existente
    const resDelTxDelete = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-perm-op-tx-create-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenDeleteOnly}` }
    });
    assert(resDelTxDelete.status === 200, `DELETE /consolidated_transactions/:id permitido para delete-user (status: ${resDelTxDelete.status})`);

    // 4.2 Consegue excluir registro financeiro existente
    const resDelRecDelete = await fetch(`${baseUrl}/api/v1/financial_records/${createdRecId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenDeleteOnly}` }
    });
    assert(resDelRecDelete.status === 200, `DELETE /financial_records/:id permitido para delete-user (status: ${resDelRecDelete.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 5: Proprietário (Owner) — Plenos Poderes
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 5: Titular (Owner) — Plenos Poderes ---');

    // 5.1 Owner exclui transação base
    const resDelTxOwner = await fetch(`${baseUrl}/api/v1/consolidated_transactions/test-perm-op-tx-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resDelTxOwner.status === 200, `DELETE /consolidated_transactions/:id permitido para Owner (status: ${resDelTxOwner.status})`);

    // 5.2 Owner exclui registro financeiro base
    const resDelRecOwner = await fetch(`${baseUrl}/api/v1/financial_records/test-perm-op-rec-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwner}` }
    });
    assert(resDelRecOwner.status === 200, `DELETE /financial_records/:id permitido para Owner (status: ${resDelRecOwner.status})`);

  } finally {
    server.close();
    cleanupDb();
  }

  console.log('\n========================================================================');
  console.log(`📊 RESUMO DA SUB-ETAPA 3.4: ${passed} passaram, ${failed} falharam.`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOP10Subetapa34Tests().catch((err) => {
  console.error('Erro fatal executando testes:', err);
  process.exit(1);
});
