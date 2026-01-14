
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
    ClipboardDocumentIcon,
    EyeIcon
} from '../components/Icons';
import { AdminSettingsTab } from '../components/admin/AdminSettingsTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminAuditTab } from '../components/admin/AdminAuditTab';
import { AdminModelsTab } from '../components/admin/AdminModelsTab';
import { AdminObservationTab } from '../components/admin/AdminObservationTab';

type AdminTab = 'settings' | 'users' | 'audit' | 'models' | 'observation';

const FIX_SQL = `
-- ============================================================
-- SCRIPT DE CORREÇÃO DEFINITIVA (V5)
-- Execute no Supabase SQL Editor para corrigir a estrutura
-- ============================================================

BEGIN;

-- 1. Garante que a coluna bank_id existe (CRÍTICO PARA O ERRO 400)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'consolidated_transactions' AND column_name = 'bank_id') THEN 
        ALTER TABLE consolidated_transactions ADD COLUMN bank_id UUID REFERENCES banks(id); 
    END IF; 
END $$;

-- 2. Habilita RLS na tabela
ALTER TABLE consolidated_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Recria a Política de Exclusão (DELETE)
DROP POLICY IF EXISTS "Users can delete their own pending items" ON consolidated_transactions;

CREATE POLICY "Users can delete their own pending items"
ON consolidated_transactions
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- 4. Cria Função Segura de Limpeza (RPC)
-- Esta função roda no servidor e evita erros de permissão
CREATE OR REPLACE FUNCTION delete_pending_transactions(target_bank_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF target_bank_id IS NOT NULL THEN
    -- Deleta apenas do banco específico
    DELETE FROM consolidated_transactions
    WHERE user_id = auth.uid()
      AND status = 'pending'
      AND (bank_id = target_bank_id OR bank_id IS NULL); -- Remove também orfãos se houver
  ELSE
    -- Deleta TUDO (Reset)
    DELETE FROM consolidated_transactions
    WHERE user_id = auth.uid()
      AND status = 'pending';
  END IF;
END;
$$;

COMMIT;
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

    // TAB BUTTON COMPONENT - PILL STYLE
    const AdminTabButton = ({ 
        id, 
        label, 
        icon: Icon, 
        colorTheme 
    }: { 
        id: AdminTab, 
        label: string, 
        icon: any, 
        colorTheme: 'slate' | 'blue' | 'emerald' | 'violet' | 'indigo' 
    }) => {
        const isActive = activeTab === id;
        
        let activeClass = "";
        let iconClass = "";

        switch (colorTheme) {
            case 'blue':
                activeClass = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30";
                iconClass = isActive ? "text-white" : "text-blue-500";
                break;
            case 'emerald':
                activeClass = "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30";
                iconClass = isActive ? "text-white" : "text-emerald-500";
                break;
            case 'violet':
                activeClass = "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/30";
                iconClass = isActive ? "text-white" : "text-violet-500";
                break;
            case 'indigo':
                activeClass = "bg-gradient-to-r from-indigo-500 to-cyan-600 text-white shadow-md shadow-indigo-500/30";
                iconClass = isActive ? "text-white" : "text-indigo-500";
                break;
            case 'slate':
            default:
                activeClass = "bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-md shadow-slate-500/30";
                iconClass = isActive ? "text-white" : "text-slate-500";
                break;
        }

        const baseClass = "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700";

        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`
                    relative flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-wide
                    ${isActive ? `${activeClass} transform scale-105 z-10 border-transparent` : baseClass}
                `}
            >
                <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
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
                
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    
                    {/* TABS CONTAINER - PILL STYLE */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-full border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar">
                        <AdminTabButton id="settings" label={t('admin.tab.settings')} icon={Cog6ToothIcon} colorTheme="slate" />
                        <AdminTabButton id="users" label={t('admin.tab.users')} icon={UserIcon} colorTheme="blue" />
                        <AdminTabButton id="audit" label={t('admin.tab.audit')} icon={BanknotesIcon} colorTheme="emerald" />
                        <AdminTabButton id="models" label="Laboratório" icon={BrainIcon} colorTheme="violet" />
                        <AdminTabButton id="observation" label="Observação" icon={EyeIcon} colorTheme="indigo" />
                    </div>

                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 hidden md:block mx-1"></div>
                    
                    <div className="flex items-center gap-2">
                        <button onClick={runDiagnostics} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm uppercase shadow-amber-500/20 hover:-translate-y-0.5 transition-all">
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
                {activeTab === 'observation' && <AdminObservationTab />}
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
                                    </div>

                                    {/* BLOCO DE CORREÇÃO DO PROBLEMA DE DELETE */}
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-amber-800">Correção de Estrutura (V5)</span>
                                            <span className="text-[9px] font-black text-amber-600 bg-white px-2 py-0.5 rounded-full border border-amber-200">IMPORTANTE</span>
                                        </div>
                                        <div className="mt-1">
                                            <p className="text-[10px] text-amber-700 mb-2 leading-tight">
                                                Se a exclusão falha, a coluna 'bank_id' pode estar faltando. Este script corrige isso e atualiza as permissões.
                                            </p>
                                            <button 
                                                onClick={copySql}
                                                className="w-full flex items-center justify-center gap-2 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-bold uppercase transition-colors shadow-sm"
                                            >
                                                <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                                                Copiar SQL V5
                                            </button>
                                        </div>
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
