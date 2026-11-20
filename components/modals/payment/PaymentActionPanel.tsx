import React from 'react';
import { QrCodeIcon, CreditCardIcon, BarcodeIcon, ClipboardDocumentIcon, ClockIcon, CheckBadgeIcon, BanknotesIcon } from '../../Icons';
import { formatCurrency } from '../../../utils/formatters';
import { useUI } from '../../../contexts/UIContext';

interface PaymentActionPanelProps {
    step: string;
    paymentMethod: string;
    setPaymentMethod: (m: any) => void;
    calculateTotal: number;
    numSlots?: number;
    paymentData: any;
    isLoading: boolean;
    handleCheckout: () => void;
    handleClose: () => void;
    cpfCnpj: string;
    setCpfCnpj: (v: string) => void;
}

export const PaymentActionPanel: React.FC<PaymentActionPanelProps> = ({
    step, paymentMethod, setPaymentMethod, calculateTotal, numSlots = 1, paymentData, isLoading, handleCheckout, handleClose,
    cpfCnpj, setCpfCnpj
}) => {
    const { showToast } = useUI();

    const handleCopy = (text: string) => {
        if (text) {
            navigator.clipboard.writeText(text);
            showToast("Código copiado com sucesso!", "success");
        }
    };

    const extraSlots = Math.max(0, numSlots - 1);

    return (
        <div
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            className="bg-slate-50/80 dark:bg-slate-950/60 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto custom-scrollbar border-t sm:border-t-0 sm:border-l border-slate-200/80 dark:border-slate-800"
        >
            {step === 'config' && (
                <div className="flex flex-col justify-between h-full gap-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            Resumo do Pedido
                        </p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
                                {formatCurrency(calculateTotal)}
                            </span>
                            <span className="text-xs font-medium text-slate-400">/mês</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {extraSlots > 0
                                ? `Plano Base + ${extraSlots} capacidade${extraSlots > 1 ? 's' : ''} adicional${extraSlots > 1 ? 'is' : ''}`
                                : 'Plano Base (Igreja + Banco)'}
                        </p>
                    </div>

                    <div className="space-y-3">
                        {(paymentMethod === 'BOLETO' || paymentMethod === 'CREDIT_CARD') && (
                            <div className="space-y-1 animate-fade-in">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    CPF ou CNPJ do Pagador
                                </label>
                                <input 
                                    type="text" 
                                    value={cpfCnpj}
                                    onChange={(e) => setCpfCnpj(e.target.value)}
                                    placeholder="000.000.000-00"
                                    className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-medium text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-orange-500 transition-colors"
                                />
                            </div>
                        )}

                        <div className="flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 gap-1 shadow-2xs">
                            {[
                                { id: 'PIX', icon: QrCodeIcon, label: 'Pix' },
                                { id: 'CREDIT_CARD', icon: CreditCardIcon, label: 'Cartão' },
                                { id: 'BOLETO', icon: BarcodeIcon, label: 'Boleto' }
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setPaymentMethod(m.id as any)}
                                    className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-xs font-semibold transition-colors gap-1 cursor-pointer ${
                                        paymentMethod === m.id
                                            ? 'bg-orange-600 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <m.icon className="w-4 h-4" />
                                    <span>{m.label}</span>
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleCheckout}
                            disabled={isLoading}
                            className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-xs transition-colors text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                "Confirmar e Pagar"
                            )}
                        </button>
                    </div>
                </div>
            )}

            {step === 'payment' && paymentData && (
                <div className="flex flex-col h-full items-center justify-center text-center animate-fade-in space-y-4">
                    {paymentMethod === 'PIX' && (
                        <>
                            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                                <img src={paymentData.qrCodeImage} alt="QR Code Pix" className="w-40 h-40 rounded-lg" />
                            </div>
                            <div className="w-full">
                                <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <div className="px-2.5 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-200 truncate flex-1">
                                        {paymentData.pixCopiaECola}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(paymentData.pixCopiaECola || '')}
                                        className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md cursor-pointer transition-colors"
                                        title="Copiar código Pix"
                                    >
                                        <ClipboardDocumentIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                    {paymentMethod === 'BOLETO' && (
                        <div className="w-full space-y-3">
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-[240px] mx-auto text-slate-900 dark:text-white shadow-2xs">
                                <BanknotesIcon className="w-10 h-10 mx-auto text-orange-600" />
                                <p className="mt-2 font-bold text-xs">Boleto Bancário Gerado</p>
                            </div>
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <div className="px-2.5 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-200 truncate flex-1">
                                        {paymentData.barcode || 'Boleto disponível no link'}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(paymentData.barcode || '')}
                                        className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md cursor-pointer transition-colors"
                                        title="Copiar linha digitável"
                                    >
                                        <ClipboardDocumentIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                {paymentData.bankSlipUrl && (
                                    <a href={paymentData.bankSlipUrl} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg text-xs text-center transition-colors">
                                        Abrir Boleto
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                    {paymentMethod === 'CREDIT_CARD' && (
                        <div className="w-full space-y-3">
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-[240px] mx-auto text-slate-900 dark:text-white shadow-2xs">
                                <CreditCardIcon className="w-10 h-10 mx-auto text-orange-600" />
                                <p className="mt-2 font-bold text-xs">Cartão de Crédito</p>
                            </div>
                            <div className="flex flex-col gap-2.5">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Clique abaixo para pagar com segurança.</p>
                                {paymentData.invoiceUrl && (
                                    <a href={paymentData.invoiceUrl} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg text-xs text-center transition-colors">
                                        Pagar com Cartão
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">Aguardando Pagamento...</span>
                    </div>
                </div>
            )}

            {step === 'success' && (
                <div className="flex flex-col h-full items-center justify-center text-center animate-scale-in py-6">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl flex items-center justify-center mb-4">
                        <CheckBadgeIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Sucesso!</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Assinatura atualizada com sucesso.</p>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="mt-5 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                        Continuar
                    </button>
                </div>
            )}
        </div>
    );
};