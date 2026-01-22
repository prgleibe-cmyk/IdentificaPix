
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useUI } from '../contexts/UIContext';
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
    DocumentArrowDownIcon,
    PrinterIcon,
    DocumentDuplicateIcon
} from '../components/Icons';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ExportService } from '../services/ExportService';

export const LaunchedView: React.FC = () => {
    const { launchedResults, deleteLaunchedItem, hydrate, openSaveReportModal } = useContext(AppContext);
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();
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
        <div className="flex flex-col h-full animate-fade-in gap-4 pb-4 px-1">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('launched.title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('launched.subtitle')}</p>
                    </div>

                    {/* TOOLSET (Update, Download, Print) */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm ml-2">
                        <button 
                            onClick={() => hydrate()}
                            className="p-1.5 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all"
                            title="Sincronizar"
                        >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={handleDownload}
                            className="p-1.5 rounded-full text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all"
                            title="Baixar CSV"
                        >
                            <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="p-1.5 rounded-full text-slate-400 hover:text-brand-blue hover:bg-white dark:hover:bg-slate-700 transition-all"
                            title="Imprimir"
                        >
                            <PrinterIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Botão Salvar Novo Relatório */}
                    <button 
                        onClick={handleSaveReport}
                        className="relative flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-[10px] uppercase font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/30 hover:-translate-y-0.5 transition-all active:scale-95 border border-white/10"
                    >
                        <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                        <span>{t('reports.saveReport')}</span>
                    </button>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl flex flex-col">
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">Total Lançado</span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">{formatCurrency(totalValue, language)}</span>
                    </div>
                    
                    <div className="relative">
                        <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Pesquisar lançados..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-blue w-64"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Lançamento</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pessoa / Descrição</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Igreja</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                                <th className="px-6 py-4 text-center"></th>
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
                                            <BuildingOfficeIcon className="w-3.5 h-3.5 text-indigo-400" />
                                            {item.church?.name || '---'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`text-xs font-black font-mono ${item.transaction.amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                            {formatCurrency(item.transaction.amount || item.contributor?.amount || 0, language)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => deleteLaunchedItem(item.transaction.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Remover do histórico"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
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
