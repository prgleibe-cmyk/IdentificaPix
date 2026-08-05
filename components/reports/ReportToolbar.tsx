
import React, { useContext, useState, useRef, useEffect } from 'react';
import { SparklesIcon, ArrowPathIcon, DocumentArrowDownIcon, PrinterIcon, CheckCircleIcon } from '../Icons';
import { AppContext } from '../../contexts/AppContext';
import { MessageCircle } from 'lucide-react';
import { getStoredWhatsAppSettings } from '../modals/WhatsAppReceiptModal';

interface ReportToolbarProps {
    onAiClick: () => void;
    onUpdateSource: () => void;
    onDownload: () => void;
    onDownloadExcel?: () => void;
    onDownloadPdf?: () => void;
    onDownloadOfx?: () => void;
    onPrint: () => void;
    onSaveReport: () => void;
    hasActiveReport: boolean;
    role?: string;
    onWhatsAppConfigClick?: () => void;
}

export const ReportToolbar: React.FC<ReportToolbarProps> = ({ 
    onAiClick, 
    onUpdateSource, 
    onDownload, 
    onDownloadExcel,
    onDownloadPdf,
    onDownloadOfx,
    onPrint, 
    onSaveReport, 
    hasActiveReport,
    role,
    onWhatsAppConfigClick
}) => {
    const { isSyncing, openWhatsAppReceiptModal } = useContext(AppContext);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const isOwner = role === 'owner';

    const [activeSender, setActiveSender] = useState<'treasury' | 'pastor' | 'closing'>(() => {
        return getStoredWhatsAppSettings().defaultSender || 'treasury';
    });

    useEffect(() => {
        const handleUpdate = () => {
            setActiveSender(getStoredWhatsAppSettings().defaultSender || 'treasury');
        };
        window.addEventListener('whatsapp_settings_updated', handleUpdate);
        return () => window.removeEventListener('whatsapp_settings_updated', handleUpdate);
    }, []);

    const activeModelLabel = activeSender === 'pastor' ? 'Pastor' : activeSender === 'closing' ? 'Extrato' : 'Tesouraria';

    const handleWhatsAppClick = () => {
        if (onWhatsAppConfigClick) {
            onWhatsAppConfigClick();
        } else if (openWhatsAppReceiptModal) {
            openWhatsAppReceiptModal({ isConfigOnly: true });
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowDownloadMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex items-center gap-1.5 w-full md:w-auto ml-auto flex-wrap">
            {/* Indicador de Sincronia Automática */}
            {hasActiveReport && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-500 ${isSyncing ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                    {isSyncing ? (
                        <div className="animate-spin h-2.5 w-2.5 border-2 border-current border-t-transparent rounded-full"></div>
                    ) : (
                        <CheckCircleIcon className="w-3 h-3" />
                    )}
                    <span className="text-[9px] font-black uppercase tracking-widest">
                        {isSyncing ? 'Sincronizando' : 'Sincronizado'}
                    </span>
                </div>
            )}

            {/* Configuração de WhatsApp */}
            <button 
                type="button"
                onClick={handleWhatsAppClick} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] uppercase font-black tracking-wider text-emerald-900 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/90 border border-emerald-400/80 dark:border-emerald-700 hover:bg-emerald-200 transition-all shadow-xs cursor-pointer group"
                title={`Configurar Mensagens e Recibos do WhatsApp (Modelo Ativo: ${activeModelLabel})`}
            >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-emerald-600/20 group-hover:scale-110 transition-transform" />
                <span>Recibos</span>
            </button>

            <button 
                type="button"
                onClick={onAiClick} 
                className="relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] uppercase font-black tracking-wider text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 hover:opacity-95 shadow-xs transition-all active:scale-95 group cursor-pointer border border-orange-400/30" 
                title="Conciliação Automática de Vínculos"
            >
                <SparklesIcon className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                <span>Conciliação Inteligente</span>
            </button>
            
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5"></div>
            
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 shadow-xs relative">
                <button type="button" onClick={onUpdateSource} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer" title="Atualizar Fonte"><ArrowPathIcon className="w-3.5 h-3.5" /></button>
                
                <div className="relative" ref={menuRef}>
                    <button 
                        type="button"
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)} 
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer" 
                        title="Baixar Relatório"
                    >
                        <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                    </button>
                    {showDownloadMenu && (
                        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            <button 
                                type="button"
                                onClick={() => { onDownload(); setShowDownloadMenu(false); }} 
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 hover:text-brand-blue transition-colors cursor-pointer font-semibold"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Baixar como CSV
                            </button>
                            {onDownloadExcel && (
                                <button 
                                    type="button"
                                    onClick={() => { onDownloadExcel(); setShowDownloadMenu(false); }} 
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 hover:text-brand-blue transition-colors cursor-pointer font-semibold"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    Baixar como Excel (XLSX)
                                </button>
                            )}
                            {onDownloadPdf && (
                                <button 
                                    type="button"
                                    onClick={() => { onDownloadPdf(); setShowDownloadMenu(false); }} 
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 hover:text-brand-blue transition-colors cursor-pointer font-semibold"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Baixar como PDF
                                </button>
                            )}
                            {onDownloadOfx && (
                                <button 
                                    type="button"
                                    onClick={() => { onDownloadOfx(); setShowDownloadMenu(false); }} 
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 hover:text-brand-blue transition-colors cursor-pointer font-semibold"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                    Baixar como OFX (Bancário/Contábil)
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <button type="button" onClick={onPrint} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer" title="Imprimir"><PrinterIcon className="w-3.5 h-3.5" /></button>
            </div>
        </div>
    );
};
