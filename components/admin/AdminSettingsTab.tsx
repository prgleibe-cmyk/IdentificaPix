
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
    XMarkIcon,
    TagIcon,
    PlusCircleIcon
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
        const keyword = newKeyword.trim().toUpperCase();
        if (!formData.ignoredKeywords.includes(keyword)) {
            setFormData(prev => ({
                ...prev,
                ignoredKeywords: [...prev.ignoredKeywords, keyword]
            }));
        }
        setNewKeyword('');
    };

    const handleRemoveKeyword = (keyword: string) => {
        setFormData(prev => ({
            ...prev,
            ignoredKeywords: prev.ignoredKeywords.filter(k => k !== keyword)
        }));
    };

    const handleSaveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        updateSystemSettings(formData);
        showToast("Configurações do sistema atualizadas!", "success");
    };

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in pb-4 pt-4">
            <form onSubmit={handleSaveSettings} className="space-y-4">
                
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

                {/* 3. Global Keywords Section */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 border border-indigo-100 dark:border-indigo-800">
                            <TagIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Palavras-chave Ignoradas</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Termos removidos automaticamente das descrições bancárias.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <div className="flex-1 relative group">
                                <TagIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-blue" />
                                <input 
                                    type="text" 
                                    value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword(e)}
                                    placeholder="Nova palavra (Ex: PIX, TED...)"
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand-blue transition-all"
                                />
                            </div>
                            <button 
                                type="button"
                                onClick={handleAddKeyword}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-brand-blue hover:text-white rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-600"
                            >
                                <PlusCircleIcon className="w-3.5 h-3.5" /> Adicionar
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-slate-700/50 min-h-[60px]">
                            {formData.ignoredKeywords?.map((keyword) => (
                                <div key={keyword} className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm group animate-fade-in">
                                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">{keyword}</span>
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveKeyword(keyword)}
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                        <XMarkIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {(!formData.ignoredKeywords || formData.ignoredKeywords.length === 0) && (
                                <p className="text-[10px] text-slate-400 italic py-2 px-1">Nenhuma palavra cadastrada.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 4. General Config */}
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
