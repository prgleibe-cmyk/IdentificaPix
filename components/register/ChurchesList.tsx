import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { SearchIcon, UserIcon, PencilIcon, TrashIcon } from '../Icons';
import { RegisterListItem } from './RegisterListItem';

export const ChurchesList: React.FC = () => {
    const { churches, openEditChurch, openDeleteConfirmation } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    const filteredChurches = useMemo(() => 
        churches.filter((c: any) => 
            c.name.toLowerCase().includes(search.toLowerCase()) || 
            c.pastor.toLowerCase().includes(search.toLowerCase())
        ), [churches, search]
    );

    return (
        <div className="flex flex-col h-full">
            <div className="relative mb-2 flex-shrink-0">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input 
                    type="text" 
                    placeholder={t('register.searchChurch')} 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="pl-8 p-2 block w-full rounded-lg border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900 text-[11px] font-medium outline-none" 
                />
            </div>
            <ul className="space-y-1.5 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0">
                {filteredChurches.map((church: any) => (
                    <RegisterListItem
                        key={church.id}
                        actions={
                             <>
                                <button
                                    onClick={() => openEditChurch(church)}
                                    className="p-1.5 rounded-full text-brand-blue bg-blue-50 hover:bg-blue-100 active:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors shadow-sm"
                                >
                                    <PencilIcon className="w-3 h-3" />
                                </button>
                                <button
                                     onClick={() => openDeleteConfirmation({ type: 'church', id: church.id, name: church.name })}
                                     className="p-1.5 rounded-full text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors shadow-sm"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </>
                        }
                    >
                         <div className="flex items-center space-x-3">
                            <img 
                                src={church.logoUrl} 
                                alt={`Logo ${church.name}`} 
                                className="w-8 h-8 rounded-lg object-cover bg-indigo-50 dark:bg-indigo-900/30 flex-shrink-0 border border-indigo-100 dark:border-indigo-800 shadow-sm transition-transform group-hover:scale-105" 
                            />
                            <div className="min-w-0">
                                <span className="block font-bold text-slate-800 dark:text-slate-200 text-xs tracking-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{church.name}</span>
                                {church.pastor && (
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center mt-0.5 truncate">
                                        <UserIcon className="w-2.5 h-2.5 mr-1 flex-shrink-0 text-slate-400"/> {church.pastor}
                                    </span>
                                )}
                            </div>
                        </div>
                    </RegisterListItem>
                ))}
                {filteredChurches.length === 0 && (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 italic text-[10px]">
                        Nenhuma igreja encontrada.
                    </div>
                )}
            </ul>
        </div>
    );
};