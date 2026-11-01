import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Polyfill leve de ambiente browser para execução de testes de parser sob Node.js
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {};
}

/**
 * 🛡️ TESTES DE REGRESSÃO ESPECÍFICOS: PB-003
 * 
 * RASTREABILIDADE TÉCNICA:
 * PB-003 → Validação Rigorosa de Legibilidade Contábil e Rejeição de Documentos Ilegíveis no Upload
 * 
 * INVARIANTES COMPORTAMENTAIS (Regras Funcionais Homologadas):
 *   - IC-1: Documentos ilegíveis (fotos borradas, ruído de câmera, texto vazio/curto sem dados contábeis) DEVEM ser rejeitados.
 *   - IC-2: O sistema emite aviso orientando o envio de documento nítido e limpa o campo de upload.
 *   - IC-3: Documentos autênticos com dados contábeis (valor, favorecido/emitente, CNPJ/CPF, PIX/código de barras, data) são aceitos.
 *   - IC-4: A validação é aplicada tanto em ManualIdModal quanto em ExpenseDocumentUploader.
 * 
 * GUARDAS ESTRUTURAIS / IMPLEMENTAÇÃO ATUAL (Substituíveis em refatorações futuras):
 *   - GE-1: Chamada a isDocumentTextLegible(rawText, extractedData) antes de criar anexo.
 *   - GE-2: Alerta com toast.warning informando documento ilegível e solicitando envio legível.
 *   - GE-3: Reset do input do arquivo (e.target.value = '') para permitir novo upload.
 *   - GE-4: imageOcrReader não injeta nome de arquivo sintético no fluxo de texto OCR.
 */
test('PB-003: Validação Rigorosa de Legibilidade Contábil e Rejeição de Documentos Ilegíveis', async (t) => {
  const manualIdModalPath = resolve(process.cwd(), 'components/modals/ManualIdModal.tsx');
  const expenseUploaderPath = resolve(process.cwd(), 'components/financial/ExpenseDocumentUploader.tsx');
  const parserPath = resolve(process.cwd(), 'utils/expenseDocumentParser.ts');
  const ocrReaderPath = resolve(process.cwd(), 'utils/imageOcrReader.ts');

  assert.ok(existsSync(manualIdModalPath), 'ManualIdModal.tsx não encontrado');
  assert.ok(existsSync(expenseUploaderPath), 'ExpenseDocumentUploader.tsx não encontrado');
  assert.ok(existsSync(parserPath), 'expenseDocumentParser.ts não encontrado');
  assert.ok(existsSync(ocrReaderPath), 'imageOcrReader.ts não encontrado');

  const manualIdContent = readFileSync(manualIdModalPath, 'utf-8');
  const expenseUploaderContent = readFileSync(expenseUploaderPath, 'utf-8');
  const ocrReaderContent = readFileSync(ocrReaderPath, 'utf-8');

  const { isDocumentTextLegible, analyzeExpenseDocumentText } = await import('../../utils/expenseDocumentParser');

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-1: Rejeição estrita de documentos vazios, borrados, ruidosos ou sem dados contábeis', () => {
    // 1. Strings vazias ou espaços
    assert.equal(isDocumentTextLegible(''), false, 'Não rejeitou string vazia');
    assert.equal(isDocumentTextLegible('   \n  \t  '), false, 'Não rejeitou espaços em branco');

    // 2. Ruído muito curto
    assert.equal(isDocumentTextLegible('abc 123'), false, 'Não rejeitou string muito curta');

    // 3. Ruído de símbolos sem alfanuméricos suficientes
    assert.equal(isDocumentTextLegible('==== ---- //// **** ++++ ....'), false, 'Não rejeitou caracteres de pontuação sem alfanuméricos');

    // 4. Captura de câmera desfocada / ruído aleatório de OCR sem nenhum dado contábil extraído
    const blurredCameraNoise = 'x k j . - | o 0 1 l a b c d e f g h i j k l m n o p q r s t u v w x y z ~ ^ ;';
    const parsedNoise = analyzeExpenseDocumentText(blurredCameraNoise);
    assert.equal(isDocumentTextLegible(blurredCameraNoise, parsedNoise), false, 'Não rejeitou ruído aleatório de captura de câmera');

    // 5. Nome de arquivo sintético sem conteúdo documental real
    const onlySyntheticFileName = 'ARQUIVO: WhatsApp Image 2026-10-29 at 20.17.55.jpeg';
    const parsedFileName = analyzeExpenseDocumentText(onlySyntheticFileName);
    assert.equal(isDocumentTextLegible(onlySyntheticFileName, parsedFileName), false, 'Não rejeitou texto contendo apenas nome sintético de arquivo');
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-2: Orientação clara ao usuário e bloqueio de criação de anexo ilegível', () => {
    // ManualIdModal deve emitir aviso e resetar input
    assert.ok(
      manualIdContent.includes('Documento ilegível: Não foi possível realizar a leitura do arquivo'),
      'ManualIdModal não possui aviso textual explícito de "Documento ilegível"'
    );
    assert.ok(
      manualIdContent.includes("showToast('Documento ilegível"),
      'ManualIdModal não notifica via showToast de aviso/erro'
    );

    // ExpenseDocumentUploader deve emitir aviso correspondente
    assert.ok(
      expenseUploaderContent.includes('Documento ilegível: Não foi possível realizar a leitura do arquivo'),
      'ExpenseDocumentUploader não possui aviso textual explícito de "Documento ilegível"'
    );
    assert.ok(
      expenseUploaderContent.includes("appContext?.showToast?.(errorMsg"),
      'ExpenseDocumentUploader não notifica via showToast'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-3: Aceitação de documentos autênticos e legíveis', () => {
    // 1. Cupom fiscal / DANFE com valor e dados de emitente
    const danfeText = `
      DANFE NOTA FISCAL ELETRONICA
      POSTO DE COMBUSTIVEIS ALVORADA LTDA
      CNPJ: 11.222.333/0001-44
      VALOR TOTAL: R$ 250,00
      DATA: 25/10/2026
    `;
    const danfeParsed = analyzeExpenseDocumentText(danfeText);
    assert.equal(isDocumentTextLegible(danfeText, danfeParsed), true, 'Rejeitou indevidamente DANFE legível');

    // 2. Recibo assinado com favorecido e valor
    const reciboText = `
      RECIBO DE PAGAMENTO
      Recebi da Igreja o valor de R$ 350,00 referente a serviços de manutenção predial.
      Data: 28/10/2026
    `;
    const reciboParsed = analyzeExpenseDocumentText(reciboText);
    assert.equal(isDocumentTextLegible(reciboText, reciboParsed), true, 'Rejeitou indevidamente Recibo legível');

    // 3. Boleto com código de barras ou linha digitável
    const boletoText = `
      BANCO DO BRASIL
      00190.00009 01234.567890 12345.678901 1 98760000015000
      PAGAR ATE O VENCIMENTO
      VALOR DO DOCUMENTO: 150,00
    `;
    const boletoParsed = analyzeExpenseDocumentText(boletoText);
    assert.equal(isDocumentTextLegible(boletoText, boletoParsed), true, 'Rejeitou indevidamente Boleto bancário legível');
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-4: Validação ativa em ambos os pontos de entrada de documentos', () => {
    // ManualIdModal
    assert.ok(
      manualIdContent.includes('if (!isDocumentTextLegible(rawText, extractedData)) {'),
      'ManualIdModal não executa a guarda de validação de legibilidade'
    );
    // ExpenseDocumentUploader
    assert.ok(
      expenseUploaderContent.includes('if (!isDocumentTextLegible(rawText, extractedData)) {'),
      'ExpenseDocumentUploader não executa a guarda de validação de legibilidade'
    );
  });

  await t.test('[GUARDA ESTRUTURAL] GE-1 a GE-4: Verificação das guardas técnicas em ManualIdModal, ExpenseDocumentUploader e imageOcrReader', () => {
    // GE-1 e GE-3: ManualIdModal e ExpenseDocumentUploader resetam input e interrompem processamento
    assert.ok(
      manualIdContent.includes('if (e.target) e.target.value = \'\''),
      'ManualIdModal não reseta e.target.value'
    );
    assert.ok(
      expenseUploaderContent.includes('if (fileInputRef.current) fileInputRef.current.value = \'\''),
      'ExpenseDocumentUploader não reseta fileInputRef.current'
    );

    // GE-4: imageOcrReader não injeta o prefixo sintético 'ARQUIVO: ' que induzia a falso positivo
    assert.ok(
      !ocrReaderContent.includes('rawText = `ARQUIVO: ${fileName}'),
      'imageOcrReader ainda possui injeção sintética de nome de arquivo que mascara imagens ilegíveis'
    );
  });
});
