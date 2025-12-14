
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { 
    ShieldCheckIcon,
    Cog6ToothIcon,
    UserIcon,
    BanknotesIcon,
    ExclamationTriangleIcon,
    ArrowsRightLeftIcon,
    XMarkIcon
} from '../components/Icons';
import { AdminSettingsTab } from '../components/admin/AdminSettingsTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminAuditTab } from '../components/admin/AdminAuditTab';

type AdminTab = 'settings' | 'users' | 'audit';

export const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('settings');
    const { user } = useAuth();
    const { showToast } = useUI();
    const { t } = useTranslation();
    const [showSqlModal, setShowSqlModal] = useState(false);

    const handleSync = () => {
        showToast("Dados sincronizados com sucesso.", "success");
    };

    const TabButton = ({ id, label, icon: Icon, colorTheme }: { id: AdminTab, label: string, icon: any, colorTheme: 'blue' | 'indigo' | 'emerald' }) => {
        const isActive = activeTab === id;
        
        const themes = {
            blue: {
                active: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
                inactive: 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-300 dark:hover:bg-blue-500/10'
            },
            indigo: {
                active: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30',
                inactive: 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-500/10'
            },
            emerald: {
                active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
                inactive: 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10'
            }
        };

        const style = themes[colorTheme];

        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`
                    flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border whitespace-nowrap
                    ${isActive 
                        ? `${style.active} shadow-sm` 
                        : `bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 ${style.inactive}`
                    }
                `}
            >
                <Icon className={`w-3.5 h-3.5 ${isActive ? '' : 'opacity-70'}`} />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
            {/* Header & Controls */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 flex-shrink-0 px-1">
                
                {/* Title */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <ShieldCheckIcon className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('admin.title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">{t('admin.subtitle')}</p>
                    </div>
                </div>
                
                {/* Tabs & Global Actions */}
                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
                        <TabButton id="settings" label={t('admin.tab.settings')} icon={Cog6ToothIcon} colorTheme="blue" />
                        <TabButton id="users" label={t('admin.tab.users')} icon={UserIcon} colorTheme="indigo" />
                        <TabButton id="audit" label={t('admin.tab.audit')} icon={BanknotesIcon} colorTheme="emerald" />
                    </div>

                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 hidden md:block mx-1"></div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowSqlModal(true)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-md shadow-amber-500/20 hover:-translate-y-0.5 transition-all uppercase tracking-wide whitespace-nowrap"
                        >
                            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                            <span>{t('admin.actions.viewSql')}</span>
                        </button>
                        <button 
                            onClick={handleSync}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] shadow-md shadow-blue-500/20 hover:-translate-y-0.5 transition-all uppercase tracking-wide whitespace-nowrap"
                        >
                            <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                            <span>{t('admin.actions.sync')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                {activeTab === 'settings' && <AdminSettingsTab />}
                {activeTab === 'users' && <AdminUsersTab />}
                {activeTab === 'audit' && <AdminAuditTab />}
            </div>

            {/* SQL Modal */}
            {showSqlModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-[#020610]/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0F172A] rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-700 overflow-hidden animate-scale-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                                {t('admin.debug.title')}
                            </h3>
                            <button onClick={() => setShowSqlModal(false)} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-xs text-slate-400 mb-4">{t('admin.debug.desc')}</p>
                            <div className="bg-black/50 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto select-all">
{`-- Verificar Usuário Atual
SELECT * FROM auth.users WHERE id = '${user?.id}';

-- Verificar Perfil
SELECT * FROM profiles WHERE id = '${user?.id}';

-- Listar últimos 5 pagamentos
SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;`}
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex justify-end">
                            <button onClick={() => setShowSqlModal(false)} className="px-5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors uppercase">
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
