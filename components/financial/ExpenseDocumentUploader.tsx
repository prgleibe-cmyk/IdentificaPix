import React, { useState, useRef } from 'react';
import { 
    FileText, 
    Upload, 
    Trash2, 
    Eye, 
    CheckCircle2, 
    AlertTriangle, 
    Plus,
    Receipt,
    CreditCard
} from 'lucide-react';
import { 
    ExpenseAttachment, 
    ExtractedExpenseDoc, 
    DocumentRole,
    extractTextFromPDF, 
    analyzeExpenseDocumentText, 
    validateExpenseAgainstDocument,
    inferDocumentRole,
    compressImageIfNeeded,
    isDocumentTextLegible
} from '../../utils/expenseDocumentParser';
import { processImageAndExtractText, renderPdfFirstPageToImage } from '../../utils/imageOcrReader';
import { formatCurrency } from '../../utils/formatters';
import { useUI } from '../../contexts/UIContext';

interface ExpenseDocumentUploaderProps {
    currentAmount?: number;
    launchAmount?: number;
    recipientName?: string;
    attachments: ExpenseAttachment[];
    onChangeAttachments: (newAttachments: ExpenseAttachment[]) => void;
    onApplyExtractedAmount?: (amount: number) => void;
    onApplyExtractedRecipient?: (recipient: string) => void;
    onDocumentDataExtracted?: (extracted: ExtractedExpenseDoc, attachment: ExpenseAttachment) => void;
    language?: any;
    readOnly?: boolean;
}

export const ExpenseDocumentUploader: React.FC<ExpenseDocumentUploaderProps> = ({
    currentAmount: propCurrentAmount,
    launchAmount,
    recipientName,
    attachments,
    onChangeAttachments,
    onApplyExtractedAmount,
    onApplyExtractedRecipient,
    onDocumentDataExtracted,
    language = 'pt',
    readOnly = false
}) => {
    const { showToast } = useUI();
    const rawCurrentAmount = propCurrentAmount ?? (launchAmount ?? 0);
    const currentAmount = Number.isFinite(Number(rawCurrentAmount)) ? Number(rawCurrentAmount) : 0;
    const [isParsing, setIsParsing] = useState(false);
    const [parsingStatusText, setParsingStatusText] = useState<string>('Processando e extraindo dados do arquivo...');
    const [ocrProgress, setOcrProgress] = useState<number | null>(null);
    const [previewAttachment, setPreviewAttachment] = useState<ExpenseAttachment | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (files: FileList | null, explicitRole?: DocumentRole) => {
        if (!files || files.length === 0 || readOnly) return;

        setIsParsing(true);
        setParsingStatusText('Processando e analisando documento...');
        setOcrProgress(null);

        const newAttachmentsList: ExpenseAttachment[] = [...attachments];
        let hasAddedValidAttachment = false;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            try {
                let rawText = '';
                let dataUrl = '';
                let finalSize = file.size;

                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    setParsingStatusText('Lendo texto digital do PDF...');
                    const arrayBuffer = await file.arrayBuffer();
                    rawText = await extractTextFromPDF(arrayBuffer);
                    
                    // Se o PDF não tiver camada de texto digital (escaneado ou fotocopiado), aciona OCR óptico
                    if (!rawText || rawText.trim().length < 20) {
                        setParsingStatusText('PDF escaneado detectado: renderizando página para leitura óptica (OCR)...');
                        const pdfPageImage = await renderPdfFirstPageToImage(arrayBuffer);
                        if (pdfPageImage) {
                            setParsingStatusText('Executando OCR e detecção de código de barras no PDF escaneado...');
                            rawText = await processImageAndExtractText(pdfPageImage, file.name, (p) => setOcrProgress(p));
                        }
                    }

                    const reader = new FileReader();
                    const dataUrlPromise = new Promise<string>((resolve) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () => resolve('');
                        reader.readAsDataURL(file);
                    });
                    dataUrl = await dataUrlPromise;
                } else if (file.type.startsWith('image/')) {
                    setParsingStatusText('Otimizando foto e executando leitura óptica (OCR)...');
                    // Comprime fotos pesadas de celulares modernos mantendo nitidez para o OCR
                    const compressed = await compressImageIfNeeded(file);
                    dataUrl = compressed.dataUrl;
                    finalSize = compressed.size;
                    
                    // Extração inteligente: Barcode/QR Code instantâneo + Tesseract OCR no cliente
                    rawText = await processImageAndExtractText(dataUrl, file.name, (p) => setOcrProgress(p));
                } else if (file.type === 'text/xml' || file.type === 'application/xml' || file.name.toLowerCase().endsWith('.xml')) {
                    setParsingStatusText('Lendo dados estruturados da Nota Fiscal XML...');
                    try {
                        rawText = await file.text();
                    } catch (_) {
                        rawText = '';
                    }
                    const reader = new FileReader();
                    const dataUrlPromise = new Promise<string>((resolve) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () => resolve('');
                        reader.readAsDataURL(file);
                    });
                    dataUrl = await dataUrlPromise;
                } else {
                    const reader = new FileReader();
                    const dataUrlPromise = new Promise<string>((resolve) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () => resolve('');
                        reader.readAsDataURL(file);
                    });
                    dataUrl = await dataUrlPromise;
                }

                const extractedData: ExtractedExpenseDoc = analyzeExpenseDocumentText(rawText);

                if (!isDocumentTextLegible(rawText, extractedData)) {
                    const errorMsg = 'Documento ilegível: Não foi possível realizar a leitura do arquivo. Por favor, envie uma foto ou PDF nítido e legível.';
                    showToast(errorMsg, 'error');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    continue;
                }

                const validation = validateExpenseAgainstDocument(currentAmount, extractedData);
                const autoRole = inferDocumentRole(extractedData.documentType, file.name);

                // O documento é identificado pelo tipo informado ou inferido automaticamente
                const assignedRole: DocumentRole = explicitRole || (autoRole === 'outro' ? 'comprovante' : autoRole);

                const newAttachment: ExpenseAttachment = {
                    id: fileId,
                    fileName: file.name,
                    fileSize: finalSize,
                    fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : file.name.endsWith('.xml') ? 'application/xml' : 'application/octet-stream'),
                    uploadedAt: new Date().toISOString(),
                    dataUrl,
                    extractedData,
                    validationStatus: validation.status,
                    validationNotes: validation.message,
                    documentRole: assignedRole
                };

                newAttachmentsList.push(newAttachment);
                hasAddedValidAttachment = true;

                if (onDocumentDataExtracted) {
                    onDocumentDataExtracted(extractedData, newAttachment);
                }
            } catch (err) {
                console.error('Erro ao processar anexo:', err);
            }
        }

        if (hasAddedValidAttachment) {
            onChangeAttachments(newAttachmentsList);
        }
        setIsParsing(false);
        setOcrProgress(null);
        setParsingStatusText('Processando e extraindo dados do arquivo...');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveAttachment = (id: string) => {
        if (readOnly) return;
        const updated = attachments.filter(a => a.id !== id);
        onChangeAttachments(updated);
    };

    const handleRoleChange = (id: string, newRole: DocumentRole) => {
        if (readOnly) return;
        const updated = attachments.map(a => a.id === id ? { ...a, documentRole: newRole } : a);
        onChangeAttachments(updated);
    };

    const safeAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : [];

    return (
        <div
            className="space-y-2"
            onDragOver={(e) => {
                if (readOnly || safeAttachments.length === 0) return;
                e.preventDefault();
                e.stopPropagation();
                if (!isDragging) setIsDragging(true);
            }}
            onDragLeave={(e) => {
                if (readOnly || safeAttachments.length === 0) return;
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
            }}
            onDrop={(e) => {
                if (readOnly || safeAttachments.length === 0) return;
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                handleFileUpload(e.dataTransfer.files);
            }}
        >
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Comprovantes e Documentos</span>
                    </label>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        (opcional)
                    </span>
                </div>

                {!readOnly && safeAttachments.length > 0 && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 hover:border-orange-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Anexar outro</span>
                    </button>
                )}
            </div>

            {/* Input nativo oculto para acionamento do seletor de arquivos */}
            <input 
                ref={fileInputRef}
                type="file" 
                accept=".pdf,image/png,image/jpeg,image/jpg,.xml,text/xml,application/xml" 
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
            />

            {/* Dropzone Única Limpa e Padrão (exibida quando ainda não há anexos) */}
            {!readOnly && safeAttachments.length === 0 && (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fileInputRef.current?.click();
                        }
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isDragging) setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(false);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(false);
                        handleFileUpload(e.dataTransfer.files);
                    }}
                    className={`group rounded-xl border border-dashed px-3.5 py-2.5 transition-all cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        isDragging
                            ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/25'
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/35 hover:border-orange-400 dark:hover:border-orange-500/70 hover:bg-orange-50/25 dark:hover:bg-orange-950/15'
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                            isDragging
                                ? 'bg-orange-600 border-orange-600 text-white'
                                : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-700 text-slate-500 dark:text-slate-400 group-hover:text-orange-600 group-hover:border-orange-200 dark:group-hover:border-orange-800'
                        }`}>
                            <Upload className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                                Clique ou arraste NF, Boleto ou Comprovante
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                Aceita PDF, XML ou imagem (identificação automática do documento)
                            </span>
                        </div>
                    </div>

                    <span className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 group-hover:border-orange-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 shadow-2xs transition-colors shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Selecionar arquivo</span>
                    </span>
                </div>
            )}

            {/* Banner de Leitura Óptica e OCR em Execução */}
            {isParsing && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin shrink-0" />
                        <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 block truncate">
                                {parsingStatusText}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                                {ocrProgress !== null && ocrProgress > 0 
                                    ? `Leitura do arquivo: ${ocrProgress}% concluído...` 
                                    : 'Identificando favorecido, valor e data...'}
                            </span>
                        </div>
                    </div>
                    <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 border border-orange-200/80 dark:border-orange-800/50 px-2 py-0.5 rounded-md shrink-0">
                        Processando
                    </span>
                </div>
            )}

            {/* Lista Compacta de Anexos (1 linha limpa por documento) */}
            {safeAttachments.length > 0 && (
                <div className={`space-y-1.5 rounded-xl transition-colors ${isDragging ? 'ring-2 ring-orange-400/70' : ''}`}>
                    {safeAttachments.map((att, attIdx) => {
                        const validation = validateExpenseAgainstDocument(currentAmount, att.extractedData);
                        const doc = att.extractedData;
                        const currentRole = att.documentRole || inferDocumentRole(doc?.documentType || 'outro', att.fileName || '');
                        const numericExtractedAmount =
                            doc?.extractedAmount !== null &&
                            doc?.extractedAmount !== undefined &&
                            doc?.extractedAmount !== ('' as any) &&
                            Number.isFinite(Number(doc.extractedAmount))
                                ? Number(doc.extractedAmount)
                                : null;

                        return (
                            <div
                                key={att.id || `att-${attIdx}`}
                                className={`px-3 py-2 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                    validation.status === 'divergent'
                                        ? 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40'
                                        : 'bg-white dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-700/80'
                                }`}
                            >
                                {/* Esquerda / Linha 1 (mobile): ícone + nome + tamanho */}
                                <div className="flex items-center gap-2 min-w-0 flex-1 w-full sm:w-auto">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                        validation.status === 'divergent'
                                            ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        {currentRole === 'nota_fiscal' ? (
                                            <Receipt className="w-3.5 h-3.5" />
                                        ) : currentRole === 'fatura' ? (
                                            <FileText className="w-3.5 h-3.5" />
                                        ) : currentRole === 'comprovante' || currentRole === 'recibo' ? (
                                            <CreditCard className="w-3.5 h-3.5" />
                                        ) : (
                                            <FileText className="w-3.5 h-3.5" />
                                        )}
                                    </div>

                                    <span
                                        className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate min-w-0 flex-1 sm:flex-initial"
                                        title={att.fileName || 'Documento anexo'}
                                    >
                                        {att.fileName || 'Documento anexo'}
                                    </span>

                                    {typeof att.fileSize === 'number' && !isNaN(att.fileSize) && (
                                        <span className="text-[11px] text-slate-400 font-mono shrink-0">
                                            {(att.fileSize / 1024).toFixed(0)} KB
                                        </span>
                                    )}
                                </div>

                                {/* Direita / Linha 2 (mobile): tipo + status conciso + ações */}
                                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 flex-wrap">
                                    {!readOnly ? (
                                        <select
                                            value={currentRole}
                                            onChange={(e) => handleRoleChange(att.id, e.target.value as DocumentRole)}
                                            aria-label="Tipo do documento"
                                            className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-md px-1.5 py-0.5 cursor-pointer outline-none focus:border-orange-400 shrink-0"
                                        >
                                            <option value="nota_fiscal">Nota Fiscal</option>
                                            <option value="fatura">Boleto / Fatura</option>
                                            <option value="comprovante">Comprovante</option>
                                            <option value="recibo">Recibo</option>
                                            <option value="outro">Outro</option>
                                        </select>
                                    ) : (
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md shrink-0">
                                            {currentRole === 'nota_fiscal'
                                                ? 'Nota Fiscal'
                                                : currentRole === 'fatura'
                                                ? 'Boleto / Fatura'
                                                : currentRole === 'comprovante'
                                                ? 'Comprovante'
                                                : currentRole === 'recibo'
                                                ? 'Recibo'
                                                : 'Outro'}
                                        </span>
                                    )}

                                    <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                                        {validation.status === 'validated' && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap mr-0.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                <span>Valor confere</span>
                                            </span>
                                        )}

                                        {validation.status === 'divergent' && (
                                            <span
                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap mr-0.5"
                                                title={`Lançamento R$ ${currentAmount.toFixed(2)} vs Documento R$ ${(numericExtractedAmount ?? 0).toFixed(2)}`}
                                            >
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                <span>Doc: {formatCurrency(numericExtractedAmount ?? 0, language)}</span>
                                            </span>
                                        )}

                                        {(validation.status === 'divergent' || currentAmount === 0 || !currentAmount) &&
                                            numericExtractedAmount !== null &&
                                            numericExtractedAmount > 0 &&
                                            onApplyExtractedAmount && (
                                                <button
                                                    type="button"
                                                    onClick={() => onApplyExtractedAmount(numericExtractedAmount)}
                                                    className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                                                >
                                                    {currentAmount === 0 || !currentAmount
                                                        ? `Aplicar ${formatCurrency(numericExtractedAmount, language)}`
                                                        : 'Ajustar'}
                                                </button>
                                            )}

                                        {doc?.extractedRecipient &&
                                            onApplyExtractedRecipient &&
                                            (!recipientName ||
                                                recipientName.trim().toUpperCase() !== doc.extractedRecipient.trim().toUpperCase()) && (
                                                <button
                                                    type="button"
                                                    onClick={() => onApplyExtractedRecipient(doc.extractedRecipient!)}
                                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                                                >
                                                    Copiar favorecido
                                                </button>
                                            )}

                                        {att.dataUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setPreviewAttachment(att)}
                                                className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                title="Visualizar documento"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAttachment(att.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                                title="Remover anexo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Preview do Documento */}
            {previewAttachment && (
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-orange-500" />
                                <span className="font-bold text-sm text-slate-800 dark:text-white truncate max-w-md">
                                    {previewAttachment.fileName}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewAttachment(null)}
                                className="px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                        
                        <div className="flex-1 p-4 overflow-auto bg-slate-100 dark:bg-black/50 flex items-center justify-center min-h-[400px]">
                            {previewAttachment.fileType === 'application/pdf' || (previewAttachment.fileName || '').toLowerCase().endsWith('.pdf') ? (
                                <iframe 
                                    src={previewAttachment.dataUrl} 
                                    className="w-full h-[600px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white" 
                                    title="Visualização do PDF"
                                />
                            ) : (previewAttachment.fileName || '').toLowerCase().endsWith('.xml') || (previewAttachment.fileType || '').includes('xml') ? (
                                <div className="w-full h-[600px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 overflow-auto text-left space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                                        <div>
                                            <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">
                                                {previewAttachment.extractedData?.documentTypeLabel || 'Nota Fiscal Eletrônica (XML)'}
                                            </h4>
                                            <p className="text-xs text-slate-500">Documento estruturado padrão SEFAZ / Nacional</p>
                                        </div>
                                        {previewAttachment.dataUrl && (
                                            <a
                                                href={previewAttachment.dataUrl}
                                                download={previewAttachment.fileName}
                                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                                            >
                                                Baixar XML
                                            </a>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Fornecedor / Emitente</span>
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block truncate">
                                                {previewAttachment.extractedData?.extractedRecipient || 'Não informado'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">CNPJ / CPF</span>
                                            <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100 block">
                                                {previewAttachment.extractedData?.extractedRecipientCnpjCpf || 'Não informado'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Valor Total</span>
                                            <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 block">
                                                {previewAttachment.extractedData?.extractedAmount !== null && previewAttachment.extractedData?.extractedAmount !== undefined
                                                    ? formatCurrency(previewAttachment.extractedData.extractedAmount, language)
                                                    : 'R$ 0,00'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Número da Nota</span>
                                            <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100 block">
                                                {previewAttachment.extractedData?.documentNumber || 'Não informado'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Data de Emissão</span>
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block">
                                                {typeof previewAttachment.extractedData?.extractedDate === 'string' && previewAttachment.extractedData.extractedDate
                                                    ? previewAttachment.extractedData.extractedDate.split('-').reverse().join('/')
                                                    : 'Não informada'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Data de Vencimento</span>
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block">
                                                {typeof previewAttachment.extractedData?.extractedDueDate === 'string' && previewAttachment.extractedData.extractedDueDate
                                                    ? previewAttachment.extractedData.extractedDueDate.split('-').reverse().join('/')
                                                    : 'À vista / Sem duplicata'}
                                            </span>
                                        </div>
                                    </div>

                                    {previewAttachment.extractedData?.accessKey && (
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Chave de Acesso (44 dígitos)</span>
                                            <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all select-all block">
                                                {previewAttachment.extractedData.accessKey}
                                            </span>
                                        </div>
                                    )}

                                    {/* Tabela de Produtos / Itens da NF */}
                                    {previewAttachment.extractedData?.items && previewAttachment.extractedData.items.length > 0 && (
                                        <div className="space-y-2 pt-2">
                                            <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 block">
                                                Itens / Produtos da Nota ({previewAttachment.extractedData.items.length})
                                            </span>
                                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500">
                                                        <tr>
                                                            <th className="p-2.5">Descrição do Item</th>
                                                            <th className="p-2.5 text-right w-20">Qtd</th>
                                                            <th className="p-2.5 text-right w-28">Vlr. Unitário</th>
                                                            <th className="p-2.5 text-right w-28">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {previewAttachment.extractedData.items.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                                <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                                                                <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{item.quantity ?? '-'}</td>
                                                                <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                    {item.unitPrice !== undefined ? formatCurrency(item.unitPrice, language) : '-'}
                                                                </td>
                                                                <td className="p-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                                                    {item.totalPrice !== undefined ? formatCurrency(item.totalPrice, language) : '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <img 
                                    src={previewAttachment.dataUrl} 
                                    alt="Comprovante" 
                                    className="max-w-full max-h-[600px] object-contain rounded-xl shadow-md"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
