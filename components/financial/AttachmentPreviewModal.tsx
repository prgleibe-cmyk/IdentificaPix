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
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');

    const effectiveDataUrl = attachment?.dataUrl || loadedDataUrl;
    const fileName = attachment?.fileName || 'documento';
    const fileType = attachment?.fileType || '';
    const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

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

    useEffect(() => {
        if (!isOpen || !isPdf || !effectiveDataUrl) {
            setPdfBlobUrl('');
            return;
        }

        let blobUrl = '';
        try {
            if (effectiveDataUrl.startsWith('data:')) {
                const parts = effectiveDataUrl.split(',');
                const byteString = atob(parts[1]);
                const mimeMatch = parts[0].match(/:(.*?);/);
                const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type: mimeType });
                blobUrl = URL.createObjectURL(blob);
                setPdfBlobUrl(blobUrl);
            } else {
                setPdfBlobUrl(effectiveDataUrl);
            }
        } catch (_) {
            setPdfBlobUrl(effectiveDataUrl);
        }

        return () => {
            if (blobUrl) {
                try { URL.revokeObjectURL(blobUrl); } catch (_) {}
            }
            setPdfBlobUrl('');
        };
    }, [isOpen, isPdf, effectiveDataUrl]);

    if (!isOpen || !attachment) return null;

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

    const handleDownload = () => {
        if (!effectiveDataUrl) return;
        const link = document.createElement('a');
        link.href = pdfBlobUrl || effectiveDataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const extracted = attachment.extractedData;

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-elevated overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                            isNf
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200/70 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                                : isInvoice
                                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200/70 dark:border-amber-900/50 text-amber-600 dark:text-amber-400'
                                : isProof
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/70 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                                : 'bg-orange-50 dark:bg-orange-950/50 border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400'
                        }`}>
                            {isNf ? <Receipt className="w-4 h-4" /> : isProof ? <CreditCard className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                    isNf
                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/50'
                                        : isInvoice
                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/50'
                                        : isProof
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/50'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
                                }`}>
                                    {roleLabel}
                                </span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                                    {(attachment.fileSize / 1024).toFixed(0)} KB
                                </span>
                            </div>
                            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-md mt-0.5" title={fileName}>
                                {fileName}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {effectiveDataUrl && (
                            <button
                                type="button"
                                onClick={handleDownload}
                                className="p-2 text-slate-500 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Baixar arquivo original"
                                aria-label="Baixar arquivo original"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            aria-label="Fechar"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Metadata bar if extracted info exists */}
                {extracted && (extracted.extractedAmount || extracted.extractedRecipient || extracted.extractedDate) && (
                    <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs shrink-0">
                        {extracted.extractedAmount !== null && extracted.extractedAmount !== undefined && (
                            <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                {formatCurrency(extracted.extractedAmount)}
                            </span>
                        )}
                        {extracted.extractedDate && (
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 tabular-nums">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {extracted.extractedDate}
                            </span>
                        )}
                        {extracted.extractedRecipient && (
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{extracted.extractedRecipient}</span>
                            </span>
                        )}
                    </div>
                )}

                {/* Preview Body */}
                <div className="flex-1 overflow-auto custom-scrollbar p-4 flex items-center justify-center bg-slate-100/80 dark:bg-slate-950/60 min-h-[320px]">
                    {isLoadingData ? (
                        <div className="flex flex-col items-center justify-center gap-3 p-8">
                            <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Carregando arquivo...</span>
                        </div>
                    ) : isImage && effectiveDataUrl ? (
                        <img 
                            src={effectiveDataUrl} 
                            alt={fileName}
                            className="max-h-[70vh] w-auto max-w-full rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-800 object-contain" 
                        />
                    ) : isPdf && effectiveDataUrl ? (
                        <iframe
                            src={pdfBlobUrl || effectiveDataUrl}
                            title={fileName}
                            className="w-full h-[70vh] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white"
                        />
                    ) : (
                        <div className="text-center p-8 space-y-3">
                            <FileText className="w-12 h-12 mx-auto text-slate-400" />
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Visualização direta não suportada para este formato.</p>
                            {effectiveDataUrl && (
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer"
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
