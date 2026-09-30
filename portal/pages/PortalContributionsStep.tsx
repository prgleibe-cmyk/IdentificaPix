import React, { useState } from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { ContributionItemMock } from '../types/portal';
import { formatCurrencyBrl } from '../utils/portalFormatters';
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';

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
            setError('Selecione ao menos uma opção de contribuição e informe o valor desejado.');
            return;
        }

        setError(null);
        onContinue();
    };

    const handleQuickAdd = (itemId: string, currentAmount: number, delta: number) => {
        const newAmount = Math.max(0, (currentAmount || 0) + delta);
        onSetAmount(itemId, newAmount);
        if (error) setError(null);
    };

    return (
        <PortalCard
            title="Intenção de Contribuição"
            subtitle="Selecione as opções cadastradas no sistema que deseja ofertar e prossiga para receber a chave Pix oficial."
        >
            <div className="space-y-6">
                {/* Header Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/70 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700/80 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-blue/10 dark:bg-blue-500/20 text-brand-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                            Opções Cadastradas no Sistema
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Marque uma ou mais opções abaixo e informe o valor de cada uma. Ao prosseguir, você receberá a chave Pix e o QR Code oficial da igreja.
                        </p>
                    </div>
                </div>

                {/* Checkbox Category Grid */}
                <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Selecione as Opções de Contribuição
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => { onToggleItem(item.id); setError(null); }}
                                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-3.5 relative overflow-hidden ${
                                    item.selected
                                        ? 'bg-blue-50/80 dark:bg-slate-800 border-brand-blue dark:border-blue-500 shadow-md ring-2 ring-brand-blue/20 dark:ring-blue-500/30'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                                }`}
                            >
                                <div className="mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={item.selected}
                                        onChange={() => {}} // Handled by div click
                                        className="h-4 w-4 rounded-md border-slate-300 text-brand-blue focus:ring-brand-blue cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-sm font-black text-slate-800 dark:text-white">
                                            {item.label}
                                        </h4>
                                        {item.selected && (
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-blue/10 dark:bg-blue-500/20 text-brand-blue dark:text-blue-300">
                                                Selecionado
                                            </span>
                                        )}
                                    </div>
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
                            Informe os Valores (R$)
                        </label>

                        <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                            {items.filter(i => i.selected).map((item) => (
                                <div key={item.id} className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/80 shadow-xs space-y-2.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <span className="text-sm font-black text-slate-800 dark:text-white block">
                                                {item.label}
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                {item.description}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">R$</span>
                                            <input
                                                type="number"
                                                min="1"
                                                step="5"
                                                value={item.amount || ''}
                                                onChange={(e) => {
                                                    onSetAmount(item.id, parseFloat(e.target.value) || 0);
                                                    if (error) setError(null);
                                                }}
                                                placeholder="0,00"
                                                className="w-36 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-right font-black text-slate-800 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            />
                                        </div>
                                    </div>

                                    {/* Quick Amount Suggestion Chips */}
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-700/50">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                                            Adicionar:
                                        </span>
                                        {[20, 50, 100, 200].map((val) => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => handleQuickAdd(item.id, item.amount, val)}
                                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-brand-blue dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-colors cursor-pointer"
                                            >
                                                +{formatCurrencyBrl(val)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Auto Total Calculation Bar */}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 px-2">
                                <div>
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                                        Total da Intenção
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {items.filter(i => i.selected).length} opção(ões) selecionada(s)
                                    </span>
                                </div>
                                <span className="text-2xl font-black text-brand-blue dark:text-blue-400">
                                    {formatCurrencyBrl(totalAmount)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center">
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
                        className="flex-1 py-3 text-sm font-bold shadow-md bg-gradient-to-r from-brand-blue to-amber-500 hover:from-blue-600 hover:to-amber-600 cursor-pointer"
                        onClick={handleNext}
                    >
                        Prosseguir para Receber Chave Pix &rarr;
                    </PortalButton>
                </div>
            </div>
        </PortalCard>
    );
};

