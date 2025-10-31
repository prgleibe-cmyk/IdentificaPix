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
            // Aqui poderia ser async se você usar Supabase
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
            {/* Inputs here (name, address, pastor, logo) */}
            <div className="flex items-center space-x-2 pt-2">
                <button type="submit" disabled={isSaving} className="w-full py-2 px-4 bg-blue-700 text-white rounded-md hover:bg-blue-800">{t('common.save')}</button>
                <button type="button" onClick={onCancel} className="w-full py-2 px-4 border border-blue-700 text-blue-700 rounded-md hover:bg-blue-700 hover:text-white transition-colors">{t('common.cancel')}</button>
            </div>
        </form>
    );
};

