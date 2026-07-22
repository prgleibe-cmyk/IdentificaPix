import React from 'react';
import { ClockIcon, BoltIcon, CircleStackIcon } from '../../Icons';
import { ProgressBar, Counter } from './PaymentSharedComponents';
import { formatCurrency } from '../../../utils/formatters';

interface PaymentConfigPanelProps {
    subscription: any;
    usageStats: any;
    numSlots: number;
    setNumSlots: (v: number) => void;
    step: string;
    pricePerExtra: number;
}

export const PaymentConfigPanel: React.FC<PaymentConfigPanelProps> = ({
    subscription, usageStats, numSlots, setNumSlots, step, pricePerExtra
}) => (
    <div className="p-6 sm:p-8 flex flex-col h-full overflow-y-auto custom-scrollbar relative z-10 bg-white/50 dark:bg-slate-900/30">
        <div className="mb-6">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm relative group">
                <div className="flex justify-between items-end mb-3 relative z-10">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                        <ClockIcon className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Tempo Restante de Acesso</span>
                    </div>
                    <span className={`text-2xl font-black tabular-nums tracking-tight ${usageStats.days.left < 5 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                        {usageStats.days.left} <span className="text-xs font-medium text-slate-400 ml-0.5">dias</span>
                    </span>
                </div>
                <ProgressBar percent={usageStats.days.percent} colorClass={usageStats.days.left < 5 ? "bg-red-500" : "bg-emerald-500"} glowColor={usageStats.days.left < 5 ? "bg-red-400" : "bg-emerald-400"} />
            </div>
        </div>

        <div className="space-y-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
                <BoltIcon className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Personalizar</h3>
            </div>
            
            <Counter 
                value={numSlots} 
                setValue={setNumSlots} 
                label="Capacidade de Cadastros" 
                icon={CircleStackIcon} 
                subLabel={numSlots > 1 ? `+${formatCurrency(pricePerExtra * (numSlots - 1))}` : "Plano Base (Igreja + Banco)"} 
                disabled={step !== 'config'} 
            />
        </div>
    </div>
);