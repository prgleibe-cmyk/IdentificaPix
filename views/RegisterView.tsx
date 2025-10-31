// React e hooks padrão
import React, { useContext, useState, useMemo, memo, useEffect } from 'react';

// Componentes UI internos (você pode ajustar conforme seu projeto)
import { SearchIcon, PlusCircleIcon, PencilIcon, TrashIcon } from '../components/Icons';

// Contextos e hooks
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';

// Tipos
import { ChurchFormData } from '../types';

// Supabase
import { supabase } from '../services/supabaseClient';

// --- Temporary ErrorBoundary for diagnostics ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: undefined };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, info: any) {
        console.error('ErrorBoundary caught error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6">
                    <h3 className="text-xl font-semibold text-red-700">Ocorreu um erro ao abrir o formulário</h3>
                    <p className="mt-2 text-sm text-slate-600">
                        Detalhes foram registrados no console do navegador. Não se preocupe — já capturei para diagnóstico.
                    </p>
                    <pre className="mt-4 p-3 bg-slate-100 rounded">{String(this.state.error)}</pre>
                </div>
            );
        }
        return this.props.children as any;
    }
}

// --- Reusable List Item ---
interface ListItemProps { children: React.ReactNode; actions: React.ReactNode; }
const ListItem: React.FC<ListItemProps> = memo(({ children, actions }) => (
    <li className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-md">
        <div className="flex-1 min-w-0 pr-4">{children}</div>
        <div className="flex-shrink-0 flex items-center space-x-3">{actions}</div>
    </li>
));

// --- Confirm Delete Modal ---
const ConfirmDeleteModal: React.FC<{ type: 'bank' | 'church'; id: string; name: string; onClose: () => void }> =
({ type, id, name, onClose }) => {
    const ctx = useContext(AppContext);
    const { banks = [], setBanks = () => {}, churches = [], setChurches = () => {} } = ctx || {};
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
const EditBankModal: React.FC<{ bankId: string; currentName: string; onClose: () => void }> =
({ bankId, currentName, onClose }) => {
    const ctx = useContext(AppContext);
    const { banks = [], setBanks = () => {} } = ctx || {};
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
const EditChurchModal: React.FC<{ churchId: string; currentData: ChurchFormData; onClose: () => void }> =
({ churchId, currentData, onClose }) => {
    const ctx = useContext(AppContext);
    const { churches = [], setChurches = () => {} } = ctx || {};
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
    const ctx = useContext(AppContext);
    const { addBank = async () => {} } = ctx || {};
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
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Nome do banco" className="w-full p-2 border rounded-md"/>
            <div className="flex space-x-2">
                <button type="submit" disabled={isSaving} className="w-full py-2 px-4 bg-blue-700 text-white rounded-md">Salvar</button>
                <button type="button" onClick={onCancel} className="w-full py-2 px-4 border rounded-md">Cancelar</button>
            </div>
        </form>
    );
};

// --- Church Form ---
const ChurchForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const ctx = useContext(AppContext);
    const { addChurch = async () => {} } = ctx || {};
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
            <input type="text" value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} required placeholder="Nome da igreja" className="w-full p-2 border rounded-md"/>
            <input type="text" value={data.address} onChange={e => setData(d => ({ ...d, address: e.target.value }))} required placeholder="Endereço" className="w-full p-2 border rounded-md"/>
            <input type="text" value={data.pastor} onChange={e => setData(d => ({ ...d, pastor: e.target.value }))} required placeholder="Pastor" className="w-full p-2 border rounded-md"/>
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} className="w-full text-sm"/>
            <div className="flex space-x-2">
                <button type="submit" disabled={isSaving} className="w-full py-2 px-4 bg-blue-700 text-white rounded-md">Salvar</button>
                <button type="button" onClick={onCancel} className="w-full py-2 px-4 border rounded-md">Cancelar</button>
            </div>
        </form>
    );
};

// --- Banks List ---
const BanksList: React.FC<{ onEdit: (id:string,name:string)=>void; onDelete: (id:string,name:string)=>void }> = ({ onEdit, onDelete }) => {
    const ctx = useContext(AppContext);
    const { banks = [] } = ctx || {};
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const filteredBanks = useMemo(() => banks.filter(b => (b.name || '').toLowerCase().includes(search.toLowerCase())), [banks, search]);

    return (
        <div>
            <input type="text" placeholder="Buscar banco" value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 border rounded-md mb-2"/>
            <ul className="space-y-2 max-h-96 overflow-y-auto">
                {filteredBanks.map(bank => (
                    <ListItem key={bank.id} actions={
                        <>
                            <button onClick={() => onEdit(bank.id, bank.name)}>Editar</button>
                            <button onClick={() => onDelete(bank.id, bank.name)}>Excluir</button>
                        </>
                    }>
                        <span>{bank.name}</span>
                    </ListItem>
                ))}
            </ul>
        </div>
    );
};

// --- Churches List ---
const ChurchesList: React.FC<{ onEdit:(data:ChurchFormData,id:string)=>void; onDelete:(id:string,name:string)=>void }> = ({ onEdit, onDelete }) => {
    const ctx = useContext(AppContext);
    const { churches = [] } = ctx || {};
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const filteredChurches = useMemo(() => churches.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase())), [churches, search]);

    return (
        <div>
            <input type="text" placeholder="Buscar igreja" value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 border rounded-md mb-2"/>
            <ul className="space-y-2 max-h-96 overflow-y-auto">
                {filteredChurches.map(church => (
                    <ListItem key={church.id} actions={
                        <>
                            <button onClick={() => onEdit(church, church.id)}>Editar</button>
                            <button onClick={() => onDelete(church.id, church.name)}>Excluir</button>
                        </>
                    }>
                        <div className="flex items-center space-x-2">
                            <img src={church.logoUrl} alt={church.name} className="w-8 h-8 rounded-md"/>
                            <span>{church.name}</span>
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
    const [editingBank, setEditingBank] = useState<{id:string,name:string}|null>(null);
    const [editingChurch, setEditingChurch] = useState<{data:ChurchFormData,id:string}|null>(null);
    const [deletingItem, setDeletingItem] = useState<{type:'bank'|'church',id:string,name:string}|null>(null);

    return (
        <ErrorBoundary>
            <>
                <h2 className="text-2xl font-bold mb-2">Registro</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Banks Column */}
                    <div>
                        {!showNewBankForm && <button onClick={() => setShowNewBankForm(true)}>Novo Banco</button>}
                        {showNewBankForm && <BankForm onCancel={() => setShowNewBankForm(false)}/>}
                        <BanksList onEdit={(id,name)=>setEditingBank({id,name})} onDelete={(id,name)=>setDeletingItem({type:'bank',id,name})}/>
                    </div>
                    {/* Churches Column */}
                    <div>
                        {!showNewChurchForm && <button onClick={() => setShowNewChurchForm(true)}>Nova Igreja</button>}
                        {showNewChurchForm && <ChurchForm onCancel={() => setShowNewChurchForm(false)}/>}
                        <ChurchesList onEdit={(data,id)=>setEditingChurch({data,id})} onDelete={(id,name)=>setDeletingItem({type:'church',id,name})}/>
                    </div>
                </div>
                {/* Modals */}
                {editingBank && <EditBankModal bankId={editingBank.id} currentName={editingBank.name} onClose={()=>setEditingBank(null)}/>}
                {editingChurch && <EditChurchModal churchId={editingChurch.id} currentData={editingChurch.data} onClose={()=>setEditingChurch(null)}/>}
                {deletingItem && <ConfirmDeleteModal type={deletingItem.type} id={deletingItem.id} name={deletingItem.name} onClose={()=>setDeletingItem(null)}/>}
            </>
        </ErrorBoundary>
    );
};
