
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
        let activeClass = "";
        let iconClass = "";
        switch (colorTheme) {
            case 'blue': activeClass = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"; iconClass = isActive ? "text-white" : "text-blue-500"; break;
            case 'emerald': activeClass = "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md"; iconClass = isActive ? "text-white" : "text-emerald-500"; break;
            case 'violet': activeClass = "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md"; iconClass = isActive ? "text-white" : "text-violet-500"; break;
            case 'indigo': activeClass = "bg-gradient-to-r from-indigo-500 to-cyan-600 text-white shadow-md"; iconClass = isActive ? "text-white" : "text-indigo-500"; break;
            case 'amber': activeClass = "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md"; iconClass = isActive ? "text-white" : "text-amber-500"; break;
            default: activeClass = "bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-md"; iconClass = isActive ? "text-white" : "text-slate-500"; break;
        }
        return (
            <button onClick={() => setActiveTab(id)} className={`relative flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all duration-300 text-[10px] font-bold uppercase tracking-wide ${isActive ? `${activeClass} transform scale-105 z-10 border-transparent` : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"}`}>
                <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full flex flex-col h-full animate-fade-in pb-8">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 flex-shrink-0 px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><ShieldCheckIcon className="w-5 h-5 text-slate-700 dark:text-slate-200" /></div>
                    <div>
                        <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('admin.title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">Gestão do Sistema e Painel Administrativo</p>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar">
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
