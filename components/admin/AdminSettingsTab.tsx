import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { GlobalAnnouncement } from '../../contexts/auth/AuthContracts';
import { 
    DollarSignIcon, 
    FloppyDiskIcon, 
    Cog6ToothIcon, 
    CircleStackIcon, 
    ClockIcon
} from '../Icons';
import { 
    Megaphone, 
    AlertTriangle, 
    Wrench, 
    Sparkles, 
    Eye, 
    ExternalLink, 
    X,
    Bell
} from 'lucide-react';

const InputGroup = ({ label, name, value, onChange, type = "text", placeholder = "", icon: Icon }: any) => (
    <div className="group">
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 group-focus-within:text-orange-600 dark:group-focus-within:text-orange-400 transition-colors">
            {label}
        </label>
        <div className="relative">
            {Icon && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-600 dark:group-focus-within:text-orange-400 transition-colors">
                    <Icon className="w-4 h-4" />
                </div>
            )}
            <input 
                type={type} 
                name={name}
                step={type === 'number' ? "0.01" : undefined}
                value={value ?? ''} 
                onChange={onChange}
                placeholder={placeholder}
                className={`
                    w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 
                    rounded-lg py-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 
                    focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors
                    ${type === 'number' ? 'tabular-nums' : ''}
                    ${Icon ? 'pl-9 pr-3.5' : 'px-3.5'}
                `}
            />
        </div>
    </div>
);

export const AdminSettingsTab: React.FC = () => {
    const { systemSettings, updateSystemSettings } = useAuth();
    const { showToast } = useUI();
    const [formData, setFormData] = useState(systemSettings);

    const [announcement, setAnnouncement] = useState<GlobalAnnouncement>(
        systemSettings.announcement || {
            enabled: false,
            type: 'info',
            title: '',
            message: '',
            linkUrl: '',
            linkLabel: '',
            dismissible: true
        }
    );

    useEffect(() => {
        setFormData(systemSettings);
        if (systemSettings.announcement) {
            setAnnouncement(systemSettings.announcement);
        }
    }, [systemSettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value
        }));
    };

    const handleAnnouncementChange = (field: keyof GlobalAnnouncement, value: any) => {
        setAnnouncement(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        const updatedPayload = {
            ...formData,
            announcement: {
                ...announcement,
                updatedAt: new Date().toISOString()
            }
        };
        await updateSystemSettings(updatedPayload);
        showToast("Configurações e avisos do sistema atualizados com sucesso!", "success");
    };

    // Helper for Live Preview Styling
    const getPreviewStyle = () => {
        switch (announcement.type) {
            case 'maintenance':
                return {
                    containerBg: 'bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white',
                    badgeBg: 'bg-purple-900/60 text-purple-200 border border-purple-400/40',
                    btnBg: 'bg-white text-purple-900',
                    icon: <Wrench className="w-4 h-4 text-purple-200" />,
                    defaultTitle: 'Manutenção do Sistema'
                };
            case 'warning':
                return {
                    containerBg: 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white',
                    badgeBg: 'bg-amber-900/60 text-amber-100 border border-amber-300/40',
                    btnBg: 'bg-white text-amber-900',
                    icon: <AlertTriangle className="w-4 h-4 text-amber-200" />,
                    defaultTitle: 'Aviso Importante'
                };
            case 'success':
                return {
                    containerBg: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white',
                    badgeBg: 'bg-emerald-900/60 text-emerald-100 border border-emerald-300/40',
                    btnBg: 'bg-white text-emerald-900',
                    icon: <Sparkles className="w-4 h-4 text-emerald-200" />,
                    defaultTitle: 'Novidade & Atualização'
                };
            case 'info':
            default:
                return {
                    containerBg: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white',
                    badgeBg: 'bg-blue-900/60 text-blue-100 border border-blue-300/40',
                    btnBg: 'bg-white text-blue-900',
                    icon: <Megaphone className="w-4 h-4 text-blue-200" />,
                    defaultTitle: 'Comunicado Global'
                };
        }
    };

    const previewStyle = getPreviewStyle();

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in pb-8 pt-4">
            <form onSubmit={handleSaveSettings} className="space-y-4">
                
                {/* 1. Global Announcement / Maintenance Banner Card */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center shrink-0">
                                <Megaphone className="w-4.5 h-4.5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                                    Avisos Globais & Banner de Manutenção
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Exiba alertas em tempo real no topo da tela para todos os usuários do sistema.
                                </p>
                            </div>
                        </div>

                        {/* Banner Toggle Switch */}
                        <div className="flex items-center gap-2.5">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {announcement.enabled ? 'Banner Ativo' : 'Banner Inativo'}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleAnnouncementChange('enabled', !announcement.enabled)}
                                className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                    announcement.enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                                }`}
                            >
                                <div className="bg-white w-5 h-5 rounded-full shadow-xs transform transition-transform" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Type Selection */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Tipo de Comunicado
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { id: 'info', label: 'Informação', icon: Megaphone, color: 'text-blue-500' },
                                    { id: 'warning', label: 'Aviso Importante', icon: AlertTriangle, color: 'text-amber-500' },
                                    { id: 'maintenance', label: 'Manutenção', icon: Wrench, color: 'text-purple-500' },
                                    { id: 'success', label: 'Novidade', icon: Sparkles, color: 'text-emerald-500' },
                                ].map(item => {
                                    const Icon = item.icon;
                                    const isSelected = announcement.type === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleAnnouncementChange('type', item.id)}
                                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-500 ring-1 ring-orange-500/30 text-slate-900 dark:text-white' 
                                                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                                            }`}
                                        >
                                            <Icon className={`w-4 h-4 ${item.color}`} />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Title & Message */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Título Personalizado (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={announcement.title || ''}
                                    onChange={e => handleAnnouncementChange('title', e.target.value)}
                                    placeholder={previewStyle.defaultTitle}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Mensagem do Aviso
                                </label>
                                <input
                                    type="text"
                                    value={announcement.message || ''}
                                    onChange={e => handleAnnouncementChange('message', e.target.value)}
                                    placeholder="Ex: Manutenção preventiva programada para hoje às 23h (duração ~10 min)."
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        {/* Link & Options */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Texto do Botão (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={announcement.linkLabel || ''}
                                    onChange={e => handleAnnouncementChange('linkLabel', e.target.value)}
                                    placeholder="Ex: Saiba Mais"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors"
                                />
                            </div>

                            <div className="md:col-span-1">
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Link / URL de Destino (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={announcement.linkUrl || ''}
                                    onChange={e => handleAnnouncementChange('linkUrl', e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-colors"
                                />
                            </div>

                            <div className="md:col-span-1 flex items-center pt-5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={announcement.dismissible !== false}
                                        onChange={e => handleAnnouncementChange('dismissible', e.target.checked)}
                                        className="w-4 h-4 rounded accent-orange-600 text-orange-600 focus:ring-orange-500"
                                    />
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Permitir que o usuário feche
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                <Eye className="w-3.5 h-3.5" />
                                <span>Prévia em Tempo Real do Banner</span>
                            </div>

                            <div className={`p-3 rounded-xl ${previewStyle.containerBg} shadow-xs`}>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <div className="p-1 rounded-lg bg-white/10">
                                            {previewStyle.icon}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${previewStyle.badgeBg}`}>
                                                {announcement.title?.trim() || previewStyle.defaultTitle}
                                            </span>
                                            <p className="font-semibold text-white/95 leading-relaxed break-words">
                                                {announcement.message?.trim() || 'Digite uma mensagem para visualizar a prévia aqui...'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {announcement.linkUrl && (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-xs ${previewStyle.btnBg}`}>
                                                <span>{announcement.linkLabel || 'Saiba Mais'}</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </span>
                                        )}
                                        {announcement.dismissible !== false && (
                                            <span className="p-1 text-white/80">
                                                <X className="w-4 h-4" />
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Base Plan Configuration */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                        <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center shrink-0">
                            <Cog6ToothIcon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">Plano Base & Trial</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Defina o que todo novo usuário recebe gratuitamente.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup 
                            label="Dias de Teste" 
                            name="defaultTrialDays" 
                            type="number" 
                            value={formData.defaultTrialDays}
                            onChange={handleChange}
                            icon={ClockIcon} 
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

                {/* 3. Pricing Configuration */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                        <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-center shrink-0">
                            <DollarSignIcon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">Precificação</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Valores cobrados para upgrades e assinaturas.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>
                </div>

                {/* 4. Owner & Legal Info */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 relative overflow-hidden">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Dados do Proprietário (Pessoa Física)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputGroup 
                            label="Nome do Proprietário" 
                            name="ownerName" 
                            value={formData.ownerName || 'Gleibe Oliveira da Silva'} 
                            onChange={handleChange}
                            placeholder="Gleibe Oliveira da Silva"
                        />
                        <InputGroup 
                            label="CPF do Proprietário" 
                            name="ownerCpf" 
                            value={formData.ownerCpf || '907.169.901-30'} 
                            onChange={handleChange}
                            placeholder="000.000.000-00"
                        />
                        <InputGroup 
                            label="E-mail de Contato / Licença" 
                            name="ownerEmail" 
                            value={formData.ownerEmail || 'identificapix@gmail.com'} 
                            onChange={handleChange}
                            placeholder="identificapix@gmail.com"
                        />
                    </div>
                </div>

                {/* 5. General Config */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 relative overflow-hidden">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Configurações Gerais</h4>
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
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold text-xs shadow-xs transition-colors bg-orange-600 hover:bg-orange-700 cursor-pointer"
                    >
                        <FloppyDiskIcon className="w-4 h-4" />
                        Salvar Alterações
                    </button>
                </div>
            </form>
        </div>
    );
};
