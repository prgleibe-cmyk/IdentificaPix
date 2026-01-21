import React, { useContext, useState, useMemo, memo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { Church, Bank, ChurchFormData } from '../types';
import { SearchIcon, PlusCircleIcon, BuildingOfficeIcon, UserIcon, PencilIcon, TrashIcon, ArrowsRightLeftIcon, XMarkIcon, BanknotesIcon, BrainIcon, CreditCardIcon } from '../components/Icons';


// --- Reusable List Item with Robust Layout ---
interface ListItemProps {
    children: React.ReactNode;
    actions: React.ReactNode;
}
const ListItem: React.FC<ListItemProps> = memo(({ children, actions }) => (
    <li className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 p-2 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 hover:-translate-y-0.5 transition-all duration-300 group gap-2 sm:gap-0">
        <div className="flex-1 min-w-0 pr-0 sm:pr-2">{children}</div>
        <div className="flex-shrink-0 flex items-center justify-end space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 sm:transform sm:translate-x-2 sm:group-hover:translate-x-0">{actions}</div>
    </li>
));

// --- Bank Management Components ---
const BankModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addBank } = useContext(AppContext);
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        
        setIsSubmitting(true);
        const success = await addBank(name);
        setIsSubmitting(false);
        
        if (success) {
            setName('');
            onCancel();
        }
    };

    return (
        <div className="fixed inset-0 bg-brand-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 transform transition-all scale-100 flex flex-col max-h-[90vh]">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-brand-graphite dark:text-white tracking-tight">{t('register.bankName')}</h3>
                            <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-5">
                            <div>
                                <label htmlFor="bank-name" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1">{t('register.bankName')}</label>
                                <input 
                                    type="text" 
                                    id="bank-name" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" 
                                    placeholder="Ex: Banco Digital X" 
                                    required 
                                    disabled={isSubmitting}
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-[2rem] border-t border-slate-100 dark:border-slate-700/50 mt-auto">
                        <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase disabled:opacity-50 tracking-wide">{t('common.cancel')}</button>
                        <button type="submit" disabled={isSubmitting || !name.trim()} className="px-6 py-2.5 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:bg-emerald-700 transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 tracking-wide">
                            {isSubmitting ? 'Salvando...' : t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
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
            <div className="relative mb-2 flex-shrink-0">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input type="text" placeholder={t('register.searchBank')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 p-2 block w-full rounded-lg border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900 text-[11px] font-medium outline-none" />
            </div>
            <ul className="space-y-1.5 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0">
                {filteredBanks.map(bank => (
                    <ListItem
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
                    </ListItem>
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

// --- Church Management Components ---
const ChurchModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addChurch } = useContext(AppContext);
    const { t } = useTranslation();
    const [data, setData] = useState<ChurchFormData>({ name: '', address: '', pastor: '', logoUrl: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data.name.trim()) return;

        setIsSubmitting(true);
        const success = await addChurch(data);
        setIsSubmitting(false);

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
        <div className="fixed inset-0 bg-brand-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 transform transition-all scale-100 flex flex-col max-h-[90vh]">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-brand-graphite dark:text-white tracking-tight">{t('register.churchName')}</h3>
                            <button type="button" onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                             <div>
                                <label htmlFor="church-name" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{t('register.churchName')}</label>
                                <input type="text" id="church-name" value={data.name} onChange={e => setData(d => ({...d, name: e.target.value}))} className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" placeholder="Ex: Comunidade da Graça" required disabled={isSubmitting} />
                            </div>
                             <div>
                                <label htmlFor="church-address" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{t('register.address')}</label>
                                <input type="text" id="church-address" value={data.address} onChange={e => setData(d => ({...d, address: e.target.value}))} className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" placeholder="Ex: Av. da Paz, 456" disabled={isSubmitting} />
                            </div>
                            <div>
                                <label htmlFor="church-pastor" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{t('register.pastor')}</label>
                                <input type="text" id="church-pastor" value={data.pastor} onChange={e => setData(d => ({...d, pastor: e.target.value}))} className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" placeholder="Ex: Pr. Maria Oliveira" disabled={isSubmitting} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1">{t('register.logo')}</label>
                                <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <img src={data.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} alt="Preview" className="w-12 h-12 rounded-xl object-cover bg-white shadow-sm" />
                                    <label className={`cursor-pointer bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <span>Escolher arquivo</span>
                                        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-[2rem] border-t border-slate-100 dark:border-slate-700/50 mt-auto">
                        <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase disabled:opacity-50 tracking-wide">{t('common.cancel')}</button>
                        <button type="submit" disabled={isSubmitting || !data.name.trim()} className="px-6 py-2.5 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:bg-emerald-700 transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 tracking-wide">
                            {isSubmitting ? 'Salvando...' : t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
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
            <div className="relative mb-2 flex-shrink-0">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input type="text" placeholder={t('register.searchChurch')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 p-2 block w-full rounded-lg border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900 text-[11px] font-medium outline-none" />
            </div>
            <ul className="space-y-1.5 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0">
                {filteredChurches.map(church => (
                    <ListItem
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
                                {church.pastor && <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center mt-0.5 truncate"><UserIcon className="w-2.5 h-2.5 mr-1 flex-shrink-0 text-slate-400"/> {church.pastor}</span>}
                            </div>
                        </div>
                    </ListItem>
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

// --- Contribution Types Management Component ---
const ContributionTypesList: React.FC = () => {
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
                {contributionKeywords.map(keyword => (
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

// --- Payment Methods Management Component ---
const PaymentMethodsList: React.FC = () => {
    const { paymentMethods, addPaymentMethod, removePaymentMethod } = useContext(AppContext);
    const [newMethod, setNewMethod] = useState('');

    const handleAddMethod = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMethod.trim()) return;
        addPaymentMethod(newMethod);
        setNewMethod('');
    };
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-brand-blue dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                        <CreditCardIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Formas de Recebimento</h3>
                        <span className="text-[9px] font-bold text-brand-blue mt-1 block uppercase">{paymentMethods.length} ativas</span>
                    </div>
                </div>
            </div>
            
            <div className="flex-shrink-0 mb-3">
                <form onSubmit={handleAddMethod} className="relative">
                    <input
                        type="text"
                        value={newMethod}
                        onChange={(e) => setNewMethod(e.target.value)}
                        placeholder="Ex: PIX, CARTÃO, DINHEIRO..."
                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white py-2 pl-4 pr-16 font-medium transition-all text-[11px] outline-none focus:ring-2 focus:ring-brand-blue/20"
                    />
                    <button type="submit" disabled={!newMethod.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-brand-blue text-white text-[9px] font-bold uppercase rounded-lg shadow-md active:scale-95 transition-all">OK</button>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-1">
                {paymentMethods.map(method => (
                    <div key={method} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl shadow-sm hover:border-brand-blue/30 transition-all group">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{method}</span>
                        <button onClick={() => removePaymentMethod(method)} className="p-1 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>
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
    
    // ABA ATIVA: 'banks' | 'churches' | 'contribution' | 'payment'
    const [activeTab, setActiveTab] = useState<'banks' | 'churches' | 'contribution' | 'payment'>('banks');

    useEffect(() => {
        refreshSubscription();
    }, [refreshSubscription]);

    const bankLimitReached = banks.length >= (subscription.maxBanks || 1);
    const churchLimitReached = churches.length >= (subscription.maxChurches || 1);

    // Helper para botões de aba
    const TabButton = ({ id, label, icon: Icon, colorTheme }: any) => {
        const isActive = activeTab === id;
        let activeClass = "";
        let iconClass = "";
        
        switch (colorTheme) {
            case 'blue': 
                activeClass = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30"; 
                iconClass = isActive ? "text-white" : "text-blue-500"; 
                break;
            case 'emerald': 
                activeClass = "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30"; 
                iconClass = isActive ? "text-white" : "text-emerald-500"; 
                break;
            case 'violet': 
                activeClass = "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-purple-500/30"; 
                iconClass = isActive ? "text-white" : "text-violet-500"; 
                break;
            case 'amber': 
                activeClass = "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/30"; 
                iconClass = isActive ? "text-white" : "text-amber-500"; 
                break;
            default: 
                activeClass = "bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-md"; 
                iconClass = isActive ? "text-white" : "text-slate-500"; 
                break;
        }

        return (
            <button 
                onClick={() => setActiveTab(id)} 
                className={`
                    relative flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-wide
                    ${isActive ? `${activeClass} transform scale-105 z-10 border-transparent` : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"}
                `}
            >
                <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mt-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight">{t('register.title')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px]">{t('register.subtitle')}</p>
                </div>

                {/* NAVEGAÇÃO POR ABAS NO CABEÇALHO */}
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-full border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
                    <TabButton id="banks" label={t('register.manageBanks')} icon={BuildingOfficeIcon} colorTheme="blue" />
                    <TabButton id="churches" label={t('register.manageChurches')} icon={UserIcon} colorTheme="violet" />
                    <TabButton id="contribution" label="Tipo Contribuição" icon={BanknotesIcon} colorTheme="emerald" />
                    <TabButton id="payment" label="Forma Recebimento" icon={CreditCardIcon} colorTheme="amber" />
                </div>

                <button 
                    onClick={() => refreshSubscription()} 
                    className="hidden md:block p-1.5 text-slate-400 hover:text-brand-blue hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" 
                    title="Atualizar limites"
                >
                    <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                </button>
            </div>
            
            <div className="flex-1 min-h-0">
                {/* Banks View */}
                {activeTab === 'banks' && (
                    <div 
                        className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 h-full flex flex-col hover:shadow-soft transition-all duration-500 relative overflow-hidden animate-fade-in-up"
                    >
                        <div className="flex justify-between items-center mb-6 flex-shrink-0 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-brand-blue dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                    <BuildingOfficeIcon className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-base text-slate-800 dark:text-white leading-none">{t('register.manageBanks')}</h3>
                                    <span className={`text-xs font-bold mt-1 ${bankLimitReached ? 'text-red-500' : 'text-emerald-500'}`}>
                                        Registrados: {banks.length} / {subscription.maxBanks || 1}
                                    </span>
                                </div>
                            </div>
                            {!bankLimitReached && (
                                <button onClick={() => setShowNewBankForm(true)} className="flex items-center space-x-1.5 px-4 py-2 text-[10px] font-bold text-white bg-gradient-to-l from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 rounded-full active:bg-blue-700 shadow-md shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all transform active:scale-[0.98] tracking-wide uppercase">
                                    <PlusCircleIcon className="w-3.5 h-3.5" /><span>{t('common.new')}</span>
                                </button>
                            )}
                        </div>
                        <div className="flex-1 min-h-0">
                            <BanksList />
                        </div>
                    </div>
                )}

                {/* Churches View */}
                {activeTab === 'churches' && (
                    <div 
                        className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 h-full flex flex-col hover:shadow-soft transition-all duration-500 relative overflow-hidden animate-fade-in-up"
                    >
                        <div className="flex justify-between items-center mb-6 flex-shrink-0 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                    <UserIcon className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-base text-slate-800 dark:text-white leading-none">{t('register.manageChurches')}</h3>
                                    <span className={`text-xs font-bold mt-1 ${churchLimitReached ? 'text-red-500' : 'text-emerald-500'}`}>
                                        Registradas: {churches.length} / {subscription.maxChurches || 1}
                                    </span>
                                </div>
                            </div>
                            {!churchLimitReached && (
                                <button onClick={() => setShowNewChurchForm(true)} className="flex items-center space-x-1.5 px-4 py-2 text-[10px] font-bold text-white bg-gradient-to-l from-indigo-700 to-indigo-500 hover:from-indigo-800 hover:to-indigo-600 rounded-full active:bg-indigo-700 shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all transform active:scale-[0.98] tracking-wide uppercase">
                                    <PlusCircleIcon className="w-3.5 h-3.5" /><span>{t('common.new')}</span>
                                </button>
                            )}
                        </div>
                        <div className="flex-1 min-h-0">
                            <ChurchesList />
                        </div>
                    </div>
                )}

                {/* Contribution Type View */}
                {activeTab === 'contribution' && (
                    <div 
                        className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 h-full flex flex-col hover:shadow-soft transition-all duration-500 relative overflow-hidden animate-fade-in-up"
                    >
                        <div className="flex-1 min-h-0">
                            <ContributionTypesList />
                        </div>
                    </div>
                )}

                {/* Payment Method View */}
                {activeTab === 'payment' && (
                    <div 
                        className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 h-full flex flex-col hover:shadow-soft transition-all duration-500 relative overflow-hidden animate-fade-in-up"
                    >
                        <div className="flex-1 min-h-0">
                            <PaymentMethodsList />
                        </div>
                    </div>
                )}
            </div>

            {/* Modals for New Entities */}
            {showNewBankForm && <BankModal onCancel={() => setShowNewBankForm(false)} />}
            {showNewChurchForm && <ChurchModal onCancel={() => setShowNewChurchForm(false)} />}
        </div>
    );
};
