import React, { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { UsersIcon, PlusCircleIcon, SearchIcon, XMarkIcon } from '../Icons';

export const ContributorsList: React.FC = () => {
    const { showToast } = useUI();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Form States
    const [fullName, setFullName] = useState('');
    const [cpf, setCpf] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);

    const handleNewContributorClick = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFullName('');
        setCpf('');
        setPhone('');
        setEmail('');
        setStatus('Ativo');
        setAttemptedSubmit(false);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setAttemptedSubmit(true);

        if (!fullName.trim()) {
            return; // Show validation error on UI
        }

        // Show homologation toast
        showToast("Modo homologação: integração ainda não habilitada.", "success");
        
        // Close and reset
        handleCloseModal();
    };

    const isNameInvalid = attemptedSubmit && !fullName.trim();

    return (
        <div className="h-full flex flex-col animate-fade-in" id="contributors-container">
            {/* Header Area */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800/60">
                        <UsersIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-slate-800 dark:text-white leading-none">
                            Contribuintes
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                            Gerenciamento de membros e congregados.
                        </p>
                    </div>
                </div>
                
                {/* Visual Button: + Novo Contribuinte */}
                <div className="flex-shrink-0">
                    <button 
                        onClick={handleNewContributorClick}
                        className="w-full md:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 text-[10px] font-bold text-white bg-gradient-to-l from-slate-700 to-slate-500 hover:from-slate-800 hover:to-slate-600 rounded-full shadow-md shadow-slate-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wide uppercase"
                        id="new-contributor-btn"
                    >
                        <PlusCircleIcon className="w-3.5 h-3.5" />
                        <span>+ Novo Contribuinte</span>
                    </button>
                </div>
            </div>

            {/* Visual Search input below the header */}
            <div className="relative mb-6 flex-shrink-0">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou CPF" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="pl-8 p-2 block w-full rounded-lg border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900 text-[11px] font-medium outline-none" 
                    id="contributors-search"
                />
            </div>

            {/* Central Empty State Section */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl min-h-[250px] animate-fade-in-up">
                <div className="p-4 bg-slate-100/80 dark:bg-slate-900 rounded-full mb-4">
                    <UsersIcon className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                    Nenhum contribuinte cadastrado.
                </h4>
                <p className="max-w-md text-center text-slate-500 dark:text-slate-400 text-xs leading-relaxed" id="contributors-message">
                    A integração do módulo Contributors será realizada nas próximas etapas.
                </p>
            </div>

            {/* NEW CONTRIBUTOR MODAL (Exclusively Visual Modal) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-brand-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="contributor-modal-container">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 transform transition-all scale-100 flex flex-col max-h-[90vh] overflow-hidden animate-zoom-in" id="contributor-modal-content">
                        <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden" id="contributor-modal-form">
                            
                            {/* Modal Header */}
                            <div className="p-6 md:p-8 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-lg font-bold text-brand-graphite dark:text-white tracking-tight" id="contributor-modal-title">
                                    Novo Contribuinte
                                </h3>
                                <button 
                                    type="button" 
                                    onClick={handleCloseModal} 
                                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                                    id="btn-close-contributor-modal"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body with inputs - Scrollable if small screen */}
                            <div className="p-6 md:p-8 space-y-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
                                
                                {/* Nome Completo */}
                                <div>
                                    <label htmlFor="contributor-fullname" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1" id="lbl-fullname">
                                        Nome Completo <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        id="contributor-fullname" 
                                        value={fullName} 
                                        onChange={(e) => setFullName(e.target.value)} 
                                        placeholder="Digite o nome completo do contribuinte"
                                        className={`block w-full rounded-2xl bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner text-sm p-3.5 outline-none transition-all ${
                                            isNameInvalid 
                                                ? 'border border-rose-500 focus:border-rose-500 focus:ring-rose-500' 
                                                : 'border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-brand-blue'
                                        }`}
                                    />
                                    {isNameInvalid && (
                                        <p className="text-rose-500 text-[10px] font-semibold mt-1.5 ml-1 animate-fade-in" id="name-warning">
                                            O nome completo é obrigatório.
                                        </p>
                                    )}
                                </div>

                                {/* CPF */}
                                <div>
                                    <label htmlFor="contributor-cpf" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1" id="lbl-cpf">
                                        CPF
                                    </label>
                                    <input 
                                        type="text" 
                                        id="contributor-cpf" 
                                        value={cpf} 
                                        onChange={(e) => setCpf(e.target.value)} 
                                        placeholder="000.000.000-00"
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner text-sm p-3.5 outline-none transition-all focus:border-brand-blue focus:ring-brand-blue"
                                    />
                                </div>

                                {/* Telefone */}
                                <div>
                                    <label htmlFor="contributor-phone" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1" id="lbl-phone">
                                        Telefone
                                    </label>
                                    <input 
                                        type="text" 
                                        id="contributor-phone" 
                                        value={phone} 
                                        onChange={(e) => setPhone(e.target.value)} 
                                        placeholder="(00) 00000-0000"
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner text-sm p-3.5 outline-none transition-all focus:border-brand-blue focus:ring-brand-blue"
                                    />
                                </div>

                                {/* E-mail */}
                                <div>
                                    <label htmlFor="contributor-email" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1" id="lbl-email">
                                        E-mail
                                    </label>
                                    <input 
                                        type="email" 
                                        id="contributor-email" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                        placeholder="exemplo@igreja.com.br"
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner text-sm p-3.5 outline-none transition-all focus:border-brand-blue focus:ring-brand-blue"
                                    />
                                </div>

                                {/* Status */}
                                <div>
                                    <label htmlFor="contributor-status" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1" id="lbl-status">
                                        Status
                                    </label>
                                    <select 
                                        id="contributor-status" 
                                        value={status} 
                                        onChange={(e) => setStatus(e.target.value as 'Ativo' | 'Inativo')} 
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner focus:border-brand-blue focus:ring-brand-blue text-sm p-3.5 outline-none transition-all cursor-pointer"
                                    >
                                        <option value="Ativo">Ativo</option>
                                        <option value="Inativo">Inativo</option>
                                    </select>
                                </div>

                            </div>

                            {/* Modal Actions Footer */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-[2rem] border-t border-slate-100 dark:border-slate-700/50" id="contributor-modal-actions">
                                <button 
                                    type="button" 
                                    onClick={handleCloseModal} 
                                    className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase tracking-wide" 
                                    id="btn-cancel-contributor"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-6 py-2.5 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:bg-emerald-700 transition-all uppercase hover:-translate-y-0.5 active:translate-y-0 tracking-wide"
                                    id="btn-save-contributor"
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
