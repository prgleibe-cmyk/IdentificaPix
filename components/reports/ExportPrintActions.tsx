import React, { useState, useRef, useEffect } from 'react';
import { DocumentArrowDownIcon, PrinterIcon } from '../Icons';
import { useAuth } from '../../contexts/AuthContext';

export interface ExportPrintActionsProps {
    onDownloadPdf?: () => void;
    onDownloadExcel?: () => void;
    onDownloadCsv?: () => void;
    onDownloadOfx?: () => void;
    onPrint?: () => void;
    downloadTitle?: string;
    printTitle?: string;
    menuTitle?: string;
    className?: string;
}

/**
 * Grupo discreto padrão de Exportar (Baixar ▾) e Imprimir para o card de cabeçalho,
 * seguindo o mesmo padrão visual e controle de permissões da aba Financeiro.
 */
export const ExportPrintActions: React.FC<ExportPrintActionsProps> = ({
    onDownloadPdf,
    onDownloadExcel,
    onDownloadCsv,
    onDownloadOfx,
    onPrint,
    downloadTitle = 'Baixar Relatório',
    printTitle = 'Imprimir',
    menuTitle,
    className = ''
}) => {
    const { subscription, user } = useAuth();
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const isSecondaryUser =
        Boolean(subscription?.ownerId && subscription.ownerId !== user?.id) &&
        subscription?.role !== 'owner' &&
        subscription?.role !== 'admin' &&
        subscription?.role !== 'principal';

    const perms = (subscription?.permissions || {}) as Record<string, any>;
    const canDownload = !isSecondaryUser || (perms.baixar_arquivo !== false && perms.downloadFile !== false);
    const canPrint = !isSecondaryUser || (perms.imprimir !== false && perms.printReport !== false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowDownloadMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const downloadHandlers = [onDownloadCsv, onDownloadExcel, onDownloadPdf, onDownloadOfx].filter(Boolean);
    const hasAnyDownload = downloadHandlers.length > 0;
    const hasSingleDownload = downloadHandlers.length === 1;

    if ((!canDownload || !hasAnyDownload) && (!canPrint || !onPrint)) {
        return null;
    }

    const handleDownloadButtonClick = () => {
        if (hasSingleDownload) {
            const single = downloadHandlers[0];
            if (single) single();
            return;
        }
        setShowDownloadMenu(prev => !prev);
    };

    return (
        <div
            className={`flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/90 rounded-lg p-0.5 border border-slate-200/80 dark:border-slate-700 relative shrink-0 ${className}`}
        >
            {canDownload && hasAnyDownload && (
                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        onClick={handleDownloadButtonClick}
                        className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
                        title={downloadTitle}
                        aria-label={downloadTitle}
                    >
                        <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                    </button>

                    {showDownloadMenu && !hasSingleDownload && (
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in text-xs font-medium text-slate-700 dark:text-slate-300">
                            {menuTitle && (
                                <div className="px-3.5 py-1 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">
                                    {menuTitle}
                                </div>
                            )}
                            {onDownloadCsv && (
                                <button
                                    type="button"
                                    onClick={() => { onDownloadCsv(); setShowDownloadMenu(false); }}
                                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 hover:text-orange-600 transition-colors cursor-pointer font-semibold"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Baixar como CSV
                                </button>
                            )}
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

            {canPrint && onPrint && (
                <button
                    type="button"
                    onClick={onPrint}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
                    title={printTitle}
                    aria-label={printTitle}
                >
                    <PrinterIcon className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
};
