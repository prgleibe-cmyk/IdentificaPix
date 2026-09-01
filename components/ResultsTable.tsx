import React, { memo, useContext, useState, useCallback, useEffect } from 'react';
import { MatchResult } from '../types';
import { formatCurrency, formatDate, resolvePaymentMethod, resolveTransactionSource } from '../utils/formatters';
import { useTranslation } from '../contexts/I18nContext';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { SparklesIcon, UserPlusIcon, BrainIcon, BanknotesIcon, UserIcon, LockClosedIcon, LockOpenIcon, PencilIcon } from './Icons';
import { BulkActionToolbar } from './BulkActionToolbar';
import { isInvalidOrNumericName } from '../services/utils/parsingUtils';
import { MessageCircle, CheckCircle2 } from 'lucide-react';
import { isWhatsAppSent, sendWhatsAppDirect } from './modals/WhatsAppReceiptModal';

interface ResultsTableProps {
  results: MatchResult[];
  loadingAiId: string | null;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

const MatchMethodIcon: React.FC<{ method: MatchResult['matchMethod'] }> = ({ method }) => {
    const { t } = useTranslation();
    if (!method) return null;

    const iconMap = {
        LEARNED: { Icon: BrainIcon, tooltip: t('tooltip.learned'), color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30' },
        AI: { Icon: SparklesIcon, tooltip: t('tooltip.ai'), color: 'text-teal-500 bg-teal-50 dark:bg-teal-900/30' },
        MANUAL: { Icon: UserPlusIcon, tooltip: t('tooltip.manual'), color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' },
        AUTOMATIC: null,
        TEMPLATE: null
    };

    const config = iconMap[method] || iconMap.AUTOMATIC;
    if (!config) return null;

    return (
        <span className={`ml-1.5 p-1 rounded-md ${config.color} inline-flex items-center justify-center`} title={config.tooltip}>
            <config.Icon className="w-3 h-3" />
        </span>
    );
};

export const ResultsTable: React.FC<ResultsTableProps> = memo(({ results, loadingAiId, currentPage, totalPages, onPageChange }) => {
    const { t, language } = useTranslation();
    const { toggleConfirmation, setBulkIdentificationTxs, openWhatsAppReceiptModal, contributionTypes, paymentMethods: sysPaymentMethods, contributionKeywords, contributors, churches, showToast } = useContext(AppContext);
    const { subscription, user, isSecondaryUser } = useAuth();

    const perms = (subscription?.permissions || {}) as any;
    const canConfirmFinal = !isSecondaryUser || (perms.confirmar_final !== false && perms.confirmFinal !== false);
    const canIdentify = !isSecondaryUser || (perms.identificar !== false && perms.identifyPayments !== false);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [, setWaSentTick] = useState<number>(0);

    useEffect(() => { 
        setSelectedIds([]); 
    }, [results.length]);

    useEffect(() => {
        const handleUpdate = () => {
            setWaSentTick(prev => prev + 1);
        };
        window.addEventListener('whatsapp_sent_updated', handleUpdate);
        return () => window.removeEventListener('whatsapp_sent_updated', handleUpdate);
    }, []);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const toggleAll = useCallback(() => {
        if (selectedIds.length === results.length && results.length > 0) setSelectedIds([]);
        else setSelectedIds(results.map(r => r.transaction.id));
    }, [results, selectedIds]);

    const getStatusBadge = (status: MatchResult['status'], method?: MatchResult['matchMethod'], confirmed?: boolean) => {
        if (confirmed) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wide">
                    <LockClosedIcon className="w-2.5 h-2.5" /> Fechado
                </span>
            );
        }

        if (status === 'NÃO IDENTIFICADO') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wide">
                    Pendente
                </span>
            );
        }

        if (status === 'PENDENTE') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide">
                    Fantasma
                </span>
            );
        }

        let label = 'Auto';
        if (method === 'MANUAL') label = 'Manual';
        else if (method === 'AI') label = 'IA';
        else if (method === 'LEARNED') label = 'Aprendido';

        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide">
                {label}
            </span>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden mt-6 flex flex-col relative">
            <BulkActionToolbar 
    selectedIds={selectedIds} 
    results={results}
    onClear={() => setSelectedIds([])} 
/>

            <div className="overflow-x-auto custom-scrollbar relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-200/60 dark:border-slate-700 backdrop-blur-md sticky top-0 z-20">
                        <tr>
                            <th className="px-4 py-2.5 w-10 text-center">
                                <input type="checkbox" className="w-4 h-4 rounded-full border-slate-300 text-brand-blue" onChange={toggleAll} checked={selectedIds.length > 0 && selectedIds.length === results.length} />
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[10%]">{t('table.date')}</th>
                            <th className="px-1.5 py-2.5 text-center w-[36px]" title="Status do WhatsApp">
                                <div className="flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                </div>
                            </th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[25%]">Nome / Descrição</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[10%]">Origem</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[13%]">Igreja</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[10%]">Forma</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[12%]">{t('table.amount')}</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[10%]">{t('table.status')}</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[10%]">{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {results.map(({ transaction, contributor, status, matchMethod, contributorAmount, paymentMethod, church, isConfirmed, contributionType }) => {
                            const isSelected = selectedIds.includes(transaction.id);

                            // 🧠 Fonte única de verdade
                            // Fix: transaction.isConfirmed is now valid after updating Transaction interface
                            const confirmed = transaction.isConfirmed ?? isConfirmed ?? false;

                            const displayAmount = transaction.amount;
                            const isExpense = displayAmount < 0 || 
                                              transaction.type?.toLowerCase() === 'expense' || 
                                              transaction.type?.toLowerCase() === 'saida' || 
                                              contributionType?.toLowerCase() === 'saída' || 
                                              contributionType?.toLowerCase() === 'saida';
                            const refDate = contributor?.reference_date || transaction.reference_date;
                            const hasRefDate = refDate && refDate !== transaction.date;
                            const displayDate = formatDate(refDate || transaction.date);
                            const originalBankDate = formatDate(transaction.date);
                            
                            const bankDescription = transaction.description;
                            const statusStr = String(status);
                            const isIdentifiedStatus = statusStr === 'IDENTIFIED' || statusStr === 'RESOLVED' || statusStr === 'IDENTIFICADO' || statusStr === 'RESOLVIDO';
                            const rawIdentifiedName = isIdentifiedStatus ? (contributor?.name || contributor?.cleanedName) : null;
                            const identifiedName = (rawIdentifiedName && !isInvalidOrNumericName(rawIdentifiedName, bankDescription)) ? rawIdentifiedName : null;
                            const sourceInfo = resolveTransactionSource(transaction, { transaction, contributor, status, matchMethod });
                            const isManualTx = sourceInfo.isManual || transaction.source === 'manual' || transaction.isManual;

                            return (
                                <tr
                                    key={transaction.id}
                                    className={`group hover:bg-slate-50/80 transition-all 
                                        ${isSelected ? 'bg-blue-50/30' : ''} 
                                        ${confirmed ? 'bg-indigo-50/10 grayscale-[0.3]' : isManualTx ? 'bg-amber-50/40 dark:bg-amber-950/20 border-l-4 border-l-amber-500' : ''}`
                                    }
                                >
                                    <td className="px-4 py-2.5 text-center">
                                        <input type="checkbox" className="w-4 h-4 rounded-full" checked={isSelected} onChange={() => toggleSelection(transaction.id)} />
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                                        {hasRefDate ? (
                                            <div className="flex flex-col leading-tight">
                                                <span className="font-bold text-slate-800 dark:text-white" title={`Data de Referência (Competência): ${displayDate}`}>
                                                    {displayDate}
                                                </span>
                                                <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-normal mt-0.5" title={`Data no Banco: ${originalBankDate}`}>
                                                    <span className="text-[8.5px] uppercase font-semibold text-slate-400 mr-0.5">Banco:</span>
                                                    {originalBankDate}
                                                </span>
                                            </div>
                                        ) : (
                                            <span>{displayDate}</span>
                                        )}
                                    </td>
                                    <td className="px-1.5 py-2.5 text-center shrink-0">
                                        {isWhatsAppSent(transaction.id) ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    sendWhatsAppDirect({
                                                        contributorName: identifiedName || bankDescription,
                                                        phone: contributor?.phone || contributor?.mobile || contributor?.whatsapp || '',
                                                        amount: displayAmount,
                                                        contributionType: contributionType || 'Contribuição',
                                                        churchName: church?.name,
                                                        date: refDate || transaction.date,
                                                        transactionId: transaction.id
                                                    }, { contributors, churches, showToast });
                                                }}
                                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 hover:scale-115 transition-all cursor-pointer shadow-2xs mx-auto"
                                                title="WhatsApp ENVIADO (Clique para reenviar direto)"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                            </button>
                                        ) : (isIdentifiedStatus || confirmed) ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    sendWhatsAppDirect({
                                                        contributorName: identifiedName || bankDescription,
                                                        phone: contributor?.phone || contributor?.mobile || contributor?.whatsapp || '',
                                                        amount: displayAmount,
                                                        contributionType: contributionType || 'Contribuição',
                                                        churchName: church?.name,
                                                        date: refDate || transaction.date,
                                                        transactionId: transaction.id
                                                    }, { contributors, churches, showToast });
                                                }}
                                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-300 dark:border-amber-800/80 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-400 hover:scale-115 transition-all cursor-pointer shadow-2xs mx-auto"
                                                title="WhatsApp PENDENTE (Clique para disparar direto)"
                                            >
                                                <MessageCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                                            </button>
                                        ) : (
                                            <span className="text-slate-300 dark:text-slate-700 text-[10px] font-bold block text-center">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                {identifiedName ? <UserIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> : <BanknotesIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                                <span className={`text-xs font-bold uppercase truncate max-w-[200px] ${confirmed ? 'text-indigo-900/60 dark:text-white/60' : 'text-slate-800 dark:text-white'}`}>
                                                    {identifiedName || bankDescription}
                                                </span>
                                                {isManualTx && (
                                                    <span className="text-[8px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
                                                        Manual
                                                    </span>
                                                )}
                                            </div>
                                            {!isManualTx && identifiedName && bankDescription && identifiedName !== bankDescription && (
                                                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tight truncate max-w-[200px] mt-0.5">{bankDescription}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border ${
                                            sourceInfo.isManual
                                                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/60 shadow-2xs'
                                                : sourceInfo.isSms 
                                                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800' 
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                        }`}>
                                            {sourceInfo.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">{church?.name || '---'}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase italic">
                                            {resolvePaymentMethod(paymentMethod || transaction.paymentMethod, transaction.description)}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${isExpense ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                        {formatCurrency(displayAmount, language)}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {getStatusBadge(status, matchMethod, confirmed)}
                                            {status === 'IDENTIFICADO' && !confirmed && <MatchMethodIcon method={matchMethod} />}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {confirmed ? (
                                                canConfirmFinal ? (
                                                    <button 
                                                        onClick={() => toggleConfirmation([transaction.id], false)}
                                                        className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                                                        title="Remover Bloqueio"
                                                    >
                                                        <LockOpenIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                                                )
                                            ) : (
                                                canIdentify ? (
                                                    <button 
                                                        onClick={() => setBulkIdentificationTxs([transaction])}
                                                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                                            status === 'IDENTIFICADO'
                                                                ? 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                                                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                                                        }`}
                                                        title={status === 'IDENTIFICADO' ? "Corrigir Identificação" : "Identificar Lançamento"}
                                                    >
                                                        <PencilIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                                                )
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
});