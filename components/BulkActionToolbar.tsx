
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { UserPlusIcon, XMarkIcon, CheckBadgeIcon, BoltIcon } from './Icons';
import { formatCurrency } from '../utils/formatters';

interface BulkActionToolbarProps {
    selectedIds: string[];
    onClear: () => void;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({ selectedIds, onClear }) => {
    const { matchResults, setBulkIdentificationTxs, setManualIdentificationTx, openAutoLaunch } = useContext(AppContext);
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
        const txsToProcess = selectedData.map((r: any) => r.transaction);
        setBulkIdentificationTxs(txsToProcess);
        setManualIdentificationTx(null);
    };

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-up">
            <div className="bg-[#051024] text-white px-6 py-4 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(59,130,246,0.2)] border border-white/10 flex items-center gap-6 backdrop-blur-xl ring-1 ring-white/20">
                
                <div className="flex items-center gap-6 border-r border-white/10 pr-6">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest opacity-80">Itens</span>
                        <span className="text-xl font-black tabular-nums leading-none">{selectedIds.length}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest opacity-80">Total</span>
                        <span className="text-xl font-black tabular-nums text-emerald-400 leading-none">
                            {formatCurrency(totalAmount, language)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBulkIdentify}
                        className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                    >
                        <UserPlusIcon className="w-3.5 h-3.5" />
                        Identificar
                    </button>

                    <button
                        onClick={() => openAutoLaunch(selectedData)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-1 active:scale-95"
                    >
                        <BoltIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                        Lançamento IA
                    </button>

                    <button
                        onClick={onClear}
                        className="p-2.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
