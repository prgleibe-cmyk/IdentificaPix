import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { CreditCardIcon, XMarkIcon, PencilIcon, TrashIcon, PlusCircleIcon } from '../Icons';

export const PaymentMethodsList: React.FC = () => {
    const { paymentMethods, addPaymentMethod, removePaymentMethod, updatePaymentMethod } = useContext(AppContext);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<string | null>(null);
    const [methodName, setMethodName] = useState('');

    const handleOpenCreate = () => {
        setEditingMethod(null);
        setMethodName('');
        setIsFormOpen(true);
    };

    const handleOpenEdit = (method: string) => {
        setEditingMethod(method);
        setMethodName(method);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingMethod(null);
        setMethodName('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!methodName.trim()) return;

        if (editingMethod) {
            if (updatePaymentMethod) {
                updatePaymentMethod(editingMethod, methodName);
            }
        } else {
            addPaymentMethod(methodName);
        }

        handleCloseForm();
    };

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* Top Header */}
            <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50">
                        <CreditCardIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Formas de Receb/Pagto</h3>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 block uppercase">
                            {paymentMethods.length} cadastrada(s)
                        </span>
                    </div>
                </div>

                {!isFormOpen && (
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="flex items-center space-x-1.5 px-4 py-2 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 transition-all tracking-wider uppercase cursor-pointer"
                    >
                        <PlusCircleIcon className="w-3.5 h-3.5" />
                        <span>Novo</span>
                    </button>
                )}
            </div>

            {/* Form Box (Create or Edit) */}
            {isFormOpen && (
                <div className="flex-shrink-0 bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider">
                            {editingMethod ? 'Editar Forma de Receb/Pagto' : 'Nova Forma de Receb/Pagto'}
                        </h4>
                        <button
                            type="button"
                            onClick={handleCloseForm}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1">
                                Nome da Forma de Pagamento / Recebimento *
                            </label>
                            <input
                                type="text"
                                value={methodName}
                                onChange={(e) => setMethodName(e.target.value)}
                                placeholder="Ex: PIX, CARTÃO DE CRÉDITO, DINHEIRO, TED, BOLETO..."
                                required
                                autoFocus
                                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white py-2.5 px-3.5 font-bold text-xs transition-all outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                        </div>

                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={handleCloseForm}
                                className="px-5 py-2 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={!methodName.trim()}
                                className="px-6 py-2 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {editingMethod ? 'Salvar Alterações' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List of Payment Methods */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                {paymentMethods.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-medium">
                        Nenhuma forma de pagamento/recebimento cadastrada.
                    </div>
                ) : (
                    paymentMethods.map((method: string) => (
                        <div
                            key={method}
                            className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-2xl shadow-sm hover:border-amber-500/30 transition-all group"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                                    {method}
                                </span>
                            </div>

                            <div className="flex items-center space-x-1">
                                <button
                                    type="button"
                                    onClick={() => handleOpenEdit(method)}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all cursor-pointer"
                                    title="Editar"
                                >
                                    <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removePaymentMethod(method)}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                                    title="Excluir"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};