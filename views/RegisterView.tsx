
import React, { useContext, useState, useMemo, memo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { Church, Bank, ChurchFormData } from '../types';
import { SearchIcon, PlusCircleIcon, BuildingOfficeIcon, UserIcon, PencilIcon, TrashIcon, ArrowsRightLeftIcon } from '../components/Icons';


// --- Reusable List Item with Robust Layout ---
interface ListItemProps {
    children: React.ReactNode;
    actions: React.ReactNode;
}
const ListItem: React.FC<ListItemProps> = memo(({ children, actions }) => (
    <li className="flex items-center justify-between text-sm bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm border border-white/50 dark:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-100 dark:hover:border-indigo-900/50 hover:-translate-y-0.5 transition-all duration-300 group">
        <div className="flex-1 min-w-0 pr-4">{children}</div>
        <div className="flex-shrink-0 flex items-center space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 transform sm:translate-x-2 sm:group-hover:translate-x-0">{actions}</div>
    </li>
));

// --- Bank Management Components ---
const BankForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addBank } = useContext(AppContext);
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        
        setIsSubmitting(true);
        // Explicitly wait for the boolean result from AppContext
        const success = await addBank(name);
        setIsSubmitting(false);
        
        // Only clear and close if the backend operation succeeded
        if (success) {
            setName('');
            onCancel();
        }
    };

    return (
        <div className="mb-4 p-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner animate-fade-in backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="bank-name" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">{t('register.bankName')}</label>
                    <input 
                        type="text" 
                        id="bank-name" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 disabled:opacity-50" 
                        placeholder="Ex: Banco Digital X" 
                        required 
                        disabled={isSubmitting}
                    />
                </div>
                <div className="flex items-center gap-2 pt-1">
                    <button type="button" onClick={onCancel} disabled={isSubmitting} className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase disabled:opacity-50">{t('common.cancel')}</button>
                    <button type="submit" disabled={isSubmitting || !name.trim()} className="flex-1 py-2 px-3 border border-transparent rounded-xl shadow-lg shadow-indigo-500/20 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors uppercase disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Salvando...
                            </span>
                        ) : t('common.save')}
                    </button>
                </div>
            </form>
        </div>
    );
};

const BanksList: React.FC = () => {
    const { banks, openEditBank, openDeleteConfirmation } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const filteredBanks = useMemo(() => banks.filter(b => b.name.toLowerCase().includes(search.toLowerCase())), [banks, search]);

    return (
        <div className="flex flex-col h-full">
            <div className="relative mb-4 flex-shrink-0">
                <SearchIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input type="text" placeholder={t('register.searchBank')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 p-2.5 block w-full rounded-xl border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-inner backdrop-blur-sm text-sm" />
            </div>
            <ul className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0">
                {filteredBanks.map(bank => (
                    <ListItem
                        key={bank.id}
                        actions={
                             <>
                                <button
                                    onClick={() => openEditBank(bank)}
                                    className="p-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors"
                                    aria-label={`${t('common.edit')} ${bank.name}`}
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                                <button
                                     onClick={() => openDeleteConfirmation({ type: 'bank', id: bank.id, name: bank.name })}
                                     className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                                     aria-label={`${t('common.delete')} ${bank.name}`}
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </>
                        }
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-lg shadow-indigo-500/20">
                                {bank.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-base tracking-tight">{bank.name}</span>
                        </div>
                    </ListItem>
                ))}
            </ul>
        </div>
    );
};

// --- Church Management Components ---
const ChurchForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addChurch } = useContext(AppContext);
    const { t } = useTranslation();
    const [data, setData] = useState<ChurchFormData>({ name: '', address: '', pastor: '', logoUrl: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data.name.trim()) return;

        setIsSubmitting(true);
        // Explicitly wait for the boolean result from AppContext
        const success = await addChurch(data);
        setIsSubmitting(false);

        // Only clear and close if the backend operation succeeded
        if (success) {
            setData({ name: '', address: '', pastor: '', logoUrl: '' });
            onCancel();
        }
    };
    
    const handleLogoUpload = (file: File) => {
         if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setData(d => ({...d, logoUrl: e.target?.result as string}));
            reader.readAsDataURL(file);
        }
    };
    
    return (
        <div className="mb-4 p-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner animate-fade-in backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="church-name" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">{t('register.churchName')}</label>
                    <input type="text" id="church-name" value={data.name} onChange={e => setData(d => ({...d, name: e.target.value}))} className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 disabled:opacity-50" placeholder="Ex: Comunidade da Graça" required disabled={isSubmitting} />
                </div>
                 <div>
                    <label htmlFor="church-address" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">{t('register.address')}</label>
                    <input type="text" id="church-address" value={data.address} onChange={e => setData(d => ({...d, address: e.target.value}))} className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 disabled:opacity-50" placeholder="Ex: Av. da Paz, 456" disabled={isSubmitting} />
                </div>
                <div>
                    <label htmlFor="church-pastor" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">{t('register.pastor')}</label>
                    <input type="text" id="church-pastor" value={data.pastor} onChange={e => setData(d => ({...d, pastor: e.target.value}))} className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 disabled:opacity-50" placeholder="Ex: Pr. Maria Oliveira" disabled={isSubmitting} />
                </div>
                <div>
                    <label htmlFor="church-logo-upload" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1">{t('register.logo')}</label>
                    <div className="flex items-center space-x-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <img src={data.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} alt="Preview" className="w-10 h-10 rounded-lg object-cover bg-slate-100 ring-2 ring-slate-100 dark:ring-slate-700 shadow-sm" />
                        <label className={`cursor-pointer bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <span>Escolher arquivo</span>
                            <input type="file" id="church-logo-upload" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                        </label>
                    </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                    <button type="button" onClick={onCancel} disabled={isSubmitting} className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase disabled:opacity-50">{t('common.cancel')}</button>
                    <button type="submit" disabled={isSubmitting || !data.name.trim()} className="flex-1 py-2 px-3 border border-transparent rounded-xl shadow-lg shadow-indigo-500/20 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors uppercase disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Salvando...
                            </span>
                        ) : t('common.save')}
                    </button>
                </div>
            </form>
        </div>
    );
};

const ChurchesList: React.FC = () => {
    const { churches, openEditChurch, openDeleteConfirmation } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    const filteredChurches = useMemo(() => churches.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.pastor.toLowerCase().includes(search.toLowerCase())), [churches, search]);

    return (
        <div className="flex flex-col h-full">
            <div className="relative mb-4 flex-shrink-0">
                <SearchIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input type="text" placeholder={t('register.searchChurch')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 p-2.5 block w-full rounded-xl border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-inner backdrop-blur-sm text-sm" />
            </div>
            <ul className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0">
                {filteredChurches.map(church => (
                    <ListItem
                        key={church.id}
                        actions={
                             <>
                                <button
                                    onClick={() => openEditChurch(church)}
                                    className="p-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors"
                                    aria-label={`${t('common.edit')} ${church.name}`}
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                                <button
                                     onClick={() => openDeleteConfirmation({ type: 'church', id: church.id, name: church.name })}
                                     className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                                     aria-label={`${t('common.delete')} ${church.name}`}
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </>
                        }
                    >
                         <div className="flex items-center space-x-3">
                            <img 
                                src={church.logoUrl} 
                                alt={`Logo ${church.name}`} 
                                className="w-10 h-10 rounded-xl object-cover bg-slate-100 dark:bg-slate-700 flex-shrink-0 border border-slate-200 dark:border-slate-600 shadow-md" 
                            />
                            <div className="min-w-0">
                                <span className="block font-bold text-slate-800 dark:text-slate-200 text-base tracking-tight truncate">{church.name}</span>
                                {church.pastor && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center mt-0.5 truncate"><UserIcon className="w-3 h-3 mr-1 flex-shrink-0"/> {church.pastor}</span>}
                            </div>
                        </div>
                    </ListItem>
                ))}
            </ul>
        </div>
    );
};

// --- Main Register View ---
export const RegisterView: React.FC = () => {
    const { t } = useTranslation();
    const { subscription, refreshSubscription } = useAuth(); 
    const { banks, churches } = useContext(AppContext);
    
    const [showNewBankForm, setShowNewBankForm] = useState(false);
    const [showNewChurchForm, setShowNewChurchForm] = useState(false);

    // Auto-refresh subscription limits when viewing this page to ensure Admin updates are reflected immediately
    useEffect(() => {
        refreshSubscription();
    }, [refreshSubscription]);

    const bankLimitReached = banks.length >= (subscription.maxBanks || 1);
    const churchLimitReached = churches.length >= (subscription.maxChurches || 1);

    return (
        <div className="flex flex-col h-full lg:h-[calc(100vh-5.5rem)] animate-fade-in gap-4 pb-2">
            <div className="flex-shrink-0 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-indigo-800 dark:from-white dark:to-indigo-200 tracking-tight">{t('register.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{t('register.subtitle')}</p>
                </div>
                <button 
                    onClick={() => refreshSubscription()} 
                    className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" 
                    title="Atualizar limites"
                >
                    <ArrowsRightLeftIcon className="w-4 h-4" />
                </button>
            </div>
            
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Banks Column */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-700 h-full flex flex-col hover:shadow-2xl transition-all duration-500 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4 flex-shrink-0 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm">
                                <BuildingOfficeIcon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white leading-none">{t('register.manageBanks')}</h3>
                                <span className={`text-[10px] font-bold mt-1 ${bankLimitReached ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {banks.length} / {subscription.maxBanks || 1} utilizados
                                </span>
                            </div>
                        </div>
                        {!showNewBankForm && !bankLimitReached && (
                            <button onClick={() => setShowNewBankForm(true)} className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 transition-all"><PlusCircleIcon className="w-4 h-4" /><span>{t('common.new')}</span></button>
                        )}
                    </div>
                    
                    <div className="flex-1 min-h-0 flex flex-col relative z-10">
                        {showNewBankForm && <BankForm onCancel={() => setShowNewBankForm(false)} />}
                        <div className="flex-1 min-h-0">
                            <BanksList />
                        </div>
                    </div>
                </div>

                {/* Churches Column */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-700 h-full flex flex-col hover:shadow-2xl transition-all duration-500 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4 flex-shrink-0 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm">
                                <UserIcon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white leading-none">{t('register.manageChurches')}</h3>
                                <span className={`text-[10px] font-bold mt-1 ${churchLimitReached ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {churches.length} / {subscription.maxChurches || 1} utilizados
                                </span>
                            </div>
                        </div>
                        {!showNewChurchForm && !churchLimitReached && (
                             <button onClick={() => setShowNewChurchForm(true)} className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all"><PlusCircleIcon className="w-4 h-4" /><span>{t('common.new')}</span></button>
                        )}
                    </div>
                    
                    <div className="flex-1 min-h-0 flex flex-col relative z-10">
                        {showNewChurchForm && <ChurchForm onCancel={() => setShowNewChurchForm(false)} />}
                        <div className="flex-1 min-h-0">
                            <ChurchesList />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
