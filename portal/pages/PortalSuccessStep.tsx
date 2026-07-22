import React from 'react';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { PortalRequestStatusCard } from '../components/PortalRequestStatusCard';
import { ContributorMockProfile, ContributionItemMock } from '../types/portal';
import { formatCurrencyBrl } from '../utils/portalFormatters';

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
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 border-2 border-emerald-500/30 flex items-center justify-center font-black text-3xl animate-bounce">
                    ✓
                </div>

                <div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-block mb-2">
                        Intenção Registrada com Sucesso
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                        Obrigado por sua contribuição!
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">
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
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-brand-blue dark:text-blue-300 text-xs font-medium max-w-md mx-auto text-left">
                    <p className="font-bold">
                        ℹ️ Registro de Intenção de Contribuição:
                    </p>
                    <p className="mt-1">
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
