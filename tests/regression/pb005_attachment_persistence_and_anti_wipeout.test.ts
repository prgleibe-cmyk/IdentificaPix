import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 🛡️ TESTES DE REGRESSÃO ESPECÍFICOS: PB-005
 * 
 * RASTREABILIDADE TÉCNICA:
 * PB-005 → Persistência Real e Imediata de Documentos e Não-Sobrescrita Concorrente em Modais de Anexos (Anti-Wipeout)
 * 
 * INVARIANTES COMPORTAMENTAIS (Regras Funcionais Homologadas):
 *   - IC-1: Documento anexado permanece visível e salvo no QuickAttachModal sem sumir após carregamento.
 *   - IC-2: Hidratação de anexos no QuickAttachModal ocorre estritamente uma vez por transação aberta,
 *           não sendo reiniciada por re-renderizações ou novas referências de array do componente pai.
 *   - IC-3: Transações da Lista Viva (pendentes/não identificadas) possuem autorização expressa no backend
 *           para consulta e gravação de anexos via isAuthorizedForTransaction.
 *   - IC-4: Endpoint sob demanda GET /attachments seleciona id, bank_id e status para verificação íntegra.
 *   - IC-5: SmartPool sincroniza a coluna attachments no espelhamento para PostgreSQL remoto.
 *   - IC-6: EditManualTransactionModal preserva anexos com initializedRowIdRef e auto-salvamento em tempo real.
 * 
 * GUARDAS ESTRUTURAIS:
 *   - GE-1: QuickAttachModal possui loadedTxIdRef e exclui transaction?.attachments das dependências do useEffect.
 *   - GE-2: QuickAttachModal aciona saveAttachmentsForTransaction no onChangeAttachments.
 *   - GE-3: ManualIdModal aciona saveAttachmentsForTransaction e sincroniza bulkIdentificationTxs[0].attachments.
 *   - GE-4: contributors-api/server.ts autoriza transações com church_id nulo ou 'unidentified' para usuários da conta.
 *   - GE-5: EditManualTransactionModal possui initializedRowIdRef e auto-gravação em tempo real.
 */
test('PB-005: Persistência Real de Documentos e Anti-Wipeout Concorrente', async (t) => {
  const quickAttachPath = resolve(process.cwd(), 'components/modals/QuickAttachModal.tsx');
  const manualIdPath = resolve(process.cwd(), 'components/modals/ManualIdModal.tsx');
  const editManualPath = resolve(process.cwd(), 'components/modals/EditManualTransactionModal.tsx');
  const serverPath = resolve(process.cwd(), 'contributors-api/server.ts');
  const attServicePath = resolve(process.cwd(), 'services/expenseAttachmentService.ts');

  assert.ok(existsSync(quickAttachPath), 'QuickAttachModal.tsx não encontrado');
  assert.ok(existsSync(manualIdPath), 'ManualIdModal.tsx não encontrado');
  assert.ok(existsSync(editManualPath), 'EditManualTransactionModal.tsx não encontrado');
  assert.ok(existsSync(serverPath), 'contributors-api/server.ts não encontrado');
  assert.ok(existsSync(attServicePath), 'expenseAttachmentService.ts não encontrado');

  const quickAttachContent = readFileSync(quickAttachPath, 'utf-8');
  const manualIdContent = readFileSync(manualIdPath, 'utf-8');
  const editManualContent = readFileSync(editManualPath, 'utf-8');
  const serverContent = readFileSync(serverPath, 'utf-8');
  const attServiceContent = readFileSync(attServicePath, 'utf-8');

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-1 & IC-2: QuickAttachModal impede o efeito "carrega e some" via loadedTxIdRef e dependência limpa', () => {
    // 1. Deve possuir a ref de controle de transação carregada
    assert.ok(
      quickAttachContent.includes('loadedTxIdRef'),
      'QuickAttachModal não possui loadedTxIdRef para blindagem contra sobrescrita concorrente'
    );
    assert.ok(
      quickAttachContent.includes('loadedTxIdRef.current === transaction.id'),
      'QuickAttachModal não valida loadedTxIdRef.current para evitar reset indevido de estado'
    );

    // 2. Não deve incluir transaction?.attachments nas dependências do useEffect
    assert.ok(
      !quickAttachContent.includes('transaction?.attachments]'),
      'QuickAttachModal ainda contém transaction?.attachments nas dependências do useEffect, causando wipeout'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-3: Backend autoriza transações pendentes/não-identificadas da lista viva com isolamento multi-tenant', () => {
    const authFnStart = serverContent.indexOf('async function isAuthorizedForTransaction');
    const authFnEnd = serverContent.indexOf('async function isAuthorizedForFinancialRecord', authFnStart);
    assert.ok(authFnStart !== -1 && authFnEnd !== -1, 'Função isAuthorizedForTransaction não encontrada');
    const authFnBody = serverContent.slice(authFnStart, authFnEnd);

    // isAuthorizedForTransaction distingue transações identificadas vs pendentes/não identificadas
    assert.ok(
      authFnBody.includes("oldTx.church_id && oldTx.church_id !== 'unidentified'"),
      'isAuthorizedForTransaction não distingue lançamentos com congregação pendente/unidentified'
    );

    // Deve autorizar usuários secundários pertencentes à organização com base nos bancos permitidos
    assert.ok(
      authFnBody.includes('ctx.allowedBankIds && ctx.allowedBankIds.length > 0 && oldTx.bank_id') &&
      authFnBody.includes('ctx.allowedBankIds.includes(oldTx.bank_id)'),
      'isAuthorizedForTransaction não confere allowedBankIds para usuários secundários na lista viva'
    );

    // Deve autorizar proprietários por vínculo de banco ou membro da organização sem liberar registros órfãos de terceiros
    assert.ok(
      authFnBody.includes('SELECT id FROM banks WHERE id = $1 AND (user_id = $2 OR user_id = $3)') &&
      authFnBody.includes('return false;'),
      'isAuthorizedForTransaction não valida vínculo de organização/banco para proprietário'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-4: GET /attachments sob demanda consulta id, bank_id e status', () => {
    assert.ok(
      serverContent.includes("SELECT id, attachments, church_id, user_id, bank_id, status FROM consolidated_transactions"),
      'Endpoint GET /attachments não seleciona bank_id ou status, impedindo autorização íntegra da lista viva'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-5: SmartPool sincroniza coluna attachments no espelhamento remoto', () => {
    assert.ok(
      serverContent.includes('contribution_request_id, splits, attachments, created_at, updated_at'),
      'SmartPool não inclui a coluna attachments no INSERT remoto de consolidated_transactions'
    );
    assert.ok(
      serverContent.includes("EXCLUDED.attachments::text != '[]'") || serverContent.includes("EXCLUDED.attachments != '[]'"),
      'SmartPool não possui cláusula de preservação de attachments no ON CONFLICT'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-6: EditManualTransactionModal e ManualIdModal possuem blindagem contra perda de anexos', () => {
    // EditManualTransactionModal
    assert.ok(
      editManualContent.includes('initializedRowIdRef'),
      'EditManualTransactionModal não possui initializedRowIdRef para prevenir perda de anexos'
    );
    assert.ok(
      editManualContent.includes('saveAttachmentsForTransaction(activeTxId, newAtts)'),
      'EditManualTransactionModal não auto-persiste anexos em tempo real no onChangeAttachments'
    );

    // ManualIdModal
    assert.ok(
      manualIdContent.includes('saveAttachmentsForTransaction(activeTxId, next)'),
      'ManualIdModal não auto-persiste anexos em tempo real ao carregar arquivo'
    );
  });
});
