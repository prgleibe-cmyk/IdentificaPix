import React, { useContext, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../../contexts/AppContext';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, SearchIcon } from '../Icons';
import { CreditCard, Landmark, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Bank, PaymentMethod, PaymentOperationType } from '../../types';

export type { PaymentOperationType, PaymentMethod };

export const PaymentMethodsList: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
    const { 
        paymentMethodItems,
        fetchPaymentMethods,
        addPaymentMethod, 
        updatePaymentMethod,
        openDeleteConfirmation,
        banks 
    } = useContext(AppContext);

    const items: PaymentMethod[] = Array.isArray(paymentMethodItems) ? paymentMethodItems : [];

    // Top Filter / Selector State: 'recebimento' | 'pagamento' | 'todos'
    const [selectedTab, setSelectedTab] = useState<'recebimento' | 'pagamento' | 'todos'>('recebimento');
    const [search, setSearch] = useState('');

    // Form Drawer State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDetail, setEditingDetail] = useState<PaymentMethod | null>(null);

    // Form fields
    const [type, setType] = useState<PaymentOperationType>('recebimento');
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [bankId, setBankId] = useState('');
    const [order, setOrder] = useState<number>(1);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (fetchPaymentMethods) {
            fetchPaymentMethods(true);
        }
    }, [fetchPaymentMethods]);

    const handleOpenCreate = () => {
        setEditingDetail(null);
        // Default form type to the currently selected tab if not 'todos'
        setType(selectedTab === 'todos' ? 'recebimento' : selectedTab);
        setName('');
        setCategory('');
        setBankId('');
        setOrder(items.length + 1);
        setIsActive(true);
        setErrorMsg(null);
        setIsFormOpen(true);
    };

    const handleOpenEdit = (item: PaymentMethod) => {
        setEditingDetail(item);
        setType(item.type || 'recebimento');
        setName(item.name || '');
        setCategory(item.category || '');
        setBankId(item.bank_id || '');
        setOrder(item.order ?? 1);
        setIsActive(item.is_active !== false);
        setErrorMsg(null);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingDetail(null);
        setErrorMsg(null);
    };

    useEffect(() => {
        if (!isFormOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleCloseForm();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isFormOpen, isSubmitting]);

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
            const payload = {
                name: cleanName,
                type,
                category: category.trim() || null,
                bank_id: bankId || null,
                order: Number(order) || 1,
                is_active: isActive
            };

            if (editingDetail) {
                const duplicateExists = items.some(
                    pm => pm.id !== editingDetail.id && (pm.name || '').trim().toUpperCase() === cleanName
                );
                if (duplicateExists) {
                    setErrorMsg(`A forma "${cleanName}" já está cadastrada.`);
                    setIsSubmitting(false);
                    return;
                }

                await updatePaymentMethod(editingDetail.id, payload);
            } else {
                const duplicateExists = items.some(
                    pm => (pm.name || '').trim().toUpperCase() === cleanName
                );
                if (duplicateExists) {
                    setErrorMsg(`A forma "${cleanName}" já está cadastrada.`);
                    setIsSubmitting(false);
                    return;
                }

                await addPaymentMethod(payload);
            }

            handleCloseForm();
        } catch (err: any) {
            console.error('Erro ao salvar forma de pagamento:', err);
            setErrorMsg(err?.message || 'Erro ao salvar forma de pagamento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (item: PaymentMethod) => {
        openDeleteConfirmation({
            type: 'payment-method',
            id: item.id,
            name: item.name
        });
    };

    // Filter list items based on active top tab and search query
    const filteredMethods = useMemo(() => {
        return items.filter((item: PaymentMethod) => {
            const query = search.toLowerCase();
            const nameMatch = (item.name || '').toLowerCase().includes(query);
            const catMatch = (item.category || '').toLowerCase().includes(query);
            if (!nameMatch && !catMatch) return false;

            if (selectedTab === 'todos') return true;
            return item.type === selectedTab || item.type === 'ambos';
        });
    }, [items, selectedTab, search]);

    return (
        <div className="h-full flex flex-col space-y-3">
            {/* Header */}
                    <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            {!embedded && (
                                <div className="w-9 h-9 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/50 flex items-center justify-center shrink-0">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                            )}
                            <div>
                                {!embedded && (
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                                        Formas de Recebimento / Pagamento
                                    </h3>
                                )}
                                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 block">
                                    {filteredMethods.length} cadastrada(s)
                                </span>
                            </div>

                            {/* Switcher Tabs pill in front of the name */}
                            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 gap-0.5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedTab('recebimento')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                        selectedTab === 'recebimento'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    • Recebimento
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTab('pagamento')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                        selectedTab === 'pagamento'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    • Pagamento
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTab('todos')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                        selectedTab === 'todos'
                                            ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Todos
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            <span>Nova Forma</span>
                        </button>
                    </div>

                    {/* Search Input Box */}
                    <div className="relative flex-shrink-0">
                        <SearchIcon className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" />
                        <input 
                            type="text" 
                            placeholder="Buscar forma de pagamento..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-3 py-2 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all shadow-xs text-xs font-medium outline-none" 
                        />
                    </div>

                    {/* Content List */}
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                        {filteredMethods.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50/70 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 my-1">
                                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                                    Nenhuma forma de pagamento/recebimento encontrada.
                                </p>
                            </div>
                        ) : (
                            filteredMethods.map((item: PaymentMethod) => {
                                const linkedBank = banks?.find((b: Bank) => b.id === item.bank_id);
                                const bankDisplayName = linkedBank ? (linkedBank.account_name || linkedBank.name) : (item.bank_name || null);
                                const itemType = item.type || 'ambos';
                                const isInactive = item.is_active === false;

                                return (
                                    <div 
                                        key={item.id} 
                                        className={`p-3 bg-white dark:bg-slate-800/80 border rounded-xl shadow-2xs hover:border-amber-300 dark:hover:border-slate-700 transition-all flex items-center justify-between ${
                                            isInactive ? 'opacity-60 border-slate-200 dark:border-slate-800' : 'border-slate-200/80 dark:border-slate-700/60'
                                        }`}
                                    >
                                        <div className="space-y-1 min-w-0 flex-1 pr-2">
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                                                    itemType === 'recebimento'
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800'
                                                        : itemType === 'pagamento'
                                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800'
                                                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800'
                                                }`}>
                                                    {itemType === 'recebimento' ? 'RECEBIMENTO' : itemType === 'pagamento' ? 'PAGAMENTO' : 'AMBOS'}
                                                </span>
                                                <span className="text-xs font-bold text-slate-800 dark:text-white uppercase truncate">
                                                    {item.name}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                                                {item.category && (
                                                    <span className="text-slate-500 dark:text-slate-400">
                                                        Categoria: {item.category}
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
                                                type="button"
                                                onClick={() => handleOpenEdit(item)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                                                title="Editar"
                                            >
                                                <PencilIcon className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(item)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
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

            {/* Modal Suspenso de Cadastro/Edição de Forma de Pagamento/Recebimento */}
            {isFormOpen && typeof document !== 'undefined' && createPortal(
                <div
                    data-register-overlay="true"
                    className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isSubmitting) handleCloseForm();
                    }}
                >
                    <form
                        id="payment-method-form"
                        onSubmit={handleSubmit}
                        onClick={(e) => e.stopPropagation()}
                        className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-5rem)] md:max-h-[min(86vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start sm:items-center justify-between gap-3 flex-shrink-0 bg-white dark:bg-slate-900">
                            <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                        {editingDetail ? 'Editar Forma de Receb/Pagto' : 'Nova Forma de Receb/Pagto'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        Configure o tipo operacional, categoria e conta bancária vinculada.
                                    </p>
                                </div>
                                <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setType('recebimento')}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                            type === 'recebimento'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        • Recebimento
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('pagamento')}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                            type === 'pagamento'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        • Pagamento
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('ambos')}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                            type === 'ambos'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        • Ambos
                                    </button>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCloseForm}
                                disabled={isSubmitting}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                                aria-label="Fechar"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full space-y-4">
                            {errorMsg && (
                                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-fade-in">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Nome da Forma de Pagamento / Recebimento <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ex: PIX, CARTÃO DE CRÉDITO, DINHEIRO, TED, BOLETO..."
                                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-xs transition-all uppercase"
                                        required
                                        autoFocus
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Categoria (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        placeholder="Ex: Pagamento Digital, Espécie, Eletrônico..."
                                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-xs transition-all"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                        Conta Bancária Padrão / Vinculada (Opcional)
                                    </label>
                                    <select
                                        value={bankId}
                                        onChange={(e) => setBankId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-xs transition-all cursor-pointer"
                                        disabled={isSubmitting}
                                    >
                                        <option value="">Nenhuma conta vinculada (opcional)</option>
                                        {(banks || []).map((b: Bank) => (
                                            <option key={b.id} value={b.id}>
                                                {b.account_name || b.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                        Vincule uma conta bancária preferencial para lançamentos nesta forma de pagamento.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                                            Ordem de Exibição
                                        </label>
                                        <input
                                            type="number"
                                            value={order}
                                            onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-xs transition-all"
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div className="flex items-center space-x-2 pt-5">
                                        <input
                                            type="checkbox"
                                            id="pm-active-check"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                            className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                                            disabled={isSubmitting}
                                        />
                                        <label htmlFor="pm-active-check" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                            Ativo
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50/80 dark:bg-slate-900/70 px-5 py-3.5 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <button
                                type="button"
                                onClick={handleCloseForm}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !name.trim()}
                                className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}
        </div>
    );
};
