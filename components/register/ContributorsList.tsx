import React, { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { UsersIcon, PlusCircleIcon, SearchIcon } from '../Icons';

export const ContributorsList: React.FC = () => {
    const { showToast } = useUI();
    const [search, setSearch] = useState('');

    const handleNewContributorClick = () => {
        showToast("Funcionalidade em implantação.", "success");
    };

    return (
        <div className="h-full flex flex-col animate-fade-in" id="contributors-container">
            {/* Header Area */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800/60">
                        <UsersIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-slate-800 dark:text-white leading-none">
                            Contribuintes
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                            Gerenciamento de membros e congregados.
                        </p>
                    </div>
                </div>
                
                {/* Visual Button: + Novo Contribuinte */}
                <div className="flex-shrink-0">
                    <button 
                        onClick={handleNewContributorClick}
                        className="w-full md:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 text-[10px] font-bold text-white bg-gradient-to-l from-slate-700 to-slate-500 hover:from-slate-800 hover:to-slate-600 rounded-full shadow-md shadow-slate-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wide uppercase"
                        id="new-contributor-btn"
                    >
                        <PlusCircleIcon className="w-3.5 h-3.5" />
                        <span>+ Novo Contribuinte</span>
                    </button>
                </div>
            </div>

            {/* Visual Search input below the header */}
            <div className="relative mb-6 flex-shrink-0">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou CPF" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="pl-8 p-2 block w-full rounded-lg border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900 text-[11px] font-medium outline-none" 
                    id="contributors-search"
                />
            </div>

            {/* Central Empty State Section */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl min-h-[250px] animate-fade-in-up">
                <div className="p-4 bg-slate-100/80 dark:bg-slate-900 rounded-full mb-4">
                    <UsersIcon className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                    Nenhum contribuinte cadastrado.
                </h4>
                <p className="max-w-md text-center text-slate-500 dark:text-slate-400 text-xs leading-relaxed" id="contributors-message">
                    A integração do módulo Contributors será realizada nas próximas etapas.
                </p>
            </div>
        </div>
    );
};
