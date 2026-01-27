
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePaymentController } from './payment/usePaymentController';
import { PaymentConfigPanel } from './payment/PaymentConfigPanel';
import { PaymentActionPanel } from './payment/PaymentActionPanel';

/**
 * 💳 PAYMENT MODAL (V2 - REFACTORED)
 * Orquestrador central do fluxo de upgrade e assinatura.
 * Dividido em módulos menores para manutenção e performance.
 */
export const PaymentModal: React.FC = () => {
    const controller = usePaymentController();
    const { systemSettings } = useAuth();

    if (!controller.isPaymentModalOpen) return null;

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="relative w-full max-w-4xl bg-slate-50 dark:bg-[#0F172A] rounded-[2rem] shadow-2xl border border-white/10 overflow-hidden grid grid-cols-1 md:grid-cols-2 animate-scale-in max-h-[90vh]">
                
                {/* Coluna 1: Personalização e Estatísticas */}
                <PaymentConfigPanel 
                    subscription={controller.subscription}
                    usageStats={controller.usageStats}
                    numSlots={controller.numSlots}
                    setNumSlots={controller.setNumSlots}
                    aiPacks={controller.aiPacks}
                    setAiPacks={controller.setAiPacks}
                    step={controller.step}
                    pricePerExtra={systemSettings.pricePerExtra}
                    pricePerAiBlock={systemSettings.pricePerAiBlock}
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
                />

                {/* Camada Decorativa de Ruído Local para Visual Premium (Substituída URL Vercel) */}
                <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none mix-blend-overlay"></div>
            </div>
        </div>
    );
};
