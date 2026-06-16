import React from 'react';
import { UsersIcon } from '../Icons';

export const ContributorsList: React.FC = () => {
    return (
        <div className="h-full flex flex-col animate-fade-in" id="contributors-container">
            {/* Header Section */}
            <div className="flex-shrink-0 flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800/60">
                        <UsersIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">
                            Contribuintes
                        </h3>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 block">
                            Módulo em implantação
                        </span>
                    </div>
                </div>
            </div>

            {/* Centralized Information Box */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl min-h-[300px]">
                <div className="p-4 bg-slate-100/80 dark:bg-slate-900 rounded-full mb-4">
                    <UsersIcon className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                    Módulo de Contribuintes
                </h4>
                <p className="max-w-md text-center text-slate-500 dark:text-slate-400 text-xs leading-relaxed" id="contributors-message">
                    Esta funcionalidade está sendo preparada para futura integração com o Contributors.
                </p>
            </div>
        </div>
    );
};
