import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, SearchIcon } from '../Icons';
import { CreditCard, Landmark, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Bank } from '../../types';

export type PaymentOperationType = 'recebimento' | 'pagamento' | 'ambos';

export interface PaymentMethodDetail {
    id: string;
    name: string;
    type: PaymentOperationType;
    category?: string;
    bank_id?: string;
    order?: number;
    is_active?: boolean;
}

const STORAGE_KEY = 'identificapix_payment_methods_meta_v2';

export const PaymentMethodsList: React.FC = () => {
    const { 
        paymentMethods, 
        addPaymentMethod, 
        removePaymentMethod, 
        updatePaymentMethod,
        banks 
    } = useContext(AppContext);

    // Top Filter / Selector State: 'recebimento' | 'pagamento' | 'todos'
    const [selectedTab, setSelectedTab] = useState<'recebimento' | 'pagamento' | 'todos'>('recebimento');
    const [search, setSearch] = useState('');

    // Form Drawer State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDetail, setEditingDetail] = useState<PaymentMethodDetail | null>(null);

    // Form fields
    const [type, setType] = useState<PaymentOperationType>('recebimento');
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [bankId, setBankId] = useState('');
    const [order, setOrder] = useState<number>(1);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Persistent storage for rich details
    const [details, setDetails] = useState<PaymentMethodDetail[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Erro ao ler metadados de formas de pagamento:', e);
        }
        return [];
    });

    // Sync `details` with `paymentMethods` string list from AppContext
    useEffect(() => {
        if (!paymentMethods || paymentMethods.length === 0) return;

        let hasChanges = false;
        const updatedDetails = [...details];

        paymentMethods.forEach((methodStr, index) => {
            const upper = methodStr.trim().toUpperCase();
            const exists = updatedDetails.some(d => d.name.toUpperCase() === upper);

            if (!exists) {
                hasChanges = true;
                // Infer default operation type based on name
                let defaultType: PaymentOperationType = 'ambos';
                if (upper.includes('DÍZIMO') || upper.includes('OFERTA') || upper.includes('CRÉDITO') || upper.includes('DÉBITO')) {
                    defaultType = 'recebimento';
                } else if (upper.includes('BOLETO') || upper.includes('CHEQUE')) {
                    defaultType = 'pagamento';
                }

                updatedDetails.push({
                    id: `pm_${Date.now()}_${index}`,
                    name: upper,
                    type: defaultType,
                    category: 'Geral',
                    order: index + 1,
                    is_active: true
                });
            }
        });

        if (hasChanges) {
            setDetails(updatedDetails);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDetails));
            } catch (e) {
                console.error('Erro ao salvar metadados de formas de pagamento:', e);
            }
        }
    }, [paymentMethods]);

    const saveDetailsToStorage = (newDetails: PaymentMethodDetail[]) => {
        setDetails(newDetails);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newDetails));
        } catch (e) {
            console.error('Erro ao salvar metadados de formas de pagamento:', e);
        }
    };

    const handleOpenCreate = () => {
        setEditingDetail(null);
        // Default form type to the currently selected tab if not 'todos'
        setType(selectedTab === 'todos' ? 'recebimento' : selectedTab);
        setName('');
        setCategory('');
        setBankId('');
        setOrder(details ? details.length + 1 : 1);
        setIsActive(true);
        setErrorMsg(null);
        setIsFormOpen(true);
    };

    const handleOpenEdit = (methodName: string) => {
        const existing = details.find(d => d.name.toUpperCase() === methodName.toUpperCase());
        if (existing) {
            setEditingDetail(existing);
            setType(existing.type || 'recebimento');
            setName(existing.name || '');
            setCategory(existing.category || '');
            setBankId(existing.bank_id || '');
            setOrder(existing.order ?? 1);
            setIsActive(existing.is_active !== false);
        } else {
            setEditingDetail(null);
            setType('recebimento');
            setName(methodName);
            setCategory('');
            setBankId('');
            setOrder(1);
            setIsActive(true);
        }
        setErrorMsg(null);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingDetail(null);
        setErrorMsg(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        const cleanName = name.trim().toUpperCase();
        if (!cleanName) {
            setErrorMsg('O nome da forma de pagamento/recebimento é obrigatório.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingDetail) {
                // Updating existing item
                const oldName = editingDetail.name.toUpperCase();
                if (oldName !== cleanName && paymentMethods.includes(cleanName)) {
                    setErrorMsg(`A forma "${cleanName}" já está cadastrada.`);
                    setIsSubmitting(false);
                    return;
                }

                // Update AppContext string array
                if (updatePaymentMethod) {
                    updatePaymentMethod(oldName, cleanName);
                }

                // Update local rich details
                const updated = details.map(d => {
                    if (d.id === editingDetail.id || d.name.toUpperCase() === oldName) {
                        return {
                            ...d,
                            name: cleanName,
                            type,
                            category: category.trim() || undefined,
                            bank_id: bankId || undefined,
                            order: Number(order) || 1,
                            is_active: isActive
                        };
                    }
                    return d;
                });
                saveDetailsToStorage(updated);
            } else {
                // Creating new item
                if (paymentMethods.includes(cleanName)) {
                    setErrorMsg(`A forma "${cleanName}" já está cadastrada.`);
                    setIsSubmitting(false);
                    return;
                }

                // Add to AppContext
                addPaymentMethod(cleanName);

                // Add to rich details
                const newDetail: PaymentMethodDetail = {
                    id: `pm_${Date.now()}`,
                    name: cleanName,
                    type,
                    category: category.trim() || undefined,
                    bank_id: bankId || undefined,
                    order: Number(order) || details.length + 1,
                    is_active: isActive
                };
                saveDetailsToStorage([...details, newDetail]);
            }

            handleCloseForm();
        } catch (err: any) {
            console.error('Erro ao salvar forma de pagamento:', err);
            setErrorMsg('Erro ao salvar forma de pagamento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (methodName: string) => {
        if (window.confirm(`Tem certeza que deseja excluir a forma "${methodName}"?`)) {
            removePaymentMethod(methodName);
            const filtered = details.filter(d => d.name.toUpperCase() !== methodName.toUpperCase());
            saveDetailsToStorage(filtered);
        }
    };

    // Filter list items based on active top tab and search query
    const filteredMethods = useMemo(() => {
        return paymentMethods.filter((methodName: string) => {
            const upper = methodName.toUpperCase();
            const detail = details.find(d => d.name.toUpperCase() === upper);
            
            // 1. Search Query Filter
            const query = search.toLowerCase();
            const nameMatch = methodName.toLowerCase().includes(query);
            const catMatch = detail?.category?.toLowerCase().includes(query) ?? false;
            if (!nameMatch && !catMatch) return false;

            // 2. Tab Filter ('recebimento' | 'pagamento' | 'todos')
            if (selectedTab === 'todos') return true;
            if (!detail) return true; // Show unclassified methods by default
            return detail.type === selectedTab || detail.type === 'ambos';
        });
    }, [paymentMethods, details, selectedTab, search]);

    return (
        <div className="h-full flex flex-col space-y-3">
            {isFormOpen ? (
                /* Form Drawer / Panel */
                <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4 animate-fade-in flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap gap-2">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50">
                                    <CreditCard className="w-4 h-4" />
                                </div>
                                <h4 className="text-sm font-black uppercase text-slate-800 dark:text-white tracking-wider">
                                    {editingDetail ? 'Editar Forma de Receb/Pagto' : 'Nova Forma de Receb/Pagto'}
                                </h4>
                                <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px]">
                                    <button
                                        type="button"
                                        onClick={() => setType('recebimento')}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                            type === 'recebimento'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        • Recebimento
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('pagamento')}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                            type === 'pagamento'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        • Pagamento
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('ambos')}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                            type === 'ambos'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        • Ambos
                                    </button>
                                </div>
                            </div>
                            <button type="button" onClick={handleCloseForm} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {errorMsg && (
                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                                {errorMsg}
                            </div>
                        )}

                        <form id="payment-method-form" onSubmit={handleSubmit} className="space-y-4">
                            {/* Campos */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                                        Nome da Forma de Pagamento / Recebimento *
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ex: PIX, CARTÃO DE CRÉDITO, DINHEIRO, TED, BOLETO..."
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 uppercase"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                                        Categoria (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        placeholder="Ex: Pagamento Digital, Espécie, Eletrônico..."
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500/20"
                                    />
                                </div>

                                {/* Conta Bancária Destino / Preferencial (Opcional) */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                                        Conta Bancária Padrão / Vinculada (Opcional)
                                    </label>
                                    <select
                                        value={bankId}
                                        onChange={(e) => setBankId(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                                    >
                                        <option value="">Nenhuma conta vinculada (opcional)</option>
                                        {(banks || []).map((b: Bank) => (
                                            <option key={b.id} value={b.id}>
                                                {b.account_name || b.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                        Vincule uma conta bancária preferencial para lançamentos nesta forma de pagamento.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                                            Ordem de Exibição
                                        </label>
                                        <input
                                            type="number"
                                            value={order}
                                            onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20"
                                        />
                                    </div>

                                    <div className="flex items-center space-x-2 pt-4">
                                        <input
                                            type="checkbox"
                                            id="pm-active-check"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                            className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                        />
                                        <label htmlFor="pm-active-check" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                            Ativo
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Ações do formulário */}
                    <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={handleCloseForm}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="payment-method-form"
                            disabled={isSubmitting || !name.trim()}
                            className="px-6 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="flex-shrink-0 flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/50 flex-wrap gap-2">
                        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50">
                                <CreditCard className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">
                                    Formas de Recebimento / Pagamento
                                </h3>
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 block uppercase">
                                    {filteredMethods.length} cadastrada(s)
                                </span>
                            </div>

                            {/* Switcher Tabs pill in front of the name - IDENTICAL layout & style as Tipos de Contribuição */}
                            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-[10px] ml-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedTab('recebimento')}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                        selectedTab === 'recebimento'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    • Recebimento
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTab('pagamento')}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                        selectedTab === 'pagamento'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    • Pagamento
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTab('todos')}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                        selectedTab === 'todos'
                                            ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Todos
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleOpenCreate}
                            className="flex items-center space-x-1.5 px-5 py-2 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 transition-all tracking-wider uppercase cursor-pointer"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            <span>Nova Forma</span>
                        </button>
                    </div>

                    {/* Search Input Box */}
                    <div className="relative flex-shrink-0">
                        <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Buscar forma de pagamento..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 p-2 block w-full rounded-lg border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-xs focus:bg-white dark:focus:bg-slate-900 text-[11px] font-medium outline-none" 
                        />
                    </div>

                    {/* Content List */}
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                        {filteredMethods.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 my-2">
                                <p className="text-slate-400 dark:text-slate-500 italic text-xs font-medium">
                                    Nenhuma forma de pagamento/recebimento encontrada.
                                </p>
                            </div>
                        ) : (
                            filteredMethods.map((methodName: string) => {
                                const upper = methodName.toUpperCase();
                                const detail = details.find(d => d.name.toUpperCase() === upper);
                                const linkedBank = banks?.find((b: Bank) => b.id === detail?.bank_id);
                                const bankDisplayName = linkedBank ? (linkedBank.account_name || linkedBank.name) : null;
                                const itemType = detail?.type || 'ambos';
                                const isInactive = detail?.is_active === false;

                                return (
                                    <div 
                                        key={methodName} 
                                        className={`p-3 bg-white dark:bg-slate-800 border rounded-2xl shadow-xs hover:border-amber-300 dark:hover:border-slate-700 transition-all flex items-center justify-between ${
                                            isInactive ? 'opacity-60 border-slate-200 dark:border-slate-800' : 'border-slate-100 dark:border-slate-700/50'
                                        }`}
                                    >
                                        <div className="space-y-1 min-w-0 flex-1 pr-2">
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full tracking-wider ${
                                                    itemType === 'recebimento'
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                        : itemType === 'pagamento'
                                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                                }`}>
                                                    {itemType === 'recebimento' ? 'RECEBIMENTO' : itemType === 'pagamento' ? 'PAGAMENTO' : 'AMBOS'}
                                                </span>
                                                <span className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">
                                                    {methodName}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                                                {detail?.category && (
                                                    <span className="text-slate-400 dark:text-slate-500 font-semibold">
                                                        Categoria: {detail.category}
                                                    </span>
                                                )}
                                                {bankDisplayName && (
                                                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                                        <Landmark className="w-3 h-3" />
                                                        <span className="truncate">{bankDisplayName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                            <button
                                                onClick={() => handleOpenEdit(methodName)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                                                title="Editar"
                                            >
                                                <PencilIcon className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(methodName)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                                                title="Excluir"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
