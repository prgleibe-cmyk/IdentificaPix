import React from 'react';
import { ClockIcon, SparklesIcon, BoltIcon, CircleStackIcon } from '../../Icons';
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
                        <span className="text-[10px] font-bold uppercase tracking-wider">Uso de IA</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                            {usageStats.ai.used}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase">Ilimitado</span>
                    </div>
                </div>
                <div className="h-1.5 w-full bg-emerald-500/20 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500 w-full opacity-50"></div>
                </div>
            </div>
        </div>

        <div className="space-y-4 mb-8">
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
            
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 flex gap-4 items-start shadow-sm">
                <div className="p-2 bg-white dark:bg-indigo-900/50 rounded-xl shadow-sm">
                    <SparklesIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-tight">Inteligência Inclusa</h4>
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-1 leading-relaxed">
                        Esqueça os tokens. Ao assinar, você tem acesso ao processamento por <strong>IA de forma ilimitada</strong> para todos os seus registros bancários.
                    </p>
                </div>
            </div>
        </div>
    </div>
);