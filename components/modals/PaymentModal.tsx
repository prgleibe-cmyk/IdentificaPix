
import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
    QrCodeIcon, ClipboardDocumentIcon, XMarkIcon, CheckBadgeIcon, 
    SparklesIcon, ClockIcon, CircleStackIcon, ChartBarIcon, 
    ShieldCheckIcon, BoltIcon, CreditCardIcon, BarcodeIcon,
    BanknotesIcon
} from '../Icons';
import { useUI } from '../../contexts/UIContext';
import { formatCurrency } from '../../utils/formatters';
import { paymentService, PaymentResponse } from '../../services/paymentService';

export const PaymentModal: React.FC = () => {
    const { isPaymentModalOpen, closePaymentModal, banks, churches } = useContext(AppContext);
    const { registerPayment, updateLimits, systemSettings, subscription, user } = useAuth();
    const { showToast } = useUI();
    
    // States
    const [step, setStep] = useState<'config' | 'payment' | 'success'>('config');
    const [isLoading, setIsLoading] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | 'BOLETO'>('PIX');
    const pollingInterval = useRef<any>(null);

    // Plan Calculator State - Unified Slots
    const [numSlots, setNumSlots] = useState(1);
    const [aiPacks, setAiPacks] = useState(0); 

    // Initialize state when modal opens
    useEffect(() => {
        if (isPaymentModalOpen) {
            setNumSlots(Math.max(1, subscription.maxChurches || 1));
        }
    }, [isPaymentModalOpen, subscription.maxChurches]);

    // Dynamic Settings
    const BASE_PRICE = subscription.customPrice ?? systemSettings.monthlyPrice ?? 79.90;
    const PRICE_PER_EXTRA = systemSettings.pricePerExtra || 19.90; 
    const PRICE_PER_AI_BLOCK = systemSettings.pricePerAiBlock || 15.00;

    // Calculation Logic
    const calculateTotal = useMemo(() => {
        const extraSlots = Math.max(0, numSlots - 1);
        const aiCost = aiPacks * PRICE_PER_AI_BLOCK;
        return BASE_PRICE + (extraSlots * PRICE_PER_EXTRA) + aiCost;
    }, [BASE_PRICE, PRICE_PER_EXTRA, PRICE_PER_AI_BLOCK, numSlots, aiPacks]);

    // Usage Statistics Logic
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

    // Cleanup polling
    useEffect(() => {
        return () => {
            if (pollingInterval.current) clearInterval(pollingInterval.current);
        };
    }, []);

    if (!isPaymentModalOpen) return null;

    const handleCheckout = async () => {
        setIsLoading(true);
        try {
            const aiLimitToAdd = aiPacks * 1000;
            const description = `Plano: ${numSlots} Slots Unificados, +${aiLimitToAdd} AI`;
            const customerName = user?.user_metadata?.full_name || user?.email || 'Cliente';
            const customerEmail = user?.email; // Get real email

            const data = await paymentService.createPayment(
                calculateTotal, 
                customerName, 
                description, 
                paymentMethod, 
                customerEmail,
                undefined,
                user?.id // Passando ID do usuário para vínculo no webhook
            );
            setPaymentData(data);
            
            if (data.status === 'CONFIRMED') {
                // Instant approval (Credit Card)
                await handlePaymentSuccess();
            } else {
                setStep('payment');
                // Poll for Pix/Boleto
                if (paymentMethod !== 'CREDIT_CARD') {
                    startPolling(data.id);
                }
            }

        } catch (error: any) {
            console.error(error);
            const msg = error.message || "Erro desconhecido";
            // Extrai mensagem limpa se possível
            const cleanMsg = msg.replace('Erro da API:', '').trim();
            showToast(`Erro no Pagamento: ${cleanMsg}`, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const startPolling = (paymentId: string) => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        pollingInterval.current = setInterval(async () => {
            try {
                const status = await paymentService.checkPaymentStatus(paymentId);
                if (status === 'RECEIVED' || status === 'CONFIRMED') {
                    handlePaymentSuccess();
                }
            } catch (e) {
                console.error("Erro ao verificar status", e);
            }
        }, 3000); 
    };

    const handlePaymentSuccess = async () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        // Only show loading if we are coming from a pending state
        if (step === 'payment') setIsLoading(true);
        
        try {
            const aiLimitToAdd = aiPacks * 1000;
            const description = `Upgrade: ${numSlots} Slots, +${aiLimitToAdd} AI (${paymentMethod})`;

            await registerPayment(calculateTotal, paymentMethod, description, null);
            await updateLimits(numSlots, aiPacks);
            
            setStep('success');
            showToast("Pagamento confirmado! Acesso liberado.", "success");
            setTimeout(() => { handleClose(); }, 4000);

        } catch (e) {
            console.error(e);
            showToast("Erro ao finalizar liberação. Contate o suporte.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text: string) => {
        if (text) {
            navigator.clipboard.writeText(text);
            showToast("Copiado com sucesso!", "success");
        }
    };

    const handleClose = () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        setStep('config');
        setPaymentData(null);
        setPaymentMethod('PIX');
        setIsLoading(false);
        closePaymentModal();
    };

    const ProgressBar = ({ percent, colorClass, glowColor }: { percent: number, colorClass: string, glowColor: string }) => (
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2 relative">
            <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass} relative z-10`} 
                style={{ width: `${percent}%` }}
            ></div>
            <div 
                className={`absolute top-0 left-0 h-full blur-[4px] opacity-60 transition-all duration-1000 ${glowColor}`}
                style={{ width: `${percent}%` }}
            ></div>
        </div>
    );

    const Counter = ({ value, setValue, label, icon: Icon, subLabel, stepVal = 1, disabled }: any) => (
        <div className={`
            flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group
            ${disabled ? 'opacity-50 pointer-events-none grayscale' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-blue/50 dark:hover:border-brand-blue/50 hover:shadow-lg hover:shadow-brand-blue/5'}
        `}>
            <div className="flex items-center gap-4">
                <div className={`
                    p-3 rounded-xl transition-colors
                    ${disabled ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:text-brand-blue dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20'}
                `}>
                    <Icon className="w-5 h-5 stroke-[1.5]" />
                </div>
                <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">{label}</span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{subLabel}</span>
                </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/80 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50">
                <button 
                    onClick={() => setValue(Math.max(stepVal === 1 ? 1 : 0, value - 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all shadow-sm active:scale-95 hover:text-red-500"
                >
                    -
                </button>
                <span className="w-8 text-center font-bold text-slate-900 dark:text-white text-sm tabular-nums">{value}</span>
                <button 
                    onClick={() => setValue(value + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold transition-all shadow-md active:scale-95 hover:text-brand-blue"
                >
                    +
                </button>
            </div>
        </div>
    );

    return (
        <div className="glass-overlay animate-fade-in">
            {/* Main Modal Container - Dark Blue Theme */}
            <div className="relative w-full max-w-4xl bg-slate-50 dark:bg-[#0F172A] rounded-[2rem] shadow-2xl border border-white/10 overflow-hidden grid grid-cols-1 md:grid-cols-2 animate-scale-in max-h-[90vh]">
                
                {/* --- LEFT COLUMN: Configuration --- */}
                <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar relative z-10 bg-white/50 dark:bg-slate-900/30">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Meu Plano</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Gerencie seus limites e acesso.</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide flex items-center gap-1.5 ${subscription.isExpired ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${subscription.isExpired ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                            {subscription.isExpired ? 'Expirado' : 'Ativo'}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="flex justify-between items-end mb-2 relative z-10">
                                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                                    <ClockIcon className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Tempo</span>
                                </div>
                                <span className={`text-xl font-black tabular-nums tracking-tight ${usageStats.days.left < 5 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                                    {usageStats.days.left}<span className="text-xs font-medium text-slate-400 ml-0.5">dias</span>
                                </span>
                            </div>
                            <ProgressBar percent={usageStats.days.percent} colorClass={usageStats.days.left < 5 ? "bg-red-500" : "bg-emerald-500"} glowColor={usageStats.days.left < 5 ? "bg-red-400" : "bg-emerald-400"} />
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="flex justify-between items-end mb-2 relative z-10">
                                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                                    <SparklesIcon className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">IA</span>
                                </div>
                                <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                                    {usageStats.ai.used}<span className="text-xs text-slate-400 font-medium">/{usageStats.ai.total}</span>
                                </span>
                            </div>
                            <ProgressBar percent={usageStats.ai.percent} colorClass="bg-blue-500" glowColor="bg-blue-400" />
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-2 mb-2">
                            <BoltIcon className="w-4 h-4 text-amber-500" />
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Personalizar</h3>
                        </div>
                        <Counter value={numSlots} setValue={setNumSlots} label="Cadastros (Slots)" icon={CircleStackIcon} subLabel={numSlots > 1 ? `+${formatCurrency(PRICE_PER_EXTRA * (numSlots - 1))}` : "Plano Base"} disabled={step !== 'config'} />
                        <Counter value={aiPacks} setValue={setAiPacks} stepVal={0} label="Pacote IA (+1000)" icon={SparklesIcon} subLabel={aiPacks > 0 ? `+${formatCurrency(PRICE_PER_AI_BLOCK * aiPacks)}` : "Padrão"} disabled={step !== 'config'} />
                    </div>
                </div>

                {/* --- RIGHT COLUMN: Payment --- */}
                <div className="relative bg-gradient-to-br from-[#020610] to-[#0F172A] p-8 flex flex-col text-white overflow-hidden border-l border-white/5">
                    
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/10 rounded-full blur-[80px] pointer-events-none -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none -ml-16 -mb-16"></div>
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>

                    <button onClick={handleClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors z-20"><XMarkIcon className="w-5 h-5" /></button>

                    <div className="relative z-10 flex flex-col h-full justify-between">
                        
                        {step === 'config' && (
                            <div className="flex flex-col h-full animate-fade-in">
                                <div className="mt-6 mb-8">
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Resumo do Pedido</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black tracking-tighter text-white">{formatCurrency(calculateTotal).split(/\s/)[1]}</span>
                                        <span className="text-xl font-medium text-slate-400">/mês</span>
                                    </div>
                                </div>

                                <div className="mt-auto space-y-6">
                                    {/* Payment Method Selector */}
                                    <div className="flex p-1 bg-black/40 rounded-xl backdrop-blur-sm border border-white/10">
                                        {[
                                            { id: 'PIX', icon: QrCodeIcon, label: 'Pix' },
                                            { id: 'CREDIT_CARD', icon: CreditCardIcon, label: 'Cartão' },
                                            { id: 'BOLETO', icon: BarcodeIcon, label: 'Boleto' }
                                        ].map((m) => (
                                            <button
                                                key={m.id}
                                                onClick={() => setPaymentMethod(m.id as any)}
                                                className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all gap-1.5 ${paymentMethod === m.id ? 'bg-brand-blue text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                            >
                                                <m.icon className="w-5 h-5" />
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Credit Card Form Mockup */}
                                    {paymentMethod === 'CREDIT_CARD' && (
                                        <div className="space-y-3 animate-fade-in">
                                            <input type="text" placeholder="Número do Cartão" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-blue outline-none transition-colors" />
                                            <div className="grid grid-cols-2 gap-3">
                                                <input type="text" placeholder="Validade (MM/AA)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-blue outline-none transition-colors" />
                                                <input type="text" placeholder="CVV" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-blue outline-none transition-colors" />
                                            </div>
                                            <input type="text" placeholder="Nome no Cartão" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-brand-blue outline-none transition-colors" />
                                        </div>
                                    )}

                                    <button
                                        onClick={handleCheckout}
                                        disabled={isLoading}
                                        className="w-full py-4 bg-white text-brand-deep hover:bg-slate-100 font-black rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
                                    >
                                        {isLoading ? (
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <>
                                                {paymentMethod === 'PIX' ? <QrCodeIcon className="w-5 h-5"/> : paymentMethod === 'CREDIT_CARD' ? <CreditCardIcon className="w-5 h-5"/> : <BarcodeIcon className="w-5 h-5"/>}
                                                {paymentMethod === 'PIX' ? 'Gerar PIX' : paymentMethod === 'CREDIT_CARD' ? 'Pagar Agora' : 'Gerar Boleto'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 'payment' && paymentData && (
                            <div className="flex flex-col h-full items-center justify-center text-center animate-fade-in space-y-6">
                                {paymentMethod === 'PIX' && (
                                    <>
                                        <div className="p-4 bg-white rounded-3xl shadow-2xl relative group">
                                            <div className="absolute -inset-1 bg-gradient-to-tr from-brand-blue to-emerald-400 rounded-[2rem] opacity-50 blur group-hover:opacity-75 transition-opacity duration-500"></div>
                                            <img src={paymentData.qrCodeImage} alt="QR Code" className="w-48 h-48 mix-blend-multiply relative z-10 rounded-xl" />
                                        </div>
                                        <div className="w-full">
                                            <div className="flex items-center gap-2 p-1.5 bg-black/30 rounded-xl border border-white/10 backdrop-blur-md mb-2">
                                                <div className="px-3 py-2 text-[10px] font-mono text-white/80 truncate flex-1">{paymentData.pixCopiaECola}</div>
                                                <button onClick={() => handleCopy(paymentData.pixCopiaECola || '')} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"><ClipboardDocumentIcon className="w-4 h-4" /></button>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Pix Copia e Cola</p>
                                        </div>
                                    </>
                                )}

                                {paymentMethod === 'BOLETO' && (
                                    <>
                                        <div className="p-6 bg-white rounded-3xl shadow-2xl w-full max-w-[280px] relative">
                                            <BanknotesIcon className="w-20 h-20 text-slate-800 mx-auto mb-4" />
                                            <div className="h-12 bg-black/10 rounded w-full mb-2"></div>
                                            <div className="h-2 bg-black/10 rounded w-2/3 mx-auto"></div>
                                        </div>
                                        <div className="w-full">
                                            <div className="flex items-center gap-2 p-1.5 bg-black/30 rounded-xl border border-white/10 backdrop-blur-md mb-2">
                                                <div className="px-3 py-2 text-[10px] font-mono text-white/80 truncate flex-1">{paymentData.barcode}</div>
                                                <button onClick={() => handleCopy(paymentData.barcode || '')} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"><ClipboardDocumentIcon className="w-4 h-4" /></button>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Código de Barras</p>
                                        </div>
                                    </>
                                )}

                                <div className="flex items-center gap-2 text-brand-teal bg-teal-900/30 px-4 py-2 rounded-full border border-teal-500/30 animate-pulse">
                                    <ClockIcon className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Aguardando Pagamento...</span>
                                </div>
                            </div>
                        )}

                        {step === 'success' && (
                            <div className="flex flex-col h-full items-center justify-center text-center animate-scale-in">
                                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 relative">
                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                                    <CheckBadgeIcon className="w-12 h-12 text-brand-teal" />
                                </div>
                                <h3 className="text-3xl font-black text-white mb-2 tracking-tight">Sucesso!</h3>
                                <p className="text-slate-400 text-sm font-medium max-w-[200px] leading-relaxed">
                                    Sua assinatura foi renovada e os novos limites estão ativos.
                                </p>
                                <button onClick={handleClose} className="mt-8 px-8 py-3 bg-white text-brand-deep font-bold rounded-full shadow-lg hover:scale-105 transition-transform uppercase text-xs tracking-widest">
                                    Continuar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
