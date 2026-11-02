import test from 'node:test';
import assert from 'node:assert/strict';

// Polyfill leve de ambiente browser para execução de testes sob Node.js
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {};
}

test('Validação de Upload de PDFs e Legibilidade Contábil', async (t) => {
  const { 
    extractTextDirectFromPdfBytes, 
    extractTextFromPDF, 
    isDocumentTextLegible, 
    analyzeExpenseDocumentText 
  } = await import('../../utils/expenseDocumentParser');

  await t.test('extractTextDirectFromPdfBytes extrai texto de streams literais do PDF', async () => {
    // Simula estrutura mínima de um arquivo PDF contendo comandos literais de texto
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Length 120 >>
stream
BT
/F1 12 Tf
(COMPROVANTE DE PAGAMENTO PIX) Tj
(VALOR TOTAL: R$ 380,00) Tj
(FAVORECIDO: ELETRICA CENTRAL LTDA) Tj
(CNPJ: 12.345.678/0001-90) Tj
ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;
    const encoder = new TextEncoder();
    const pdfBuffer = encoder.encode(pdfContent).buffer;

    const extracted = await extractTextDirectFromPdfBytes(pdfBuffer);
    assert.ok(extracted.includes('COMPROVANTE DE PAGAMENTO PIX'), 'Não extraiu título');
    assert.ok(extracted.includes('VALOR TOTAL: R$ 380,00'), 'Não extraiu valor');
    assert.ok(extracted.includes('ELETRICA CENTRAL LTDA'), 'Não extraiu favorecido');

    // Verifica que o buffer não foi destruído/destacado
    assert.ok(pdfBuffer.byteLength > 0, 'ArrayBuffer foi destacado');
  });

  await t.test('Documento PDF com dados contábeis é considerado legível e estruturado', async () => {
    const docText = `
      COMPROVANTE DE PAGAMENTO ELETRONICO
      BANCO DO BRASIL
      DATA: 01/11/2026
      VALOR PAGO: R$ 450,00
      FAVORECIDO: MATERIAIS DE CONSTRUCAO BOA VISTA
      CNPJ: 98.765.432/0001-11
    `;
    const parsed = analyzeExpenseDocumentText(docText);
    assert.equal(parsed.extractedAmount, 450);
    assert.equal(isDocumentTextLegible(docText, parsed), true, 'Rejeitou PDF legítimo');
  });

  await t.test('Documento PDF ou recibo de prestação de serviços com vocabulário contábil autêntico é aceito', async () => {
    const serviceDocText = `
      DECLARACAO DE PRESTACAO DE SERVICOS E RECIBO
      Declaramos para os devidos fins contabeis da Igreja que foi realizado o servico de
      reforma hidraulica e pintura no templo filial. Pagamento efetuado via transferencia bancaria.
    `;
    const parsed = analyzeExpenseDocumentText(serviceDocText);
    assert.equal(isDocumentTextLegible(serviceDocText, parsed), true, 'Rejeitou declaração de serviço autêntica');
  });

  await t.test('PDFs vazios, arquivos corrompidos ou ruídos sem conteúdo continuam sendo estritamente rejeitados', async () => {
    // 1. Buffer vazio
    const emptyBuffer = new ArrayBuffer(0);
    const emptyText = await extractTextFromPDF(emptyBuffer);
    assert.equal(emptyText, '');
    assert.equal(isDocumentTextLegible(emptyText), false, 'Não rejeitou texto vazio de PDF');

    // 2. Ruído puro sem dados contábeis nem vocabulário contábil
    const noise = 'q w e r t y u i o p a s d f g h j k l z x c v b n m 1 2 3 4 5 6 7 8 9 0 . , - /';
    const parsedNoise = analyzeExpenseDocumentText(noise);
    assert.equal(isDocumentTextLegible(noise, parsedNoise), false, 'Não rejeitou ruído aleatório');
  });
});
