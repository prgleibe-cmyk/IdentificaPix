import React, { useState, useEffect, useMemo } from 'react';
import { PortalChurch, ContributorMockProfile, ContributionPledge } from '../types/portal';
import { PortalContainer } from '../components/PortalContainer';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { formatCurrencyBrl } from '../utils/portalFormatters';
import { 
    BookmarkPlus, 
    Bell, 
    Calendar, 
    CheckCircle2, 
    Clock, 
    QrCode, 
    UserCheck, 
    PlusCircle, 
    DollarSign, 
    X,
    Copy,
    Check,
    Smartphone,
    Mail,
    MessageSquare,
    Trash2,
    Edit3,
    Sparkles,
    CalendarCheck,
    Target,
    Layers,
    AlertCircle
} from 'lucide-react';

interface PortalPledgesPageProps {
    church?: PortalChurch | null;
    onNavigate: (route: string) => void;
}

const DEFAULT_PLEDGE_TEMPLATES: Omit<ContributionPledge, 'id' | 'created_at'>[] = [
    {
        title: 'Carnê Reforma e Construção',
        category: 'Construção',
        type: 'carne',
        amountPerInstallment: 100,
        totalInstallments: 12,
        dueDay: 10,
        frequency: 'mensal',
        startDate: new Date().toISOString().split('T')[0],
        reminderDaysBefore: 3,
        reminderChannel: 'whatsapp',
        status: 'active',
        paidInstallments: 1
    },
    {
        title: 'Lembrete Dízimo Fiel Mensal',
        category: 'Dízimo',
        type: 'recorrente',
        amountPerInstallment: 250,
        totalInstallments: 0, // Recorrente sem fim fixo
        dueDay: 5,
        frequency: 'mensal',
        startDate: new Date().toISOString().split('T')[0],
        reminderDaysBefore: 1,
        reminderChannel: 'whatsapp',
        status: 'active',
        paidInstallments: 3
    },
    {
        title: 'Propósito Oferta de Missões',
        category: 'Missões',
        type: 'proposito',
        amountPerInstallment: 50,
        totalInstallments: 6,
        dueDay: 15,
        frequency: 'mensal',
        startDate: new Date().toISOString().split('T')[0],
        reminderDaysBefore: 5,
        reminderChannel: 'todos',
        status: 'active',
        paidInstallments: 0
    }
];

export const PortalPledgesPage: React.FC<PortalPledgesPageProps> = ({ church, onNavigate }) => {
    const [contributor, setContributor] = useState<ContributorMockProfile | null>(null);
    const [pledges, setPledges] = useState<ContributionPledge[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    
    // Modal states
    const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
    const [editingPledge, setEditingPledge] = useState<ContributionPledge | null>(null);
    const [selectedPixPledge, setSelectedPixPledge] = useState<ContributionPledge | null>(null);
    const [copiedPix, setCopiedPix] = useState<boolean>(false);

    // Swipe to dismiss states
    const [formSwipeY, setFormSwipeY] = useState<number>(0);
    const [isFormSwiping, setIsFormSwiping] = useState<boolean>(false);
    const formSwipeStartRef = React.useRef<number>(0);

    // Global listeners for form panel swipe
    useEffect(() => {
        if (!isFormSwiping) return;
        const onMove = (e: TouchEvent | MouseEvent) => {
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const diff = clientY - formSwipeStartRef.current;
            if (diff > 0) setFormSwipeY(diff);
        };
        const onEnd = () => {
            setIsFormSwiping(false);
            setFormSwipeY((prev) => {
                if (prev > 90) setIsFormOpen(false);
                return 0;
            });
        };
        window.addEventListener('touchmove', onMove);
        window.addEventListener('touchend', onEnd);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        return () => {
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
        };
    }, [isFormSwiping]);

    // Form fields
    const [formTitle, setFormTitle] = useState<string>('');
    const [formCategory, setFormCategory] = useState<string>('Construção');
    const [formType, setFormType] = useState<'carne' | 'proposito' | 'recorrente'>('carne');
    const [formAmount, setFormAmount] = useState<string>('100');
    const [formInstallments, setFormInstallments] = useState<string>('12');
    const [formDueDay, setFormDueDay] = useState<string>('10');
    const [formFrequency, setFormFrequency] = useState<'mensal' | 'quinzenal' | 'semanal' | 'unica'>('mensal');
    const [formReminderDays, setFormReminderDays] = useState<string>('3');
    const [formReminderChannel, setFormReminderChannel] = useState<'whatsapp' | 'email' | 'sms' | 'todos'>('whatsapp');

    // Load contributor from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem('iggestor_portal_contributor');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.id || parsed.name)) {
                    setContributor(parsed);
                }
            }
        } catch (_) {}
    }, []);

    // Load saved pledges from localStorage
    const loadPledges = () => {
        setIsLoading(true);
        try {
            const raw = localStorage.getItem('iggestor_portal_pledges');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setPledges(parsed);
                    setIsLoading(false);
                    return;
                }
            }
            setPledges([]);
        } catch (err) {
            console.error('[PortalPledgesPage] Erro ao carregar carnês e propósitos:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPledges();
    }, [church?.id, contributor?.id]);

    const savePledgesList = (newList: ContributionPledge[]) => {
        setPledges(newList);
        try {
            localStorage.setItem('iggestor_portal_pledges', JSON.stringify(newList));
        } catch (err) {
            console.error('[PortalPledgesPage] Erro ao salvar lista:', err);
        }
    };

    const handleOpenForm = (pledge?: ContributionPledge) => {
        if (pledge) {
            setEditingPledge(pledge);
            setFormTitle(pledge.title);
            setFormCategory(pledge.category);
            setFormType(pledge.type);
            setFormAmount(String(pledge.amountPerInstallment));
            setFormInstallments(String(pledge.totalInstallments));
            setFormDueDay(String(pledge.dueDay));
            setFormFrequency(pledge.frequency);
            setFormReminderDays(String(pledge.reminderDaysBefore));
            setFormReminderChannel(pledge.reminderChannel);
        } else {
            setEditingPledge(null);
            setFormTitle('');
            setFormCategory('Construção');
            setFormType('carne');
            setFormAmount('100');
            setFormInstallments('12');
            setFormDueDay('10');
            setFormFrequency('mensal');
            setFormReminderDays('3');
            setFormReminderChannel('whatsapp');
        }
        setIsFormOpen(true);
    };

    const handleSaveForm = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(formAmount.replace(',', '.')) || 0;
        const totalInst = parseInt(formInstallments, 10) || 0;
        const due = parseInt(formDueDay, 10) || 10;
        const remDays = parseInt(formReminderDays, 10) || 0;

        if (!formTitle.trim()) {
            alert('Por favor, informe um título ou descrição para o propósito.');
            return;
        }

        if (editingPledge) {
            const updated = pledges.map(p => p.id === editingPledge.id ? {
                ...p,
                title: formTitle,
                category: formCategory,
                type: formType,
                amountPerInstallment: amt,
                totalInstallments: formType === 'recorrente' ? 0 : totalInst,
                dueDay: due,
                frequency: formFrequency,
                reminderDaysBefore: remDays,
                reminderChannel: formReminderChannel
            } : p);
            savePledgesList(updated);
        } else {
            const newPledge: ContributionPledge = {
                id: `pledge-${Date.now()}`,
                title: formTitle,
                category: formCategory,
                type: formType,
                amountPerInstallment: amt,
                totalInstallments: formType === 'recorrente' ? 0 : totalInst,
                dueDay: due,
                frequency: formFrequency,
                startDate: new Date().toISOString().split('T')[0],
                reminderDaysBefore: remDays,
                reminderChannel: formReminderChannel,
                status: 'active',
                paidInstallments: 0,
                created_at: new Date().toISOString(),
                church_id: church?.id,
                contributor_id: contributor?.id
            };
            savePledgesList([newPledge, ...pledges]);
        }

        setIsFormOpen(false);
    };

    const handleDeletePledge = (id: string) => {
        if (confirm('Tem certeza que deseja cancelar e remover este propósito/carnê?')) {
            const filtered = pledges.filter(p => p.id !== id);
            savePledgesList(filtered);
        }
    };

    const handleConfirmPaymentInstallment = (id: string) => {
        const updated = pledges.map(p => {
            if (p.id === id) {
                const newPaid = p.paidInstallments + 1;
                const isFinished = p.totalInstallments > 0 && newPaid >= p.totalInstallments;
                return {
                    ...p,
                    paidInstallments: newPaid,
                    status: isFinished ? ('completed' as const) : p.status
                };
            }
            return p;
        });
        savePledgesList(updated);
        setSelectedPixPledge(null);
    };

    // Helper for calculating next due date
    const getNextDueDateText = (dueDay: number) => {
        const today = new Date();
        const currentMonthDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
        
        let targetDate = currentMonthDue;
        if (today.getDate() > dueDay) {
            targetDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
        }

        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return { label: 'Vence hoje!', alert: true };
        if (diffDays < 0) return { label: 'Vencido', alert: true };
        if (diffDays <= 5) return { label: `Vence em ${diffDays} dias`, alert: true };
        return { label: `Vencimento: dia ${dueDay}`, alert: false };
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedPix(true);
        setTimeout(() => setCopiedPix(false), 2000);
    };

    // Calculate Summary KPIs
    const stats = useMemo(() => {
        const activeList = pledges.filter(p => p.status === 'active');
        const totalMonthlyCommitment = activeList.reduce((acc, curr) => acc + curr.amountPerInstallment, 0);
        const totalActiveCount = activeList.length;
        const totalPaidCount = pledges.reduce((acc, curr) => acc + curr.paidInstallments, 0);

        return {
            totalMonthlyCommitment,
            totalActiveCount,
            totalPaidCount
        };
    }, [pledges]);

    return (
        <PortalContainer maxWidth="7xl">
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                            <span>Portal do Contribuinte</span>
                            <span>•</span>
                            <span className="text-purple-600 dark:text-purple-400 font-bold">Carnês & Propósitos de Fé</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            Meus Carnês e Propósitos
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                            Defina seus votos, carnês de construção e compromissos mensais com lembretes automáticos.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <PortalButton
                            variant="primary"
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => handleOpenForm()}
                            icon={PlusCircle}
                        >
                            Novo Carnê / Propósito
                        </PortalButton>
                    </div>
                </div>

                {/* Contributor Profile Header Banner */}
                {contributor ? (
                    <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-slate-900 text-white p-5 rounded-2xl shadow-xl border border-purple-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 font-black text-xl shadow-inner shrink-0">
                                {contributor.name ? contributor.name.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                                        {contributor.name}
                                    </h2>
                                    <span className="bg-purple-500/20 text-purple-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-purple-400/30 uppercase tracking-wider flex items-center gap-1">
                                        <Bell className="w-3 h-3" /> Lembretes Ativos
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1">
                                    {contributor.phone && <span>WhatsApp: <strong>{contributor.phone}</strong></span>}
                                    {contributor.email && <span>Email: <strong>{contributor.email}</strong></span>}
                                </div>
                            </div>
                        </div>

                        <div className="text-xs text-purple-200/80 bg-purple-900/40 px-3 py-2 rounded-xl border border-purple-700/50 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                            <span>Os lembretes são enviados via WhatsApp no canal cadastrado.</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <UserCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                                    Identifique-se para receber avisos personalizados no seu WhatsApp
                                </h3>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                    Vincule seu cadastro para receber os carnês e notificações diretamente no seu celular.
                                </p>
                            </div>
                        </div>
                        <PortalButton
                            variant="primary"
                            size="sm"
                            onClick={() => onNavigate('identify')}
                        >
                            Identificar-me
                        </PortalButton>
                    </div>
                )}

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <PortalCard className="p-5 flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                            <Target className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Ativos & Em Andamento
                            </span>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                {stats.totalActiveCount} {stats.totalActiveCount === 1 ? 'compromisso' : 'compromissos'}
                            </div>
                        </div>
                    </PortalCard>

                    <PortalCard className="p-5 flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Compromisso Mensal
                            </span>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                {formatCurrencyBrl(stats.totalMonthlyCommitment)}
                            </div>
                        </div>
                    </PortalCard>

                    <PortalCard className="p-5 flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-brand-blue dark:text-blue-400 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Total de Parcelas Pagas
                            </span>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                {stats.totalPaidCount} parcelas
                            </div>
                        </div>
                    </PortalCard>
                </div>

                {/* Pledges Cards Grid */}
                {isLoading ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                        <Clock className="w-8 h-8 animate-spin text-purple-600" />
                        <p className="text-sm font-semibold">Carregando seus carnês e propósitos...</p>
                    </div>
                ) : pledges.length === 0 ? (
                    <PortalCard className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-3xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <BookmarkPlus className="w-8 h-8 stroke-[1.5]" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg">
                                Nenhum carnê ou propósito cadastrado
                            </h3>
                            <p className="text-xs text-slate-500 max-w-md mt-1">
                                Crie um propósito de doação para a reforma do templo, missões ou um lembrete do seu dízimo mensal para receber notificações no WhatsApp antes do vencimento.
                            </p>
                        </div>
                        <PortalButton
                            variant="primary"
                            size="md"
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => handleOpenForm()}
                            icon={PlusCircle}
                        >
                            Criar Meu Primeiro Carnê
                        </PortalButton>
                    </PortalCard>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pledges.map((item) => {
                            const isRecorrente = item.type === 'recorrente' || item.totalInstallments === 0;
                            const progressPercent = isRecorrente 
                                ? 100 
                                : Math.min(100, Math.round((item.paidInstallments / item.totalInstallments) * 100));
                            
                            const dueDateInfo = getNextDueDateText(item.dueDay);

                            return (
                                <PortalCard 
                                    key={item.id} 
                                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div>
                                        {/* Card Header & Badges */}
                                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                    {item.category}
                                                </span>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleOpenForm(item)}
                                                        className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                        title="Editar Propósito"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePledge(item.id)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                        title="Remover"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-snug">
                                                    {item.title}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xl font-black text-slate-900 dark:text-white">
                                                        {formatCurrencyBrl(item.amountPerInstallment)}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-500">
                                                        / {item.frequency}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress & Installment Stats */}
                                        <div className="p-5 space-y-4">
                                            <div>
                                                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                                    <span className="text-slate-500">
                                                        {isRecorrente ? 'Recorrência Ativa' : `Parcelas (${item.paidInstallments} de ${item.totalInstallments})`}
                                                    </span>
                                                    <span className="text-purple-600 dark:text-purple-400 font-extrabold">
                                                        {isRecorrente ? 'Sem limite' : `${progressPercent}%`}
                                                    </span>
                                                </div>

                                                {!isRecorrente && (
                                                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-500" 
                                                            style={{ width: `${progressPercent}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Due Date & Reminder info badges */}
                                            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-2 border border-slate-100 dark:border-slate-800 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500 font-bold flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Vencimento
                                                    </span>
                                                    <span className={`font-black ${dueDateInfo.alert ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                        {dueDateInfo.label}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-700/50 pt-2">
                                                    <span className="text-slate-500 font-bold flex items-center gap-1.5">
                                                        <Bell className="w-3.5 h-3.5 text-purple-500" /> Lembrete
                                                    </span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                        {item.reminderDaysBefore === 0 ? 'No dia do vencimento' : `${item.reminderDaysBefore} dias antes`} via {item.reminderChannel.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Footer */}
                                    <div className="p-5 pt-0">
                                        <button
                                            onClick={() => setSelectedPixPledge(item)}
                                            className="w-full py-2.5 px-4 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <QrCode className="w-4 h-4" />
                                            Pagar Próxima Parcela Pix
                                        </button>
                                    </div>
                                </PortalCard>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create/Edit Pledge Modal Panel */}
            {isFormOpen && (
                <div 
                    style={{
                        transform: `translateY(${formSwipeY}px)`,
                        opacity: isFormSwiping ? Math.max(0.3, 1 - formSwipeY / 400) : 1,
                        transition: isFormSwiping ? 'none' : 'transform 0.25s ease-out, opacity 0.25s ease-out'
                    }}
                    className="fixed inset-0 z-50 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden shadow-2xl"
                >
                    <div className="flex flex-col h-full w-full overflow-hidden">
                        {/* Swipe Handle Bar */}
                        <div 
                            onMouseDown={(e) => {
                                formSwipeStartRef.current = e.clientY;
                                setIsFormSwiping(true);
                            }}
                            onTouchStart={(e) => {
                                formSwipeStartRef.current = e.touches[0].clientY;
                                setIsFormSwiping(true);
                            }}
                            className="w-full flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-white/5 shrink-0"
                            title="Deslize para baixo para fechar"
                        >
                            <div className="w-16 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full transition-all group-hover:bg-purple-500 group-hover:w-20" />
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 opacity-80 group-hover:opacity-100">
                                Deslize para baixo para fechar
                            </span>
                        </div>
                        
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                            <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
                                        <BookmarkPlus className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                            {editingPledge ? 'Editar Propósito / Carnê' : 'Novo Propósito ou Carnê'}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                            Configure os detalhes da sua oferta, metas e avisos automáticos de vencimento no celular
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Form Body - Scrollable */}
                        <form onSubmit={handleSaveForm} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-8 flex-1 overflow-y-auto space-y-8 custom-scrollbar text-xs">
                                
                                {/* Section 1: Identificação */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                        1. Dados do Propósito / Carnê
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                                Título do Propósito / Carnê *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formTitle}
                                                onChange={(e) => setFormTitle(e.target.value)}
                                                placeholder="Ex: Carnê Reforma do Templo, Voto de Fé Missionário..."
                                                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-purple-500/10 text-sm"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                                Categoria
                                            </label>
                                            <select
                                                value={formCategory}
                                                onChange={(e) => setFormCategory(e.target.value)}
                                                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none text-sm cursor-pointer"
                                            >
                                                <option value="Construção">Construção & Reforma</option>
                                                <option value="Dízimo">Dízimo Fiel</option>
                                                <option value="Missões">Oferta Missionária</option>
                                                <option value="Ação Social">Ação Social</option>
                                                <option value="Propósito de Fé">Propósito de Fé</option>
                                                <option value="Outros">Outros</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Formato e Valores */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                        2. Formato & Valores do Compromisso
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                                Formato
                                            </label>
                                            <select
                                                value={formType}
                                                onChange={(e) => setFormType(e.target.value as any)}
                                                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none text-xs cursor-pointer"
                                            >
                                                <option value="carne">Carnê Parcelado</option>
                                                <option value="recorrente">Recorrente Contínuo</option>
                                                <option value="proposito">Propósito com Meta</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                                Valor por Parcela (R$) *
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={formAmount}
                                                onChange={(e) => setFormAmount(e.target.value)}
                                                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-purple-500/10 text-sm"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                                {formType === 'recorrente' ? 'Parcelas' : 'Nº de Parcelas'}
                                            </label>
                                            <input
                                                type="number"
                                                disabled={formType === 'recorrente'}
                                                value={formType === 'recorrente' ? '0' : formInstallments}
                                                onChange={(e) => setFormInstallments(e.target.value)}
                                                placeholder={formType === 'recorrente' ? 'Sem fim' : '12'}
                                                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none text-sm disabled:opacity-50"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                                Dia do Vencimento *
                                            </label>
                                            <select
                                                value={formDueDay}
                                                onChange={(e) => setFormDueDay(e.target.value)}
                                                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none text-xs cursor-pointer"
                                            >
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                    <option key={day} value={day}>Dia {day}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Frequência & Lembrete */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                        3. Frequência & Notificações
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                                Frequência das Contribuições
                                            </label>
                                            <select
                                                value={formFrequency}
                                                onChange={(e) => setFormFrequency(e.target.value as any)}
                                                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none text-xs cursor-pointer"
                                            >
                                                <option value="mensal">Mensal</option>
                                                <option value="quinzenal">Quinzenal</option>
                                                <option value="semanal">Semanal</option>
                                                <option value="unica">Única</option>
                                            </select>
                                        </div>

                                        <div className="md:col-span-2 bg-purple-50/60 dark:bg-purple-950/30 p-5 rounded-2xl border border-purple-100 dark:border-purple-800/60 space-y-3">
                                            <div className="flex items-center gap-2 font-black text-purple-900 dark:text-purple-200 text-xs uppercase tracking-wider">
                                                <Bell className="w-4 h-4 text-purple-600" />
                                                <span>Configuração de Lembrete Automático</span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                        Quando Avisar?
                                                    </label>
                                                    <select
                                                        value={formReminderDays}
                                                        onChange={(e) => setFormReminderDays(e.target.value)}
                                                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-none text-xs cursor-pointer"
                                                    >
                                                        <option value="0">No dia do vencimento</option>
                                                        <option value="1">1 dia antes</option>
                                                        <option value="3">3 dias antes</option>
                                                        <option value="5">5 dias antes</option>
                                                        <option value="7">1 semana antes</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                        Canal de Notificação
                                                    </label>
                                                    <select
                                                        value={formReminderChannel}
                                                        onChange={(e) => setFormReminderChannel(e.target.value as any)}
                                                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-none text-xs cursor-pointer"
                                                    >
                                                        <option value="whatsapp">WhatsApp</option>
                                                        <option value="email">E-mail</option>
                                                        <option value="sms">SMS</option>
                                                        <option value="todos">Todos os canais</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Footer Actions */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-full shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center gap-2 px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full shadow-md shadow-purple-600/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                                >
                                    <BookmarkPlus className="w-3.5 h-3.5" />
                                    {editingPledge ? 'Salvar Alterações' : 'Criar Propósito'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Pix Payment Dialog */}
            {selectedPixPledge && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative space-y-4">
                        <button
                            onClick={() => setSelectedPixPledge(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center">
                            <div className="w-12 h-12 bg-orange-100 text-brand-orange rounded-2xl flex items-center justify-center mx-auto mb-2">
                                <QrCode className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                Pagamento da Parcela do Carnê
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {selectedPixPledge.title}
                            </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-center space-y-1">
                            <span className="text-xs font-bold text-slate-500 uppercase">Valor da Parcela</span>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
                                {formatCurrencyBrl(selectedPixPledge.amountPerInstallment)}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                Categoria: {selectedPixPledge.category}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Chave Copia e Cola Pix:
                            </span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={`00020126360014BR.GOV.BCB.PIX0114000000000000005204000053039865405${selectedPixPledge.amountPerInstallment.toFixed(2)}5802BR5913${church?.name || 'Igreja'}6009SAO PAULO62070503***6304`}
                                    className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none"
                                />
                                <button
                                    onClick={() => copyToClipboard(`00020126360014BR.GOV.BCB.PIX0114000000000000005204000053039865405${selectedPixPledge.amountPerInstallment.toFixed(2)}5802BR5913${church?.name || 'Igreja'}6009SAO PAULO62070503***6304`)}
                                    className="p-2.5 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                                >
                                    {copiedPix ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copiedPix ? 'Copiado!' : 'Copiar'}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2 space-y-2">
                            <PortalButton
                                variant="primary"
                                size="md"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleConfirmPaymentInstallment(selectedPixPledge.id)}
                                icon={CheckCircle2}
                            >
                                Confirmar Pagamento desta Parcela
                            </PortalButton>
                            <PortalButton
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => setSelectedPixPledge(null)}
                            >
                                Fechar
                            </PortalButton>
                        </div>
                    </div>
                </div>
            )}
        </PortalContainer>
    );
};
