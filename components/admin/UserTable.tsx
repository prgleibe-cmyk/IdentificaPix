import React from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { PencilIcon, ClockIcon, TrashIcon } from '../Icons';
import { AdminStatusBadge } from './AdminStatusBadge';

interface UserTableProps {
    users: any[];
    isLoading: boolean;
    onEdit: (user: any) => void;
    onDelete: (user: any) => void;
    isDeleting: string | null;
}

const formatSafeDate = (dateVal: any, lang: string) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return '-';
    return d.toLocaleDateString(lang);
};

const StatBar = ({ current, max, colorClass }: any) => {
    const pct = Math.min(100, (current / (max || 1)) * 100);
    return (
        <div className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }}></div>
        </div>
    );
}

export const UserTable: React.FC<UserTableProps> = ({ users, isLoading, onEdit, onDelete, isDeleting }) => {
    const { t, language } = useTranslation();

    return (
        <div
            className="flex-1 overflow-auto custom-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
        >
            <table className="w-full text-xs text-left">
                <thead className="text-[11px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50/90 dark:bg-slate-950/60 sticky top-0 backdrop-blur-xs z-10 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                        <th className="px-3 py-2.5">{t('admin.users.table.user')}</th>
                        <th className="px-3 py-2.5">Tipo</th>
                        <th className="px-3 py-2.5">{t('admin.users.table.status')}</th>
                        <th className="px-3 py-2.5">{t('admin.users.table.aiUsage')}</th>
                        <th className="px-3 py-2.5">{t('admin.users.table.slots')}</th>
                        <th className="px-3 py-2.5">{t('admin.users.table.validity')}</th>
                        <th className="px-3 py-2.5 text-center">{t('admin.users.table.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {isLoading ? (
                        <tr><td colSpan={7} className="text-center py-8"><div className="animate-spin h-5 w-5 border-2 border-orange-600 border-t-transparent rounded-full mx-auto"></div></td></tr>
                    ) : users.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-8 text-slate-400">{t('admin.users.noResults')}</td></tr>
                    ) : (
                        users.map(u => {
                            const formattedValidity = u.subscription_status === 'active' 
                                ? formatSafeDate(u.subscription_ends_at, language)
                                : u.subscription_status === 'trial'
                                    ? formatSafeDate(u.trial_ends_at, language)
                                    : formatSafeDate(u.subscription_ends_at || u.trial_ends_at, language);

                            return (
                                <tr key={u.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group ${u.is_blocked ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}`}>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${u.is_blocked ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                                {u.email?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate text-xs">
                                                    {u.name || t('admin.users.noName')}
                                                    {u.is_blocked && <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>}
                                                </p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${u.owner_id && u.owner_id !== u.id ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40' : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-orange-900/40'}`}>
                                            {u.owner_id && u.owner_id !== u.id ? 'Secundário' : 'Principal'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5"><AdminStatusBadge status={u.subscription_status} /></td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{u.usage_ai} / {u.limit_ai}</span>
                                            <StatBar current={u.usage_ai} max={u.limit_ai} colorClass="bg-orange-600" />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{u.max_churches} {t('admin.users.slotsSuffix')}</span>
                                            <StatBar current={1} max={u.max_churches} colorClass="bg-slate-600 dark:bg-slate-400" />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                            <ClockIcon className="w-3.5 h-3.5" />
                                            {formattedValidity}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => onEdit(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors cursor-pointer" title="Editar Usuário">
                                                <PencilIcon className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => onDelete(u)} 
                                                disabled={isDeleting === u.id}
                                                className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer ${isDeleting === u.id ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                                title="Excluir Usuário"
                                            >
                                                {isDeleting === u.id ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};