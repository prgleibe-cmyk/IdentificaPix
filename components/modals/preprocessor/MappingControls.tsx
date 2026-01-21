
import React, { useState } from 'react';
import { PlayCircleIcon, SparklesIcon, TableCellsIcon, DocumentDuplicateIcon } from '../../Icons';
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
        showToast(`Modo alterado para ${mode === 'BLOCK' ? 'Inteligência de Bloco' : 'Colunas Fixas'}`, "success");
    };

    const updateField = (field: string, value: string) => {
        const val = value === "" ? -1 : parseInt(value);
        setMapping({ ...mapping, [field]: val });
    };

    const handleAiSuggest = async () => {
        if (!gridData || gridData.length === 0) return;
        setIsAiLoading(true);
        try {
            const sample = gridData.slice(0, 20).map(row => row.join(' ')).join('\n');
            const suggestion = await inferMappingFromSample(sample);
            if (suggestion) {
                setMapping({
                    ...mapping,
                    extractionMode: suggestion.extractionMode || 'COLUMNS',
                    dateColumnIndex: suggestion.dateColumnIndex ?? -1,
                    descriptionColumnIndex: suggestion.descriptionColumnIndex ?? -1,
                    amountColumnIndex: suggestion.amountColumnIndex ?? -1,
                    paymentMethodColumnIndex: suggestion.paymentMethodColumnIndex ?? -1,
                    skipRowsStart: suggestion.skipRowsStart ?? 0
                });
                showToast(`IA detectou layout tipo: ${suggestion.extractionMode === 'BLOCK' ? 'Bloco' : 'Colunas'}`, "success");
            }
        } catch (e: any) {
            showToast("Falha na análise estrutural.", "error");
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="flex flex-wrap gap-4 items-center flex-1">
            {/* Seletor de Inteligência */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
                <button 
                    onClick={() => setExtractionMode('COLUMNS')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${mapping.extractionMode !== 'BLOCK' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                    <TableCellsIcon className="w-3 h-3" /> Colunas
                </button>
                <button 
                    onClick={() => setExtractionMode('BLOCK')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${mapping.extractionMode === 'BLOCK' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
                >
                    <DocumentDuplicateIcon className="w-3 h-3" /> Bloco (IA)
                </button>
            </div>

            {mapping.extractionMode !== 'BLOCK' ? (
                <div className="flex gap-2 p-2 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in">
                    <ManualInput label="Data" field="dateColumnIndex" value={mapping.dateColumnIndex} color="text-blue-500" update={updateField} />
                    <ManualInput label="Descrição" field="descriptionColumnIndex" value={mapping.descriptionColumnIndex} color="text-purple-500" update={updateField} />
                    <ManualInput label="Valor" field="amountColumnIndex" value={mapping.amountColumnIndex} color="text-emerald-500" update={updateField} />
                    <ManualInput label="Forma" field="paymentMethodColumnIndex" value={mapping.paymentMethodColumnIndex} color="text-amber-500" update={updateField} />
                </div>
            ) : (
                <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl animate-fade-in">
                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase leading-none">Modo Inteligência de Bloco</p>
                    <p className="text-[9px] text-slate-500 mt-1">A IA processará o contexto visual ignorando colunas fixas.</p>
                </div>
            )}

            <div className="flex gap-2 ml-auto">
                <button onClick={handleAiSuggest} disabled={isAiLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 shadow-sm disabled:opacity-50">
                    <SparklesIcon className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                    <span>{isAiLoading ? 'Analisando...' : 'Auto-Detectar'}</span>
                </button>

                <button onClick={onSimulate} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold uppercase shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
                    <PlayCircleIcon className="w-4 h-4" />
                    <span>Simular Extração</span>
                </button>
            </div>
        </div>
    );
};

const ManualInput = ({ label, field, value, color, update }: any) => (
    <div className="flex flex-col gap-1">
        <label className={`text-[8px] font-black uppercase tracking-tighter ${color} ml-1`}>{label}</label>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 shadow-sm">
            <span className="text-[9px] font-bold text-slate-400">Col.</span>
            <input type="number" value={value === -1 || value === undefined ? "" : value} onChange={(e) => update(field, e.target.value)} className="bg-transparent text-xs font-black outline-none w-8 text-slate-700 dark:text-white" />
        </div>
    </div>
);
