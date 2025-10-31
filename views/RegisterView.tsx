// React e hooks
import React, { useContext, useState, useEffect, useMemo, memo } from 'react';

// Contextos
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';

// Tipos
import { ChurchFormData } from '../types';

// Ícones
import { SearchIcon, PlusCircleIcon, PencilIcon, TrashIcon } from '../components/Icons';

// Modals (corrigido: named imports)
import { ConfirmDeleteModal } from '../components/modals/ConfirmDeleteModal';
import { EditBankModal } from '../components/modals/EditBankModal';
import { EditChurchModal } from '../components/modals/EditChurchModal';

// Serviços
import { supabase } from "../services/supabaseClient";

// --- Reusable List Item ---
interface ListItemProps { children: React.ReactNode; actions: React.ReactNode; }
const ListItem: React.FC<ListItemProps> = memo(({ children, actions }) => (
    <li className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-md">
        <div className="flex-1 min-w-0 pr-4">{children}</div>
        <div className="flex-shrink-0 flex items-center space-x-3">{actions}</div>
    </li>
));

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
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}/>
            <div className="flex space-x-2">
                <button type="submit" disabled={isSaving} className="w-full py-2 px-4 bg-blue-700 text-white rounded-md">Salvar</button>
                <button type="button" onClick={onCancel} className="w-full py-2 px-4 border rounded-md">Cancelar</button>
            </div>
        </form>
    );
};

// --- Lists ---
const BanksList: React.FC<{ onEdit: (id:string,name:string)=>void; onDelete: (id:string,name:string)=>void }> = ({ onEdit, onDelete }) => {
    const ctx = useContext(AppContext);
    const { banks = [] } = ctx || {};
    const [search, setSearch] = useState('');
    const filteredBanks = useMemo(() => banks.filter(b => (b.name || '').toLowerCase().includes(search.toLowerCase())), [banks, search]);

    return (
        <div>
            <input type="text" placeholder="Buscar banco" value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 border rounded-md mb-2"/>
            <ul>
                {filteredBanks.map(bank => (
                    <ListItem key={bank.id} actions={
                        <>
                            <button onClick={() => onEdit(bank.id, bank.name)}>Editar</button>
                            <button onClick={() => onDelete(bank.id, bank.name)}>Excluir</button>
                        </>
                    }>
                        {bank.name}
                    </ListItem>
                ))}
            </ul>
        </div>
    );
};

const ChurchesList: React.FC<{ onEdit:(data:ChurchFormData,id:string)=>void; onDelete:(id:string,name:string)=>void }> = ({ onEdit, onDelete }) => {
    const ctx = useContext(AppContext);
    const { churches = [] } = ctx || {};
    const [search, setSearch] = useState('');
    const filteredChurches = useMemo(() => churches.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase())), [churches, search]);

    return (
        <div>
            <input type="text" placeholder="Buscar igreja" value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 border rounded-md mb-2"/>
            <ul>
                {filteredChurches.map(church => (
                    <ListItem key={church.id} actions={
                        <>
                            <button onClick={() => onEdit(church, church.id)}>Editar</button>
                            <button onClick={() => onDelete(church.id, church.name)}>Excluir</button>
                        </>
                    }>
                        {church.name}
                    </ListItem>
                ))}
            </ul>
        </div>
    );
};

// --- Main View ---
const RegisterView: React.FC = () => {
    const { t } = useTranslation();
    const [showNewBankForm, setShowNewBankForm] = useState(false);
    const [showNewChurchForm, setShowNewChurchForm] = useState(false);
    const [editingBank, setEditingBank] = useState<{id:string,name:string}|null>(null);
    const [editingChurch, setEditingChurch] = useState<{data:ChurchFormData,id:string}|null>(null);
    const [deletingItem, setDeletingItem] = useState<{type:'bank'|'church',id:string,name:string}|null>(null);

    return (
        <div>
            <h2>Registrar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Banks */}
                <div className="p-4 border rounded-md">
                    {!showNewBankForm && <button onClick={() => setShowNewBankForm(true)}>Novo Banco</button>}
                    {showNewBankForm && <BankForm onCancel={() => setShowNewBankForm(false)}/>}
                    <BanksList onEdit={(id,name)=>setEditingBank({id,name})} onDelete={(id,name)=>setDeletingItem({type:'bank',id,name})}/>
                </div>
                {/* Churches */}
                <div className="p-4 border rounded-md">
                    {!showNewChurchForm && <button onClick={() => setShowNewChurchForm(true)}>Nova Igreja</button>}
                    {showNewChurchForm && <ChurchForm onCancel={() => setShowNewChurchForm(false)}/>}
                    <ChurchesList onEdit={(data,id)=>setEditingChurch({data,id})} onDelete={(id,name)=>setDeletingItem({type:'church',id,name})}/>
                </div>
            </div>

            {editingBank && <EditBankModal bankId={editingBank.id} currentName={editingBank.name} onClose={()=>setEditingBank(null)}/>}
            {editingChurch && <EditChurchModal churchId={editingChurch.id} currentData={editingChurch.data} onClose={()=>setEditingChurch(null)}/>}
            {deletingItem && <ConfirmDeleteModal type={deletingItem.type} id={deletingItem.id} name={deletingItem.name} onClose={()=>setDeletingItem(null)}/>}
        </div>
    );
};

export default RegisterView;
