import React, { useState, useRef } from 'react';
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
    X
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
    const [selectedRole, setSelectedRole] = useState<DocumentRole | null>(null);
    const [selectionAlert, setSelectionAlert] = useState<string | null>(null);
    const alertTimeoutRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || readOnly) return;

        // Bloqueio cirúrgico: só libera se uma opção estiver selecionada
        if (!selectedRole) {
            triggerSelectionAlert();
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsParsing(true);
        setSelectionAlert(null);

        const newAttachmentsList: ExpenseAttachment[] = [...attachments];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            try {
                let rawText = '';
                let dataUrl = '';
                let finalSize = file.size;

                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    const arrayBuffer = await file.arrayBuffer();
                    rawText = await extractTextFromPDF(arrayBuffer);
                    
                    const reader = new FileReader();
                    const dataUrlPromise = new Promise<string>((resolve) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () => resolve('');
                        reader.readAsDataURL(file);
                    });
                    dataUrl = await dataUrlPromise;
                } else if (file.type.startsWith('image/')) {
                    // Comprime imagens pesadas de celular mantendo nitidez de leitura
                    const compressed = await compressImageIfNeeded(file);
                    dataUrl = compressed.dataUrl;
                    finalSize = compressed.size;
                    rawText = `Comprovante de imagem: ${file.name}`;
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
                const validation = validateExpenseAgainstDocument(currentAmount, extractedData);
                const autoRole = inferDocumentRole(extractedData.documentType, file.name);

                // O documento é identificado obrigatoriamente pelo tipo selecionado pelo usuário!
                const assignedRole: DocumentRole = selectedRole || autoRole;

                const newAttachment: ExpenseAttachment = {
                    id: fileId,
                    fileName: file.name,
                    fileSize: finalSize,
                    fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
                    uploadedAt: new Date().toISOString(),
                    dataUrl,
                    extractedData,
                    validationStatus: validation.status,
                    validationNotes: validation.message,
                    documentRole: assignedRole
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

            {/* Painel Triplo de Auditoria: Nota Fiscal (Compra) + Boleto/Fatura + Comprovante de Pagamento */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <span>1. Escolha o tipo de documento para carregar:</span>
                        {selectedRole && (
                            <span className="text-[9px] font-black uppercase text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-900/40">
                                Tipo Ativo: {selectedRole === 'nota_fiscal' ? 'Nota Fiscal' : selectedRole === 'fatura' ? 'Boleto / Fatura' : 'Comprovante'}
                            </span>
                        )}
                    </span>
                    {selectedRole && !readOnly && (
                        <button
                            type="button"
                            onClick={() => setSelectedRole(null)}
                            className="text-[9px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                        >
                            Limpar seleção
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Slot 1: Nota Fiscal / Cupom (Compras) */}
                    <div 
                        id="btn-role-nota-fiscal"
                        onClick={() => {
                            if (readOnly) return;
                            setSelectedRole(prev => prev === 'nota_fiscal' ? null : 'nota_fiscal');
                            setSelectionAlert(null);
                        }}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 cursor-pointer select-none ${
                            selectedRole === 'nota_fiscal'
                                ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                                : hasNf 
                                ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40 hover:border-indigo-300' 
                                : 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                                    selectedRole === 'nota_fiscal'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : hasNf 
                                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300' 
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                }`}>
                                    <Receipt className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate">
                                        1. Nota Fiscal
                                    </span>
                                    <span className="text-[9px] text-slate-400 block truncate">
                                        {hasNf 
                                            ? `${nfDocs[0].fileName} ${nfDocs[0].extractedData?.extractedAmount ? `(${formatCurrency(nfDocs[0].extractedData.extractedAmount, language)})` : ''}` 
                                            : 'Compra / Mercadorias'}
                                    </span>
                                </div>
                            </div>
                            {selectedRole === 'nota_fiscal' ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-indigo-600 text-white shrink-0 shadow-xs animate-fade-in">
                                    <Check className="w-2.5 h-2.5" /> Selecionado
                                </span>
                            ) : hasNf ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 shrink-0">
                                    <Check className="w-2.5 h-2.5" /> Anexada
                                </span>
                            ) : (
                                <span className="text-[8.5px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-900/30">
                                    Selecionar
                                </span>
                            )}
                        </div>

                        {!readOnly && (
                            <div className="flex items-center justify-between pt-1 border-t border-indigo-100/50 dark:border-indigo-900/30 text-[9px]">
                                <span className="text-slate-400 font-medium">
                                    {hasNf ? `${nfDocs.length} arquivo(s)` : 'Nenhum anexo'}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        triggerUploadForRole('nota_fiscal');
                                    }}
                                    className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 hover:underline cursor-pointer"
                                >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>{hasNf ? 'Anexar outro' : 'Carregar NF'}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Slot 2: Boleto / Fatura */}
                    <div 
                        id="btn-role-fatura"
                        onClick={() => {
                            if (readOnly) return;
                            setSelectedRole(prev => prev === 'fatura' ? null : 'fatura');
                            setSelectionAlert(null);
                        }}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 cursor-pointer select-none ${
                            selectedRole === 'fatura'
                                ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                                : hasInvoice 
                                ? 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 hover:border-amber-300' 
                                : 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                                    selectedRole === 'fatura'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : hasInvoice 
                                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300' 
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                }`}>
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate">
                                        2. Boleto / Fatura
                                    </span>
                                    <span className="text-[9px] text-slate-400 block truncate">
                                        {hasInvoice 
                                            ? `${invoiceDocs[0].fileName} ${invoiceDocs[0].extractedData?.extractedAmount ? `(${formatCurrency(invoiceDocs[0].extractedData.extractedAmount, language)})` : ''}` 
                                            : 'Cobrança / Contas'}
                                    </span>
                                </div>
                            </div>
                            {selectedRole === 'fatura' ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-amber-600 text-white shrink-0 shadow-xs animate-fade-in">
                                    <Check className="w-2.5 h-2.5" /> Selecionado
                                </span>
                            ) : hasInvoice ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
                                    <Check className="w-2.5 h-2.5" /> Anexado
                                </span>
                            ) : (
                                <span className="text-[8.5px] font-bold text-amber-600 dark:text-amber-400 shrink-0 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/30">
                                    Selecionar
                                </span>
                            )}
                        </div>

                        {!readOnly && (
                            <div className="flex items-center justify-between pt-1 border-t border-amber-100/50 dark:border-amber-900/30 text-[9px]">
                                <span className="text-slate-400 font-medium">
                                    {hasInvoice ? `${invoiceDocs.length} arquivo(s)` : 'Nenhum anexo'}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        triggerUploadForRole('fatura');
                                    }}
                                    className="font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 flex items-center gap-0.5 hover:underline cursor-pointer"
                                >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>{hasInvoice ? 'Anexar outro' : 'Carregar Boleto'}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Slot 3: Comprovante de Pagamento */}
                    <div 
                        id="btn-role-comprovante"
                        onClick={() => {
                            if (readOnly) return;
                            setSelectedRole(prev => prev === 'comprovante' ? null : 'comprovante');
                            setSelectionAlert(null);
                        }}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 cursor-pointer select-none ${
                            selectedRole === 'comprovante'
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                                : hasProof 
                                ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-300' 
                                : 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                                    selectedRole === 'comprovante'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : hasProof 
                                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300' 
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                }`}>
                                    <CreditCard className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate">
                                        3. Comprovante (Quitação)
                                    </span>
                                    <span className="text-[9px] text-slate-400 block truncate">
                                        {hasProof 
                                            ? `${proofDocs[0].fileName} ${proofDocs[0].extractedData?.extractedAmount ? `(${formatCurrency(proofDocs[0].extractedData.extractedAmount, language)})` : ''}` 
                                            : 'PIX / TED / Recibo'}
                                    </span>
                                </div>
                            </div>
                            {selectedRole === 'comprovante' ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-emerald-600 text-white shrink-0 shadow-xs animate-fade-in">
                                    <Check className="w-2.5 h-2.5" /> Selecionado
                                </span>
                            ) : hasProof ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                                    <Check className="w-2.5 h-2.5" /> Quitado
                                </span>
                            ) : (
                                <span className="text-[8.5px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-900/30">
                                    Selecionar
                                </span>
                            )}
                        </div>

                        {!readOnly && (
                            <div className="flex items-center justify-between pt-1 border-t border-emerald-100/50 dark:border-emerald-900/30 text-[9px]">
                                <span className="text-slate-400 font-medium">
                                    {hasProof ? `${proofDocs.length} arquivo(s)` : 'Nenhum anexo'}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        triggerUploadForRole('comprovante');
                                    }}
                                    className="font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-0.5 hover:underline cursor-pointer"
                                >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>{hasProof ? 'Anexar outro' : 'Carregar Comprovante'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Alerta Visual se o usuário tentar enviar sem selecionar o tipo */}
            {selectionAlert && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 animate-fade-in shadow-xs">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-semibold text-[11px]">{selectionAlert}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSelectionAlert(null)}
                        className="p-1 text-amber-600 hover:text-amber-900 rounded-md cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Dropzone Upload Condicional (Bloqueado até seleção do tipo) */}
            {!readOnly && (
                <div 
                    onClick={() => {
                        if (!selectedRole) {
                            triggerSelectionAlert();
                            return;
                        }
                        fileInputRef.current?.click();
                    }}
                    onDragOver={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selectedRole) {
                            triggerSelectionAlert();
                            return;
                        }
                        handleFileUpload(e.dataTransfer.files);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all duration-200 flex flex-col items-center justify-center gap-2 select-none ${
                        !selectedRole
                            ? 'border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20 cursor-pointer hover:border-orange-400/80 hover:bg-orange-50/10'
                            : selectedRole === 'nota_fiscal'
                            ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/50 cursor-pointer ring-2 ring-indigo-500/10'
                            : selectedRole === 'fatura'
                            ? 'border-amber-400 dark:border-amber-600 bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50/50 cursor-pointer ring-2 ring-amber-500/10'
                            : 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 hover:bg-emerald-50/50 cursor-pointer ring-2 ring-emerald-500/10'
                    }`}
                >
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".pdf,image/png,image/jpeg,image/jpg" 
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    
                    <div className={`p-2.5 rounded-full shadow-xs transition-all ${
                        isParsing
                            ? 'bg-orange-50 text-orange-600'
                            : !selectedRole
                            ? 'bg-white dark:bg-slate-900 text-slate-400'
                            : selectedRole === 'nota_fiscal'
                            ? 'bg-indigo-600 text-white shadow-sm scale-105'
                            : selectedRole === 'fatura'
                            ? 'bg-amber-600 text-white shadow-sm scale-105'
                            : 'bg-emerald-600 text-white shadow-sm scale-105'
                    }`}>
                        {isParsing ? (
                            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        ) : !selectedRole ? (
                            <Upload className="w-5 h-5" />
                        ) : selectedRole === 'nota_fiscal' ? (
                            <Receipt className="w-5 h-5" />
                        ) : selectedRole === 'fatura' ? (
                            <FileText className="w-5 h-5" />
                        ) : (
                            <CreditCard className="w-5 h-5" />
                        )}
                    </div>
                    
                    <div>
                        {isParsing ? (
                            <>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                                    Processando e extraindo dados do arquivo...
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                                    Vinculando automaticamente como {selectedRole === 'nota_fiscal' ? 'Nota Fiscal' : selectedRole === 'fatura' ? 'Boleto / Fatura' : 'Comprovante'}...
                                </span>
                            </>
                        ) : !selectedRole ? (
                            <>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                                    Selecione uma das opções acima para liberar o envio do arquivo
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                                    Clique em Nota Fiscal, Boleto/Fatura ou Comprovante (Quitação) para identificar o arquivo que vai enviar
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="text-xs font-black text-slate-800 dark:text-white block">
                                    {selectedRole === 'nota_fiscal' && '✓ Upload Liberado: Carregar Nota Fiscal (Compra)'}
                                    {selectedRole === 'fatura' && '✓ Upload Liberado: Carregar Boleto / Fatura'}
                                    {selectedRole === 'comprovante' && '✓ Upload Liberado: Carregar Comprovante de Quitação'}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 block">
                                    Clique ou arraste o arquivo aqui — Ele será automaticamente identificado como <strong className="text-slate-700 dark:text-slate-200 font-bold">{selectedRole === 'nota_fiscal' ? 'Nota Fiscal' : selectedRole === 'fatura' ? 'Boleto / Fatura' : 'Comprovante (Quitação)'}</strong>
                                </span>
                            </>
                        )}
                    </div>
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
                                                {doc?.extractedDate && (
                                                    <span>
                                                        Data: <strong>{doc.extractedDate.split('-').reverse().join('/')}</strong>
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
                                        {validation.status === 'divergent' && doc?.extractedAmount && onApplyExtractedAmount && (
                                            <button
                                                type="button"
                                                onClick={() => onApplyExtractedAmount(doc.extractedAmount!)}
                                                className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                                            >
                                                <Sparkles className="w-2.5 h-2.5" />
                                                Ajustar para R$ {doc.extractedAmount.toFixed(2)}
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
