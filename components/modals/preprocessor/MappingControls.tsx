
import React, { useState, useEffect } from 'react';
import { PlayCircleIcon, SparklesIcon, TableCellsIcon, DocumentDuplicateIcon, BoltIcon } from '../../Icons';
import { inferMappingFromSample } from '../../../services/geminiService';
import { useUI } from '../../../contexts/UIContext';

interface MappingControlsProps {
    mapping: any;
    setMapping: (mapping: any) => void;
    columnCount: number;
    onSimulate: () => void;
    gridData: string[][];
}

export const MappingControls: React.FC<MappingControlsProps> = ({
    mapping,
    setMapping,
    columnCount,
    onSimulate,
    gridData
}) => {
    const [isAiLoading, setIsAiLoading] = useState(false);
    const { showToast } = useUI();

    if (!mapping) return null;

    const setExtractionMode = (mode: 'COLUMNS' | 'BLOCK') => {
        setMapping({ ...mapping, extractionMode: mode });
        showToast(`Modo: ${mode === 'BLOCK' ? 'Inteligência de Bloco (IA)' : 'Colunas Fixas (Instantâneo)'}`, "success");
    };

    const updateField = (field: string, value: string) => {
        const val = value === "" ? -1 : parseInt(value);
        setMapping({ ...mapping, [field]: val });
    };

    const handleAiSuggest = async () => {
        if (!gridData || gridData.length === 0) return;
        setIsAiLoading(true);
        try {
            const sample = gridData.slice(0, 30).map(row => row.join(' ')).join('\n');
            const suggestion = await inferMappingFromSample(sample);
            if (suggestion) {
                // Inteligência: Se detectamos colunas em um arquivo estruturado, 
                // preferimos COLUMNS para velocidade e precisão.
                const preferredMode = suggestion.extractionMode === 'BLOCK' && columnCount > 2 ? 'COLUMNS' : suggestion.extractionMode;

                setMapping({
                    ...mapping,
                    extractionMode: preferredMode || 'COLUMNS',
                    dateColumnIndex: suggestion.dateColumnIndex ?? -1,
                    descriptionColumnIndex: suggestion.descriptionColumnIndex ?? -1,
                    amountColumnIndex: suggestion.amountColumnIndex ?? -1,
                    paymentMethodColumnIndex: suggestion.paymentMethodColumnIndex ?? -1,
                    skipRowsStart: suggestion.skipRowsStart ?? 0
                });
                showToast(`IA detectou estrutura de ${preferredMode === 'COLUMNS' ? 'Colunas (Rápido)' : 'Bloco'}.`, "success");
            }
        } catch (e: any) {
            showToast("Falha na análise estrutural.", "error");
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="flex flex-wrap gap-3 items-center flex-1">
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/90 dark:border-slate-700/80">
                <button 
                    onClick={() => setExtractionMode('COLUMNS')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${mapping.extractionMode !== 'BLOCK' ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    title="Modo Determinístico (Recomendado para Excel)"
                >
                    <BoltIcon className="w-3.5 h-3.5" /> Colunas
                </button>
                <button 
                    onClick={() => setExtractionMode('BLOCK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${mapping.extractionMode === 'BLOCK' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    title="Modo Inteligência Artificial (Mais lento)"
                >
                    <SparklesIcon className="w-3.5 h-3.5" /> Bloco (IA)
                </button>
            </div>

            {mapping.extractionMode !== 'BLOCK' ? (
                <div className="flex gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/90 dark:border-slate-700/80 animate-fade-in">
                    <ManualInput label="Data" field="dateColumnIndex" value={mapping.dateColumnIndex} color="text-blue-600 dark:text-blue-400" update={updateField} />
                    <ManualInput label="Descrição" field="descriptionColumnIndex" value={mapping.descriptionColumnIndex} color="text-orange-600 dark:text-orange-400" update={updateField} />
                    <ManualInput label="Valor" field="amountColumnIndex" value={mapping.amountColumnIndex} color="text-emerald-600 dark:text-emerald-400" update={updateField} />
                </div>
            ) : (
                <div className="px-4 py-2 bg-orange-50/70 dark:bg-orange-950/25 border border-orange-200/80 dark:border-orange-900/40 rounded-xl animate-fade-in">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 leading-none">Modo Inteligência de Bloco</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Ideal para PDFs onde os dados não seguem colunas fixas.</p>
                </div>
            )}

            <div className="flex gap-2 ml-auto">
                <button onClick={handleAiSuggest} disabled={isAiLoading} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-orange-600 shadow-xs disabled:opacity-50">
                    <SparklesIcon className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                    <span>Auto-Detectar</span>
                </button>

                <button onClick={onSimulate} className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-[0.98]">
                    <PlayCircleIcon className="w-4 h-4" />
                    <span>Simular Extração</span>
                </button>
            </div>
        </div>
    );
};

const ManualInput = ({ label, field, value, color, update }: any) => (
    <div className="flex flex-col gap-1">
        <label className={`text-[10px] font-semibold uppercase tracking-wide ${color} ml-0.5`}>{label}</label>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/90 dark:border-slate-700 px-2 py-1 shadow-xs focus-within:border-orange-500">
            <span className="text-[10px] font-medium text-slate-400">Col.</span>
            <input type="number" value={value === -1 || value === undefined ? "" : value} onChange={(e) => update(field, e.target.value)} className="bg-transparent text-xs font-semibold tabular-nums outline-none w-9 text-slate-800 dark:text-white" />
        </div>
    </div>
);
