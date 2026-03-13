import React, { useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { UserPlusIcon, XMarkIcon, LockClosedIcon } from './Icons';
import { formatCurrency } from '../utils/formatters';

interface BulkActionToolbarProps {
    selectedIds: string[];
    onClear: () => void;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({ selectedIds, onClear }) => {
    const { matchResults, setBulkIdentificationTxs, setManualIdentificationTx, toggleConfirmation } = useContext(AppContext);
    const { language } = useTranslation();

    const selectedData = useMemo(() => {
        return matchResults.filter((r: any) => selectedIds.includes(r.transaction.id));
    }, [selectedIds, matchResults]);

    const totalAmount = useMemo(() => {
        return selectedData.reduce((acc: number, curr: any) => {
            const val = curr.status === 'PENDENTE' 
                ? (curr.contributorAmount || curr.contributor?.amount || 0)
                : curr.transaction.amount;
            return acc + val;
        }, 0);
    }, [selectedData]);

    if (selectedIds.length === 0) return null;

    const handleBulkIdentify = () => {
        const txsToProcess = selectedData.filter((r: any) => !r.isConfirmed).map((r: any) => r.transaction);
        if (txsToProcess.length === 0) return;
        setBulkIdentificationTxs(txsToProcess);
        setManualIdentificationTx(null);
    };

    const handleBulkConfirm = () => {
        toggleConfirmation(selectedIds, true);
        onClear();
    };

    const canConfirm = selectedData.some((r: any) => !r.isConfirmed);

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-up">
            <div className="bg-[#051024]/95 text-white px-4 py-2 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/10 flex items-center gap-3 backdrop-blur-xl ring-1 ring-white/10 max-w-[600px]">
                
                <div className="flex items-center gap-3 border-r border-white/10 pr-3">
                    <div className="flex flex-col">
                        <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest opacity-80 leading-none">Qtd</span>
                        <span className="text-sm font-black tabular-nums leading-tight">{selectedIds.length}</span>
                    </div>
                    <div className="flex flex-col min-w-[80px]">
                        <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest opacity-80 leading-none">Soma</span>
                        <span className="text-sm font-black tabular-nums text-emerald-400 leading-tight">
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