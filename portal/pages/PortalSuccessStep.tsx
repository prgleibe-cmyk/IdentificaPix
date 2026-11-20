import React from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { PortalRequestStatusCard } from '../components/PortalRequestStatusCard';
import { ContributorMockProfile, ContributionItemMock } from '../types/portal';
import { formatCurrencyBrl } from '../utils/portalFormatters';
import { Check, Info } from 'lucide-react';

interface PortalSuccessStepProps {
    churchId?: string;
    requestId?: string;
    contributor: ContributorMockProfile;
    items: ContributionItemMock[];
    totalAmount: number;
    referenceNumber: string;
    onReset: () => void;
}

export const PortalSuccessStep: React.FC<PortalSuccessStepProps> = ({
    churchId,
    requestId,
    contributor,
    items,
    totalAmount,
    referenceNumber,
    onReset
}) => {
    const selectedItems = items.filter(i => i.selected && i.amount > 0);

    return (
        <PortalCard className="text-center py-4">
            <div className="space-y-6">
                {/* Success Icon Badge */}
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                    <Check className="w-8 h-8 stroke-[2.5]" />
                </div>

                <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Intenção Registrada com Sucesso
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Obrigado por sua contribuição!
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Sua intenção de oferta foi gerada e vinculada ao seu perfil.
                    </p>
                </div>

                {/* Status card with live polling */}
                {requestId && (
                    <div className="max-w-md mx-auto text-left">
                        <PortalRequestStatusCard
                            requestId={requestId}
                            churchId={churchId}
                            referenceNumber={referenceNumber}
                            initialAmount={totalAmount}
                            initialStatus="pending"
                        />
                    </div>
                )}

                {/* Reference Number Box */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 max-w-sm mx-auto text-left space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Número de Referência
                        </span>
                        <span className="text-xs font-mono font-black text-brand-blue dark:text-blue-400">
                            {referenceNumber}
                        </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Contribuinte
                        </span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {contributor.name}
                        </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Valor Total
                        </span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrencyBrl(totalAmount)}
                        </span>
                    </div>
                </div>

                {/* Categories Summary */}
                <div className="max-w-sm mx-auto bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                        Itens da Oferta
                    </span>
                    <ul className="space-y-1">
                        {selectedItems.map((item) => (
                            <li key={item.id} className="flex justify-between text-xs text-slate-700 dark:text-slate-300">
                                <span>• {item.label}</span>
                                <span className="font-bold">{formatCurrencyBrl(item.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Status Notice */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs max-w-md mx-auto text-left">
                    <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                        <span>Registro de Intenção de Contribuição</span>
                    </p>
                    <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                        Sua solicitação foi gravada com sucesso no sistema oficial da igreja. O Motor de Conciliação irá vincular seu pagamento Pix à sua intenção automaticamente.
                    </p>
                </div>

                {/* Restart Wizard Action */}
                <div className="pt-2">
                    <PortalButton
                        variant="primary"
                        size="lg"
                        className="w-full max-w-xs mx-auto"
                        onClick={onReset}
                    >
                        Realizar Nova Contribuição
                    </PortalButton>
                </div>
            </div>
        </PortalCard>
    );
};
