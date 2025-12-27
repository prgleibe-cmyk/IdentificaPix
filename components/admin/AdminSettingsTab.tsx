
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { 
    DollarSignIcon, 
    FloppyDiskIcon, 
    Cog6ToothIcon, 
    SparklesIcon, 
    CircleStackIcon, 
    ClockIcon,
    ShieldCheckIcon,
    InformationCircleIcon,
    BrainIcon,
    WrenchScrewdriverIcon,
    XMarkIcon
} from '../Icons';

const InputGroup = ({ label, name, value, onChange, type = "text", placeholder = "", icon: Icon }: any) => (
    <div className="group">
        <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 group-focus-within:text-brand-blue transition-colors">
            {label}
        </label>
        <div className="relative">
            {Icon && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-blue transition-colors">
                    <Icon className="w-3.5 h-3.5" />
                </div>
            )}
            <input 
                type={type} 
                name={name}
                step={type === 'number' ? "0.01" : undefined}
                value={value} 
                onChange={onChange}
                placeholder={placeholder}
                className={`
                    w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 
                    rounded-xl py-2 text-xs font-bold text-slate-700 dark:text-slate-200 
                    focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all
                    ${Icon ? 'pl-9 pr-3' : 'px-3'}
                `}
            />
        </div>
    </div>
);

export const AdminSettingsTab: React.FC = () => {
    const { systemSettings, updateSystemSettings } = useAuth();
    const { showToast } = useUI();
    const [formData, setFormData] = useState(systemSettings);
    const [newKeyword, setNewKeyword] = useState('');

    useEffect(() => {
        setFormData(systemSettings);
    }, [systemSettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value
        }));
    };

    const handleAddKeyword = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyword.trim()) return;
        
        const currentKeywords = formData.globalIgnoreKeywords || [];
        if (currentKeywords.includes(newKeyword.trim().toUpperCase())) {
            setNewKeyword('');
            return;
        }

        setFormData(prev => ({
            ...prev,
            globalIgnoreKeywords: [...(prev.globalIgnoreKeywords || []), newKeyword.trim().toUpperCase()]
        }));
        setNewKeyword('');
    };

    const handleRemoveKeyword = (keyword: string) => {
        setFormData(prev => ({
            ...prev,
            globalIgnoreKeywords: (prev.globalIgnoreKeywords || []).filter(k => k !== keyword)
        }));
    };

    const handleSaveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        updateSystemSettings(formData);
        showToast("Configurações do sistema atualizadas!", "success");
    };

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in pb-4">
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* System Health Card */}
                <div className="bg-gradient-to-br from-brand-deep to-slate-900 p-6 rounded-[2rem] text-white shadow-xl border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <ShieldCheckIcon className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-lg font-black tracking-tight mb-2 flex items-center gap-2">
                            <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
                            Arquitetura v3
                        </h3>
                        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                            O motor de processamento está operando com **Tripla Validação de DNA** e versionamento imutável de modelos.
                        </p>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/30">Data Shield On</span>
                            <span className="px-2 py-1 rounded-md bg-blue-500/20 text-blue-400 text-[9px] font-bold uppercase tracking-wider border border-blue-500/30">Auto-Learn Active</span>
                        </div>
                    </div>
                </div>

                {/* Quick Info Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-brand-blue">
                            <InformationCircleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">Dica de Engenharia</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Antes de atualizar a lógica de normalização, consulte o arquivo 
                                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-brand-blue">docs/CHECKLIST_QA_ARQUITETURA.md</code> 
                                para evitar quebras estruturais.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
                
                {/* 0. Global Cleaning Rules (Novo) */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 border border-purple-100 dark:border-purple-800">
                                <BrainIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Regras de Limpeza Global</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Termos removidos automaticamente de TODOS os arquivos de usuários.</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-md border border-purple-100 dark:border-purple-800">
                            {(formData.globalIgnoreKeywords || []).length} regras
                        </span>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800 text-[10px] text-purple-700 dark:text-purple-300 leading-relaxed mb-4">
                        <WrenchScrewdriverIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>Estas palavras-chave (ex: "PIX", "TED", "DOC") serão eliminadas das descrições antes mesmo do usuário criar suas próprias regras. Mantenha esta lista atualizada para garantir modelos limpos.</p>
                    </div>

                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="Adicionar termo global (Ex: TRANSFERENCIA)..."
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                        <button onClick={handleAddKeyword} className="px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-purple-500/20 transition-all active:scale-95">Adicionar</button>
                    </div>

                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                        {(formData.globalIgnoreKeywords || []).map(keyword => (
                            <div key={keyword} className="flex items-center gap-2 pl-3 pr-1 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold shadow-sm">
                                <span>{keyword}</span>
                                <button type="button" onClick={() => handleRemoveKeyword(keyword)} className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"><XMarkIcon className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 1. Base Plan Configuration */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-brand-blue border border-blue-100 dark:border-blue-800">
                            <Cog6ToothIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Plano Base & Trial</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Defina o que todo novo usuário recebe gratuitamente.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputGroup 
                            label="Dias de Teste" 
                            name="defaultTrialDays" 
                            type="number" 
                            value={formData.defaultTrialDays}
                            onChange={handleChange}
                            icon={ClockIcon} 
                        />
                        <InputGroup 
                            label="Limite Base de IA" 
                            name="baseAiLimit" 
                            type="number" 
                            value={formData.baseAiLimit}
                            onChange={handleChange}
                            icon={SparklesIcon} 
                        />
                        <InputGroup 
                            label="Cadastros Base (Slots)" 
                            name="baseSlots" 
                            type="number" 
                            value={formData.baseSlots}
                            onChange={handleChange}
                            icon={CircleStackIcon} 
                        />
                    </div>
                </div>

                {/* 2. Pricing Configuration */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 border border-emerald-100 dark:border-emerald-800">
                            <DollarSignIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Precificação</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Valores cobrados para upgrades e assinaturas.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputGroup 
                            label="Mensalidade Base (R$)" 
                            name="monthlyPrice" 
                            type="number" 
                            value={formData.monthlyPrice}
                            onChange={handleChange}
                        />
                        <InputGroup 
                            label="Valor por Cadastro (R$)" 
                            name="pricePerExtra" 
                            type="number" 
                            value={formData.pricePerExtra}
                            onChange={handleChange}
                        />
                        <InputGroup 
                            label="Pacote de Tokens IA (R$)" 
                            name="pricePerAiBlock" 
                            type="number" 
                            value={formData.pricePerAiBlock}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {/* 3. General Config */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Configurações Gerais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup 
                            label="Chave PIX (Recebimento)" 
                            name="pixKey" 
                            value={formData.pixKey}
                            onChange={handleChange}
                            placeholder="CPF/CNPJ/Email"
                        />
                        <InputGroup 
                            label="WhatsApp Suporte" 
                            name="supportNumber" 
                            value={formData.supportNumber}
                            onChange={handleChange}
                            placeholder="551199..."
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button 
                        type="submit"
                        className="flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-bold text-[10px] shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all hover:-translate-y-0.5 active:scale-95 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 uppercase tracking-wide"
                    >
                        <FloppyDiskIcon className="w-3.5 h-3.5" />
                        Salvar Alterações
                    </button>
                </div>
            </form>
        </div>
    );
};
