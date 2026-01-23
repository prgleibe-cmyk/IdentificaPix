import React from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { PencilIcon, ClockIcon } from '../Icons';
import { AdminStatusBadge } from './AdminStatusBadge';

interface UserTableProps {
    users: any[];
    isLoading: boolean;
    onEdit: (user: any) => void;
}

const StatBar = ({ current, max, colorClass }: any) => {
    const pct = Math.min(100, (current / (max || 1)) * 100);
    return (
        <div className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }}></div>
        </div>
    );
}

export const UserTable: React.FC<UserTableProps> = ({ users, isLoading, onEdit }) => {
    const { t, language } = useTranslation();

    return (
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
                    {isLoading ? (
                        <tr><td colSpan={6} className="text-center py-8"><div className="animate-spin h-5 w-5 border-2 border-brand-blue border-t-transparent rounded-full mx-auto"></div></td></tr>
                    ) : users.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t('admin.users.noResults')}</td></tr>
                    ) : (
                        users.map(u => (
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
                                <td className="px-3 py-2"><AdminStatusBadge status={u.subscription_status} /></td>
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
                                    <button onClick={() => onEdit(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Editar Usuário">
                                        <PencilIcon className="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};