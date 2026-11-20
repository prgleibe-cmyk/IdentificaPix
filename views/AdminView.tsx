
import React, { useState } from 'react';
import { useTranslation } from '../contexts/I18nContext';
import { 
    ShieldCheckIcon,
    Cog6ToothIcon,
    UserIcon,
    BanknotesIcon
} from '../components/Icons';
import { AdminSettingsTab } from '../components/admin/AdminSettingsTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminAuditTab } from '../components/admin/AdminAuditTab';
import { AdminCommunicationTab } from '../components/admin/AdminCommunicationTab';
import { AdminSecurityTab } from '../components/admin/AdminSecurityTab';
import { MessageSquare } from 'lucide-react';

type AdminTab = 'settings' | 'users' | 'security' | 'communication' | 'audit';

export const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('settings');
    const { t } = useTranslation();

    const AdminTabButton = ({ id, label, icon: Icon, colorTheme }: any) => {
        const isActive = activeTab === id;
        const iconClass = isActive ? "text-white" : "text-slate-500 dark:text-slate-400";
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    isActive
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
                <Icon className={`w-4 h-4 ${iconClass}`} />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full flex flex-col h-full animate-fade-in pb-8">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 flex-shrink-0 px-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                        <ShieldCheckIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">{t('admin.title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Gestão do Sistema e Painel Administrativo</p>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-x-auto custom-scrollbar">
                        <AdminTabButton id="settings" label={t('admin.tab.settings')} icon={Cog6ToothIcon} colorTheme="slate" />
                        <AdminTabButton id="users" label={t('admin.tab.users')} icon={UserIcon} colorTheme="amber" />
                        <AdminTabButton id="security" label="Painel de Segurança" icon={ShieldCheckIcon} colorTheme="violet" />
                        <AdminTabButton id="communication" label="Central de Comunicação" icon={MessageSquare} colorTheme="blue" />
                        <AdminTabButton id="audit" label={t('admin.tab.audit')} icon={BanknotesIcon} colorTheme="emerald" />
                    </div>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                {activeTab === 'settings' && <AdminSettingsTab />}
                {activeTab === 'users' && <AdminUsersTab />}
                {activeTab === 'security' && <AdminSecurityTab />}
                {activeTab === 'communication' && <AdminCommunicationTab />}
                {activeTab === 'audit' && <AdminAuditTab />}
            </div>
        </div>
    );
};
