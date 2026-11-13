
import React, { useContext, useState, useRef, useEffect } from 'react';
import { DocumentArrowDownIcon, PrinterIcon, CheckCircleIcon } from '../Icons';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { MessageCircle } from 'lucide-react';
import { getStoredWhatsAppSettings } from '../modals/WhatsAppReceiptModal';

interface ReportToolbarProps {
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
    onDownload, 
    onDownloadExcel,
    onDownloadPdf,
    onDownloadOfx,
    onPrint, 
    hasActiveReport,
    onWhatsAppConfigClick
}) => {
    const { isSyncing, openWhatsAppReceiptModal } = useContext(AppContext);
    const { subscription, user } = useAuth();
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const isSecondaryUser = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
        subscription?.role !== 'owner' &&
        subscription?.role !== 'admin' &&
        subscription?.role !== 'principal';

    const perms = (subscription?.permissions || {}) as any;
    const canDownload = !isSecondaryUser || (perms.baixar_arquivo !== false && perms.downloadFile !== false);
    const canPrint = !isSecondaryUser || (perms.imprimir !== false && perms.printReport !== false);

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
        <div className="flex items-center gap-2 w-full lg:w-auto lg:ml-auto flex-wrap justify-between sm:justify-start lg:justify-end">
            {/* Indicador de Sincronia Automática */}
            {hasActiveReport && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-300 ${isSyncing ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300' : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'}`}>
                    {isSyncing ? (
                        <div className="animate-spin h-2.5 w-2.5 border-2 border-current border-t-transparent rounded-full"></div>
                    ) : (
                        <CheckCircleIcon className="w-3 h-3" />
                    )}
                    <span className="text-[11px] font-semibold">
                        {isSyncing ? 'Sincronizando' : 'Sincronizado'}
                    </span>
                </div>
            )}

            {/* Comunicação (Recibos WhatsApp) */}
            <div className="flex items-center gap-1.5">
                <button 
                    type="button"
                    onClick={handleWhatsAppClick} 
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 transition-all shadow-xs cursor-pointer group active:scale-95"
                    title={`Configurar Mensagens e Recibos do WhatsApp (Modelo Ativo: ${activeModelLabel})`}
                >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform" />
                    <span>Recibos</span>
                </button>
            </div>
            
            {/* Grupo de Ações Utilitárias & Exportação (Baixar + Imprimir) */}
            {(canDownload || canPrint) && (
            <div className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/90 rounded-lg p-0.5 border border-slate-200/80 dark:border-slate-700 relative">
                {canDownload && (
                    <div className="relative" ref={menuRef}>
                        <button 
                            type="button"
                            onClick={() => setShowDownloadMenu(!showDownloadMenu)} 
                            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer" 
                            title="Baixar Relatório"
                        >
                            <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                        </button>
                        {showDownloadMenu && (
                            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in text-xs font-medium text-slate-700 dark:text-slate-300">
                                <button 
                                    type="button"
                                    onClick={() => { onDownload(); setShowDownloadMenu(false); }} 
                                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 hover:text-orange-600 transition-colors cursor-pointer font-semibold"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Baixar como CSV
                                </button>
                                {onDownloadExcel && (
                                    <button 
                                        type="button"
                                        onClick={() => { onDownloadExcel(); setShowDownloadMenu(false); }} 
                                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 hover:text-orange-600 transition-colors cursor-pointer font-semibold"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        Baixar como Excel (XLSX)
                                    </button>
                                )}
                                {onDownloadPdf && (
                                    <button 
                                        type="button"
                                        onClick={() => { onDownloadPdf(); setShowDownloadMenu(false); }} 
                                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 hover:text-orange-600 transition-colors cursor-pointer font-semibold"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                        Baixar como PDF
                                    </button>
                                )}
                                {onDownloadOfx && (
                                    <button 
                                        type="button"
                                        onClick={() => { onDownloadOfx(); setShowDownloadMenu(false); }} 
                                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 hover:text-orange-600 transition-colors cursor-pointer font-semibold"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                        Baixar como OFX (Bancário/Contábil)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {canPrint && (
                    <button
                        type="button"
                        onClick={onPrint}
                        className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
                        title="Imprimir"
                    >
                        <PrinterIcon className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
            )}
        </div>
    );
};
