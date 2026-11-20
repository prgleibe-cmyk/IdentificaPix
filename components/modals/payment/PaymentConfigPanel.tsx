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
    usageStats, numSlots, setNumSlots, step, pricePerExtra
}) => (
    <div
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        className="p-4 sm:p-5 flex flex-col justify-between gap-4 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900"
    >
        <div className="space-y-4">
            <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <div className="flex justify-between items-end mb-2.5">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <ClockIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        <span className="text-xs font-semibold">Tempo Restante de Acesso</span>
                    </div>
                    <span className={`text-xl font-bold tabular-nums tracking-tight ${usageStats.days.left < 5 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                        {usageStats.days.left} <span className="text-xs font-medium text-slate-400 ml-0.5">dias</span>
                    </span>
                </div>
                <ProgressBar percent={usageStats.days.percent} colorClass={usageStats.days.left < 5 ? "bg-rose-500" : "bg-emerald-500"} glowColor={usageStats.days.left < 5 ? "bg-rose-400" : "bg-emerald-400"} />
            </div>

            <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                    <BoltIcon className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Personalizar Limites</h4>
                </div>
                
                <Counter 
                    value={numSlots} 
                    setValue={setNumSlots} 
                    label="Capacidade de Cadastros" 
                    icon={CircleStackIcon} 
                    subLabel={numSlots > 1 ? `+${formatCurrency(pricePerExtra * (numSlots - 1))}/mês` : "Plano Base (Igreja + Banco)"} 
                    disabled={step !== 'config'} 
                />
            </div>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800/80">
            Cada capacidade adicional amplia o limite de igrejas e contas bancárias sincronizadas na mesma assinatura.
        </p>
    </div>
);