
import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { QrCodeIcon, ClipboardDocumentIcon, XMarkIcon, CheckBadgeIcon, UserIcon, BuildingOfficeIcon, SparklesIcon, ClockIcon } from '../Icons';
import { useUI } from '../../contexts/UIContext';
import { formatCurrency } from '../../utils/formatters';
import { paymentService, PaymentResponse } from '../../services/paymentService';

export const PaymentModal: React.FC = () => {
    const { isPaymentModalOpen, closePaymentModal } = useContext(AppContext);
    const { registerPayment, updateLimits, systemSettings, subscription, user } = useAuth();
    const { showToast } = useUI();
    
    // States
    const [step, setStep] = useState<'config' | 'payment' | 'success'>('config');
    const [isLoading, setIsLoading] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
    const pollingInterval = useRef<any>(null);

    // Plan Calculator State
    const [numChurches, setNumChurches] = useState(1);
    const [numBanks, setNumBanks] = useState(1);
    const [aiPacks, setAiPacks] = useState(0); 

    // Dynamic Settings
    const BASE_PRICE = subscription.customPrice ?? systemSettings.monthlyPrice ?? 79.90;
    const PRICE_PER_CHURCH = systemSettings.pricePerChurch || 14.90;
    const PRICE_PER_BANK = systemSettings.pricePerBank || 29.90;
    const PRICE_PER_AI_BLOCK = systemSettings.pricePerAiBlock || 15.00;

    // Calculation Logic
    const calculateTotal = useMemo(() => {
        const extraChurches = Math.max(0, numChurches - 1);
        const extraBanks = Math.max(0, numBanks - 1);
        const aiCost = aiPacks * PRICE_PER_AI_BLOCK;
        
        return BASE_PRICE + (extraChurches * PRICE_PER_CHURCH) + (extraBanks * PRICE_PER_BANK) + aiCost;
    }, [BASE_PRICE, PRICE_PER_CHURCH, PRICE_PER_BANK, PRICE_PER_AI_BLOCK, numChurches, numBanks, aiPacks]);

    // Cleanup polling on unmount or close
    useEffect(() => {
        return () => {
            if (pollingInterval.current) clearInterval(pollingInterval.current);
        };
    }, []);

    if (!isPaymentModalOpen) return null;

    const handleGeneratePix = async () => {
        setIsLoading(true);
        try {
            const aiLimitToAdd = aiPacks * 1000;
            const description = `IdentificaPix - Plano: ${numChurches} Igrejas, ${numBanks} Bancos, +${aiLimitToAdd} AI`;
            const customerName = user?.user_metadata?.full_name || user?.email || 'Cliente';

            const data = await paymentService.createPixPayment(calculateTotal, customerName, description);
            setPaymentData(data);
            setStep('payment');
            
            // Start Polling
            startPolling(data.id);

        } catch (error) {
            console.error(error);
            showToast("Erro ao gerar Pix. Tente novamente.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const startPolling = (paymentId: string) => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);

        pollingInterval.current = setInterval(async () => {
            try {
                const status = await paymentService.checkPaymentStatus(paymentId);
                
                if (status === 'RECEIVED') {
                    handlePaymentSuccess();
                }
            } catch (e) {
                console.error("Erro ao verificar status", e);
            }
        }, 3000); // Check every 3 seconds
    };

    const handlePaymentSuccess = async () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        
        setIsLoading(true);
        try {
            const aiLimitToAdd = aiPacks * 1000;
            const description = `Plano Automático: ${numChurches} Igrejas, ${numBanks} Bancos, +${aiLimitToAdd} AI`;

            // Register in DB
            await registerPayment(
                calculateTotal, 
                'PIX_AUTO', 
                description,
                null // No receipt file needed for automated payments
            );

            // Update Limits
            await updateLimits(numChurches, numBanks, aiPacks);
            
            setStep('success');
            showToast("Pagamento confirmado! Acesso liberado.", "success");
            
            // Auto close after success
            setTimeout(() => {
                handleClose();
            }, 4000);

        } catch (e) {
            console.error(e);
            showToast("Erro ao finalizar liberação. Contate o suporte.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyCode = () => {
        if (paymentData?.pixCopiaECola) {
            navigator.clipboard.writeText(paymentData.pixCopiaECola);
            showToast("Código Pix copiado!", "success");
        }
    };

    const handleClose = () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        setStep('config');
        setPaymentData(null);
        setIsLoading(false);
        closePaymentModal();
    };

    const Counter = ({ value, setValue, label, icon: Icon, subLabel, step = 1 }: any) => (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-indigo-600 dark:text-indigo-400">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{label}</span>
                    <span className="text-[10px] text-slate-400">{subLabel}</span>
                </div>
            </div>
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-600 shadow-sm">
                <button 
                    onClick={() => setValue(Math.max(step === 1 ? 1 : 0, value - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                >
                    -
                </button>
                <span className="w-4 text-center font-bold text-slate-800 dark:text-white text-sm">{value}</span>
                <button 
                    onClick={() => setValue(value + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                    +
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center relative flex-shrink-0">
                    <button 
                        type="button"
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20 cursor-pointer"
                    >
                        <XMarkIcon className="w-5 h-5 text-white" />
                    </button>
                    <h2 className="text-2xl font-black tracking-tight mb-0.5 drop-shadow-sm">Renovar Assinatura</h2>
                    <p className="text-blue-100 text-xs font-medium opacity-90 tracking-wide">
                        {step === 'config' ? 'Configure seu plano ideal' : step === 'payment' ? 'Efetue o pagamento' : 'Tudo pronto!'}
                    </p>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {step === 'config' && (
                        <div className="animate-fade-in">
                            <div className="space-y-3 mb-6">
                                <Counter 
                                    value={numChurches} 
                                    setValue={setNumChurches} 
                                    label="Igrejas / Filiais" 
                                    icon={UserIcon} 
                                    subLabel={numChurches > 1 ? `+${formatCurrency(PRICE_PER_CHURCH * (numChurches - 1))}` : "Incluído no base"}
                                />
                                <Counter 
                                    value={numBanks} 
                                    setValue={setNumBanks} 
                                    label="Bancos / Contas" 
                                    icon={BuildingOfficeIcon} 
                                    subLabel={numBanks > 1 ? `+${formatCurrency(PRICE_PER_BANK * (numBanks - 1))}` : "Incluído no base"}
                                />
                                <Counter 
                                    value={aiPacks} 
                                    setValue={setAiPacks}
                                    step={0}
                                    label="Pacote IA (+1000)" 
                                    icon={SparklesIcon} 
                                    subLabel={aiPacks > 0 ? `+${formatCurrency(PRICE_PER_AI_BLOCK * aiPacks)}` : "100 análises incluídas"}
                                />
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 mb-6 text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Mensal</p>
                                <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter block">
                                    {formatCurrency(calculateTotal)}
                                </span>
                                {subscription.customPrice !== null && (
                                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded mt-2 inline-block">
                                        Preço Base Personalizado
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleGeneratePix}
                                disabled={isLoading}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all transform active:scale-[0.98] text-sm uppercase tracking-wide flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <>
                                        <QrCodeIcon className="w-5 h-5" />
                                        Gerar PIX e Pagar
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {step === 'payment' && paymentData && (
                        <div className="flex flex-col items-center animate-fade-in text-center">
                            <div className="mb-4">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total a Pagar</p>
                                <p className="text-3xl font-black text-slate-800 dark:text-white">{formatCurrency(paymentData.value)}</p>
                            </div>

                            <div className="p-4 bg-white rounded-2xl shadow-xl shadow-indigo-500/10 border-2 border-indigo-100 dark:border-slate-600 mb-6">
                                <img 
                                    src={paymentData.qrCodeImage} 
                                    alt="QR Code Pix" 
                                    className="w-48 h-48 mix-blend-multiply dark:mix-blend-normal" 
                                />
                            </div>

                            <div className="w-full mb-6">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 text-left ml-1">Pix Copia e Cola</label>
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-300 truncate flex-1 font-mono border border-slate-200 dark:border-slate-600">
                                        {paymentData.pixCopiaECola}
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={handleCopyCode}
                                        className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors shadow-sm flex-shrink-0"
                                        title="Copiar Código"
                                    >
                                        <ClipboardDocumentIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-full animate-pulse">
                                <ClockIcon className="w-4 h-4" />
                                <span className="text-xs font-bold">Aguardando pagamento...</span>
                            </div>
                            
                            <p className="text-[10px] text-slate-400 mt-4 max-w-xs mx-auto">
                                A confirmação é automática. Assim que você pagar no seu banco, esta tela atualizará em alguns segundos.
                            </p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-8 animate-fade-in-up">
                            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce-slow">
                                <CheckBadgeIcon className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">Pagamento Confirmado!</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-lg mb-6">Sua assinatura foi renovada e seus limites foram atualizados instantaneamente.</p>
                            <button 
                                onClick={handleClose}
                                className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg"
                            >
                                Voltar ao App
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
