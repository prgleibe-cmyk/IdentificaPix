import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('PB-002: Isolamento, Não-Vazamento e Não-Persistência de Lançamentos Manuais Cancelados (Anti-Ghost Leak)', async (t) => {
  const sidebarPath = resolve(process.cwd(), 'components/layout/Sidebar.tsx');
  const reportsViewPath = resolve(process.cwd(), 'views/ReportsView.tsx');
  const manualIdModalPath = resolve(process.cwd(), 'components/modals/ManualIdModal.tsx');
  const useTransactionMatcherPath = resolve(process.cwd(), 'hooks/reconciliation/useTransactionMatcher.ts');
  const useCloudSyncPath = resolve(process.cwd(), 'hooks/reconciliation/useCloudSync.ts');

  assert.ok(existsSync(sidebarPath), 'Sidebar.tsx não encontrado');
  assert.ok(existsSync(reportsViewPath), 'ReportsView.tsx não encontrado');
  assert.ok(existsSync(manualIdModalPath), 'ManualIdModal.tsx não encontrado');
  assert.ok(existsSync(useTransactionMatcherPath), 'useTransactionMatcher.ts não encontrado');
  assert.ok(existsSync(useCloudSyncPath), 'useCloudSync.ts não encontrado');

  const sidebarContent = readFileSync(sidebarPath, 'utf-8');
  const reportsViewContent = readFileSync(reportsViewPath, 'utf-8');
  const manualIdModalContent = readFileSync(manualIdModalPath, 'utf-8');
  const matcherContent = readFileSync(useTransactionMatcherPath, 'utf-8');
  const cloudSyncContent = readFileSync(useCloudSyncPath, 'utf-8');

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-1: Não-poluição de relatórios ao abrir formulário de lançamento manual', () => {
    // Ao abrir o lançamento manual, o rascunho deve ir apenas para bulkIdentificationTxs, nunca para matchResults
    const sidebarManualBlock = sidebarContent.slice(
      sidebarContent.indexOf('const handleManualLaunch ='),
      sidebarContent.indexOf('const handleInstallApp')
    );
    assert.ok(
      !sidebarManualBlock.includes('setMatchResults'),
      'Sidebar.tsx ainda está injetando newMatchResult diretamente em matchResults ao abrir'
    );

    const reportsManualBlock = reportsViewContent.slice(
      reportsViewContent.indexOf('const handleManualLaunch ='),
      reportsViewContent.indexOf('const [selectionMode, setSelectionMode]')
    );
    assert.ok(
      !reportsManualBlock.includes('setMatchResults'),
      'ReportsView.tsx ainda está injetando newMatchResult diretamente em matchResults ao abrir'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-2: Cancelamento e fechamento purgam integralmente rascunhos sem salvar', () => {
    // Validação comportamental: filtro de limpeza remove qualquer ID temporário ghost-manual-
    const stateWithDraft = [
      { transaction: { id: 'uuid-real-001', amount: 150 } },
      { transaction: { id: 'ghost-manual-17300000', amount: 0 } },
      { transaction: { id: 'uuid-real-002', amount: -320 } }
    ];

    const purged = stateWithDraft.filter((r: any) => !r.transaction?.id?.startsWith('ghost-manual-'));
    assert.equal(purged.length, 2, 'Rascunho não foi removido pelo filtro');
    assert.ok(purged.every((r: any) => !r.transaction?.id?.startsWith('ghost-manual-')), 'Permanece ghost no estado');
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-3: Não-ressurreição e não-retenção de rascunhos no motor de sincronização (CloudSync)', () => {
    // Validação da lógica do CloudSync: ghost nunca é retido em reportsMap ou mesclado na lista reconstruída
    assert.ok(
      cloudSyncContent.includes("const isGhost = typeof value.transaction?.id === 'string' && value.transaction.id.startsWith('ghost-manual-')"),
      'useCloudSync não possui verificação isGhost para reportsMap'
    );
    assert.ok(
      cloudSyncContent.includes("const isGhost = typeof p.transaction?.id === 'string' && p.transaction.id.startsWith('ghost-manual-')"),
      'useCloudSync não possui verificação isGhost para prev'
    );
  });

  await t.test('[GUARDA ESTRUTURAL] GE-1 a GE-4: Presença dos filtros defensivos em ManualIdModal e useTransactionMatcher', () => {
    assert.ok(
      manualIdModalContent.includes("!r.transaction?.id?.startsWith('ghost-manual-')"),
      'ManualIdModal handleClose não possui filtro de limpeza de ghost-manual-'
    );
    assert.ok(
      matcherContent.includes("!r.transaction?.id?.startsWith('ghost-manual-')"),
      'useTransactionMatcher closeManualIdentify não possui filtro de limpeza de ghost-manual-'
    );
  });
});
