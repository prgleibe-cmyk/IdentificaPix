import React, { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { SearchIcon, PlusCircleIcon, XMarkIcon } from '../Icons';

export const ContributorsList: React.FC = () => {
    const { showToast } = useUI();
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    
    // Form fields
    const [nome, setNome] = useState('');
    const [cpf, setCpf] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');

    // Validation state
    const [nameError, setNameError] = useState(false);

    const handleOpenModal = () => {
        setNome('');
        setCpf('');
        setTelefone('');
        setEmail('');
        setStatus('active');
        setNameError(false);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!nome.trim()) {
            setNameError(true);
            return;
        }

        setNameError(false);
        
        // Show local feedback visual alert
        showToast(
            "Módulo em fase de homologação. Persistência será habilitada após validação completa do Contributors.", 
            "success"
        );
        
        setShowModal(false);
    };

    return (
        <div className="flex flex-col h-full animate-fade-in" id="contributors-container">
            {/* Header / Intro */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
                <div>
                    <h3 className="font-bold text-base text-slate-800 dark:text-white leading-none">
                        Contribuintes
                    </h3>
                    <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block">
                        Cadastro centralizado de pessoas vinculadas à igreja.
                    </span>
                </div>
                <button 
                    onClick={handleOpenModal} 
                    className="flex items-center space-x-1.5 px-4 py-2.5 text-[10px] font-bold text-white bg-gradient-to-l from-indigo-700 to-indigo-500 hover:from-indigo-800 hover:to-indigo-600 rounded-full shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 transition-all tracking-wide uppercase cursor-pointer"
                    id="btn-add-contributor"
                >
                    <PlusCircleIcon className="w-3.5 h-3.5" />
                    <span>+ Novo Contribuinte</span>
                </button>
            </div>

            {/* Filter */}
            <div className="relative mb-4 flex-shrink-0">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input 
                    type="text" 
                    placeholder="Buscar contribuinte..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="pl-8 p-2 block w-full rounded-lg border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900 text-[11px] font-medium outline-none" 
                />
            </div>

            {/* Table Area */}
            <div className="flex-1 min-h-0 overflow-x-auto custom-scrollbar border border-slate-100 dark:border-slate-700/50 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-left border-collapse" id="contributors-table">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                            <th className="py-3 px-4">Nome</th>
                            <th className="py-3 px-4">CPF</th>
                            <th className="py-3 px-4">Telefone</th>
                            <th className="py-3 px-4">E-mail</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr id="empty-row">
                            <td colSpan={6} className="text-center py-24 text-slate-400 dark:text-slate-500 italic text-[11px]">
                                Nenhum contribuinte cadastrado.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-brand-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="contributor-modal">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 transform transition-all scale-100 flex flex-col max-h-[90vh]">
                        <form onSubmit={handleSave} className="flex flex-col h-full">
                            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-brand-graphite dark:text-white tracking-tight">
                                        Novo Contribuinte
                                    </h3>
                                    <button 
                                        type="button" 
                                        onClick={handleCloseModal} 
                                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="field-name" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                                            Nome completo *
                                        </label>
                                        <input 
                                            type="text" 
                                            id="field-name" 
                                            value={nome} 
                                            onChange={e => {
                                                setNome(e.target.value);
                                                if (e.target.value.trim()) setNameError(false);
                                            }} 
                                            className={`block w-full rounded-2xl bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner text-sm p-3.5 outline-none transition-all ${
                                                nameError 
                                                    ? 'border border-rose-500 focus:border-rose-500 focus:ring-rose-500' 
                                                    : 'border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-brand-blue'
                                            }`} 
                                            placeholder="Ex: João da Silva" 
                                            required 
                                        />
                                        {nameError && (
                                            <p className="text-rose-500 text-[10px] font-bold mt-1.5 ml-1">
                                                Nome completo é obrigatório.
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="field-cpf" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                                            CPF (opcional)
                                        </label>
                                        <input 
                                            type="text" 
                                            id="field-cpf" 
                                            value={cpf} 
                                            onChange={e => setCpf(e.target.value)} 
                                            className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" 
                                            placeholder="Ex: 123.456.789-00" 
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="field-phone" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                                            Telefone (opcional)
                                        </label>
                                        <input 
                                            type="text" 
                                            id="field-phone" 
                                            value={telefone} 
                                            onChange={e => setTelefone(e.target.value)} 
                                            className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" 
                                            placeholder="Ex: (11) 99999-9999" 
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="field-email" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                                            E-mail (opcional)
                                        </label>
                                        <input 
                                            type="email" 
                                            id="field-email" 
                                            value={email} 
                                            onChange={e => setEmail(e.target.value)} 
                                            className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all" 
                                            placeholder="Ex: joao@email.com" 
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="field-status" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                                            Status
                                        </label>
                                        <select 
                                            id="field-status" 
                                            value={status} 
                                            onChange={e => setStatus(e.target.value as 'active' | 'inactive')} 
                                            className="block w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all cursor-pointer"
                                        >
                                            <option value="active">Ativo</option>
                                            <option value="inactive">Inativo</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-[2rem] border-t border-slate-100 dark:border-slate-700/50 mt-auto">
                                <button 
                                    type="button" 
                                    onClick={handleCloseModal} 
                                    className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase tracking-wide cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-6 py-2.5 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:bg-emerald-700 transition-all uppercase hover:-translate-y-0.5 active:translate-y-0 tracking-wide cursor-pointer"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
