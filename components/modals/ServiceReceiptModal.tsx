import React, { useRef, useState, useEffect, useCallback, useContext } from 'react';
import { 
    X, 
    FileSignature, 
    Download, 
    Printer, 
    Send, 
    RotateCcw, 
    CheckCircle2, 
    Building2, 
    User, 
    DollarSign, 
    Calendar, 
    CreditCard, 
    ShieldCheck, 
    AlertCircle, 
    Check,
    FileText,
    Sparkles
} from 'lucide-react';
import { ExpenseAttachment } from '../../types/domain';
import { 
    ServiceReceiptData, 
    generateServiceReceiptPdf, 
    generateReceiptIntegrityHash, 
    saveServiceReceiptAttachment, 
    numeroPorExtenso 
} from '../../services/serviceReceiptService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { AppContext } from '../../contexts/AppContext';

interface ServiceReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: any;
    church?: any;
    onReceiptGenerated?: (attachment: ExpenseAttachment) => void;
}

export const ServiceReceiptModal: React.FC<ServiceReceiptModalProps> = ({
    isOpen,
    onClose,
    transaction,
    church: propChurch,
    onReceiptGenerated
}) => {
    const context = useContext(AppContext);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Identificação da igreja
    const effectiveChurch = propChurch || (context?.churches && Array.isArray(context.churches) ? (
        context.churches.find((c: any) => c.id === transaction?.churchId || c.name === transaction?.church) || context.churches[0]
    ) : null);

    // Campos do Recibo
    const [churchName, setChurchName] = useState('');
    const [churchCnpj, setChurchCnpj] = useState('');
    const [churchCity, setChurchCity] = useState('');

    const [providerName, setProviderName] = useState('');
    const [providerDocument, setProviderDocument] = useState('');
    const [providerPhone, setProviderPhone] = useState('');
    const [providerCity, setProviderCity] = useState('');

    const [amount, setAmount] = useState<number>(0);
    const [paymentDate, setPaymentDate] = useState<string>('');
    const [serviceDescription, setServiceDescription] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('Pix');
    const [receiptNumber, setReceiptNumber] = useState<string>('');

    // Estado da Assinatura no Canvas
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [inkColor, setInkColor] = useState<'#0f172a' | '#1e3a8a'>('#1e3a8a');
    const [isSaving, setIsSaving] = useState(false);
    const [generatedHash, setGeneratedHash] = useState<string | null>(null);
    const [savedAttachment, setSavedAttachment] = useState<ExpenseAttachment | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Inicialização ao abrir modal
    useEffect(() => {
        if (isOpen && transaction) {
            const rawAmount = Math.abs(Number(transaction.amount) || Number(transaction.val) || 0);
            const initialDesc = transaction.desc || transaction.description || transaction.historico || 'Prestação de serviços diversos';
            const initialProvider = transaction.payer || transaction.contribuinte || transaction.nome || transaction.title || '';
            const initialDate = transaction.date ? transaction.date.split('T')[0] : new Date().toISOString().slice(0, 10);
            const initialPaymentMethod = transaction.paymentMethod || transaction.forma || transaction.formaPagamento || 'Pix';

            setChurchName(effectiveChurch?.name || transaction.church || 'Igreja Local');
            setChurchCnpj(effectiveChurch?.cnpj || '');
            setChurchCity(effectiveChurch?.city ? `${effectiveChurch.city}${effectiveChurch.state ? '/' + effectiveChurch.state : ''}` : '');

            setProviderName(initialProvider);
            setProviderDocument('');
            setProviderPhone('');
            setProviderCity(effectiveChurch?.city || '');

            setAmount(rawAmount);
            setPaymentDate(initialDate);
            setServiceDescription(initialDesc);
            setPaymentMethod(initialPaymentMethod);
            
            const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
            setReceiptNumber(`REC-${initialDate.replace(/-/g, '').slice(2, 6)}-${randSuffix}`);

            setHasDrawn(false);
            setGeneratedHash(null);
            setSavedAttachment(null);
            setValidationError(null);

            setTimeout(() => {
                setupCanvas();
            }, 120);
        }
    }, [isOpen, transaction, effectiveChurch]);

    // Configuração do Canvas para desenho nítido com Retina / High-DPI
    const setupCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = inkColor;
        }
        setHasDrawn(false);
    }, [inkColor]);

    const handleClearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHasDrawn(false);
        setValidationError(null);
    };

    const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            const touch = e.touches[0];
            if (!touch) return { x: 0, y: 0 };
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if ('touches' in e && e.cancelable) {
            e.preventDefault();
        }
        setIsDrawing(true);
        const { x, y } = getCanvasCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if ('touches' in e && e.cancelable) {
            e.preventDefault();
        }
        const { x, y } = getCanvasCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        if (!hasDrawn) setHasDrawn(true);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    // Monta o objeto de dados do recibo
    const buildReceiptData = async (sigDataUrl?: string): Promise<ServiceReceiptData> => {
        const data: ServiceReceiptData = {
            receiptNumber,
            date: paymentDate,
            amount,
            paymentMethod,
            serviceDescription,
            church: {
                name: churchName || 'Igreja Local',
                cnpj: churchCnpj,
                city: churchCity,
                address: effectiveChurch?.address,
                pastor: effectiveChurch?.pastor,
                treasurer: effectiveChurch?.treasurer,
                logoUrl: effectiveChurch?.logoUrl
            },
            provider: {
                name: providerName.trim() || 'Prestador de Serviço',
                document: providerDocument.trim(),
                phone: providerPhone.trim(),
                city: providerCity.trim()
            },
            signature: sigDataUrl ? {
                signerName: providerName.trim() || 'Prestador de Serviço',
                signerDocument: providerDocument.trim(),
                signatureDataUrl: sigDataUrl,
                signedAt: new Date().toISOString()
            } : undefined
        };

        const hash = await generateReceiptIntegrityHash(data);
        data.integrityHash = hash;
        return data;
    };

    // Gerar, Assinar e Anexar Recibo
    const handleGenerateAndAttach = async () => {
        if (!providerName.trim()) {
            setValidationError('Por favor, informe o nome do prestador ou beneficiário do pagamento.');
            return;
        }
        if (!amount || amount <= 0) {
            setValidationError('O valor do recibo deve ser maior que zero.');
            return;
        }

        setIsSaving(true);
        setValidationError(null);

        try {
            let sigDataUrl: string | undefined;
            if (canvasRef.current && hasDrawn) {
                sigDataUrl = canvasRef.current.toDataURL('image/png');
            }

            const receiptData = await buildReceiptData(sigDataUrl);
            setGeneratedHash(receiptData.integrityHash || null);

            // Gera PDF
            const pdfDoc = generateServiceReceiptPdf(receiptData);

            // Salva como anexo vinculado à transação
            if (transaction?.id) {
                const att = await saveServiceReceiptAttachment(transaction.id, receiptData, pdfDoc);
                setSavedAttachment(att);
                if (onReceiptGenerated) {
                    onReceiptGenerated(att);
                }
            }
        } catch (err: any) {
            console.error('[ServiceReceiptModal] Erro ao gerar recibo:', err);
            setValidationError('Ocorreu um erro ao gerar o documento do recibo. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    // Download do PDF
    const handleDownloadPdf = async () => {
        let sigDataUrl: string | undefined;
        if (canvasRef.current && hasDrawn) {
            sigDataUrl = canvasRef.current.toDataURL('image/png');
        }
        const receiptData = await buildReceiptData(sigDataUrl);
        const pdfDoc = generateServiceReceiptPdf(receiptData);
        const cleanName = (providerName || 'prestador').replace(/[^a-zA-Z0-9]/g, '_');
        pdfDoc.save(`Recibo_${cleanName}_${receiptNumber}.pdf`);
    };

    // Impressão direta do Recibo
    const handlePrintPdf = async () => {
        let sigDataUrl: string | undefined;
        if (canvasRef.current && hasDrawn) {
            sigDataUrl = canvasRef.current.toDataURL('image/png');
        }
        const receiptData = await buildReceiptData(sigDataUrl);
        const pdfDoc = generateServiceReceiptPdf(receiptData);
        pdfDoc.autoPrint();
        const blobUrl = pdfDoc.output('bloburl');
        window.open(blobUrl, '_blank');
    };

    // Envio pelo WhatsApp
    const handleSendWhatsApp = () => {
        const cleanPhone = providerPhone.replace(/\D/g, '');
        const valStr = formatCurrency(amount);
        const dataExtenso = formatDate(paymentDate);
        
        const messageText = `Olá, *${providerName.trim()}*! Segue o recibo de pagamento emitido por *${churchName}* referente a: _"${serviceDescription}"_ no valor de *${valStr}* em *${dataExtenso}*.\n\nComprovante com quitação e certificação contábil eletrônica. Deus abençoe!`;
        const encoded = encodeURIComponent(messageText);

        const url = cleanPhone.length >= 10
            ? `https://wa.me/55${cleanPhone}?text=${encoded}`
            : `https://wa.me/?text=${encoded}`;
        
        window.open(url, '_blank');
    };

    if (!isOpen || !transaction) return null;

    const extenso = numeroPorExtenso(amount);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-auto">
                
                {/* Header do Modal */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl text-white shadow-md shadow-orange-500/20 shrink-0">
                            <FileSignature className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    Recibo de Prestação de Serviços
                                </h3>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300">
                                    Com Assinatura Digital
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Emissão de quitação contábil e autônoma com validade fiscal e coleta de assinatura touch na tela
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo com Scroll */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300">
                    
                    {/* Alerta de Erro se houver */}
                    {validationError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                            <span>{validationError}</span>
                        </div>
                    )}

                    {/* Banner de Sucesso quando já gerou e anexou */}
                    {savedAttachment && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 shadow-xs animate-fade-in">
                            <div className="flex items-center gap-2.5">
                                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <h4 className="font-extrabold text-xs">Recibo gerado e anexado à despesa com sucesso!</h4>
                                    <p className="text-[11px] opacity-90">
                                        O arquivo PDF já está vinculado no Livro Caixa com selo de integridade SHA-256.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={handleDownloadPdf}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Baixar</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePrintPdf}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Imprimir</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSendWhatsApp}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bloco 1: Igreja (Pagador) e Prestador (Recebedor) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Igreja (Contratante) */}
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-3">
                            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-extrabold pb-2 border-b border-slate-200 dark:border-slate-800">
                                <Building2 className="w-4 h-4 text-orange-500" />
                                <span className="uppercase tracking-wider text-[11px]">Igreja Contratante (Pagador)</span>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                        Razão Social / Nome da Congregação
                                    </label>
                                    <input
                                        type="text"
                                        value={churchName}
                                        onChange={e => setChurchName(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-orange-500"
                                        placeholder="Ex: Igreja Evangélica - Sede"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                            CNPJ da Igreja
                                        </label>
                                        <input
                                            type="text"
                                            value={churchCnpj}
                                            onChange={e => setChurchCnpj(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-orange-500 font-mono"
                                            placeholder="00.000.000/0001-00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                            Cidade / UF
                                        </label>
                                        <input
                                            type="text"
                                            value={churchCity}
                                            onChange={e => setChurchCity(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-orange-500"
                                            placeholder="Ex: São Paulo/SP"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Prestador / Beneficiário */}
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-3">
                            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-extrabold pb-2 border-b border-slate-200 dark:border-slate-800">
                                <User className="w-4 h-4 text-orange-500" />
                                <span className="uppercase tracking-wider text-[11px]">Prestador de Serviço (Recebedor)</span>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                        Nome Completo do Prestador *
                                    </label>
                                    <input
                                        type="text"
                                        value={providerName}
                                        onChange={e => setProviderName(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-orange-500"
                                        placeholder="Ex: João da Silva (Pedreiro / Músico)"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                            CPF ou CNPJ
                                        </label>
                                        <input
                                            type="text"
                                            value={providerDocument}
                                            onChange={e => setProviderDocument(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-orange-500 font-mono"
                                            placeholder="000.000.000-00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                            WhatsApp / Telefone
                                        </label>
                                        <input
                                            type="text"
                                            value={providerPhone}
                                            onChange={e => setProviderPhone(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-orange-500 font-mono"
                                            placeholder="(00) 90000-0000"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bloco 2: Discriminação do Serviço e Pagamento */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 font-extrabold text-slate-800 dark:text-slate-100 text-[11px] uppercase tracking-wider">
                                <DollarSign className="w-4 h-4 text-emerald-500" />
                                <span>Discriminação do Pagamento & Serviço</span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400 font-bold">
                                Nº {receiptNumber}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                    Valor Pago (R$) *
                                </label>
                                <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                                        R$
                                    </span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={amount || ''}
                                        onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                    Data do Pagamento
                                </label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={e => setPaymentDate(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                    Forma de Pagamento
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-orange-500 cursor-pointer"
                                >
                                    <option value="Pix">Pix</option>
                                    <option value="Dinheiro (Espécie)">Dinheiro (Espécie)</option>
                                    <option value="Transferência Bancária">Transferência Bancária</option>
                                    <option value="Cartão de Débito">Cartão de Débito</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                Descrição Detalhada dos Serviços Prestados *
                            </label>
                            <textarea
                                rows={2}
                                value={serviceDescription}
                                onChange={e => setServiceDescription(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-orange-500 resize-none"
                                placeholder="Descreva os serviços prestados (ex: Reforma no telhado, serviço de pintura, ministração de louvor, etc.)"
                            />
                        </div>

                        {/* Preview do Texto de Quitação por Extenso */}
                        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl">
                            <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200 italic font-medium">
                                "Recebi(emos) de <strong className="font-extrabold not-italic">{churchName || 'Igreja Local'}</strong>, a quantia líquida e certa de <strong className="font-extrabold not-italic">{formatCurrency(amount)} ({extenso})</strong> referente à prestação de serviços discriminada, dando plena e irrevogável quitação."
                            </p>
                        </div>
                    </div>

                    {/* Bloco 3: Pad de Assinatura Digital do Prestador */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileSignature className="w-4 h-4 text-orange-500" />
                                <span className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                                    Assinatura do Prestador de Serviço
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setInkColor(inkColor === '#1e3a8a' ? '#0f172a' : '#1e3a8a')}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Alternar entre tinta preta e azul clássico"
                                >
                                    Tinta: {inkColor === '#1e3a8a' ? 'Azul Caneta' : 'Preto'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClearCanvas}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Limpar</span>
                                </button>
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            O prestador pode assinar diretamente na tela usando o dedo no smartphone/tablet ou com o mouse do computador:
                        </p>

                        {/* Canvas Interativo */}
                        <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden touch-none h-40 flex items-center justify-center">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full h-full cursor-crosshair"
                            />
                            {!hasDrawn && (
                                <div className="absolute pointer-events-none flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-1">
                                    <FileSignature className="w-7 h-7 opacity-40" />
                                    <span className="text-[11px] font-semibold tracking-wide">
                                        Assine com o dedo ou mouse aqui
                                    </span>
                                </div>
                            )}
                            <div className="absolute bottom-2 right-2 pointer-events-none">
                                <span className="text-[9px] font-mono font-bold text-slate-400 bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                    {hasDrawn ? '✓ Assinatura capturada' : 'Aguardando traço'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-1">
                            <span>Signatário: <strong>{providerName || 'Nome do Prestador'}</strong></span>
                            <span className="font-mono">{providerDocument ? `Doc: ${providerDocument}` : ''}</span>
                        </div>
                    </div>

                    {/* Selo e Validade Legal */}
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Validade Jurídica e Contábil: </span>
                            O recibo gerado possui respaldo contábil como comprovante de despesa em conformidade com o art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e Lei Federal nº 14.063/2020.
                        </div>
                    </div>

                </div>

                {/* Footer de Ações do Modal */}
                <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/70 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar PDF</span>
                        </button>

                        <button
                            type="button"
                            onClick={handlePrintPdf}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleGenerateAndAttach}
                            disabled={isSaving}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 text-white text-xs font-black uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isSaving ? 'Gerando Recibo...' : 'Gerar & Anexar ao Caixa'}</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
