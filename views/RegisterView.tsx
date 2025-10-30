import React, { useContext, useState, useMemo, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { ChurchFormData } from '../types';
import { SearchIcon, PlusCircleIcon, PencilIcon, TrashIcon } from '../components/Icons';

// --- Reusable List Item ---
interface ListItemProps { children: React.ReactNode; actions: React.ReactNode; }
const ListItem: React.FC<ListItemProps> = memo(({ children, actions }) => (
    <li className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-md">
        <div className="flex-1 min-w-0 pr-4">{children}</div>
        <div className="flex-shrink-0 flex items-center space-x-3">{actions}</div>
    </li>
));

// --- Confirm Delete Modal ---
const ConfirmDeleteModal: React.FC<{ type: 'bank' | 'church'; id: string; name: string; onClose: () => void }> = ({ type, id, name, onClose }) => {
    const { banks, setBanks, churches, setChurches } = useContext(AppContext);
    const { t } = useTranslation();

    const handleDelete = () => {
        if (type === 'bank') setBanks(banks.filter(b => b.id !== id));
        else setChurches(churches.filter(c => c.id !== id));
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-96">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('common.confirmDelete')}</h3>
                <p className="mt-2 text-slate-700 dark:text-slate-300">{t('common.confirmDeleteMessage', { name })}</p>
                <div className="mt-4 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 border rounded-md text-slate-700 dark:text-slate-300">{t('common.cancel')}</button>
                    <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">{t('common.delete')}</button>
                </div>
            </div>
        </div>
    );
};

// --- Edit Bank Modal ---
const EditBankModal: React.FC<{ bankId: string; currentName: string; onClose: () => void }> = ({ bankId, currentName, onClose }) => {
    const { banks, setBanks } = useContext(AppContext);
    const { t } = useTranslation();
    const [name, setName] = useState(currentName);

    const handleSave = () => {
        setBanks(banks.map(b => (b.id === bankId ? { ...b, name } : b)));
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-96">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('common.editBank')}</h3>
                <input value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full p-2 border rounded-md"/>
                <div className="mt-4 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 border rounded-md text-slate-700 dark:text-slate-300">{t('common.cancel')}</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800">{t('common.save')}</button>
                </div>
            </div>
        </div>
    );
};

// --- Edit Church Modal ---
const EditChurchModal: React.FC<{ churchId: string; currentData: ChurchFormData; onClose: () => void }> = ({ churchId, currentData, onClose }) => {
    const { churches, setChurches } = useContext(AppContext);
    const { t } = useTranslation();
    const [data, setData] = useState<ChurchFormData>(currentData);

    const handleLogoUpload = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => setData(d => ({ ...d, logoUrl: e.target?.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        setChurches(churches.map(c => (c.id === churchId ? { ...c, ...data } : c)));
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-96 space-y-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('common.editChurch')}</h3>
                <input value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} className="w-full p-2 border rounded-md" placeholder={t('register.churchName')}/>
                <input value={data.address} onChange={e => setData(d => ({ ...d, address: e.target.value }))} className="w-full p-2 border rounded-md" placeholder={t('register.address')}/>
                <input value={data.pastor} onChange={e => setData(d => ({ ...d, pastor: e.target.value }))} className="w-full p-2 border rounded-md" placeholder={t('register.pastor')}/>
                <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="w-full text-sm text-slate-500"/>
                <div className="flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 border rounded-md text-slate-700 dark:text-slate-300">{t('common.cancel')}</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800">{t('common.save')}</button>
                </div>
            </div>
        </div>
    );
};

// --- Bank Components ---
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
                <input type="text" id="bank-name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" placeholder="Ex: Banco Digital X"/>
            </div>
            <div className="flex items-center space-x-2">
                <button type="submit" className="w-full py-2 px-4 bg-blue-700 text-white rounded-md hover:bg-blue-800">{t('common.save')}</button>
                <button type="button" onClick={onCancel} className="w-full py-2 px-4 border border-blue-700 text-blue-700 rounded-md hover:bg-blue-700 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white transition-colors">{t('common.cancel')}</button>
            </div>
        </form>
    );
};

const BanksList: React.FC<{ onEdit: (id:string,name:string)=>void; onDelete: (id:string,name:string)=>void }> = ({ onEdit, onDelete }) => {
    const { banks } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const filteredBanks = useMemo(() => banks.filter(b => b.name.toLowerCase().includes(search.toLowerCase())), [banks, search]);

    return (
        <div>
            <div className="relative mb-2">
                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2"/>
                <input type="text" placeholder={t('register.searchBank')} value={search} onChange={e => setSearch(e.target.value)} className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"/>
            </div>
            <ul className="mt-2 space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredBanks.map(bank => (
                    <ListItem key={bank.id}
                        actions={
                            <>
                                <button onClick={() => onEdit(bank.id, bank.name)} className="p-1 rounded-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"><PencilIcon className="w-5 h-5"/></button>
                                <button onClick={() => onDelete(bank.id, bank.name)} className="p-1 rounded-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 transition-colors"><TrashIcon className="w-5 h-5"/></button>
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

// --- Church Components ---
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
            reader.onload = e => setData(d => ({ ...d, logoUrl: e.target?.result as string }));
            reader.readAsDataURL(file);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
            <div>
                <label htmlFor="church-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.churchName')}</label>
                <input type="text" id="church-name" value={data.name} onChange={e => setData(d => ({...d, name: e.target.value}))} required className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" placeholder="Ex: Comunidade da Graça"/>
            </div>
            <div>
                <label htmlFor="church-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.address')}</label>
                <input type="text" id="church-address" value={data.address} onChange={e => setData(d => ({...d, address: e.target.value}))} required className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" placeholder="Ex: Av. da Paz, 456"/>
            </div>
            <div>
                <label htmlFor="church-pastor" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.pastor')}</label>
                <input type="text" id="church-pastor" value={data.pastor} onChange={e => setData(d => ({...d, pastor: e.target.value}))} required className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400" placeholder="Ex: Pr. Maria Oliveira"/>
            </div>
            <div>
                <label htmlFor="church-logo-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.logo')}</label>
                <div className="mt-1 flex items-center space-x-4">
                    <img src={data.logoUrl || 'https://placehold.co/100x100/e2e8f0/64748b?text=?'} alt="Pré-visualização do logo" className="w-16 h-16 rounded-md object-cover bg-slate-200"/>
                    <input type="file" id="church-logo-upload" accept="image/*" onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
                <button type="submit" className="w-full py-2 px-4 bg-blue-700 text-white rounded-md hover:bg-blue-800">{t('common.save')}</button>
                <button type="button" onClick={onCancel} className="w-full py-2 px-4 border border-blue-700 text-blue-700 rounded-md hover:bg-blue-700 hover:text-white transition-colors">{t('common.cancel')}</button>
            </div>
        </form>
    );
};

const ChurchesList: React.FC<{ onEdit:(data:ChurchFormData,id:string)=>void; onDelete:(id:string,name:string)=>void }> = ({ onEdit, onDelete }) => {
    const { churches } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    const filteredChurches = useMemo(() => churches.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.pastor.toLowerCase().includes(search.toLowerCase())), [churches, search]);

    return (
        <div>
            <div className="relative mb-2">
                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2"/>
                <input type="text" placeholder={t('register.searchChurch')} value={search} onChange={e => setSearch(e.target.value)} className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"/>
            </div>
            <ul className="mt-2 space-y-3 max-h-96 overflow-y-auto pr-1">
                {filteredChurches.map(church => (
                    <ListItem key={church.id}
                        actions={
                            <>
                                <button onClick={() => onEdit(church, church.id)} className="p-1 rounded-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"><PencilIcon className="w-5 h-5"/></button>
                                <button onClick={() => onDelete(church.id, church.name)} className="p-1 rounded-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 transition-colors"><TrashIcon className="w-5 h-5"/></button>
                            </>
                        }
                    >
                        <div className="flex items-center space-x-3">
                            <img src={church.logoUrl} alt={`Logo ${church.name}`} className="w-8 h-8 rounded-md object-cover bg-slate-200 flex-shrink-0"/>
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

    // Modals
    const [editingBank, setEditingBank] = useState<{id:string,name:string}|null>(null);
    const [editingChurch, setEditingChurch] = useState<{data:ChurchFormData,id:string}|null>(null);
    const [deletingItem, setDeletingItem] = useState<{type:'bank'|'church',id:string,name:string}|null>(null);

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
                            <button onClick={() => setShowNewBankForm(true)} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"><PlusCircleIcon className="w-4 h-4"/><span>{t('common.new')}</span></button>
                        )}
                    </div>
                    {showNewBankForm && <BankForm onCancel={() => setShowNewBankForm(false)}/>}
                    <BanksList onEdit={(id,name)=>setEditingBank({id,name})} onDelete={(id,name)=>setDeletingItem({type:'bank',id,name})}/>
                </div>
                {/* Churches Column */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700 mb-4">
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">{t('register.manageChurches')}</h3>
                        {!showNewChurchForm && (
                            <button onClick={() => setShowNewChurchForm(true)} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"><PlusCircleIcon className="w-4 h-4"/><span>{t('common.new')}</span></button>
                        )}
                    </div>
                    {showNewChurchForm && <ChurchForm onCancel={() => setShowNewChurchForm(false)}/>}
                    <ChurchesList onEdit={(data,id)=>setEditingChurch({data,id})} onDelete={(id,name)=>setDeletingItem({type:'church',id,name})}/>
                </div>
            </div>

            {/* Modals */}
            {editingBank && <EditBankModal bankId={editingBank.id} currentName={editingBank.name} onClose={()=>setEditingBank(null)}/>}
            {editingChurch && <EditChurchModal churchId={editingChurch.id} currentData={editingChurch.data} onClose={()=>setEditingChurch(null)}/>}
            {deletingItem && <ConfirmDeleteModal type={deletingItem.type} id={deletingItem.id} name={deletingItem.name} onClose={()=>setDeletingItem(null)}/>}
        </>
    );
};
