import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { SearchIcon, UserIcon, PencilIcon, TrashIcon } from '../Icons';
import { QrCode } from 'lucide-react';
import { RegisterListItem } from './RegisterListItem';
import { ChurchPortalShareModal } from '../admin/ChurchPortalShareModal';

export const ChurchesList: React.FC = () => {
    const { churches, openEditChurch, openDeleteConfirmation } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [selectedChurchForPortal, setSelectedChurchForPortal] = useState<any | null>(null);

    const filteredChurches = useMemo(() => 
        churches.filter((c: any) => 
            c.name.toLowerCase().includes(search.toLowerCase()) || 
            (c.pastor && c.pastor.toLowerCase().includes(search.toLowerCase())) ||
            (c.treasurer && c.treasurer.toLowerCase().includes(search.toLowerCase())) ||
            (c.cnpj && c.cnpj.includes(search))
        ), [churches, search]
    );

    return (
        <div className="flex flex-col h-full">
            <div className="relative mb-3 flex-shrink-0">
                <SearchIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" />
                <input
                    type="text"
                    placeholder={t('register.searchChurch')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 pr-3 py-2 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-xs font-medium outline-none"
                />
            </div>
            <ul
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0"
            >
                {filteredChurches.map((church: any) => (
                    <RegisterListItem
                        key={church.id}
                        actions={
                             <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setSelectedChurchForPortal(church)}
                                    title="Divulgar Portal do Contribuinte (QR Code & Link)"
                                    className="px-2.5 h-7 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50 dark:hover:bg-emerald-900/50 transition-colors shadow-xs flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                                >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Portal</span>
                                </button>
                                <button
                                    onClick={() => openEditChurch(church)}
                                    title="Editar Congregação"
                                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300 dark:hover:text-orange-400 transition-colors shadow-xs cursor-pointer"
                                >
                                    <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                     onClick={() => openDeleteConfirmation({ type: 'church', id: church.id, name: church.name })}
                                     title="Excluir Congregação"
                                     className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 transition-colors shadow-xs cursor-pointer"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        }
                    >
                         <div className="flex items-center space-x-3">
                            <img 
                                src={church.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} 
                                alt={`Logo ${church.name}`} 
                                className="w-8 h-8 rounded-lg object-cover bg-orange-50 dark:bg-orange-950/30 flex-shrink-0 border border-slate-200/90 dark:border-slate-700 shadow-xs transition-transform group-hover:scale-105" 
                            />
                            <div className="min-w-0">
                                <span className="block font-semibold text-slate-900 dark:text-white text-xs tracking-tight truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{church.name}</span>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    {/* Exibição dos Pastores */}
                                    {Array.isArray(church.pastors) && church.pastors.filter((p: any) => p?.name?.trim()).length > 0 ? (
                                        <span className="flex items-center truncate">
                                            <UserIcon className="w-3 h-3 mr-1 flex-shrink-0 text-amber-500"/>
                                            {church.pastors.filter((p: any) => p?.name?.trim()).map((p: any) => `${p.title ? `${p.title}: ` : ''}${p.name}`).join(' | ')}
                                        </span>
                                    ) : church.pastor ? (
                                        <span className="flex items-center truncate">
                                            <UserIcon className="w-3 h-3 mr-1 flex-shrink-0 text-amber-500"/> Pr: {church.pastor}
                                        </span>
                                    ) : null}

                                    {/* Exibição dos Tesoureiros */}
                                    {Array.isArray(church.treasurers) && church.treasurers.filter((t: any) => t?.name?.trim()).length > 0 ? (
                                        <span className="flex items-center truncate text-emerald-600 dark:text-emerald-400">
                                            • {church.treasurers.filter((t: any) => t?.name?.trim()).map((t: any) => `${t.title ? `${t.title}: ` : ''}${t.name}`).join(' | ')}
                                        </span>
                                    ) : church.treasurer ? (
                                        <span className="flex items-center truncate text-emerald-600 dark:text-emerald-400">
                                            • Tesoureiro: {church.treasurer}
                                        </span>
                                    ) : null}

                                    {church.cnpj && (
                                        <span className="truncate text-slate-400 tabular-nums">
                                            • CNPJ: {church.cnpj}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </RegisterListItem>
                ))}
                {filteredChurches.length === 0 && (
                    <div className="text-center py-10 bg-slate-50/70 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 my-1">
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                            Nenhuma igreja encontrada.
                        </p>
                    </div>
                )}
            </ul>

            {/* Portal Share Modal */}
            {selectedChurchForPortal && (
                <ChurchPortalShareModal
                    church={selectedChurchForPortal}
                    onClose={() => setSelectedChurchForPortal(null)}
                />
            )}
        </div>
    );
};
