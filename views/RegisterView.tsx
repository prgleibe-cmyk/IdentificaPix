import React, { useContext, useState, useMemo, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { Church, Bank, ChurchFormData } from '../types';
import { SearchIcon, PlusCircleIcon, BuildingOfficeIcon, UserIcon, PencilIcon, TrashIcon } from '../components/Icons';


// --- Reusable List Item with Robust Layout ---
// This component uses a proper flexbox layout to prevent content
// from overlapping action buttons, definitively fixing the delete button bug.
interface ListItemProps {
    children: React.ReactNode;
    actions: React.ReactNode;
}
const ListItem: React.FC<ListItemProps> = memo(({ children, actions }) => (
    <li className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-md">
        <div className="flex-1 min-w-0 pr-4">{children}</div>
        <div className="flex-shrink-0 flex items-center space-x-3">{actions}</div>
    </li>
));

// --- Bank Management Components ---
const BankForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addBank } = useContext(AppContext);
    const { t } = useTranslation();
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addBank(name);
        setName('');
        onCancel();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
            <div>
                <label htmlFor="bank-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.bankName')}</label>
                <input type="text" id="bank-name" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" placeholder="Ex: Banco Digital X" required />
            </div>
            <div className="flex items-center space-x-2">
                <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600">{t('common.save')}</button>
                <button type="button" onClick={onCancel} className="w-full flex justify-center py-2 px-4 border border-blue-700 rounded-md shadow-sm text-sm font-medium text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors">{t('common.cancel')}</button>
            </div>
        </form>
    );
};

const BanksList: React.FC = () => {
    const { banks, openEditBank, openDeleteConfirmation } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const filteredBanks = useMemo(() => banks.filter(b => b.name.toLowerCase().includes(search.toLowerCase())), [banks, search]);

    return (
        <div>
            <div className="relative mb-2">
                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input type="text" placeholder={t('register.searchBank')} value={search} onChange={e => setSearch(e.target.value)} className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" />
            </div>
            <ul className="mt-2 space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredBanks.map(bank => (
                    <ListItem
                        key={bank.id}
                        actions={
                             <>
                                <button
                                    onClick={() => openEditBank(bank)}
                                    className="p-1 rounded-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                    aria-label={`${t('common.edit')} ${bank.name}`}
                                >
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <button
                                     onClick={() => openDeleteConfirmation({ type: 'bank', id: bank.id, name: bank.name })}
                                     className="p-1 rounded-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 transition-colors"
                                     aria-label={`${t('common.delete')} ${bank.name}`}
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </>
                        }
                    >
                        <span className="truncate text-slate-700 dark:text-slate-300">{bank.name}</span>
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
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addChurch(data);
        setData({ name: '', address: '', pastor: '', logoUrl: '' });
        onCancel();
    };
    
    const handleLogoUpload = (file: File) => {
         if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setData(d => ({...d, logoUrl: e.target?.result as string}));
            reader.readAsDataURL(file);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
             <div>
                <label htmlFor="church-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.churchName')}</label>
                <input type="text" id="church-name" value={data.name} onChange={e => setData(d => ({...d, name: e.target.value}))} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" placeholder="Ex: Comunidade da Graça" required />
            </div>
             <div>
                <label htmlFor="church-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.address')}</label>
                <input type="text" id="church-address" value={data.address} onChange={e => setData(d => ({...d, address: e.target.value}))} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" placeholder="Ex: Av. da Paz, 456" required />
            </div>
            <div>
                <label htmlFor="church-pastor" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.pastor')}</label>
                <input type="text" id="church-pastor" value={data.pastor} onChange={e => setData(d => ({...d, pastor: e.target.value}))} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" placeholder="Ex: Pr. Maria Oliveira" required />
            </div>
            <div>
                <label htmlFor="church-logo-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.logo')}</label>
                <div className="mt-1 flex items-center space-x-4">
                    <img src={data.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} alt="Pré-visualização do logo" className="w-16 h-16 rounded-md object-cover bg-slate-200" />
                    <input type="file" id="church-logo-upload" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-700 dark:file:text-blue-300 dark:hover:file:bg-slate-600" />
                </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
                <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600">{t('common.save')}</button>
                <button type="button" onClick={onCancel} className="w-full flex justify-center py-2 px-4 border border-blue-700 rounded-md shadow-sm text-sm font-medium text-blue-700 hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors">{t('common.cancel')}</button>
            </div>
        </form>
    );
};

const ChurchesList: React.FC = () => {
    const { churches, openEditChurch, openDeleteConfirmation } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    const filteredChurches = useMemo(() => churches.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.pastor.toLowerCase().includes(search.toLowerCase())), [churches, search]);

    return (
        <div>
            <div className="relative mb-2">
                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input type="text" placeholder={t('register.searchChurch')} value={search} onChange={e => setSearch(e.target.value)} className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" />
            </div>
            <ul className="mt-2 space-y-3 max-h-96 overflow-y-auto pr-1">
                {filteredChurches.map(church => (
                    <ListItem
                        key={church.id}
                        actions={
                             <>
                                <button
                                    onClick={() => openEditChurch(church)}
                                    className="p-1 rounded-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                    aria-label={`${t('common.edit')} ${church.name}`}
                                >
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <button
                                     onClick={() => openDeleteConfirmation({ type: 'church', id: church.id, name: church.name })}
                                     className="p-1 rounded-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 transition-colors"
                                     aria-label={`${t('common.delete')} ${church.name}`}
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </>
                        }
                    >
                         <div className="flex items-center space-x-3">
                            <img 
                                src={church.logoUrl} 
                                alt={`Logo ${church.name}`} 
                                className="w-8 h-8 rounded-md object-cover bg-slate-200 dark:bg-slate-700 flex-shrink-0" 
                            />
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{church.name}</span>
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
    const [showNewBankForm, setShowNewBankForm] = useState(false);
    const [showNewChurchForm, setShowNewChurchForm] = useState(false);

    return (
        <>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{t('register.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{t('register.subtitle')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Banks Column */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700 mb-4">
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">{t('register.manageBanks')}</h3>
                        {!showNewBankForm && (
                            <button onClick={() => setShowNewBankForm(true)} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"><PlusCircleIcon className="w-4 h-4" /><span>{t('common.new')}</span></button>
                        )}
                    </div>
                    {showNewBankForm && <BankForm onCancel={() => setShowNewBankForm(false)} />}
                    <BanksList />
                </div>
                {/* Churches Column */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700 mb-4">
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">{t('register.manageChurches')}</h3>
                        {!showNewChurchForm && (
                             <button onClick={() => setShowNewChurchForm(true)} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"><PlusCircleIcon className="w-4 h-4" /><span>{t('common.new')}</span></button>
                        )}
                    </div>
                    {showNewChurchForm && <ChurchForm onCancel={() => setShowNewChurchForm(false)} />}
                    <ChurchesList />
                </div>
            </div>
        </>
    );
};