import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 🛡️ TESTE DE REGRESSÃO: Proteção de Seleção Manual da Igreja em ManualIdModal
 * 
 * OBJETIVO:
 * Garantir que, na tela de identificação (ManualIdModal), quando o usuário escolhe
 * uma Igreja de Destino, sua escolha seja estritamente preservada e NÃO seja sobrescrita
 * ou revertida quando outros campos (como contribuinte, categoria, cadastrar novo, unificar, etc.)
 * forem identificados ou alterados posteriormente.
 */
test('ManualIdModal: Proteção da Seleção Manual de Igreja contra Sobrescritas', async (t) => {
  const manualIdModalPath = resolve(process.cwd(), 'components/modals/ManualIdModal.tsx');
  assert.ok(existsSync(manualIdModalPath), 'ManualIdModal.tsx não encontrado');

  const content = readFileSync(manualIdModalPath, 'utf-8');

  await t.test('Deve possuir isChurchManuallyChangedRef para rastreamento de escolha ativa do usuário', () => {
    assert.ok(
      content.includes('isChurchManuallyChangedRef = React.useRef<boolean>(false)'),
      'isChurchManuallyChangedRef ausente no ManualIdModal'
    );
  });

  await t.test('Deve marcar isChurchManuallyChangedRef como true ao alterar a igreja no select', () => {
    assert.ok(
      content.includes('isChurchManuallyChangedRef.current = true'),
      'isChurchManuallyChangedRef não é acionado no evento onChange do select de igreja'
    );
  });

  await t.test('handleChooseContributor não deve sobrescrever a igreja se o usuário já escolheu manualmente', () => {
    assert.ok(
      content.includes('!isChurchManuallyChangedRef.current && targetChurch?.id'),
      'handleChooseContributor ainda sobrescreve a igreja incondicionalmente'
    );
  });

  await t.test('Efeito de similaridade VPS não deve sobrescrever a igreja escolhida manualmente', () => {
    assert.ok(
      content.includes('if (chId && !isChurchManuallyChangedRef.current)'),
      'Efeito de similaridade ainda sobrescreve a igreja incondicionalmente'
    );
  });

  await t.test('Ações de Cadastrar Novo e Unificar Cadastro devem respeitar a escolha manual da igreja', () => {
    assert.ok(
      content.includes('if (!isChurchManuallyChangedRef.current)'),
      'Botões Cadastrar Novo / Unificar não verificam isChurchManuallyChangedRef'
    );
  });
});
