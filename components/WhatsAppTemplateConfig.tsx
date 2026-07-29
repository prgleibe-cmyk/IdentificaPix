import React, { useState, useEffect } from 'react';
import { 
    MessageCircle, 
    Save, 
    Landmark, 
    HeartHandshake, 
    Send, 
    Check, 
    RotateCcw,
    Sparkles,
    User,
    BookOpen
} from 'lucide-react';
import { 
    getStoredWhatsAppSettings, 
    saveWhatsAppSettings, 
    WhatsAppTemplateSettings,
    DEFAULT_TREASURY_TEMPLATE,
    DEFAULT_PASTORAL_TEMPLATE
} from './modals/WhatsAppReceiptModal';

export const WhatsAppTemplateConfig: React.FC<{ showToast?: (msg: string, type: 'success' | 'error') => void }> = ({ showToast }) => {
    const [settings, setSettings] = useState<WhatsAppTemplateSettings>(getStoredWhatsAppSettings);
    const [activeTab, setActiveTab] = useState<'treasury' | 'pastor' | 'closing'>('treasury');
    const [savedSuccess, setSavedSuccess] = useState(false);

    useEffect(() => {
        setSettings(getStoredWhatsAppSettings());
    }, []);

    const handleSave = () => {
        saveWhatsAppSettings(settings);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        if (showToast) showToast('Modelos de WhatsApp salvos com sucesso!', 'success');
    };

    const handleReset = () => {
        if (window.confirm('Deseja restaurar as mensagens de WhatsApp para o padrão do sistema?')) {
            const defaults: WhatsAppTemplateSettings = {
                treasuryTemplate: DEFAULT_TREASURY_TEMPLATE,
                pastoralTemplate: DEFAULT_PASTORAL_TEMPLATE,
                autoOpenOnReconcile: true,
                defaultSender: 'treasury',
                pastorName: settings.pastorName || 'Pastor Responsável'
            };
            setSettings(defaults);
            saveWhatsAppSettings(defaults);
            if (showToast) showToast('Modelos restaurados com sucesso!', 'success');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-5 space-y-5 shadow-sm">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                        <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                            Modelos de Mensagens WhatsApp
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Configure os textos automáticos de comprovante financeiro e bênção pastoral
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-slate-800 rounded-xl transition-all cursor-pointer flex items-center gap-1 uppercase"
                        title="Restaurar Padrão"
                    >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restaurar</span>
                    </button>

                    <button
                        onClick={handleSave}
                        className="px-4 py-1.5 text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5 uppercase"
                    >
                        {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        <span>{savedSuccess ? 'Salvo!' : 'Salvar Alterações'}</span>
                    </button>
                </div>
            </div>

            {/* General Automation Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                            Oferecer Envio ao Conciliar Lançamento
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            Abre a tela de WhatsApp ao confirmar uma identificação
                        </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                            type="checkbox"
                            checked={settings.autoOpenOnReconcile}
                            onChange={(e) => setSettings({ ...settings, autoOpenOnReconcile: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-600"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                            Perfil Padrão de Remetente
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            Selecione quem envia por padrão
                        </span>
                    </div>
                    <select
                        value={settings.defaultSender}
                        onChange={(e) => setSettings({ ...settings, defaultSender: e.target.value as 'treasury' | 'pastor' })}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none"
                    >
                        <option value="treasury">Tesouraria (Comprovante)</option>
                        <option value="pastor">Pastor (Palavra de Bênção)</option>
                    </select>
                </div>
            </div>

            {/* Pastor Name Input */}
            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                <label className="block text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 mb-1">
                    Assinatura / Nome do Pastor Responsável
                </label>
                <div className="relative max-w-md">
                    <User className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={settings.pastorName || ''}
                        onChange={(e) => setSettings({ ...settings, pastorName: e.target.value })}
                        placeholder="Ex: Pr. João Silva"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-bold outline-none"
                    />
                </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('treasury')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                        activeTab === 'treasury'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                >
                    <Landmark className="w-4 h-4" />
                    <span>1. Tesouraria</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('pastor')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                        activeTab === 'pastor'
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                >
                    <HeartHandshake className="w-4 h-4" />
                    <span>2. Pastor / Bênção</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('closing')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                        activeTab === 'closing'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                >
                    <Sparkles className="w-4 h-4" />
                    <span>3. Fechamento Mensal / Portal</span>
                </button>
            </div>

            {/* Template Editor */}
            <div className="space-y-3">
                <textarea
                    value={activeTab === 'treasury' ? settings.treasuryTemplate : activeTab === 'pastor' ? settings.pastoralTemplate : (settings.closingTemplate || '')}
                    onChange={(e) => {
                        if (activeTab === 'treasury') {
                            setSettings({ ...settings, treasuryTemplate: e.target.value });
                        } else if (activeTab === 'pastor') {
                            setSettings({ ...settings, pastoralTemplate: e.target.value });
                        } else {
                            setSettings({ ...settings, closingTemplate: e.target.value });
                        }
                    }}
                    rows={8}
                    className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500/20"
                />

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="font-bold text-slate-700 dark:text-slate-200 block uppercase tracking-wider text-[10px]">
                        Variáveis Automáticas Substituídas no Momento do Envio:
                    </span>
                    <p>
                        <code className="text-emerald-600 font-bold">&#123;NOME&#125;</code> - Nome | <code className="text-emerald-600 font-bold">&#123;VALOR&#125;</code> - Valor | <code className="text-emerald-600 font-bold">&#123;DATA&#125;</code> - Data | <code className="text-emerald-600 font-bold">&#123;TIPO&#125;</code> - Tipo | <code className="text-emerald-600 font-bold">&#123;IGREJA&#125;</code> - Igreja | <code className="text-emerald-600 font-bold">&#123;PASTOR&#125;</code> - Pastor | <code className="text-emerald-600 font-bold">&#123;LINK_PORTAL&#125;</code> - Link do Portal do Contribuinte
                    </p>
                </div>
            </div>

        </div>
    );
};
