
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { AppContext } from '../contexts/AppContext';
import { UserIcon, PlusCircleIcon, UsersIcon, XMarkIcon, LockClosedIcon, EnvelopeIcon, TrashIcon, PencilIcon } from '../components/Icons';
import { supabase } from '../services/supabaseClient';

export const UsersManagementPage: React.FC = () => {
    const { setActiveView } = useUI();
    const { subscription, user: authUser } = useAuth();
    const { churches, banks } = useContext(AppContext);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        churchIds: [] as string[],
        bankIds: [] as string[],
        permissions: {
            confirmFinal: false,
            identifyPayments: false,
            undoIdentification: false,
            downloadFile: false,
            printReport: false,
            excluirRegistros: false
        }
    });

    // Redirecionamento de segurança se não for owner ou admin
    if (subscription.role !== 'owner' && subscription.role !== 'admin') {
        setActiveView('dashboard');
        return null;
    }

    const fetchUsers = useCallback(async () => {
        if (!authUser?.id) return;
        
        const effectiveOwnerId = subscription?.ownerId || authUser.id;
        console.log("[UsersManagement] Buscando usuários para owner:", effectiveOwnerId, "authUser.id:", authUser.id, "subscription.ownerId:", subscription?.ownerId);

        setIsLoadingUsers(true);
        try {
            // Obter token da sessão
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Usando a API do backend para listar usuários, ignorando RLS do frontend
            const response = await fetch(`/api/users/list/${effectiveOwnerId}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Falha ao buscar usuários');
            const data = await response.json();
            setUsers(data || []);
        } catch (error) {
            console.error("Erro ao buscar usuários:", error);
        } finally {
            setIsLoadingUsers(false);
        }
    }, [authUser?.id, authUser?.owner_id]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleSubmitUser = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (formData.churchIds.length === 0) {
            setStatusMessage({ type: 'error', text: 'Por favor, selecione pelo menos uma congregação.' });
            return;
        }

        if (formData.bankIds.length === 0) {
            setStatusMessage({ type: 'error', text: 'Por favor, selecione pelo menos um banco.' });
            return;
        }

        setLoading(true);
        setStatusMessage(null);
        
        // Mapeamento para a estrutura JSON solicitada
        const permissionsObject = {
            "confirmar_final": formData.permissions.confirmFinal,
            "identificar": formData.permissions.identifyPayments,
            "desfazer_identificacao": formData.permissions.undoIdentification,
            "baixar_arquivo": formData.permissions.downloadFile,
            "imprimir": formData.permissions.printReport,
            "excluir_registros": formData.permissions.excluirRegistros,
            "bankIds": formData.bankIds,
            "congregationIds": formData.churchIds
        };

        try {
            const effectiveOwnerId = subscription?.ownerId || authUser?.id;
            const url = editingUser ? `/api/users/update/${editingUser.id}` : '/api/users/create';
            const body = {
                name: formData.name,
                email: formData.email,
                churchIds: formData.churchIds,
                permissions: permissionsObject,
                ownerId: effectiveOwnerId
            };

            // Se for criação ou se a senha foi preenchida na edição
            if (!editingUser || formData.password) {
                Object.assign(body, {
                    password: formData.password
                });
            }

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const result = await response.json();

            if (!response.ok) {
                const errorMessage = result.error || 'Erro ao processar usuário';
                const errorDetails = result.details ? ` (${result.details})` : '';
                throw new Error(`${errorMessage}${errorDetails}`);
            }

            setStatusMessage({ type: 'success', text: editingUser ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!' });
            
            // Recarregar lista
            fetchUsers();
            
            // Limpar formulário e fechar após delay
            setTimeout(() => {
                handleCloseModal();
            }, 1500);

        } catch (error: any) {
            console.error("Erro ao processar usuário:", error);
            setStatusMessage({ type: 'error', text: error.message || 'Falha na operação.' });
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (user: any) => {
        const perms = user.permissions || {};
        const congregationRaw = user.congregation;
        
        // Tenta ler do JSON de permissões primeiro (suporte a múltiplos IDs em coluna UUID)
        let churchIds: string[] = [];
        if (Array.isArray(perms.congregationIds)) {
            churchIds = perms.congregationIds;
        } else if (typeof congregationRaw === 'string' && congregationRaw.length > 0) {
            churchIds = congregationRaw.split(',').map((id: string) => id.trim()).filter((id: string) => !!id);
        } else if (Array.isArray(congregationRaw)) {
            churchIds = congregationRaw;
        } else if (congregationRaw) {
            churchIds = [congregationRaw];
        }

        let bankIds: string[] = [];
        if (Array.isArray(perms.bankIds)) {
            bankIds = perms.bankIds;
        }

        setEditingUser(user);
        setFormData({
            name: user.name || '',
            email: user.email || '',
            password: '', // Não editamos senha aqui por enquanto
            churchIds: churchIds,
            bankIds: bankIds,
            permissions: {
                confirmFinal: !!perms.confirmar_final,
                identifyPayments: !!perms.identificar,
                undoIdentification: !!perms.desfazer_identificacao,
                downloadFile: !!perms.baixar_arquivo,
                printReport: !!perms.imprimir,
                excluirRegistros: !!perms.excluir_registros
            }
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setStatusMessage(null);
        setFormData({
            name: '',
            email: '',
            password: '',
            churchIds: [] as string[],
            bankIds: [] as string[],
            permissions: {
                confirmFinal: false,
                identifyPayments: false,
                undoIdentification: false,
                downloadFile: false,
                printReport: false,
                excluirRegistros: false
            }
        });
    };

    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm('Deseja realmente excluir este usuário? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            const effectiveOwnerId = subscription?.ownerId || authUser?.id;
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(`/api/users/delete/${userId}?ownerId=${effectiveOwnerId}`, {
                method: 'DELETE',
                cache: 'no-store',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Erro ao excluir usuário');
            }

            // Recarregar lista
            fetchUsers();
            alert('Usuário excluído com sucesso!');
        } catch (error: any) {
            console.error("Erro ao excluir usuário:", error);
            alert(`Falha ao excluir usuário: ${error.message}`);
        }
    };

    const togglePermission = (key: keyof typeof formData.permissions) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: !prev.permissions[key]
            }
        }));
    };

    const filteredUsers = users.filter(user => 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full gap-6 animate-fade-in pb-6 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mt-1">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-brand-blue/10 rounded-2xl text-brand-blue">
                        <UsersIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Usuários</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
                            Gerencie os acessos das congregações vinculadas à sua igreja.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <UsersIcon className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar usuário..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full text-xs font-medium focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all w-48 md:w-64"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center space-x-1.5 px-4 py-2 text-[10px] font-bold text-white bg-gradient-to-l from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 rounded-full shadow-md shadow-blue-500/30 hover:-translate-y-0.5 transition-all tracking-wide uppercase"
                    >
                        <PlusCircleIcon className="w-3.5 h-3.5" />
                        <span>Criar Usuário</span>
                    </button>
                </div>
            </div>

            {/* Listagem */}
            {isLoadingUsers ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
                </div>
            ) : filteredUsers.length > 0 ? (
                <div className="flex-1 overflow-hidden bg-white dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-700/50">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Usuário</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Congregações</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Bancos</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Permissões</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/30">
                                {filteredUsers.map((user) => {
                                    const church = churches.find(c => c.id === user.congregation);
                                    const perms = user.permissions || {};
                                    const activePermsCount = Object.values(perms).filter(v => v === true).length;

                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold uppercase">
                                                        {user.name?.substring(0, 2) || user.email?.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{user.name || 'Sem nome'}</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {(() => {
                                                        const perms = user.permissions || {};
                                                        const congregationRaw = user.congregation;
                                                        
                                                        let ids: string[] = [];
                                                        if (Array.isArray(perms.congregationIds)) {
                                                            ids = perms.congregationIds;
                                                        } else if (typeof congregationRaw === 'string' && congregationRaw.length > 0) {
                                                            ids = congregationRaw.split(',').map((id: string) => id.trim()).filter((id: string) => !!id);
                                                        } else if (Array.isArray(congregationRaw)) {
                                                            ids = congregationRaw;
                                                        } else if (congregationRaw) {
                                                            ids = [congregationRaw];
                                                        }
                                                        
                                                        if (ids.length === 0) return <span className="text-xs text-slate-400">Nenhuma</span>;
                                                        
                                                        return ids.map((id: string) => {
                                                            const church = churches.find(c => c.id === id);
                                                            return (
                                                                <span key={id} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-md whitespace-nowrap">
                                                                    {church?.name || 'Desconhecida'}
                                                                </span>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {(() => {
                                                        const perms = user.permissions || {};
                                                        const bankIds = perms.bankIds || [];
                                                        
                                                        if (bankIds.length === 0) return <span className="text-xs text-slate-400">Nenhum</span>;
                                                        
                                                        return bankIds.map((id: string) => {
                                                            const bank = banks.find(b => b.id === id);
                                                            return (
                                                                <span key={id} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-md whitespace-nowrap">
                                                                    {bank?.name || 'Desconhecido'}
                                                                </span>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-brand-blue/10 text-brand-blue text-[10px] font-bold rounded-full">
                                                        {activePermsCount} Permissões
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 rounded-xl transition-all"
                                                        title="Editar Usuário"
                                                        onClick={() => handleEditClick(user)}
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button 
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                                        title="Excluir Usuário"
                                                        onClick={() => handleDeleteUser(user.id)}
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700/50 min-h-[400px]">
                    <div className="flex flex-col items-center text-center p-8">
                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-700">
                            <UserIcon className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                            {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado ainda.'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-xs text-sm font-medium">
                            {searchTerm 
                                ? 'Não encontramos nenhum usuário correspondente à sua busca.' 
                                : 'Comece adicionando novos usuários para permitir que outras pessoas gerenciem suas congregações.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Modal de Cadastro/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-deep/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <div className="px-8 pt-8 pb-4 flex justify-between items-center flex-shrink-0">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                            </h3>
                            <button 
                                onClick={handleCloseModal}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitUser} className="flex flex-col flex-1 min-h-0">
                            <div className="px-8 py-4 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                                {statusMessage && (
                                    <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 animate-fade-in ${
                                        statusMessage.type === 'success' 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                            : 'bg-red-50 text-red-700 border border-red-100'
                                    }`}>
                                        <div className={`w-2 h-2 rounded-full ${statusMessage.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        {statusMessage.text}
                                    </div>
                                )}
                                <div className="space-y-4">
                                    {/* Nome */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Nome Completo</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                                <UserIcon className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={e => setFormData({...formData, name: e.target.value})}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-slate-900 dark:text-white font-medium"
                                                placeholder="Ex: João Silva"
                                            />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">E-mail</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                                <EnvelopeIcon className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={e => setFormData({...formData, email: e.target.value})}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-slate-900 dark:text-white font-medium"
                                                placeholder="joao@exemplo.com"
                                            />
                                        </div>
                                    </div>

                                    {/* Senha */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                                            {editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha Provisória'}
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                                <LockClosedIcon className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="password"
                                                required={!editingUser}
                                                value={formData.password}
                                                onChange={e => setFormData({...formData, password: e.target.value})}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-slate-900 dark:text-white font-medium"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    {/* Congregações */}
                                    <div className="space-y-3">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Congregações Autorizadas</label>
                                        <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar p-1">
                                            {churches.length > 0 ? (
                                                churches.map(church => (
                                                    <label 
                                                        key={church.id}
                                                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.churchIds.includes(church.id)}
                                                            onChange={() => {
                                                                setFormData(prev => {
                                                                    const ids = prev.churchIds.includes(church.id)
                                                                        ? prev.churchIds.filter(id => id !== church.id)
                                                                        : [...prev.churchIds, church.id];
                                                                    return { ...prev, churchIds: ids };
                                                                });
                                                            }}
                                                            className="w-5 h-5 rounded-lg border-slate-300 text-brand-blue focus:ring-brand-blue/20"
                                                        />
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-brand-blue transition-colors">
                                                            {church.name}
                                                        </span>
                                                    </label>
                                                ))
                                            ) : (
                                                <p className="text-xs text-slate-500 italic p-2">Nenhuma congregação cadastrada.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bancos */}
                                    <div className="space-y-3">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Bancos Autorizados</label>
                                        <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar p-1">
                                            {banks.length > 0 ? (
                                                banks.map(bank => (
                                                    <label 
                                                        key={bank.id}
                                                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.bankIds.includes(bank.id)}
                                                            onChange={() => {
                                                                setFormData(prev => {
                                                                    const ids = prev.bankIds.includes(bank.id)
                                                                        ? prev.bankIds.filter(id => id !== bank.id)
                                                                        : [...prev.bankIds, bank.id];
                                                                    return { ...prev, bankIds: ids };
                                                                });
                                                            }}
                                                            className="w-5 h-5 rounded-lg border-slate-300 text-brand-blue focus:ring-brand-blue/20"
                                                        />
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-brand-blue transition-colors">
                                                            {bank.name}
                                                        </span>
                                                    </label>
                                                ))
                                            ) : (
                                                <p className="text-xs text-slate-500 italic p-2">Nenhum banco cadastrado.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Permissões */}
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Permissões de Acesso</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { key: 'confirmFinal', label: 'Confirmar final' },
                                            { key: 'identifyPayments', label: 'Identificar pagamentos' },
                                            { key: 'undoIdentification', label: 'Desfazer identificação' },
                                            { key: 'downloadFile', label: 'Baixar arquivo' },
                                            { key: 'printReport', label: 'Imprimir relatório' },
                                            { key: 'excluirRegistros', label: 'Excluir registros' }
                                        ].map(perm => (
                                            <label 
                                                key={perm.key}
                                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.permissions[perm.key as keyof typeof formData.permissions]}
                                                    onChange={() => togglePermission(perm.key as keyof typeof formData.permissions)}
                                                    className="w-5 h-5 rounded-lg border-slate-300 text-brand-blue focus:ring-brand-blue/20"
                                                />
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-brand-blue transition-colors">
                                                    {perm.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 rounded-b-[2.5rem] border-t border-slate-100 dark:border-slate-700/50 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-6 py-2.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors uppercase tracking-wide"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`px-8 py-2.5 rounded-full shadow-lg shadow-blue-500/30 text-xs font-bold text-white bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 active:bg-blue-700 transition-all uppercase hover:-translate-y-0.5 active:translate-y-0 tracking-wide flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Processando...</span>
                                        </>
                                    ) : (
                                        editingUser ? 'Salvar Alterações' : 'Criar Usuário'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
