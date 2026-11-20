
import React from 'react';
import { SearchIcon, CircleStackIcon, XMarkIcon } from '../Icons';

interface SearchBarProps {
    reportId: string | null;
    onReportIdChange: (id: string | null) => void;
    query: string;
    onQueryChange: (q: string) => void;
    allResultsCount: number;
    savedReports: any[];
    labels: {
        scope: string;
        query: string;
        placeholder: string;
        allOption: string;
    };
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
    reportId, onReportIdChange, query, onQueryChange, allResultsCount, savedReports, labels 
}) => (
    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-800 flex-shrink-0 flex flex-col sm:flex-row gap-3.5 sm:items-end">
        <div className="w-full sm:w-1/3 sm:min-w-[200px]">
            <label htmlFor="search-scope" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 ml-0.5">{labels.scope}</label>
            <div className="relative">
                <CircleStackIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-2.5 -translate-y-1/2 pointer-events-none"/>
                <select
                    id="search-scope"
                    value={reportId || ''}
                    onChange={(e) => onReportIdChange(e.target.value || null)}
                    className="pl-8 pr-6 py-2 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-200 text-xs font-medium shadow-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer appearance-none outline-none"
                >
                    <option value="">{labels.allOption.replace('{count}', String(allResultsCount))}</option>
                    {savedReports.map((report: any) => (
                        <option key={report.id} value={report.id}>
                            {report.name} ({report.recordCount})
                        </option>
                    ))}
                </select>
            </div>
        </div>

        <div className="flex-grow">
            <label htmlFor="search-query" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 ml-0.5">{labels.query}</label>
            <div className="relative">
                <SearchIcon className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 absolute top-1/2 left-2.5 -translate-y-1/2 pointer-events-none"/>
                <input 
                    type="text" 
                    id="search-query" 
                    value={query} 
                    onChange={e => onQueryChange(e.target.value)} 
                    placeholder={labels.placeholder} 
                    className="pl-8 pr-8 py-2 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-200 text-xs font-medium shadow-xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                />
                {query && (
                    <button onClick={() => onQueryChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                        <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    </div>
);
