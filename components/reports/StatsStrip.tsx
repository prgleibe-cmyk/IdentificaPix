import React from 'react';
import { ExclamationTriangleIcon, BanknotesIcon, BuildingOfficeIcon, MagnifyingGlassIcon } from '../Icons';
import { formatCurrency } from '../../utils/formatters';
import { Language } from '../../types';

interface StatsStripProps {
    category: string;
    reportName: string;
    summary: any;
    searchTerm: string;
    onSearchChange: (val: string) => void;
    language: Language;
}

export const StatsStrip: React.FC<StatsStripProps> = ({ 
    category, 
    reportName, 
    // Fix: Cast default value to any to avoid "Property does not exist on type '{}'" errors when summary is empty
    summary = {} as any, 
    searchTerm = '', 
    onSearchChange, 
    language 
}) => {
    // Fallbacks seguros para o sumário
    const stats = {
        count: summary.count || 0,
        total: summary.total || 0,
        totalEntradas: summary.totalEntradas !== undefined ? summary.totalEntradas : (category !== 'expenses' ? (summary.total || 0) : 0),
        countEntradas: summary.countEntradas || 0,
        totalSaidas: summary.totalSaidas !== undefined ? summary.totalSaidas : (category === 'expenses' ? (summary.total || 0) : 0),
        countSaidas: summary.countSaidas || 0,
        saldo: summary.saldo !== undefined ? summary.saldo : ((summary.totalEntradas || summary.total || 0) - (summary.totalSaidas || 0)),
        auto: summary.auto || 0,
        autoValue: summary.autoValue || 0,
        manual: summary.manual || 0,
        manualValue: summary.manualValue || 0,
        pending: summary.pending || 0,
        pendingValue: summary.pendingValue || 0
    };

    return (
        <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shrink-0 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className={`p-1.5 rounded-lg shrink-0 self-start sm:self-auto ${category === 'unidentified' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' : category === 'expenses' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'}`}>
                    {category === 'unidentified' ? <ExclamationTriangleIcon className="w-4 h-4"/> : category === 'expenses' ? <BanknotesIcon className="w-4 h-4"/> : <BuildingOfficeIcon className="w-4 h-4"/>}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wide truncate max-w-[200px] md:max-w-none">{reportName || 'Carregando...'}</h3>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                            {stats.count} {stats.count === 1 ? 'registro' : 'registros'}
                        </span>
                    </div>

                    {/* Destaque Financeiro: Total Entradas, Total Saídas e Saldo Apurado */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {/* Entradas */}
                        <div 
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold"
                            title="Total de todas as entradas do relatório (lançamentos manuais, arquivos e SMS)"
                        >
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600/90 dark:text-emerald-400/90 font-sans">Entradas:</span>
                            <span className="font-mono font-black tabular-nums">{formatCurrency(stats.totalEntradas, language)}</span>
                        </div>

                        {/* Saídas */}
                        <div 
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold"
                            title="Total de todas as saídas e despesas do relatório"
                        >
                            <span className="text-[9px] font-black uppercase tracking-wider text-rose-600/90 dark:text-rose-400/90 font-sans">Saídas:</span>
                            <span className="font-mono font-black tabular-nums">{formatCurrency(stats.totalSaidas, language)}</span>
                        </div>

                        {/* Saldo */}
                        <div 
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${
                                stats.saldo >= 0 
                                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/60 text-blue-700 dark:text-blue-300' 
                                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
                            }`}
                            title="Saldo apurado do relatório (Entradas - Saídas)"
                        >
                            <span className="text-[9px] font-black uppercase tracking-wider opacity-80 font-sans">Saldo:</span>
                            <span className="font-mono font-black tabular-nums">{formatCurrency(stats.saldo, language)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <div className="flex gap-2">
                    <StatPill label="Auto" count={stats.auto} value={stats.autoValue} theme="emerald" language={language} />
                    <StatPill label="Manual" count={stats.manual} value={stats.manualValue} theme="blue" language={language} />
                    {stats.pending > 0 && <StatPill label="Pend" count={stats.pending} value={stats.pendingValue} theme="amber" language={language} />}
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>
                <div className="flex items-center gap-1.5">
                    <div className="relative group">
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Pesquisar..." 
                            value={searchTerm} 
                            onChange={(e) => onSearchChange(e.target.value)} 
                            className="pl-7 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-medium focus:ring-1 focus:ring-brand-blue outline-none w-24 focus:w-40 transition-all" 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatPill = ({ label, count, value, theme, language }: any) => (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border flex-shrink-0 ${theme === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : theme === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
        <div className="flex flex-col leading-none">
            <span className="text-[8px] font-black uppercase tracking-wide opacity-70">{label}</span>
            <span className="text-[10px] font-bold">{count}</span>
        </div>
        <span className="text-[10px] font-bold font-mono border-l border-current/20 pl-2">{formatCurrency(value, language)}</span>
    </div>
);