import React, { useContext } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AppContext } from '../../contexts/AppContext';
import { LockClosedIcon, ArrowPathIcon, CreditCardIcon } from '../Icons';

export const ExpiredBlockOverlay: React.FC = () => {
    const { subscription, user, refreshSubscription } = useAuth();
    const context = useContext(AppContext);
    const openPaymentModal = context?.openPaymentModal;

    if (!subscription || (!subscription.isExpired && !subscription.isBlocked)) {
        return null;
    }

    const isSecondaryUser = (subscription.ownerId && subscription.ownerId !== user?.id) &&
        subscription.role !== 'owner' &&
        subscription.role !== 'admin' &&
        subscription.role !== 'principal';

    return (
        <div className="fixed inset-0 z-[90] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-fade-in overflow-y-auto">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl relative overflow-hidden my-auto animate-scale-in">
                {/* Background glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px] pointer-events-none -mr-20 -mt-20"></div>
                
                {/* Lock icon */}
                <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-3xl border border-red-500/30 flex items-center justify-center mx-auto mb-6 shadow-inner relative">
                    <div className="absolute inset-0 bg-red-500/10 rounded-3xl animate-ping opacity-30"></div>
                    <LockClosedIcon className="w-10 h-10 text-red-400 relative z-10" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    Plano Expirado
                </div>

                <h2 className="text-2xl font-black tracking-tight text-white mb-3">
                    Acesso Suspenso
                </h2>

                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                    {isSecondaryUser ? (
                        <>Sua conta está vinculada a um Administrador Principal. A assinatura do sistema expirou e aguarda a renovação pelo responsável.</>
                    ) : (
                        <>O período da sua assinatura do <strong>IgGestor</strong> terminou. Para continuar utilizando todos os recursos de gestão financeira da sua igreja, realize o pagamento da mensalidade.</>
                    )}
                </p>

                {!isSecondaryUser && (
                    <div className="space-y-3">
                        <button 
                            onClick={openPaymentModal}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black rounded-2xl shadow-xl shadow-orange-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <CreditCardIcon className="w-5 h-5" />
                            Pagar e Reativar Acesso
                        </button>
                    </div>
                )}

                <button 
                    onClick={() => refreshSubscription()}
                    className="mt-4 inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-[11px] font-medium transition-colors"
                >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    Verificar status de pagamento
                </button>

                <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[10px] text-slate-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Reativação automática instantânea após a confirmação.</span>
                </div>
            </div>
        </div>
    );
};
