
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { 
    CheckCircleIcon, 
    TrashIcon, 
    SearchIcon, 
    CalendarIcon, 
    BanknotesIcon, 
    BuildingOfficeIcon,
    XMarkIcon,
    ArrowPathIcon,
    DocumentDuplicateIcon,
    ArrowUturnLeftIcon
} from '../components/Icons';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ExportService } from '../services/ExportService';
import { ExportPrintActions } from '../components/reports/ExportPrintActions';

export const LaunchedView: React.FC = () => {
    const { launchedResults, deleteLaunchedItem, undoLaunch, hydrate, openSaveReportModal } = useContext(AppContext);
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();
    const { isSecondaryUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = useMemo(() => {
        if (!searchTerm.trim()) return launchedResults;
        const lower = searchTerm.toLowerCase();
        return launchedResults.filter((r: any) => 
            (r.transaction.description || '').toLowerCase().includes(lower) ||
            (r.contributor?.name || '').toLowerCase().includes(lower) ||
            (r.church?.name || '').toLowerCase().includes(lower)
        );
    }, [launchedResults, searchTerm]);

    const totalValue = useMemo(() => {
        return filtered.reduce((acc: number, curr: any) => {
             const val = curr.transaction.amount || curr.contributor?.amount || 0;
             return acc + val;
        }, 0);
    }, [filtered]);

    const handleDownload = () => {
        ExportService.downloadCsv(filtered, `lancados_${new Date().toISOString().slice(0,10)}.csv`);
    };

    const handlePrint = () => {
        const summary = {
            count: filtered.length,
            total: totalValue
        };
        ExportService.printHtml(filtered, 'Relatório de Itens Lançados', summary, language);
    };

    const handleSaveReport = () => {
        openSaveReportModal({
            type: 'global',
            results: filtered,
            groupName: 'Itens Lançados'
        });
    };

    if (launchedResults.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState
                    icon={<CheckCircleIcon className="w-12 h-12 text-emerald-500" />}
                    title={t('launched.empty.title')}
                    message={t('launched.empty.message')}
                    action={{
                        text: t('empty.dashboard.saved.action'),
                        onClick: () => setActiveView('upload'),
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full animate-fade-in gap-3 pb-8 md:pb-4 px-1">
            {/* Header Card Padronizado */}
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <CheckCircleIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{t('launched.title')}</h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{t('launched.subtitle')}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text" 
                                placeholder="Pesquisar lançados..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-8 pl-8 pr-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 w-48 sm:w-56 shadow-2xs"
                            />
                        </div>

                        <div className="px-3 py-1 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 rounded-lg flex items-center gap-1.5 h-8">
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider leading-none">Total:</span>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(totalValue, language)}</span>
                        </div>

                        <button 
                            type="button"
                            onClick={handleSaveReport}
                            className="h-8 flex items-center gap-1.5 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                            <DocumentDuplicateIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            <span>{t('reports.saveReport')}</span>
                        </button>

                        <button 
                            type="button"
                            onClick={() => hydrate()}
                            className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-orange-600 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Sincronizar"
                        >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                        </button>

                        <ExportPrintActions
                            onDownloadCsv={handleDownload}
                            onPrint={handlePrint}
                            downloadTitle="Baixar CSV"
                            printTitle="Imprimir"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col">
                <div
                    className="flex-1 overflow-auto custom-scrollbar"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                >
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Lançamento</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pessoa / Descrição</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Igreja</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {filtered.map((item: any) => (
                                <tr key={item.transaction.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                                            <CalendarIcon className="w-3.5 h-3.5" />
                                            {item.launchedAt ? formatDate(item.launchedAt.split('T')[0]) : formatDate(item.transaction.date)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                <CheckCircleIcon className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                                    {item.contributor?.name || item.transaction.description}
                                                </p>
                                                <p className="text-[9px] text-slate-400 truncate uppercase font-bold tracking-tight">
                                                    {item.transaction.cleanedDescription || 'Identificado'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                            <BuildingOfficeIcon className="w-3.5 h-3.5 text-orange-400" />
                                            {item.church?.name || '---'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`text-xs font-black font-mono ${item.transaction.amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                            {formatCurrency(item.transaction.amount || item.contributor?.amount || 0, language)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {(() => {
                                            const isManualRow = item.transaction?.source === 'manual' || 
                                                item.transaction?.isManual === true || 
                                                item.isManual === true || 
                                                String(item.transaction?.id).startsWith('ghost-manual-') || 
                                                (item.transaction?.row_hash && item.transaction?.row_hash.includes('|bmanual|'));
                                            const canDelete = !isSecondaryUser || isManualRow;

                                            return (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => undoLaunch(item.transaction.id)}
                                                        className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="Desfazer lançamento"
                                                    >
                                                        <ArrowUturnLeftIcon className="w-4 h-4" />
                                                    </button>
                                                    {canDelete && (
                                                        <button 
                                                            onClick={() => deleteLaunchedItem(item.transaction.id)}
                                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Remover do histórico"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
