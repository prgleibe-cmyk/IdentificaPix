
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { 
    DollarSignIcon, 
    FloppyDiskIcon, 
    Cog6ToothIcon, 
    SparklesIcon, 
    CircleStackIcon, 
    ClockIcon
} from '../Icons';

export const AdminSettingsTab: React.FC = () => {
    const { systemSettings, updateSystemSettings } = useAuth();
    const { showToast } = useUI();
    const [formData, setFormData] = useState(systemSettings);

    useEffect(() => {
        setFormData(systemSettings);
    }, [systemSettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));
    };

    const handleSaveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        updateSystemSettings(formData);
        showToast("Configurações do sistema atualizadas!", "success");
    };

    const InputGroup = ({ label, name, type = "text", placeholder = "", icon: Icon }: any) => (
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
                    value={formData[name as keyof typeof formData]} 
                    onChange={handleChange}
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

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in pb-4">
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
                            icon={ClockIcon} 
                        />
                        <InputGroup 
                            label="Limite Base de IA" 
                            name="baseAiLimit" 
                            type="number" 
                            icon={SparklesIcon} 
                        />
                        <InputGroup 
                            label="Slots Base" 
                            name="baseSlots" 
                            type="number" 
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
                        />
                        <InputGroup 
                            label="Adicional por Slot (R$)" 
                            name="pricePerExtra" 
                            type="number" 
                        />
                        <InputGroup 
                            label="Pacote 1k IA (R$)" 
                            name="pricePerAiBlock" 
                            type="number" 
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
                            placeholder="CPF/CNPJ/Email"
                        />
                        <InputGroup 
                            label="WhatsApp Suporte" 
                            name="supportNumber" 
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
