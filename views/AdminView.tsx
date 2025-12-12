import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { ShieldCheckIcon, UserIcon, CircleStackIcon, ChartBarIcon, DocumentDuplicateIcon, UserCircleIcon, Cog6ToothIcon, FloppyDiskIcon, LockClosedIcon, TrashIcon, CalendarIcon, BoltIcon, XMarkIcon, SearchIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon, ClockIcon, DollarSignIcon, WhatsAppIcon, BuildingOfficeIcon, SparklesIcon, ArrowsRightLeftIcon, QrCodeIcon, PhotoIcon, ClipboardDocumentIcon, WrenchScrewdriverIcon, GlobeAltIcon } from '../components/Icons';
import { formatCurrency } from '../utils/formatters';

const TabButton: React.FC<{ label: string, isActive: boolean, onClick: () => void, icon?: React.ReactNode }> = ({ label, isActive, onClick, icon }) => (
    <button 
        onClick={onClick} 
        className={`px-5 py-2 text-xs font-bold rounded-xl transition-all duration-200 flex-1 sm:flex-none text-center flex items-center justify-center gap-2 ${ isActive ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
    >
        {icon}
        {label}
    </button>
);

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; subText?: string }> = ({ title, value, icon, color, subText }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center space-x-4">
        <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
            {icon}
        </div>
        <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{value}</p>
            {subText && <p className="text-[10px] text-slate-400 font-medium">{subText}</p>}
        </div>
    </div>
);

// Componente para exibir instruções SQL
const SqlInstructionCard = () => {
    const [copied, setCopied] = useState(false);
    
    const sqlCode = `-- 1. GARANTIR ESTRUTURA DA TABELA
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS limit_ai int DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS usage_ai int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_price numeric DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_lifetime boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_churches int DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_banks int DEFAULT 1;

-- 2. HABILITAR SEGURANÇA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. LIMPEZA TOTAL DE POLÍTICAS (Para evitar conflitos)
DO $$ 
BEGIN 
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON public.profiles;', '')
        FROM pg_policies 
        WHERE tablename = 'profiles'
    );
END $$;

-- 4. CRIAR NOVAS POLÍTICAS (Permissivas para Admin funcionar)

-- LEITURA
CREATE POLICY "profiles_select_policy" 
ON public.profiles FOR SELECT TO authenticated USING (true);

-- CRIAÇÃO
CREATE POLICY "profiles_insert_policy" 
ON public.profiles FOR INSERT TO authenticated WITH CHECK ( auth.uid() = id );

-- EDIÇÃO (Admin ou Próprio Usuário)
CREATE POLICY "profiles_update_policy" 
ON public.profiles FOR UPDATE TO authenticated 
USING ( 
  auth.uid() = id 
  OR 
  lower(auth.jwt() ->> 'email') = 'identificapix@gmail.com'
);

-- EXCLUSÃO
CREATE POLICY "profiles_delete_policy" 
ON public.profiles FOR DELETE TO authenticated 
USING ( 
  lower(auth.jwt() ->> 'email') = 'identificapix@gmail.com'
);

-- 5. TRIGGER DE AUTO-CRIAÇÃO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, subscription_status, created_at, trial_ends_at, limit_ai, usage_ai, is_lifetime, is_blocked, max_churches, max_banks)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'trial',
    now(),
    now() + interval '10 days',
    100,
    0,
    false,
    false,
    1,
    1
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reaplicar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. CORREÇÃO DE DADOS NULOS (Backfill)
UPDATE public.profiles SET limit_ai = 100 WHERE limit_ai IS NULL;
UPDATE public.profiles SET usage_ai = 0 WHERE usage_ai IS NULL;
UPDATE public.profiles SET max_churches = 1 WHERE max_churches IS NULL;
UPDATE public.profiles SET max_banks = 1 WHERE max_banks IS NULL;

-- 7. RECARREGAR CACHE DA API (CRÍTICO: Resolve erro 'column not found in schema cache')
NOTIFY pgrst, 'reload schema';`;

    const handleCopy = () => {
        navigator.clipboard.writeText(sqlCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 my-6 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300">
                    <ExclamationTriangleIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-2">
                        Atualização Crítica de Cache
                    </h4>
                    <p className="text-sm text-amber-800 dark:text-amber-300 mb-4 leading-relaxed">
                        O erro <strong>"Could not find column in schema cache"</strong> ocorre porque o Supabase ainda não "viu" as novas colunas. 
                        <br/><br/>
                        <strong>Solução:</strong> Copie e execute o código abaixo no SQL Editor. O comando final <code>NOTIFY pgrst, 'reload schema'</code> forçará a atualização.
                    </p>
                    
                    <div className="relative group">
                        <pre className="bg-slate-900 text-slate-300 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-slate-700 custom-scrollbar max-h-48 selection:bg-indigo-500 selection:text-white">
                            {sqlCode}
                        </pre>
                        <button 
                            onClick={handleCopy}
                            className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors backdrop-blur-sm border border-white/10"
                            title="Copiar SQL"
                        >
                            {copied ? <CheckCircleIcon className="w-4 h-4 text-emerald-400"/> : <ClipboardDocumentIcon className="w-4 h-4"/>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Safe date formatter to prevent crashes
const formatDateSafe = (dateString: string | null | undefined) => {
    if (!dateString) return '---';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '---';
        return d.toLocaleDateString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
        return '---';
    }
};

// New Modal: Receipt Viewer
const ReceiptViewerModal: React.FC<{ imageUrl: string, onClose: () => void }> = ({ imageUrl, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-10">
                    <XMarkIcon className="w-6 h-6" />
                </button>
                <div className="flex justify-center items-center bg-slate-100 dark:bg-slate-950 p-4 min-h-[300px]">
                    <img 
                        src={imageUrl} 
                        alt="Comprovante" 
                        className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg" 
                    />
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-center flex justify-between items-center">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Comprovante de Pagamento</p>
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Abrir original</a>
                </div>
            </div>
        </div>
    );
};

// New Modal: Edit Duration (Days) or Lifetime & Custom Price & Usage
const EditDurationModal: React.FC<{ user: any, onClose: () => void, onSave: (data: any) => Promise<void> }> = ({ user, onClose, onSave }) => {
    const [daysToAdd, setDaysToAdd] = useState<number>(30);
    const [isLifetime, setIsLifetime] = useState(user.is_lifetime || false);
    const [customPrice, setCustomPrice] = useState<string>(user.custom_price ? String(user.custom_price) : '');
    const [limitAi, setLimitAi] = useState<string>(user.limit_ai ? String(user.limit_ai) : '100');
    const [usageAi, setUsageAi] = useState<string>(user.usage_ai ? String(user.usage_ai) : '0');
    const [maxChurches, setMaxChurches] = useState<string>(user.max_churches ? String(user.max_churches) : '1');
    const [maxBanks, setMaxBanks] = useState<string>(user.max_banks ? String(user.max_banks) : '1');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await onSave({
            days: daysToAdd,
            isLifetime,
            customPrice: customPrice ? parseFloat(customPrice) : null,
            limitAi: limitAi ? parseInt(limitAi) : 100,
            usageAi: usageAi ? parseInt(usageAi) : 0,
            maxChurches: maxChurches ? parseInt(maxChurches) : 1,
            maxBanks: maxBanks ? parseInt(maxBanks) : 1
        });
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700 transform transition-all scale-100 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Gerenciar Acesso</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><XMarkIcon className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar flex-1 -mx-2 px-2">
                    <div className="mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Usuário:</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-base truncate">{user.name || user.email}</p>
                    </div>

                    <div className="space-y-4">
                        {/* Limits Section */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-3 flex items-center gap-2">
                                <BuildingOfficeIcon className="w-3.5 h-3.5"/>
                                Limites de Cadastro
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Igrejas</label>
                                    <input 
                                        type="number" 
                                        value={maxChurches} 
                                        onChange={e => setMaxChurches(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Bancos</label>
                                    <input 
                                        type="number" 
                                        value={maxBanks} 
                                        onChange={e => setMaxBanks(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        min="1"
                                    />
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        {/* Toggle Lifetime */}
                        <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-purple-400 transition-colors cursor-pointer" onClick={() => setIsLifetime(!isLifetime)}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isLifetime ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <BoltIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white text-sm">Acesso Vitalício</p>
                                    <p className="text-xs text-slate-500">Nunca expira.</p>
                                </div>
                            </div>
                            <div className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 ${isLifetime ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${isLifetime ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                        </div>

                        {/* Days Input (Disabled if Lifetime) */}
                        <div className={`transition-opacity duration-300 ${isLifetime ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Adicionar Dias
                            </label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={daysToAdd} 
                                    onChange={e => setDaysToAdd(parseInt(e.target.value) || 0)}
                                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                    min="1"
                                />
                                <span className="absolute right-3 top-3 text-slate-400 text-xs font-medium">dias</span>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">
                                Preço Personalizado
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-400 text-xs font-bold">R$</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={customPrice} 
                                    onChange={e => setCustomPrice(e.target.value)}
                                    placeholder="Global"
                                    className="w-full pl-8 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white placeholder-slate-400"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* AI Limit Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">
                                    Limite IA
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-400 text-xs font-bold">
                                        <SparklesIcon className="w-3 h-3"/>
                                    </span>
                                    <input 
                                        type="number" 
                                        value={limitAi} 
                                        onChange={e => setLimitAi(e.target.value)}
                                        placeholder="100"
                                        className="w-full pl-8 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white placeholder-slate-400"
                                    />
                                </div>
                            </div>
                            {/* Usage Input (Reset) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">
                                    Uso Atual
                                </label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={usageAi} 
                                        onChange={e => setUsageAi(e.target.value)}
                                        className="w-full pl-4 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white placeholder-slate-400"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm text-slate-600 font-bold hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    )
}

// New Modal: Confirm Delete User
const ConfirmDeleteUserModal: React.FC<{ user: any, onClose: () => void, onConfirm: () => void }> = ({ user, onClose, onConfirm }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md transform transition-all scale-100" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Confirmar Exclusão</h3>
                        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="mt-4 flex items-start space-x-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                           <p>Tem certeza de que deseja excluir permanentemente <strong>{user.name || user.email}</strong>?</p>
                           <p className="mt-2 text-xs text-slate-500">Esta ação não pode ser desfeita e removerá o histórico do usuário.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-3 flex justify-end space-x-2 rounded-b-lg">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button type="button" onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-sm">Excluir</button>
                </div>
            </div>
        </div>
    );
};

export const AdminView: React.FC = () => {
    const { systemSettings, updateSystemSettings } = useAuth();
    const { showToast } = useUI();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'audit'>('dashboard');
    const [showSqlHelp, setShowSqlHelp] = useState(false);
    
    // Core Data States
    const [stats, setStats] = useState({ totalUsers: 0, totalReports: 0, totalChurches: 0, dbLatency: '...' });
    const [payments, setPayments] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    
    // Status States
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Search States
    const [userSearch, setUserSearch] = useState('');
    const [paymentSearch, setPaymentSearch] = useState('');

    // Config State
    const [trialDaysInput, setTrialDaysInput] = useState(systemSettings.defaultTrialDays);
    const [pixKeyInput, setPixKeyInput] = useState(systemSettings.pixKey || '');
    const [monthlyPriceInput, setMonthlyPriceInput] = useState(systemSettings.monthlyPrice || 79.90);
    const [pricePerChurchInput, setPricePerChurchInput] = useState(systemSettings.pricePerChurch || 14.90);
    const [pricePerBankInput, setPricePerBankInput] = useState(systemSettings.pricePerBank || 29.90);
    const [pricePerAiBlockInput, setPricePerAiBlockInput] = useState(systemSettings.pricePerAiBlock || 15.00);
    const [supportNumberInput, setSupportNumberInput] = useState(systemSettings.supportNumber || '');

    // Gateway Config States
    const [gatewayProvider, setGatewayProvider] = useState('asaas');
    const [gatewayEnv, setGatewayEnv] = useState('sandbox');
    const [gatewayApiKey, setGatewayApiKey] = useState('');

    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [userToDelete, setUserToDelete] = useState<any | null>(null);
    const [receiptToView, setReceiptToView] = useState<string | null>(null);

    // Single Load Function - Passive Mode (No auto-retry loops)
    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        
        const startTime = performance.now();
        
        try {
            // Parallel Fetch
            const [reportsResponse, churchesResponse, paymentsResponse, profilesResponse] = await Promise.all([
                supabase.from('saved_reports').select('id', { count: 'exact', head: true }),
                supabase.from('churches').select('id', { count: 'exact', head: true }),
                supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(50),
                supabase.from('profiles').select('*').order('created_at', { ascending: false })
            ]);

            const endTime = performance.now();
            const latency = (endTime - startTime).toFixed(0) + 'ms';

            const realProfiles = profilesResponse.data || [];
            const realPayments = paymentsResponse.data || [];

            setStats({
                totalUsers: profilesResponse.count || realProfiles.length,
                totalReports: reportsResponse.count || 0, 
                totalChurches: churchesResponse.count || 0,
                dbLatency: latency
            });
            
            setPayments(realPayments);
            setProfiles(realProfiles);

            // Se falhou ao buscar perfis, define erro para mostrar o aviso, mas NÃO bloqueia a tela
            if (profilesResponse.error) {
                console.error("Erro SQL detectado:", profilesResponse.error);
                setError(profilesResponse.error.message);
            }

        } catch (err: any) {
            console.error("Exceção ao carregar dados:", err);
            setError(err.message || "Erro desconhecido ao carregar dados.");
        } finally {
            setIsLoading(false);
        }
    };

    // Load once on mount
    useEffect(() => {
        loadData();
    }, []); 

    // Filter Logic
    const filteredProfiles = useMemo(() => {
        if (!profiles) return [];
        if (!userSearch.trim()) return profiles;
        const lowerSearch = userSearch.toLowerCase();
        return profiles.filter(p => 
            (p.name && p.name.toLowerCase().includes(lowerSearch)) || 
            (p.email && p.email.toLowerCase().includes(lowerSearch))
        );
    }, [profiles, userSearch]);

    const filteredPayments = useMemo(() => {
        if (!payments) return [];
        if (!paymentSearch.trim()) return payments;
        const lowerSearch = paymentSearch.toLowerCase();
        return payments.filter(pay => {
            if (!pay) return false; 
            
            const userProfile = profiles.find(p => p.id === pay.user_id);
            const userName = userProfile ? (userProfile.name || userProfile.email) : '';
            const notes = pay.notes || '';
            const amount = pay.amount ? pay.amount.toString() : '';
            
            return (
                (userName && userName.toLowerCase().includes(lowerSearch)) ||
                (notes && notes.toLowerCase().includes(lowerSearch)) ||
                (amount && amount.includes(lowerSearch))
            );
        });
    }, [payments, paymentSearch, profiles]);


    const handleSaveConfig = () => {
        updateSystemSettings({ 
            defaultTrialDays: trialDaysInput,
            pixKey: pixKeyInput,
            monthlyPrice: monthlyPriceInput,
            pricePerChurch: pricePerChurchInput,
            pricePerBank: pricePerBankInput,
            pricePerAiBlock: pricePerAiBlockInput,
            supportNumber: supportNumberInput
        });
        showToast("Configurações do sistema atualizadas.", "success");
    };

    const handleSaveGateway = () => {
        // Logic to save gateway config to backend/local would go here
        showToast("Configuração de Gateway salva (Simulação).", "success");
    };

    // --- Actions ---

    const toggleBlockUser = async (user: any) => {
        const newStatus = !user.is_blocked;
        setProfiles(prev => prev.map(p => p.id === user.id ? { ...p, is_blocked: newStatus } : p));
        showToast(newStatus ? "Usuário bloqueado." : "Usuário desbloqueado.", "success");
        
        const { error } = await supabase.from('profiles').update({ is_blocked: newStatus }).eq('id', user.id);
        if (error) {
            console.error("Erro ao sincronizar bloqueio:", error);
            showToast("Falha ao sincronizar bloqueio no banco.", "error");
        }
    };

    const handleDeleteClick = (user: any, e: React.MouseEvent) => {
        e.preventDefault(); 
        e.stopPropagation();
        setUserToDelete(user);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        const user = userToDelete;

        const oldProfiles = [...profiles];
        setProfiles(prev => prev.filter(p => p.id !== user.id));
        showToast("Processando exclusão...", "success");
        setUserToDelete(null);

        const { error } = await supabase.from('profiles').delete().eq('id', user.id);
        
        if (error) {
            console.error("Erro ao excluir perfil no banco:", error);
            setProfiles(oldProfiles); 
            showToast(`Erro ao excluir: ${error.message || 'Restrição de dados (pagamentos existentes)'}`, "error");
        } else {
            showToast("Usuário excluído com sucesso.", "success");
        }
    };

    const handleUpdateDuration = async (formData: any) => {
        if (!editingUser) return;
        
        const { days, isLifetime, customPrice, limitAi, usageAi, maxChurches, maxBanks } = formData;
        
        // Data logic: Append if valid, Reset if expired/null
        const currentExpiry = editingUser.subscription_ends_at ? new Date(editingUser.subscription_ends_at) : new Date();
        const now = new Date();
        // If current subscription is active and in the future, add days to IT. Otherwise add to NOW.
        const baseDate = (currentExpiry > now && editingUser.subscription_status === 'active') ? currentExpiry : now;
        
        const newDate = new Date(baseDate);
        newDate.setDate(newDate.getDate() + days);
        const isoDate = newDate.toISOString();

        const updateData = isLifetime ? {
            is_lifetime: true,
            subscription_status: 'lifetime' as const,
            subscription_ends_at: null,
            trial_ends_at: null,
            custom_price: customPrice,
            limit_ai: limitAi,
            usage_ai: usageAi,
            max_churches: maxChurches,
            max_banks: maxBanks
        } : {
            is_lifetime: false,
            subscription_status: 'active' as const,
            subscription_ends_at: isoDate,
            trial_ends_at: null,
            custom_price: customPrice,
            limit_ai: limitAi,
            usage_ai: usageAi,
            max_churches: maxChurches,
            max_banks: maxBanks
        };

        // 1. Tentar atualizar no banco PRIMEIRO
        const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', editingUser.id);

        if (updateError) {
            console.error("Erro ao sincronizar dados no Supabase:", updateError);
            
            // Ativa o aviso visual do SQL imediatamente em caso de erro
            setShowSqlHelp(true);

            // Check for schema cache error specific string
            if (updateError.message.includes("schema cache")) {
                 setError("Erro de Cache do Banco: Execute o script SQL abaixo para corrigir.");
                 showToast("Erro crítico de cache do banco. Veja instruções no topo.", "error");
            } else {
                 showToast(`Erro ao salvar: ${updateError.message}. Verifique as permissões SQL.`, "error");
                 setError("Erro de Permissão ou Cache: Execute o script SQL abaixo.");
            }
            return;
        }

        // 2. Se deu certo, atualiza UI local
        setProfiles(prev => prev.map(p => p.id === editingUser.id ? { ...p, ...updateData } : p));
        setEditingUser(null);
        showToast("Perfil atualizado com sucesso.", "success");
    };

    const updatePaymentStatus = async (paymentId: string, newStatus: 'approved' | 'rejected') => {
        setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: newStatus } : p));
        
        const { error } = await supabase.from('payments').update({ status: newStatus }).eq('id', paymentId);
        if(error) {
             showToast("Erro ao atualizar pagamento.", "error");
        } else {
             showToast(newStatus === 'approved' ? "Pagamento aprovado." : "Pagamento rejeitado.", "success");
        }
    };

    const getStatusBadge = (profile: any) => {
        if (profile.is_blocked) return <span className="px-2 py-1 bg-red-600 text-white rounded-md text-[10px] font-bold uppercase border border-red-700">BLOQUEADO</span>;
        if (profile.is_lifetime) return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-[10px] font-bold uppercase border border-purple-200">Vitalício</span>;
        
        switch(profile.subscription_status) {
            case 'active': return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold uppercase border border-emerald-200">Ativo</span>;
            case 'trial': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold uppercase border border-blue-200">Teste</span>;
            case 'expired': return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase border border-amber-200">Expirado</span>;
            default: return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-md text-[10px] font-bold uppercase border border-slate-200">{profile.subscription_status}</span>;
        }
    }

    const getPaymentStatusConfig = (status: string) => {
        switch (status) {
            case 'approved': return { label: 'Aprovado', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircleIcon className="w-3 h-3" /> };
            case 'rejected': return { label: 'Rejeitado', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: <XCircleIcon className="w-3 h-3" /> };
            case 'pending': return { label: 'Pendente', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: <ClockIcon className="w-3 h-3" /> };
            default: return { label: status, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: null };
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-10 w-10 text-slate-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-slate-500 font-medium">Carregando painel administrativo...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full lg:h-[calc(100vh-5.5rem)] animate-fade-in gap-4 pb-2">
            
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-800 rounded-xl shadow-lg">
                        <ShieldCheckIcon className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">Painel Administrativo</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">Controle total da plataforma</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowSqlHelp(!showSqlHelp)}
                        className="p-2.5 rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors shadow-sm flex items-center gap-2 font-bold text-xs uppercase tracking-wide active:scale-95 border border-amber-200"
                        title="Ver Scripts de Correção de Banco"
                    >
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Ver SQL de Correção</span>
                    </button>

                    <button 
                        onClick={loadData}
                        className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2 font-bold text-xs uppercase tracking-wide active:scale-95"
                        title="Forçar atualização dos dados"
                    >
                        <ArrowsRightLeftIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Atualizar</span>
                    </button>

                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                         <TabButton 
                            label="Visão Geral" 
                            isActive={activeTab === 'dashboard'} 
                            onClick={() => setActiveTab('dashboard')} 
                            icon={<ChartBarIcon className="w-4 h-4"/>}
                         />
                         <TabButton 
                            label="Usuários" 
                            isActive={activeTab === 'users'} 
                            onClick={() => setActiveTab('users')} 
                            icon={<UserCircleIcon className="w-4 h-4"/>}
                         />
                         <TabButton 
                            label="Auditoria" 
                            isActive={activeTab === 'audit'} 
                            onClick={() => setActiveTab('audit')} 
                            icon={<DocumentDuplicateIcon className="w-4 h-4"/>}
                         />
                    </div>
                </div>
            </div>

            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                    
                    {/* Alerta de Erro / Instrução SQL (Se necessário ou solicitado manualmente) */}
                    {(error || profiles.length === 0 || showSqlHelp) && (
                        <SqlInstructionCard />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard 
                            title="Usuários" 
                            value={stats.totalUsers} 
                            icon={<UserIcon className="w-5 h-5" />} 
                            color="bg-gradient-to-br from-blue-500 to-indigo-600"
                            subText="Registros Reais"
                        />
                        <StatCard 
                            title="Relatórios" 
                            value={stats.totalReports} 
                            icon={<ChartBarIcon className="w-5 h-5" />} 
                            color="bg-gradient-to-br from-emerald-500 to-teal-600"
                        />
                        <StatCard 
                            title="Entidades" 
                            value={stats.totalChurches} 
                            icon={<CircleStackIcon className="w-5 h-5" />} 
                            color="bg-gradient-to-br from-purple-500 to-violet-600"
                        />
                        <StatCard 
                            title="Latência API" 
                            value={stats.dbLatency} 
                            icon={<BoltIcon className="w-5 h-5" />} 
                            color="bg-gradient-to-br from-slate-600 to-slate-800"
                        />
                    </div>

                    {/* System Settings Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                            <Cog6ToothIcon className="w-5 h-5 text-slate-500" />
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">Configurações do Sistema</h3>
                        </div>
                        
                        {/* Pricing Configs Group */}
                        <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-4">
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Precificação Dinâmica</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Plano Base (1 Igr + 1 Bco)
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-2 top-2 text-slate-400"><DollarSignIcon className="w-4 h-4" /></div>
                                        <input 
                                            type="number" step="0.01" value={monthlyPriceInput} onChange={(e) => setMonthlyPriceInput(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:text-white text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        + Igreja
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-2 top-2 text-slate-400"><UserIcon className="w-4 h-4" /></div>
                                        <input 
                                            type="number" step="0.01" value={pricePerChurchInput} onChange={(e) => setPricePerChurchInput(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:text-white text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        + Banco
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-2 top-2 text-slate-400"><BuildingOfficeIcon className="w-4 h-4" /></div>
                                        <input 
                                            type="number" step="0.01" value={pricePerBankInput} onChange={(e) => setPricePerBankInput(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:text-white text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        + Pacote IA (1k)
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-2 top-2 text-slate-400"><SparklesIcon className="w-4 h-4" /></div>
                                        <input 
                                            type="number" step="0.01" value={pricePerAiBlockInput} onChange={(e) => setPricePerAiBlockInput(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:text-white text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Dias de Teste
                                </label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={trialDaysInput} 
                                        onChange={(e) => setTrialDaysInput(parseInt(e.target.value) || 0)}
                                        className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm"
                                    />
                                    <span className="absolute right-3 top-2 text-slate-400 text-xs font-medium">dias</span>
                                </div>
                            </div>

                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Chave Pix (Recebimento)
                                </label>
                                <div className="relative">
                                    <div className="absolute left-2 top-2 text-slate-400">
                                        <QrCodeIcon className="w-4 h-4" />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={pixKeyInput} 
                                        onChange={(e) => setPixKeyInput(e.target.value)}
                                        placeholder="Email, CPF, ou código..."
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white truncate"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    WhatsApp Suporte
                                </label>
                                <div className="relative">
                                    <div className="absolute left-2 top-2 text-slate-400">
                                        <WhatsAppIcon className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        value={supportNumberInput}
                                        onChange={(e) => setSupportNumberInput(e.target.value)}
                                        placeholder="5511999999999"
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white truncate"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveConfig}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 text-xs h-[38px]"
                            >
                                <FloppyDiskIcon className="w-4 h-4" />
                                Salvar Config
                            </button>
                        </div>

                        {/* Payment Gateway Configuration Block */}
                        <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center justify-between">
                                <span>Gateway de Pagamento (API de Cobrança)</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${gatewayApiKey ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                    {gatewayApiKey ? 'Configurado (Simulado)' : 'Desconectado'}
                                </span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Provedor
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-2 top-2.5 text-slate-400"><GlobeAltIcon className="w-4 h-4" /></div>
                                        <select 
                                            value={gatewayProvider} 
                                            onChange={(e) => setGatewayProvider(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:text-white text-sm appearance-none"
                                        >
                                            <option value="asaas">Asaas (Recomendado)</option>
                                            <option value="mercadopago">Mercado Pago</option>
                                            <option value="inter">Banco Inter (API v2)</option>
                                            <option value="stark">Stark Bank</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Ambiente
                                    </label>
                                    <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-600">
                                        <button 
                                            onClick={() => setGatewayEnv('sandbox')}
                                            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${gatewayEnv === 'sandbox' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                        >
                                            Sandbox
                                        </button>
                                        <button 
                                            onClick={() => setGatewayEnv('production')}
                                            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${gatewayEnv === 'production' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                        >
                                            Produção
                                        </button>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        API Key (Token)
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <div className="absolute left-2 top-2.5 text-slate-400"><LockClosedIcon className="w-4 h-4" /></div>
                                            <input 
                                                type="password" 
                                                value={gatewayApiKey} 
                                                onChange={(e) => setGatewayApiKey(e.target.value)}
                                                placeholder="sk_test_..."
                                                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:text-white text-sm"
                                            />
                                        </div>
                                        <button 
                                            onClick={handleSaveGateway}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm transition-all hover:-translate-y-0.5 text-xs whitespace-nowrap"
                                        >
                                            Salvar API
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                <span className="font-bold uppercase text-slate-400">Webhook URL:</span>
                                <span className="font-mono select-all">https://api.identificapix.com/v1/webhooks/payment</span>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-fade-in">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <UserCircleIcon className="w-4 h-4 text-blue-500" />
                                Gestão de Usuários
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">{filteredProfiles.length}</span>
                            </h3>
                            
                            <div className="relative w-full sm:w-56">
                                <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar usuário..." 
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                        <table className="w-full text-left">
                            <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0 backdrop-blur-md z-10">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Usuário</th>
                                    <th className="px-4 py-3 font-bold text-center">Status</th>
                                    <th className="px-4 py-3 font-bold text-center">IA Uso / Limite</th>
                                    <th className="px-4 py-3 font-bold text-center">Expira</th>
                                    <th className="px-4 py-3 font-bold text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                                {filteredProfiles.length > 0 && (
                                    filteredProfiles.map((profile) => {
                                        const expiry = profile.trial_ends_at || profile.subscription_ends_at;
                                        const usage = profile.usage_ai || 0;
                                        const limit = profile.limit_ai || 100;
                                        const isLimitReached = usage >= limit;
                                        const displayName = profile.name || profile.email ? (profile.name || profile.email.split('@')[0]) : 'Usuário sem nome';

                                        return (
                                            <tr key={profile.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${profile.is_blocked ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0 ${profile.is_blocked ? 'bg-red-500' : 'bg-gradient-to-br from-indigo-400 to-purple-500'}`}>
                                                            {profile.is_blocked ? <LockClosedIcon className="w-3.5 h-3.5"/> : (displayName).charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 truncate">
                                                                {displayName}
                                                                {profile.is_lifetime && <BoltIcon className="w-3 h-3 text-purple-500" />}
                                                                {profile.custom_price !== null && (
                                                                    <span title={`Preço: ${formatCurrency(profile.custom_price)}`}>
                                                                        <DollarSignIcon className="w-3 h-3 text-emerald-500" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 font-mono truncate">{profile.email || 'Email não disponível'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {getStatusBadge(profile)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`font-mono font-bold ${isLimitReached ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                                        {usage} / {limit}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {profile.is_lifetime ? (
                                                        <span className="text-purple-600 font-bold">∞</span>
                                                    ) : expiry ? (
                                                        <span className="font-mono text-slate-600 dark:text-slate-300">{new Date(expiry).toLocaleDateString('pt-BR')}</span>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => toggleBlockUser(profile)}
                                                            className={`p-1.5 rounded-lg transition-colors shadow-sm ${profile.is_blocked ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500'}`}
                                                            title={profile.is_blocked ? "Desbloquear" : "Bloquear"}
                                                        >
                                                            <LockClosedIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={() => setEditingUser(profile)}
                                                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm"
                                                            title="Editar Acesso"
                                                        >
                                                            <CalendarIcon className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button 
                                                            onClick={(e) => handleDeleteClick(profile, e)}
                                                            className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm"
                                                            title="Excluir"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* AUDIT TAB */}
            {activeTab === 'audit' && (
                <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full animate-fade-in">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <DocumentDuplicateIcon className="w-4 h-4 text-indigo-500" />
                                Auditoria de Pagamentos
                            </h3>
                            <div className="relative w-full sm:w-56">
                                <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar pagamento..." 
                                    value={paymentSearch}
                                    onChange={(e) => setPaymentSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Info</th>
                                    <th className="px-4 py-3 font-bold text-right">Valor / Status</th>
                                    <th className="px-4 py-3 font-bold text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                                {filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                                            Sem registros.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPayments.map((payment) => {
                                        if (!payment) return null;

                                        const paymentUserId = payment.user_id ? String(payment.user_id) : '';
                                        const userProfile = profiles.find(p => p && String(p.id) === paymentUserId);
                                        const userName = userProfile ? (userProfile.name || userProfile.email) : (paymentUserId ? `ID: ${paymentUserId.substring(0, 6)}...` : 'Sem ID');
                                        const safeUserName = userName || 'Usuário';
                                        const config = getPaymentStatusConfig(payment.status || 'pending');

                                        return (
                                            <tr key={payment.id || Math.random()} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0">
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm bg-gradient-to-br from-slate-400 to-slate-500`}>
                                                            {safeUserName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{safeUserName}</div>
                                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                                <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                                    <ClockIcon className="w-3 h-3" />
                                                                    {formatDateSafe(payment.created_at)}
                                                                </span>
                                                                <span className="truncate max-w-[150px] opacity-80" title={payment.notes || ''}>{payment.notes || '---'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                        {formatCurrency(payment.amount || 0)}
                                                    </div>
                                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border mt-1 ${config.bg} ${config.text} ${config.border}`}>
                                                        {config.icon}
                                                        {config.label}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {payment.receipt_url ? (
                                                            <button 
                                                                onClick={() => setReceiptToView(payment.receipt_url)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm"
                                                            >
                                                                <PhotoIcon className="w-3.5 h-3.5" />
                                                                <span className="hidden sm:inline">Comprovante</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs italic">Sem anexo</span>
                                                        )}
                                                        
                                                        {/* Actions for Pending */}
                                                        {payment.status === 'pending' && (
                                                            <>
                                                                <button onClick={() => updatePaymentStatus(payment.id, 'approved')} className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition-colors" title="Aprovar">
                                                                    <CheckCircleIcon className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => updatePaymentStatus(payment.id, 'rejected')} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-colors" title="Rejeitar">
                                                                    <XMarkIcon className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {editingUser && (
                <EditDurationModal 
                    user={editingUser} 
                    onClose={() => setEditingUser(null)} 
                    onSave={handleUpdateDuration} 
                />
            )}

            {userToDelete && (
                <ConfirmDeleteUserModal 
                    user={userToDelete} 
                    onClose={() => setUserToDelete(null)} 
                    onConfirm={confirmDeleteUser} 
                />
            )}

            {receiptToView && (
                <ReceiptViewerModal 
                    imageUrl={receiptToView} 
                    onClose={() => setReceiptToView(null)} 
                />
            )}
        </div>
    );
};