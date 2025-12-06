
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { QrCodeIcon, ClipboardDocumentIcon, XMarkIcon, PhotoIcon, CheckBadgeIcon } from '../Icons';
import { useUI } from '../../contexts/UIContext';
import { analyzeReceipt } from '../../services/receiptService';
import { formatCurrency } from '../../utils/formatters';

export const PaymentModal: React.FC = () => {
    const { isPaymentModalOpen, closePaymentModal } = useContext(AppContext);
    const { registerPayment, systemSettings } = useAuth();
    const { showToast } = useUI();
    
    // States
    const [step, setStep] = useState<'pay' | 'confirm'>('pay');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Dynamic Settings
    const pixKey = systemSettings.pixKey || "Chave Pix não configurada pelo administrador.";
    const PLAN_VALUE = systemSettings.monthlyPrice || 29.90;
    
    // Using a public API to generate QR Code visual
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixKey)}`;

    if (!isPaymentModalOpen) return null;

    const handleCopyPix = () => {
        if (!systemSettings.pixKey) {
            showToast("Não há chave Pix configurada.", "error");
            return;
        }
        navigator.clipboard.writeText(pixKey);
        showToast("Chave PIX copiada!", "success");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    const handleSubmit = async () => {
        if (!file) return;
        
        setIsUploading(true);
        
        try {
            const analysis = await analyzeReceipt(file);

            if (!analysis.isValid) {
                showToast(`Comprovante Recusado: ${analysis.reason || "Arquivo inválido."}`, "error");
                setIsUploading(false);
                return;
            }

            const tolerance = 5.00;
            
            if (analysis.amount && Math.abs(analysis.amount - PLAN_VALUE) > tolerance && analysis.amount < PLAN_VALUE) {
                 showToast(`Valor identificado (${formatCurrency(analysis.amount)}) divergente do plano (${formatCurrency(PLAN_VALUE)}).`, "error");
                 setIsUploading(false);
                 return;
            }

            const receiptBase64 = await toBase64(file);
            const confirmedAmount = analysis.amount || PLAN_VALUE;
            
            await registerPayment(
                confirmedAmount, 
                'PIX', 
                `Validação IA: ${analysis.recipient ? `Dest: ${analysis.recipient}` : 'Ok'} - Data: ${analysis.date || 'N/A'}`,
                receiptBase64
            );
            
            showToast("Pagamento validado e registrado! 30 dias adicionados.", "success");
            setStep('confirm');
            
            setTimeout(() => {
                handleClose();
            }, 3000);

        } catch (error) {
            console.error(error);
            showToast("Erro ao processar comprovante. Tente novamente.", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        setStep('pay');
        setFile(null);
        setIsUploading(false);
        closePaymentModal();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                
                {/* Decorative Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center relative">
                    <button 
                        onClick={handleClose}
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5 text-white" />
                    </button>
                    <h2 className="text-3xl font-black tracking-tight mb-1 drop-shadow-sm">Renovar Assinatura</h2>
                    <p className="text-blue-100 text-sm font-medium opacity-90 tracking-wide">Plano Pro Mensal - Acesso Completo</p>
                </div>

                <div className="p-8">
                    {step === 'pay' ? (
                        <>
                            {/* Price Tag */}
                            <div className="text-center mb-8">
                                <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
                                    {formatCurrency(PLAN_VALUE)}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 font-bold ml-2 text-lg">/ mês</span>
                            </div>

                            {/* QR Code Section */}
                            <div className="flex flex-col items-center justify-center mb-8">
                                <div className="p-4 bg-white rounded-3xl shadow-xl shadow-indigo-500/10 border-2 border-indigo-100 dark:border-slate-700">
                                    {systemSettings.pixKey ? (
                                        <img src={qrCodeUrl} alt="QR Code Pix" className="w-48 h-48 mix-blend-multiply dark:mix-blend-normal" />
                                    ) : (
                                        <div className="w-48 h-48 flex items-center justify-center text-center text-slate-400 text-sm p-4 bg-slate-50">
                                            Chave Pix não configurada. Contate o suporte.
                                        </div>
                                    )}
                                </div>
                                <div className="mt-5 flex items-center gap-2 w-full max-w-xs">
                                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 truncate flex-1 font-mono font-bold">
                                        {pixKey}
                                    </div>
                                    <button 
                                        onClick={handleCopyPix}
                                        className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
                                        title="Copiar Chave"
                                    >
                                        <ClipboardDocumentIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Upload Section */}
                            <div className="border-t border-slate-100 dark:border-slate-700/50 pt-6">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 text-center uppercase tracking-wide">
                                    Já pagou? Envie o comprovante:
                                </label>
                                
                                <div className="flex flex-col gap-4">
                                    <label 
                                        className={`flex items-center justify-center w-full px-6 py-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
                                            file 
                                            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' 
                                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-500'
                                        }`}
                                    >
                                        <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
                                        {file ? (
                                            <span className="flex items-center gap-3 font-bold text-sm truncate">
                                                <CheckBadgeIcon className="w-6 h-6" />
                                                {file.name}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-3 font-bold text-sm">
                                                <PhotoIcon className="w-6 h-6 opacity-70" />
                                                Escolher imagem ou PDF
                                            </span>
                                        )}
                                    </label>

                                    <button
                                        onClick={handleSubmit}
                                        disabled={!file || isUploading}
                                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] text-sm uppercase tracking-wide"
                                    >
                                        {isUploading ? (
                                            <span className="flex items-center justify-center gap-3">
                                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Auditando com IA...
                                            </span>
                                        ) : "Confirmar Pagamento"}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner animate-bounce-slow">
                                <CheckBadgeIcon className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Pagamento Confirmado!</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-lg">Sua assinatura foi renovada e o comprovante registrado com segurança.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
