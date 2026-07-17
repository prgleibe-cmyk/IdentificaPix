import React, { useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
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

    // ✅ PROTEÇÃO TOTAL contra undefined
    const safeResults = Array.isArray(results) ? results : [];

    const selectedData = useMemo(() => {
        return safeResults.filter((r: any) => selectedIds.includes(r.transaction?.id));
    }, [selectedIds, safeResults]);

    const totalAmount = useMemo(() => {
        return selectedData.reduce((acc: number, curr: any) => {
            const val = curr.status === 'PENDENTE' 
                ? (curr.contributorAmount || curr.contributor?.amount || 0)
                : (curr.transaction?.amount || 0);
            return acc + val;
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
            <div className="bg-brand-deep/95 text-white px-4 py-2 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10 flex items-center gap-3 backdrop-blur-xl ring-1 ring-white/10 max-w-[600px]">
                
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

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleBulkIdentify}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-full text-[8px] font-black uppercase tracking-widest transition-all border border-white/10"
                    >
                        <UserPlusIcon className="w-2.5 h-2.5" />
                        Identificar
                    </button>

                    {canConfirm && (
                        <button
                            onClick={handleBulkConfirm}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-full text-[8px] font-black uppercase tracking-widest transition-all border border-emerald-500/20"
                        >
                            <LockClosedIcon className="w-2.5 h-2.5" />
                            Confirmar Final
                        </button>
                    )}

                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-full text-[8px] font-black uppercase tracking-widest transition-all border border-rose-500/20"
                    >
                        <TrashIcon className="w-2.5 h-2.5" />
                        Excluir
                    </button>

                    <button
                        onClick={onClear}
                        className="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors ml-1"
                    >
                        <XMarkIcon className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
};