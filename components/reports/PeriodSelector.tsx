import React from 'react';
import { ChevronDown } from 'lucide-react';

export type PeriodSelectionMode = 'month' | 'dates' | 'all';

export const DEFAULT_MONTHS_LIST = [
    { val: 1, name: 'Janeiro' },
    { val: 2, name: 'Fevereiro' },
    { val: 3, name: 'Março' },
    { val: 4, name: 'Abril' },
    { val: 5, name: 'Maio' },
    { val: 6, name: 'Junho' },
    { val: 7, name: 'Julho' },
    { val: 8, name: 'Agosto' },
    { val: 9, name: 'Setembro' },
    { val: 10, name: 'Outubro' },
    { val: 11, name: 'Novembro' },
    { val: 12, name: 'Dezembro' }
];

interface PeriodSelectorProps {
    mode: PeriodSelectionMode;
    onModeChange: (mode: PeriodSelectionMode) => void;
    selectedMonth: number;
    selectedYear: number;
    onMonthYearChange: (month: number, year: number) => void;
    customStart: string;
    customEnd: string;
    onCustomDatesChange: (start: string, end: string) => void;
    monthsList?: { val: number; name: string }[];
    yearsList?: number[];
    showAll?: boolean;
    className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
    mode,
    onModeChange,
    selectedMonth,
    selectedYear,
    onMonthYearChange,
    customStart,
    customEnd,
    onCustomDatesChange,
    monthsList = DEFAULT_MONTHS_LIST,
    yearsList,
    showAll = true,
    className = ''
}) => {
    const currentYear = new Date().getFullYear();
    const resolvedYears = React.useMemo(() => {
        if (yearsList && yearsList.length > 0) return yearsList;
        const list = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
        if (!list.includes(selectedYear)) list.push(selectedYear);
        return Array.from(new Set(list)).sort((a, b) => b - a);
    }, [yearsList, currentYear, selectedYear]);

    const options: { id: PeriodSelectionMode; label: string; title?: string }[] = [
        { id: 'month', label: 'Mês' },
        { id: 'dates', label: 'Período' },
        ...(showAll ? [{ id: 'all' as const, label: 'Todos', title: 'Exibir todos os lançamentos sem filtro de data' }] : [])
    ];

    return (
        <div className={`flex flex-wrap items-center gap-1.5 text-xs shrink-0 ${className}`}>
            {/* Segmented Mode Switcher */}
            <div className="inline-flex items-center bg-slate-100/90 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 h-8 shrink-0">
                {options.map((opt) => (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onModeChange(opt.id)}
                        title={opt.title}
                        className={`px-2.5 h-full rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${
                            mode === opt.id
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Secondary Controls by Mode */}
            {mode === 'month' && (
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative">
                        <select
                            value={selectedMonth}
                            onChange={(e) => onMonthYearChange(Number(e.target.value), selectedYear)}
                            aria-label="Selecionar mês"
                            className="h-8 appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 font-semibold text-slate-800 dark:text-white pl-2.5 pr-7 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer shadow-2xs"
                        >
                            {monthsList.map((m) => (
                                <option key={m.val} value={m.val}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <div className="relative">
                        <select
                            value={selectedYear}
                            onChange={(e) => onMonthYearChange(selectedMonth, Number(e.target.value))}
                            aria-label="Selecionar ano"
                            className="h-8 appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 font-semibold text-slate-800 dark:text-white pl-2.5 pr-7 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer shadow-2xs tabular-nums"
                        >
                            {resolvedYears.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>
            )}

            {mode === 'dates' && (
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <input
                        type="date"
                        value={customStart}
                        onChange={(e) => onCustomDatesChange(e.target.value, customEnd)}
                        aria-label="Data inicial"
                        className="h-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 font-medium text-slate-800 dark:text-white px-2.5 rounded-lg text-xs focus:outline-none focus:border-orange-500 shadow-2xs tabular-nums"
                    />
                    <span className="text-slate-400 font-medium text-xs">até</span>
                    <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => onCustomDatesChange(customStart, e.target.value)}
                        aria-label="Data final"
                        className="h-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 font-medium text-slate-800 dark:text-white px-2.5 rounded-lg text-xs focus:outline-none focus:border-orange-500 shadow-2xs tabular-nums"
                    />
                </div>
            )}
        </div>
    );
};
