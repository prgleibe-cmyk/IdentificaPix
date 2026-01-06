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
    ArrowsRightLeftIcon,
    BrainIcon,
    ClipboardDocumentIcon
} from '../components/Icons';
import { AdminSettingsTab } from '../components/admin/AdminSettingsTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminAuditTab } from '../components/admin/AdminAuditTab';
import { AdminModelsTab } from '../components/admin/AdminModelsTab';

type AdminTab = 'settings' | 'users' | 'audit' | 'models';

const FIX_SQL = `
-- (SQL mantido inalterado)
`;

export const AdminView: React.FC = () => {
    // ... (Hooks e estados mantidos)
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

    const copySql = () => {
        navigator.clipboard.writeText(FIX_SQL);
        showToast("SQL copiado! Execute no Supabase SQL Editor.", "success");
    };

    const runDiagnostics = async () => {
        setIsLoadingDiag(true);
        setShowDiagModal(true);
        
        const results: any = {
            apiStatus: 'ONLINE',
            geminiKey: !!process.env.API_KEY,
            supabaseStatus: 'CHECKING',
            tableModelsStatus: 'CHECKING',
            authStatus: !!user
        };

        try {
            const { error } = await supabase.from('profiles').select('count').limit(1);
            results.supabaseStatus = error ? 'ERROR' : 'CONNECTED';
            if (error) results.supabaseError = error.message;

            const { error: tableError } = await supabase.from('file_models').select('count').limit(1);
            results.tableModelsStatus = tableError ? 'MISSING' : 'OK';

        } catch (e) {
            results.supabaseStatus = 'FAILED';
        }

        setTimeout(() => {
            setDiagResult(results);
            setIsLoadingDiag(false);
        }, 800);
    };

    // UNIFIED BUTTON COMPONENT - NEON VARIANT
    const UnifiedButton = ({ 
        onClick, 
        icon: Icon, 
        label, 
        isActive,
        isLast,
        variant = 'default'
    }: { 
        onClick: () => void, 
        icon: any, 
        label: string, 
        isActive?: boolean,
        isLast?: boolean,
        variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'violet'
    }) => {
        // MAPA DE CORES: Garante visibilidade permanente
        const colorMap = {
            default: { base: 'text-slate-300 hover:text-white', active: 'text-white' },
            primary: { base: 'text-blue-400 hover:text-blue-300', active: 'text-blue-300 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' }, 
            success: { base: 'text-emerald-400 hover:text-emerald-300', active: 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' }, 
            danger: { base: 'text-rose-400 hover:text-rose-300', active: 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' }, 
            warning: { base: 'text-amber-400 hover:text-amber-300', active: 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' }, 
            info: { base: 'text-indigo-400 hover:text-indigo-300', active: 'text-indigo-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]' }, 
            violet: { base: 'text-purple-400 hover:text-purple-300', active: 'text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]' }, 
        };

        const colors = colorMap[variant] || colorMap.default;
        const currentClass = isActive ? `${colors.active} font-black scale-105` : `${colors.base} font-bold hover:scale-105`;

        return (
            <>
                <button 
                    onClick={onClick}
                    className={`
                        relative flex-1 flex items-center justify-center gap-2 px-6 h-full text-[10px] uppercase transition-all duration-300 outline-none group whitespace-nowrap
                        ${currentClass}
                    `}
                >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                    <span className="hidden sm:inline">{label}</span>
                </button>
                {!isLast && <div className="w-px h-3 bg-white/10 self-center"></div>}
            </>
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
                    
                    {/* UNIFIED COMMAND CAPSULE */}
                    <div className="flex items-center h-9 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 rounded-full shadow-lg border border-white/20 overflow-hidden overflow-x-auto custom-scrollbar p-0.5">
                        <UnifiedButton onClick={() => setActiveTab('settings')} isActive={activeTab === 'settings'} label={t('admin.tab.settings')} icon={Cog6ToothIcon} variant="default" />
                        <UnifiedButton onClick={() => setActiveTab('users')} isActive={activeTab === 'users'} label={t('admin.tab.users')} icon={UserIcon} variant="primary" />
                        <UnifiedButton onClick={() => setActiveTab('audit')} isActive={activeTab === 'audit'} label={t('admin.tab.audit')} icon={BanknotesIcon} variant="success" />
                        <UnifiedButton onClick={() => setActiveTab('models')} isActive={activeTab === 'models'} label="Modelos" icon={BrainIcon} isLast={true} variant="violet" />
                    </div>

                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 hidden md:block mx-1"></div>
                    
                    <div className="flex items-center gap-2">
                        <button onClick={runDiagnostics} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm uppercase shadow-amber-500/20">
                            <BoltIcon className="w-3.5 h-3.5 text-white" />
                            <span>Diagnóstico</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                {activeTab === 'settings' && <AdminSettingsTab />}
                {activeTab === 'users' && <AdminUsersTab />}
                {activeTab === 'audit' && <AdminAuditTab />}
                {activeTab === 'models' && <AdminModelsTab />}
            </div>

            {/* Diagnostic Modal */}
            {showDiagModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-[#020610]/60 backdrop-blur-sm animate-fade-in">
                    {/* ... (Modal Content mantido inalterado) ... */}
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
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Varrendo variáveis e tabelas...</p>
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
                                    
                                    <div className={`p-4 rounded-xl border flex flex-col gap-2 ${diagResult.tableModelsStatus === 'OK' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-xs font-bold text-slate-700">Tabela 'file_models'</span>
                                            {diagResult.tableModelsStatus === 'OK' ? (
                                                <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                                            ) : (
                                                <span className="text-[9px] font-black text-amber-600 bg-white px-2 py-0.5 rounded-full border border-amber-200">AUSENTE</span>
                                            )}
                                        </div>
                                        {diagResult.tableModelsStatus !== 'OK' && (
                                            <div className="mt-2">
                                                <p className="text-[10px] text-amber-700 mb-2 leading-tight">
                                                    A tabela necessária para salvar modelos no banco não existe. O sistema está usando o <strong>Modo Local</strong>.
                                                </p>
                                                <button 
                                                    onClick={copySql}
                                                    className="w-full flex items-center justify-center gap-2 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                                >
                                                    <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                                    Copiar SQL de Correção
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Modo de Operação</span>
                                        <span className="text-[10px] font-black text-blue-600 bg-white px-2 py-0.5 rounded-full border border-blue-100">
                                            {diagResult.tableModelsStatus === 'OK' ? 'ONLINE SYNC' : 'OFFLINE FALLBACK'}
                                        </span>
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