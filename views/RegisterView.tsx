// React e hooks
import React, { useContext, useState, useMemo, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { ChurchFormData } from '../types';
import { SearchIcon, PlusCircleIcon, PencilIcon, TrashIcon } from '../components/Icons';

// --- ErrorBoundary ---
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
                    <p className="mt-2 text-sm text-slate-600">Detalhes no console.</p>
                    <pre className="mt-4 p-3 bg-slate-100 rounded">{String(this.state.error)}</pre>
                </div>
            );
        }
        return this.props.children as any;
    }
}

// --- ListItem ---
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

// --- Confirm Delete Modal ---
const ConfirmDeleteModal: React.FC<{ type: 'bank' | 'church'; id: string; name: string; onClose: () => void }> = ({
    type,
    id,
    name,
    onClose,
}) => {
    const ctx = useContext(AppContext);
    const { banks = [], setBanks = () => {}, churches = [], setChurches = () => {} } = ctx || {};
    const { t } = useTranslation();

    const handleDelete = () => {
        if (type === 'bank') {
            setBanks((banks || []).filter(b => b.id !== id));
        } else {
            setChurches((churches || []).filter(c => c.id !== id));
        }
        console.log(`🗑️ Deletado ${type}:`, id, name);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-96">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('common.confirmDelete')}</h3>
                <p className="mt-2 text-slate-700 dark:text-slate-300">
                    {t('common.confirmDeleteMessage', { name })}
                </p>
                <div className="mt-4 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md text-slate-700 dark:text-slate-300"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                        {t('common.delete')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Edit Bank Modal ---
const EditBankModal: React.FC<{ bankId: string; currentName: string; onClose: () => void }> = ({
    bankId,
    currentName,
    onClose,
}) => {
    const ctx = useContext(AppContext);
    const { banks = [], setBanks = () => {} } = ctx || {};
    const { t } = useTranslation();
    const [name, setName] = useState(currentName);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            setBanks((banks || []).map(b => (b.id === bankId ? { ...b, name } : b)));
            console.log('💾 Banco atualizado:', { bankId, name });
        } finally {
            setIsSaving(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-96">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('common.editBank')}</h3>
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="mt-2 w-full p-2 border rounded-md"
                />
                <div className="mt-4 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md text-slate-700 dark:text-slate-300"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800"
                    >
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Edit Church Modal ---
const EditChurchModal: React.FC<{ churchId: string; currentData: ChurchFormData; onClose: () => void }> = ({
    churchId,
    currentData,
    onClose,
}) => {
    const ctx = useContext(AppContext);
    const { churches = [], setChurches = () => {} } = ctx || {};
    const { t } = useTranslation();
    const [data, setData] = useState<ChurchFormData>(currentData);
    const [isSaving, setIsSaving] = useState(false);

    const handleLogoUpload = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e =>
                setData(d => ({
                    ...d,
                    logoUrl: e.target?.result as string,
                }));
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            setChurches((churches || []).map(c => (c.id === churchId ? { ...c, ...data } : c)));
            console.log('💾 Igreja atualizada:', { churchId, data });
        } finally {
            setIsSaving(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-96 space-y-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('common.editChurch')}</h3>
                <input
                    value={data.name}
                    onChange={e => setData(d => ({ ...d, name: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                    placeholder={t('register.churchName')}
                />
                <input
                    value={data.address}
                    onChange={e => setData(d => ({ ...d, address: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                    placeholder={t('register.address')}
                />
                <input
                    value={data.pastor}
                    onChange={e => setData(d => ({ ...d, pastor: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                    placeholder={t('register.pastor')}
                />
                <input
                    type="file"
                    accept="image/*"
                    onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                    className="w-full text-sm"
                />
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md text-slate-700 dark:text-slate-300"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800"
                    >
                        {t('common.save')}
                    </button>
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
            console.log('💾 Salvando banco:', name);
            await addBank({ name });
            setName('');
            onCancel();
        } catch (err) {
            console.error('Erro ao salvar banco:', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
            <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder={t('register.bankName')}
                className="w-full p-2 border rounded-md"
            />
            <div className="flex space-x-2">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2 px-4 bg-blue-700 text-white rounded-md"
                >
                    {t('common.save')}
                </button>
                <button type="button" onClick={onCancel} className="w-full py-2 px-4 border rounded-md">
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    );
};

// --- Church Form ---
const ChurchForm: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const ctx = useContext(AppContext);
    const { addChurch = async () => {} } = ctx || {};
    const { t } = useTranslation();
    const [data, setData] = useState<ChurchFormData>({
        name: '',
        address: '',
        pastor: '',
        logoUrl: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleLogoUpload = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e =>
                setData(d => ({
                    ...d,
                    logoUrl: e.target?.result as string,
                }));
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            console.log('💾 Salvando igreja:', data);
            await addChurch(data);
            setData({ name: '', address: '', pastor: '', logoUrl: '' });
            onCancel();
        } catch (err) {
            console.error('Erro ao salvar igreja:', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
            <input
                type="text"
                value={data.name}
                onChange={e => setData(d => ({ ...d, name: e.target.value }))}
                required
                placeholder={t('register.churchName')}
                className="w-full p-2 border rounded-md"
            />
            <input
                type="text"
                value={data.address}
                onChange={e => setData(d => ({ ...d, address: e.target.value }))}
                required
                placeholder={t('register.address')}
                className="w-full p-2 border rounded-md"
            />
            <input
                type="text"
                value={data.pastor}
                onChange={e => setData(d => ({ ...d, pastor: e.target.value }))}
                required
                placeholder={t('register.pastor')}
                className="w-full p-2 border rounded-md"
            />
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('register.logo')}
                </label>
                <div className="mt-1 flex items-center space-x-4">
                    <img
                        src={
                            data.logoUrl ||
                            'https://placehold.co/100x100/e2e8f0/64748b?text=?'
                        }
                        alt="Pré-visualização do logo"
                        className="w-16 h-16 rounded-md object-cover bg-slate-200"
                    />
                    <input
                        type="file"
                        accept="image/*"
                        onChange={e =>
                            e.target.files?.[0] && handleLogoUpload(e.target.files[0])
                        }
                        className="block w-full text-sm"
                    />
                </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2 px-4 bg-blue-700 text-white rounded-md hover:bg-blue-800"
                >
                    {t('common.save')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="w-full py-2 px-4 border border-blue-700 text-blue-700 rounded-md hover:bg-blue-700 hover:text-white transition-colors"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    );
};

// --- BanksList ---
const BanksList: React.FC<{ onEdit: (id: string, name: string) => void; onDelete: (id: string, name: string) => void }> = ({
    onEdit,
    onDelete,
}) => {
    const ctx = useContext(AppContext);
    const { banks = [] } = ctx || {};
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    const filteredBanks = useMemo(
        () =>
            (banks || []).filter(b =>
                (b.name || '').toLowerCase().includes(search.toLowerCase())
            ),
        [banks, search]
    );

    return (
        <div>
            <div className="relative mb-2">
                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder={t('register.searchBank')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm"
                />
            </div>
            <ul className="mt-2 space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredBanks.map(bank => (
                    <ListItem
                        key={bank.id}
                        actions={
                            <>
                                <button
                                    onClick={() => onEdit(bank.id, bank.name)}
                                    className="p-1 rounded-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => onDelete(bank.id, bank.name)}
                                    className="p-1 rounded-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </>
                        }
                    >
                        <span className="truncate text-slate-700 dark:text-slate-300">
                            {bank.name}
                        </span>
                    </ListItem>
                ))}
            </ul>
        </div>
    );
};

// --- ChurchesList ---
const ChurchesList: React.FC<{ onEdit: (data: ChurchFormData, id: string) => void; onDelete: (id: string, name: string) => void }> = ({
    onEdit,
    onDelete,
}) => {
    const ctx = useContext(AppContext);
    const { churches = [] } = ctx || {};
    const { t } = useTranslation();
    const [search, setSearch] = useState('');

    const filteredChurches = useMemo(
        () =>
            (churches || []).filter(
                c =>
                    (c.name || '')
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (c.pastor || '')
                        .toLowerCase()
                        .includes(search.toLowerCase())
            ),
        [churches, search]
    );

    return (
        <div>
            <div className="relative mb-2">
                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder={t('register.searchChurch')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 p-2 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 shadow-sm"
                />
            </div>
            <ul className="mt-2 space-y-3 max-h-96 overflow-y-auto pr-1">
                {filteredChurches.map(church => (
                    <ListItem
                        key={church.id}
                        actions={
                            <>
                                <button
                                    onClick={() => onEdit(church, church.id)}
                                    className="p-1 rounded-full text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => onDelete(church.id, church.name)}
                                    className="p-1 rounded-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
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
                                className="w-8 h-8 rounded-md object-cover bg-slate-200 flex-shrink-0"
                            />
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                {church.name}
                            </span>
                        </div>
                    </ListItem>
                ))}
            </ul>
        </div>
    );
};

// --- RegisterView ---
export const RegisterView: React.FC = () => {
    const { t } = useTranslation();
    const [showNewBankForm, setShowNewBankForm] = useState(false);
    const [showNewChurchForm, setShowNewChurchForm] = useState(false);
    const [editingBank, setEditingBank] = useState<{ id: string; name: string } | null>(null);
    const [editingChurch, setEditingChurch] = useState<{ data: ChurchFormData; id: string } | null>(null);
    const [deletingItem, setDeletingItem] = useState<{ type: 'bank' | 'church'; id: string; name: string } | null>(null);

    return (
        <ErrorBoundary>
            <>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {t('register.title')}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                    {t('register.subtitle')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Banks Column */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700 mb-4">
                            <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">
                                {t('register.manageBanks')}
                            </h3>
                            {!showNewBankForm && (
                                <button
                                    onClick={() => setShowNewBankForm(true)}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
                                >
                                    <PlusCircleIcon className="w-4 h-4" />
                                    <span>{t('common.new')}</span>
                                </button>
                            )}
                        </div>
                        {showNewBankForm && <BankForm onCancel={() => setShowNewBankForm(false)} />}
                        <BanksList
                            onEdit={(id, name) => setEditingBank({ id, name })}
                            onDelete={(id, name) => setDeletingItem({ type: 'bank', id, name })}
                        />
                    </div>

                    {/* Churches Column */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700 mb-4">
                            <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">
                                {t('register.manageChurches')}
                            </h3>
                            {!showNewChurchForm && (
                                <button
                                    onClick={() => setShowNewChurchForm(true)}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
                                >
                                    <PlusCircleIcon className="w-4 h-4" />
                                    <span>{t('common.new')}</span>
                                </button>
                            )}
                        </div>
                        {showNewChurchForm && <ChurchForm onCancel={() => setShowNewChurchForm(false)} />}
                        <ChurchesList
                            onEdit={(data, id) => setEditingChurch({ data, id })}
                            onDelete={(id, name) => setDeletingItem({ type: 'church', id, name })}
                        />
                    </div>
                </div>

                {/* Modals */}
                {editingBank && (
                    <EditBankModal
                        bankId={editingBank.id}
                        currentName={editingBank.name}
                        onClose={() => setEditingBank(null)}
                    />
                )}
                {editingChurch && (
                    <EditChurchModal
                        churchId={editingChurch.id}
                        currentData={editingChurch.data}
                        onClose={() => setEditingChurch(null)}
                    />
                )}
                {deletingItem && (
                    <ConfirmDeleteModal
                        type={deletingItem.type}
                        id={deletingItem.id}
                        name={deletingItem.name}
                        onClose={() => setDeletingItem(null)}
                    />
                )}
            </>
        </ErrorBoundary>
    );
};