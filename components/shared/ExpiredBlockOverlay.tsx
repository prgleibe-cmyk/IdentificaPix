import React, { useContext } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AppContext } from '../../contexts/AppContext';
import { LockClosedIcon, ArrowPathIcon, CreditCardIcon } from '../Icons';

export const ExpiredBlockOverlay: React.FC = () => {
    const { subscription, user, refreshSubscription, isSecondaryUser } = useAuth();
    const context = useContext(AppContext);
    const openPaymentModal = context?.openPaymentModal;

    const userEmail = String(user?.email || '').toLowerCase().trim();
    const isPlatformAdmin = userEmail === 'identificapix@gmail.com' || 
                            user?.role === 'superadmin' || 
                            user?.role === 'super_admin' || 
                            user?.role === 'admin' || 
                            subscription?.role === 'admin';

    if (isPlatformAdmin || !subscription || (!subscription.isExpired && !subscription.isBlocked)) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[90] bg-slate-900/55 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in overflow-y-auto">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-6 sm:p-8 text-center text-slate-900 dark:text-white shadow-elevated relative overflow-hidden my-auto animate-scale-in">
                
                {/* Lock icon */}
                <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200/80 dark:border-rose-900/50 flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
                    <LockClosedIcon className="w-7 h-7" />
                </div>

                <div className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold mb-3">
                    Plano Expirado
                </div>

                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                    Acesso Suspenso
                </h2>

                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                    {isSecondaryUser ? (
                        <>Sua conta está vinculada a um Administrador Principal. A assinatura do sistema expirou e aguarda a renovação pelo responsável.</>
                    ) : (
                        <>O período da sua assinatura do <strong className="text-slate-900 dark:text-white font-semibold">IgGestor</strong> terminou. Para continuar utilizando todos os recursos de gestão financeira da sua igreja, realize o pagamento da mensalidade.</>
                    )}
                </p>

                {!isSecondaryUser && (
                    <div className="space-y-3">
                        <button 
                            type="button"
                            onClick={openPaymentModal}
                            className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-semibold rounded-lg shadow-xs active:scale-[0.99] transition-all text-sm flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                        >
                            <CreditCardIcon className="w-4 h-4" />
                            Pagar e Reativar Acesso
                        </button>
                    </div>
                )}

                <button 
                    type="button"
                    onClick={() => refreshSubscription()}
                    className="mt-4 inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    Verificar status de pagamento
                </button>

                <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                    <span>Reativação automática instantânea após a confirmação.</span>
                </div>
            </div>
        </div>
    );
};
