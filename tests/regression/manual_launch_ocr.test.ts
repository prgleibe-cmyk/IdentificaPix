import test from 'node:test';
import assert from 'node:assert/strict';

// Polyfill leve de ambiente browser para execução de testes sob Node.js
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {};
}

test('Regressão Cirúrgica: Extração e Resiliência de Documentos de Despesa', async (t) => {
  const { extractAmountsFromText, extractRecipientFromText, extractDateFromText } = await import('../../utils/expenseDocumentParser');

  await t.test('Deve extrair o Valor Total da Nota Fiscal com prioridade sobre impostos/ICMS', () => {
    const danfeText = `
DANFE - DOCUMENTO AUXILIAR
BASE DE CALCULO ICMS: 120,00
VALOR DO ICMS: 0,00
VALOR DO FRETE: 15,00
VALOR TOTAL DA NOTA: 345,60
    `;
    const result = extractAmountsFromText(danfeText);
    assert.equal(result.primaryAmount, 345.60, 'Não capturou o VALOR TOTAL DA NOTA');
  });

  await t.test('Deve rejeitar caixas técnicas de DANFE (0-ENTRADA 1-SAIDA, SERIE) e capturar razão social do emitente', () => {
    const danfeHeader = `
DANFE
DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA
0 - ENTRADA 1 - SAIDA 1
N. 000.012.345
SERIE 1
SUPERMERCADO ESTRELA DA MANHA LTDA
AVENIDA BRASIL, 1234 - CENTRO
CNPJ: 12.345.678/0001-90
DESTINATARIO / REMETENTE
NOME: IGREJA BATISTA
    `;
    const recipient = extractRecipientFromText(danfeHeader);
    assert.equal(recipient, 'SUPERMERCADO ESTRELA DA MANHA LTDA', 'Capturou cabeçalho técnico em vez da razão social');
  });

  await t.test('Deve rejeitar datas corrompidas ou inválidas como 2024-00-00', () => {
    const textWithInvalidDate = 'CNPJ: 12.345.678/0001-90 DATA 00/00/2024';
    const parsedDate = extractDateFromText(textWithInvalidDate);
    assert.equal(parsedDate, null, 'Aceitou data inválida 00/00/2024');
  });

  await t.test('Deve aceitar e formatar corretamente datas válidas brasileiras', () => {
    const textWithValidDate = 'DATA DE EMISSAO: 28/10/2026';
    const parsedDate = extractDateFromText(textWithValidDate);
    assert.equal(parsedDate, '2026-10-28', 'Não formatou data válida');
  });

  await t.test('Deve rejeitar documento ilegível (texto em branco, vazio ou borrado)', async () => {
    const { isDocumentTextLegible } = await import('../../utils/expenseDocumentParser');
    assert.equal(isDocumentTextLegible(''), false, 'Não rejeitou string vazia');
    assert.equal(isDocumentTextLegible('   \n  \t  '), false, 'Não rejeitou espaços em branco');
    assert.equal(isDocumentTextLegible('ab .'), false, 'Não rejeitou ruído menor que 15 caracteres');
  });

  await t.test('Deve aceitar documentos nítidos e legíveis', async () => {
    const { isDocumentTextLegible, analyzeExpenseDocumentText } = await import('../../utils/expenseDocumentParser');
    const validDanfe = `
DANFE NOTA FISCAL ELETRONICA
POSTO DE COMBUSTIVEIS ALVORADA LTDA
CNPJ: 11.222.333/0001-44
VALOR TOTAL: R$ 250,00
DATA: 25/10/2026
    `;
    const extracted = analyzeExpenseDocumentText(validDanfe);
    assert.equal(isDocumentTextLegible(validDanfe, extracted), true, 'Rejeitou indevidamente documento legível');
  });
});
