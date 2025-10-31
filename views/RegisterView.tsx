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
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            setBanks(banks.map(b => (b.id === bankId ? { ...b, name } : b)));
        } finally {
            setIsSaving(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-96">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('common.editBank')}</h3>
                <input value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full p-2 border rounded-md"/>
                <div className="mt-4 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 border rounded-md text-slate-700 dark:text-slate-300">{t('common.cancel')}</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800">{t('common.save')}</button>
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
    const [isSaving, setIsSaving] = useState(false);

    const handleLogoUpload = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => setData(d => ({ ...d, logoUrl: e.target?.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            setChurches(churches.map(c => (c.id === churchId ? { ...c, ...data } : c)));
        } finally {
            setIsSaving(false);
            onClose();
        }
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
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800">{t('common.save')}</button>
                </div>
            </div>
        </div>
    );
};

// --- Bank Form ---
const BankForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addBank } = useContext(AppContext);
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await addBank({ name });
            setName('');
            onCancel();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
            <div>
                <label htmlFor="bank-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('register.bankName')}</label>
                <input type="text" id="bank-name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-600 sm:text-sm placeholder:text-slate-400"/>
            </div>
            <div className="flex items-center space-x-2">
                <button type="submit" disabled={isSaving} className="w-full py-2 px-4 bg-blue-700 text-white rounded-md hover:bg-blue-800">{t('common.save')}</button>
                <button type="button" onClick={onCancel} className="w-full py-2 px-4 border border-blue-700 text-blue-700 rounded-md hover:bg-blue-700 hover:text-white transition-colors">{t('common.cancel')}</button>
            </div>
        </form>
    );
};

// --- Church Form ---
const ChurchForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { addChurch } = useContext(AppContext);
    const { t } = useTranslation();
    const [data, setData] = useState<ChurchFormData>({ name: '', address: '', pastor: '', logoUrl: '' });
    const [isSaving, setIsSaving] = useState(false);

    const handleLogoUpload = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => setData(d => ({ ...d, logoUrl: e.target?.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await addChurch(data);
            setData({ name: '', address: '', pastor: '', logoUrl: '' });
            onCancel();
        } finally {
            setIsSaving(false);
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
                <button type="submit" disabled={isSaving} className="w-full py-2 px-4 bg-blue-700 text-white rounded-md hover:bg-blue-800">{t('common.save')}</button>
                <button type="button" onClick={onCancel} className="w-full py-2 px-4 border border-blue-700 text-blue-700 rounded-md hover:bg-blue-700 hover:text-white transition-colors">{t('common.cancel')}</button>
            </div>
        </form>
    );
};

// --- Banks List ---
const BanksList: React.FC<{ onEdit: (id:string,name:string)=>void; onDelete: (id:string,name:string)=>void }> = ({ onEdit, onDelete }) => {
    const { banks } = useContext(AppContext);
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const filteredBanks = useMemo(() => banks.filter(b => b.name.toLowerCase().includes(search.toLowerCase())), [banks, search]);

    return (
        <div>
            <div className="relative mb-2">
                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2"/>
                <input type="text" placeholder={t('register.searchBank')} value={search} onChange={e=>setSearch(e.target.value)} className="pl-10 pr-2 py-1 w-full border rounded-md"/>
            </div>
            <ul className="space-y-2">
                {filteredBanks.map(b => (
                    <ListItem key={b.id} actions={
                        <>
                            <button onClick={()=>onEdit(b.id,b.name)}><PencilIcon className="w-4 h-4"/></button>
                            <button onClick={()=>onDelete(b.id,b.name)}><TrashIcon className="w-4 h-4 text-red-600"/></button>
                        </>
                    }>{b.name}</ListItem>
                ))}
            </ul>
        </div>
    );
};

// --- Churches List ---
const ChurchesList: React.FC<{ onEdit: (id:string,data:ChurchFormData)=>void; onDelete: (id:string,name:string)=>void }> = ({ onEdit, onDelete }) => {
    const { churches } = useContext(AppContext);
    const { t } = useTranslation();
    const [search,setSearch] = useState('');
    const filtered = useMemo(()=> churches.filter(c => c.name.toLowerCase().includes(search.toLowerCase())), [churches,search]);

    return (
        <div>
            <div className="relative mb-2">
                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2"/>
                <input type="text" placeholder={t('register.searchChurch')} value={search} onChange={e=>setSearch(e.target.value)} className="pl-10 pr-2 py-1 w-full border rounded-md"/>
            </div>
            <ul className="space-y-2">
                {filtered.map(c => (
                    <ListItem key={c.id} actions={
                        <>
                            <button onClick={()=>onEdit(c.id,c)}><PencilIcon className="w-4 h-4"/></button>
                            <button onClick={()=>onDelete(c.id,c.name)}><TrashIcon className="w-4 h-4 text-red-600"/></button>
                        </>
                    }>
                        <div className="flex items-center space-x-2">
                            {c.logoUrl && <img src={c.logoUrl} alt="Logo" className="w-8 h-8 object-cover rounded"/>}
                            <span>{c.name}</span>
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
    const [showBankForm,setShowBankForm] = useState(false);
    const [showChurchForm,setShowChurchForm] = useState(false);
    const [editingBank,setEditingBank] = useState<{id:string,name:string}|null>(null);
    const [editingChurch,setEditingChurch] = useState<{id:string,data:ChurchFormData}|null>(null);
    const [deleting,setDeleting] = useState<{type:'bank'|'church',id:string,name:string}|null>(null);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-md shadow">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-semibold">{t('register.banks')}</h2>
                    <button onClick={()=>setShowBankForm(prev=>!prev)} className="flex items-center space-x-1 text-blue-700 hover:underline">
                        <PlusCircleIcon className="w-5 h-5"/><span>{t('common.add')}</span>
                    </button>
                </div>
                {showBankForm && <BankForm onCancel={()=>setShowBankForm(false)}/>}
                <BanksList onEdit={(id,name)=>setEditingBank({id,name})} onDelete={(id,name)=>setDeleting({type:'bank',id,name})}/>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-md shadow">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-semibold">{t('register.churches')}</h2>
                    <button onClick={()=>setShowChurchForm(prev=>!prev)} className="flex items-center space-x-1 text-blue-700 hover:underline">
                        <PlusCircleIcon className="w-5 h-5"/><span>{t('common.add')}</span>
                    </button>
                </div>
                {showChurchForm && <ChurchForm onCancel={()=>setShowChurchForm(false)}/>}
                <ChurchesList onEdit={(id,data)=>setEditingChurch({id,data})} onDelete={(id,name)=>setDeleting({type:'church',id,name})}/>
            </div>

            {editingBank && <EditBankModal bankId={editingBank.id} currentName={editingBank.name} onClose={()=>setEditingBank(null)}/>}
            {editingChurch && <EditChurchModal churchId={editingChurch.id} currentData={editingChurch.data} onClose={()=>setEditingChurch(null)}/>}
            {deleting && <ConfirmDeleteModal type={deleting.type} id={deleting.id} name={deleting.name} onClose={()=>setDeleting(null)}/>}
        </div>
    );
};
