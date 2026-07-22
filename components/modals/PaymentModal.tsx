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
            <div className="glass-overlay animate-fade-in">
                <div className="glass-modal animate-scale-in flex flex-col justify-center items-center text-center p-8">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Conta Gerenciada</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
                        Sua conta é vinculada a um administrador principal. 
                        A assinatura e os limites são gerenciados diretamente por ele.
                    </p>
                    <button 
                        onClick={controller.handleClose}
                        className="px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in flex flex-col h-full w-full">
                
                {/* Cabeçalho Unificado da Tela */}
                <div className="px-6 sm:px-8 py-5 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                            <CreditCardIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    Plano e Assinatura
                                </h3>
                                <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide flex items-center gap-1.5 ${
                                    controller.subscription.isExpired 
                                        ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40' 
                                        : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${controller.subscription.isExpired ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                    {controller.subscription.isExpired ? 'Expirado' : 'Ativo'}
                                </div>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                Gerenciamento de Assinatura e Limites
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={controller.handleClose} 
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                        title="Fechar (Esc)"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Conteúdo Principal em 2 Colunas no Desktop */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-y-auto custom-scrollbar">
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
                </div>

                {/* Camada Decorativa de Ruído Local para Visual Premium */}
                <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none mix-blend-overlay"></div>
            </div>
        </div>
    );
};