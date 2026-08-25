import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { BanknotesIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '../Icons';
import { ContributionType, Bank } from '../../types';

export const ContributionTypesList: React.FC = () => {
    const { 
        contributionTypes, 
        addContributionType, 
        updateContributionType, 
        removeContributionType, 
        banks,
        fetchContributionTypes
    } = useContext(AppContext);

    const [selectedTab, setSelectedTab] = useState<'entrada' | 'saida' | 'todos'>('todos');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingType, setEditingType] = useState<ContributionType | null>(null);

    // Form fields
    const [type, setType] = useState<'entrada' | 'saida'>('entrada');
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [bankId, setBankId] = useState('');
    const [order, setOrder] = useState<number>(0);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (fetchContributionTypes) {
            fetchContributionTypes();
        }
    }, [fetchContributionTypes]);

    const filteredContributionTypes = useMemo(() => {
        if (!contributionTypes) return [];
        return contributionTypes.filter((item: ContributionType) => {
            if (selectedTab === 'todos') return true;
            return item.type === selectedTab;
        });
    }, [contributionTypes, selectedTab]);

    const handleOpenCreate = () => {
        setEditingType(null);
        setType(selectedTab === 'saida' ? 'saida' : 'entrada');
        setName('');
        setCategory('');
        setBankId(banks && banks.length > 0 ? banks[0].id : '');
        setOrder(contributionTypes ? contributionTypes.length + 1 : 1);
        setIsActive(true);
        setErrorMsg(null);
        setIsFormOpen(true);
    };

    const handleOpenEdit = (item: ContributionType) => {
        setEditingType(item);
        setType(item.type || 'entrada');
        setName(item.name || '');
        setCategory(item.category || '');
        setBankId(item.bank_id || '');
        setOrder(item.order ?? 0);
        setIsActive(item.is_active !== false);
        setErrorMsg(null);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingType(null);
        setErrorMsg(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (!name.trim()) {
            setErrorMsg('A descrição do lançamento é obrigatória.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                type,
                category: category.trim() || undefined,
                bank_id: type === 'entrada' && bankId ? bankId : undefined,
                order: Number(order) || 0,
                is_active: isActive
            };

            let success = false;
            if (editingType) {
                success = await updateContributionType(editingType.id, payload);
            } else {
                success = await addContributionType(payload);
            }

            if (success) {
                handleCloseForm();
            }
        } catch (err: any) {
            console.error('Erro ao salvar descrição de entrada/saída:', err);
            setErrorMsg('Erro ao salvar descrição de entrada/saída.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`Tem certeza que deseja excluir a descrição "${name}"?`)) {
            await removeContributionType(id);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-3">
            {isFormOpen ? (
                /* Form Drawer / Panel */
                <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4 animate-fade-in flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap gap-2">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
                                    <BanknotesIcon className="w-4 h-4" />
                                </div>
                                <h4 className="text-sm font-black uppercase text-slate-800 dark:text-white tracking-wider">
                                    {editingType ? 'Editar Descrição (Entrada/Saída)' : 'Nova Descrição (Entrada/Saída)'}
                                </h4>
                                <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px]">
                                    <button
                                        type="button"
                                        onClick={() => setType('entrada')}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                            type === 'entrada'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        • Entrada
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('saida')}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                            type === 'saida'
                                                ? 'bg-rose-600 text-white shadow-xs'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        Saída
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

                        <form id="contribution-type-form" onSubmit={handleSubmit} className="space-y-4">
                            {/* Campos */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                                        Descrição *
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ex: Dízimo, Oferta, Missões, Aluguel..."
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                                        placeholder="Ex: Entradas de Culto, Projetos..."
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>

                                {/* Conta Bancária Destino (Opcional) */}
                                {type === 'entrada' && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                                            Conta Bancária Destino (Opcional)
                                        </label>
                                        <select
                                            value={bankId}
                                            onChange={(e) => setBankId(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                                        >
                                            <option value="">Nenhuma conta vinculada (opcional)</option>
                                            {(banks || []).map((b: Bank) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.account_name || b.name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                            Selecione a conta bancária que receberá as contribuições deste tipo no Portal.
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                                            Ordem
                                        </label>
                                        <input
                                            type="number"
                                            value={order}
                                            onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        />
                                    </div>

                                    <div className="flex items-center space-x-2 pt-4">
                                        <input
                                            type="checkbox"
                                            id="type-active-check"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <label htmlFor="type-active-check" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
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
                            form="contribution-type-form"
                            disabled={isSubmitting}
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
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
                                <BanknotesIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">
                                    Descrição (Entrada/Saída)
                                </h3>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 block uppercase">
                                    {filteredContributionTypes.length} cadastradas
                                </span>
                            </div>

                            {/* Switcher Tabs pill in front of the name */}
                            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-[10px] ml-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedTab('entrada')}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                        selectedTab === 'entrada'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    • Entrada
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTab('saida')}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                        selectedTab === 'saida'
                                            ? 'bg-rose-600 text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    • Saída
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
                            <span>Nova Descrição</span>
                        </button>
                    </div>

                    {/* Content List */}
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                        {(!filteredContributionTypes || filteredContributionTypes.length === 0) ? (
                            <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs font-medium">
                                Nenhuma descrição de entrada/saída encontrada.
                            </div>
                        ) : (
                            filteredContributionTypes.map((item: ContributionType) => {
                                const linkedBank = banks?.find((b: Bank) => b.id === item.bank_id);
                                const bankDisplayName = linkedBank ? (linkedBank.account_name || linkedBank.name) : (item.bank_name || null);

                                return (
                                    <div 
                                        key={item.id} 
                                        className={`p-3 bg-white dark:bg-slate-800 border rounded-2xl shadow-sm hover:border-emerald-200 dark:hover:border-slate-700 transition-all flex items-center justify-between ${
                                            item.is_active === false ? 'opacity-60 border-slate-200 dark:border-slate-800' : 'border-slate-100 dark:border-slate-700/50'
                                        }`}
                                    >
                                        <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full tracking-wider ${
                                                    item.type === 'entrada' 
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                                }`}>
                                                    {item.type || 'entrada'}
                                                </span>
                                                <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase truncate">
                                                    {item.name}
                                                </span>
                                            </div>

                                            {item.type === 'entrada' && (
                                                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                                                    <span className="font-bold text-slate-400">Conta:</span>
                                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                                                        {bankDisplayName || 'Nenhuma conta vinculada'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                            <button
                                                onClick={() => handleOpenEdit(item)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                                title="Editar"
                                            >
                                                <PencilIcon className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id, item.name)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
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
