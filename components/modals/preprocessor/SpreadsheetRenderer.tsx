
import React from 'react';
import { SparklesIcon, ExclamationTriangleIcon } from '../../Icons';

interface SpreadsheetRendererProps {
    data: string[][];
    isLoading?: boolean;
    detectedMapping?: any;
    isAiProcessed?: boolean;
}

export const SpreadsheetRenderer: React.FC<SpreadsheetRendererProps> = ({ 
    data, 
    isLoading, 
    detectedMapping, 
    isAiProcessed 
}) => {
    const getColumnLabel = (index: number) => {
        let label = '';
        let i = index;
        while (i >= 0) {
            label = String.fromCharCode((i % 26) + 65) + label;
            i = Math.floor(i / 26) - 1;
        }
        return label;
    };

    const getColumnHighlight = (index: number) => {
        if (!detectedMapping) return '';
        if (index === detectedMapping.dateColumnIndex) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
        if (index === detectedMapping.amountColumnIndex) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
        if (index === detectedMapping.descriptionColumnIndex) return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
        return '';
    };

    const getColumnHeaderHighlight = (index: number) => {
        if (!detectedMapping) return '';
        if (index === detectedMapping.dateColumnIndex) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
        if (index === detectedMapping.amountColumnIndex) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300';
        if (index === detectedMapping.descriptionColumnIndex) return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
        return '';
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-brand-blue blur-xl opacity-20 rounded-full animate-pulse"></div>
                    <SparklesIcon className="w-12 h-12 text-brand-blue relative z-10 animate-bounce" />
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">Processando Documento</p>
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                        {isAiProcessed ? 'A inteligência artificial está interpretando o visual...' : 'Lendo estrutura do arquivo...'}
                    </p>
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) {
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
            {isAiProcessed && (
                <div className="sticky left-0 top-0 z-40 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1 text-[9px] font-bold uppercase tracking-wide border-b border-purple-200 dark:border-purple-800 flex items-center gap-2">
                    <SparklesIcon className="w-3 h-3" /> Conteúdo Interpretado por IA
                </div>
            )}
            <table className="border-collapse table-fixed min-w-full">
                <thead className="sticky top-0 z-20">
                    <tr>
                        <th className="w-10 min-w-[40px] bg-[#e6e6e6] dark:bg-[#333] border-r border-b border-[#c0c0c0] dark:border-[#555] sticky left-0 z-30"></th>
                        {colIndices.map(colIndex => (
                            <th key={colIndex} className={`bg-[#f0f0f0] dark:bg-[#2d2d2d] border-r border-b border-[#d4d4d4] dark:border-[#555] text-center text-[10px] font-bold text-slate-600 dark:text-slate-300 h-6 min-w-[100px] select-none ${getColumnHeaderHighlight(colIndex)}`}>
                                {getColumnLabel(colIndex)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, 500).map((row, rowIndex) => (
                        <tr key={rowIndex} className="h-6">
                            <td className="sticky left-0 z-10 bg-[#f0f0f0] dark:bg-[#2d2d2d] border-r border-b border-[#d4d4d4] dark:border-[#555] text-center text-[10px] font-bold text-slate-600 dark:text-slate-300 select-none w-10">
                                {rowIndex + 1}
                            </td>
                            {colIndices.map(colIndex => (
                                <td 
                                    key={`${rowIndex}-${colIndex}`} 
                                    className={`border-r border-b border-[#e0e0e0] dark:border-[#444] px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis hover:bg-slate-100 dark:hover:bg-slate-800 cursor-cell ${getColumnHighlight(colIndex)}`}
                                    title={row[colIndex]}
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
