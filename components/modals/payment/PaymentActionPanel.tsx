import React from 'react';
import { XMarkIcon, QrCodeIcon, CreditCardIcon, BarcodeIcon, ClipboardDocumentIcon, ClockIcon, CheckBadgeIcon, BanknotesIcon } from '../../Icons';
import { formatCurrency } from '../../../utils/formatters';

interface PaymentActionPanelProps {
    step: string;
    paymentMethod: string;
    setPaymentMethod: (m: any) => void;
    calculateTotal: number;
    paymentData: any;
    isLoading: boolean;
    handleCheckout: () => void;
    handleClose: () => void;
    cpfCnpj: string;
    setCpfCnpj: (v: string) => void;
}

export const PaymentActionPanel: React.FC<PaymentActionPanelProps> = ({
    step, paymentMethod, setPaymentMethod, calculateTotal, paymentData, isLoading, handleCheckout, handleClose,
    cpfCnpj, setCpfCnpj
}) => {
    const handleCopy = (text: string) => {
        if (text) {
            navigator.clipboard.writeText(text);
            alert("Copiado com sucesso!");
        }
    };

    return (
        <div className="relative bg-gradient-to-br from-[#020610] to-[#0F172A] p-8 flex flex-col text-white overflow-hidden border-l border-white/5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/10 rounded-full blur-[80px] pointer-events-none -mr-16 -mt-16"></div>
            <button onClick={handleClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 transition-colors z-20"><XMarkIcon className="w-5 h-5" /></button>

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
                            {(paymentMethod === 'BOLETO' || paymentMethod === 'CREDIT_CARD') && (
                                <div className="space-y-2 animate-fade-in">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">CPF ou CNPJ do Pagador</label>
                                    <input 
                                        type="text" 
                                        value={cpfCnpj}
                                        onChange={(e) => setCpfCnpj(e.target.value)}
                                        placeholder="000.000.000-00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                                    />
                                </div>
                            )}
                            <div className="flex p-1 bg-black/40 rounded-xl border border-white/10">
                                {[ { id: 'PIX', icon: QrCodeIcon, label: 'Pix' }, { id: 'CREDIT_CARD', icon: CreditCardIcon, label: 'Cartão' }, { id: 'BOLETO', icon: BarcodeIcon, label: 'Boleto' } ].map((m) => (
                                    <button key={m.id} onClick={() => setPaymentMethod(m.id as any)} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all gap-1.5 ${paymentMethod === m.id ? 'bg-brand-blue text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                        <m.icon className="w-5 h-5" />{m.label}
                                    </button>
                                ))}
                            </div>
                            <button onClick={handleCheckout} disabled={isLoading} className="w-full py-4 bg-white text-brand-deep font-black rounded-2xl shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3">
                                {isLoading ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Confirmar e Pagar"}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'payment' && paymentData && (
                    <div className="flex flex-col h-full items-center justify-center text-center animate-fade-in space-y-6">
                        {paymentMethod === 'PIX' && (
                            <>
                                <div className="p-4 bg-white rounded-3xl relative"><img src={paymentData.qrCodeImage} alt="QR Code" className="w-48 h-48 mix-blend-multiply rounded-xl" /></div>
                                <div className="w-full">
                                    <div className="flex items-center gap-2 p-1.5 bg-black/30 rounded-xl border border-white/10"><div className="px-3 py-2 text-[10px] font-mono truncate flex-1">{paymentData.pixCopiaECola}</div><button onClick={() => handleCopy(paymentData.pixCopiaECola || '')} className="p-2 bg-white/10 rounded-lg"><ClipboardDocumentIcon className="w-4 h-4" /></button></div>
                                </div>
                            </>
                        )}
                        {paymentMethod === 'BOLETO' && (
                            <div className="w-full space-y-4">
                                <div className="p-6 bg-white rounded-3xl w-full max-w-[280px] mx-auto text-slate-800"><BanknotesIcon className="w-20 h-20 mx-auto" /><p className="mt-4 font-bold">Boleto Bancário</p></div>
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2 p-1.5 bg-black/30 rounded-xl border border-white/10"><div className="px-3 py-2 text-[10px] truncate flex-1">{paymentData.barcode || 'Boleto disponível no link'}</div><button onClick={() => handleCopy(paymentData.barcode || '')} className="p-2 bg-white/10 rounded-lg"><ClipboardDocumentIcon className="w-4 h-4" /></button></div>
                                    {paymentData.bankSlipUrl && (
                                        <a href={paymentData.bankSlipUrl} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl text-[10px] uppercase tracking-widest text-center">Abrir Boleto</a>
                                    )}
                                </div>
                            </div>
                        )}
                        {paymentMethod === 'CREDIT_CARD' && (
                            <div className="w-full space-y-4">
                                <div className="p-6 bg-white rounded-3xl w-full max-w-[280px] mx-auto text-slate-800"><CreditCardIcon className="w-20 h-20 mx-auto" /><p className="mt-4 font-bold">Cartão de Crédito</p></div>
                                <div className="flex flex-col gap-3">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Clique no botão abaixo para pagar com cartão com segurança no Asaas.</p>
                                    {paymentData.invoiceUrl && (
                                        <a href={paymentData.invoiceUrl} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl text-[10px] uppercase tracking-widest text-center">Pagar com Cartão</a>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-brand-teal bg-teal-900/30 px-4 py-2 rounded-full border border-teal-500/30 animate-pulse"><ClockIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase tracking-widest">Aguardando Pagamento...</span></div>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col h-full items-center justify-center text-center animate-scale-in">
                        <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 relative"><div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div><CheckBadgeIcon className="w-12 h-12 text-brand-teal" /></div>
                        <h3 className="text-3xl font-black text-white mb-2">Sucesso!</h3>
                        <p className="text-slate-400 text-sm">Assinatura atualizada com sucesso.</p>
                        <button onClick={handleClose} className="mt-8 px-8 py-3 bg-white text-brand-deep font-bold rounded-full uppercase text-xs">Continuar</button>
                    </div>
                )}
            </div>
        </div>
    );
};