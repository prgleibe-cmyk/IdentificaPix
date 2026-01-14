
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
        if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
        return 'text-amber-600 bg-amber-50 border-amber-200';
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                        <EyeIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Modo Observação</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Monitoramento passivo de identificação de modelos.</p>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={loadLogs} 
                        className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                        title="Atualizar"
                    >
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={handleClear} 
                        className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-red-600 hover:border-red-200 transition-colors"
                        title="Limpar Logs"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-xs text-left">
                        <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 backdrop-blur-sm z-10 font-bold border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3">Data/Hora</th>
                                <th className="px-4 py-3">Arquivo</th>
                                <th className="px-4 py-3">Modelo Sugerido</th>
                                <th className="px-4 py-3 text-center">Score</th>
                                <th className="px-4 py-3 text-center">Ação do Sistema</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {logs.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-12 text-slate-400">Nenhuma observação registrada.</td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                                            {log.fileName}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            {log.suggestedModelName}
                                            <span className="block text-[9px] text-slate-400 font-mono">{log.suggestedModelId}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getScoreColor(log.score)}`}>
                                                {log.score}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
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
