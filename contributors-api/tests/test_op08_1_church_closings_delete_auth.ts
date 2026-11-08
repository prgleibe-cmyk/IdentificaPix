import { app, pool } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP081Tests() {
  console.log('================================================================');
  console.log('🧪 BATERIA DE TESTES DE AUTORIZAÇÃO E ISOLAMENTO — ETAPA OP-08.1');
  console.log('   (COM AJUSTE CIRÚRGICO: ELIMINAÇÃO DE BYPASS EM MEMÓRIA)');
  console.log('   ROTA: DELETE /api/v1/church-closings/:churchId/:year/:month');
  console.log('================================================================\n');

  const ownerA_id = '00000000-0000-0000-0000-000000000001';
  const churchA_id = '00000000-0000-0000-0000-000000000001'; // Pertence ao Titular A (sede legada cadastrada em churches com church.id = ownerId)
  const churchB_id = '00000000-0000-0000-0000-000000000099'; // Pertence ao Titular B em churches
  const ownerB_id = 'owner-b-alien-uuid';
  const secUser_id = 'secondary-user-operator-uuid';
  const superAdmin_id = 'superadmin-user-uuid';
  const ghostOwner_id = 'ghost-owner-without-church-in-db-uuid'; // Titular cujo ownerId não possui congregação cadastrada na tabela churches

  // Seed baseline in local test sqlite
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
        updated_at TEXT
      );
    `);
    db.prepare('INSERT OR REPLACE INTO app_users (id, email, owner_id, role) VALUES (?, ?, ?, ?)').run(
      secUser_id,
      'operador.teste@igreja.com',
      ownerA_id,
      'secondary'
    );
    // Seed church B belonging to owner B
    db.prepare('INSERT OR REPLACE INTO churches (id, name, user_id) VALUES (?, ?, ?)').run(
      churchB_id,
      'Igreja Outro Titular B',
      ownerB_id
    );
    // Seed church A belonging to owner A
    db.prepare('INSERT OR REPLACE INTO churches (id, name, user_id) VALUES (?, ?, ?)').run(
      churchA_id,
      'Igreja Sede A',
      ownerA_id
    );
    // Garante que ghostOwner_id NÃO existe em churches
    db.prepare('DELETE FROM churches WHERE id = ?').run(ghostOwner_id);

    // Seed closing record for Church B (status: closed)
    db.prepare('INSERT OR REPLACE INTO church_closings (id, church_id, year, month, bank_id, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      `closing-${churchB_id}-2026-10`,
      churchB_id,
      2026,
      10,
      null,
      'closed'
    );
    // Seed closing record for Church A (status: closed)
    db.prepare('INSERT OR REPLACE INTO church_closings (id, church_id, year, month, bank_id, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      `closing-${churchA_id}-2026-10`,
      churchA_id,
      2026,
      10,
      null,
      'closed'
    );
    // Seed closing record for ghost church (status: closed)
    db.prepare('INSERT OR REPLACE INTO church_closings (id, church_id, year, month, bank_id, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      `closing-${ghostOwner_id}-2026-10`,
      ghostOwner_id,
      2026,
      10,
      null,
      'closed'
    );
    db.close();
  } catch (e: any) {
    console.warn('[SEED WARNING]', e.message);
  }

  // Start test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  console.log(`[TEST SERVER] Servidor rodando em ${baseUrl}\n`);

  // Tokens
  const tokenOwnerA = generateAccessToken({
    userId: ownerA_id,
    ownerId: ownerA_id,
    role: 'owner',
    permissions: ['all']
  }).token;

  const tokenGhostOwner = generateAccessToken({
    userId: ghostOwner_id,
    ownerId: ghostOwner_id,
    role: 'owner',
    permissions: ['all']
  }).token;

  const tokenSecondary = generateAccessToken({
    userId: secUser_id,
    ownerId: ownerA_id,
    role: 'secondary',
    permissions: ['view_financial'],
    allowedChurchIds: [churchA_id]
  }).token;

  const tokenSuperAdmin = generateAccessToken({
    userId: superAdmin_id,
    role: 'superadmin',
    is_superadmin: true,
    permissions: ['*']
  }).token;

  let passed = 0;
  let total = 0;

  function assert(scenario: string, condition: boolean, details: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] Cenário ${total}: ${scenario}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Cenário ${total}: ${scenario} - ${details}`);
    }
  }

  function getClosingStatus(churchId: string, year: number, month: number): string | null {
    try {
      const db = new DatabaseSync('data/contributors_local.sqlite');
      const row = db.prepare('SELECT status FROM church_closings WHERE church_id = ? AND year = ? AND month = ?').get(churchId, year, month) as any;
      db.close();
      return row ? row.status : null;
    } catch (_) {
      return null;
    }
  }

  // Cenário 1: Requisição sem token -> HTTP 401 (sem mutação no banco)
  {
    const res = await fetch(`${baseUrl}/api/v1/church-closings/${churchA_id}/2026/10`, {
      method: 'DELETE'
    });
    const statusBefore = getClosingStatus(churchA_id, 2026, 10);
    assert(
      'Requisição sem token resulta em HTTP 401 e não altera o banco',
      res.status === 401 && statusBefore === 'closed',
      `Esperado 401, recebido ${res.status}; status do banco: ${statusBefore}`
    );
  }

  // Cenário 2: Token inválido / forjado -> HTTP 401 (sem mutação no banco)
  {
    const res = await fetch(`${baseUrl}/api/v1/church-closings/${churchA_id}/2026/10`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer invalid.token.payload'
      }
    });
    const statusBefore = getClosingStatus(churchA_id, 2026, 10);
    assert(
      'Token inválido resulta em HTTP 401 e não altera o banco',
      res.status === 401 && statusBefore === 'closed',
      `Esperado 401, recebido ${res.status}; status do banco: ${statusBefore}`
    );
  }

  // Cenário 3: Usuário secundário autenticado -> HTTP 403 (sem mutação no banco)
  {
    const res = await fetch(`${baseUrl}/api/v1/church-closings/${churchA_id}/2026/10`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenSecondary}`
      }
    });
    const statusBefore = getClosingStatus(churchA_id, 2026, 10);
    assert(
      'Usuário secundário recebe HTTP 403 e não altera o banco',
      res.status === 403 && statusBefore === 'closed',
      `Esperado 403, recebido ${res.status}; status do banco: ${statusBefore}`
    );
  }

  // Cenário 4: Titular autenticado tentando acessar congregação de outra organização (Cross-Tenant) -> HTTP 403 (sem mutação no banco)
  {
    const res = await fetch(`${baseUrl}/api/v1/church-closings/${churchB_id}/2026/10`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`
      }
    });
    const statusChurchB = getClosingStatus(churchB_id, 2026, 10);
    assert(
      'Titular A tentando reabrir congregação do Titular B recebe HTTP 403 e não altera o banco',
      res.status === 403 && statusChurchB === 'closed',
      `Esperado 403, recebido ${res.status}; status do banco Church B: ${statusChurchB}`
    );
  }

  // Cenário 5: NOVO - Titular com effChurchId === ownerId, mas SEM registro correspondente na tabela churches -> HTTP 403
  {
    const res = await fetch(`${baseUrl}/api/v1/church-closings/${ghostOwner_id}/2026/10`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenGhostOwner}`
      }
    });
    const statusGhost = getClosingStatus(ghostOwner_id, 2026, 10);
    assert(
      'Titular com churchId === ownerId mas sem registro na tabela churches recebe HTTP 403 (eliminação de bypass em memória)',
      res.status === 403 && statusGhost === 'closed',
      `Esperado 403, recebido ${res.status}; status do banco ghost: ${statusGhost}`
    );
  }

  // Cenário 6: Titular autenticado na própria congregação legítima (existente em churches) -> HTTP 200
  {
    const res = await fetch(`${baseUrl}/api/v1/church-closings/${churchA_id}/2026/10`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`
      }
    });
    const data = await res.json();
    const statusAfter = getClosingStatus(churchA_id, 2026, 10);
    assert(
      'Titular autenticado na própria congregação legítima obtém sucesso (HTTP 200 e status reopened)',
      res.status === 200 && data.success === true && data.status === 'reopened' && statusAfter === 'reopened',
      `Esperado 200, recebido ${res.status}; status no banco: ${statusAfter}`
    );
  }

  // Cenário 7: Superadmin autenticado acessando congregação de suporte -> HTTP 200
  {
    // Restaura o fechamento para Church B como 'closed' para testar superadmin
    try {
      const db = new DatabaseSync('data/contributors_local.sqlite');
      db.prepare('UPDATE church_closings SET status = ? WHERE church_id = ? AND year = ? AND month = ?').run(
        'closed',
        churchB_id,
        2026,
        10
      );
      db.close();
    } catch (_) {}

    const res = await fetch(`${baseUrl}/api/v1/church-closings/${churchB_id}/2026/10`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenSuperAdmin}`
      }
    });
    const data = await res.json();
    assert(
      'Superadmin autenticado possui autorização administrativa legítima (HTTP 200)',
      res.status === 200 && data.success === true,
      `Esperado 200, recebido ${res.status}; payload: ${JSON.stringify(data)}`
    );
  }

  server.close();

  console.log('\n================================================================');
  console.log(`RESULTADO DOS TESTES: ${passed}/${total} APROVADOS`);
  console.log('================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runOP081Tests().catch((err) => {
  console.error('[FATAL ERROR IN TESTS]', err);
  process.exit(1);
});
