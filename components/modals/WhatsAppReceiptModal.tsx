import React, { useState, useEffect, useMemo, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { XMarkIcon } from '../Icons';
import { 
    MessageCircle, 
    Send, 
    Copy, 
    Check, 
    Save, 
    User, 
    Landmark, 
    HeartHandshake, 
    Sparkles, 
    Phone, 
    Calendar, 
    DollarSign,
    BookOpen
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export interface WhatsAppReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        contributorName: string;
        phone?: string;
        amount: number;
        contributionType?: string;
        churchName?: string;
        date?: string;
        transactionId?: string;
    };
}

export interface WhatsAppTemplateSettings {
    treasuryTemplate: string;
    pastoralTemplate: string;
    closingTemplate?: string;
    autoOpenOnReconcile: boolean;
    defaultSender: 'treasury' | 'pastor' | 'closing';
    pastorName?: string;
}

export const DEFAULT_TREASURY_TEMPLATE = 
`Olá, *{NOME}*! 🕊️

Confirmamos com alegria o recebimento da sua contribuição no valor de *{VALOR}* ({TIPO}) realizada em *{DATA}* para a *{IGREJA}*.

Seu apoio é fundamental para a manutenção da casa de Deus e o avanço do Reino!

_"Cada um dê conforme determinou em seu coração, não com desgosto ou por obrigação, pois Deus ama quem dá com alegria." (2 Coríntios 9:7)_

Que o Senhor recompense e multiplique suas colheitas!

Atenciosamente,
*Tesouraria - {IGREJA}*`;

export const DEFAULT_PASTORAL_TEMPLATE = 
`A Paz do Senhor, irmão(ã) *{NOME}*! 🙏✨

Passando para deixar uma palavra de carinho, gratidão e oração pela sua fidelidade na *{IGREJA}*.

Sua contribuição de *{VALOR}* ({TIPO}) em *{DATA}* é uma semente abençoada.

*Oração da Semana:*
_"Senhor Deus, abençoe rica e abundantemente a vida do(a) {NOME}. Derrama das janelas dos céus sobre o seu lar, suprindo cada necessidade com saúde, paz e prosperidade. Em nome de Jesus, Amém!"_

Com carinho pastoral,
*Pr. {PASTOR}* - {IGREJA}`;

export const DEFAULT_CLOSING_TEMPLATE = 
`A Paz do Senhor, *{NOME}*! 🙏✨

O relatório financeiro do mês da *{IGREJA}* foi encerrado com a bênção de Deus. Sua fidelidade e apoio são pedras fundamentais para o crescimento da obra do Reino!

📊 Acesse seu *Extrato de Fidelidade & Transparência do Reino* exclusivo no nosso Portal do Contribuinte:
🔗 {LINK_PORTAL}

_"Cada um contribua segundo propôs no seu coração; não com tristeza, ou por necessidade; porque Deus ama ao que dá com alegria." (2 Coríntios 9:7)_

Que o Senhor recompense e multiplique a sua semente!
*Tesouraria & Pastores - {IGREJA}*`;

const STORAGE_KEY = 'identificapix_whatsapp_receipt_settings_v1';

export const getStoredWhatsAppSettings = (): WhatsAppTemplateSettings => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (!parsed.closingTemplate) {
                parsed.closingTemplate = DEFAULT_CLOSING_TEMPLATE;
            }
            return parsed;
        }
    } catch (e) {
        console.error('Erro ao ler configurações de WhatsApp:', e);
    }
    return {
        treasuryTemplate: DEFAULT_TREASURY_TEMPLATE,
        pastoralTemplate: DEFAULT_PASTORAL_TEMPLATE,
        closingTemplate: DEFAULT_CLOSING_TEMPLATE,
        autoOpenOnReconcile: true,
        defaultSender: 'treasury',
        pastorName: 'Pastor Responsável'
    };
};

export const saveWhatsAppSettings = (settings: WhatsAppTemplateSettings) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Erro ao salvar configurações de WhatsApp:', e);
    }
};

export const WhatsAppReceiptModal: React.FC<WhatsAppReceiptModalProps> = ({
    isOpen,
    onClose,
    data
}) => {
    const { contributors, churches, showToast } = useContext(AppContext);

    const [settings, setSettings] = useState<WhatsAppTemplateSettings>(getStoredWhatsAppSettings);
    const [senderRole, setSenderRole] = useState<'treasury' | 'pastor' | 'closing'>(settings.defaultSender || 'treasury');
    
    // Contributor phone state
    const [phoneInput, setPhoneInput] = useState<string>(data.phone || '');
    const [pastorName, setPastorName] = useState<string>(settings.pastorName || 'Pastor Responsável');

    // Message Content state
    const [messageContent, setMessageContent] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);
    const [savedNotice, setSavedNotice] = useState<boolean>(false);

    // Try to auto-resolve phone number from contributors list if missing
    useEffect(() => {
        if (!phoneInput && data.contributorName && contributors && contributors.length > 0) {
            const cleanTarget = data.contributorName.trim().toUpperCase();
            const found = contributors.find((c: any) => 
                (c.name && c.name.trim().toUpperCase() === cleanTarget) ||
                (c.canonical_name && c.canonical_name.trim().toUpperCase() === cleanTarget)
            );
            if (found) {
                const p = found.phone || found.whatsapp || found.mobile || '';
                if (p) setPhoneInput(p);
            }
        }
    }, [data.contributorName, contributors, phoneInput]);

    // Church name fallback
    const resolvedChurchName = useMemo(() => {
        if (data.churchName) return data.churchName;
        if (churches && churches.length > 0) {
            return churches[0].name || 'Igreja';
        }
        return 'Igreja';
    }, [data.churchName, churches]);

    // Formatted date fallback
    const formattedDate = useMemo(() => {
        if (data.date) {
            try {
                const parts = data.date.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
            } catch (e) {
                // fallthrough
            }
            return data.date;
        }
        return new Date().toLocaleDateString('pt-BR');
    }, [data.date]);

    // Helper to replace template variables
    const buildFormattedMessage = (rawTemplate: string) => {
        const amountStr = formatCurrency(data.amount || 0);
        const typeStr = data.contributionType || 'Contribuição';
        const nameStr = data.contributorName || 'Irmão(ã)';
        const portalUrl = `${window.location.origin}/portal/reports`;

        return rawTemplate
            .replaceAll('{NOME}', nameStr)
            .replaceAll('{VALOR}', amountStr)
            .replaceAll('{DATA}', formattedDate)
            .replaceAll('{TIPO}', typeStr)
            .replaceAll('{IGREJA}', resolvedChurchName)
            .replaceAll('{PASTOR}', pastorName)
            .replaceAll('{LINK_PORTAL}', portalUrl);
    };

    // Load initial message content whenever senderRole or data changes
    useEffect(() => {
        let raw = settings.treasuryTemplate;
        if (senderRole === 'pastor') {
            raw = settings.pastoralTemplate;
        } else if (senderRole === 'closing') {
            raw = settings.closingTemplate || DEFAULT_CLOSING_TEMPLATE;
        }
        setMessageContent(buildFormattedMessage(raw));
    }, [senderRole, data, settings, resolvedChurchName, pastorName]);

    if (!isOpen) return null;

    // Clean phone number for WhatsApp link
    const getCleanPhone = (phoneRaw: string) => {
        let digits = phoneRaw.replace(/\D/g, '');
        if (!digits) return '';
        // If 10 or 11 digits without country code, add Brazilian prefix 55
        if (digits.length === 10 || digits.length === 11) {
            digits = `55${digits}`;
        }
        return digits;
    };

    const cleanPhone = getCleanPhone(phoneInput);

    const handleSendWhatsApp = () => {
        if (!messageContent.trim()) return;

        const encoded = encodeURIComponent(messageContent.trim());
        let url = '';
        if (cleanPhone) {
            url = `https://wa.me/${cleanPhone}?text=${encoded}`;
        } else {
            url = `https://api.whatsapp.com/send?text=${encoded}`;
        }

        window.open(url, '_blank');
        if (showToast) showToast('Redirecionando para o WhatsApp...', 'success');
        onClose();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(messageContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (showToast) showToast('Mensagem copiada para a área de transferência!', 'success');
    };

    const handleSaveAsDefault = () => {
        const updated = { ...settings, pastorName };
        if (senderRole === 'treasury') {
            updated.treasuryTemplate = messageContent;
        } else {
            updated.pastoralTemplate = messageContent;
        }
        setSettings(updated);
        saveWhatsAppSettings(updated);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
        if (showToast) showToast('Modelo padrão de mensagem atualizado com sucesso!', 'success');
    };

    const handleRestoreDefault = () => {
        const defaultRaw = senderRole === 'treasury' ? DEFAULT_TREASURY_TEMPLATE : DEFAULT_PASTORAL_TEMPLATE;
        setMessageContent(buildFormattedMessage(defaultRaw));
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-scale-in">
                
                {/* Header */}
                <div className="px-6 py-4 bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md text-white">
                            <MessageCircle className="w-5 h-5 fill-white/20" />
                        </div>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-tight">
                                Comprovante & Mensagem via WhatsApp
                            </h3>
                            <p className="text-[10px] font-medium text-emerald-100 opacity-90 uppercase tracking-widest">
                                Envio de Confirmação e Bênção Pastoral
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                    
                    {/* Contributor & Transaction Summary Card */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Contribuinte</span>
                            <span className="font-extrabold text-slate-800 dark:text-white truncate block">
                                {data.contributorName || 'Não especificado'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Valor & Tipo</span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block">
                                {formatCurrency(data.amount || 0)} ({data.contributionType || 'Dízimo/Oferta'})
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Data & Igreja</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300 block truncate">
                                {formattedDate} • {resolvedChurchName}
                            </span>
                        </div>
                    </div>

                    {/* Sender Profile Selector (Tesouraria vs Pastor vs Fechamento) */}
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Perfil do Remetente & Tipo de Mensagem
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setSenderRole('treasury')}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                    senderRole === 'treasury'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm font-black'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 font-bold'
                                }`}
                            >
                                <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-xs uppercase tracking-wide">1. Tesouraria</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSenderRole('pastor')}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                    senderRole === 'pastor'
                                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-800 dark:text-amber-300 shadow-sm font-black'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 font-bold'
                                }`}
                            >
                                <HeartHandshake className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="text-xs uppercase tracking-wide">2. Pastor / Bênção</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSenderRole('closing')}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                    senderRole === 'closing'
                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-800 dark:text-blue-300 shadow-sm font-black'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 font-bold'
                                }`}
                            >
                                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="text-xs uppercase tracking-wide">3. Extrato Portal</span>
                            </button>
                        </div>
                    </div>

                    {/* Phone Number Input & Pastor Name Input */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                WhatsApp do Contribuinte
                            </label>
                            <div className="relative">
                                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={phoneInput}
                                    onChange={(e) => setPhoneInput(e.target.value)}
                                    placeholder="Ex: (11) 99999-9999"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                                {cleanPhone ? `Destino formatado: +${cleanPhone}` : 'Sem número (será aberto seletor de contatos no WhatsApp)'}
                            </span>
                        </div>

                        {senderRole === 'pastor' && (
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                    Nome do Pastor / Assinatura
                                </label>
                                <input
                                    type="text"
                                    value={pastorName}
                                    onChange={(e) => setPastorName(e.target.value)}
                                    placeholder="Ex: Pr. João Silva"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20"
                                />
                            </div>
                        )}
                    </div>

                    {/* Live Editor & WhatsApp Chat Bubble Preview */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Conteúdo da Mensagem (Editável)
                            </label>
                            <button
                                type="button"
                                onClick={handleRestoreDefault}
                                className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                            >
                                Recompor Modelo Padrão
                            </button>
                        </div>

                        <textarea
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                            rows={6}
                            className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />

                        {/* Variables legend */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-slate-400">
                            <span>Tags suportadas:</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-600 dark:text-slate-300">&#123;NOME&#125;</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-600 dark:text-slate-300">&#123;VALOR&#125;</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-600 dark:text-slate-300">&#123;DATA&#125;</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-600 dark:text-slate-300">&#123;TIPO&#125;</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-600 dark:text-slate-300">&#123;IGREJA&#125;</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-600 dark:text-slate-300">&#123;PASTOR&#125;</span>
                        </div>
                    </div>

                    {/* WhatsApp Visual Chat Bubble Preview */}
                    <div className="p-4 bg-[#E5DDD5] dark:bg-[#0B141A] rounded-2xl border border-slate-300 dark:border-slate-800">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                            Prévia Visual no WhatsApp
                        </span>
                        <div className="max-w-[88%] ml-auto bg-[#DCF8C6] dark:bg-[#005C4B] text-slate-900 dark:text-slate-100 p-3.5 rounded-2xl rounded-tr-none shadow-md text-xs whitespace-pre-wrap leading-relaxed font-sans relative border border-emerald-200/50 dark:border-emerald-700/50">
                            {messageContent}
                            <div className="mt-2 text-[9px] text-slate-500 dark:text-slate-300 text-right flex items-center justify-end gap-1">
                                <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-300" />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={handleSaveAsDefault}
                            className="flex-1 sm:flex-none px-4 py-2.5 text-[10px] font-extrabold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Save className="w-3.5 h-3.5 text-slate-500" />
                            <span>{savedNotice ? 'Salvo!' : 'Salvar Modelo'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCopy}
                            className="flex-1 sm:flex-none px-4 py-2.5 text-[10px] font-extrabold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                            <span>{copied ? 'Copiado' : 'Copiar'}</span>
                        </button>
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 uppercase tracking-wider cursor-pointer"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleSendWhatsApp}
                            className="w-full sm:w-auto px-6 py-2.5 text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Send className="w-4 h-4" />
                            <span>Enviar via WhatsApp</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
