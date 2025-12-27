
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useUI } from '../../contexts/UIContext';
import { useTranslation } from '../../contexts/I18nContext';
import { MagnifyingGlassIcon, XMarkIcon, FloppyDiskIcon, PencilIcon, SparklesIcon, ClockIcon, TrashIcon, CheckBadgeIcon } from '../Icons';
import { AdminStatusBadge } from './AdminStatusBadge';

export const AdminUsersTab: React.FC = () => {
    const { showToast } = useUI();
    const { t, language } = useTranslation();
    const [usersList, setUsersList] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Edit State
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [formData, setFormData] = useState({
        subscription_status: 'trial',
        limit_ai: 100,
        usage_ai: 0,
        max_churches: 2,
        custom_price: '',
        is_blocked: false,
        trial_ends_at: '',
        subscription_ends_at: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setUsersList(data || []);
        } catch (error: any) {
            console.error("Erro ao buscar usuários:", error);
            showToast("Erro ao carregar usuários: " + error.message, "error");
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleEditClick = (user: any) => {
        setEditingUser(user);
        // Format dates for input type="date" (YYYY-MM-DD)
        const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';

        setFormData({
            subscription_status: user.subscription_status || 'trial',
            limit_ai: user.limit_ai || 100,
            usage_ai: user.usage_ai || 0,
            max_churches: user.max_churches || 1, // Default fallback
            custom_price: user.custom_price || '',
            is_blocked: user.is_blocked || false,
            trial_ends_at: formatDate(user.trial_ends_at),
            subscription_ends_at: formatDate(user.subscription_ends_at)
        });
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setIsSaving(true);

        try {
            const updates: any = {
                subscription_status: formData.subscription_status,
                limit_ai: parseInt(String(formData.limit_ai)),
                usage_ai: parseInt(String(formData.usage_ai)),
                max_churches: parseInt(String(formData.max_churches)),
                max_banks: parseInt(String(formData.max_churches)), // Keep synced
                custom_price: formData.custom_price ? parseFloat(String(formData.custom_price)) : null,
                is_blocked: formData.is_blocked,
                is_lifetime: formData.subscription_status === 'lifetime'
            };

            // Handle Dates - append time to ensure full day coverage if needed
            if (formData.trial_ends_at) updates.trial_ends_at = new Date(formData.trial_ends_at).toISOString();
            if (formData.subscription_ends_at) updates.subscription_ends_at = new Date(formData.subscription_ends_at).toISOString();

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', editingUser.id);

            if (error) throw error;

            showToast("Usuário atualizado com sucesso!", "success");
            setEditingUser(null);
            fetchUsers(); 
        } catch (error: any) {
            console.error("Erro ao atualizar:", error);
            showToast("Erro ao salvar: " + error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredUsers = usersList.filter(u => 
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const StatBar = ({ current, max, colorClass }: any) => {
        const pct = Math.min(100, (current / (max || 1)) * 100);
        return (
            <div className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }}></div>
            </div>
        );
    }

    const inputClass = "w-full bg-slate-100/50 dark:bg-black/20 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all placeholder:text-slate-400";
    const labelClass = "block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in relative h-full flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('admin.users.title')} ({filteredUsers.length})</h3>
                <div className="relative">
                    <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder={t('admin.users.searchPlaceholder')} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-blue outline-none w-full md:w-64 font-medium"
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-xs text-left">
                    <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 backdrop-blur-sm z-10 font-bold">
                        <tr>
                            <th className="px-3 py-2">{t('admin.users.table.user')}</th>
                            <th className="px-3 py-2">{t('admin.users.table.status')}</th>
                            <th className="px-3 py-2">{t('admin.users.table.aiUsage')}</th>
                            <th className="px-3 py-2">{t('admin.users.table.slots')}</th>
                            <th className="px-3 py-2">{t('admin.users.table.validity')}</th>
                            <th className="px-3 py-2 text-center">{t('admin.users.table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {isLoadingData ? (
                            <tr><td colSpan={6} className="text-center py-8"><div className="animate-spin h-5 w-5 border-2 border-brand-blue border-t-transparent rounded-full mx-auto"></div></td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t('admin.users.noResults')}</td></tr>
                        ) : (
                            filteredUsers.map(u => (
                                <tr key={u.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group ${u.is_blocked ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${u.is_blocked ? 'bg-red-100 text-red-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                                {u.email?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 truncate text-xs">
                                                    {u.name || t('admin.users.noName')}
                                                    {u.is_blocked && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>}
                                                </p>
                                                <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <AdminStatusBadge status={u.subscription_status} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{u.usage_ai} / {u.limit_ai}</span>
                                            <StatBar current={u.usage_ai} max={u.limit_ai} colorClass="bg-blue-500" />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{u.max_churches} {t('admin.users.slotsSuffix')}</span>
                                            <StatBar current={1} max={u.max_churches} colorClass="bg-purple-500" />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                                            <ClockIcon className="w-3 h-3" />
                                            {u.subscription_status === 'active' 
                                                ? new Date(u.subscription_ends_at).toLocaleDateString(language)
                                                : u.subscription_status === 'trial'
                                                    ? `${new Date(u.trial_ends_at).toLocaleDateString(language)}`
                                                    : '-'
                                            }
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button 
                                            onClick={() => handleEditClick(u)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                            title="Editar Usuário"
                                        >
                                            <PencilIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Edição Avançado */}
            {editingUser && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#020610]/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-modal w-full max-w-2xl flex flex-col max-h-[80vh] animate-scale-in rounded-[2rem] bg-white/95 dark:bg-[#0F172A]/95 shadow-2xl border border-white/20 dark:border-white/10 backdrop-blur-2xl">
                        <form onSubmit={handleSaveUser} className="flex flex-col h-full overflow-hidden">
                            {/* Header - Fixed */}
                            <div className="px-6 py-4 border-b border-slate-100/50 dark:border-white/5 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-blue-500/30">
                                        {editingUser.email?.[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-white leading-none">{editingUser.name || t('admin.users.noName')}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{editingUser.email}</p>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                            <span className="text-[9px] uppercase font-bold text-brand-blue dark:text-blue-400 tracking-wide">{editingUser.id.substring(0, 8)}</span>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setEditingUser(null)}
                                    className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                            
                            {/* Scrollable Content - Flex 1 */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/30 dark:bg-[#0B1120]/30 space-y-6 min-h-0">
                                
                                {/* Section 1: Assinatura */}
                                <div className="bg-white/60 dark:bg-white/5 p-5 rounded-3xl border border-slate-100/50 dark:border-white/5">
                                    <h4 className="text-[10px] font-black text-brand-blue dark:text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <CheckBadgeIcon className="w-3.5 h-3.5" /> Plano & Vigência
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className={labelClass}>Status Atual</label>
                                            <select 
                                                value={formData.subscription_status}
                                                onChange={(e) => setFormData({...formData, subscription_status: e.target.value})}
                                                className={inputClass}
                                            >
                                                <option value="trial">Trial (Teste)</option>
                                                <option value="active">Active (Pago)</option>
                                                <option value="expired">Expired (Vencido)</option>
                                                <option value="lifetime">Lifetime (Vitalício)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className={labelClass}>Fim do Teste</label>
                                            <input 
                                                type="date"
                                                value={formData.trial_ends_at}
                                                onChange={(e) => setFormData({...formData, trial_ends_at: e.target.value})}
                                                className={inputClass}
                                            />
                                        </div>

                                        <div>
                                            <label className={labelClass}>Vencimento Plano</label>
                                            <input 
                                                type="date"
                                                value={formData.subscription_ends_at}
                                                onChange={(e) => setFormData({...formData, subscription_ends_at: e.target.value})}
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Limites */}
                                <div className="bg-white/60 dark:bg-white/5 p-5 rounded-3xl border border-slate-100/50 dark:border-white/5">
                                    <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <SparklesIcon className="w-3.5 h-3.5" /> Recursos & Limites
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* AI Limits */}
                                        <div className="md:col-span-2 bg-slate-50 dark:bg-black/20 p-3 rounded-2xl border border-slate-200/50 dark:border-white/5">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Inteligência Artificial</p>
                                            <div className="flex gap-3">
                                                <div className="flex-1">
                                                    <label className={labelClass}>Limite Total</label>
                                                    <input 
                                                        type="number"
                                                        value={formData.limit_ai}
                                                        onChange={(e) => setFormData({...formData, limit_ai: parseInt(e.target.value)})}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className={labelClass}>Consumido</label>
                                                    <input 
                                                        type="number"
                                                        value={formData.usage_ai}
                                                        onChange={(e) => setFormData({...formData, usage_ai: parseInt(e.target.value)})}
                                                        className={inputClass}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Slots & Price */}
                                        <div>
                                            <label className={labelClass}>Cadastros (Igrejas/Bancos)</label>
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={() => setFormData(prev => ({...prev, max_churches: Math.max(1, prev.max_churches - 1)}))} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-xs">-</button>
                                                <input 
                                                    type="number"
                                                    value={formData.max_churches}
                                                    onChange={(e) => setFormData({...formData, max_churches: parseInt(e.target.value)})}
                                                    className={`${inputClass} text-center`}
                                                />
                                                <button type="button" onClick={() => setFormData(prev => ({...prev, max_churches: prev.max_churches + 1}))} className="w-9 h-9 flex items-center justify-center rounded-lg bg-brand-blue text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 text-xs">+</button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelClass}>Preço Personalizado</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Padrão"
                                                    value={formData.custom_price}
                                                    onChange={(e) => setFormData({...formData, custom_price: e.target.value})}
                                                    className={`${inputClass} pl-8`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Danger Zone */}
                                <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                                    <div className="flex items-center justify-between bg-red-50 dark:bg-red-500/10 p-4 rounded-2xl border border-red-100 dark:border-red-500/20">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white dark:bg-red-500/20 rounded-xl text-red-600 dark:text-red-400 shadow-sm">
                                                <TrashIcon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-red-700 dark:text-red-400">Bloqueio de Acesso</p>
                                                <p className="text-[10px] text-red-600/70 dark:text-red-400/70">Impedir login imediatamente.</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={formData.is_blocked} onChange={(e) => setFormData({...formData, is_blocked: e.target.checked})} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300 dark:peer-focus:ring-red-900 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Footer - Seamless Glass Style */}
                            <div className="p-4 border-t border-slate-100/50 dark:border-white/5 flex justify-end gap-2 shrink-0 z-20">
                                <button 
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="px-5 py-2.5 text-[10px] font-bold rounded-full border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors uppercase tracking-wide"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex items-center gap-1.5 px-6 py-2.5 text-[10px] font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 rounded-full shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-70 uppercase tracking-wide"
                                >
                                    {isSaving ? 'Salvando...' : (
                                        <>
                                            <FloppyDiskIcon className="w-3.5 h-3.5" />
                                            {t('common.save')}
                                        </>
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
