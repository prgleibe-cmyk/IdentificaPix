import React from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, FloppyDiskIcon, SparklesIcon, CheckBadgeIcon, TrashIcon } from '../Icons';

interface EditUserModalProps {
    user: any;
    formData: any;
    setFormData: (data: any) => void;
    isSaving: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    potentialOwners: any[];
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, formData, setFormData, isSaving, onClose, onSubmit, potentialOwners }) => {
    const { t } = useTranslation();
    const inputClass = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-all placeholder:text-slate-400";
    const labelClass = "block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5";

    return (
        <div
            className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
        >
            <form
                onSubmit={onSubmit}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-elevated w-full max-w-3xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center text-sm font-bold text-orange-600 dark:text-orange-400 shrink-0">
                            {user.email?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                                {user.name || t('admin.users.noName')}
                            </h3>
                            <div className="flex items-center gap-2">
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {user.email}
                                </p>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></span>
                                <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 tabular-nums shrink-0">
                                    ID: {user.id.substring(0, 8)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Body */}
                <div
                    className="p-6 flex-1 overflow-y-auto custom-scrollbar w-full min-h-0"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                    <div className="space-y-5 w-full max-w-4xl">
                        <div className="bg-slate-50/70 dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <CheckBadgeIcon className="w-4 h-4" /> Tipo de Usuário & Hierarquia
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Papel (Role)</label>
                                    <select 
                                        value={formData.role} 
                                        onChange={(e) => setFormData({...formData, role: e.target.value})} 
                                        className={inputClass}
                                    >
                                        <option value="owner">Titular (Owner)</option>
                                        <option value="member">Membro (Member)</option>
                                        <option value="admin">Administrador Global</option>
                                    </select>
                                </div>
                                {formData.role === 'member' && (
                                    <div>
                                        <label className={labelClass}>Vincular ao Titular (Owner)</label>
                                        <select 
                                            value={formData.owner_id} 
                                            onChange={(e) => setFormData({...formData, owner_id: e.target.value})} 
                                            className={inputClass}
                                            required
                                        >
                                            <option value="">Selecione um titular...</option>
                                            {potentialOwners.filter(o => o.id !== user.id).map(owner => (
                                                <option key={owner.id} value={owner.id}>
                                                    {owner.name || owner.email} ({owner.email})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-50/70 dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <CheckBadgeIcon className="w-4 h-4" /> Plano & Vigência
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Status Atual</label>
                                    <select value={formData.subscription_status} onChange={(e) => setFormData({...formData, subscription_status: e.target.value})} className={inputClass}>
                                        <option value="trial">Trial (Teste)</option>
                                        <option value="active">Active (Pago)</option>
                                        <option value="expired">Expired (Vencido)</option>
                                        <option value="lifetime">Lifetime (Vitalício)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Fim do Teste</label>
                                    <input type="date" value={formData.trial_ends_at} onChange={(e) => setFormData({...formData, trial_ends_at: e.target.value})} className={`${inputClass} tabular-nums`} />
                                </div>
                                <div>
                                    <label className={labelClass}>Vencimento Plano</label>
                                    <input type="date" value={formData.subscription_ends_at} onChange={(e) => setFormData({...formData, subscription_ends_at: e.target.value})} className={`${inputClass} tabular-nums`} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50/70 dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4" /> Recursos & Limites
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2 bg-white dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2.5">Inteligência Artificial</p>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className={labelClass}>Limite Total</label>
                                            <input type="number" value={formData.limit_ai} onChange={(e) => setFormData({...formData, limit_ai: parseInt(e.target.value)})} className={`${inputClass} tabular-nums`} />
                                        </div>
                                        <div className="flex-1">
                                            <label className={labelClass}>Consumido</label>
                                            <input type="number" value={formData.usage_ai} onChange={(e) => setFormData({...formData, usage_ai: parseInt(e.target.value)})} className={`${inputClass} tabular-nums`} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Cadastros (Igrejas/Bancos)</label>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => setFormData({...formData, max_churches: Math.max(1, formData.max_churches - 1)})} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-xs cursor-pointer">-</button>
                                        <input type="number" value={formData.max_churches} onChange={(e) => setFormData({...formData, max_churches: parseInt(e.target.value)})} className={`${inputClass} text-center tabular-nums`} />
                                        <button type="button" onClick={() => setFormData({...formData, max_churches: formData.max_churches + 1})} className="w-9 h-9 flex items-center justify-center rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700 transition-colors shadow-xs text-xs cursor-pointer">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Preço Personalizado</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">R$</span>
                                        <input type="number" step="0.01" placeholder="Padrão" value={formData.custom_price} onChange={(e) => setFormData({...formData, custom_price: e.target.value})} className={`${inputClass} pl-8 tabular-nums`} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-200/80 dark:border-slate-800 pt-4">
                            <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/30 p-4 rounded-xl border border-rose-200/70 dark:border-rose-900/40">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">
                                        <TrashIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Bloqueio de Acesso</p>
                                        <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">Impedir login imediatamente.</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={formData.is_blocked} onChange={(e) => setFormData({...formData, is_blocked: e.target.checked})} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-900 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-rose-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-4 flex justify-end space-x-3 border-t border-slate-200/80 dark:border-slate-800 mt-auto shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                        {t('common.cancel')}
                    </button>
                    <button type="submit" disabled={isSaving} className="px-5 py-2 rounded-lg shadow-xs text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
                        {isSaving ? 'Salvando...' : <><FloppyDiskIcon className="w-4 h-4" />{t('common.save')}</>}
                    </button>
                </div>
            </form>
        </div>
    );
};