import React, { useState, useRef } from 'react';
import { 
    FileText, 
    Upload, 
    Trash2, 
    Eye, 
    CheckCircle2, 
    AlertTriangle, 
    HelpCircle, 
    FileSpreadsheet, 
    ArrowRight, 
    Sparkles, 
    Clock, 
    ShieldCheck, 
    AlertCircle,
    FileCheck,
    FileMinus
} from 'lucide-react';
import { 
    ExpenseAttachment, 
    ExtractedExpenseDoc, 
    extractTextFromPDF, 
    analyzeExpenseDocumentText, 
    validateExpenseAgainstDocument,
    ExpenseValidationStatus
} from '../../utils/expenseDocumentParser';
import { formatCurrency } from '../../utils/formatters';

interface ExpenseDocumentUploaderProps {
    currentAmount?: number;
    launchAmount?: number;
    recipientName?: string;
    attachments: ExpenseAttachment[];
    onChangeAttachments: (newAttachments: ExpenseAttachment[]) => void;
    onApplyExtractedAmount?: (amount: number) => void;
    onApplyExtractedRecipient?: (recipient: string) => void;
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
    language = 'pt',
    readOnly = false
}) => {
    const currentAmount = propCurrentAmount ?? (launchAmount ?? 0);
    const [isParsing, setIsParsing] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<ExpenseAttachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || readOnly) return;
        setIsParsing(true);

        const newAttachmentsList: ExpenseAttachment[] = [...attachments];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            try {
                let rawText = '';
                let dataUrl = '';

                // Leitura do arquivo como dataUrl para preview/armazenamento
                const reader = new FileReader();
                const dataUrlPromise = new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(file);
                });

                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    const arrayBuffer = await file.arrayBuffer();
                    rawText = await extractTextFromPDF(arrayBuffer);
                } else if (file.type.startsWith('image/')) {
                    // Imagens de comprovantes
                    rawText = `Comprovante de imagem: ${file.name}`;
                }

                dataUrl = await dataUrlPromise;

                const extractedData: ExtractedExpenseDoc = analyzeExpenseDocumentText(rawText);
                const validation = validateExpenseAgainstDocument(currentAmount, extractedData);

                const newAttachment: ExpenseAttachment = {
                    id: fileId,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
                    uploadedAt: new Date().toISOString(),
                    dataUrl,
                    extractedData,
                    validationStatus: validation.status,
                    validationNotes: validation.message
                };

                newAttachmentsList.push(newAttachment);
            } catch (err) {
                console.error('Erro ao processar anexo:', err);
            }
        }

        onChangeAttachments(newAttachmentsList);
        setIsParsing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveAttachment = (id: string) => {
        if (readOnly) return;
        const updated = attachments.filter(a => a.id !== id);
        onChangeAttachments(updated);
    };

    // Obter validação global dos anexos
    const primaryAttachment = attachments[0] || null;
    const currentValidation = primaryAttachment 
        ? validateExpenseAgainstDocument(currentAmount, primaryAttachment.extractedData)
        : { status: 'pending_attachment' as ExpenseValidationStatus, message: 'Nenhum documento anexado.', diff: 0 };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-orange-500" />
                    Comprovantes / Fatura / Boleto / Nota Fiscal (PDF)
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

            {/* Dropzone Upload */}
            {!readOnly && (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFileUpload(e.dataTransfer.files);
                    }}
                    className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-400 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-orange-50/20 dark:hover:bg-orange-950/10 rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center gap-2"
                >
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".pdf,image/png,image/jpeg,image/jpg" 
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-full shadow-sm group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all text-slate-400">
                        {isParsing ? (
                            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Upload className="w-5 h-5" />
                        )}
                    </div>
                    
                    <div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                            {isParsing ? 'Processando e analisando documento...' : 'Clique ou arraste comprovante / boleto / fatura / nota fiscal'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                            PDF ou Imagem (Verificação automática e instantânea do valor)
                        </span>
                    </div>
                </div>
            )}

            {/* Lista de Anexos com Diagnóstico de Validação */}
            {attachments && attachments.length > 0 && (
                <div className="space-y-2 mt-2">
                    {attachments.map((att) => {
                        const validation = validateExpenseAgainstDocument(currentAmount, att.extractedData);
                        const doc = att.extractedData;

                        return (
                            <div 
                                key={att.id}
                                className={`p-3.5 rounded-xl border transition-all ${
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
                                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300'
                                                : validation.status === 'divergent'
                                                ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                        }`}>
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate block">
                                                    {att.fileName}
                                                </span>
                                                {doc?.documentTypeLabel && (
                                                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0">
                                                        {doc.documentTypeLabel}
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
                                                    <span className="truncate max-w-[200px]" title={doc.extractedRecipient}>
                                                        Favorecido: <strong className="text-slate-700 dark:text-slate-200">{doc.extractedRecipient}</strong>
                                                    </span>
                                                )}
                                                {doc?.extractedDate && (
                                                    <span>
                                                        Data Doc: <strong>{doc.extractedDate.split('-').reverse().join('/')}</strong>
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

                                {/* Diagnóstico de Validação */}
                                <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-1.5">
                                        {validation.status === 'validated' ? (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Valor confere perfeitamente ({formatCurrency(currentAmount, language)})
                                            </span>
                                        ) : validation.status === 'divergent' ? (
                                            <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                Lançamento R$ {currentAmount.toFixed(2)} vs Documento R$ {doc?.extractedAmount?.toFixed(2)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                                                {validation.message}
                                            </span>
                                        )}
                                    </div>

                                    {/* Sugestão de Auto-Preenchimento com 1 clique se houver divergência */}
                                    {validation.status === 'divergent' && doc?.extractedAmount && onApplyExtractedAmount && (
                                        <button
                                            type="button"
                                            onClick={() => onApplyExtractedAmount(doc.extractedAmount!)}
                                            className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            Ajustar para R$ {doc.extractedAmount.toFixed(2)}
                                        </button>
                                    )}

                                    {/* Sugestão de Favorecido */}
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
