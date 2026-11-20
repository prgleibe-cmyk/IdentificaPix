
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
                classes: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
                action: onSave
            };
        }
        if (isDirty) {
            return {
                title: 'Salvar alteração',
                classes: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50',
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
        <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                    <TableCellsIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">{t('smart_analysis.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-tight truncate">{t('smart_analysis.subtitle')}</p>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap ml-auto">
                <div className="inline-flex items-center p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                    <button 
                        onClick={onRankingClick} 
                        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            activeTemplate === 'ranking' 
                                ? 'bg-orange-600 text-white shadow-xs' 
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <TrophyIcon className={`w-3.5 h-3.5 ${activeTemplate === 'ranking' ? 'text-white stroke-[2]' : 'text-orange-600 dark:text-orange-400'}`} />
                        <span>Gerar Ranking</span>
                    </button>

                    <button 
                        onClick={onManualClick}
                        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            activeTemplate === 'manual_structure' 
                                ? 'bg-orange-600 text-white shadow-xs' 
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <TableCellsIcon className={`w-3.5 h-3.5 ${activeTemplate === 'manual_structure' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span>Nova Planilha</span>
                    </button>
                </div>

                <div className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/90 rounded-lg p-0.5 border border-slate-200/80 dark:border-slate-700/60">
                    <button onClick={onPrint} className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer" title="Imprimir"><PrinterIcon className="w-4 h-4" /></button>
                    <button 
                        onClick={saveConfig.action} 
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${saveConfig.classes}`} 
                        title={saveConfig.title}
                    >
                        <FloppyDiskIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
