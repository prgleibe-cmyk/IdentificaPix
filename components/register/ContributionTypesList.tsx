import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { BanknotesIcon, XMarkIcon } from '../Icons';

export const ContributionTypesList: React.FC = () => {
    const { contributionKeywords, addContributionKeyword, removeContributionKeyword } = useContext(AppContext);
    const [newType, setNewType] = useState('');

    const handleAddType = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newType.trim()) return;
        addContributionKeyword(newType);
        setNewType('');
    };
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
                        <BanknotesIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Tipos de Contribuição</h3>
                        <span className="text-[9px] font-bold text-emerald-600 mt-1 block uppercase">{contributionKeywords.length} ativos</span>
                    </div>
                </div>
            </div>
            
            <div className="flex-shrink-0 mb-3">
                <form onSubmit={handleAddType} className="relative">
                    <input
                        type="text"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        placeholder="Ex: MISSÃO, DÍZIMO..."
                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white py-2 pl-4 pr-16 font-medium transition-all text-[11px] outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button type="submit" disabled={!newType.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-600 text-white text-[9px] font-bold uppercase rounded-lg shadow-md active:scale-95 transition-all">OK</button>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-1">
                {contributionKeywords.map((keyword: string) => (
                    <div key={keyword} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl shadow-sm hover:border-emerald-200 transition-all group">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{keyword}</span>
                        <button onClick={() => removeContributionKeyword(keyword)} className="p-1 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};