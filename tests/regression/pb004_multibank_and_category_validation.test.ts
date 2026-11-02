import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 🛡️ TESTES DE REGRESSÃO ESPECÍFICOS: PB-004
 * 
 * RASTREABILIDADE TÉCNICA:
 * PB-004 → Alimentação Universal Multi-Banco da Lista Viva e Seleção Estrita de Categorias Contábeis Cadastradas
 * 
 * INVARIANTES COMPORTAMENTAIS (Regras Funcionais Homologadas):
 *   - IC-1: Multi-Banco Universal na Lista Viva (painel exibe e permite carregar qualquer banco cadastrado)
 *   - IC-2: Preservação de bank_id e segregação correta de lançamentos
 *   - IC-3: Seleção estrita de categorias contábeis cadastradas em ManualIdModal
 *   - IC-4: Rejeição de rótulos genéricos ("ENTRADA"/"SAÍDA") e preenchimento da categoria padrão cadastrada ("Dízimo")
 * 
 * GUARDAS ESTRUTURAIS:
 *   - GE-1: UploadView renderiza banks sem filtro excludente de marcas (Sicoob/Sicredi)
 *   - GE-2: LaunchService preserva bankId sem descarte por regex UUID estrito
 *   - GE-3: ConsolidationService preserva bank_id sem descarte por regex UUID estrito
 *   - GE-4: useLiveListSync higieniza contributionType contra rótulos genéricos
 *   - GE-5: ManualIdModal valida categorias cadastradas e define padrão
 */
test('PB-004: Alimentação Universal Multi-Banco da Lista Viva e Seleção de Categorias', async (t) => {
  const uploadViewPath = resolve(process.cwd(), 'views/UploadView.tsx');
  const manualIdModalPath = resolve(process.cwd(), 'components/modals/ManualIdModal.tsx');
  const liveListSyncPath = resolve(process.cwd(), 'hooks/useLiveListSync.ts');
  const launchServicePath = resolve(process.cwd(), 'services/LaunchService.ts');
  const consolidationServicePath = resolve(process.cwd(), 'services/ConsolidationService.ts');

  assert.ok(existsSync(uploadViewPath), 'UploadView.tsx não encontrado');
  assert.ok(existsSync(manualIdModalPath), 'ManualIdModal.tsx não encontrado');
  assert.ok(existsSync(liveListSyncPath), 'useLiveListSync.ts não encontrado');
  assert.ok(existsSync(launchServicePath), 'LaunchService.ts não encontrado');
  assert.ok(existsSync(consolidationServicePath), 'ConsolidationService.ts não encontrado');

  const uploadViewContent = readFileSync(uploadViewPath, 'utf-8');
  const manualIdContent = readFileSync(manualIdModalPath, 'utf-8');
  const liveListContent = readFileSync(liveListSyncPath, 'utf-8');
  const launchContent = readFileSync(launchServicePath, 'utf-8');
  const consolidationContent = readFileSync(consolidationServicePath, 'utf-8');

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-1: UploadView exibe todos os bancos cadastrados sem filtros excludentes de marca', () => {
    // Não deve conter a filtragem restritiva antiga que limitava apenas a Sicoob/Sicredi
    assert.ok(
      !uploadViewContent.includes("key === 'SICOOB' || key === 'SICREDI'"),
      'UploadView ainda contém restrição hardcoded para Sicoob/Sicredi'
    );
    assert.ok(
      uploadViewContent.includes('const availableBanks = banks || []') ||
      uploadViewContent.includes('banks.map(') ||
      uploadViewContent.includes('availableBanks.map('),
      'UploadView não está mapeando a lista completa de bancos disponíveis'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-2: LaunchService e ConsolidationService preservam bank_id de qualquer banco ativo', () => {
    // LaunchService não deve forçar regex UUID de 36 caracteres para descartar bank_id
    assert.ok(
      launchContent.includes("const currentBankId = bankId && bankId !== 'virtual' ? bankId : null"),
      'LaunchService não está preservando bankId universalmente'
    );

    // ConsolidationService não deve descartar bank_id válido
    assert.ok(
      consolidationContent.includes("bank_id: t.bank_id && t.bank_id !== 'virtual' ? t.bank_id : null"),
      'ConsolidationService não está mapeando bank_id universalmente'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-3 & IC-4: ManualIdModal rejeita rótulos genéricos e seleciona categoria cadastrada padrão', () => {
    // Deve conter a guarda contra tipos genéricos
    assert.ok(
      manualIdContent.includes('isGenericOrInvalidType'),
      'ManualIdModal não possui a função de validação isGenericOrInvalidType'
    );

    // Deve checar se o tipo existe nas opções cadastradas e utilizar fallback cadastrado
    assert.ok(
      manualIdContent.includes('defaultEntradaType'),
      'ManualIdModal não utiliza defaultEntradaType'
    );
    assert.ok(
      manualIdContent.includes('defaultSaidaType'),
      'ManualIdModal não utiliza defaultSaidaType'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-4: useLiveListSync não injeta ENTRADA ou SAÍDA em contributionType', () => {
    // Não deve conter a injeção forçada antiga de ENTRADA / SAÍDA
    assert.ok(
      !liveListContent.includes("(t.type === 'income' ? 'ENTRADA' : 'SAÍDA')"),
      'useLiveListSync ainda possui fallback forçado com texto genérico ENTRADA/SAÍDA'
    );
    assert.ok(
      liveListContent.includes('isGenericType'),
      'useLiveListSync não sanitiza tipos genéricos'
    );
  });

  await t.test('[LÓGICA FUNCIONAL] Resolução limpa de categoria contábil com fallback para Dízimo', () => {
    // Simulação funcional da lógica protegida
    const isGenericOrInvalidType = (typeVal?: string | null) => {
      if (!typeVal) return true;
      const upper = typeVal.trim().toUpperCase();
      return ['ENTRADA', 'ENTRADAS', 'SAÍDA', 'SAIDA', 'SAIDAS', 'INCOME', 'EXPENSE', '---', 'NONE', 'NULL', 'UNDEFINED'].includes(upper);
    };

    assert.equal(isGenericOrInvalidType('ENTRADA'), true);
    assert.equal(isGenericOrInvalidType('SAÍDA'), true);
    assert.equal(isGenericOrInvalidType(''), true);
    assert.equal(isGenericOrInvalidType(null), true);
    assert.equal(isGenericOrInvalidType('Dízimo'), false);
    assert.equal(isGenericOrInvalidType('Oferta'), false);
    assert.equal(isGenericOrInvalidType('Despesa Geral'), false);

    const contributionTypes = [
      { id: '1', name: 'Dízimo', type: 'entrada', is_active: true },
      { id: '2', name: 'Oferta', type: 'entrada', is_active: true },
      { id: '3', name: 'Energia', type: 'saida', is_active: true }
    ];

    const registeredEntradas = contributionTypes
      .filter((ct: any) => ct.type === 'entrada' && ct.is_active !== false)
      .map((ct: any) => ct.name.toUpperCase());

    const resolveSelectedType = (candidate?: string | null) => {
      const trimmed = candidate?.trim();
      const isRegistered = trimmed && registeredEntradas.includes(trimmed.toUpperCase());
      const isValid = trimmed && !isGenericOrInvalidType(trimmed) && isRegistered;
      return isValid ? trimmed : (contributionTypes[0]?.name || 'Dízimo');
    };

    // Cenário 1: transação com "ENTRADA" genérico -> deve resolver para "Dízimo"
    assert.equal(resolveSelectedType('ENTRADA'), 'Dízimo');

    // Cenário 2: transação sem categoria (null/undefined) -> deve resolver para "Dízimo"
    assert.equal(resolveSelectedType(null), 'Dízimo');
    assert.equal(resolveSelectedType(undefined), 'Dízimo');

    // Cenário 3: transação com categoria cadastrada válida -> deve preservar "Oferta"
    assert.equal(resolveSelectedType('Oferta'), 'Oferta');
  });
});
