
import React from 'react';
import { SparklesIcon, ExclamationTriangleIcon } from '../../Icons';

interface SpreadsheetRendererProps {
    data: string[][];
    isLoading?: boolean;
    detectedMapping?: any;
    isAiProcessed?: boolean;
    isImage?: boolean;
}

export const SpreadsheetRenderer: React.FC<SpreadsheetRendererProps> = ({ 
    data, 
    isLoading, 
    detectedMapping, 
    isAiProcessed,
    isImage = false
}) => {
    const getColumnLabel = (index: number) => {
        let label = '';
        let i = index;
        while (i >= 0) {
            label = String.fromCharCode((i % 26) + 65) + label;
            i = Math.floor(i / 26) - 1;
        }
        return `${label} (${index})`; 
    };

    const getColumnHighlight = (index: number) => {
        if (!detectedMapping) return '';
        if (index === detectedMapping.dateColumnIndex) return 'bg-blue-50 dark:bg-blue-900/30 border-x-2 border-blue-500/50';
        if (index === detectedMapping.amountColumnIndex) return 'bg-emerald-50 dark:bg-emerald-900/30 border-x-2 border-emerald-500/50';
        if (index === detectedMapping.descriptionColumnIndex) return 'bg-purple-50 dark:bg-purple-900/30 border-x-2 border-purple-500/50';
        return '';
    };

    const getColumnHeaderHighlight = (index: number) => {
        if (!detectedMapping) return '';
        if (index === detectedMapping.dateColumnIndex) return 'bg-blue-500 text-white dark:bg-blue-600';
        if (index === detectedMapping.amountColumnIndex) return 'bg-emerald-500 text-white dark:bg-emerald-600';
        if (index === detectedMapping.descriptionColumnIndex) return 'bg-purple-500 text-white dark:bg-purple-600';
        return '';
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent"></div>
                <p className="text-xs font-bold uppercase tracking-widest">Carregando visualização...</p>
            </div>
        );
    }

    if (!data || data.length === 0) {
        if (isImage) return null;
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50 dark:bg-slate-900/50">
                <ExclamationTriangleIcon className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-bold text-slate-500 dark:text-slate-300">Visualização indisponível</p>
            </div>
        );
    }

    const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
    const colIndices = Array.from({ length: maxCols }, (_, i) => i);

    return (
        <div className="absolute inset-0 overflow-auto custom-scrollbar bg-[#f8f9fa] dark:bg-[#1e1e1e] select-text">
            <table className="border-collapse table-fixed min-w-full">
                <thead className="sticky top-0 z-20">
                    <tr>
                        <th className="w-10 min-w-[40px] bg-[#e6e6e6] dark:bg-[#333] border-r border-b border-[#c0c0c0] dark:border-[#555] sticky left-0 z-30"></th>
                        {colIndices.map(colIndex => (
                            <th key={colIndex} className={`bg-[#f0f0f0] dark:bg-[#2d2d2d] border-r border-b border-[#d4d4d4] dark:border-[#555] text-center text-[9px] font-black uppercase h-8 min-w-[120px] select-none transition-colors ${getColumnHeaderHighlight(colIndex) || 'text-slate-500'}`}>
                                {getColumnLabel(colIndex)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {/* AUMENTADO LIMITE VISUAL: Mostra 1000 linhas na grade para suportar arquivos grandes no Lab */}
                    {data.slice(0, 1000).map((row, rowIndex) => (
                        <tr key={rowIndex} className="h-7 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <td className="sticky left-0 z-10 bg-[#f0f0f0] dark:bg-[#2d2d2d] border-r border-b border-[#d4d4d4] dark:border-[#555] text-center text-[9px] font-bold text-slate-400 select-none w-10">
                                {rowIndex}
                            </td>
                            {colIndices.map(colIndex => (
                                <td 
                                    key={`${rowIndex}-${colIndex}`} 
                                    className={`border-r border-b border-[#e0e0e0] dark:border-[#444] px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis cursor-cell ${getColumnHighlight(colIndex)}`}
                                >
                                    {row[colIndex]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
