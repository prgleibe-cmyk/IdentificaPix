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
        <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-col gap-3 shrink-0">
            {/* Linha superior: Título do relatório + Campo de busca sempre visível */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        category === 'unidentified'
                            ? 'bg-amber-50 text-amber-600 border-amber-200/70 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/40'
                            : category === 'expenses'
                                ? 'bg-rose-50 text-rose-600 border-rose-200/70 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/40'
                                : 'bg-orange-50 text-orange-600 border-orange-200/70 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-900/40'
                    }`}>
                        {category === 'unidentified' ? <ExclamationTriangleIcon className="w-4 h-4"/> : category === 'expenses' ? <BanknotesIcon className="w-4 h-4"/> : <BuildingOfficeIcon className="w-4 h-4"/>}
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
                            {reportName || 'Carregando...'}
                        </h3>
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                            {stats.count} {stats.count === 1 ? 'registro' : 'registros'}
                        </span>
                    </div>
                </div>

                {/* Pesquisa dedicada e sempre acessível */}
                <div className="relative w-full sm:w-56 md:w-64 shrink-0">
                    <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input 
                        type="text" 
                        placeholder="Pesquisar nome, valor ou banco..." 
                        value={searchTerm} 
                        onChange={(e) => onSearchChange(e.target.value)} 
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-all" 
                    />
                </div>
            </div>

            {/* Linha inferior: Totais Financeiros + Status de Conciliação sem corte horizontal */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1.5">
                    <div 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs"
                        title="Total de todas as entradas do relatório (lançamentos manuais, arquivos e SMS)"
                    >
                        <span className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400">Entradas:</span>
                        <span className="font-bold tabular-nums">{formatCurrency(stats.totalEntradas, language)}</span>
                    </div>

                    <div 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs"
                        title="Total de todas as saídas e despesas do relatório"
                    >
                        <span className="text-[11px] font-medium text-rose-700/80 dark:text-rose-400">Saídas:</span>
                        <span className="font-bold tabular-nums">{formatCurrency(stats.totalSaidas, language)}</span>
                    </div>

                    <div 
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${
                            stats.saldo >= 0 
                                ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-200/70 dark:border-blue-800/60 text-blue-800 dark:text-blue-300' 
                                : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
                        }`}
                        title="Saldo apurado do relatório (Entradas - Saídas)"
                    >
                        <span className="text-[11px] font-medium opacity-80">Saldo:</span>
                        <span className="font-bold tabular-nums">{formatCurrency(stats.saldo, language)}</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    <StatPill label="Auto" count={stats.auto} value={stats.autoValue} theme="emerald" language={language} />
                    <StatPill label="Manual" count={stats.manual} value={stats.manualValue} theme="blue" language={language} />
                    {stats.pending > 0 && <StatPill label="Pendentes" count={stats.pending} value={stats.pendingValue} theme="amber" language={language} />}
                </div>
            </div>
        </div>
    );
};

const StatPill = ({ label, count, value, theme, language }: any) => (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs flex-shrink-0 ${
        theme === 'emerald'
            ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-slate-200/90 dark:border-slate-700'
            : theme === 'blue'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-slate-200/90 dark:border-slate-700'
                : 'bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
    }`}>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {label} <strong className="font-bold text-slate-800 dark:text-white tabular-nums">{count}</strong>
        </span>
        <span className="text-[11px] font-semibold tabular-nums border-l border-slate-200 dark:border-slate-700 pl-2">
            {formatCurrency(value, language)}
        </span>
    </div>
);