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
    BookOpen,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ListFilter,
    Mic,
    MicOff,
    Upload,
    Play,
    Pause,
    Square,
    Trash2,
    Volume2,
    Music,
    FileAudio,
    Shuffle,
    Search,
    Wand2
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import {
    PresetTemplate,
    TREASURY_PRESETS,
    PASTOR_PRESETS,
    CLOSING_PRESETS,
    getRandomNonRepeatingPreset,
    recordSentPreset,
    getSentPresetHistory
} from '../../utils/whatsappReceiptPresets';

export type { PresetTemplate };
export { TREASURY_PRESETS, PASTOR_PRESETS, CLOSING_PRESETS };

export interface WhatsAppReceiptItem {
    contributorName?: string;
    phone?: string;
    amount?: number;
    contributionType?: string;
    churchName?: string;
    date?: string;
    transactionId?: string;
}

export interface WhatsAppReceiptData extends WhatsAppReceiptItem {
    items?: WhatsAppReceiptItem[];
}

export interface WhatsAppReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: WhatsAppReceiptData;
}

export interface WhatsAppTemplateSettings {
    treasuryTemplate: string;
    pastoralTemplate: string;
    closingTemplate?: string;
    autoOpenOnReconcile: boolean;
    defaultSender: 'treasury' | 'pastor' | 'closing';
    pastorName?: string;
    customTemplatesList?: string[];
    treasuryAudioUrl?: string;
    pastoralAudioUrl?: string;
    includeAudioWithText?: boolean;
}

export const DEFAULT_TREASURY_TEMPLATE = 
`Olá, *{NOME}*! 🕊️

Confirmamos com alegria o recebimento da sua contribuição no valor de *{VALOR}* ({TIPO}) realizada em *{DATA}* para a *{IGREJA}*.

Seu apoio é fundamental para a manutenção da casa de Deus e o avanço do Reino!

_"Cada um dê conforme determinou em seu coração, não com desgosto ou por obrigação, pois Deus ama quem dá com alegria." (2 Coríntios 9:7)_

Que o Senhor recompense e multiplique suas colheitas!

Atenciosamente,
*{IGREJA}*`;

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

export const DEFAULT_DYNAMIC_MESSAGES: string[] = [
    DEFAULT_TREASURY_TEMPLATE,
    DEFAULT_PASTORAL_TEMPLATE,
    `Paz do Senhor, *{NOME}*! 🕊️\n\nConfirmamos com alegria o recebimento da sua contribuição no valor de *{VALOR}* ({TIPO}) realizada em *{DATA}* para a *{IGREJA}*.\n\nSua fidelidade é fundamental para o fortalecimento do Reino de Deus!\n\nQue o Senhor continue derramando bênçãos sem medida sobre a sua casa e a sua família.\n\nAtenciosamente,\n*{IGREJA}*`,
    `A Paz do Senhor, irmão(ã) *{NOME}*! 🙏\n\nRegistramos a sua contribuição abençoada no valor de *{VALOR}* ({TIPO}) referente a *{DATA}*.\n\nGrato a Deus pela sua vida e pela sua parceria na obra da *{IGREJA}*!\n\n_ "Honra ao Senhor com os teus bens e com as primeiras frutas de todos os teus rendimentos." (Provérbios 3:9)_\n\nEm oração por você,\n*Pr. {PASTOR}* - {IGREJA}`
];

const STORAGE_KEY = 'identificapix_whatsapp_receipt_settings_v1';
const SENT_TXS_STORAGE_KEY = 'identificapix_whatsapp_sent_transactions_v1';

export const getWhatsAppSentMap = (): Record<string, string> => {
    try {
        const saved = localStorage.getItem(SENT_TXS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.error('Erro ao ler mensagens enviadas:', e);
    }
    return {};
};

export const isWhatsAppSent = (txId?: string): boolean => {
    if (!txId) return false;
    const map = getWhatsAppSentMap();
    return !!map[txId];
};

export const markWhatsAppSent = (txId?: string) => {
    if (!txId) return;
    try {
        const map = getWhatsAppSentMap();
        map[txId] = new Date().toISOString();
        localStorage.setItem(SENT_TXS_STORAGE_KEY, JSON.stringify(map));
        window.dispatchEvent(new CustomEvent('whatsapp_sent_updated', { detail: { txId } }));
    } catch (e) {
        console.error('Erro ao marcar WhatsApp como enviado:', e);
    }
};

export const getStoredWhatsAppSettings = (): WhatsAppTemplateSettings => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (!parsed.closingTemplate) {
                parsed.closingTemplate = DEFAULT_CLOSING_TEMPLATE;
            }
            if (!parsed.customTemplatesList || !Array.isArray(parsed.customTemplatesList) || parsed.customTemplatesList.length === 0) {
                parsed.customTemplatesList = DEFAULT_DYNAMIC_MESSAGES;
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
        customTemplatesList: DEFAULT_DYNAMIC_MESSAGES,
        autoOpenOnReconcile: true,
        defaultSender: 'treasury',
        pastorName: 'Pastor Responsável',
        includeAudioWithText: true
    };
};

export const saveWhatsAppSettings = (settings: WhatsAppTemplateSettings) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent('whatsapp_settings_updated', { detail: settings }));
    } catch (e) {
        console.error('Erro ao salvar configurações de WhatsApp:', e);
    }
};

export const extractBaseName = (rawName?: string) => {
    if (!rawName) return '';
    return rawName
        .replace(/\s*-\s*\*\*\*.*$/i, '') // Remove CPF mask pattern like " - ***.945.171-**"
        .replace(/\s*-\s*\d{3}\..*$/i, '') // Remove CPF partial mask
        .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
};

export const resolveContributorPhone = (item: WhatsAppReceiptItem, contributors?: any[]): string => {
    if (item.phone && item.phone.trim()) return item.phone.trim();
    if (item.contributorName && contributors && contributors.length > 0) {
        const cleanTarget = extractBaseName(item.contributorName);
        if (cleanTarget) {
            const found = contributors.find((c: any) => {
                const cName = extractBaseName(c.name || c.canonical_name);
                if (!cName) return false;
                return cName === cleanTarget || cleanTarget.startsWith(cName) || cName.startsWith(cleanTarget);
            });
            if (found) {
                return found.phone || found.whatsapp || found.mobile || '';
            }
        }
    }
    return '';
};

export const buildFormattedWhatsAppMessage = (
    item: WhatsAppReceiptItem, 
    settings: WhatsAppTemplateSettings,
    churches?: any[]
): string => {
    const senderRole = settings.defaultSender || 'treasury';
    let rawTemplate = settings.treasuryTemplate || DEFAULT_TREASURY_TEMPLATE;
    if (senderRole === 'pastor') {
        rawTemplate = settings.pastoralTemplate || DEFAULT_PASTORAL_TEMPLATE;
    } else if (senderRole === 'closing') {
        rawTemplate = settings.closingTemplate || DEFAULT_CLOSING_TEMPLATE;
    }

    const resolvedChurchName = item.churchName || (churches && churches.length > 0 ? churches[0].name : 'Igreja');

    let formattedDate = new Date().toLocaleDateString('pt-BR');
    if (item.date) {
        try {
            const parts = item.date.split('-');
            if (parts.length === 3) {
                formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
                formattedDate = item.date;
            }
        } catch {
            formattedDate = item.date;
        }
    }

    const amountStr = formatCurrency(item.amount || 0);
    const typeStr = item.contributionType || 'Contribuição';
    const nameStr = item.contributorName || 'Irmão(ã)';
    const pastorName = settings.pastorName || 'Pastor Responsável';
    const portalUrl = `${window.location.origin}/portal/reports`;

    let formatted = rawTemplate
        .replaceAll('{NOME}', nameStr)
        .replaceAll('{VALOR}', amountStr)
        .replaceAll('{TIPO}', typeStr)
        .replaceAll('{IGREJA}', resolvedChurchName)
        .replaceAll('{DATA}', formattedDate)
        .replaceAll('{PASTOR}', pastorName)
        .replaceAll('{LINK_PORTAL}', portalUrl);

    if (settings.includeAudioWithText !== false) {
        if (senderRole === 'pastor' && settings.pastoralAudioUrl) {
            formatted += `\n\n🎙️ *[Áudio Pastoral do Pr. ${pastorName}]*\nClique para ouvir a mensagem em áudio:\n🔗 ${window.location.origin}/portal/audio-pastoral`;
        } else if (senderRole === 'treasury' && settings.treasuryAudioUrl) {
            formatted += `\n\n🎧 *[Áudio de Agradecimento da Tesouraria]*\nClique para ouvir a mensagem em áudio:\n🔗 ${window.location.origin}/portal/audio-tesouraria`;
        }
    }

    return formatted;
};

export const sendWhatsAppDirect = (
    item: WhatsAppReceiptItem,
    context: { contributors?: any[]; churches?: any[]; showToast?: (msg: string, type?: string) => void }
) => {
    const settings = getStoredWhatsAppSettings();
    const phone = resolveContributorPhone(item, context.contributors);
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const message = buildFormattedWhatsAppMessage(item, settings, context.churches);

    if (!message.trim()) {
        if (context.showToast) context.showToast('Mensagem vazia para envio.', 'error');
        return;
    }

    const encoded = encodeURIComponent(message.trim());
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let url = '';
    if (cleanPhone) {
        url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    } else {
        if (isMobile) {
            url = `https://api.whatsapp.com/send?text=${encoded}`;
        } else {
            url = `https://web.whatsapp.com/send?text=${encoded}`;
        }
    }

    window.open(url, '_blank');
    if (item.transactionId) {
        markWhatsAppSent(item.transactionId);
    }

    if (context.showToast) {
        const dest = item.contributorName?.split(' ')[0] || 'contribuinte';
        const roleLabel = settings.defaultSender === 'pastor' ? 'Pastor' : settings.defaultSender === 'closing' ? 'Extrato' : 'Tesouraria';
        context.showToast(`Redirecionando WhatsApp (${roleLabel}) para ${dest}...`, 'success');
    }
};

export const WhatsAppReceiptModal: React.FC<WhatsAppReceiptModalProps> = ({
    isOpen,
    onClose,
    data
}) => {
    const { contributors, churches, showToast } = useContext(AppContext);

    const isBatch = Array.isArray(data?.items) && data.items.length > 0;
    const batchItems: WhatsAppReceiptItem[] = useMemo(() => {
        if (isBatch && data.items) return data.items;
        if (data && (data.contributorName || data.amount)) return [data];
        return [{
            contributorName: 'FABIO PEREIRA MENDONÇA',
            amount: 50.00,
            contributionType: 'DÍZIMO',
            date: new Date().toISOString().split('T')[0],
            churchName: (churches && churches[0]?.name) || 'Igreja Sede'
        }];
    }, [isBatch, data, churches]);

    const [activeBatchIndex, setActiveBatchIndex] = useState<number>(0);

    useEffect(() => {
        setActiveBatchIndex(0);
    }, [data]);

    const currentItem = batchItems[activeBatchIndex] || batchItems[0];

    const [settings, setSettings] = useState<WhatsAppTemplateSettings>(getStoredWhatsAppSettings);
    
    const [treasuryTemplate, setTreasuryTemplate] = useState<string>(settings.treasuryTemplate || DEFAULT_TREASURY_TEMPLATE);
    const [pastoralTemplate, setPastoralTemplate] = useState<string>(settings.pastoralTemplate || DEFAULT_PASTORAL_TEMPLATE);
    const [closingTemplate, setClosingTemplate] = useState<string>(settings.closingTemplate || DEFAULT_CLOSING_TEMPLATE);
    const [activeSender, setActiveSender] = useState<'treasury' | 'pastor' | 'closing'>(settings.defaultSender || 'treasury');
    const [pastorName, setPastorName] = useState<string>(settings.pastorName || 'Pastor Responsável');
    const [treasuryAudioUrl, setTreasuryAudioUrl] = useState<string | undefined>(settings.treasuryAudioUrl);
    const [pastoralAudioUrl, setPastoralAudioUrl] = useState<string | undefined>(settings.pastoralAudioUrl);
    const [includeAudioWithText, setIncludeAudioWithText] = useState<boolean>(settings.includeAudioWithText !== false);

    // Audio recording state
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recordingTime, setRecordingTime] = useState<number>(0);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

    const [phoneInput, setPhoneInput] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);
    const [savedNotice, setSavedNotice] = useState<boolean>(false);

    // Preset compact navigation state
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const [presetSearch, setPresetSearch] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [presetPage, setPresetPage] = useState<number>(1);
    const ITEMS_PER_PAGE = 12;

    useEffect(() => {
        setPresetPage(1);
        setPresetSearch('');
        setSelectedCategory('all');
    }, [activeSender]);

    const currentRawPresets = useMemo(() => {
        return activeSender === 'pastor' ? PASTOR_PRESETS : activeSender === 'closing' ? CLOSING_PRESETS : TREASURY_PRESETS;
    }, [activeSender]);

    const categoriesList = useMemo(() => {
        const badgesSet = new Set<string>();
        currentRawPresets.forEach(p => badgesSet.add(p.badge));
        return ['all', ...Array.from(badgesSet)];
    }, [currentRawPresets]);

    const filteredPresets = useMemo(() => {
        return currentRawPresets.filter(preset => {
            const matchSearch = presetSearch.trim() === '' || 
                preset.title.toLowerCase().includes(presetSearch.toLowerCase()) || 
                preset.badge.toLowerCase().includes(presetSearch.toLowerCase()) ||
                preset.text.toLowerCase().includes(presetSearch.toLowerCase());
            const matchCat = selectedCategory === 'all' || preset.badge.toLowerCase() === selectedCategory.toLowerCase();
            return matchSearch && matchCat;
        });
    }, [currentRawPresets, presetSearch, selectedCategory]);

    const totalPresetPages = Math.ceil(filteredPresets.length / ITEMS_PER_PAGE) || 1;
    const paginatedPresets = useMemo(() => {
        const start = (presetPage - 1) * ITEMS_PER_PAGE;
        return filteredPresets.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredPresets, presetPage, ITEMS_PER_PAGE]);

    const handlePickRandomPreset = () => {
        const contributorId = currentItem.contributorName || currentItem.phone || 'default';
        const randomPreset = getRandomNonRepeatingPreset(activeSender, contributorId);
        if (randomPreset) {
            handleSelectPreset(randomPreset.text);
            setSelectedPresetId(randomPreset.id);
            recordSentPreset(contributorId, randomPreset.id);
            if (showToast) showToast(`Modelo "${randomPreset.title}" sorteado (sem repetir)!`, 'success');
        }
    };

    useEffect(() => {
        const fresh = getStoredWhatsAppSettings();
        setSettings(fresh);
        setTreasuryTemplate(fresh.treasuryTemplate || DEFAULT_TREASURY_TEMPLATE);
        setPastoralTemplate(fresh.pastoralTemplate || DEFAULT_PASTORAL_TEMPLATE);
        setClosingTemplate(fresh.closingTemplate || DEFAULT_CLOSING_TEMPLATE);
        setActiveSender(fresh.defaultSender || 'treasury');
        setPastorName(fresh.pastorName || 'Pastor Responsável');
        setTreasuryAudioUrl(fresh.treasuryAudioUrl);
        setPastoralAudioUrl(fresh.pastoralAudioUrl);
        setIncludeAudioWithText(fresh.includeAudioWithText !== false);
    }, [isOpen]);

    // Recording timer
    useEffect(() => {
        let timer: any;
        if (isRecording) {
            timer = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            setRecordingTime(0);
        }
        return () => clearInterval(timer);
    }, [isRecording]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64Audio = reader.result as string;
                    if (activeSender === 'pastor') {
                        setPastoralAudioUrl(base64Audio);
                    } else {
                        setTreasuryAudioUrl(base64Audio);
                    }
                    if (showToast) showToast('Áudio gravado com sucesso!', 'success');
                };
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (err) {
            console.error('Erro ao acessar microfone:', err);
            if (showToast) showToast('Não foi possível acessar o microfone. Verifique as permissões.', 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            setMediaRecorder(null);
        }
    };

    const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            if (showToast) showToast('O arquivo de áudio deve ter menos de 10MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const base64Audio = reader.result as string;
            if (activeSender === 'pastor') {
                setPastoralAudioUrl(base64Audio);
            } else {
                setTreasuryAudioUrl(base64Audio);
            }
            if (showToast) showToast('Áudio carregado com sucesso!', 'success');
        };
    };

    const handleRemoveAudio = () => {
        if (activeSender === 'pastor') {
            setPastoralAudioUrl(undefined);
        } else {
            setTreasuryAudioUrl(undefined);
        }
        if (showToast) showToast('Áudio removido.', 'info');
    };

    // Resolve Phone
    useEffect(() => {
        const p = resolveContributorPhone(currentItem, contributors);
        setPhoneInput(p);
    }, [currentItem, contributors]);

    // Resolved Church Name
    const resolvedChurchName = useMemo(() => {
        if (currentItem.churchName) return currentItem.churchName;
        if (churches && churches.length > 0) {
            return churches[0].name || 'Igreja';
        }
        return 'Igreja';
    }, [currentItem.churchName, churches]);

    // Formatted date fallback
    const formattedDate = useMemo(() => {
        if (currentItem.date) {
            try {
                const parts = currentItem.date.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
            } catch (e) {
                // fallthrough
            }
            return currentItem.date;
        }
        return new Date().toLocaleDateString('pt-BR');
    }, [currentItem.date]);

    // Get raw template for active sender
    const currentRawTemplate = useMemo(() => {
        if (activeSender === 'pastor') return pastoralTemplate;
        if (activeSender === 'closing') return closingTemplate;
        return treasuryTemplate;
    }, [activeSender, treasuryTemplate, pastoralTemplate, closingTemplate]);

    // Formatted message text
    const messageContent = useMemo(() => {
        const amountStr = formatCurrency(currentItem.amount || 0);
        const typeStr = currentItem.contributionType || 'Contribuição';
        const nameStr = currentItem.contributorName || 'Irmão(ã)';
        const portalUrl = `${window.location.origin}/portal/reports`;

        let text = currentRawTemplate
            .replaceAll('{NOME}', nameStr)
            .replaceAll('{VALOR}', amountStr)
            .replaceAll('{DATA}', formattedDate)
            .replaceAll('{TIPO}', typeStr)
            .replaceAll('{IGREJA}', resolvedChurchName)
            .replaceAll('{PASTOR}', pastorName)
            .replaceAll('{LINK_PORTAL}', portalUrl);

        if (includeAudioWithText) {
            if (activeSender === 'pastor' && pastoralAudioUrl) {
                text += `\n\n🎙️ *[Áudio Pastoral do Pr. ${pastorName}]*\nClique para ouvir a mensagem em áudio:\n🔗 ${window.location.origin}/portal/audio-pastoral`;
            } else if (activeSender === 'treasury' && treasuryAudioUrl) {
                text += `\n\n🎧 *[Áudio de Agradecimento da Tesouraria]*\nClique para ouvir a mensagem em áudio:\n🔗 ${window.location.origin}/portal/audio-tesouraria`;
            }
        }

        return text;
    }, [currentRawTemplate, currentItem, formattedDate, resolvedChurchName, pastorName, activeSender, includeAudioWithText, pastoralAudioUrl, treasuryAudioUrl]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleTextareaChange = (val: string) => {
        if (activeSender === 'pastor') setPastoralTemplate(val);
        else if (activeSender === 'closing') setClosingTemplate(val);
        else setTreasuryTemplate(val);
    };

    const handleSelectPreset = (presetText: string) => {
        if (activeSender === 'pastor') setPastoralTemplate(presetText);
        else if (activeSender === 'closing') setClosingTemplate(presetText);
        else setTreasuryTemplate(presetText);
        if (showToast) showToast('Modelo predefinido aplicado com sucesso!', 'success');
    };

    const handleSaveAllSettings = () => {
        const updated: WhatsAppTemplateSettings = {
            ...settings,
            treasuryTemplate,
            pastoralTemplate,
            closingTemplate,
            defaultSender: activeSender,
            pastorName,
            treasuryAudioUrl,
            pastoralAudioUrl,
            includeAudioWithText
        };
        setSettings(updated);
        saveWhatsAppSettings(updated);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);

        const roleLabel = activeSender === 'pastor' ? 'Pastor / Bênção' : activeSender === 'closing' ? 'Extrato Portal' : 'Tesouraria';
        if (showToast) showToast(`Configurações salvas! Modelo ativo para envio direto: ${roleLabel}`, 'success');
        onClose();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(messageContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (showToast) showToast('Mensagem copiada para a área de transferência!', 'success');
    };

    const handleRestoreDefault = () => {
        if (activeSender === 'pastor') setPastoralTemplate(DEFAULT_PASTORAL_TEMPLATE);
        else if (activeSender === 'closing') setClosingTemplate(DEFAULT_CLOSING_TEMPLATE);
        else setTreasuryTemplate(DEFAULT_TREASURY_TEMPLATE);
    };

    const handleTestSend = () => {
        sendWhatsAppDirect({
            ...currentItem,
            phone: phoneInput || currentItem.phone
        }, { contributors, churches, showToast });
        if (isBatch && activeBatchIndex + 1 < batchItems.length) {
            setActiveBatchIndex(prev => prev + 1);
        }
    };

    const cleanPhone = phoneInput ? phoneInput.replace(/\D/g, '') : '';

    return (
        <div className="absolute inset-0 z-40 bg-white dark:bg-slate-900 flex flex-col overflow-hidden animate-scale-in">
            
            {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                Configuração de Modelos WhatsApp
                            </h3>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Personalização de mensagens, remetente ativo e disparo direto
                            </p>
                        </div>
                    </div>

                    {/* Model switcher */}
                    <div
                        className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700 flex items-center gap-1 overflow-x-auto max-w-full"
                        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
                    >
                        <button
                            type="button"
                            onClick={() => setActiveSender('treasury')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                activeSender === 'treasury'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${activeSender === 'treasury' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                            <span>1. Tesouraria</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveSender('pastor')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                activeSender === 'pastor'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${activeSender === 'pastor' ? 'bg-white' : 'bg-amber-500'}`}></span>
                            <span>2. Pastor / Bênção</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveSender('closing')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                activeSender === 'closing'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${activeSender === 'closing' ? 'bg-white' : 'bg-orange-500'}`}></span>
                            <span>3. Extrato Portal</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">Esc</span>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Body filling workspace area */}
                <div
                    className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1 w-full max-w-7xl mx-auto"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                    
                    {/* Contributor & Transaction Summary Card */}
                    <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/90 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs shadow-xs">
                        <div>
                            <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block mb-1">Exemplo Contribuinte</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate block uppercase">
                                {currentItem.contributorName || 'FABIO PEREIRA MENDONÇA'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block mb-1">Valor & Tipo</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 block uppercase tabular-nums">
                                {formatCurrency(currentItem.amount || 50)} ({currentItem.contributionType || 'DÍZIMO'})
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block mb-1">Data & Igreja</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 block truncate uppercase tabular-nums">
                                {formattedDate} • {resolvedChurchName}
                            </span>
                        </div>
                    </div>

                    {/* Pastor Name Input if pastor profile selected */}
                    {activeSender === 'pastor' && (
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Nome do Pastor (substitui &#123;PASTOR&#125;)
                            </label>
                            <input
                                type="text"
                                value={pastorName}
                                onChange={(e) => setPastorName(e.target.value)}
                                placeholder="Ex: Pr. João Silva"
                                className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 py-2 px-3 transition-colors outline-none text-xs font-medium"
                            />
                        </div>
                    )}

                    {/* Presets List Section - Ultra Compact Button Bar */}
                    <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                                    Modelos Cadastrados ({activeSender === 'pastor' ? 'Pastor' : activeSender === 'closing' ? 'Extrato' : 'Tesouraria'})
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 tabular-nums">
                                    {filteredPresets.length} modelos
                                </span>
                            </div>

                            {/* Random / Non-repeating Picker Button */}
                            <button
                                type="button"
                                onClick={handlePickRandomPreset}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
                                title="Sorteia uma mensagem que ainda não foi enviada para este contribuinte"
                            >
                                <Shuffle className="w-3.5 h-3.5" />
                                <span>Sortear sem Repetir</span>
                            </button>
                        </div>

                        {/* Search & Category Filter Row */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            {/* Search input */}
                            <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={presetSearch}
                                    onChange={(e) => {
                                        setPresetSearch(e.target.value);
                                        setPresetPage(1);
                                    }}
                                    placeholder="Buscar por número ou tema (ex: #05, Oração, Salmo)..."
                                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                                />
                                {presetSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setPresetSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {/* Category Filter Buttons */}
                            <div
                                className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0"
                                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
                            >
                                {categoriesList.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => {
                                            setSelectedCategory(cat);
                                            setPresetPage(1);
                                        }}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                                            selectedCategory === cat
                                                ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                        }`}
                                    >
                                        {cat === 'all' ? 'Todos' : cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Compact Preset Buttons Grid */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {paginatedPresets.length > 0 ? (
                                paginatedPresets.map((preset) => {
                                    const isSelected = selectedPresetId === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedPresetId(preset.id);
                                                handleSelectPreset(preset.text);
                                            }}
                                            title={`Clique para carregar "${preset.title}" no editor abaixo`}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                                                isSelected
                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                                            }`}
                                        >
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                                                isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                            }`}>
                                                {preset.badge}
                                            </span>
                                            <span className="truncate max-w-[150px]">{preset.title}</span>
                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0 ml-0.5" />}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="text-center py-4 w-full text-xs text-slate-400">
                                    Nenhum modelo encontrado para esta busca.
                                </div>
                            )}
                        </div>

                        {/* Pagination Footer */}
                        {totalPresetPages > 1 && (
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/70 dark:border-slate-800 tabular-nums">
                                <span>Página <b>{presetPage}</b> de <b>{totalPresetPages}</b></span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={presetPage === 1}
                                        onClick={() => setPresetPage(p => Math.max(1, p - 1))}
                                        className="p-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        <span>Anterior</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={presetPage >= totalPresetPages}
                                        onClick={() => setPresetPage(p => Math.min(totalPresetPages, p + 1))}
                                        className="p-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
                                    >
                                        <span>Próxima</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Audio Recording & Audio Attachment Section */}
                    <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-4 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/50 flex items-center justify-center shrink-0">
                                    <FileAudio className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-2 flex-wrap">
                                        <span>Áudio de Bênção / Agradecimento</span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50">
                                            {activeSender === 'pastor' ? 'ÁUDIO DO PASTOR' : 'ÁUDIO DA TESOURARIA'}
                                        </span>
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Grave ou carregue uma mensagem de áudio em voz para o contribuinte ouvir no recebimento.
                                    </p>
                                </div>
                            </div>

                            {/* Audio Include Checkbox */}
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 shrink-0 shadow-xs">
                                <input
                                    type="checkbox"
                                    checked={includeAudioWithText}
                                    onChange={(e) => setIncludeAudioWithText(e.target.checked)}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span>Anexar opção de áudio no texto</span>
                            </label>
                        </div>

                        {/* Active Audio Player if recorded/uploaded */}
                        {(activeSender === 'pastor' ? pastoralAudioUrl : treasuryAudioUrl) ? (
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                        <Volume2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                                            {activeSender === 'pastor' ? 'Áudio Pastoral Gravado' : 'Áudio da Tesouraria Gravado'}
                                        </span>
                                        <audio
                                            src={activeSender === 'pastor' ? pastoralAudioUrl : treasuryAudioUrl}
                                            controls
                                            className="w-full mt-1.5 h-8 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleRemoveAudio}
                                    className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-rose-200/70 dark:border-rose-800/50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remover</span>
                                </button>
                            </div>
                        ) : (
                            /* Recording & Uploading Action Controls */
                            <div className="flex flex-wrap items-center gap-2.5">
                                {isRecording ? (
                                    <button
                                        type="button"
                                        onClick={stopRecording}
                                        className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer tabular-nums"
                                    >
                                        <Square className="w-3.5 h-3.5 fill-white" />
                                        <span>Parar Gravação ({recordingTime}s)</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={startRecording}
                                        className="px-4 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                                    >
                                        <Mic className="w-4 h-4 text-rose-500" />
                                        <span>Gravar Voz ({activeSender === 'pastor' ? 'Pastor' : 'Tesouraria'})</span>
                                    </button>
                                )}

                                <label className="px-4 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs">
                                    <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span>Carregar Arquivo Áudio</span>
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleAudioFileUpload}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Live Editor */}
                    <div className="space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Texto do Modelo selecionado ({activeSender === 'pastor' ? 'PASTOR' : activeSender === 'closing' ? 'EXTRATO PORTAL' : 'TESOURARIA'})
                            </label>

                            <button
                                type="button"
                                onClick={handleRestoreDefault}
                                className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                            >
                                Restaurar Padrão deste Modelo
                            </button>
                        </div>

                        <textarea
                            value={currentRawTemplate}
                            onChange={(e) => handleTextareaChange(e.target.value)}
                            rows={6}
                            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 p-3.5 transition-colors outline-none text-xs font-mono leading-relaxed"
                        />

                        {/* Variables legend */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span>Tags suportadas:</span>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-mono text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">&#123;NOME&#125;</span>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-mono text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">&#123;VALOR&#125;</span>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-mono text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">&#123;DATA&#125;</span>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-mono text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">&#123;TIPO&#125;</span>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-mono text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">&#123;IGREJA&#125;</span>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-mono text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">&#123;PASTOR&#125;</span>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-mono text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">&#123;LINK_PORTAL&#125;</span>
                        </div>
                    </div>

                    {/* WhatsApp Visual Chat Bubble Preview — authentic WhatsApp surface colors preserved */}
                    <div className="p-5 bg-[#E5DDD5] dark:bg-[#0B141A] rounded-xl border border-slate-300/80 dark:border-slate-800 shadow-inner space-y-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                            Prévia Visual do Envio WhatsApp
                        </span>

                        <div className="max-w-[85%] ml-auto bg-[#DCF8C6] dark:bg-[#005C4B] text-slate-900 dark:text-slate-100 p-4 rounded-2xl rounded-tr-none shadow-md text-xs whitespace-pre-wrap leading-relaxed font-sans relative border border-emerald-200/50 dark:border-emerald-700/50 space-y-3">
                            <div>{messageContent}</div>

                            {/* Audio Card inside Preview if active audio available */}
                            {(activeSender === 'pastor' ? pastoralAudioUrl : treasuryAudioUrl) && (
                                <div className="p-3 bg-white/40 dark:bg-black/20 rounded-xl border border-black/5 flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-emerald-600 text-white shadow-xs shrink-0">
                                        <Play className="w-4 h-4 fill-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide">
                                            <span>{activeSender === 'pastor' ? `Áudio: Pr. ${pastorName}` : 'Áudio: Tesouraria'}</span>
                                            <span className="text-[9px] text-slate-500 dark:text-slate-300 tabular-nums">0:45</span>
                                        </div>
                                        <div className="w-full bg-slate-300 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                            <div className="bg-emerald-600 h-full w-1/3 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="text-[10px] text-slate-500 dark:text-slate-300 text-right flex items-center justify-end gap-1 tabular-nums">
                                <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-300" />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50/70 dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                            <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleTestSend}
                            className="px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="Disparar envio de teste direto no WhatsApp"
                        >
                            <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Testar Disparo</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveAllSettings}
                            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                        >
                            <Save className="w-4 h-4" />
                            <span>{savedNotice ? 'Salvo!' : 'Salvar Configurações'}</span>
                            {!savedNotice && <span className="ml-1 text-[10px] opacity-80 bg-white/20 px-1.5 py-0.5 rounded">Enter</span>}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

