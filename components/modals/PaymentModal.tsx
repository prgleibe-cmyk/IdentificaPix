import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePaymentController } from './payment/usePaymentController';
import { PaymentConfigPanel } from './payment/PaymentConfigPanel';
import { PaymentActionPanel } from './payment/PaymentActionPanel';

/**
 * 💳 PAYMENT MODAL (V2.1 - CLEANUP COMPLETE)
 * Orquestrador central do fluxo de upgrade e assinatura.
 * Removida qualquer referência a pacotes de IA para simplificar a experiência.
 */
export const PaymentModal: React.FC = () => {
    const controller = usePaymentController();
    const { systemSettings, user } = useAuth();

    if (!controller.isPaymentModalOpen) return null;

    // 🔗 HIERARCHY LOGIC: Secondary users don't pay
    const isSecondaryUser = controller.subscription.ownerId && controller.subscription.ownerId !== user?.id;

    if (isSecondaryUser) {
        return (
            <div className="glass-overlay animate-fade-in">
                <div className="relative w-full max-w-md bg-white dark:bg-[#0F172A] rounded-[2rem] shadow-2xl border border-white/10 overflow-hidden p-8 animate-scale-in text-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Conta Gerenciada</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                        Sua conta é vinculada a um administrador principal. 
                        A assinatura e os limites são gerenciados diretamente por ele.
                    </p>
                    <button 
                        onClick={controller.handleClose}
                        className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="relative w-full max-w-4xl bg-slate-50 dark:bg-[#0F172A] rounded-[2rem] shadow-2xl border border-white/10 overflow-hidden grid grid-cols-1 md:grid-cols-2 animate-scale-in max-h-[90vh]">
                
                {/* Coluna 1: Personalização e Estatísticas */}
                <PaymentConfigPanel 
                    subscription={controller.subscription}
                    usageStats={controller.usageStats}
                    numSlots={controller.numSlots}
                    setNumSlots={controller.setNumSlots}
                    step={controller.step}
                    pricePerExtra={systemSettings.pricePerExtra}
                />

                {/* Coluna 2: Checkout e Status */}
                <PaymentActionPanel 
                    step={controller.step}
                    paymentMethod={controller.paymentMethod}
                    setPaymentMethod={controller.setPaymentMethod}
                    calculateTotal={controller.calculateTotal}
                    paymentData={controller.paymentData}
                    isLoading={controller.isLoading}
                    handleCheckout={controller.handleCheckout}
                    handleClose={controller.handleClose}
                    cpfCnpj={controller.cpfCnpj}
                    setCpfCnpj={controller.setCpfCnpj}
                />

                {/* Camada Decorativa de Ruído Local para Visual Premium */}
                <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none mix-blend-overlay"></div>
            </div>
        </div>
    );
};