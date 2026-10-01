import React, { useState } from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { ContributionItemMock, ChurchBankAccountPublic } from '../types/portal';
import { formatCurrencyBrl } from '../utils/portalFormatters';
import { Sparkles, Building2, Check, ArrowRight } from 'lucide-react';

interface PortalContributionsStepProps {
    items: ContributionItemMock[];
    onToggleItem: (id: string) => void;
    onSetAmount: (id: string, amount: number) => void;
    totalAmount: number;
    onBack: () => void;
    onContinue: () => void;
    bankAccounts?: ChurchBankAccountPublic[];
    selectedBankId?: string;
    onSelectBank?: (bankId: string) => void;
    isSaving?: boolean;
}

export const PortalContributionsStep: React.FC<PortalContributionsStepProps> = ({
    items,
    onToggleItem,
    onSetAmount,
    totalAmount,
    onBack,
    onContinue,
    bankAccounts,
    selectedBankId,
    onSelectBank,
    isSaving = false
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

    const activeAccount = bankAccounts?.find(b => b.id === selectedBankId) || (bankAccounts && bankAccounts.length > 0 ? bankAccounts[0] : null);

    return (
        <PortalCard
            title="Intenção de Contribuição"
            subtitle="Escolha a conta da igreja, marque as descrições cadastradas e informe os valores para gerar sua chave Pix oficial."
        >
            <div className="space-y-6">
                {/* Header Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/70 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700/80 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-blue/10 dark:bg-blue-500/20 text-brand-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                            Instruções para Contribuição
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {bankAccounts && bankAccounts.length > 1 ? 'Selecione primeiro a conta bancária da igreja. Em seguida, marque ' : 'Marque '} 
                            as opções de contribuição desejadas e digite o valor na frente do nome. Ao prosseguir, você receberá a chave Pix cadastrada para aquela conta.
                        </p>
                    </div>
                </div>

                {/* 1. SELETOR DE CONTA BANCÁRIA NO TOPO (QUANDO HÁ MAIS DE 1 CONTA) */}
                {bankAccounts && bankAccounts.length > 1 && (
                    <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                1. Escolha a Conta Bancária da Igreja
                            </label>
                            <span className="text-[10px] font-bold text-slate-400">
                                {bankAccounts.length} contas disponíveis
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {bankAccounts.map((acc) => {
                                const isSelected = selectedBankId === acc.id;
                                return (
                                    <button
                                        key={acc.id}
                                        type="button"
                                        onClick={() => {
                                            if (onSelectBank) onSelectBank(acc.id);
                                            setError(null);
                                        }}
                                        className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                                            isSelected
                                                ? 'bg-blue-50/90 dark:bg-blue-950/40 border-brand-blue dark:border-blue-500 ring-2 ring-brand-blue/30 shadow-xs'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                            isSelected ? 'bg-brand-blue text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                        }`}>
                                            <Building2 className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <p className="text-xs font-black text-slate-800 dark:text-white truncate">
                                                    {acc.name}
                                                </p>
                                                {isSelected && (
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-blue/10 dark:bg-blue-500/20 text-brand-blue dark:text-blue-300 shrink-0 flex items-center gap-1">
                                                        <Check className="w-2.5 h-2.5" /> Selecionada
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                {acc.account_name || 'Conta Corrente'}
                                                {acc.pix_key ? ` • Pix: ${acc.pix_key.slice(0, 14)}...` : ''}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* BANNER INFORMATIVO QUANDO HÁ APENAS 1 CONTA */}
                {bankAccounts && bankAccounts.length === 1 && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-blue/10 dark:bg-blue-500/20 text-brand-blue dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Conta Destino Selecionada
                            </p>
                            <p className="text-xs font-black text-slate-800 dark:text-white truncate">
                                {bankAccounts[0].name} {bankAccounts[0].account_name ? `• ${bankAccounts[0].account_name}` : ''}
                            </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                            Chave Pix Pronta
                        </span>
                    </div>
                )}

                {/* 2. LISTA DAS DESCRIÇÕES DE ENTRADAS CADASTRADAS PARA A CONTA */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            {bankAccounts && bankAccounts.length > 1 ? '2. Marque a Contribuição e Digite o Valor' : 'Selecione as Opções de Contribuição e Digite o Valor'}
                        </label>
                        {activeAccount && (
                            <span className="text-[10px] text-slate-400">
                                Opções para: <strong>{activeAccount.name}</strong>
                            </span>
                        )}
                    </div>

                    <div className="space-y-3">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className={`p-4 rounded-2xl border transition-all ${
                                    item.selected
                                        ? 'bg-blue-50/80 dark:bg-slate-800/90 border-brand-blue dark:border-blue-500 shadow-xs ring-1 ring-brand-blue/20'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div 
                                        onClick={() => { onToggleItem(item.id); setError(null); }}
                                        className="flex items-start gap-3 cursor-pointer select-none flex-1"
                                    >
                                        <div className="mt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={item.selected}
                                                onChange={() => {}} // Controlled by div click
                                                className="h-4 w-4 rounded-md border-slate-300 text-brand-blue focus:ring-brand-blue cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-black text-slate-800 dark:text-white">
                                                    {item.label}
                                                </h4>
                                                {item.selected && (
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-blue/10 dark:bg-blue-500/20 text-brand-blue dark:text-blue-300">
                                                        Marcado
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Campo na frente do nome para digitar o valor */}
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                        <span className="text-xs font-bold text-slate-400">R$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="5"
                                            value={item.amount > 0 ? item.amount : (item.selected ? '' : '')}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                onSetAmount(item.id, val);
                                                if (val > 0 && !item.selected) {
                                                    onToggleItem(item.id);
                                                }
                                                if (error) setError(null);
                                            }}
                                            placeholder="0,00"
                                            className={`w-36 px-3.5 py-2 rounded-xl border text-right font-black text-base focus:outline-none transition-all ${
                                                item.selected
                                                    ? 'bg-white dark:bg-slate-900 border-brand-blue text-slate-900 dark:text-white ring-2 ring-blue-500/20'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                            }`}
                                        />
                                    </div>
                                </div>

                                {/* Atalhos rápidos de acréscimo (+R$20, +R$50, +R$100, +R$200) */}
                                {item.selected && (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-2.5 mt-2.5 border-t border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                                            Adicionar rápido:
                                        </span>
                                        {[20, 50, 100, 200].map((val) => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => handleQuickAdd(item.id, item.amount, val)}
                                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-brand-blue dark:hover:bg-blue-900/40 dark:hover:text-blue-300 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                                            >
                                                +{formatCurrencyBrl(val)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. TOTALIZADOR EM TEMPO REAL */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                            Total da Contribuição
                        </span>
                        <span className="text-[11px] text-slate-400">
                            {items.filter(i => i.selected && i.amount > 0).length} categoria(s) informada(s)
                            {items.filter(i => i.selected && i.amount > 0).length > 1 ? ' • Rateio automático' : ''}
                        </span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-brand-blue dark:text-blue-400">
                        {formatCurrencyBrl(totalAmount)}
                    </span>
                </div>

                {error && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center">
                        ⚠️ {error}
                    </div>
                )}

                {/* BOTÕES DE NAVEGAÇÃO */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <PortalButton
                        variant="outline"
                        size="md"
                        onClick={onBack}
                        disabled={isSaving}
                    >
                        &larr; Voltar
                    </PortalButton>
                    <PortalButton
                        variant="primary"
                        size="md"
                        disabled={isSaving}
                        className="flex-1 py-3 text-sm font-bold shadow-md bg-gradient-to-r from-brand-blue to-amber-500 hover:from-blue-600 hover:to-amber-600 cursor-pointer"
                        onClick={handleNext}
                    >
                        {isSaving ? 'Gravando intenção...' : 'Prosseguir para Receber Chave Pix →'}
                    </PortalButton>
                </div>
            </div>
        </PortalCard>
    );
};

