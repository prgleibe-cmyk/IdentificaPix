import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { SearchIcon, PencilIcon, TrashIcon } from '../Icons';
import { RegisterListItem } from './RegisterListItem';
import { resolveBankKey, resolveBankBrand, resolveBankColors } from '../../utils/bankHelper';
import { BANK_CATALOG } from '../../constants/bankCatalog';

export const BanksList: React.FC = () => {
    const { banks, openEditBank, openDeleteConfirmation } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    
    const filteredBanks = useMemo(() => 
        banks.filter((b: any) => {
            const query = search.toLowerCase();
            const nameMatch = (b.name || '').toLowerCase().includes(query);
            const accMatch = (b.account_name || '').toLowerCase().includes(query);
            const keyMatch = (b.bank_key || '').toLowerCase().includes(query);
            return nameMatch || accMatch || keyMatch;
        }), 
        [banks, search]
    );

    return (
        <div className="flex flex-col h-full">
            <div className="relative mb-3 flex-shrink-0">
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
                {filteredBanks.map((bank: any) => {
                    const key = resolveBankKey(bank);
                    const colors = resolveBankColors(bank);
                    const isGeneric = key === 'GENERIC';
                    
                    // Match with Catalog item if available
                    const catalogItem = BANK_CATALOG.find(c => c.key.toLowerCase() === (bank.bank_key || '').toLowerCase() || c.key.toUpperCase() === key);
                    const catalogName = catalogItem?.name || (bank.bank_key ? bank.bank_key.toUpperCase() : null);

                    return (
                        <RegisterListItem
                            key={bank.id}
                            actions={
                                 <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => openEditBank(bank)}
                                        title="Editar Banco"
                                        className="p-1.5 rounded-lg text-brand-blue bg-blue-50 hover:bg-blue-100 active:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors shadow-sm cursor-pointer"
                                    >
                                        <PencilIcon className="w-3 h-3" />
                                    </button>
                                    <button
                                         onClick={() => openDeleteConfirmation({ type: 'bank', id: bank.id, name: bank.account_name || bank.name })}
                                         title="Excluir Banco"
                                         className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors shadow-sm cursor-pointer"
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            }
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div 
                                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border overflow-hidden shrink-0 shadow-xs"
                                    style={{
                                        backgroundColor: isGeneric ? undefined : colors.bg,
                                        borderColor: isGeneric ? undefined : colors.border,
                                        color: isGeneric ? undefined : colors.text
                                    }}
                                >
                                    {isGeneric ? (
                                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 font-black">
                                            {(bank.name || 'B').charAt(0).toUpperCase()}
                                        </div>
                                    ) : (
                                        resolveBankBrand(bank)
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs tracking-tight truncate block">
                                        {bank.account_name ?? bank.name}
                                    </span>
                                    {catalogName && (
                                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate block">
                                            Instituição: {catalogName}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </RegisterListItem>
                    );
                })}

                {filteredBanks.length === 0 && (
                    <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 my-2">
                        <p className="text-slate-400 dark:text-slate-500 italic text-xs font-medium">
                            Nenhuma conta bancária encontrada.
                        </p>
                    </div>
                )}
            </ul>
        </div>
    );
};
