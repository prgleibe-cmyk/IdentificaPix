import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP10Subetapa35Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE MATRIZ DE PERMISSÕES — OP-10 SUB-ETAPA 3.5');
  console.log('   BLINDAGEM DA GESTÃO DE USUÁRIOS SECUNDÁRIOS E PERFIS');
  console.log('========================================================================\n');

  const ownerA = '11111111-1111-1111-1111-111111111111';
  const secUserA = '11111111-2222-2222-2222-222222222222';
  const otherMemberA = '11111111-3333-3333-3333-333333333333';

  const ownerB = '22222222-2222-2222-2222-222222222222';
  const secUserB = '22222222-3333-3333-3333-333333333333';

  // SQLite setup
  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  function cleanupDb() {
    try {
      db.prepare("DELETE FROM profiles WHERE id IN (?, ?, ?, ?, ?, ?)").run(
        ownerA, secUserA, otherMemberA, ownerB, secUserB, 'new-sec-member-a'
      );
      db.prepare("DELETE FROM app_users WHERE id IN (?, ?, ?, ?, ?, ?)").run(
        ownerA, secUserA, otherMemberA, ownerB, secUserB, 'new-sec-member-a'
      );
    } catch (_) {}
  }

  cleanupDb();

  // Inserir perfis e app_users dos dois tenants
  db.prepare(`
    INSERT OR REPLACE INTO profiles (id, email, name, role, owner_id, permissions)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(ownerA, 'ownera@test.com', 'Titular Org A', 'owner', ownerA, '["all"]');

  db.prepare(`
    INSERT OR REPLACE INTO profiles (id, email, name, role, owner_id, permissions)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(secUserA, 'seca@test.com', 'Secundário Org A', 'member', ownerA, '["view"]');

  db.prepare(`
    INSERT OR REPLACE INTO profiles (id, email, name, role, owner_id, permissions)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(otherMemberA, 'membera2@test.com', 'Outro Membro Org A', 'member', ownerA, '["view"]');

  db.prepare(`
    INSERT OR REPLACE INTO profiles (id, email, name, role, owner_id, permissions)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(ownerB, 'ownerb@test.com', 'Titular Org B', 'owner', ownerB, '["all"]');

  db.prepare(`
    INSERT OR REPLACE INTO profiles (id, email, name, role, owner_id, permissions)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(secUserB, 'secb@test.com', 'Secundário Org B', 'member', ownerB, '["view"]');

  // Inserir app_users para teste de signup
  db.prepare(`
    INSERT OR REPLACE INTO app_users (id, email, password_hash, role, owner_id, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(ownerA, 'ownera@test.com', '$argon2id$v=19$m=65536,t=3,p=4$fakehash', 'owner', ownerA);

  // Tokens JWT
  const tokenOwnerA = generateAccessToken({
    userId: ownerA,
    email: 'ownera@test.com',
    ownerId: ownerA,
    role: 'owner',
    permissions: ['all']
  }).token;

  const tokenSecUserA = generateAccessToken({
    userId: secUserA,
    email: 'seca@test.com',
    ownerId: ownerA,
    role: 'secondary',
    permissions: ['view']
  }).token;

  const tokenOwnerB = generateAccessToken({
    userId: ownerB,
    email: 'ownerb@test.com',
    ownerId: ownerB,
    role: 'owner',
    permissions: ['all']
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
    // CENÁRIO 1: Acesso não autenticado a rotas de gestão de perfis
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 1: Bloqueio de Acesso Não Autenticado a /api/v1/profiles ---');

    const resGetNoAuth = await fetch(`${baseUrl}/api/v1/profiles`);
    assert(resGetNoAuth.status === 401, `GET /api/v1/profiles sem token rejeitado com 401 Unauthorized (status: ${resGetNoAuth.status})`);

    const resPostNoAuth = await fetch(`${baseUrl}/api/v1/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'anon-user', email: 'anon@test.com' })
    });
    assert(resPostNoAuth.status === 401, `POST /api/v1/profiles sem token rejeitado com 401 Unauthorized (status: ${resPostNoAuth.status})`);

    const resDelNoAuth = await fetch(`${baseUrl}/api/v1/profiles/${secUserA}`, { method: 'DELETE' });
    assert(resDelNoAuth.status === 401, `DELETE /api/v1/profiles/:id sem token rejeitado com 401 Unauthorized (status: ${resDelNoAuth.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 2: Usuário Secundário tentando gerenciar usuários ou escalar privilégios
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Bloqueio de Usuário Secundário em Gestão e Auto-Escalação ---');

    // 2.1 Secundário tentando criar outro membro
    const resSecCreateMember = await fetch(`${baseUrl}/api/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecUserA}`
      },
      body: JSON.stringify({
        id: 'new-sec-member-a',
        email: 'newsec@test.com',
        name: 'Novo Membro Criado por Secundário',
        role: 'member'
      })
    });
    assert(
      resSecCreateMember.status === 403,
      `POST /api/v1/profiles bloqueado com 403 para usuário secundário (status: ${resSecCreateMember.status})`
    );

    // 2.2 Secundário tentando excluir outro membro
    const resSecDeleteMember = await fetch(`${baseUrl}/api/v1/profiles/${otherMemberA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenSecUserA}` }
    });
    assert(
      resSecDeleteMember.status === 403,
      `DELETE /api/v1/profiles/:id bloqueado com 403 para usuário secundário (status: ${resSecDeleteMember.status})`
    );

    // 2.3 Secundário tentando alterar perfil de outro membro
    const resSecUpdateOther = await fetch(`${baseUrl}/api/v1/profiles/${otherMemberA}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecUserA}`
      },
      body: JSON.stringify({ name: 'Nome Alterado por Secundário' })
    });
    assert(
      resSecUpdateOther.status === 403,
      `PUT /api/v1/profiles/:id de outro membro bloqueado com 403 para secundário (status: ${resSecUpdateOther.status})`
    );

    // 2.4 Secundário tentando auto-escalação de privilégios (mudar seu próprio role para 'owner' ou permissão para 'all')
    const resSecSelfEscalate = await fetch(`${baseUrl}/api/v1/profiles/${secUserA}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenSecUserA}`
      },
      body: JSON.stringify({
        name: 'Secundário Nome Atualizado',
        role: 'owner',
        permissions: ['all']
      })
    });
    assert(resSecSelfEscalate.status === 200, `PUT /api/v1/profiles/:id do próprio perfil retorna 200 OK`);

    // Verificar se no banco de dados a tentativa de escalação foi devidamente ignorada
    const secUserRow = db.prepare('SELECT name, role, permissions FROM profiles WHERE id = ?').get(secUserA) as any;
    assert(
      secUserRow.name === 'Secundário Nome Atualizado',
      `Nome do perfil foi atualizado com sucesso (${secUserRow.name})`
    );
    assert(
      secUserRow.role === 'member',
      `Auto-escalação bloqueada: role permaneceu "member", não virou "owner" (${secUserRow.role})`
    );
    assert(
      secUserRow.permissions !== '["all"]' && !secUserRow.permissions.includes('all'),
      `Auto-escalação bloqueada: permissão permaneceu restrita sem "all" (${secUserRow.permissions})`
    );

    // ---------------------------------------------------------------------------------
    // CENÁRIO 3: Isolamento Cross-Tenant na Gestão de Perfis
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Isolamento Cross-Tenant entre Organizações ---');

    // 3.1 Owner A tentando listar perfis do Owner B passando ?owner_id=ownerB
    const resOwnerAListB = await fetch(`${baseUrl}/api/v1/profiles?owner_id=${ownerB}`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` }
    });
    assert(
      resOwnerAListB.status === 403,
      `GET /api/v1/profiles?owner_id=OrgB pelo Owner A bloqueado com 403 Forbidden (status: ${resOwnerAListB.status})`
    );

    // 3.2 Owner A tentando ler diretamente perfil de membro da Org B
    const resOwnerAGetB = await fetch(`${baseUrl}/api/v1/profiles/${secUserB}`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` }
    });
    assert(
      resOwnerAGetB.status === 403,
      `GET /api/v1/profiles/:id de membro da Org B pelo Owner A bloqueado com 403 Forbidden (status: ${resOwnerAGetB.status})`
    );

    // 3.3 Owner A tentando atualizar perfil da Org B
    const resOwnerAPutB = await fetch(`${baseUrl}/api/v1/profiles/${secUserB}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({ name: 'Nome hackeado cross-tenant' })
    });
    assert(
      resOwnerAPutB.status === 403,
      `PUT /api/v1/profiles/:id da Org B pelo Owner A bloqueado com 403 Forbidden (status: ${resOwnerAPutB.status})`
    );

    // 3.4 Owner A tentando excluir perfil da Org B
    const resOwnerADelB = await fetch(`${baseUrl}/api/v1/profiles/${secUserB}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerA}` }
    });
    assert(
      resOwnerADelB.status === 403,
      `DELETE /api/v1/profiles/:id da Org B pelo Owner A bloqueado com 403 Forbidden (status: ${resOwnerADelB.status})`
    );

    // 3.5 Owner A tentando excluir a si mesmo como titular principal
    const resOwnerDelSelf = await fetch(`${baseUrl}/api/v1/profiles/${ownerA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerA}` }
    });
    assert(
      resOwnerDelSelf.status === 403,
      `DELETE /api/v1/profiles/:id do próprio titular bloqueado com 403 (status: ${resOwnerDelSelf.status})`
    );

    // ---------------------------------------------------------------------------------
    // CENÁRIO 4: Operações Legítimas do Titular (Owner)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Operações Legítimas do Titular (Owner) ---');

    // 4.1 Owner A cria novo membro secundário
    const resOwnerCreate = await fetch(`${baseUrl}/api/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({
        id: 'new-sec-member-a',
        email: 'newsec-legit@test.com',
        name: 'Novo Membro Legítimo Org A',
        role: 'member',
        permissions: ['view', 'create']
      })
    });
    assert(resOwnerCreate.status === 200, `POST /api/v1/profiles pelo Owner A autorizado com 200 OK (status: ${resOwnerCreate.status})`);

    // 4.2 Owner A atualiza o membro secundário
    const resOwnerUpdate = await fetch(`${baseUrl}/api/v1/profiles/new-sec-member-a`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`
      },
      body: JSON.stringify({
        name: 'Membro Legítimo Org A Atualizado',
        permissions: ['view', 'create', 'edit']
      })
    });
    assert(resOwnerUpdate.status === 200, `PUT /api/v1/profiles/:id pelo Owner A autorizado com 200 OK (status: ${resOwnerUpdate.status})`);

    // 4.3 Owner A exclui o membro secundário criado
    const resOwnerDelete = await fetch(`${baseUrl}/api/v1/profiles/new-sec-member-a`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenOwnerA}` }
    });
    assert(resOwnerDelete.status === 200, `DELETE /api/v1/profiles/:id pelo Owner A autorizado com 200 OK (status: ${resOwnerDelete.status})`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 5: Prevenção de Account Takeover no POST /api/v1/auth/signup
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 5: Proteção Contra Sobrescrita de Senha em /auth/signup ---');

    const resSignupHijack = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ownera@test.com',
        password: 'NewAttackerPassword123!',
        name: 'Hacker'
      })
    });
    assert(
      resSignupHijack.status === 400,
      `POST /auth/signup com e-mail já existente bloqueado com 400 Bad Request (status: ${resSignupHijack.status})`
    );

  } finally {
    server.close();
    cleanupDb();
  }

  console.log('\n========================================================================');
  console.log(`📊 RESUMO DA SUB-ETAPA 3.5: ${passed} passaram, ${failed} falharam.`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOP10Subetapa35Tests().catch((err) => {
  console.error('Erro fatal executando testes:', err);
  process.exit(1);
});
