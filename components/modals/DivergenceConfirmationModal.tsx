import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { XMarkIcon, ExclamationTriangleIcon } from '../Icons';

export const DivergenceConfirmationModal: React.FC = () => {
    const { divergenceConfirmation, closeDivergenceModal, confirmDivergence, rejectDivergence } = useContext(AppContext);

    if (!divergenceConfirmation || !divergenceConfirmation.divergence) return null;

    const { transaction, divergence } = divergenceConfirmation;
    const { expectedChurch, actualChurch } = divergence;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Confirmar Identificação Divergente</h3>
                        <button type="button" onClick={closeDivergenceModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="mt-4 flex items-start space-x-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/50 sm:mx-0 sm:h-10 sm:w-10">
                            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3">
                           <p>
                                A transação <span className="font-semibold text-slate-800 dark:text-slate-200">"{transaction.cleanedDescription}"</span> foi associada ao contribuinte <span className="font-semibold text-slate-800 dark:text-slate-200">"{divergenceConfirmation.contributor?.cleanedName}"</span> na igreja <span className="font-semibold text-blue-600 dark:text-blue-400">{actualChurch.name}</span>.
                           </p>
                           <p>
                                No entanto, o histórico de contribuições indica que este contribuinte geralmente está associado à igreja <span className="font-semibold text-purple-600 dark:text-purple-400">{expectedChurch.name}</span>.
                           </p>
                           <p className="font-medium">
                               Deseja confirmar esta identificação na igreja <span className="font-semibold text-blue-600 dark:text-blue-400">{actualChurch.name}</span>?
                           </p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 flex justify-end space-x-2">
                    <button type="button" onClick={() => rejectDivergence(divergenceConfirmation)} className="px-4 py-2 text-sm font-medium rounded-md border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30">Rejeitar</button>
                    <button type="button" onClick={() => confirmDivergence(divergenceConfirmation)} className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md">Confirmar Associação</button>
                </div>
            </div>
        </div>
    );
};
