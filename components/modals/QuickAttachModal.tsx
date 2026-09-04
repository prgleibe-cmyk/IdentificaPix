import React, { useState, useEffect } from 'react';
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
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen || !transaction?.id) {
            setAttachments([]);
            return;
        }

        let isMounted = true;
        getAttachmentsForTransaction(transaction.id).then(stored => {
            if (!isMounted) return;
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
    }, [isOpen, transaction?.id, transaction?.attachments]);

    if (!isOpen || !transaction) return null;

    const txTitle = transaction.payer || transaction.contribuinte || transaction.nome || transaction.title || transaction.description || transaction.desc || 'Lançamento';
    const txDesc = transaction.desc || transaction.description || transaction.historico || '';
    const txAmount = Math.abs(transaction.amount || 0);
    const txDate = transaction.date || '';
    const churchName = transaction.church || transaction.churchName || '';

    const handleSave = async () => {
        if (!transaction.id) return;
        setIsSaving(true);
        try {
            await saveAttachmentsForTransaction(transaction.id, attachments);
            if (onSaved) {
                onSaved(transaction.id, attachments);
            }
            onClose();
        } catch (err) {
            console.error('Erro ao salvar anexos:', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850/80">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-brand-blue text-white shadow-xs shrink-0">
                            <Paperclip className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                Anexar Nota Fiscal, Boleto e Comprovante
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                Vincule notas fiscais (compra), boletos/faturas e comprovantes de quitação
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Transaction Summary Card */}
                <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 dark:text-slate-200 uppercase truncate text-[11px]">
                            {txTitle}
                        </div>
                        {txDesc && txDesc !== txTitle && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {txDesc}
                            </div>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                            {txDate && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(txDate)}
                                </span>
                            )}
                            {churchName && (
                                <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                                    <Building2 className="w-3 h-3" />
                                    {churchName}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valor</span>
                        <span className="font-mono text-sm font-black text-rose-600 dark:text-rose-400">
                            {formatCurrency(txAmount)}
                        </span>
                    </div>
                </div>

                {/* Uploader Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    <ExpenseDocumentUploader
                        attachments={attachments}
                        onChangeAttachments={setAttachments}
                        currentAmount={txAmount}
                    />
                </div>

                {/* Footer / Actions */}
                <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850/80">
                    <span className="text-[11px] text-slate-500 font-medium">
                        {attachments.length === 0 ? 'Nenhum arquivo anexado' : `${attachments.length} ${attachments.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}`}
                    </span>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                            type="button"
                            onClick={() => setIsReceiptModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 rounded-xl transition-all cursor-pointer shadow-2xs"
                            title="Emitir Recibo de Prestação de Serviços com assinatura touch na tela"
                        >
                            <FileSignature className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Emitir Recibo Assinado</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-blue hover:bg-blue-600 active:scale-98 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
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
