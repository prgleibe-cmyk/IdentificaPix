import React, { useState, useRef } from 'react';
import { useUI } from '../../contexts/UIContext';
import { UsersIcon, PlusCircleIcon, SearchIcon, XMarkIcon } from '../Icons';
import { Camera, Trash2 } from 'lucide-react';

export const ContributorsList: React.FC = () => {
    const { showToast } = useUI();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Form States
    const [fullName, setFullName] = useState('');
    const [selectedChurchId, setSelectedChurchId] = useState('church-1');
    const [cpf, setCpf] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);

    // Photo States (Client-side visual only, prepared for POST /api/v1/contributors/:id/photo)
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Lista local temporária (preparada para futura substituição pela API da VPS: GET /api/v1/churches)
    const tempChurches = [
        { id: 'church-1', name: 'Selecione uma igreja' },
        { id: 'church-2', name: 'Igreja Batista Central' },
        { id: 'church-3', name: 'Igreja Presbiteriana Renovada' }
    ];

    const handleNewContributorClick = () => {
        setIsModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (photoPreview) {
                URL.revokeObjectURL(photoPreview);
            }
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleRemovePhoto = () => {
        if (photoPreview) {
            URL.revokeObjectURL(photoPreview);
        }
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFullName('');
        setSelectedChurchId('church-1');
        setCpf('');
        setPhone('');
        setEmail('');
        setStatus('Ativo');
        setAttemptedSubmit(false);

        // Reset photo state and revoke preview URL
        if (photoPreview) {
            URL.revokeObjectURL(photoPreview);
        }
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setAttemptedSubmit(true);

        if (!fullName.trim() || !selectedChurchId || selectedChurchId === 'church-1') {
            return; // Show validation error on UI
        }

        // Show homologation toast
        showToast("Modo homologação: integração ainda não habilitada.", "success");
        
        // Close and reset
        handleCloseModal();
    };

    const isNameInvalid = attemptedSubmit && !fullName.trim();
    const isChurchInvalid = attemptedSubmit && (!selectedChurchId || selectedChurchId === 'church-1');

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
                            <div className="p-6 md:p-8 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar">
                                
                                {/* FOTO DO CONTRIBUINTE (Visual only, prepared for POST /api/v1/contributors/:id/photo) */}
                                <div className="flex flex-col items-center justify-center pb-5 border-b border-slate-100 dark:border-slate-800/80" id="photo-section">
                                    <span className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-3 tracking-wide" id="lbl-photo-section">
                                        Foto do Contribuinte
                                    </span>
                                    
                                    <div className="relative group mb-3 shadow-md rounded-full" id="photo-avatar-wrapper">
                                        <div className="w-24 h-24 rounded-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden shadow-inner" id="photo-avatar-container">
                                            {photoPreview ? (
                                                <img 
                                                    src={photoPreview} 
                                                    alt="Preview do contribuinte" 
                                                    className="w-full h-full object-cover"
                                                    id="photo-avatar-preview"
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : (
                                                <UsersIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 animate-pulse" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-center gap-2" id="photo-actions">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileChange} 
                                            accept="image/*" 
                                            className="hidden" 
                                            id="photo-file-input"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-all tracking-wide uppercase border border-slate-200 dark:border-slate-700 shadow-sm active:translate-y-0.2"
                                            id="btn-select-photo"
                                        >
                                            <Camera className="w-3.5 h-3.5" />
                                            <span>Selecionar Foto</span>
                                        </button>
                                        
                                        {photoPreview && (
                                            <button 
                                                type="button" 
                                                onClick={handleRemovePhoto}
                                                className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 hover:bg-rose-100/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 rounded-full transition-all tracking-wide uppercase border border-rose-200 dark:border-rose-900/40 shadow-sm active:translate-y-0.2"
                                                id="btn-remove-photo"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>Remover Foto</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

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

                                {/* Igreja */}
                                <div>
                                    <label htmlFor="contributor-church" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 ml-1" id="lbl-church">
                                        Igreja <span className="text-rose-500">*</span>
                                    </label>
                                    <select 
                                        id="contributor-church" 
                                        value={selectedChurchId} 
                                        onChange={(e) => setSelectedChurchId(e.target.value)} 
                                        className={`block w-full rounded-2xl bg-slate-50 dark:bg-slate-800 text-brand-graphite dark:text-slate-200 shadow-inner text-sm p-3.5 outline-none transition-all cursor-pointer ${
                                            isChurchInvalid 
                                                ? 'border border-rose-500 focus:border-rose-500 focus:ring-rose-500' 
                                                : 'border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-brand-blue'
                                        }`}
                                    >
                                        {tempChurches.map((church) => (
                                            <option key={church.id} value={church.id}>
                                                {church.name}
                                            </option>
                                        ))}
                                    </select>
                                    {isChurchInvalid && (
                                        <p className="text-rose-500 text-[10px] font-semibold mt-1.5 ml-1 animate-fade-in" id="church-warning">
                                            A seleção da igreja é obrigatória.
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
