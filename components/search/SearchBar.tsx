
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
    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 flex-shrink-0 flex gap-4 items-end">
        <div className="w-1/3 min-w-[200px]">
            <label htmlFor="search-scope" className="block text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">{labels.scope}</label>
            <div className="relative">
                <CircleStackIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-2.5 -translate-y-1/2 pointer-events-none"/>
                <select
                    id="search-scope"
                    value={reportId || ''}
                    onChange={(e) => onReportIdChange(e.target.value || null)}
                    className="pl-8 pr-6 py-1.5 block w-full rounded-lg border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-xs font-medium shadow-sm focus:border-brand-blue focus:ring-brand-blue transition-all cursor-pointer appearance-none outline-none"
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
            <label htmlFor="search-query" className="block text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">{labels.query}</label>
            <div className="relative">
                <SearchIcon className="w-3.5 h-3.5 text-brand-blue absolute top-1/2 left-2.5 -translate-y-1/2"/>
                <input 
                    type="text" 
                    id="search-query" 
                    value={query} 
                    onChange={e => onQueryChange(e.target.value)} 
                    placeholder={labels.placeholder} 
                    className="pl-8 py-1.5 block w-full rounded-lg border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-xs font-medium shadow-sm focus:border-brand-blue focus:ring-brand-blue transition-all outline-none"
                />
                {query && (
                    <button onClick={() => onQueryChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <XMarkIcon className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    </div>
);
