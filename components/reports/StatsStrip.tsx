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
        <div className="px-3.5 sm:px-4 py-3 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-col gap-2.5 shrink-0">
            {/* Linha superior: Título do relatório + Campo de busca sem corte no tablet */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                            {stats.count} {stats.count === 1 ? 'registro' : 'registros'}
                        </span>
                    </div>
                </div>

                {/* Pesquisa dedicada e sempre acessível */}
                <div className="relative w-full md:w-64 lg:w-72 shrink-0">
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

            {/* Linha inferior: Faixa compacta e limpa de Totais Financeiros + Status */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 bg-white dark:bg-slate-800/70 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                    <div 
                        className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 text-xs min-w-0"
                        title="Total de todas as entradas do relatório (lançamentos manuais, arquivos e SMS)"
                    >
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            Entradas
                        </span>
                        <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400 truncate">{formatCurrency(stats.totalEntradas, language)}</span>
                    </div>

                    <div className="hidden sm:block w-px h-3.5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

                    <div 
                        className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 text-xs min-w-0"
                        title="Total de todas as saídas e despesas do relatório"
                    >
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            Saídas
                        </span>
                        <span className="font-bold tabular-nums text-rose-700 dark:text-rose-400 truncate">{formatCurrency(stats.totalSaidas, language)}</span>
                    </div>

                    <div className="hidden sm:block w-px h-3.5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

                    <div 
                        className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 text-xs min-w-0"
                        title="Saldo apurado do relatório (Entradas - Saídas)"
                    >
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stats.saldo >= 0 ? 'bg-blue-500' : 'bg-amber-500'}`} />
                            Saldo
                        </span>
                        <span className={`font-bold tabular-nums truncate ${stats.saldo >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'}`}>{formatCurrency(stats.saldo, language)}</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs px-1">
                    <StatPill label="Auto" count={stats.auto} value={stats.autoValue} theme="emerald" language={language} />
                    <StatPill label="Manual" count={stats.manual} value={stats.manualValue} theme="blue" language={language} />
                    {stats.pending > 0 && <StatPill label="Pendentes" count={stats.pending} value={stats.pendingValue} theme="amber" language={language} />}
                </div>
            </div>
        </div>
    );
};

const StatPill = ({ label, count, value, theme, language }: any) => (
    <div className="inline-flex items-center gap-1.5 text-[11px] flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            theme === 'emerald' ? 'bg-emerald-500' : theme === 'blue' ? 'bg-blue-500' : 'bg-amber-500'
        }`} />
        <span className="font-medium text-slate-500 dark:text-slate-400">
            {label} <strong className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{count}</strong>
        </span>
        <span className={`font-semibold tabular-nums ${
            theme === 'emerald'
                ? 'text-emerald-700 dark:text-emerald-400'
                : theme === 'blue'
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-amber-700 dark:text-amber-400'
        }`}>
            ({formatCurrency(value, language)})
        </span>
    </div>
);