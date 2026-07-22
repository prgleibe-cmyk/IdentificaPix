import React, { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Copy, Check, Download, Share2, ExternalLink, X, Building2 } from 'lucide-react';

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
    const [shareMessage, setShareMessage] = useState<string | null>(null);
    const qrContainerRef = useRef<HTMLDivElement>(null);

    if (!church) return null;

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

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col transition-all">
                
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue dark:text-blue-400 block">
                                DIVULGAÇÃO OFICIAL
                            </span>
                            <h3 className="text-base font-black text-slate-800 dark:text-white leading-snug">
                                PORTAL DO CONTRIBUINTE
                            </h3>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                    
                    {/* Church Banner */}
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                        {church.logoUrl ? (
                            <img
                                src={church.logoUrl}
                                alt={church.name}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                                <Building2 className="w-5 h-5" />
                            </div>
                        )}
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                                {church.name}
                            </h4>
                            {church.pastor && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {church.pastor}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* QR Code Presentation Box */}
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
                        <div
                            ref={qrContainerRef}
                            className="p-4 bg-white rounded-2xl shadow-md border border-slate-100 flex items-center justify-center"
                        >
                            <QRCodeCanvas
                                value={portalUrl}
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                QR Code de Acesso Rápido
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                                Aponte a câmera do celular para abrir o Portal do Contribuinte da congregação.
                            </p>
                        </div>
                    </div>

                    {/* Portal Public URL Box */}
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            URL Pública do Portal
                        </label>
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <input
                                type="text"
                                readOnly
                                value={portalUrl}
                                className="w-full bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none select-all px-2"
                            />
                            <a
                                href={portalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg text-slate-500 hover:text-brand-blue hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                                title="Abrir em nova aba"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Share Notification Message */}
                    {shareMessage && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span>{shareMessage}</span>
                        </div>
                    )}

                    {/* Action Buttons Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                        {/* Copy Link */}
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                copied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-brand-blue hover:bg-brand-deep text-white'
                            }`}
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
                        </button>

                        {/* Download QR Code PNG */}
                        <button
                            type="button"
                            onClick={handleDownloadQrCode}
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
                        >
                            <Download className="w-4 h-4 text-emerald-500" />
                            <span>Baixar QR Code</span>
                        </button>

                        {/* Share Link */}
                        <button
                            type="button"
                            onClick={handleShare}
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
                        >
                            <Share2 className="w-4 h-4 text-brand-blue" />
                            <span>Compartilhar</span>
                        </button>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        Fechar
                    </button>
                </div>

            </div>
        </div>
    );
};
