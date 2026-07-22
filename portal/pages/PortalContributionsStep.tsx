import React, { useState } from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { ContributionItemMock } from '../types/portal';
import { formatCurrencyBrl } from '../utils/portalFormatters';

interface PortalContributionsStepProps {
    items: ContributionItemMock[];
    onToggleItem: (id: string) => void;
    onSetAmount: (id: string, amount: number) => void;
    totalAmount: number;
    onBack: () => void;
    onContinue: () => void;
}

export const PortalContributionsStep: React.FC<PortalContributionsStepProps> = ({
    items,
    onToggleItem,
    onSetAmount,
    totalAmount,
    onBack,
    onContinue
}) => {
    const [error, setError] = useState<string | null>(null);

    const handleNext = () => {
        const hasSelected = items.some(i => i.selected && i.amount > 0);
        if (!hasSelected || totalAmount <= 0) {
            setError('Selecione ao menos uma contribuição e informe um valor maior que zero.');
            return;
        }

        setError(null);
        onContinue();
    };

    return (
        <PortalCard
            title="Escolha as Contribuições"
            subtitle="Selecione os tipos de oferta que deseja realizar e informe os valores desejados."
        >
            <div className="space-y-6">
                {/* Checkbox Category Grid */}
                <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Categorias Disponíveis
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => { onToggleItem(item.id); setError(null); }}
                                className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                                    item.selected
                                        ? 'bg-blue-50/70 dark:bg-slate-800 border-brand-blue dark:border-blue-500 shadow-sm ring-1 ring-brand-blue/30'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={item.selected}
                                    onChange={() => {}} // Handled by div click
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue cursor-pointer"
                                />
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                                        {item.label}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Amount Inputs for Selected Items */}
                {items.some(i => i.selected) && (
                    <div className="space-y-3 pt-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Valores Individuais (R$)
                        </label>

                        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                            {items.filter(i => i.selected).map((item) => (
                                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700">
                                    <span className="text-sm font-bold text-slate-800 dark:text-white">
                                        {item.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400">R$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="5"
                                            value={item.amount || ''}
                                            onChange={(e) => {
                                                onSetAmount(item.id, parseFloat(e.target.value) || 0);
                                                if (error) setError(null);
                                            }}
                                            placeholder="0,00"
                                            className="w-32 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-right font-black text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* Auto Total Calculation Bar */}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 px-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                    Total Geral
                                </span>
                                <span className="text-xl font-black text-brand-blue dark:text-blue-400">
                                    {formatCurrencyBrl(totalAmount)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center">
                        ⚠️ {error}
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <PortalButton
                        variant="outline"
                        size="md"
                        onClick={onBack}
                    >
                        &larr; Voltar
                    </PortalButton>
                    <PortalButton
                        variant="primary"
                        size="md"
                        className="flex-1"
                        onClick={handleNext}
                    >
                        Revisar Resumo &rarr;
                    </PortalButton>
                </div>
            </div>
        </PortalCard>
    );
};
