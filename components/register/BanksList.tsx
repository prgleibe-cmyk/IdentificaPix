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
                <SearchIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" />
                <input
                    type="text"
                    placeholder={t('register.searchBank')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 pr-3 py-2 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-xs font-medium outline-none"
                />
            </div>
            
            <ul
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0"
            >
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
                                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300 dark:hover:text-orange-400 transition-colors shadow-xs cursor-pointer"
                                    >
                                        <PencilIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                         onClick={() => openDeleteConfirmation({ type: 'bank', id: bank.id, name: bank.account_name || bank.name })}
                                         title="Excluir Banco"
                                         className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 transition-colors shadow-xs cursor-pointer"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
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
                                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 font-bold">
                                            {(bank.name || 'B').charAt(0).toUpperCase()}
                                        </div>
                                    ) : (
                                        resolveBankBrand(bank)
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="font-semibold text-slate-900 dark:text-white text-xs tracking-tight truncate block">
                                        {bank.account_name ?? bank.name}
                                    </span>
                                    {catalogName && (
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate block">
                                            Instituição: {catalogName}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </RegisterListItem>
                    );
                })}

                {filteredBanks.length === 0 && (
                    <div className="text-center py-10 bg-slate-50/70 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 my-1">
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                            Nenhuma conta bancária encontrada.
                        </p>
                    </div>
                )}
            </ul>
        </div>
    );
};
