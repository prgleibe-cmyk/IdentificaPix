import React, { useState, useEffect } from 'react';
import { X, Download, FileText, CheckCircle2, Calendar, DollarSign, Building, Receipt, CreditCard, Loader2 } from 'lucide-react';
import { ExpenseAttachment } from '../../types/domain';
import { formatCurrency } from '../../utils/formatters';
import { getAttachmentsForTransaction } from '../../services/expenseAttachmentService';

interface AttachmentPreviewModalProps {
    isOpen: boolean;
    attachment: ExpenseAttachment | null;
    onClose: () => void;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
    isOpen,
    attachment,
    onClose
}) => {
    const [loadedDataUrl, setLoadedDataUrl] = useState<string>('');
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen || !attachment) {
            setLoadedDataUrl('');
            setIsLoadingData(false);
            return;
        }

        if (attachment.dataUrl) {
            setLoadedDataUrl(attachment.dataUrl);
            return;
        }

        const txId = (attachment as any).txId;
        if (!txId) return;

        let isMounted = true;
        setIsLoadingData(true);
        getAttachmentsForTransaction(txId)
            .then(list => {
                if (!isMounted) return;
                const found = list.find(a => a.id === attachment.id) || list[0];
                if (found?.dataUrl) {
                    setLoadedDataUrl(found.dataUrl);
                }
            })
            .catch(() => {})
            .finally(() => {
                if (isMounted) setIsLoadingData(false);
            });

        return () => {
            isMounted = false;
            setLoadedDataUrl('');
        };
    }, [isOpen, attachment]);

    if (!isOpen || !attachment) return null;

    const fileName = attachment.fileName || 'documento';
    const fileType = attachment.fileType || '';
    const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
    const isNf = attachment.documentRole === 'nota_fiscal';
    const isInvoice = attachment.documentRole === 'fatura';
    const isProof = attachment.documentRole === 'comprovante';
    const roleLabel = isNf 
        ? 'Nota Fiscal / Cupom' 
        : isInvoice 
        ? 'Fatura / Boleto' 
        : isProof 
        ? 'Comprovante de Pagamento' 
        : 'Documento';

    const effectiveDataUrl = attachment.dataUrl || loadedDataUrl;

    const handleDownload = () => {
        if (!effectiveDataUrl) return;
        const link = document.createElement('a');
        link.href = effectiveDataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const extracted = attachment.extractedData;

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-t border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850/80">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-xl text-white ${
                            isNf ? 'bg-indigo-600' : isInvoice ? 'bg-amber-600' : isProof ? 'bg-emerald-600' : 'bg-slate-600'
                        }`}>
                            {isNf ? <Receipt className="w-4 h-4" /> : isProof ? <CreditCard className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                    isNf
                                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50'
                                        : isInvoice
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                                        : isProof
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                    {roleLabel}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                    {(attachment.fileSize / 1024).toFixed(0)} KB
                                </span>
                            </div>
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-md mt-0.5" title={fileName}>
                                {fileName}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {effectiveDataUrl && (
                            <button
                                type="button"
                                onClick={handleDownload}
                                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                title="Baixar arquivo original"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Metadata bar if extracted info exists */}
                {extracted && (extracted.extractedAmount || extracted.extractedRecipient || extracted.extractedDate) && (
                    <div className="px-5 py-2 bg-slate-50 dark:bg-slate-850/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-[11px]">
                        {extracted.extractedAmount !== null && extracted.extractedAmount !== undefined && (
                            <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200 font-mono">
                                <DollarSign className="w-3 h-3 text-emerald-600" />
                                {formatCurrency(extracted.extractedAmount)}
                            </span>
                        )}
                        {extracted.extractedDate && (
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                <Calendar className="w-3 h-3 text-blue-500" />
                                {extracted.extractedDate}
                            </span>
                        )}
                        {extracted.extractedRecipient && (
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                                <Building className="w-3 h-3 text-purple-500" />
                                {extracted.extractedRecipient}
                            </span>
                        )}
                    </div>
                )}

                {/* Preview Body */}
                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100/60 dark:bg-black/40 min-h-[320px]">
                    {isLoadingData ? (
                        <div className="flex flex-col items-center justify-center gap-3 p-8">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
                            <span className="text-xs font-semibold text-slate-500">Carregando arquivo...</span>
                        </div>
                    ) : isImage && effectiveDataUrl ? (
                        <img 
                            src={effectiveDataUrl} 
                            alt={fileName}
                            className="max-h-[70vh] w-auto max-w-full rounded-lg shadow-md object-contain" 
                        />
                    ) : isPdf && effectiveDataUrl ? (
                        <iframe
                            src={effectiveDataUrl}
                            title={fileName}
                            className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800 shadow-md bg-white"
                        />
                    ) : (
                        <div className="text-center p-8 space-y-3">
                            <FileText className="w-12 h-12 mx-auto text-slate-400" />
                            <p className="text-xs text-slate-500 font-medium">Visualização direta não suportada para este formato.</p>
                            {effectiveDataUrl && (
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="px-4 py-2 text-xs font-bold text-white bg-brand-blue rounded-xl hover:bg-blue-600 shadow-sm"
                                >
                                    Baixar Arquivo
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
