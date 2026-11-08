import { getTenantContext, extractContextPermissions, hasPermission, TenantContext } from '../server.js';
import { generateAccessToken } from '../auth/utils/jwt.utils.js';

async function runOP10Subetapa32Tests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE MATRIZ DE PERMISSÕES — OP-10 SUB-ETAPA 3.2');
  console.log('   INGESTÃO DE PERMISSÕES NO TENANTCONTEXT E HELPER hasPermission');
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

  // ---------------------------------------------------------------------------------
  // CENÁRIO 1: Testes de Extração e Normalização de Permissões
  // ---------------------------------------------------------------------------------
  console.log('--- CENÁRIO 1: Extração e Normalização de Permissões ---');
  const permsArray = extractContextPermissions({ permissions: ['VIEW', 'Edit', '  DELETE  '] });
  assert(
    permsArray.length === 3 && permsArray.includes('view') && permsArray.includes('edit') && permsArray.includes('delete'),
    `Array de permissões em maiúsculo/com espaços é normalizado para minúsculo e sem espaços (${permsArray.join(', ')})`
  );

  const permsJson = extractContextPermissions({ permissions: '["reports", "audit"]' });
  assert(
    permsJson.length === 2 && permsJson.includes('reports') && permsJson.includes('audit'),
    `String JSON de permissões é desserializada e normalizada com sucesso (${permsJson.join(', ')})`
  );

  const permsEmpty = extractContextPermissions(null);
  assert(permsEmpty.length === 0, `Usuário nulo/indefinido retorna array de permissões vazio`);

  // ---------------------------------------------------------------------------------
  // CENÁRIO 2: Ingestão de Permissões via JWT em getTenantContext
  // ---------------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 2: Extração de Permissões a partir de Tokens JWT ---');

  // Token Owner
  const ownerToken = generateAccessToken({
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'owner@test.com',
    ownerId: '11111111-1111-1111-1111-111111111111',
    role: 'owner',
    permissions: [],
    churchId: '11111111-0000-0000-0000-000000000001'
  }).token;

  const mockReqOwner = { headers: { authorization: `Bearer ${ownerToken}` } } as any;
  const ctxOwner = getTenantContext(mockReqOwner);
  assert(ctxOwner.isOwner === true, `Contexto reconhecido como Proprietário (isOwner: true)`);
  assert(ctxOwner.permissions.includes('all'), `Proprietário herda permissão "all" por padrão (${ctxOwner.permissions.join(', ')})`);

  // Token Secundário View-Only
  const secViewToken = generateAccessToken({
    userId: '22222222-3333-3333-3333-333333333333',
    email: 'sec-view@test.com',
    ownerId: '11111111-1111-1111-1111-111111111111',
    role: 'secondary',
    permissions: ['view'],
    churchId: '11111111-0000-0000-0000-000000000001'
  }).token;

  const mockReqSecView = { headers: { authorization: `Bearer ${secViewToken}` } } as any;
  const ctxSecView = getTenantContext(mockReqSecView);
  assert(ctxSecView.isSecondaryUser === true, `Contexto reconhecido como Secundário (isSecondaryUser: true)`);
  assert(
    ctxSecView.permissions.length === 1 && ctxSecView.permissions[0] === 'view',
    `Usuário secundário com permissão "view" possui rigorosamente apenas [view] no contexto`
  );

  // Token Secundário Edit + Delete
  const secEditDelToken = generateAccessToken({
    userId: '22222222-4444-4444-4444-444444444444',
    email: 'sec-edit@test.com',
    ownerId: '11111111-1111-1111-1111-111111111111',
    role: 'secondary',
    permissions: ['edit', 'delete'],
    churchId: '11111111-0000-0000-0000-000000000001'
  }).token;

  const mockReqSecEditDel = { headers: { authorization: `Bearer ${secEditDelToken}` } } as any;
  const ctxSecEditDel = getTenantContext(mockReqSecEditDel);
  assert(
    ctxSecEditDel.permissions.includes('edit') && ctxSecEditDel.permissions.includes('delete'),
    `Usuário secundário com edit/delete carrega ambas as permissões no contexto`
  );

  // Request não autenticado
  const mockReqAnon = { headers: {} } as any;
  const ctxAnon = getTenantContext(mockReqAnon);
  assert(ctxAnon.isAuthenticated === false && ctxAnon.permissions.length === 0, `Request não autenticado possui permissions: []`);

  // ---------------------------------------------------------------------------------
  // CENÁRIO 3: Validação do Helper hasPermission
  // ---------------------------------------------------------------------------------
  console.log('\n--- CENÁRIO 3: Avaliação de Permissões via hasPermission ---');

  // Owner tem permissão universal
  assert(hasPermission(ctxOwner, 'view'), `Owner possui permissão "view"`);
  assert(hasPermission(ctxOwner, 'edit'), `Owner possui permissão "edit"`);
  assert(hasPermission(ctxOwner, 'delete'), `Owner possui permissão "delete"`);
  assert(hasPermission(ctxOwner, 'audit'), `Owner possui permissão "audit"`);

  // Secundário View-Only: pode ver, mas NÃO pode criar, editar ou deletar
  assert(hasPermission(ctxSecView, 'view'), `Secundário "view" possui permissão para visualizar (view)`);
  assert(!hasPermission(ctxSecView, 'edit'), `Secundário "view" tem negada permissão para editar (edit)`);
  assert(!hasPermission(ctxSecView, 'create'), `Secundário "view" tem negada permissão para criar (create)`);
  assert(!hasPermission(ctxSecView, 'delete'), `Secundário "view" tem negada permissão para deletar (delete)`);
  assert(!hasPermission(ctxSecView, 'audit'), `Secundário "view" tem negada permissão para auditoria (audit)`);

  // Secundário Edit-Delete: pode ver, criar, editar e deletar, mas NÃO audit
  assert(hasPermission(ctxSecEditDel, 'view'), `Secundário com edit implicitamente possui permissão "view"`);
  assert(hasPermission(ctxSecEditDel, 'create'), `Secundário com edit implicitamente possui permissão "create"`);
  assert(hasPermission(ctxSecEditDel, 'edit'), `Secundário com edit possui permissão "edit"`);
  assert(hasPermission(ctxSecEditDel, 'delete'), `Secundário com delete possui permissão "delete"`);
  assert(!hasPermission(ctxSecEditDel, 'audit'), `Secundário com edit/delete não possui permissão "audit"`);

  // Secundário com 'admin': possui passe total
  const ctxSecAdmin: TenantContext = {
    userId: 'sec-admin',
    ownerId: 'owner-id',
    churchId: 'church-id',
    allowedChurchIds: ['church-id'],
    allowedBankIds: [],
    permissions: ['admin'],
    role: 'secondary',
    isSuperAdmin: false,
    isOwner: false,
    isSecondaryUser: true,
    isAuthenticated: true
  };
  assert(hasPermission(ctxSecAdmin, 'delete'), `Secundário com role/permissão "admin" possui passe para deletar`);
  assert(hasPermission(ctxSecAdmin, 'audit'), `Secundário com role/permissão "admin" possui passe para audit`);

  // Contexto anônimo sempre negado
  assert(!hasPermission(ctxAnon, 'view'), `Contexto anônimo tem negado hasPermission("view")`);

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO DA SUB-ETAPA 3.2: ${passed} passaram, ${failed} falharam.`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOP10Subetapa32Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
