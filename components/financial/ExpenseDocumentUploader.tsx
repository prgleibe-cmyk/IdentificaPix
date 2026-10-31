import React, { useState, useRef, useContext } from 'react';
import { 
    FileText, 
    Upload, 
    Trash2, 
    Eye, 
    CheckCircle2, 
    AlertTriangle, 
    HelpCircle, 
    Sparkles, 
    Clock, 
    ShieldCheck, 
    FileCheck,
    Receipt,
    CreditCard,
    Check,
    Lock,
    Plus,
    X,
    Camera,
    Loader2
} from 'lucide-react';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { 
    ExpenseAttachment, 
    ExtractedExpenseDoc, 
    DocumentRole,
    extractTextFromPDF, 
    analyzeExpenseDocumentText, 
    validateExpenseAgainstDocument,
    inferDocumentRole,
    compressImageIfNeeded,
    ExpenseValidationStatus,
    isDocumentTextLegible
} from '../../utils/expenseDocumentParser';
import { processImageAndExtractText, renderPdfFirstPageToImage } from '../../utils/imageOcrReader';
import { formatCurrency } from '../../utils/formatters';
import { AppContext } from '../../contexts/AppContext';

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
    const appContext = useContext(AppContext);
    const currentAmount = propCurrentAmount ?? (launchAmount ?? 0);
    const [isParsing, setIsParsing] = useState(false);
    const [parsingStatusText, setParsingStatusText] = useState<string>('Processando e extraindo dados do arquivo...');
    const [ocrProgress, setOcrProgress] = useState<number | null>(null);
    const [previewAttachment, setPreviewAttachment] = useState<ExpenseAttachment | null>(null);
    const [selectedRole, setSelectedRole] = useState<DocumentRole | null>(null);
    const [selectedDocType, setSelectedDocType] = useState<string>('Boleto');
    const [selectionAlert, setSelectionAlert] = useState<string | null>(null);
    const alertTimeoutRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const docTypeRoleMap: Record<string, DocumentRole> = {
        'Boleto': 'fatura',
        'Nota Fiscal': 'nota_fiscal',
        'Recibo': 'recibo',
        'Outro': 'outro'
    };

    const triggerSelectionAlert = () => {
        setSelectionAlert('Selecione primeiro uma das opções acima (Nota Fiscal, Boleto/Fatura ou Comprovante) para liberar o carregamento do arquivo.');
        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = setTimeout(() => {
            setSelectionAlert(null);
        }, 5000);
    };

    const triggerUploadForRole = (role: DocumentRole) => {
        if (readOnly) return;
        setSelectedRole(role);
        setSelectionAlert(null);
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 50);
    };

    const handleFileUpload = async (files: FileList | null, explicitRole?: DocumentRole) => {
        if (!files || files.length === 0 || readOnly) return;

        if (explicitRole) {
            setSelectedRole(explicitRole);
        }

        setIsParsing(true);
        setSelectionAlert(null);
        setParsingStatusText('Processando e analisando documento...');
        setOcrProgress(null);

        const newAttachmentsList: ExpenseAttachment[] = [...attachments];

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

                // 🛡️ Validação de legibilidade obrigatória para TODOS os documentos: se não estiver legível, rejeita upload
                if (!isDocumentTextLegible(rawText, extractedData)) {
                    const errorMsg = `Documento ilegível: Não foi possível realizar a leitura do arquivo "${file.name}" para extração segura e correta dos dados. Para garantir a validade contábil, envie uma foto ou PDF nítido e legível.`;
                    setSelectionAlert(errorMsg);
                    appContext?.showToast?.(errorMsg, 'error');
                    continue;
                }

                const validation = validateExpenseAgainstDocument(currentAmount, extractedData);
                const autoRole = inferDocumentRole(extractedData.documentType, file.name);

                // O documento é identificado pelo tipo selecionado ou inferido automaticamente!
                const mappedRole = docTypeRoleMap[selectedDocType] || (selectedDocType === 'Boleto' ? 'fatura' : 'recibo');
                const assignedRole: DocumentRole = explicitRole || selectedRole || mappedRole || (autoRole === 'outro' ? 'comprovante' : autoRole);
                if (!selectedRole && assignedRole) {
                    setSelectedRole(assignedRole);
                }

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

                // 🛡️ Preenche campos automaticamente apenas a partir do primeiro documento carregado
                if (onDocumentDataExtracted && attachments.length === 0 && i === 0) {
                    onDocumentDataExtracted(extractedData, newAttachment);
                }
            } catch (err) {
                console.error('Erro ao processar anexo:', err);
            }
        }

        onChangeAttachments(newAttachmentsList);
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

    // Classificação dos documentos carregados para status de auditoria
    const nfDocs = attachments.filter(a => 
        a.documentRole === 'nota_fiscal' || 
        (!a.documentRole && a.extractedData?.documentType === 'nota_fiscal')
    );
    const invoiceDocs = attachments.filter(a => 
        a.documentRole === 'fatura' || 
        (!a.documentRole && (a.extractedData?.documentType === 'fatura' || a.extractedData?.documentType === 'boleto'))
    );
    const proofDocs = attachments.filter(a => 
        a.documentRole === 'comprovante' || 
        (!a.documentRole && (a.extractedData?.documentType === 'comprovante_pix' || a.extractedData?.documentType === 'comprovante_pagamento' || a.extractedData?.documentType === 'recibo'))
    );

    const hasNf = nfDocs.length > 0;
    const hasInvoice = invoiceDocs.length > 0;
    const hasProof = proofDocs.length > 0;

    // Validação global principal
    const primaryAttachment = attachments[0] || null;
    const currentValidation = primaryAttachment 
        ? validateExpenseAgainstDocument(currentAmount, primaryAttachment.extractedData)
        : { status: 'pending_attachment' as ExpenseValidationStatus, message: 'Nenhum documento anexado.', diff: 0 };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-orange-500" />
                    Documentação da Despesa (NF, Boleto e Comprovante)
                </label>
                
                {/* Semáforo de Validação */}
                <div className="flex items-center gap-1.5">
                    {currentValidation.status === 'validated' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 animate-fade-in">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Validado com Documento
                        </span>
                    )}
                    {currentValidation.status === 'divergent' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 animate-fade-in">
                            <AlertTriangle className="w-3 h-3 text-rose-500 animate-pulse" />
                            Divergência de Valor
                        </span>
                    )}
                    {currentValidation.status === 'manual_review' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 animate-fade-in">
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                            Verificação Manual
                        </span>
                    )}
                    {currentValidation.status === 'pending_attachment' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 animate-fade-in">
                            <Clock className="w-3 h-3 text-amber-500" />
                            Pendente de Anexo
                        </span>
                    )}
                </div>
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

            {/* Botão Único para Upload ou Tirar Foto com Seleção do Documento (Boleto, Nota Fiscal, Recibo) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 py-1 px-0.5 animate-fade-in">
                <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 p-1 shadow-xs hover:border-orange-400 dark:hover:border-orange-500/80 transition-all">
                    {/* Opção integrada para selecionar o nome do documento se o usuário quiser */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Documento:
                        </span>
                        <select
                            value={selectedDocType}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedDocType(val);
                                const mapped = docTypeRoleMap[val];
                                if (mapped) setSelectedRole(mapped);
                            }}
                            disabled={readOnly || isParsing}
                            className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1"
                            title="Selecione o tipo do documento (opcional)"
                        >
                            <option value="Boleto" className="text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800">Boleto / Fatura</option>
                            <option value="Nota Fiscal" className="text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800">Nota Fiscal</option>
                            <option value="Recibo" className="text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800">Comprovante</option>
                            <option value="Outro" className="text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800">Outro</option>
                        </select>
                    </div>

                    <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

                    {/* O Único Botão de Upload ou Foto */}
                    <button
                        type="button"
                        onClick={() => {
                            if (readOnly) return;
                            fileInputRef.current?.click();
                        }}
                        disabled={readOnly || isParsing}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-95 shadow-xs cursor-pointer transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Clique para anexar arquivo ou tirar foto com a câmera"
                    >
                        {isParsing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Camera className="w-3.5 h-3.5" />
                        )}
                        <span>{isParsing ? (parsingStatusText || 'Lendo documento...') : 'Upload / Foto'}</span>
                    </button>
                </div>

                {/* Chips dos documentos anexados com visual enxuto e opção de visualização */}
                {attachments && attachments.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {attachments.map((att, idx) => {
                            const docLabel = att.documentRole === 'nota_fiscal' 
                                ? 'Nota Fiscal' 
                                : att.documentRole === 'fatura' 
                                    ? 'Boleto / Fatura' 
                                    : (att.documentRole === 'recibo' || att.documentRole === 'comprovante')
                                        ? 'Comprovante' 
                                        : 'Doc';
                            return (
                                <div
                                    key={att.id || idx}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 text-xs font-bold text-orange-800 dark:text-orange-200 shadow-2xs animate-fade-in"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span className="truncate max-w-[170px] font-semibold" title={att.fileName}>
                                        {docLabel}: {att.fileName}
                                    </span>
                                    {att.dataUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setPreviewAttachment(att)}
                                            className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-orange-700 dark:text-orange-300 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/60 dark:hover:bg-orange-800/60 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                                            title="Visualizar documento carregado"
                                        >
                                            <Eye className="w-3 h-3" />
                                            <span>Ver</span>
                                        </button>
                                    )}
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAttachment(att.id)}
                                            className="text-orange-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors ml-0.5"
                                            title="Remover documento"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Banner de Leitura Óptica e OCR em Execução (Sem poluir a tela) */}
            {isParsing && (
                <div className="p-3 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-orange-950/40 border border-orange-200 dark:border-orange-800/60 rounded-xl flex items-center justify-between gap-3 animate-fade-in shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin shrink-0" />
                        <div className="min-w-0">
                            <span className="text-xs font-bold text-orange-950 dark:text-orange-200 block truncate">
                                {parsingStatusText}
                            </span>
                            <span className="text-[10px] text-orange-700 dark:text-orange-400 font-medium block truncate">
                                {ocrProgress !== null && ocrProgress > 0 
                                    ? `Progresso do OCR no navegador: ${ocrProgress}% concluído...` 
                                    : 'Identificando Favorecido, Valor e Data...'}
                            </span>
                        </div>
                    </div>
                    <span className="text-[10px] font-black uppercase text-orange-700 dark:text-orange-300 bg-orange-100/80 dark:bg-orange-900/60 px-2 py-0.5 rounded-full shrink-0">
                        Processando
                    </span>
                </div>
            )}

            {/* Lista de Anexos com Seletor de Papel e Diagnóstico */}
            {attachments && attachments.length > 0 && (
                <div className="space-y-2 mt-2">
                    {attachments.map((att) => {
                        const validation = validateExpenseAgainstDocument(currentAmount, att.extractedData);
                        const doc = att.extractedData;
                        const currentRole = att.documentRole || inferDocumentRole(doc?.documentType || 'outro', att.fileName);

                        return (
                            <div 
                                key={att.id}
                                className={`p-3 rounded-xl border transition-all ${
                                    validation.status === 'validated'
                                        ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30'
                                        : validation.status === 'divergent'
                                        ? 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30'
                                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className={`p-2 rounded-lg ${
                                            validation.status === 'validated' 
                                                ? currentRole === 'nota_fiscal'
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300'
                                                    : currentRole === 'fatura'
                                                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300'
                                                    : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300'
                                                : validation.status === 'divergent'
                                                ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                        }`}>
                                            {currentRole === 'nota_fiscal' ? (
                                                <Receipt className="w-4 h-4" />
                                            ) : currentRole === 'fatura' ? (
                                                <FileText className="w-4 h-4" />
                                            ) : currentRole === 'comprovante' ? (
                                                <CreditCard className="w-4 h-4" />
                                            ) : (
                                                <FileText className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs block">
                                                    {att.fileName}
                                                </span>
                                                {doc?.documentTypeLabel && (
                                                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0">
                                                        {doc.documentTypeLabel}
                                                    </span>
                                                )}
                                                {doc?.confidenceLevel === 'high' && (
                                                    <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 border border-emerald-200 dark:border-emerald-800">
                                                        ✓ XML Estruturado
                                                    </span>
                                                )}
                                                {att.fileSize && (
                                                    <span className="text-[8.5px] text-slate-400 font-mono">
                                                        {(att.fileSize / 1024).toFixed(0)} KB
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Detalhes Extraídos */}
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                                {doc?.extractedAmount !== null && doc?.extractedAmount !== undefined && (
                                                    <span>
                                                        Valor Detectado: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(doc.extractedAmount, language)}</strong>
                                                    </span>
                                                )}
                                                {doc?.extractedRecipient && (
                                                    <span className="truncate max-w-[180px]" title={doc.extractedRecipient}>
                                                        Favorecido: <strong className="text-slate-700 dark:text-slate-200">{doc.extractedRecipient}</strong>
                                                    </span>
                                                )}
                                                {doc?.extractedRecipientCnpjCpf && (
                                                    <span>
                                                        CNPJ/CPF: <strong className="font-mono text-slate-700 dark:text-slate-200">{doc.extractedRecipientCnpjCpf}</strong>
                                                    </span>
                                                )}
                                                {doc?.documentNumber && (
                                                    <span>
                                                        Nº: <strong className="font-mono text-slate-700 dark:text-slate-200">{doc.documentNumber}</strong>
                                                    </span>
                                                )}
                                                {doc?.extractedDate && (
                                                    <span>
                                                        Data: <strong>{doc.extractedDate.split('-').reverse().join('/')}</strong>
                                                    </span>
                                                )}
                                                {doc?.extractedDueDate && (
                                                    <span>
                                                        Vencimento: <strong className="text-amber-700 dark:text-amber-400">{doc.extractedDueDate.split('-').reverse().join('/')}</strong>
                                                    </span>
                                                )}
                                                {doc?.barcodeOrAuth && (
                                                    <span className="truncate max-w-[220px]" title={doc.barcodeOrAuth}>
                                                        Linha/Cód: <strong className="font-mono text-[9.5px] text-slate-700 dark:text-slate-200">{doc.barcodeOrAuth}</strong>
                                                    </span>
                                                )}
                                                {doc?.items && doc.items.length > 0 && (
                                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                                        📦 {doc.items.length} {doc.items.length === 1 ? 'item' : 'itens'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {att.dataUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setPreviewAttachment(att)}
                                                className="p-1.5 text-slate-500 hover:text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                                title="Visualizar documento"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAttachment(att.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                                title="Remover anexo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Dados Extraídos do Documento */}
                                {doc && (doc.extractedAmount || doc.extractedRecipient || doc.extractedDate || doc.extractedDueDate) && (
                                    <div className="mt-2 px-2.5 py-1.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 rounded-xl flex flex-wrap items-center gap-1.5 text-[10px]">
                                        <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 text-amber-500" />
                                            Detectado:
                                        </span>
                                        {doc.extractedAmount && (
                                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 font-bold text-slate-800 dark:text-white">
                                                R$ {doc.extractedAmount.toFixed(2)}
                                            </span>
                                        )}
                                        {doc.extractedRecipient && (
                                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 font-bold text-slate-800 dark:text-white truncate max-w-[220px]" title={doc.extractedRecipient}>
                                                {doc.extractedRecipient}
                                            </span>
                                        )}
                                        {(doc.extractedDueDate || doc.extractedDate) && (
                                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 font-mono text-slate-700 dark:text-slate-300">
                                                {doc.extractedDueDate || doc.extractedDate}
                                            </span>
                                        )}
                                        {doc.documentNumber && (
                                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-slate-600 dark:text-slate-400">
                                                Nº {doc.documentNumber}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Barra de Papel do Documento + Diagnóstico */}
                                <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                                    {/* Alternador de Papel: Nota Fiscal vs Fatura vs Comprovante */}
                                    {!readOnly ? (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-[9px] text-slate-400 uppercase font-semibold mr-0.5">Tipo:</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRoleChange(att.id, 'nota_fiscal')}
                                                className={`px-2 py-0.5 rounded text-[8.5px] font-bold transition-all cursor-pointer ${
                                                    currentRole === 'nota_fiscal'
                                                        ? 'bg-indigo-600 text-white shadow-xs'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                                }`}
                                                title="Definir como Nota Fiscal / Cupom Fiscal (compra de mercadorias ou serviços)"
                                            >
                                                🧾 Nota Fiscal
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRoleChange(att.id, 'fatura')}
                                                className={`px-2 py-0.5 rounded text-[8.5px] font-bold transition-all cursor-pointer ${
                                                    currentRole === 'fatura'
                                                        ? 'bg-amber-600 text-white shadow-xs'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                                }`}
                                                title="Definir como Boleto Bancário ou Fatura de cobrança"
                                            >
                                                📄 Boleto / Fatura
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRoleChange(att.id, 'comprovante')}
                                                className={`px-2 py-0.5 rounded text-[8.5px] font-bold transition-all cursor-pointer ${
                                                    currentRole === 'comprovante'
                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                                }`}
                                                title="Definir como Comprovante de Pagamento (PIX, TED, quitação)"
                                            >
                                                💳 Comprovante
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRoleChange(att.id, 'outro')}
                                                className={`px-1.5 py-0.5 rounded text-[8.5px] font-semibold transition-all cursor-pointer ${
                                                    currentRole === 'outro'
                                                        ? 'bg-slate-600 text-white'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                                title="Outro tipo de documento"
                                            >
                                                Outro
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-[9px] font-bold uppercase text-slate-500">
                                            {currentRole === 'nota_fiscal'
                                                ? '🧾 Nota Fiscal (Compra)'
                                                : currentRole === 'fatura'
                                                ? '📄 Boleto / Fatura'
                                                : currentRole === 'comprovante'
                                                ? '💳 Comprovante de Quitação'
                                                : 'Outro Documento'}
                                        </span>
                                    )}

                                    {/* Diagnóstico de Validação */}
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        {validation.status === 'validated' ? (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Valor confere ({formatCurrency(currentAmount, language)})
                                            </span>
                                        ) : validation.status === 'divergent' ? (
                                            <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                Lançamento R$ {currentAmount.toFixed(2)} vs Doc R$ {doc?.extractedAmount?.toFixed(2)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                                                {validation.message}
                                            </span>
                                        )}
                                    </div>

                                    {/* Ações de Auto-Preenchimento */}
                                    <div className="flex items-center gap-1.5">
                                        {(validation.status === 'divergent' || currentAmount === 0 || !currentAmount) && doc?.extractedAmount && onApplyExtractedAmount && (
                                            <button
                                                type="button"
                                                onClick={() => onApplyExtractedAmount(doc.extractedAmount!)}
                                                className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                                            >
                                                <Sparkles className="w-2.5 h-2.5" />
                                                {currentAmount === 0 || !currentAmount ? 'Aplicar' : 'Ajustar para'} R$ {doc.extractedAmount.toFixed(2)}
                                            </button>
                                        )}
                                        {doc?.extractedRecipient && onApplyExtractedRecipient && (
                                            <button
                                                type="button"
                                                onClick={() => onApplyExtractedRecipient(doc.extractedRecipient!)}
                                                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-[9px] font-bold transition-all cursor-pointer"
                                            >
                                                Copiar Favorecido
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
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
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
                            {previewAttachment.fileType === 'application/pdf' || previewAttachment.fileName.endsWith('.pdf') ? (
                                <iframe 
                                    src={previewAttachment.dataUrl} 
                                    className="w-full h-[600px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white" 
                                    title="Visualização do PDF"
                                />
                            ) : previewAttachment.fileName.toLowerCase().endsWith('.xml') || previewAttachment.fileType.includes('xml') ? (
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
                                                {previewAttachment.extractedData?.extractedDate
                                                    ? previewAttachment.extractedData.extractedDate.split('-').reverse().join('/')
                                                    : 'Não informada'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Data de Vencimento</span>
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block">
                                                {previewAttachment.extractedData?.extractedDueDate
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
