
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { supabase } from '../services/supabaseClient';
import { 
    ShieldCheckIcon,
    Cog6ToothIcon,
    UserIcon,
    BanknotesIcon,
    XMarkIcon,
    CircleStackIcon,
    BoltIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowsRightLeftIcon
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
    const [showDiagModal, setShowDiagModal] = useState(false);
    const [diagResult, setDiagResult] = useState<any>(null);
    const [isLoadingDiag, setIsLoadingDiag] = useState(false);

    const handleSync = () => {
        showToast("Dados sincronizados com sucesso.", "success");
    };

    const runDiagnostics = async () => {
        setIsLoadingDiag(true);
        setShowDiagModal(true);
        
        const results: any = {
            apiStatus: 'ONLINE',
            geminiKey: !!process.env.API_KEY,
            supabaseStatus: 'CHECKING',
            authStatus: !!user
        };

        try {
            // Teste real de conexão com o Supabase
            const { error } = await supabase.from('profiles').select('count').limit(1);
            results.supabaseStatus = error ? 'ERROR' : 'CONNECTED';
            if (error) results.supabaseError = error.message;
        } catch (e) {
            results.supabaseStatus = 'FAILED';
        }

        setTimeout(() => {
            setDiagResult(results);
            setIsLoadingDiag(false);
        }, 800);
    };

    const TabButton = ({ id, label, icon: Icon, colorTheme }: { id: AdminTab, label: string, icon: any, colorTheme: 'blue' | 'indigo' | 'emerald' }) => {
        const isActive = activeTab === id;
        const themes = {
            blue: { active: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300', inactive: 'text-slate-500' },
            indigo: { active: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300', inactive: 'text-slate-500' },
            emerald: { active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300', inactive: 'text-slate-500' }
        };
        const style = themes[colorTheme];

        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap transition-all ${isActive ? style.active : `bg-white dark:bg-slate-800 ${style.inactive}`}`}
            >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 flex-shrink-0 px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <ShieldCheckIcon className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('admin.title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">Diagnóstico e Gestão do Sistema</p>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                        <TabButton id="settings" label={t('admin.tab.settings')} icon={Cog6ToothIcon} colorTheme="blue" />
                        <TabButton id="users" label={t('admin.tab.users')} icon={UserIcon} colorTheme="indigo" />
                        <TabButton id="audit" label={t('admin.tab.audit')} icon={BanknotesIcon} colorTheme="emerald" />
                    </div>
                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 hidden md:block mx-1"></div>
                    <div className="flex items-center gap-2">
                        <button onClick={runDiagnostics} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all uppercase">
                            <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
                            <span>Diagnóstico</span>
                        </button>
                        <button onClick={() => setShowSqlModal(true)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 transition-all uppercase">
                            <CircleStackIcon className="w-3.5 h-3.5" />
                            <span>SQL Utils</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                {activeTab === 'settings' && <AdminSettingsTab />}
                {activeTab === 'users' && <AdminUsersTab />}
                {activeTab === 'audit' && <AdminAuditTab />}
            </div>

            {/* Diagnostic Modal */}
            {showDiagModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-[#020610]/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <BoltIcon className="w-5 h-5 text-amber-500" />
                                Saúde do Ambiente
                            </h3>
                            <button onClick={() => setShowDiagModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {isLoadingDiag ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin h-8 w-8 border-4 border-brand-blue border-t-transparent rounded-full mx-auto mb-3"></div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Varrendo variáveis de ambiente...</p>
                                </div>
                            ) : diagResult ? (
                                <div className="space-y-3">
                                    <div className={`p-4 rounded-xl border flex items-center justify-between ${diagResult.geminiKey ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                        <span className="text-xs font-bold text-slate-700">Chave Gemini (process.env)</span>
                                        {diagResult.geminiKey ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <XCircleIcon className="w-5 h-5 text-red-500" />}
                                    </div>
                                    <div className={`p-4 rounded-xl border flex items-center justify-between ${diagResult.supabaseStatus === 'CONNECTED' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700">Conexão Supabase</span>
                                            {diagResult.supabaseError && <span className="text-[10px] text-red-500 mt-1">{diagResult.supabaseError}</span>}
                                        </div>
                                        {diagResult.supabaseStatus === 'CONNECTED' ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <XCircleIcon className="w-5 h-5 text-red-500" />}
                                    </div>
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Modo de Operação</span>
                                        <span className="text-[10px] font-black text-blue-600 bg-white px-2 py-0.5 rounded-full border border-blue-100">CLIENT-ONLY AI</span>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                            <button onClick={() => setShowDiagModal(false)} className="px-5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors uppercase">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
