import { app } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';
import http from 'http';
import { DatabaseSync } from 'node:sqlite';

async function runOP16SavedReportsSecurityTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES — OP-16 (SUB-ETAPA 7.2)');
  console.log('   HARDENING MULTI-TENANT E RBAC NAS ROTAS DE RELATÓRIOS SALVOS');
  console.log('========================================================================\n');

  const ownerAId = '99999999-9999-4999-a999-999999999999';
  const ownerBId = '88888888-8888-4888-a888-888888888888';
  const secondaryAId = '77777777-7777-4777-a777-777777777777';

  const churchA1 = '66666666-6666-4666-a666-666666666666';
  const churchA2 = '55555555-5555-4555-a555-555555555555';
  const churchB1 = '44444444-4444-4444-a444-444444444444';

  const sqlitePath = 'data/contributors_local.sqlite';
  const db = new DatabaseSync(sqlitePath);
  db.function('now', () => new Date().toISOString());

  // Limpeza
  try {
    db.prepare("DELETE FROM saved_reports WHERE id LIKE 'rep-op16%'").run();
    db.prepare("DELETE FROM churches WHERE id IN (?, ?, ?)").run(churchA1, churchA2, churchB1);
  } catch (_) {}

  // Inserir igrejas no SQLite
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA1, ownerAId, 'Igreja Permitida Secundário');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchA2, ownerAId, 'Igreja Restrita Secundário');
  db.prepare("INSERT OR REPLACE INTO churches (id, user_id, name) VALUES (?, ?, ?)").run(churchB1, ownerBId, 'Igreja Outra Organização');

  // Relatórios pré-existentes
  db.prepare(`
    INSERT OR REPLACE INTO saved_reports (id, name, record_count, user_id, church_id, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run('rep-op16-allowed', 'Relatório Permitido A1', 10, ownerAId, churchA1, JSON.stringify({ summary: 'OK' }));

  db.prepare(`
    INSERT OR REPLACE INTO saved_reports (id, name, record_count, user_id, church_id, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run('rep-op16-forbidden', 'Relatório Restrito A2', 5, ownerAId, churchA2, JSON.stringify({ summary: 'Restrito' }));

  // Iniciar servidor
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const ownerAToken = generateAccessToken({
    userId: ownerAId,
    email: 'ownerA@reports.test',
    ownerId: ownerAId,
    role: 'owner',
    permissions: ['all'],
    churchId: churchA1
  }).token;

  const secondaryAToken = generateAccessToken({
    userId: secondaryAId,
    email: 'secA@reports.test',
    ownerId: ownerAId,
    role: 'secondary',
    permissions: ['view', 'create', 'reports'],
    allowedChurchIds: [churchA1], // Somente churchA1 permitida! churchA2 e churchB1 proibidas.
    churchId: churchA1
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
    // CENÁRIO 1: Hardening de POST /api/v1/saved_reports
    // -------------------------------------------------------------
    console.log('--- CENÁRIO 1: POST /api/v1/saved_reports ---');

    // 1.1 Owner A tentando salvar para igreja de Owner B
    const resPostForeign = await fetch(`${baseUrl}/api/v1/saved_reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        id: 'rep-op16-foreign',
        name: 'Relatório Invasor B',
        record_count: 3,
        church_id: churchB1,
        data: { test: true }
      })
    });
    assert(resPostForeign.status === 403, `Owner A tentando salvar relatório para igreja de outra org bloqueado com HTTP 403 (Recebido: ${resPostForeign.status})`);

    // 1.2 Secundário A tentando salvar para congregação não permitida (churchA2)
    const resPostSecForbidden = await fetch(`${baseUrl}/api/v1/saved_reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryAToken}` },
      body: JSON.stringify({
        id: 'rep-op16-sec-forb',
        name: 'Relatório Secundário Proibido',
        record_count: 2,
        church_id: churchA2,
        data: { test: true }
      })
    });
    assert(resPostSecForbidden.status === 403, `Secundário A tentando salvar para congregação restrita bloqueado com HTTP 403 (Recebido: ${resPostSecForbidden.status})`);

    // 1.3 Secundário A salvando para congregação permitida (churchA1)
    const resPostSecOk = await fetch(`${baseUrl}/api/v1/saved_reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryAToken}` },
      body: JSON.stringify({
        id: 'rep-op16-sec-ok',
        name: 'Relatório Secundário Permitido',
        record_count: 5,
        church_id: churchA1,
        data: { test: true }
      })
    });
    assert(resPostSecOk.status === 201, `Secundário A salvando relatório em congregação autorizada aceito com HTTP 201 (Recebido: ${resPostSecOk.status})`);

    // -------------------------------------------------------------
    // CENÁRIO 2: Hardening de PUT /api/v1/saved_reports/:id
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: PUT /api/v1/saved_reports/:id ---');

    // 2.1 Secundário A tentando editar relatório pertencente a congregação restrita (rep-op16-forbidden)
    const resPutSecForb = await fetch(`${baseUrl}/api/v1/saved_reports/rep-op16-forbidden`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryAToken}` },
      body: JSON.stringify({ name: 'Nome Adulterado' })
    });
    assert(resPutSecForb.status === 403, `Secundário A tentando editar relatório de congregação restrita bloqueado com HTTP 403 (Recebido: ${resPutSecForb.status})`);

    // 2.2 Secundário A tentando transferir relatório permitido para congregação proibida (churchA2)
    const resPutSecChangeChurch = await fetch(`${baseUrl}/api/v1/saved_reports/rep-op16-allowed`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryAToken}` },
      body: JSON.stringify({ church_id: churchA2 })
    });
    assert(resPutSecChangeChurch.status === 403, `Secundário A tentando mover relatório para congregação proibida bloqueado com HTTP 403 (Recebido: ${resPutSecChangeChurch.status})`);

    // 2.3 Secundário A editando seu relatório permitido
    const resPutSecOk = await fetch(`${baseUrl}/api/v1/saved_reports/rep-op16-allowed`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondaryAToken}` },
      body: JSON.stringify({ name: 'Relatório Atualizado com Sucesso' })
    });
    assert(resPutSecOk.status === 200, `Secundário A atualizando relatório permitido aceito com HTTP 200 (Recebido: ${resPutSecOk.status})`);

    // -------------------------------------------------------------
    // CENÁRIO 3: Hardening de DELETE /api/v1/saved_reports/:id
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: DELETE /api/v1/saved_reports/:id ---');

    // 3.1 Secundário A tentando deletar relatório pertencente a congregação restrita
    const resDelSecForb = await fetch(`${baseUrl}/api/v1/saved_reports/rep-op16-forbidden`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secondaryAToken}` }
    });
    assert(resDelSecForb.status === 403, `Secundário A tentando deletar relatório de congregação restrita bloqueado com HTTP 403 (Recebido: ${resDelSecForb.status})`);

    // 3.2 Secundário A deletando relatório permitido
    const resDelSecOk = await fetch(`${baseUrl}/api/v1/saved_reports/rep-op16-sec-ok`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secondaryAToken}` }
    });
    assert(resDelSecOk.status === 200, `Secundário A deletando relatório permitido aceito com HTTP 200 (Recebido: ${resDelSecOk.status})`);

    // -------------------------------------------------------------
    // CENÁRIO 4: Isolamento no GET /api/v1/saved_reports
    // -------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Isolamento no GET /api/v1/saved_reports ---');

    const resGetSec = await fetch(`${baseUrl}/api/v1/saved_reports`, {
      headers: { Authorization: `Bearer ${secondaryAToken}` }
    });
    assert(resGetSec.status === 200, `GET /saved_reports retornou HTTP 200`);
    const secList = await resGetSec.json();
    const hasForbidden = secList.some((r: any) => r.id === 'rep-op16-forbidden' || r.church_id === churchA2);
    assert(!hasForbidden, `Nenhum relatório de congregação restrita vazou na listagem do usuário secundário`);

    console.log('\n========================================================================');
    console.log(`📊 RESULTADO DA SUB-ETAPA 7.2: ${passed} APROVADOS, ${failed} FALHAS`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    try {
      db.prepare("DELETE FROM saved_reports WHERE id LIKE 'rep-op16%'").run();
      db.prepare("DELETE FROM churches WHERE id IN (?, ?, ?)").run(churchA1, churchA2, churchB1);
    } catch (_) {}
    server.close();
  }
}

runOP16SavedReportsSecurityTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
