import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { SearchIcon, PencilIcon, TrashIcon } from '../Icons';
import { RegisterListItem } from './RegisterListItem';

export const BanksList: React.FC = () => {
    const { banks, openEditBank, openDeleteConfirmation } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    
    const filteredBanks = useMemo(() => 
        banks.filter((b: any) => b.name.toLowerCase().includes(search.toLowerCase())), 
        [banks, search]
    );

    return (
        <div className="flex flex-col h-full">
            <div className="relative mb-2 flex-shrink-0">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input 
                    type="text" 
                    placeholder={t('register.searchBank')} 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="pl-8 p-2 block w-full rounded-lg border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900 text-[11px] font-medium outline-none" 
                />
            </div>
            <ul className="space-y-1.5 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0">
                {filteredBanks.map((bank: any) => (
                    <RegisterListItem
                        key={bank.id}
                        actions={
                             <>
                                <button
                                    onClick={() => openEditBank(bank)}
                                    className="p-1.5 rounded-full text-brand-blue bg-blue-50 hover:bg-blue-100 active:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors shadow-sm"
                                >
                                    <PencilIcon className="w-3 h-3" />
                                </button>
                                <button
                                     onClick={() => openDeleteConfirmation({ type: 'bank', id: bank.id, name: bank.name })}
                                     className="p-1.5 rounded-full text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors shadow-sm"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </>
                        }
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-brand-blue dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-200 dark:border-blue-800">
                                {bank.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs tracking-tight">{bank.name}</span>
                        </div>
                    </RegisterListItem>
                ))}
                {filteredBanks.length === 0 && (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 italic text-[10px]">
                        Nenhum banco encontrado.
                    </div>
                )}
            </ul>
        </div>
    );
};