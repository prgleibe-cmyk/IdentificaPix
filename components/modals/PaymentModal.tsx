import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePaymentController } from './payment/usePaymentController';
import { PaymentConfigPanel } from './payment/PaymentConfigPanel';
import { PaymentActionPanel } from './payment/PaymentActionPanel';
import { CreditCardIcon, XMarkIcon } from '../Icons';

/**
 * 💳 PAYMENT MODAL
 * Orquestrador central do fluxo de upgrade e assinatura em tela inteira (modelo padrão do app).
 */
export const PaymentModal: React.FC = () => {
    const controller = usePaymentController();
    const { systemSettings, user } = useAuth();

    if (!controller.isPaymentModalOpen) return null;

    // 🔗 HIERARCHY LOGIC: Secondary users don't pay (Principal Admin is NOT secondary)
    const isSecondaryUser = (controller.subscription.ownerId && controller.subscription.ownerId !== user?.id) &&
        controller.subscription.role !== 'owner' &&
        controller.subscription.role !== 'admin' &&
        controller.subscription.role !== 'principal';

    if (isSecondaryUser) {
        return (
            <div
                onClick={controller.handleClose}
                className="fixed inset-0 md:absolute md:inset-0 z-[56] flex items-center justify-center pt-16 md:pt-4 pb-3 md:pb-4 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-elevated animate-scale-in flex flex-col justify-center items-center text-center p-8 max-w-md w-full"
                >
                    <div className="w-12 h-12 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-xl flex items-center justify-center mx-auto mb-5 text-orange-600 dark:text-orange-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Conta Gerenciada</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-xs max-w-md mb-6 leading-relaxed">
                        Sua conta é vinculada a um administrador principal. 
                        A assinatura e os limites são gerenciados diretamente por ele.
                    </p>
                    <button 
                        onClick={controller.handleClose}
                        className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={controller.handleClose}
            className="fixed inset-0 md:absolute md:inset-0 z-[56] flex items-center justify-center pt-16 md:pt-4 pb-3 md:pb-4 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-elevated w-full max-w-3xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-2.5rem))] flex flex-col overflow-hidden animate-scale-in"
            >
                
                {/* Cabeçalho Unificado Compacto */}
                <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <CreditCardIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                    Plano e Assinatura
                                </h3>
                                <div className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border flex items-center gap-1.5 ${
                                    controller.subscription.isExpired 
                                        ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50' 
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${controller.subscription.isExpired ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                                    {controller.subscription.isExpired ? 'Expirado' : 'Ativo'}
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                Gerenciamento de Assinatura e Limites
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={controller.handleClose} 
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                        title="Fechar (Esc)"
                        aria-label="Fechar modal de assinatura"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo Principal em 2 Colunas Proporcionais */}
                <div
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                    className="flex-1 grid grid-cols-1 sm:grid-cols-2 overflow-y-auto custom-scrollbar"
                >
                    {/* Coluna 1: Personalização e Estatísticas */}
                    <PaymentConfigPanel 
                        subscription={controller.subscription}
                        usageStats={controller.usageStats}
                        numSlots={controller.numSlots}
                        setNumSlots={controller.setNumSlots}
                        step={controller.step}
                        pricePerExtra={systemSettings.pricePerExtra}
                    />

                    {/* Coluna 2: Resumo e Checkout */}
                    <PaymentActionPanel 
                        step={controller.step}
                        paymentMethod={controller.paymentMethod}
                        setPaymentMethod={controller.setPaymentMethod}
                        calculateTotal={controller.calculateTotal}
                        numSlots={controller.numSlots}
                        paymentData={controller.paymentData}
                        isLoading={controller.isLoading}
                        handleCheckout={controller.handleCheckout}
                        handleClose={controller.handleClose}
                        cpfCnpj={controller.cpfCnpj}
                        setCpfCnpj={controller.setCpfCnpj}
                    />
                </div>
            </div>
        </div>
    );
};