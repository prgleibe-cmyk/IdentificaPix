
import React, { useEffect, useState } from 'react';
import { observationService, ObservationLog } from '../../services/observationService';
import { EyeIcon, TrashIcon, ArrowPathIcon, CheckBadgeIcon } from '../Icons';
import { useUI } from '../../contexts/UIContext';

export const AdminObservationTab: React.FC = () => {
    const [logs, setLogs] = useState<ObservationLog[]>([]);
    const { showToast } = useUI();

    const loadLogs = () => {
        setLogs(observationService.getLogs());
    };

    useEffect(() => {
        loadLogs();
        // Atualiza a cada 5s para monitoramento "real-time" se estiver na aba
        const interval = setInterval(loadLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleClear = () => {
        if (confirm('Limpar todos os registros de observação?')) {
            observationService.clearLogs();
            loadLogs();
            showToast('Logs limpos.', 'success');
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50';
        if (score >= 70) return 'text-sky-700 bg-sky-50 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50';
        return 'text-amber-700 bg-amber-50 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50';
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 px-5 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center shrink-0">
                        <EyeIcon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Modo Observação</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Monitoramento passivo de identificação de modelos.</p>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={loadLogs} 
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-orange-600 hover:border-orange-300 dark:hover:border-orange-700 transition-colors cursor-pointer"
                        title="Atualizar"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={handleClear} 
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-700 transition-colors cursor-pointer"
                        title="Limpar Logs"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col">
                <div
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                    className="flex-1 overflow-auto custom-scrollbar"
                >
                    <table className="w-full text-xs text-left">
                        <thead className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/90 dark:bg-slate-950/60 sticky top-0 backdrop-blur-sm z-10 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Data/Hora</th>
                                <th className="px-4 py-3">Arquivo</th>
                                <th className="px-4 py-3">Modelo Sugerido</th>
                                <th className="px-4 py-3 text-center">Score</th>
                                <th className="px-4 py-3 text-center">Ação do Sistema</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {logs.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500">Nenhuma observação registrada.</td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                                            {log.fileName}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                            {log.suggestedModelName}
                                            <span className="block text-[10px] text-slate-400 font-mono">{log.suggestedModelId}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums border ${getScoreColor(log.score)}`}>
                                                {log.score}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded-md">
                                                <EyeIcon className="w-3 h-3" /> Apenas Observou
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
