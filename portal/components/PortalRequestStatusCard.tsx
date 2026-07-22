import React from 'react';
import { useContributionRequestPolling } from '../hooks/useContributionRequestPolling';
import { formatCurrencyBrl } from '../utils/portalFormatters';

interface PortalRequestStatusCardProps {
    requestId?: string;
    churchId?: string;
    referenceNumber?: string;
    initialStatus?: string;
    initialAmount?: number;
}

export const PortalRequestStatusCard: React.FC<PortalRequestStatusCardProps> = ({
    requestId,
    churchId,
    referenceNumber,
    initialStatus = 'pending',
    initialAmount
}) => {
    const { requestDetails } = useContributionRequestPolling(requestId, churchId);

    const currentStatus = requestDetails?.status || initialStatus;
    const amount = requestDetails?.amount ?? initialAmount ?? 0;
    const displayRef = referenceNumber || (requestId ? `REQ-${requestId.slice(0, 8).toUpperCase()}` : '—');

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return new Date().toLocaleDateString('pt-BR');
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    const formattedDate = formatDate(requestDetails?.updated_at || requestDetails?.created_at);

    if (!requestId) return null;

    if (currentStatus === 'confirmed') {
        return (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 space-y-3 transition-all duration-300 shadow-sm">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-black flex items-center justify-center text-base shadow">
                        ✓
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">
                            Status da Solicitação
                        </span>
                        <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                            Contribuição identificada com sucesso.
                        </h4>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-emerald-500/20 text-xs">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                            Valor Identificado
                        </span>
                        <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                            {formatCurrencyBrl(amount)}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                            Data de Confirmação
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                            {formattedDate}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                            Número da Solicitação
                        </span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            {displayRef}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 space-y-2.5 transition-all duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse block" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        Aguardando identificação da contribuição.
                    </span>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200">
                    PENDENTE
                </span>
            </div>

            <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Após realizar o Pix no aplicativo do seu banco, nosso sistema identificará automaticamente a sua contribuição. Esta tela atualizará assim que a transferência for reconhecida.
            </p>

            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-amber-500/20 text-xs font-medium text-amber-900/90 dark:text-amber-200/90">
                <span>Número da Solicitação: <strong className="font-mono">{displayRef}</strong></span>
                <span>Valor Esperado: <strong>{formatCurrencyBrl(amount)}</strong></span>
            </div>
        </div>
    );
};
