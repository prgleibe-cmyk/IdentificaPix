
import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../../services/supabaseClient';
import { usePermissions } from './usePermissions';
import { UserProfile, DEFAULT_TREASURER_PERMISSIONS } from './types';
import { AppContext } from '../../contexts/AppContext';
import { useUser } from './UserContext';
import { Users, UserPlus, Shield, Church as ChurchIcon, Check, X, Trash2, Edit2 } from 'lucide-react';

const PERMISSION_LABELS: Record<string, string> = {
    view_viva: "Ver Lista Viva",
    view_reports: "Ver Relatórios",
    can_reconcile: "Conciliar Lançamentos",
    can_export: "Exportar Dados",
    can_confirm_final: "Confirmar Fechamento",
    can_upload_files: "Upload de Arquivos",
    can_manage_settings: "Gerenciar Configurações",
    read_only: "Apenas Leitura"
};

export const UserManagementView: React.FC = () => {
    const { profile: adminProfile } = useUser();
    const { isRole } = usePermissions();
    const { churches } = useContext(AppContext);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

    // Bloqueio de segurança: Se não for admin, não renderiza nada
    if (!isRole('admin')) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <Shield className="w-16 h-16 text-red-500 mb-4 opacity-20" />
                <h2 className="text-xl font-black text-slate-800 dark:text-white">Acesso Negado</h2>
                <p className="text-slate-500 text-sm max-w-xs mt-2">
                    Esta área é exclusiva para administradores do sistema.
                </p>
            </div>
        );
    }

    // Form State
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'admin' | 'treasurer'>('treasurer');
    const [congregationId, setCongregationId] = useState('');
    const [permissions, setPermissions] = useState(DEFAULT_TREASURER_PERMISSIONS);

    const fetchUsers = async () => {
        if (!adminProfile) return;
        setLoading(true);
        const { data, error } = await (supabase as any)
            .from('user_profiles')
            .select('*')
            .eq('main_account_id', adminProfile.main_account_id);
        
        if (data) setUsers(data as UserProfile[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, [adminProfile]);

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminProfile) return;

        const payload = {
            main_account_id: adminProfile.main_account_id,
            role,
            congregation_id: role === 'admin' ? null : congregationId,
            permissions,
            is_active: true
        };

        if (editingUser) {
            const { error } = await (supabase as any)
                .from('user_profiles')
                .update(payload as any)
                .eq('id', editingUser.id);
            
            if (!error) {
                setEditingUser(null);
                setShowAddModal(false);
                fetchUsers();
            } else {
                alert("Erro ao atualizar: " + error.message);
            }
        } else {
            // Novo Usuário - Pré-cadastro por E-mail
            const { error } = await (supabase as any)
                .from('user_profiles')
                .insert([{
                    id: crypto.randomUUID(), // ID temporário que será substituído no primeiro login
                    email: email.toLowerCase().trim(),
                    main_account_id: adminProfile.main_account_id,
                    role,
                    congregation_id: role === 'admin' ? null : congregationId,
                    permissions,
                    is_active: true
                }] as any);
            
            if (!error) {
                setShowAddModal(false);
                setEmail('');
                fetchUsers();
            } else {
                if (error.code === 'PGRST205' || (error as any).status === 404) {
                    alert("Erro de Sincronização: A tabela 'user_profiles' não foi detectada pela API. Por favor, execute 'NOTIFY pgrst, 'reload schema';' no SQL Editor do Supabase ou aguarde 1 minuto.");
                } else {
                    alert("Erro ao criar usuário: " + error.message);
                }
            }
        }
    };

    const togglePermission = (key: keyof typeof permissions) => {
        setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
            {/* Header Section */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 mt-1">
                <div>
                    <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight">Gestão de Usuários e Congregações</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px]">Gerencie quem pode acessar e o que cada tesoureiro pode fazer.</p>
                </div>

                <button 
                    onClick={() => {
                        setEditingUser(null);
                        setEmail('');
                        setRole('treasurer');
                        setCongregationId('');
                        setPermissions(DEFAULT_TREASURER_PERMISSIONS);
                        setShowAddModal(true);
                    }}
                    className="flex items-center space-x-1.5 px-4 py-2 text-[10px] font-bold text-white bg-gradient-to-l from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 rounded-full shadow-md shadow-blue-500/30 hover:-translate-y-0.5 transition-all tracking-wide uppercase"
                >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Novo Usuário</span>
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 h-full flex flex-col hover:shadow-soft transition-all duration-500 relative overflow-hidden animate-fade-in-up">
                    
                    <div className="flex justify-between items-center mb-6 flex-shrink-0 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-brand-blue dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                <Users className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="font-bold text-base text-slate-800 dark:text-white leading-none">Usuários Vinculados</h3>
                                <span className="text-xs font-bold mt-1 text-emerald-500">Total: {users.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center p-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-12 text-center">
                                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 text-sm font-medium">Nenhum usuário secundário encontrado.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {users.map(user => (
                                    <div key={user.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-blue-500/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {user.role === 'admin' ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{user.email || 'Usuário'}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${user.role === 'admin' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                        {user.role === 'admin' ? 'Administrador' : 'Tesoureiro'}
                                                    </span>
                                                    {user.congregation_id && (
                                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center gap-1">
                                                            <ChurchIcon className="w-2.5 h-2.5" />
                                                            {churches.find(c => c.id === user.congregation_id)?.name || 'Congregação'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => {
                                                    setEditingUser(user);
                                                    setRole(user.role);
                                                    setCongregationId(user.congregation_id || '');
                                                    setPermissions(user.permissions);
                                                    setShowAddModal(true);
                                                }}
                                                className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-blue-500 transition-all shadow-sm"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 transition-all shadow-sm">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Edição/Adição */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-200">
                        <form onSubmit={handleSaveUser} className="flex flex-col min-h-0">
                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                <header className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        {editingUser ? <Edit2 className="w-5 h-5 text-blue-500" /> : <UserPlus className="w-5 h-5 text-blue-500" />}
                                        {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                                    </h2>
                                    <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all">
                                        <X className="w-5 h-5" />
                                    </button>
                                </header>

                                <div className="space-y-4">
                                    {!editingUser && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">E-mail do Usuário</label>
                                            <input 
                                                type="email" 
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                                                placeholder="exemplo@email.com"
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Papel</label>
                                            <select 
                                                value={role}
                                                onChange={e => setRole(e.target.value as any)}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                                            >
                                                <option value="treasurer">Tesoureiro</option>
                                                <option value="admin">Administrador</option>
                                            </select>
                                        </div>
                                        {role === 'treasurer' && (
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Congregação</label>
                                                <select 
                                                    value={congregationId}
                                                    onChange={e => setCongregationId(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                                                    required
                                                >
                                                    <option value="">Selecionar...</option>
                                                    {churches.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Permissões Específicas</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.keys(permissions).map((key) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => togglePermission(key as any)}
                                                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                                                        permissions[key as keyof typeof permissions]
                                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-600'
                                                            : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400'
                                                    }`}
                                                >
                                                    <span className="text-[10px] font-black uppercase tracking-tight">
                                                        {PERMISSION_LABELS[key] || key.replace(/_/g, ' ')}
                                                    </span>
                                                    {permissions[key as keyof typeof permissions] ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 flex-shrink-0">
                                <button 
                                    type="button" 
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
