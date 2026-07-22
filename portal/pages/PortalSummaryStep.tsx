import React from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { ContributorMockProfile, ContributionItemMock } from '../types/portal';
import { formatCurrencyBrl } from '../utils/portalFormatters';

interface PortalSummaryStepProps {
    contributor: ContributorMockProfile;
    items: ContributionItemMock[];
    totalAmount: number;
    referenceNumber: string;
    isSaving?: boolean;
    apiError?: string | null;
    onBack: () => void;
    onContinue: () => void;
}

export const PortalSummaryStep: React.FC<PortalSummaryStepProps> = ({
    contributor,
    items,
    totalAmount,
    referenceNumber,
    isSaving = false,
    apiError = null,
    onBack,
    onContinue
}) => {
    const selectedItems = items.filter(i => i.selected && i.amount > 0);

    return (
        <PortalCard
            title="Resumo da Intenção de Contribuição"
            subtitle="Confira as informações antes de gerar a chave Pix para pagamento."
        >
            <div className="space-y-6">
                {/* Reference Number Badge */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 text-white dark:bg-slate-800 dark:border dark:border-slate-700">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                            Número de Referência (ID da Intenção)
                        </span>
                        <span className="text-base font-black font-mono tracking-wider text-blue-400">
                            {referenceNumber}
                        </span>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-400/30">
                        Intenção Criada
                    </span>
                </div>

                {/* Contributor Profile Info */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Dados do Contribuinte
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-sm font-bold text-slate-800 dark:text-white">
                            {contributor.name}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {contributor.congregation}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>🪪 CPF: {contributor.cpf}</span>
                        <span>📱 {contributor.phone}</span>
                    </div>
                </div>

                {/* Contribution Breakdown */}
                <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Detalhamento dos Valores
                    </span>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                        {selectedItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3">
                                <div>
                                    <span className="text-xs font-bold text-slate-800 dark:text-white block">
                                        {item.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {item.description}
                                    </span>
                                </div>
                                <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                                    {formatCurrencyBrl(item.amount)}
                                </span>
                            </div>
                        ))}
                        
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Total Geral
                            </span>
                            <span className="text-xl font-black text-brand-blue dark:text-blue-400">
                                {formatCurrencyBrl(totalAmount)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {apiError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
                        ⚠️ {apiError}
                    </div>
                )}

                {/* Navigation */}
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
                        className="flex-1"
                        onClick={onContinue}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Registrando Intenção...' : 'Gerar Pagamento Pix →'}
                    </PortalButton>
                </div>
            </div>
        </PortalCard>
    );
};
