import React from 'react';
import { ClockIcon, SparklesIcon, BoltIcon, CircleStackIcon } from '../../Icons';
import { ProgressBar, Counter } from './PaymentSharedComponents';
import { formatCurrency } from '../../../utils/formatters';

interface PaymentConfigPanelProps {
    subscription: any;
    usageStats: any;
    numSlots: number;
    setNumSlots: (v: number) => void;
    aiPacks: number;
    setAiPacks: (v: number) => void;
    step: string;
    pricePerExtra: number;
    pricePerAiBlock: number;
}

export const PaymentConfigPanel: React.FC<PaymentConfigPanelProps> = ({
    subscription, usageStats, numSlots, setNumSlots, aiPacks, setAiPacks, step, pricePerExtra, pricePerAiBlock
}) => (
    <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar relative z-10 bg-white/50 dark:bg-slate-900/30">
        <div className="flex justify-between items-start mb-8">
            <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Meu Plano</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Gerencie seus limites e acesso.</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide flex items-center gap-1.5 ${subscription.isExpired ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${subscription.isExpired ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                {subscription.isExpired ? 'Expirado' : 'Ativo'}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative group">
                <div className="flex justify-between items-end mb-2 relative z-10">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                        <ClockIcon className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Tempo</span>
                    </div>
                    <span className={`text-xl font-black tabular-nums tracking-tight ${usageStats.days.left < 5 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                        {usageStats.days.left}<span className="text-xs font-medium text-slate-400 ml-0.5">dias</span>
                    </span>
                </div>
                <ProgressBar percent={usageStats.days.percent} colorClass={usageStats.days.left < 5 ? "bg-red-500" : "bg-emerald-500"} glowColor={usageStats.days.left < 5 ? "bg-red-400" : "bg-emerald-400"} />
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative group">
                <div className="flex justify-between items-end mb-2 relative z-10">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                        <SparklesIcon className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">IA</span>
                    </div>
                    <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                        {usageStats.ai.used}<span className="text-xs text-slate-400 font-medium">/{usageStats.ai.total}</span>
                    </span>
                </div>
                <ProgressBar percent={usageStats.ai.percent} colorClass="bg-blue-500" glowColor="bg-blue-400" />
            </div>
        </div>

        <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
                <BoltIcon className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Personalizar</h3>
            </div>
            <Counter value={numSlots} setValue={setNumSlots} label="Cadastros (Slots)" icon={CircleStackIcon} subLabel={numSlots > 1 ? `+${formatCurrency(pricePerExtra * (numSlots - 1))}` : "Plano Base"} disabled={step !== 'config'} />
            <Counter value={aiPacks} setValue={setAiPacks} stepVal={0} label="Pacote IA (+1000)" icon={SparklesIcon} subLabel={aiPacks > 0 ? `+${formatCurrency(pricePerAiBlock * aiPacks)}` : "Padrão"} disabled={step !== 'config'} />
        </div>
    </div>
);