import React, { useState, useRef, useEffect, useContext } from 'react';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { UsersIcon, PlusCircleIcon, SearchIcon, XMarkIcon } from '../Icons';
import { Camera, Trash2, Edit2, Loader2 } from 'lucide-react';

export const ContributorsList: React.FC = () => {
    const { showToast } = useUI();
    const { churches } = useContext(AppContext);
    
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contributors, setContributors] = useState<any[]>([]);
    const [isLoadingContributors, setIsLoadingContributors] = useState<boolean>(true);
    const [editingContributor, setEditingContributor] = useState<any | null>(null);
    
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

    // Real list of churches from context
    const tempChurches = [
        { id: 'church-1', name: 'Selecione uma igreja' },
        ...churches.map((c: any) => ({ id: c.id, name: c.name }))
    ];

    const fetchContributors = async () => {
        try {
            setIsLoadingContributors(true);
            const response = await fetch('/api/v1/contributors');
            if (response.ok) {
                const data = await response.json();
                setContributors(data);
            } else {
                console.error('[ContributorsList] Failed to fetch contributors');
            }
        } catch (error) {
            console.error('[ContributorsList] Error fetching contributors:', error);
        } finally {
            setIsLoadingContributors(false);
        }
    };

    useEffect(() => {
        fetchContributors();
    }, []);

    const handleNewContributorClick = () => {
        setIsModalOpen(true);
    };

    const handleEditClick = (contributor: any) => {
        setEditingContributor(contributor);
        setFullName(contributor.canonical_name);
        setSelectedChurchId(contributor.church_id);
        setCpf(contributor.cpf || '');
        setEmail(contributor.email || '');
        setPhone(contributor.phone || '');
        setStatus(contributor.status === 'inactive' ? 'Inativo' : 'Ativo');
        setIsModalOpen(true);
    };

    const handleDeleteContributor = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja inativar o contribuinte "${name}"?`)) {
            return;
        }
        try {
            const response = await fetch(`/api/v1/contributors/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast("Contribuinte inativado com sucesso.", "success");
                fetchContributors();
            } else {
                showToast("Falha ao inativar contribuinte.", "error");
            }
        } catch (error) {
            console.error('[ContributorsList] Error deleting contributor:', error);
            showToast("Falha ao inativar contribuinte.", "error");
        }
    };

    const handleDeletePermanent = async (id: string, name: string) => {
        if (!confirm(`ATENÇÃO: Você deseja EXCLUIR DEFINITIVAMENTE o cadastro do contribuinte "${name}"?\nEsta ação é irreversível e removerá permanentemente o cadastro do banco de dados.`)) {
            return;
        }
        try {
            const response = await fetch(`/api/v1/contributors/${id}?hard=true`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast("Contribuinte excluído definitivamente.", "success");
                fetchContributors();
            } else {
                showToast("Falha ao excluir contribuinte definitivamente.", "error");
            }
        } catch (error) {
            console.error('[ContributorsList] Error hard deleting contributor:', error);
            showToast("Falha ao excluir contribuinte definitivamente.", "error");
        }
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
        setEditingContributor(null);
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setAttemptedSubmit(true);

        const trimmedName = fullName.trim();
        const isValidName = trimmedName.length > 0;
        const isValidChurch = selectedChurchId && selectedChurchId !== 'church-1';

        if (!isValidName || !isValidChurch) {
            return; // Show validation error on UI
        }

        try {
            // Normalizations as per rules
            const canonical_name = trimmedName.replace(/\s+/g, ' ').toUpperCase();
            
            const rawCpf = cpf.replace(/\D/g, '');
            const sanitizedCpf = rawCpf.length > 0 ? rawCpf : null;

            const trimmedEmail = email.trim();
            const sanitizedEmail = trimmedEmail.length > 0 ? trimmedEmail : null;

            const trimmedPhone = phone.trim();
            const sanitizedPhone = trimmedPhone.length > 0 ? trimmedPhone : null;

            const sanitizedStatus = status === 'Ativo' ? 'active' : 'inactive';

            const payload = {
                church_id: selectedChurchId,
                canonical_name,
                cpf: sanitizedCpf,
                email: sanitizedEmail,
                phone: sanitizedPhone,
                status: sanitizedStatus
            };

            let response;
            if (editingContributor) {
                response = await fetch(`/api/v1/contributors/${editingContributor.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await fetch('/api/v1/contributors', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            }

            if (response.status === 201 || response.status === 200) {
                showToast(editingContributor ? "Contribuinte atualizado com sucesso." : "Contribuinte cadastrado com sucesso.", "success");
                handleCloseModal();
                fetchContributors();
            } else if (response.status === 409) {
                showToast("Já existe um contribuinte ativo com este CPF nesta igreja.", "error");
            } else if (response.status === 400) {
                const responseData = await response.json().catch(() => null);
                const errorMsg = responseData?.error || "Erro de validação. Verifique os dados.";
                showToast(errorMsg === "VALIDATION_ERROR" ? "Erro de validação nos dados enviados." : errorMsg, "error");
            } else {
                showToast("Falha ao salvar contribuinte. Tente novamente.", "error");
            }
        } catch (error) {
            console.error('[ContributorsList] Error saving contributor:', error);
            showToast("Falha ao salvar contribuinte. Tente novamente.", "error");
        }
    };

    const isNameInvalid = attemptedSubmit && !fullName.trim();
    const isChurchInvalid = attemptedSubmit && (!selectedChurchId || selectedChurchId === 'church-1');

    const filteredContributors = contributors.filter(c => {
        const query = search.toLowerCase().trim();
        if (!query) return true;
        const nameMatch = c.canonical_name?.toLowerCase().includes(query);
        const cpfMatch = c.cpf?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
        return nameMatch || cpfMatch;
    });

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
                
                {/* Button: + Novo Contribuinte */}
                <div className="flex-shrink-0">
                    <button 
                        onClick={handleNewContributorClick}
                        className="w-full md:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 text-[10px] font-bold text-white bg-gradient-to-l from-slate-700 to-slate-500 hover:from-slate-800 hover:to-slate-600 rounded-full shadow-md shadow-slate-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wide uppercase cursor-pointer"
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
                    placeholder="Buscar por nome ou CPF..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="pl-8 p-2.5 block w-full rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-brand-graphite dark:text-slate-200 focus:border-brand-blue focus:ring-brand-blue transition-all shadow-sm focus:bg-white dark:focus:bg-slate-900 text-xs font-medium outline-none" 
                    id="contributors-search"
                />
            </div>

            {/* Content list or empty states */}
            {isLoadingContributors ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 animate-pulse text-center">
                    <Loader2 className="w-8 h-8 text-brand-blue animate-spin mb-3" />
                    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                        Carregando contribuintes...
                    </p>
                </div>
            ) : filteredContributors.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl min-h-[250px] animate-fade-in-up">
                    <div className="p-4 bg-slate-100/80 dark:bg-slate-900 rounded-full mb-4">
                        <UsersIcon className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                        Nenhum contribuinte encontrado.
                    </h4>
                    <p className="max-w-md text-center text-slate-500 dark:text-slate-400 text-xs leading-relaxed" id="contributors-message">
                        {search ? "Nenhum resultado corresponde à sua busca." : "Cadastre o primeiro contribuinte utilizando o botão no topo direito."}
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-x-auto overflow-y-auto pr-1 custom-scrollbar" id="contributors-list-flow">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                        <thead className="bg-slate-50/50 dark:bg-slate-900/40">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Contribuinte
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Igreja Vinculada
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Documento / Contato
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-4 py-3 text-right text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 bg-white dark:bg-slate-900/30 font-sans">
                            {filteredContributors.map((c) => {
                                const church = churches.find((ch: any) => ch.id === c.church_id);
                                return (
                                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors animate-fade-in">
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 rounded-full bg-brand-blue/5 dark:bg-slate-800/80 flex items-center justify-center font-black text-brand-blue text-[10px] uppercase shrink-0 select-none">
                                                    {c.canonical_name?.substring(0, 2)}
                                                </div>
                                                <div className="truncate max-w-[185px]">
                                                    <h5 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-tight truncate">
                                                        {c.canonical_name}
                                                    </h5>
                                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block mt-0.5">
                                                        ID: {c.id?.substring(0, 8)}...
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                {church ? church.name : 'Igreja não identificada'}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5">
                                            <div className="space-y-0.5 max-w-[200px] truncate">
                                                {c.cpf && (
                                                    <div className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 flex items-center">
                                                        <span className="text-[9px] font-black text-slate-400 mr-1 uppercase">CPF:</span>
                                                        {c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                    </div>
                                                )}
                                                {c.phone && (
                                                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center">
                                                        <span className="text-[9px] font-black text-slate-400 mr-1 uppercase">TEL:</span>
                                                        {c.phone}
                                                    </div>
                                                )}
                                                {c.email && (
                                                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center truncate">
                                                        <span className="text-[9px] font-black text-slate-400 mr-1 uppercase">EMAIL:</span>
                                                        <span className="truncate">{c.email}</span>
                                                    </div>
                                                )}
                                                {!c.cpf && !c.phone && !c.email && (
                                                    <span className="text-[10px] italic text-slate-400">-</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                                                c.status === 'active' 
                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                                    : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                                            }`}>
                                                {c.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end space-x-1.5">
                                                <button 
                                                    onClick={() => handleEditClick(c)}
                                                    className="p-1 px-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                                                    title="Editar dados"
                                                >
                                                    <Edit2 className="w-2.5 h-2.5" />
                                                    <span>Editar</span>
                                                </button>

                                                {c.status === 'active' ? (
                                                    <button 
                                                        onClick={() => handleDeleteContributor(c.id, c.canonical_name)}
                                                        className="p-1 px-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-rose-50/50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:text-rose-400 text-slate-500 text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                                                        title="Inativar contribuinte"
                                                    >
                                                        <Trash2 className="w-2.5 h-2.5" />
                                                        <span>Inativar</span>
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => {
                                                            fetch(`/api/v1/contributors/${c.id}`, {
                                                                method: 'PUT',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ status: 'active' })
                                                            }).then(res => {
                                                                if (res.ok) {
                                                                    showToast("Contribuinte reativado com sucesso.", "success");
                                                                    fetchContributors();
                                                                }
                                                            });
                                                        }}
                                                        className="p-1 px-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-emerald-50/50 hover:text-emerald-600 dark:hover:bg-emerald-950/20 dark:text-emerald-400 text-slate-500 text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                                                        title="Ativar contribuinte"
                                                    >
                                                        <Loader2 className="w-2.5 h-2.5" />
                                                        <span>Ativar</span>
                                                    </button>
                                                )}

                                                <button 
                                                    onClick={() => handleDeletePermanent(c.id, c.canonical_name)}
                                                    className="p-1 px-2.5 rounded-lg border border-red-100/50 hover:bg-red-500 hover:text-white dark:border-red-900/40 dark:hover:bg-red-600 dark:text-red-400 hover:border-red-500 text-red-500 hover:text-white text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                                                    title="Excluir cadastro permanentemente"
                                                >
                                                    <Trash2 className="w-2.5 h-2.5" />
                                                    <span>Excluir</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* NEW CONTRIBUTOR MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-brand-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="contributor-modal-container">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 transform transition-all scale-100 flex flex-col max-h-[90vh] overflow-hidden animate-zoom-in" id="contributor-modal-content">
                        <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden" id="contributor-modal-form">
                            
                            {/* Modal Header */}
                            <div className="p-6 md:p-8 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-lg font-bold text-brand-graphite dark:text-white tracking-tight" id="contributor-modal-title">
                                    {editingContributor ? 'Editar Contribuinte' : 'Novo Contribuinte'}
                                </h3>
                                <button 
                                    type="button" 
                                    onClick={handleCloseModal} 
                                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer" 
                                    id="btn-close-contributor-modal"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body with inputs - Scrollable if small screen */}
                            <div className="p-6 md:p-8 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar">
                                
                                {/* FOTO DO CONTRIBUINTE (Visual only) */}
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
                                            className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-all tracking-wide uppercase border border-slate-200 dark:border-slate-700 shadow-sm active:translate-y-0.2 cursor-pointer"
                                            id="btn-select-photo"
                                        >
                                            <Camera className="w-3.5 h-3.5" />
                                            <span>Selecionar Foto</span>
                                        </button>
                                        
                                        {photoPreview && (
                                            <button 
                                                type="button" 
                                                onClick={handleRemovePhoto}
                                                className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 hover:bg-rose-100/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 rounded-full transition-all tracking-wide uppercase border border-rose-200 dark:border-rose-900/40 shadow-sm active:translate-y-0.2 cursor-pointer"
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
                                    className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase tracking-wide cursor-pointer" 
                                    id="btn-cancel-contributor"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-6 py-2.5 rounded-full shadow-lg shadow-emerald-500/30 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:bg-emerald-700 transition-all uppercase hover:-translate-y-0.5 active:translate-y-0 tracking-wide cursor-pointer"
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
