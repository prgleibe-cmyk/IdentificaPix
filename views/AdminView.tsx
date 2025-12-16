
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
    XMarkIcon,
    CircleStackIcon,
    BoltIcon,
    CheckCircleIcon,
    XCircleIcon
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
    const [sqlMode, setSqlMode] = useState<'debug' | 'schema'>('debug');
    const [diagResult, setDiagResult] = useState<any>(null);
    const [isLoadingDiag, setIsLoadingDiag] = useState(false);

    const handleSync = () => {
        showToast("Dados sincronizados com sucesso.", "success");
    };

    const runDiagnostics = async () => {
        setIsLoadingDiag(true);
        setShowDiagModal(true);
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            setDiagResult(data);
        } catch (error) {
            setDiagResult({ error: 'Falha ao conectar com o backend (/api/health)' });
        } finally {
            setIsLoadingDiag(false);
        }
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

    const debugSql = `-- Verificar Usuário Atual
SELECT * FROM auth.users WHERE id = '${user?.id}';

-- Verificar Perfil
SELECT * FROM profiles WHERE id = '${user?.id}';

-- Listar últimos 5 pagamentos
SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;`;

    const schemaSql = `-- 1. TABELA DE PERFIS (Vinculada ao Auth)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  name text,
  subscription_status text default 'trial', 
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  is_blocked boolean default false,
  is_lifetime boolean default false,
  limit_ai int default 100,
  usage_ai int default 0,
  max_churches int default 2,
  max_banks int default 2,
  custom_price numeric,
  created_at timestamptz default now()
);

-- 2. TRIGGER PARA CRIAR PERFIL AUTOMATICAMENTE
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, name, trial_ends_at)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    now() + interval '7 days'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Remove trigger antigo se existir para evitar duplicação
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. TABELA DE PAGAMENTOS
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  amount numeric not null,
  status text check (status in ('pending', 'approved', 'rejected')),
  notes text,
  receipt_url text,
  created_at timestamptz default now()
);

-- 4. POLÍTICAS DE SEGURANÇA (RLS) - COM LIMPEZA PRÉVIA
alter table public.profiles enable row level security;

-- Remove políticas antigas para evitar erro de duplicidade
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

alter table public.payments enable row level security;

-- Remove política antiga para evitar erro de duplicidade
drop policy if exists "Users can view own payments" on payments;

create policy "Users can view own payments" on payments for select using (auth.uid() = user_id);
`;

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
                            onClick={runDiagnostics}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all uppercase tracking-wide whitespace-nowrap"
                        >
                            <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
                            <span>Diagnóstico</span>
                        </button>
                        <button 
                            onClick={() => setShowSqlModal(true)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-md shadow-amber-500/20 hover:-translate-y-0.5 transition-all uppercase tracking-wide whitespace-nowrap"
                        >
                            <CircleStackIcon className="w-3.5 h-3.5" />
                            <span>Banco de Dados</span>
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
                    <div className="bg-[#0F172A] rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-700 overflow-hidden animate-scale-in flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900/50 shrink-0">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <CircleStackIcon className="w-5 h-5 text-amber-500" />
                                Utilitários SQL
                            </h3>
                            <button onClick={() => setShowSqlModal(false)} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="px-6 pt-4 shrink-0">
                            <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700 inline-flex">
                                <button
                                    onClick={() => setSqlMode('debug')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${sqlMode === 'debug' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Debug Rápido
                                </button>
                                <button
                                    onClick={() => setSqlMode('schema')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${sqlMode === 'schema' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-emerald-400'}`}
                                >
                                    Instalar Schema (Tabelas)
                                </button>
                            </div>
                        </div>

                        <div className="p-6 flex-1 overflow-hidden flex flex-col min-h-0">
                            <p className="text-xs text-slate-400 mb-2 shrink-0">
                                {sqlMode === 'debug' 
                                    ? 'Execute estes scripts no SQL Editor do Supabase para verificar o estado atual.' 
                                    : '⚠️ IMPORTANTE: Execute este script no SQL Editor do Supabase para criar as tabelas necessárias para pagamentos e perfis.'}
                            </p>
                            <div className="bg-black/50 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 leading-relaxed overflow-auto select-all flex-1 custom-scrollbar">
                                <pre>{sqlMode === 'debug' ? debugSql : schemaSql}</pre>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex justify-end shrink-0">
                            <button onClick={() => setShowSqlModal(false)} className="px-5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors uppercase">
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Diagnostic Modal */}
            {showDiagModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-[#020610]/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <BoltIcon className="w-5 h-5 text-amber-500" />
                                Diagnóstico do Sistema
                            </h3>
                            <button onClick={() => setShowDiagModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {isLoadingDiag ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin h-8 w-8 border-4 border-brand-blue border-t-transparent rounded-full mx-auto mb-3"></div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Verificando conexão com backend...</p>
                                </div>
                            ) : diagResult ? (
                                <>
                                    {diagResult.error ? (
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                                            <XCircleIcon className="w-5 h-5 text-red-500 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-bold text-red-700 dark:text-red-400">Erro de Conexão</h4>
                                                <p className="text-xs text-red-600 dark:text-red-300 mt-1">{diagResult.error}</p>
                                                <p className="text-[10px] text-red-500 mt-2">O frontend não conseguiu falar com o servidor Node.js. Verifique se o backend está rodando no Coolify.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">API Status</p>
                                                    <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                                                        <CheckCircleIcon className="w-3 h-3" /> {diagResult.status}
                                                    </p>
                                                </div>
                                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Host Atual</p>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={diagResult.host}>{diagResult.host}</p>
                                                </div>
                                            </div>

                                            <div className={`p-3 rounded-xl border flex justify-between items-center ${diagResult.asaasConfigured ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Asaas API Key</span>
                                                {diagResult.asaasConfigured 
                                                    ? <span className="text-[10px] font-bold text-emerald-600 bg-white dark:bg-emerald-900 px-2 py-1 rounded-full shadow-sm">Configurado</span>
                                                    : <span className="text-[10px] font-bold text-red-600 bg-white dark:bg-red-900 px-2 py-1 rounded-full shadow-sm">Ausente</span>
                                                }
                                            </div>

                                            <div className={`p-3 rounded-xl border flex justify-between items-center ${diagResult.supabaseAdminConfigured ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Supabase Service Key</span>
                                                {diagResult.supabaseAdminConfigured 
                                                    ? <span className="text-[10px] font-bold text-emerald-600 bg-white dark:bg-emerald-900 px-2 py-1 rounded-full shadow-sm">Configurado</span>
                                                    : <span className="text-[10px] font-bold text-red-600 bg-white dark:bg-red-900 px-2 py-1 rounded-full shadow-sm">Ausente</span>
                                                }
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Configuração de Webhook (Asaas)</p>
                                                <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-black/30 rounded-lg border border-slate-200 dark:border-slate-700">
                                                    <code className="text-[10px] font-mono text-slate-600 dark:text-slate-400 flex-1 break-all">
                                                        {window.location.origin}/api/webhooks/asaas
                                                    </code>
                                                    <button 
                                                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/asaas`)}
                                                        className="text-[10px] font-bold text-brand-blue uppercase hover:underline"
                                                    >
                                                        Copiar
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1">Cole esta URL no painel do Asaas para receber atualizações de pagamento.</p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                            <button onClick={() => setShowDiagModal(false)} className="px-5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors uppercase">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
