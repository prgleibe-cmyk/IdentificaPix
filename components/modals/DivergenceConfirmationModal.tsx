import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { XMarkIcon, ExclamationTriangleIcon } from '../Icons';

export const DivergenceConfirmationModal: React.FC = () => {
    const { divergenceConfirmation, closeDivergenceModal, confirmDivergence, rejectDivergence } = useContext(AppContext);

    if (!divergenceConfirmation || !divergenceConfirmation.divergence) return null;

    const { transaction, divergence } = divergenceConfirmation;
    const { expectedChurch, actualChurch } = divergence;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">Confirmar Divergência</h3>
                        <button type="button" onClick={closeDivergenceModal} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-start space-x-5">
                        <div className="flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-100 dark:border-yellow-800">
                            <ExclamationTriangleIcon className="h-7 w-7 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-4 pt-1">
                           <p>
                                A transação <span className="font-bold text-slate-900 dark:text-white px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">"{transaction.cleanedDescription}"</span> foi associada ao contribuinte <span className="font-bold text-slate-900 dark:text-white">"{divergenceConfirmation.contributor?.cleanedName}"</span> na igreja <span className="font-bold text-blue-600 dark:text-blue-400">{actualChurch.name}</span>.
                           </p>
                           <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                               <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Alerta de Histórico</p>
                               <p>
                                    Geralmente associado à igreja: <span className="font-bold text-purple-600 dark:text-purple-400">{expectedChurch.name}</span>.
                               </p>
                           </div>
                           <p className="font-medium text-slate-800 dark:text-slate-200">
                               Deseja confirmar esta identificação na igreja <span className="font-bold text-blue-600 dark:text-blue-400">{actualChurch.name}</span>?
                           </p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/30 px-8 py-5 flex justify-end space-x-3 rounded-b-2xl border-t border-slate-100 dark:border-slate-700/50">
                    <button type="button" onClick={() => rejectDivergence(divergenceConfirmation)} className="px-5 py-2.5 text-sm font-bold rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20 dark:text-red-400 transition-colors">Rejeitar</button>
                    <button type="button" onClick={() => confirmDivergence(divergenceConfirmation)} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all">Confirmar Associação</button>
                </div>
            </div>
        </div>
    );
};