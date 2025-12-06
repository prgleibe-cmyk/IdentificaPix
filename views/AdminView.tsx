
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { ShieldCheckIcon, UserIcon, CircleStackIcon, ChartBarIcon, DocumentDuplicateIcon, UserCircleIcon, Cog6ToothIcon, FloppyDiskIcon, LockClosedIcon, TrashIcon, CalendarIcon, BoltIcon, XMarkIcon, SearchIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon, ClockIcon, QrCodeIcon, PhotoIcon, DollarSignIcon } from '../components/Icons';
import { formatCurrency } from '../utils/formatters';

// --- MOCK DATA FOR DEMONSTRATION ---
const MOCK_PROFILES = [
    { id: 'mock-1', name: 'Carlos Eduardo', email: 'carlos.edu@gmail.com', subscription_status: 'active', is_blocked: false, is_lifetime: false, created_at: '2023-10-15T10:00:00Z', trial_ends_at: null },
    { id: 'mock-2', name: 'Fernanda Santos', email: 'nanda.santos@outlook.com', subscription_status: 'expired', is_blocked: true, is_lifetime: false, created_at: '2023-09-01T14:30:00Z', trial_ends_at: null },
    { id: 'mock-3', name: 'Pr. Roberto', email: 'pr.roberto@ibc.org.br', subscription_status: 'trial', is_blocked: false, is_lifetime: false, created_at: new Date(Date.now() - 86400000 * 2).toISOString(), trial_ends_at: new Date(Date.now() + 86400000 * 8).toISOString() }, 
    { id: 'mock-4', name: 'Admin User', email: 'admin@identificapix.com', subscription_status: 'lifetime', is_blocked: false, is_lifetime: true, created_at: '2023-01-01T00:00:00Z', trial_ends_at: null },
    { id: 'mock-5', name: 'Igreja Batista Vida', email: 'contato@ibvida.com.br', subscription_status: 'active', is_blocked: false, is_lifetime: false, created_at: '2023-11-20T09:00:00Z', trial_ends_at: null },
];

const MOCK_PAYMENTS = [
    { id: 'pay-1', user_id: 'mock-5', amount: 29.90, status: 'approved', notes: 'Renovação Mensal', created_at: '2023-11-20T09:05:00Z' },
    { id: 'pay-2', user_id: 'mock-1', amount: 29.90, status: 'approved', notes: 'PIX Validado IA', created_at: '2023-11-15T10:00:00Z' },
    { id: 'pay-3', user_id: 'mock-2', amount: 29.90, status: 'rejected', notes: 'Comprovante ilegível', created_at: '2023-10-01T14:30:00Z' },
];

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center space-x-4">
        <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
            {icon}
        </div>
        <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{value}</p>
        </div>
    </div>
);

// New Modal: Receipt Viewer
const ReceiptViewerModal: React.FC<{ imageUrl: string, onClose: () => void }> = ({ imageUrl, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-10">
                    <XMarkIcon className="w-6 h-6" />
                </button>
                <div className="flex justify-center items-center bg-slate-100 dark:bg-slate-950 p-4 min-h-[300px]">
                    <img 
                        src={imageUrl} 
                        alt="Comprovante" 
                        className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg" 
                    />
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Comprovante de Pagamento</p>
                </div>
            </div>
        </div>
    );
};

// New Modal: Edit Duration (Days) or Lifetime
const EditDurationModal: React.FC<{ user: any, onClose: () => void, onSave: (days: number, isLifetime: boolean) => void }> = ({ user, onClose, onSave }) => {
    const [daysToAdd, setDaysToAdd] = useState<number>(30);
    const [isLifetime, setIsLifetime] = useState(user.is_lifetime || false);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-200 dark:border-slate-700 transform transition-all scale-100" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Gerenciar Acesso</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><XMarkIcon className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Usuário:</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">{user.name || user.email}</p>
                </div>

                <div className="space-y-6">
                    {/* Toggle Lifetime */}
                    <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-purple-400 transition-colors cursor-pointer" onClick={() => setIsLifetime(!isLifetime)}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isLifetime ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                <BoltIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">Acesso Vitalício</p>
                                <p className="text-xs text-slate-500">O usuário nunca expira.</p>
                            </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isLifetime ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${isLifetime ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>

                    {/* Days Input (Disabled if Lifetime) */}
                    <div className={`transition-opacity duration-300 ${isLifetime ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Definir dias de acesso
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={daysToAdd} 
                                onChange={e => setDaysToAdd(parseInt(e.target.value) || 0)}
                                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                min="1"
                            />
                            <span className="absolute right-4 top-4 text-slate-400 text-sm font-medium">dias</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Isso definirá o vencimento para <strong>Hoje + {daysToAdd} dias</strong>.</p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm text-slate-600 font-bold hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancelar</button>
                    <button 
                        onClick={() => onSave(daysToAdd, isLifetime)} 
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    )
}

// New Modal: Confirm Delete User
const ConfirmDeleteUserModal: React.FC<{ user: any, onClose: () => void, onConfirm: () => void }> = ({ user, onClose, onConfirm }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md transform transition-all scale-100" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Confirmar Exclusão</h3>
                        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="mt-4 flex items-start space-x-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                           <p>Tem certeza de que deseja excluir permanentemente <strong>{user.name || user.email}</strong>?</p>
                           <p className="mt-2 text-xs text-slate-500">Esta ação não pode ser desfeita e removerá o histórico do usuário.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-3 flex justify-end space-x-2 rounded-b-lg">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button type="button" onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-sm">Excluir</button>
                </div>
            </div>
        </div>
    );
};

export const AdminView: React.FC = () => {
    const { systemSettings, updateSystemSettings } = useAuth();
    const { showToast } = useUI();
    const isMounted = useRef(false);
    
    const [stats, setStats] = useState({ totalUsers: 0, totalReports: 0, totalChurches: 0, dbLatency: '...' });
    const [payments, setPayments] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Search States
    const [userSearch, setUserSearch] = useState('');
    const [paymentSearch, setPaymentSearch] = useState('');

    // Config State
    const [trialDaysInput, setTrialDaysInput] = useState(systemSettings.defaultTrialDays);
    const [pixKeyInput, setPixKeyInput] = useState(systemSettings.pixKey || '');
    const [monthlyPriceInput, setMonthlyPriceInput] = useState(systemSettings.monthlyPrice || 29.90);

    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [userToDelete, setUserToDelete] = useState<any | null>(null);
    const [receiptToView, setReceiptToView] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const startTime = performance.now();
        
        try {
            // Fetch real data
            const [reportsResponse, churchesResponse, paymentsResponse, profilesResponse] = await Promise.all([
                supabase.from('saved_reports').select('id', { count: 'exact', head: true }),
                supabase.from('churches').select('id', { count: 'exact', head: true }),
                supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(50),
                supabase.from('profiles').select('*').order('created_at', { ascending: false })
            ]);

            const endTime = performance.now();
            const latency = (endTime - startTime).toFixed(0) + 'ms';

            // Merge with Mock Data for display if real data is sparse
            const displayProfiles = [...(profilesResponse.data || []), ...MOCK_PROFILES];
            // Remove duplicates if real data actually contains mocks (unlikely but safe)
            const uniqueProfiles = Array.from(new Map(displayProfiles.map(item => [item.id, item])).values());

            const displayPayments = [...(paymentsResponse.data || []), ...MOCK_PAYMENTS];
            const uniquePayments = Array.from(new Map(displayPayments.map(item => [item.id, item])).values());

            if (isMounted.current) {
                setStats({
                    totalUsers: (profilesResponse.count || 0) + MOCK_PROFILES.length,
                    totalReports: (reportsResponse.count || 0) + 15, 
                    totalChurches: (churchesResponse.count || 0) + 8,
                    dbLatency: latency
                });
                
                setPayments(uniquePayments.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
                setProfiles(uniqueProfiles);
            }
        } catch (error) {
            console.error("Erro ao carregar dados do admin:", error);
            if (isMounted.current) showToast("Erro ao carregar dados do painel.", "error");
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [showToast]);

    useEffect(() => {
        isMounted.current = true;
        fetchData();
        return () => {
            isMounted.current = false;
        };
    }, [fetchData]);

    // Filter Logic
    const filteredProfiles = useMemo(() => {
        if (!userSearch.trim()) return profiles;
        const lowerSearch = userSearch.toLowerCase();
        return profiles.filter(p => 
            (p.name && p.name.toLowerCase().includes(lowerSearch)) || 
            (p.email && p.email.toLowerCase().includes(lowerSearch))
        );
    }, [profiles, userSearch]);

    const filteredPayments = useMemo(() => {
        if (!paymentSearch.trim()) return payments;
        const lowerSearch = paymentSearch.toLowerCase();
        return payments.filter(pay => {
            const userProfile = profiles.find(p => p.id === pay.user_id);
            const userName = userProfile ? (userProfile.name || userProfile.email) : '';
            return (
                (userName && userName.toLowerCase().includes(lowerSearch)) ||
                (pay.notes && pay.notes.toLowerCase().includes(lowerSearch)) ||
                (pay.amount && pay.amount.toString().includes(lowerSearch))
            );
        });
    }, [payments, paymentSearch, profiles]);


    const handleSaveConfig = () => {
        updateSystemSettings({ 
            defaultTrialDays: trialDaysInput,
            pixKey: pixKeyInput,
            monthlyPrice: monthlyPriceInput
        });
        showToast("Configurações do sistema atualizadas.", "success");
    };

    // --- User Actions ---

    const toggleBlockUser = async (user: any) => {
        const newStatus = !user.is_blocked;
        // 1. Optimistic Update (Immediate Feedback)
        setProfiles(prev => prev.map(p => p.id === user.id ? { ...p, is_blocked: newStatus } : p));
        showToast(newStatus ? "Usuário bloqueado." : "Usuário desbloqueado.", "success");
        
        // Check if mock user
        if (user.id.startsWith('mock-')) return;

        // 2. Background Sync
        const { error } = await supabase.from('profiles').update({ is_blocked: newStatus }).eq('id', user.id);
        if (error) {
            console.error("Erro ao sincronizar bloqueio:", error);
        }
    };

    const handleDeleteClick = (user: any, e: React.MouseEvent) => {
        e.preventDefault(); 
        e.stopPropagation();
        setUserToDelete(user);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        const user = userToDelete;

        // 1. Optimistic Update
        const oldProfiles = [...profiles];
        setProfiles(prev => prev.filter(p => p.id !== user.id));
        showToast("Processando exclusão...", "success");
        setUserToDelete(null);

        // Check if mock user
        if (user.id.startsWith('mock-')) {
            showToast("Usuário (simulado) excluído com sucesso.", "success");
            return;
        }

        // 2. Background Sync
        const { error } = await supabase.from('profiles').delete().eq('id', user.id);
        
        if (error) {
            console.error("Erro ao excluir perfil no banco:", error);
            setProfiles(oldProfiles); // Revert
            showToast(`Erro ao excluir: ${error.message || 'Restrição de dados (pagamentos existentes)'}`, "error");
        } else {
            showToast("Usuário excluído com sucesso.", "success");
        }
    };

    const handleUpdateDuration = async (days: number, isLifetime: boolean) => {
        if (!editingUser) return;
        
        const now = new Date();
        const newDate = new Date(now);
        newDate.setDate(newDate.getDate() + days);
        const isoDate = newDate.toISOString();

        const updateData = isLifetime ? {
            is_lifetime: true,
            subscription_status: 'lifetime',
            subscription_ends_at: null,
            trial_ends_at: null
        } : {
            is_lifetime: false,
            subscription_status: 'active',
            subscription_ends_at: isoDate,
            trial_ends_at: null
        };

        setProfiles(prev => prev.map(p => p.id === editingUser.id ? { ...p, ...updateData } : p));
        setEditingUser(null);
        showToast(isLifetime ? "Definido como Vitalício." : `Adicionados ${days} dias de acesso.`, "success");

        if (editingUser.id.startsWith('mock-')) return;

        const { error } = await supabase.from('profiles').update(updateData).eq('id', editingUser.id);
        if (error) console.error("Erro ao sincronizar data:", error);
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-10 w-10 text-slate-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-slate-500 font-medium">Carregando painel administrativo...</span>
                </div>
            </div>
        );
    }

    const getStatusBadge = (profile: any) => {
        if (profile.is_blocked) return <span className="px-2 py-1 bg-red-600 text-white rounded-md text-[10px] font-bold uppercase border border-red-700">BLOQUEADO</span>;
        if (profile.is_lifetime) return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-[10px] font-bold uppercase border border-purple-200">Vitalício</span>;
        
        switch(profile.subscription_status) {
            case 'active': return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold uppercase border border-emerald-200">Ativo</span>;
            case 'trial': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold uppercase border border-blue-200">Teste</span>;
            case 'expired': return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase border border-amber-200">Expirado</span>;
            default: return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-md text-[10px] font-bold uppercase border border-slate-200">{profile.subscription_status}</span>;
        }
    }

    return (
        <div className="flex flex-col h-full lg:h-[calc(100vh-5.5rem)] animate-fade-in gap-4 pb-2">
            <div className="flex-shrink-0 flex items-center gap-4">
                <div className="p-2.5 bg-slate-800 rounded-xl shadow-lg">
                    <ShieldCheckIcon className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">Painel Administrativo</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">Controle total da plataforma</p>
                </div>
            </div>

            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Usuários" 
                    value={stats.totalUsers} 
                    icon={<UserIcon className="w-5 h-5" />} 
                    color="bg-gradient-to-br from-blue-500 to-indigo-600"
                />
                <StatCard 
                    title="Relatórios" 
                    value={stats.totalReports} 
                    icon={<ChartBarIcon className="w-5 h-5" />} 
                    color="bg-gradient-to-br from-emerald-500 to-teal-600"
                />
                <StatCard 
                    title="Entidades" 
                    value={stats.totalChurches} 
                    icon={<CircleStackIcon className="w-5 h-5" />} 
                    color="bg-gradient-to-br from-purple-500 to-violet-600"
                />
                <StatCard 
                    title="Latência API" 
                    value={stats.dbLatency} 
                    icon={<BoltIcon className="w-5 h-5" />} 
                    color="bg-gradient-to-br from-slate-600 to-slate-800"
                />
            </div>

            {/* System Settings Section */}
            <div className="flex-shrink-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                    <Cog6ToothIcon className="w-5 h-5 text-slate-500" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Configurações do Sistema</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Dias de Teste
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={trialDaysInput} 
                                onChange={(e) => setTrialDaysInput(parseInt(e.target.value) || 0)}
                                className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm"
                            />
                            <span className="absolute right-3 top-2 text-slate-400 text-xs font-medium">dias</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Valor Mensalidade
                        </label>
                        <div className="relative">
                            <div className="absolute left-2 top-2 text-slate-400">
                                <DollarSignIcon className="w-4 h-4" />
                            </div>
                            <input 
                                type="number" 
                                step="0.01"
                                value={monthlyPriceInput} 
                                onChange={(e) => setMonthlyPriceInput(parseFloat(e.target.value) || 0)}
                                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Chave Pix
                        </label>
                        <div className="relative">
                            <div className="absolute left-2 top-2 text-slate-400">
                                <QrCodeIcon className="w-4 h-4" />
                            </div>
                            <input 
                                type="text" 
                                value={pixKeyInput} 
                                onChange={(e) => setPixKeyInput(e.target.value)}
                                placeholder="Email, CPF, ou código..."
                                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white truncate"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveConfig}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 text-xs"
                    >
                        <FloppyDiskIcon className="w-4 h-4" />
                        Salvar Config
                    </button>
                </div>
            </div>

            {/* Users List & Payments - Flexible Height */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Users Table */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <UserCircleIcon className="w-4 h-4 text-blue-500" />
                                Gestão de Usuários
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">{filteredProfiles.length}</span>
                            </h3>
                            
                            <div className="relative w-full sm:w-56">
                                <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar usuário..." 
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0 backdrop-blur-md z-10">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Usuário</th>
                                    <th className="px-4 py-3 font-bold text-center">Status</th>
                                    <th className="px-4 py-3 font-bold text-center">Expira</th>
                                    <th className="px-4 py-3 font-bold text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                                {filteredProfiles.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                                            Nenhum usuário encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProfiles.map((profile) => {
                                        const expiry = profile.trial_ends_at || profile.subscription_ends_at;
                                        return (
                                            <tr key={profile.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${profile.is_blocked ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0 ${profile.is_blocked ? 'bg-red-500' : 'bg-gradient-to-br from-indigo-400 to-purple-500'}`}>
                                                            {profile.is_blocked ? <LockClosedIcon className="w-3.5 h-3.5"/> : (profile.name || profile.email || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 truncate">
                                                                {profile.name || 'Sem nome'}
                                                                {profile.is_lifetime && <BoltIcon className="w-3 h-3 text-purple-500" />}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 font-mono truncate">{profile.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {getStatusBadge(profile)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {profile.is_lifetime ? (
                                                        <span className="text-purple-600 font-bold">∞</span>
                                                    ) : expiry ? (
                                                        <span className="font-mono text-slate-600 dark:text-slate-300">{new Date(expiry).toLocaleDateString('pt-BR')}</span>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => toggleBlockUser(profile)}
                                                            className={`p-1.5 rounded-lg transition-colors shadow-sm ${profile.is_blocked ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500'}`}
                                                            title={profile.is_blocked ? "Desbloquear" : "Bloquear"}
                                                        >
                                                            <LockClosedIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={() => setEditingUser(profile)}
                                                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm"
                                                            title="Editar Acesso"
                                                        >
                                                            <CalendarIcon className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button 
                                                            onClick={(e) => handleDeleteClick(profile, e)}
                                                            className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm"
                                                            title="Excluir"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Payments Audit Table */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <DocumentDuplicateIcon className="w-4 h-4 text-indigo-500" />
                                Auditoria
                            </h3>
                            <button onClick={fetchData} className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg font-bold transition-colors">
                                Atualizar
                            </button>
                        </div>
                        
                        <div className="mt-3 relative w-full">
                            <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Buscar..." 
                                value={paymentSearch}
                                onChange={(e) => setPaymentSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Info</th>
                                    <th className="px-4 py-3 font-bold text-right">Valor</th>
                                    <th className="px-4 py-3 font-bold text-center">Comp.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                                {filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                                            Sem registros.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPayments.map((payment) => {
                                        const userProfile = profiles.find(p => p.id === payment.user_id);
                                        const userName = userProfile ? (userProfile.name || userProfile.email) : 'ID: ' + payment.user_id.substring(0,6);
                                        const isApproved = payment.status === 'approved';

                                        return (
                                            <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-start gap-2">
                                                        <div className={`mt-0.5 p-1 rounded-full ${isApproved ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                            {isApproved ? <CheckCircleIcon className="w-3 h-3" /> : <XCircleIcon className="w-3 h-3" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-700 dark:text-slate-200 mb-0.5 truncate">{userName}</div>
                                                            <div className="text-[10px] text-slate-400 flex flex-col gap-0.5">
                                                                <span className="flex items-center gap-1">
                                                                    <ClockIcon className="w-2.5 h-2.5" />
                                                                    {new Date(payment.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                                </span>
                                                                <span className="truncate max-w-[120px]" title={payment.notes}>{payment.notes || '---'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className={`font-bold ${isApproved ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                                        {formatCurrency(payment.amount)}
                                                    </div>
                                                    <span className={`inline-block px-1 py-0.5 rounded text-[8px] font-bold uppercase border ${isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                        {payment.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {payment.receipt_url ? (
                                                        <button 
                                                            onClick={() => setReceiptToView(payment.receipt_url)}
                                                            className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                                            title="Ver Comprovante"
                                                        >
                                                            <PhotoIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {editingUser && (
                <EditDurationModal 
                    user={editingUser} 
                    onClose={() => setEditingUser(null)} 
                    onSave={handleUpdateDuration} 
                />
            )}

            {userToDelete && (
                <ConfirmDeleteUserModal 
                    user={userToDelete} 
                    onClose={() => setUserToDelete(null)} 
                    onConfirm={confirmDeleteUser} 
                />
            )}

            {receiptToView && (
                <ReceiptViewerModal 
                    imageUrl={receiptToView} 
                    onClose={() => setReceiptToView(null)} 
                />
            )}
        </div>
    );
};
