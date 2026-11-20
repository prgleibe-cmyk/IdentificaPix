import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Copy, Check, Download, Share2, ExternalLink, X, Building2, MessageCircle } from 'lucide-react';

interface ChurchPortalShareModalProps {
    church: {
        id: string;
        name: string;
        pastor?: string;
        logoUrl?: string;
        slug?: string;
    } | null;
    onClose: () => void;
}

export const ChurchPortalShareModal: React.FC<ChurchPortalShareModalProps> = ({ church, onClose }) => {
    const [copied, setCopied] = useState(false);
    const [copiedRegister, setCopiedRegister] = useState(false);
    const [shareMessage, setShareMessage] = useState<string | null>(null);
    const qrContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!church) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.stopImmediatePropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [church, onClose]);

    if (!church || typeof document === 'undefined') return null;

    // Helper to build normalized church slug safely
    const getChurchSlug = (name: string) => {
        const normalized = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return normalized || 'igreja';
    };

    const slug = church.slug || getChurchSlug(church.name);
    // Security constraint: window.location.origin + official church slug
    const portalUrl = `${window.location.origin}/portal/church/${slug}`;
    const registerUrl = `${window.location.origin}/cadastro?church=${slug}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(portalUrl);
            setCopied(true);
            setShareMessage('Link do Portal copiado com sucesso!');
            setTimeout(() => {
                setCopied(false);
                setShareMessage(null);
            }, 3000);
        } catch (err) {
            console.error('Erro ao copiar link:', err);
        }
    };

    const handleCopyRegister = async () => {
        try {
            await navigator.clipboard.writeText(registerUrl);
            setCopiedRegister(true);
            setShareMessage('Link de Cadastro para WhatsApp copiado!');
            setTimeout(() => {
                setCopiedRegister(false);
                setShareMessage(null);
            }, 3000);
        } catch (err) {
            console.error('Erro ao copiar link de cadastro:', err);
        }
    };

    const handleWhatsAppShare = () => {
        const text = `A Paz do Senhor! 🙏\n\nFaça o seu cadastro oficial no Portal da *${church.name}* para ter acesso ao app da igreja e identificar suas contribuições e dízimos via Pix:\n\n👉 ${registerUrl}\n\nLeva menos de 1 minuto!`;
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDownloadQrCode = () => {
        try {
            const canvas = qrContainerRef.current?.querySelector('canvas');
            if (!canvas) {
                console.error('Canvas do QR Code não encontrado.');
                return;
            }

            // Create a high resolution canvas with padding & brand header
            const padding = 32;
            const headerHeight = 60;
            const exportCanvas = document.createElement('canvas');
            const ctx = exportCanvas.getContext('2d');

            if (!ctx) return;

            exportCanvas.width = canvas.width + padding * 2;
            exportCanvas.height = canvas.height + padding * 2 + headerHeight;

            // Background fill
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

            // Title Header
            ctx.fillStyle = '#0F172A';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(church.name.toUpperCase(), exportCanvas.width / 2, padding + 20);

            ctx.fillStyle = '#64748B';
            ctx.font = '11px sans-serif';
            ctx.fillText('PORTAL DO CONTRIBUINTE', exportCanvas.width / 2, padding + 38);

            // Draw QR Code
            ctx.drawImage(canvas, padding, padding + headerHeight);

            // Trigger PNG download
            const imageUri = exportCanvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = imageUri;
            downloadLink.download = `qrcode-portal-${slug}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            setShareMessage('QR Code em alta resolução baixado!');
            setTimeout(() => setShareMessage(null), 3000);
        } catch (err) {
            console.error('Erro ao gerar download do QR Code:', err);
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: `Portal do Contribuinte - ${church.name}`,
            text: `Acesse o Portal do Contribuinte da ${church.name} para registrar sua contribuição via Pix:`,
            url: portalUrl
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('Erro no compartilhamento nativo:', err);
                }
            }
        } else {
            // Elegant fallback when Web Share API is not supported by browser
            await handleCopy();
            setShareMessage('Navegador sem suporte ao compartilhamento nativo. O link foi copiado para a área de transferência!');
            setTimeout(() => setShareMessage(null), 4000);
        }
    };

    return createPortal(
        <div
            data-register-overlay="true"
            className="fixed inset-0 z-[70] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-elevated w-full max-w-4xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <QrCode className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                Portal do Contribuinte
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                Divulgação e QR Code oficial da congregação.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                        title="Fechar"
                        aria-label="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Body */}
                <div
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                    className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar w-full min-h-0"
                >
                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                    
                    {/* Left Column: Church Info & QR Code */}
                    <div className="lg:col-span-5 space-y-4 w-full">
                        {/* Church Banner */}
                        <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 shadow-xs">
                            {church.logoUrl ? (
                                <img
                                    src={church.logoUrl}
                                    alt={church.name}
                                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white shadow-xs shrink-0"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 border border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50 flex items-center justify-center shadow-xs shrink-0">
                                    <Building2 className="w-6 h-6" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200/70 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50 mb-1">
                                    Congregação
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {church.name}
                                </h4>
                                {church.pastor && (
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                        {church.pastor}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* QR Code Presentation Box */}
                        <div className="flex flex-col items-center justify-center p-5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-4 text-center shadow-xs">
                            <div
                                ref={qrContainerRef}
                                className="p-3.5 bg-white rounded-xl shadow-xs border border-slate-200/90 flex items-center justify-center"
                            >
                                <QRCodeCanvas
                                    value={portalUrl}
                                    size={220}
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>

                            <div className="space-y-1 max-w-sm">
                                <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                                    QR Code de Acesso Rápido
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Imprima ou exiba em telas durante os cultos. Os membros apontam a câmera do celular para acessar diretamente o portal da congregação.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleDownloadQrCode}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
                            >
                                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span>Baixar Imagem do QR Code (PNG)</span>
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Portal Public Link, Share Actions & Instructions */}
                    <div className="lg:col-span-7 space-y-4 w-full">
                        
                        {/* WhatsApp Self-Registration Box (NEW) */}
                        <div className="space-y-3 p-4 sm:p-5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 shadow-xs relative overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                        <MessageCircle className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                            Link de Cadastro para WhatsApp
                                        </label>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                            O membro preenche seus dados e é direcionado para baixar o App e acessar o Portal
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                    Recomendado
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200/90 dark:border-emerald-800">
                                <input
                                    type="text"
                                    readOnly
                                    value={registerUrl}
                                    className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 outline-none select-all px-2 py-1.5"
                                />
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleCopyRegister}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs ${
                                            copiedRegister
                                                ? 'bg-emerald-700 text-white'
                                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        }`}
                                    >
                                        {copiedRegister ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedRegister ? 'Copiado!' : 'Copiar'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleWhatsAppShare}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs"
                                        title="Enviar no WhatsApp"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                                        <span>WhatsApp</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Portal Public URL Box */}
                        <div className="space-y-2.5 p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Link Público do Portal do Contribuinte
                                </label>
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                    Ativo e Seguro
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700">
                                <input
                                    type="text"
                                    readOnly
                                    value={portalUrl}
                                    className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 outline-none select-all px-2 py-1.5"
                                />
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs ${
                                            copied
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-orange-600 hover:bg-orange-700 text-white'
                                        }`}
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                                    </button>
                                    <a
                                        href={portalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 border border-slate-200/80 dark:border-slate-700"
                                        title="Abrir em nova aba"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Share Notification Message */}
                        {shareMessage && (
                            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
                                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                <span>{shareMessage}</span>
                            </div>
                        )}

                        {/* Action Buttons Grid */}
                        <div className="space-y-2.5">
                            <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-0.5">
                                Opções de Divulgação
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {/* Copy Link Button */}
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shadow-xs cursor-pointer ${
                                        copied
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                                    }`}
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                                    <span>{copied ? 'Link Copiado!' : 'Copiar Link'}</span>
                                </button>

                                {/* Download QR Code */}
                                <button
                                    type="button"
                                    onClick={handleDownloadQrCode}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <span>Baixar QR Code</span>
                                </button>

                                {/* Share Native */}
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
                                >
                                    <Share2 className="w-3.5 h-3.5 shrink-0 text-orange-600 dark:text-orange-400" />
                                    <span>Compartilhar</span>
                                </button>
                            </div>
                        </div>

                        {/* Informational Cards / Usage Guide */}
                        <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-3">
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>Como funciona o Portal do Contribuinte</span>
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
                                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        Acesso Sem Instalação
                                    </p>
                                    <p className="text-[11px] leading-relaxed">
                                        O contribuinte não precisa baixar aplicativos. Basta escanear o QR Code ou clicar no link enviado.
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        Identificação Rápida
                                    </p>
                                    <p className="text-[11px] leading-relaxed">
                                        Permite o envio direto de comprovantes Pix e identificação de dízimos ou ofertas para a tesouraria.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            </div>

                {/* Footer */}
                <div className="bg-slate-50/80 dark:bg-slate-900/70 px-5 py-3.5 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 shadow-xs transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
