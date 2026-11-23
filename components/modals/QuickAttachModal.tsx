import React, { useState, useEffect, useRef } from 'react';
import { X, Paperclip, CheckCircle2, DollarSign, Calendar, Building2, Save, FileSignature } from 'lucide-react';
import { ExpenseAttachment } from '../../types/domain';
import { ExpenseDocumentUploader } from '../financial/ExpenseDocumentUploader';
import { ServiceReceiptModal } from './ServiceReceiptModal';
import { getAttachmentsForTransaction, saveAttachmentsForTransaction } from '../../services/expenseAttachmentService';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface QuickAttachModalProps {
    isOpen: boolean;
    transaction: {
        id: string;
        description?: string;
        desc?: string;
        historico?: string;
        payer?: string;
        contribuinte?: string;
        nome?: string;
        title?: string;
        amount?: number;
        date?: string;
        church?: string;
        churchName?: string;
        attachments?: ExpenseAttachment[];
        [key: string]: any;
    } | null;
    onClose: () => void;
    onSaved?: (txId: string, attachments: ExpenseAttachment[]) => void;
}

export const QuickAttachModal: React.FC<QuickAttachModalProps> = ({
    isOpen,
    transaction,
    onClose,
    onSaved
}) => {
    const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
    const loadedTxIdRef = useRef<string | null>(null);

    useEffect(() => {
        setErrorMsg(null);
        if (!isOpen || !transaction?.id) {
            setAttachments([]);
            loadedTxIdRef.current = null;
            return;
        }

        if (loadedTxIdRef.current === transaction.id) {
            return;
        }

        let isMounted = true;
        getAttachmentsForTransaction(transaction.id).then(stored => {
            if (!isMounted) return;
            loadedTxIdRef.current = transaction.id;
            if (stored && stored.length > 0) {
                setAttachments(stored);
            } else if (transaction.attachments && transaction.attachments.length > 0) {
                setAttachments(transaction.attachments);
            } else {
                setAttachments([]);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [isOpen, transaction?.id]);

    if (!isOpen || !transaction) return null;

    const txTitle = transaction.payer || transaction.contribuinte || transaction.nome || transaction.title || transaction.description || transaction.desc || 'Lançamento';
    const txDesc = transaction.desc || transaction.description || transaction.historico || '';
    const txAmount = Math.abs(transaction.amount || 0);
    const txDate = transaction.date || '';
    const churchName = transaction.church || transaction.churchName || '';

    const handleSave = async () => {
        if (!transaction.id) return;
        setIsSaving(true);
        setErrorMsg(null);
        try {
            await saveAttachmentsForTransaction(transaction.id, attachments);
            if (onSaved) {
                onSaved(transaction.id, attachments);
            }
            onClose();
        } catch (err: any) {
            console.error('Erro ao salvar anexos:', err);
            setErrorMsg(err?.message || 'Não foi possível salvar os anexos.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAttachmentsChange = (newAtts: ExpenseAttachment[]) => {
        const previousAtts = attachments;
        setErrorMsg(null);
        setAttachments(newAtts);
        if (transaction?.id) {
            saveAttachmentsForTransaction(transaction.id, newAtts).catch((err: any) => {
                console.error('Erro ao persistir anexos:', err);
                setAttachments(previousAtts);
                setErrorMsg(err?.message || 'Não foi possível alterar os anexos deste lançamento.');
            });
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-elevated overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <Paperclip className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Anexar Nota Fiscal, Boleto e Comprovante
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                Vincule notas fiscais (compra), boletos/faturas e comprovantes de quitação
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                        aria-label="Fechar"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Transaction Summary Card */}
                <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 uppercase truncate text-xs">
                            {txTitle}
                        </div>
                        {txDesc && txDesc !== txTitle && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {txDesc}
                            </div>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {txDate && (
                                <span className="flex items-center gap-1 tabular-nums">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(txDate)}
                                </span>
                            )}
                            {churchName && (
                                <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                                    <Building2 className="w-3 h-3" />
                                    {churchName}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="text-right shrink-0">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Valor</span>
                        <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatCurrency(txAmount)}
                        </span>
                    </div>
                </div>

                {/* Uploader Body */}
                <div
                    className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-300">
                            {errorMsg}
                        </div>
                    )}
                    <ExpenseDocumentUploader
                        attachments={attachments}
                        onChangeAttachments={handleAttachmentsChange}
                        currentAmount={txAmount}
                    />
                </div>

                {/* Footer / Actions */}
                <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                        {attachments.length === 0 ? 'Nenhum arquivo anexado' : `${attachments.length} ${attachments.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}`}
                    </span>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                            type="button"
                            onClick={() => setIsReceiptModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border border-amber-200/90 dark:border-amber-800 rounded-lg transition-all cursor-pointer shadow-xs"
                            title="Emitir Recibo de Prestação de Serviços com assinatura touch na tela"
                        >
                            <FileSignature className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Emitir Recibo Assinado</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 active:scale-95 rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSaving ? 'Salvando...' : 'Salvar Anexos'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {isReceiptModalOpen && (
                <ServiceReceiptModal
                    isOpen={isReceiptModalOpen}
                    transaction={transaction}
                    onClose={() => setIsReceiptModalOpen(false)}
                    onReceiptGenerated={(newAtt) => {
                        setAttachments(prev => [...prev, newAtt]);
                        setIsReceiptModalOpen(false);
                        if (transaction?.id && onSaved) {
                            onSaved(transaction.id, [...attachments, newAtt]);
                        }
                    }}
                />
            )}
        </div>
    );
};
