
import { useState, useMemo, useEffect, useRef, useContext } from 'react';
// Fix: Corrected import path to point to contexts/AppContext
import { AppContext } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useUI } from '../../../contexts/UIContext';
import { paymentService, PaymentResponse } from '../../../services/paymentService';

export type PaymentStep = 'config' | 'payment' | 'success';
export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO';

export const usePaymentController = () => {
    // Fix: Explicitly casting useContext(AppContext) to any to resolve "Property does not exist on type '{}'" error
    const { isPaymentModalOpen, closePaymentModal, banks, churches } = useContext(AppContext) as any;
    const { registerPayment, updateLimits, systemSettings, subscription, user } = useAuth();
    const { showToast } = useUI();
    
    const [step, setStep] = useState<PaymentStep>('config');
    const [isLoading, setIsLoading] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
    const [numSlots, setNumSlots] = useState(1);
    const [aiPacks, setAiPacks] = useState(0); 
    const pollingInterval = useRef<any>(null);

    useEffect(() => {
        if (isPaymentModalOpen) {
            setNumSlots(Math.max(1, subscription.maxChurches || 1));
        }
    }, [isPaymentModalOpen, subscription.maxChurches]);

    const BASE_PRICE = subscription.customPrice ?? systemSettings.monthlyPrice ?? 79.90;
    const PRICE_PER_EXTRA = systemSettings.pricePerExtra || 19.90; 
    const PRICE_PER_AI_BLOCK = systemSettings.pricePerAiBlock || 15.00;

    const calculateTotal = useMemo(() => {
        const extraSlots = Math.max(0, numSlots - 1);
        const aiCost = aiPacks * PRICE_PER_AI_BLOCK;
        return BASE_PRICE + (extraSlots * PRICE_PER_EXTRA) + aiCost;
    }, [BASE_PRICE, PRICE_PER_EXTRA, PRICE_PER_AI_BLOCK, numSlots, aiPacks]);

    const usageStats = useMemo(() => {
        const totalDays = subscription.totalDays || 30;
        const daysLeft = subscription.daysRemaining || 0;
        const daysProgress = Math.min(100, Math.max(0, (daysLeft / totalDays) * 100));
        const aiLimit = subscription.aiLimit || 100;
        const aiUsed = subscription.aiUsage || 0;
        const aiProgress = Math.min(100, (aiUsed / aiLimit) * 100);
        const totalCapacity = (subscription.maxChurches || 1) + (subscription.maxBanks || 1);
        const totalUsed = banks.length + churches.length;
        const slotsProgress = totalCapacity > 0 ? Math.min(100, (totalUsed / totalCapacity) * 100) : 100;

        return {
            days: { left: daysLeft, total: totalDays, percent: daysProgress },
            ai: { used: aiUsed, total: aiLimit, percent: aiProgress },
            slots: { used: totalUsed, total: totalCapacity, percent: slotsProgress }
        };
    }, [subscription, banks.length, churches.length]);

    const handlePaymentSuccess = async () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        if (step === 'payment') setIsLoading(true);
        try {
            const aiLimitToAdd = aiPacks * 1000;
            const description = `Upgrade: ${numSlots} Slots, +${aiLimitToAdd} AI (${paymentMethod})`;
            await registerPayment(calculateTotal, paymentMethod, description);
            await updateLimits(numSlots, aiPacks);
            setStep('success');
            showToast("Pagamento confirmado! Acesso liberado.", "success");
            setTimeout(() => handleClose(), 4000);
        } catch (e) {
            showToast("Erro ao finalizar liberação. Contate o suporte.", "error");
        } finally { setIsLoading(false); }
    };

    const startPolling = (paymentId: string) => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        pollingInterval.current = setInterval(async () => {
            try {
                const status = await paymentService.checkPaymentStatus(paymentId);
                if (status === 'RECEIVED' || status === 'CONFIRMED') handlePaymentSuccess();
            } catch (e) { console.error(e); }
        }, 3000); 
    };

    const handleCheckout = async () => {
        setIsLoading(true);
        try {
            const description = `Plano: ${numSlots} Slots Unificados, +${aiPacks * 1000} AI`;
            const data = await paymentService.createPayment(
                calculateTotal, 
                user?.user_metadata?.full_name || user?.email || 'Cliente', 
                description, 
                paymentMethod, 
                user?.email,
                undefined,
                user?.id
            );
            setPaymentData(data);
            if (data.status === 'CONFIRMED') await handlePaymentSuccess();
            else {
                setStep('payment');
                if (paymentMethod !== 'CREDIT_CARD') startPolling(data.id);
            }
        } catch (error: any) {
            showToast(`Erro no Pagamento: ${error.message?.replace('Erro da API:', '').trim()}`, "error");
        } finally { setIsLoading(false); }
    };

    const handleClose = () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        setStep('config');
        setPaymentData(null);
        setPaymentMethod('PIX');
        setIsLoading(false);
        closePaymentModal();
    };

    return {
        step, setStep, isLoading, paymentData, paymentMethod, setPaymentMethod,
        numSlots, setNumSlots, aiPacks, setAiPacks, calculateTotal, usageStats,
        handleCheckout, handleClose, isPaymentModalOpen, subscription
    };
};
