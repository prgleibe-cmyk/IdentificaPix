import React, { useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { UserPlusIcon, XMarkIcon, LockClosedIcon, TrashIcon } from './Icons';
import { formatCurrency, isPeriodClosed } from '../utils/formatters';

interface BulkActionToolbarProps {
    selectedIds: string[];
    results: any[];
    onClear: () => void;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({ selectedIds, results, onClear }) => {
    const { setBulkIdentificationTxs, toggleConfirmation, openDeleteConfirmation } = useContext(AppContext);
    const { language } = useTranslation();
    const { subscription, user, isSecondaryUser } = useAuth();

    const perms = (subscription?.permissions || {}) as any;
    const canConfirmFinal = !isSecondaryUser || (perms.confirmar_final !== false && perms.confirmFinal !== false);
    const canIdentify = !isSecondaryUser || (perms.identificar !== false && perms.identifyPayments !== false);

    // ✅ PROTEÇÃO TOTAL contra undefined
    const safeResults = Array.isArray(results) ? results : [];

    const selectedData = useMemo(() => {
        const idSet = new Set((selectedIds || []).map(id => String(id)));
        return safeResults.filter((r: any) => {
            if (!r) return false;
            const txId = String(r.transaction?.id ?? r.transaction_id ?? r.transactionId ?? r.id ?? '');
            const rId = String(r.id ?? '');
            return idSet.has(txId) || idSet.has(rId);
        });
    }, [selectedIds, safeResults]);

    const totalAmount = useMemo(() => {
        return selectedData.reduce((acc: number, curr: any) => {
            const rawVal = 
                curr.transaction?.amount ?? 
                curr.amount ?? 
                curr.contributorAmount ?? 
                curr.contributor?.amount ?? 
                0;
            const parsedVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(',', '.')) || 0;
            return acc + Math.abs(parsedVal);
        }, 0);
    }, [selectedData]);

    if (!selectedIds || selectedIds.length === 0) return null;

    const isItemInClosedPeriod = (r: any): boolean => {
        const cId = r.church?.id || r._churchId || r.transaction?.church_id || r.church_id;
        const bId = r.transaction?.bank_id || r.bankId || null;
        const dt = r.contributor?.reference_date || r.reference_date || r.transaction?.reference_date || r.transaction?.date || r.date;
        return Boolean(cId && dt && isPeriodClosed(dt, undefined, cId, bId));
    };

    const isItemConfirmed = (r: any): boolean => Boolean(r.transaction?.isConfirmed ?? r.isConfirmed ?? false);

    const unlockedSelected = selectedData.filter((r: any) => !isItemConfirmed(r) && !isItemInClosedPeriod(r));
    const hasAnyLockedRow = selectedData.some((r: any) => isItemConfirmed(r) || isItemInClosedPeriod(r));

    const handleBulkIdentify = () => {
        const txsToProcess = unlockedSelected
            .map((r: any) => r.transaction)
            .filter(Boolean);

        if (txsToProcess.length > 0) {
            setBulkIdentificationTxs(txsToProcess);
        }
    };

    const handleBulkConfirm = async () => {
        const confirmableIds = unlockedSelected
            .map((r: any) => String(r.transaction?.id ?? r.transaction_id ?? r.transactionId ?? r.id ?? ''))
            .filter(Boolean);
        if (confirmableIds.length === 0) return;
        await toggleConfirmation(confirmableIds, true);
        onClear();
    };

    const handleBulkDelete = () => {
        if (hasAnyLockedRow) return;
        openDeleteConfirmation({
            type: 'report-row-bulk',
            id: 'report-row-bulk',
            name: `${selectedIds.length} transações`,
            meta: { ids: selectedIds }
        });
    };

    const canConfirm = unlockedSelected.length > 0;

    const hasBankTransactions = selectedData.some((r: any) => {
        const isManual = r.isManual || 
            r.transaction?.source === 'manual' || 
            r.transaction?.isManual === true || 
            String(r.transaction?.id ?? r.id ?? '').startsWith('ghost-manual-') || 
            (r.transaction?.row_hash && r.transaction?.row_hash.includes('|bmanual|'));
        return !isManual;
    });
    const canBulkDelete = (!isSecondaryUser || !hasBankTransactions) && !hasAnyLockedRow;

    return (
        <div
            role="region"
            aria-label="Ações para registros selecionados"
            className="sticky top-0 z-30 w-full shrink-0 bg-orange-50/95 dark:bg-orange-950/35 backdrop-blur-sm border-b border-orange-200/90 dark:border-orange-900/60 px-3 sm:px-4 py-2 animate-fade-in"
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center justify-between gap-2.5 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 min-w-0">
                        <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-orange-600 text-white text-xs font-bold tabular-nums shadow-xs shrink-0">
                            {selectedIds.length}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {selectedIds.length === 1 ? 'registro selecionado' : 'registros selecionados'}
                        </span>
                        <span className="h-3.5 w-px bg-orange-200/90 dark:bg-orange-800/70 shrink-0" aria-hidden="true" />
                        <div className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Soma:
                            </span>
                            <span className="text-xs sm:text-sm font-bold tabular-nums text-orange-700 dark:text-orange-300">
                                {formatCurrency(totalAmount, language)}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClear}
                        title="Limpar seleção"
                        aria-label="Limpar seleção"
                        className="sm:hidden w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-orange-100/80 dark:hover:bg-orange-900/40 transition-colors cursor-pointer shrink-0"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2 w-full sm:w-auto sm:ml-auto">
                    {canIdentify && unlockedSelected.length > 0 && (
                        <button
                            type="button"
                            onClick={handleBulkIdentify}
                            title="Identificar contribuinte, igreja e categoria dos selecionados"
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                        >
                            <UserPlusIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>Identificar</span>
                        </button>
                    )}

                    {canConfirm && canConfirmFinal && (
                        <button
                            type="button"
                            onClick={handleBulkConfirm}
                            title="Confirmar e travar os lançamentos selecionados como conferidos"
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200/90 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                        >
                            <LockClosedIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="truncate">Confirmar Final</span>
                        </button>
                    )}

                    {canBulkDelete && (
                        <button
                            type="button"
                            onClick={handleBulkDelete}
                            title="Excluir os lançamentos selecionados"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/90 dark:border-rose-900/60 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                        >
                            <TrashIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>Excluir</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onClear}
                        title="Limpar seleção"
                        aria-label="Limpar seleção"
                        className="hidden sm:inline-flex w-7 h-7 rounded-lg items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-orange-100/80 dark:hover:bg-orange-900/40 transition-colors ml-0.5 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};