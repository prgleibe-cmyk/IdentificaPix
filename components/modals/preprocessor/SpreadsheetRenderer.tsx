
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
        if (index === detectedMapping.dateColumnIndex) return 'bg-blue-50/70 dark:bg-blue-950/30 border-x border-blue-400/50';
        if (index === detectedMapping.amountColumnIndex) return 'bg-emerald-50/70 dark:bg-emerald-950/30 border-x border-emerald-400/50';
        if (index === detectedMapping.descriptionColumnIndex) return 'bg-orange-50/70 dark:bg-orange-950/30 border-x border-orange-400/50';
        return '';
    };

    const getColumnHeaderHighlight = (index: number) => {
        if (!detectedMapping) return '';
        if (index === detectedMapping.dateColumnIndex) return 'bg-blue-600 text-white';
        if (index === detectedMapping.amountColumnIndex) return 'bg-emerald-600 text-white';
        if (index === detectedMapping.descriptionColumnIndex) return 'bg-orange-600 text-white';
        return '';
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3 bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-orange-600 border-t-transparent"></div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Carregando visualização...</p>
            </div>
        );
    }

    if (!data || data.length === 0) {
        if (isImage) return null;
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50 dark:bg-slate-900/50">
                <ExclamationTriangleIcon className="w-10 h-10 mb-2.5 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Visualização indisponível</p>
            </div>
        );
    }

    const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
    const colIndices = Array.from({ length: maxCols }, (_, i) => i);

    return (
        <div
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
            className="absolute inset-0 overflow-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 select-text"
        >
            <table className="border-collapse table-fixed min-w-full">
                <thead className="sticky top-0 z-20">
                    <tr>
                        <th className="w-10 min-w-[40px] bg-slate-200/80 dark:bg-slate-800 border-r border-b border-slate-300 dark:border-slate-700 sticky left-0 z-30"></th>
                        {colIndices.map(colIndex => (
                            <th key={colIndex} className={`bg-slate-100 dark:bg-slate-900 border-r border-b border-slate-200/90 dark:border-slate-700 text-center text-[11px] font-semibold uppercase h-8 min-w-[120px] select-none transition-colors ${getColumnHeaderHighlight(colIndex) || 'text-slate-500 dark:text-slate-400'}`}>
                                {getColumnLabel(colIndex)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {/* @frozen-block-start: VISUAL_LIMIT_50 */}
                    {data.slice(0, 50).map((row, rowIndex) => (
                        <tr key={rowIndex} className="h-7 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-900 border-r border-b border-slate-200/90 dark:border-slate-700 text-center text-[11px] font-medium tabular-nums text-slate-400 select-none w-10">
                                {rowIndex}
                            </td>
                            {colIndices.map(colIndex => (
                                <td 
                                    key={`${rowIndex}-${colIndex}`} 
                                    className={`border-r border-b border-slate-200/80 dark:border-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis cursor-cell ${getColumnHighlight(colIndex)}`}
                                >
                                    {row[colIndex]}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {data.length > 50 && (
                        <tr>
                            <td className="sticky left-0 bg-slate-100 dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-700 h-8"></td>
                            <td colSpan={maxCols} className="p-3 text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30">
                                ... e mais {data.length - 50} linhas ocultas para economia de processamento.
                            </td>
                        </tr>
                    )}
                    {/* @frozen-block-end: VISUAL_LIMIT_50 */}
                </tbody>
            </table>
        </div>
    );
};
