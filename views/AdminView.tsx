
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
-- ============================================================
-- SCRIPT DE CORREÇÃO DEFINITIVA (V10 - Configs & Persistence)
-- ============================================================

BEGIN;

-- 1. Tabela de Configurações Administrativas (Crucial para persistência de Keywords)
CREATE TABLE IF NOT EXISTS public.admin_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Garantir que a tabela consolidated_transactions tem as colunas corretas
CREATE TABLE IF NOT EXISTS public.consolidated_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    transaction_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    description TEXT NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')),
    pix_key TEXT,
    source TEXT DEFAULT 'file',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'identified', 'resolved')),
    bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
    row_hash TEXT,
    is_confirmed BOOLEAN DEFAULT false
);

-- Adicionar colunas caso a tabela já exista mas esteja incompleta
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='consolidated_transactions' AND COLUMN_NAME='bank_id') THEN
        ALTER TABLE public.consolidated_transactions ADD COLUMN bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='consolidated_transactions' AND COLUMN_NAME='row_hash') THEN
        ALTER TABLE public.consolidated_transactions ADD COLUMN row_hash TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='consolidated_transactions' AND COLUMN_NAME='is_confirmed') THEN
        ALTER TABLE public.consolidated_transactions ADD COLUMN is_confirmed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 3. Políticas RLS
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidated_transactions ENABLE ROW LEVEL SECURITY;

-- Política simples para Admin Config (Leitura para todos, Escrita permitida no backend)
DROP POLICY IF EXISTS "Enable read access for all" ON public.admin_config;
CREATE POLICY "Enable read access for all" ON public.admin_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.admin_config;
CREATE POLICY "Enable all access for authenticated users" ON public.admin_config FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.consolidated_transactions;
CREATE POLICY "Users can manage their own transactions" ON public.consolidated_transactions
    FOR ALL USING (auth.uid() = user_id);

COMMIT;
`;

export const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('settings');
    const { user } = useAuth();
    const { showToast } = useUI();
    const { t } = useTranslation();
    const [showDiagModal, setShowDiagModal] = useState(false);
    const [diagResult, setDiagResult] = useState<any>(null);
    const [isLoadingDiag, setIsLoadingDiag] = useState(false);

    const copySql = () => {
        navigator.clipboard.writeText(FIX_SQL);
        showToast("SQL V10 copiado! Execute no Supabase SQL Editor.", "success");
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
            <button onClick={() => setActiveTab(id)} className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-wide ${isActive ? `${activeClass} transform scale-105 z-10 border-transparent` : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"}`}>
                <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 flex-shrink-0 px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><ShieldCheckIcon className="w-5 h-5 text-slate-700 dark:text-slate-200" /></div>
                    <div>
                        <h2 className="text-xl font-black text-brand-deep dark:text-white tracking-tight leading-none">{t('admin.title')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">Diagnóstico e Gestão do Sistema</p>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-full border border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar">
                        <AdminTabButton id="settings" label={t('admin.tab.settings')} icon={Cog6ToothIcon} colorTheme="slate" />
                        <AdminTabButton id="users" label={t('admin.tab.users')} icon={UserIcon} colorTheme="blue" />
                        <AdminTabButton id="audit" label={t('admin.tab.audit')} icon={BanknotesIcon} colorTheme="emerald" />
                        <AdminTabButton id="models" label="Laboratório" icon={BrainIcon} colorTheme="violet" />
                    </div>
                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 hidden md:block mx-1"></div>
                    <button onClick={runDiagnostics} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm uppercase shadow-amber-500/20 hover:-translate-y-0.5 transition-all">
                        <BoltIcon className="w-3.5 h-3.5 text-white" />
                        <span>Diagnóstico</span>
                    </button>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                {activeTab === 'settings' && <AdminSettingsTab />}
                {activeTab === 'users' && <AdminUsersTab />}
                {activeTab === 'audit' && <AdminAuditTab />}
                {activeTab === 'models' && <AdminModelsTab />}
            </div>
            {showDiagModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-[#020610]/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><BoltIcon className="w-5 h-5 text-amber-500" />Saúde do Ambiente</h3>
                            <button onClick={() => setShowDiagModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {isLoadingDiag ? (<div className="text-center py-8"><div className="animate-spin h-8 w-8 border-4 border-brand-blue border-t-transparent rounded-full mx-auto mb-3"></div><p className="text-xs text-slate-500">Varrendo variáveis e tabelas...</p></div>) : diagResult ? (
                                <div className="space-y-3">
                                    <div className={`p-4 rounded-xl border flex items-center justify-between ${diagResult.geminiKey ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}><span className="text-xs font-bold text-slate-700">Chave Gemini (process.env)</span>{diagResult.geminiKey ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <XCircleIcon className="w-5 h-5 text-red-500" />}</div>
                                    <div className={`p-4 rounded-xl border flex items-center justify-between ${diagResult.supabaseStatus === 'CONNECTED' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}><div className="flex flex-col"><span className="text-xs font-bold text-slate-700">Conexão Supabase</span>{diagResult.supabaseError && <span className="text-[10px] text-red-500 mt-1">{diagResult.supabaseError}</span>}</div>{diagResult.supabaseStatus === 'CONNECTED' ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <XCircleIcon className="w-5 h-5 text-red-500" />}</div>
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-2">
                                        <div className="flex items-center justify-between"><span className="text-xs font-bold text-amber-800">Correção de Estrutura (V10)</span><span className="text-[9px] font-black text-amber-600 bg-white px-2 py-0.5 rounded-full border border-amber-200">NOVA VERSÃO</span></div>
                                        <div className="mt-1">
                                            <p className="text-[10px] text-amber-700 mb-2 leading-tight">Este script atualiza as tabelas para suportar a persistência total de configurações e palavras-chave.</p>
                                            <button onClick={copySql} className="w-full flex items-center justify-center gap-2 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-bold uppercase transition-colors shadow-sm"><ClipboardDocumentIcon className="w-3.5 h-3.5" />Copiar SQL V10</button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end"><button onClick={() => setShowDiagModal(false)} className="px-5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-full transition-colors uppercase">Fechar</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};
