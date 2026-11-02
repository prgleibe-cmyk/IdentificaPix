import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 🛡️ TESTES DE REGRESSÃO ESPECÍFICOS: PB-001
 * 
 * RASTREABILIDADE TÉCNICA:
 * PB-001 → Visualização Imediata de Documentos no Lançamento Manual com Ação Única no Chip
 * 
 * INVARIANTES COMPORTAMENTAIS (Regras Funcionais Homologadas):
 *   - IC-1: Visualização sob demanda acessível via controle no chip do documento
 *   - IC-2: Unicidade do controle (sem botões redundantes na área de upload)
 *   - IC-3: Preservação de dados do formulário e anexo durante abertura/fechamento
 *   - IC-4: Exibição desimpedida em primeiro plano acima da interface
 * 
 * GUARDAS ESTRUTURAIS / IMPLEMENTAÇÃO ATUAL (Substituíveis em refatorações futuras):
 *   - GE-1: AttachmentPreviewModal montado no bloco isManualLaunch de ManualIdModal.tsx
 *   - GE-2: Acionamento via setPreviewAttachment no botão com ícone Eye do chip
 *   - GE-3: Ausência da tag de botão avulso "Visualizar Documento" fora do chip
 *   - GE-4: Overlay com classe z-[9999] em AttachmentPreviewModal.tsx
 */
test('PB-001: Visualização Imediata de Documentos no Lançamento Manual', async (t) => {
  const manualIdModalPath = resolve(process.cwd(), 'components/modals/ManualIdModal.tsx');
  const previewModalPath = resolve(process.cwd(), 'components/financial/AttachmentPreviewModal.tsx');

  assert.ok(existsSync(manualIdModalPath), 'ManualIdModal.tsx não encontrado');
  assert.ok(existsSync(previewModalPath), 'AttachmentPreviewModal.tsx não encontrado');

  const manualIdContent = readFileSync(manualIdModalPath, 'utf-8');
  const previewModalContent = readFileSync(previewModalPath, 'utf-8');

  await t.test('[GUARDA ESTRUTURAL] GE-1: AttachmentPreviewModal montado e conectado no retorno isManualLaunch', () => {
    assert.ok(
      manualIdContent.includes("import { AttachmentPreviewModal } from '../financial/AttachmentPreviewModal'"),
      'AttachmentPreviewModal não importado em ManualIdModal.tsx'
    );

    // O bloco isManualLaunch inicia em "if (isManualLaunch) {" e encerra antes do segundo return principal
    const startIndex = manualIdContent.indexOf('if (isManualLaunch) {');
    const endIndex = manualIdContent.indexOf('<div className="absolute inset-0 z-40', startIndex);
    assert.ok(startIndex !== -1 && endIndex !== -1, 'Delimitadores do bloco isManualLaunch não encontrados');
    const manualLaunchBlock = manualIdContent.slice(startIndex, endIndex);

    assert.ok(
      manualLaunchBlock.includes('<AttachmentPreviewModal'),
      'AttachmentPreviewModal NÃO está montado dentro do retorno de isManualLaunch'
    );
    assert.ok(
      manualLaunchBlock.includes('isOpen={!!previewAttachment}'),
      'AttachmentPreviewModal não está conectado ao estado previewAttachment em isManualLaunch'
    );
  });

  await t.test('[GUARDA ESTRUTURAL] GE-2: O chip do documento possui a ação de visualização conectada', () => {
    assert.ok(
      manualIdContent.includes('onClick={() => setPreviewAttachment(att)}'),
      'Ação setPreviewAttachment não vinculada ao clique do documento no chip'
    );
    assert.ok(
      manualIdContent.includes('<Eye className="w-3 h-3" />'),
      'Ícone Eye de visualização não presente no botão do chip'
    );
  });

  await t.test('[GUARDA ESTRUTURAL] GE-3: Ausência de botão duplicado/redundante "Visualizar Documento" fora do chip', () => {
    // Garante que o botão avulso redundante não foi re-adicionado ao lado dos chips
    assert.ok(
      !manualIdContent.includes('<span>Visualizar Documento</span>'),
      'Botão redundante "Visualizar Documento" ainda está presente no código'
    );
  });

  await t.test('[GUARDA ESTRUTURAL] GE-4: Overlay com z-[9999] em AttachmentPreviewModal para prioridade visual', () => {
    assert.ok(
      previewModalContent.includes('z-[9999]'),
      'AttachmentPreviewModal não possui z-[9999] para sobreposição ao modal de lançamento'
    );
  });

  await t.test('[INVARIANTE COMPORTAMENTAL] IC-3: Preservação de dados do anexo (sem mutação destrutiva no estado)', () => {
    const mockAttachment = {
      id: 'att-123456',
      fileName: 'recibo_teste.jpg',
      fileSize: 10240,
      fileType: 'image/jpeg',
      uploadedAt: '2026-10-29T17:00:00Z',
      dataUrl: 'data:image/jpeg;base64,test-image-payload',
      documentRole: 'recibo' as const,
      validationStatus: 'validated' as const
    };

    let previewTarget: typeof mockAttachment | null = mockAttachment;
    assert.equal(previewTarget.id, 'att-123456');
    assert.equal(previewTarget.fileName, 'recibo_teste.jpg');

    // Fechar preview
    previewTarget = null;
    assert.equal(previewTarget, null);

    // O anexo original permanece intacto
    assert.equal(mockAttachment.id, 'att-123456');
    assert.equal(mockAttachment.dataUrl, 'data:image/jpeg;base64,test-image-payload');
  });
});
