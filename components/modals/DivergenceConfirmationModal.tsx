
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { XMarkIcon, ExclamationTriangleIcon } from '../Icons';

export const DivergenceConfirmationModal: React.FC = () => {
    const { divergenceConfirmation, closeDivergenceModal, confirmDivergence, rejectDivergence } = useContext(AppContext);

    if (!divergenceConfirmation || !divergenceConfirmation.divergence) return null;

    const { transaction, divergence } = divergenceConfirmation;
    const { expectedChurch, actualChurch } = divergence;

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in">
                <div className="p-6">
                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200/80 dark:border-slate-800">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Confirmar Divergência</h3>
                        <button type="button" onClick={closeDivergenceModal} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60">
                            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3.5">
                           <p>
                                A transação <span className="font-semibold text-slate-900 dark:text-white px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">"{transaction.cleanedDescription}"</span> foi associada ao contribuinte <span className="font-semibold text-slate-900 dark:text-white">"{divergenceConfirmation.contributor?.cleanedName}"</span> na igreja <span className="font-semibold text-orange-600 dark:text-orange-400">{actualChurch.name}</span>.
                           </p>
                           <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                               <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Alerta de Histórico</p>
                               <p>
                                    Geralmente associado à igreja: <span className="font-semibold text-slate-800 dark:text-slate-100">{expectedChurch.name}</span>.
                                </p>
                           </div>
                           <p className="font-medium text-slate-800 dark:text-slate-200">
                               Deseja confirmar esta identificação na igreja <span className="font-semibold text-orange-600 dark:text-orange-400">{actualChurch.name}</span>?
                           </p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50/70 dark:bg-slate-900 px-6 py-4 flex justify-end space-x-2.5 rounded-b-2xl border-t border-slate-200/80 dark:border-slate-800 mt-auto">
                    <button type="button" onClick={() => rejectDivergence(divergenceConfirmation)} className="px-4 py-2 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-800/60 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer">Rejeitar</button>
                    <button type="button" onClick={() => confirmDivergence(divergenceConfirmation)} className="px-5 py-2 text-xs font-semibold text-white rounded-lg shadow-xs transition-colors bg-orange-600 hover:bg-orange-700 cursor-pointer">Confirmar Associação</button>
                </div>
            </div>
        </div>
    );
};
