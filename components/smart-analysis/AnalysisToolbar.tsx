
import React from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { TrophyIcon, TableCellsIcon, PrinterIcon, FloppyDiskIcon } from '../Icons';

interface AnalysisToolbarProps {
    activeTemplate: string;
    onRankingClick: () => void;
    onManualClick: () => void;
    onPrint: () => void;
    onSave: () => void;
    hasActiveReport: boolean;
    isDirty: boolean;
}

export const AnalysisToolbar: React.FC<AnalysisToolbarProps> = ({ 
    activeTemplate, onRankingClick, onManualClick, onPrint, onSave, hasActiveReport, isDirty 
}) => {
    const { t } = useTranslation();

    // Lógica de rótulo e estilo do botão Salvar conforme requisitos
    const getSaveButtonConfig = () => {
        if (!hasActiveReport) {
            return {
                title: 'Salvar',
                classes: 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                action: onSave
            };
        }
        if (isDirty) {
            return {
                title: 'Salvar alteração',
                classes: 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 animate-pulse-soft',
                action: onSave
            };
        }
        return {
            title: 'Já salvo',
            classes: 'text-slate-400 opacity-50 cursor-default',
            action: undefined // Desativa clique desnecessário
        };
    };

    const saveConfig = getSaveButtonConfig();

    return (
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 flex-shrink-0 px-1">
            <div>
                <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('smart_analysis.title')}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">{t('smart_analysis.subtitle')}</p>
            </div>

            <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center gap-3 justify-center">
                <button 
                    onClick={onRankingClick} 
                    className={`relative flex items-center justify-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 group border
                        ${activeTemplate === 'ranking' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-500/30 border-transparent transform scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-violet-600 border-slate-200 dark:border-slate-700'}`}
                >
                    <TrophyIcon className={`w-3.5 h-3.5 ${activeTemplate === 'ranking' ? 'text-amber-300 stroke-[2]' : ''}`} />
                    <span>Gerar Ranking</span>
                </button>

                <button 
                    onClick={onManualClick}
                    className={`relative flex items-center justify-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 group border
                        ${activeTemplate === 'manual_structure' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-cyan-500/30 border-transparent transform scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-cyan-600 border-slate-200 dark:border-slate-700'}`}
                >
                    <TableCellsIcon className="w-3.5 h-3.5" />
                    <span>Nova Planilha</span>
                </button>
            </div>

            <div className="flex items-center ml-auto">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button onClick={onPrint} className="p-2 text-slate-500 hover:text-brand-blue hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-all" title="Imprimir"><PrinterIcon className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                    <button 
                        onClick={saveConfig.action} 
                        className={`p-2 rounded-full transition-all ${saveConfig.classes}`} 
                        title={saveConfig.title}
                    >
                        <FloppyDiskIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
