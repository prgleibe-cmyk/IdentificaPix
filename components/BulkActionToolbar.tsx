import React, { useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { UserPlusIcon, XMarkIcon, LockClosedIcon, TrashIcon } from './Icons';
import { formatCurrency } from '../utils/formatters';

interface BulkActionToolbarProps {
    selectedIds: string[];
    results: any[];
    onClear: () => void;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({ selectedIds, results, onClear }) => {
    const { setBulkIdentificationTxs, toggleConfirmation, openDeleteConfirmation } = useContext(AppContext);
    const { language } = useTranslation();
    const { subscription, user } = useAuth();

    const isSecondaryUser = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
        subscription?.role !== 'owner' &&
        subscription?.role !== 'admin' &&
        subscription?.role !== 'principal';

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

    const handleBulkIdentify = () => {
        const txsToProcess = selectedData
            .filter((r: any) => !(r.transaction?.isConfirmed ?? r.isConfirmed ?? false))
            .map((r: any) => r.transaction)
            .filter(Boolean);

        if (txsToProcess.length > 0) {
            setBulkIdentificationTxs(txsToProcess);
        }
    };

    const handleBulkConfirm = async () => {
        await toggleConfirmation(selectedIds, true);
        onClear();
    };

    const handleBulkDelete = () => {
        openDeleteConfirmation({
            type: 'report-row-bulk',
            id: 'report-row-bulk',
            name: `${selectedIds.length} transações`,
            meta: { ids: selectedIds }
        });
    };

    const canConfirm = selectedData.some((r: any) => !(r.transaction?.isConfirmed ?? r.isConfirmed ?? false));

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-up">
            <div className="bg-brand-deep/95 text-white px-4 py-2.5 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10 flex items-center gap-3 backdrop-blur-xl ring-1 ring-white/10 max-w-[720px]">
                
                <div className="flex items-center gap-3 border-r border-white/10 pr-3">
                    <div className="flex flex-col">
                        <span className="text-[7px] font-black text-brand-teal uppercase tracking-widest opacity-80 leading-none">Qtd</span>
                        <span className="text-sm font-black tabular-nums leading-tight">{selectedIds.length}</span>
                    </div>
                    <div className="flex flex-col min-w-[80px]">
                        <span className="text-[7px] font-black text-brand-blue uppercase tracking-widest opacity-80 leading-none">Soma</span>
                        <span className="text-sm font-black tabular-nums text-brand-blue leading-tight">
                            {formatCurrency(totalAmount, language)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    {canIdentify && (
                        <button
                            onClick={handleBulkIdentify}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border border-white/10 cursor-pointer"
                        >
                            <UserPlusIcon className="w-2.5 h-2.5" />
                            Identificar
                        </button>
                    )}

                    {canConfirm && canConfirmFinal && (
                        <button
                            onClick={handleBulkConfirm}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border border-indigo-500/20 cursor-pointer"
                        >
                            <LockClosedIcon className="w-2.5 h-2.5" />
                            Confirmar Final
                        </button>
                    )}

                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border border-rose-500/20 cursor-pointer"
                    >
                        <TrashIcon className="w-2.5 h-2.5" />
                        Excluir
                    </button>

                    <button
                        onClick={onClear}
                        className="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors ml-1 cursor-pointer"
                    >
                        <XMarkIcon className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
};