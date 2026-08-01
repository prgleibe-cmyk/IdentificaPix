import React, { useState, useEffect, useContext, useMemo, memo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { 
    BookmarkPlus, 
    PlusCircle, 
    Search, 
    Filter, 
    Calendar, 
    DollarSign, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    Send, 
    Edit3, 
    Trash2, 
    Eye, 
    Sparkles, 
    Building2, 
    Users, 
    X, 
    Copy, 
    Check, 
    QrCode, 
    RefreshCw, 
    Share2, 
    MessageSquare, 
    Target, 
    TrendingUp, 
    FileText, 
    ChevronRight,
    ArrowUpRight,
    Megaphone,
    Save,
    RotateCcw
} from 'lucide-react';

export interface ChurchCampaign {
    id: string;
    title: string;
    description: string;
    category: string;
    targetGoal: number;
    amountPerInstallment: number;
    totalInstallments: number;
    dueDay: number;
    reminderDaysBefore: number;
    isPublishedInPortal: boolean;
    status: 'active' | 'paused' | 'completed';
    church_id?: string;
    created_at: string;
    enrolledContributorsCount?: number;
    totalPledgedAmount?: number;
}

export interface ContributorPledgeAdmin {
    id: string;
    contributorName: string;
    contributorPhone?: string;
    contributorEmail?: string;
    churchName: string;
    church_id?: string;
    campaignTitle: string;
    category: string;
    type: 'carne' | 'proposito' | 'recorrente';
    amountPerInstallment: number;
    totalInstallments: number;
    paidInstallments: number;
    dueDay: number;
    frequency: string;
    reminderDaysBefore: number;
    reminderChannel: string;
    status: 'active' | 'completed' | 'paused' | 'overdue';
    created_at: string;
    lastPaymentDate?: string;
}

const DEFAULT_CHURCH_CAMPAIGNS: ChurchCampaign[] = [
    {
        id: 'camp-1',
        title: 'Carnê Reforma e Ampliação do Templo 2026',
        description: 'Campanha oficial para troca do telhado, pintura geral e novos bancos da nave principal.',
        category: 'Construção & Reforma',
        targetGoal: 120000,
        amountPerInstallment: 100,
        totalInstallments: 12,
        dueDay: 10,
        reminderDaysBefore: 3,
        isPublishedInPortal: true,
        status: 'active',
        created_at: '2026-01-10T10:00:00Z',
        enrolledContributorsCount: 45,
        totalPledgedAmount: 54000
    },
    {
        id: 'camp-2',
        title: 'Propósito Missionário Transcultural',
        description: 'Apoio mensal para envio e sustento da família missionária no sertão e exterior.',
        category: 'Missões',
        targetGoal: 30000,
        amountPerInstallment: 50,
        totalInstallments: 6,
        dueDay: 15,
        reminderDaysBefore: 5,
        isPublishedInPortal: true,
        status: 'active',
        created_at: '2026-02-01T10:00:00Z',
        enrolledContributorsCount: 28,
        totalPledgedAmount: 8400
    },
    {
        id: 'camp-3',
        title: 'Carnê de Ação Social e Cestas Básicas',
        description: 'Fornecimento mensal de alimentos e suporte emergencial para famílias carentes da comunidade.',
        category: 'Ação Social',
        targetGoal: 18000,
        amountPerInstallment: 30,
        totalInstallments: 12,
        dueDay: 20,
        reminderDaysBefore: 2,
        isPublishedInPortal: true,
        status: 'active',
        created_at: '2026-03-05T10:00:00Z',
        enrolledContributorsCount: 32,
        totalPledgedAmount: 11520
    }
];

const MOCK_PLEDGES_ADMIN: ContributorPledgeAdmin[] = [
    {
        id: 'pledge-adm-1',
        contributorName: 'João Carlos da Silva',
        contributorPhone: '5511988887777',
        contributorEmail: 'joao.carlos@email.com',
        churchName: 'Sede Principal',
        campaignTitle: 'Carnê Reforma e Ampliação do Templo 2026',
        category: 'Construção & Reforma',
        type: 'carne',
        amountPerInstallment: 100,
        totalInstallments: 12,
        paidInstallments: 4,
        dueDay: 10,
        frequency: 'mensal',
        reminderDaysBefore: 3,
        reminderChannel: 'whatsapp',
        status: 'active',
        created_at: '2026-01-15T12:00:00Z',
        lastPaymentDate: '2026-06-10'
    },
    {
        id: 'pledge-adm-2',
        contributorName: 'Maria Eduarda Santos',
        contributorPhone: '5511977776666',
        contributorEmail: 'maria.santos@email.com',
        churchName: 'Sede Principal',
        campaignTitle: 'Propósito Missionário Transcultural',
        category: 'Missões',
        type: 'proposito',
        amountPerInstallment: 50,
        totalInstallments: 6,
        paidInstallments: 2,
        dueDay: 15,
        frequency: 'mensal',
        reminderDaysBefore: 5,
        reminderChannel: 'whatsapp',
        status: 'active',
        created_at: '2026-02-10T14:00:00Z',
        lastPaymentDate: '2026-05-15'
    },
    {
        id: 'pledge-adm-3',
        contributorName: 'Marcos Antonio Oliveira',
        contributorPhone: '5511966665555',
        contributorEmail: 'marcos.oliveira@email.com',
        churchName: 'Congregação Bairro Novo',
        campaignTitle: 'Carnê Reforma e Ampliação do Templo 2026',
        category: 'Construção & Reforma',
        type: 'carne',
        amountPerInstallment: 200,
        totalInstallments: 12,
        paidInstallments: 3,
        dueDay: 5,
        frequency: 'mensal',
        reminderDaysBefore: 2,
        reminderChannel: 'whatsapp',
        status: 'overdue',
        created_at: '2026-01-20T10:00:00Z',
        lastPaymentDate: '2026-04-05'
    },
    {
        id: 'pledge-adm-4',
        contributorName: 'Ana Paula Ferreira',
        contributorPhone: '5511955554444',
        contributorEmail: 'ana.ferreira@email.com',
        churchName: 'Sede Principal',
        campaignTitle: 'Dízimo Fiel Mensal',
        category: 'Dízimo',
        type: 'recorrente',
        amountPerInstallment: 350,
        totalInstallments: 0,
        paidInstallments: 6,
        dueDay: 10,
        frequency: 'mensal',
        reminderDaysBefore: 1,
        reminderChannel: 'whatsapp',
        status: 'active',
        created_at: '2026-01-05T09:00:00Z',
        lastPaymentDate: '2026-06-10'
    },
    {
        id: 'pledge-adm-5',
        contributorName: 'Lucas Gabriel Costa',
        contributorPhone: '5511944443333',
        contributorEmail: 'lucas.costa@email.com',
        churchName: 'Congregação Bairro Novo',
        campaignTitle: 'Carnê de Ação Social e Cestas Básicas',
        category: 'Ação Social',
        type: 'carne',
        amountPerInstallment: 30,
        totalInstallments: 12,
        paidInstallments: 12,
        dueDay: 20,
        frequency: 'mensal',
        reminderDaysBefore: 3,
        reminderChannel: 'todos',
        status: 'completed',
        created_at: '2025-07-01T10:00:00Z',
        lastPaymentDate: '2026-06-20'
    }
];

export const PledgesView: React.FC = memo(() => {
    const { churches } = useContext(AppContext) || {};
    const { showToast } = useUI();
    const { user } = useAuth();

    // Tab state: 'contributor_pledges' | 'campaigns'
    const [activeTab, setActiveTab] = useState<'contributor_pledges' | 'campaigns'>('contributor_pledges');

    // Data lists
    const [campaigns, setCampaigns] = useState<ChurchCampaign[]>([]);
    const [pledges, setPledges] = useState<ContributorPledgeAdmin[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedChurch, setSelectedChurch] = useState<string>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');

    // Modal states
    const [isCampaignModalOpen, setIsCampaignModalOpen] = useState<boolean>(false);
    const [editingCampaign, setEditingCampaign] = useState<ChurchCampaign | null>(null);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
    const [selectedPledgeForPayment, setSelectedPledgeForPayment] = useState<ContributorPledgeAdmin | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<string>('pix');
    const [paymentNotes, setPaymentNotes] = useState<string>('');

    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);
    const [whatsAppPledge, setWhatsAppPledge] = useState<ContributorPledgeAdmin | null>(null);
    const [whatsappCustomMessage, setWhatsappCustomMessage] = useState<string>('');

    // Swipe to dismiss states
    const [campaignSwipeY, setCampaignSwipeY] = useState<number>(0);
    const [isCampaignSwiping, setIsCampaignSwiping] = useState<boolean>(false);
    const campaignSwipeStartRef = React.useRef<number>(0);

    const [whatsappSwipeY, setWhatsappSwipeY] = useState<number>(0);
    const [isWhatsappSwiping, setIsWhatsappSwiping] = useState<boolean>(false);
    const whatsappSwipeStartRef = React.useRef<number>(0);

    // Global listeners for campaign swipe
    useEffect(() => {
        if (!isCampaignSwiping) return;
        const onMove = (e: TouchEvent | MouseEvent) => {
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const diff = clientY - campaignSwipeStartRef.current;
            if (diff > 0) setCampaignSwipeY(diff);
        };
        const onEnd = () => {
            setIsCampaignSwiping(false);
            setCampaignSwipeY((prev) => {
                if (prev > 90) setIsCampaignModalOpen(false);
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
    }, [isCampaignSwiping]);

    // Global listeners for whatsapp swipe
    useEffect(() => {
        if (!isWhatsappSwiping) return;
        const onMove = (e: TouchEvent | MouseEvent) => {
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const diff = clientY - whatsappSwipeStartRef.current;
            if (diff > 0) setWhatsappSwipeY(diff);
        };
        const onEnd = () => {
            setIsWhatsappSwiping(false);
            setWhatsappSwipeY((prev) => {
                if (prev > 90) setIsWhatsAppModalOpen(false);
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
    }, [isWhatsappSwiping]);

    // Campaign Form fields
    const [campTitle, setCampTitle] = useState<string>('');
    const [campDesc, setCampDesc] = useState<string>('');
    const [campCategory, setCampCategory] = useState<string>('Construção & Reforma');
    const [campGoal, setCampGoal] = useState<string>('100000');
    const [campInstallmentAmount, setCampInstallmentAmount] = useState<string>('100');
    const [campInstallments, setCampInstallments] = useState<string>('12');
    const [campDueDay, setCampDueDay] = useState<string>('10');
    const [campReminderDays, setCampReminderDays] = useState<string>('3');
    const [campIsPublished, setCampIsPublished] = useState<boolean>(true);

    // Load initial stored data
    useEffect(() => {
        setIsLoading(true);
        try {
            // Load Campaigns
            const storedCamps = localStorage.getItem('iggestor_admin_campaigns');
            if (storedCamps) {
                setCampaigns(JSON.parse(storedCamps));
            } else {
                setCampaigns([]);
            }

            // Load Pledges
            const storedPledges = localStorage.getItem('iggestor_admin_pledges');
            if (storedPledges) {
                setPledges(JSON.parse(storedPledges));
            } else {
                setPledges([]);
            }
        } catch (e) {
            console.error('[PledgesView] Erro ao carregar dados:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const saveCampaigns = (newList: ChurchCampaign[]) => {
        setCampaigns(newList);
        try {
            localStorage.setItem('iggestor_admin_campaigns', JSON.stringify(newList));
        } catch (_) {}
    };

    const savePledges = (newList: ContributorPledgeAdmin[]) => {
        setPledges(newList);
        try {
            localStorage.setItem('iggestor_admin_pledges', JSON.stringify(newList));
        } catch (_) {}
    };

    // Formatters
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    // Handle Campaign Modal Open
    const handleOpenCampaignModal = (camp?: ChurchCampaign) => {
        if (camp) {
            setEditingCampaign(camp);
            setCampTitle(camp.title);
            setCampDesc(camp.description);
            setCampCategory(camp.category);
            setCampGoal(String(camp.targetGoal));
            setCampInstallmentAmount(String(camp.amountPerInstallment));
            setCampInstallments(String(camp.totalInstallments));
            setCampDueDay(String(camp.dueDay));
            setCampReminderDays(String(camp.reminderDaysBefore));
            setCampIsPublished(camp.isPublishedInPortal);
        } else {
            setEditingCampaign(null);
            setCampTitle('');
            setCampDesc('');
            setCampCategory('Construção & Reforma');
            setCampGoal('50000');
            setCampInstallmentAmount('100');
            setCampInstallments('12');
            setCampDueDay('10');
            setCampReminderDays('3');
            setCampIsPublished(true);
        }
        setIsCampaignModalOpen(true);
    };

    // Save Campaign Form
    const handleSaveCampaign = (e: React.FormEvent) => {
        e.preventDefault();
        if (!campTitle.trim()) {
            showToast('Por favor, informe o título da campanha', 'error');
            return;
        }

        const goalVal = parseFloat(campGoal) || 0;
        const instAmt = parseFloat(campInstallmentAmount) || 0;
        const instNum = parseInt(campInstallments, 10) || 0;
        const dueVal = parseInt(campDueDay, 10) || 10;
        const remVal = parseInt(campReminderDays, 10) || 3;

        if (editingCampaign) {
            const updated = campaigns.map(c => c.id === editingCampaign.id ? {
                ...c,
                title: campTitle,
                description: campDesc,
                category: campCategory,
                targetGoal: goalVal,
                amountPerInstallment: instAmt,
                totalInstallments: instNum,
                dueDay: dueVal,
                reminderDaysBefore: remVal,
                isPublishedInPortal: campIsPublished
            } : c);
            saveCampaigns(updated);
            showToast('Campanha atualizada com sucesso!', 'success');
        } else {
            const newCamp: ChurchCampaign = {
                id: `camp-${Date.now()}`,
                title: campTitle,
                description: campDesc,
                category: campCategory,
                targetGoal: goalVal,
                amountPerInstallment: instAmt,
                totalInstallments: instNum,
                dueDay: dueVal,
                reminderDaysBefore: remVal,
                isPublishedInPortal: campIsPublished,
                status: 'active',
                created_at: new Date().toISOString(),
                enrolledContributorsCount: 0,
                totalPledgedAmount: 0
            };
            saveCampaigns([newCamp, ...campaigns]);
            showToast('Nova campanha criada e disponibilizada no portal!', 'success');
        }

        setIsCampaignModalOpen(false);
    };

    // Toggle Portal Publication
    const handleTogglePublication = (id: string) => {
        const updated = campaigns.map(c => {
            if (c.id === id) {
                const nextVal = !c.isPublishedInPortal;
                showToast(nextVal ? 'Campanha publicada no Portal do Contribuinte!' : 'Campanha ocultada do Portal.', 'success');
                return { ...c, isPublishedInPortal: nextVal };
            }
            return c;
        });
        saveCampaigns(updated);
    };

    // Confirm Payment for an Installment
    const handleConfirmPayment = () => {
        if (!selectedPledgeForPayment) return;

        const updated = pledges.map(p => {
            if (p.id === selectedPledgeForPayment.id) {
                const newPaid = p.paidInstallments + 1;
                const isFinished = p.totalInstallments > 0 && newPaid >= p.totalInstallments;
                return {
                    ...p,
                    paidInstallments: newPaid,
                    status: isFinished ? ('completed' as const) : ('active' as const),
                    lastPaymentDate: new Date().toISOString().split('T')[0]
                };
            }
            return p;
        });

        savePledges(updated);
        showToast(`Pagamento da parcela registrado para ${selectedPledgeForPayment.contributorName}!`, 'success');
        setIsPaymentModalOpen(false);
        setSelectedPledgeForPayment(null);
    };

    // Delete Pledge
    const handleDeletePledge = (id: string) => {
        if (confirm('Tem certeza que deseja cancelar e remover este carnê?')) {
            const updated = pledges.filter(p => p.id !== id);
            savePledges(updated);
            showToast('Carnê/Propósito removido.', 'success');
        }
    };

    // Filtered lists
    const filteredPledges = useMemo(() => {
        return pledges.filter(p => {
            // Church filter
            if (selectedChurch !== 'all' && p.churchName !== selectedChurch) return false;
            // Category filter
            if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
            // Status filter
            if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
            // Search term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchName = p.contributorName.toLowerCase().includes(term);
                const matchCamp = p.campaignTitle.toLowerCase().includes(term);
                const matchPhone = p.contributorPhone?.includes(term);
                if (!matchName && !matchCamp && !matchPhone) return false;
            }
            return true;
        });
    }, [pledges, selectedChurch, selectedCategory, selectedStatus, searchTerm]);

    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(c => {
            if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                if (!c.title.toLowerCase().includes(term) && !c.description.toLowerCase().includes(term)) {
                    return false;
                }
            }
            return true;
        });
    }, [campaigns, selectedCategory, searchTerm]);

    // KPI Summary Calculation
    const kpis = useMemo(() => {
        const activePledges = pledges.filter(p => p.status === 'active' || p.status === 'overdue');
        const totalMonthlyCommitment = activePledges.reduce((acc, p) => acc + p.amountPerInstallment, 0);
        
        const totalPledgedGoal = campaigns.reduce((acc, c) => acc + c.targetGoal, 0);
        const totalPledgedRaised = campaigns.reduce((acc, c) => acc + (c.totalPledgedAmount || 0), 0);

        const overdueCount = pledges.filter(p => p.status === 'overdue').length;

        return {
            totalMonthlyCommitment,
            activeCount: activePledges.length,
            totalPledgedGoal,
            totalPledgedRaised,
            overdueCount
        };
    }, [pledges, campaigns]);

    // WhatsApp Reminder Helpers
    const generateDefaultWhatsAppMessage = (p: ContributorPledgeAdmin) => {
        const savedTemplate = localStorage.getItem('iggestor_admin_whatsapp_template');
        if (savedTemplate) {
            return savedTemplate
                .replace(/\{NOME\}/g, p.contributorName || '')
                .replace(/\{CAMPANHA\}/g, p.campaignTitle || '')
                .replace(/\{PARCELA\}/g, String((p.paidInstallments || 0) + 1))
                .replace(/\{TOTAL_PARCELAS\}/g, p.totalInstallments === 0 ? 'Recorrente' : String(p.totalInstallments || ''))
                .replace(/\{VALOR\}/g, formatCurrency(p.amountPerInstallment || 0))
                .replace(/\{VENCIMENTO\}/g, String(p.dueDay || ''));
        }
        return `Olá, *${p.contributorName}*! Paz do Senhor.

Lembramos com carinho do seu compromisso de fé (*${p.campaignTitle}*).

*Detalhes da Parcela:*
• Parcela nº: ${(p.paidInstallments || 0) + 1} de ${p.totalInstallments === 0 ? 'Recorrente' : p.totalInstallments}
• Valor: ${formatCurrency(p.amountPerInstallment)}
• Dia do Vencimento: dia ${p.dueDay}

Sua contribuição fortalece os projetos da igreja! Deus abençoe rica e abundantemente.`;
    };

    const handleOpenWhatsAppModal = (p: ContributorPledgeAdmin) => {
        setWhatsAppPledge(p);
        setWhatsappCustomMessage(generateDefaultWhatsAppMessage(p));
        setIsWhatsAppModalOpen(true);
    };

    const insertTag = (tag: string) => {
        setWhatsappCustomMessage(prev => prev + tag);
    };

    const handleSaveWhatsAppTemplate = () => {
        if (!whatsappCustomMessage.trim()) return;
        localStorage.setItem('iggestor_admin_whatsapp_template', whatsappCustomMessage);
        showToast('Modelo de mensagem de WhatsApp salvo com sucesso!', 'success');
    };

    const handleRestoreDefaultTemplate = () => {
        localStorage.removeItem('iggestor_admin_whatsapp_template');
        if (whatsAppPledge) {
            setWhatsappCustomMessage(`Olá, *${whatsAppPledge.contributorName}*! Paz do Senhor.

Lembramos com carinho do seu compromisso de fé (*${whatsAppPledge.campaignTitle}*).

*Detalhes da Parcela:*
• Parcela nº: ${whatsAppPledge.paidInstallments + 1} de ${whatsAppPledge.totalInstallments === 0 ? 'Recorrente' : whatsAppPledge.totalInstallments}
• Valor: ${formatCurrency(whatsAppPledge.amountPerInstallment)}
• Dia do Vencimento: dia ${whatsAppPledge.dueDay}

Sua contribuição fortalece os projetos da igreja! Deus abençoe rica e abundantemente.`);
        }
        showToast('Modelo restaurado para o padrão do sistema.', 'success');
    };

    const handleSendWhatsApp = () => {
        if (!whatsAppPledge || !whatsAppPledge.contributorPhone) {
            showToast('Destinatário sem telefone cadastrado.', 'error');
            return;
        }
        const cleanPhone = whatsAppPledge.contributorPhone.replace(/\D/g, '');
        const encoded = encodeURIComponent(whatsappCustomMessage);
        window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
        setIsWhatsAppModalOpen(false);
    };

    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full pb-12 relative min-h-[600px]">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                        <BookmarkPlus className="w-4 h-4" />
                        <span>Módulo de Gestão Financeira Pastoral</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Carnês, Propósitos e Campanhas de Fé
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 max-w-2xl">
                        Acompanhe os carnês e compromissos dos contribuintes, crie novas campanhas oficiais para o portal e envie lembretes via WhatsApp.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => handleOpenCampaignModal()}
                        className="flex items-center gap-1.5 px-5 py-2 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-full shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 transition-all tracking-wider uppercase cursor-pointer"
                    >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Nova Campanha
                    </button>
                    <button
                        onClick={() => {
                            const overdueList = pledges.filter(p => p.status === 'overdue' || p.status === 'active');
                            if (overdueList.length === 0) {
                                showToast('Nenhum carnê pendente para envio de aviso.', 'error');
                                return;
                            }
                            handleOpenWhatsAppModal(overdueList[0]);
                        }}
                        className="flex items-center gap-1.5 px-5 py-2 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-full shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                    >
                        <Send className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        Avisos no WhatsApp
                    </button>
                </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                            Compromisso Mensal
                        </span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                            {formatCurrency(kpis.totalMonthlyCommitment)}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-brand-blue dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                            Carnês / Propósitos Ativos
                        </span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                            {kpis.activeCount} carnês
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Target className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                            Metas de Campanhas
                        </span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                            {formatCurrency(kpis.totalPledgedGoal)}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                            Parcelas Pendentes / Atraso
                        </span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                            {kpis.overdueCount} parcelas
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
                <button
                    onClick={() => setActiveTab('contributor_pledges')}
                    className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                        activeTab === 'contributor_pledges'
                            ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-black'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    Carnês dos Contribuintes ({filteredPledges.length})
                </button>

                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                        activeTab === 'campaigns'
                            ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-black'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Megaphone className="w-4 h-4" />
                    Campanhas do Portal ({filteredCampaigns.length})
                </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por contribuinte, campanha ou telefone..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Church Filter */}
                    {churches && churches.length > 1 && (
                        <select
                            value={selectedChurch}
                            onChange={(e) => setSelectedChurch(e.target.value)}
                            className="py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                        >
                            <option value="all">Todas as Congregações</option>
                            {churches.map((ch: any) => (
                                <option key={ch.id} value={ch.name}>{ch.name}</option>
                            ))}
                        </select>
                    )}

                    {/* Category Filter */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                    >
                        <option value="all">Todas as Categorias</option>
                        <option value="Construção & Reforma">Construção & Reforma</option>
                        <option value="Dízimo">Dízimo</option>
                        <option value="Missões">Missões</option>
                        <option value="Ação Social">Ação Social</option>
                        <option value="Propósito de Fé">Propósito de Fé</option>
                    </select>

                    {/* Status Filter */}
                    {activeTab === 'contributor_pledges' && (
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                        >
                            <option value="all">Todos os Status</option>
                            <option value="active">Ativos / Em dia</option>
                            <option value="overdue">Pendentes / Atrasados</option>
                            <option value="completed">Concluídos</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Content Tab 1: Contributor Pledges Table */}
            {activeTab === 'contributor_pledges' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
                    {filteredPledges.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 space-y-2">
                            <BookmarkPlus className="w-8 h-8 text-slate-400 mx-auto" />
                            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Nenhum carnê ou propósito encontrado</p>
                            <p className="text-xs">Tente ajustar os termos de busca ou filtros selecionados.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-extrabold tracking-wider border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="py-3 px-4">Contribuinte / Congregação</th>
                                        <th className="py-3 px-4">Campanha / Categoria</th>
                                        <th className="py-3 px-4 text-right">Valor Parcela</th>
                                        <th className="py-3 px-4 text-center">Progresso / Parcelas</th>
                                        <th className="py-3 px-4 text-center">Vencimento</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4 text-center">Ações do Tesoureiro</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                                    {filteredPledges.map((item) => {
                                        const isRecorrente = item.type === 'recorrente' || item.totalInstallments === 0;
                                        const percent = isRecorrente ? 100 : Math.min(100, Math.round((item.paidInstallments / item.totalInstallments) * 100));

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                                {/* Contributor info */}
                                                <td className="py-3 px-4">
                                                    <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                                                        {item.contributorName}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <Building2 className="w-3 h-3 text-slate-400" />
                                                        <span>{item.churchName}</span>
                                                        {item.contributorPhone && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{item.contributorPhone}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Campaign Title & Badge */}
                                                <td className="py-3 px-4">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">
                                                        {item.campaignTitle}
                                                    </div>
                                                    <span className="inline-block mt-0.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.2 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                        {item.category}
                                                    </span>
                                                </td>

                                                {/* Amount */}
                                                <td className="py-3 px-4 text-right">
                                                    <div className="font-black text-slate-900 dark:text-white text-sm">
                                                        {formatCurrency(item.amountPerInstallment)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 capitalize">
                                                        {item.frequency}
                                                    </div>
                                                </td>

                                                {/* Progress */}
                                                <td className="py-3 px-4 text-center">
                                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                                        {isRecorrente ? `${item.paidInstallments} pagas` : `${item.paidInstallments} / ${item.totalInstallments} (${percent}%)`}
                                                    </div>
                                                    {!isRecorrente && (
                                                        <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                                                            <div 
                                                                className="h-full bg-purple-600 rounded-full" 
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Due Day */}
                                                <td className="py-3 px-4 text-center font-bold">
                                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg">
                                                        Dia {item.dueDay}
                                                    </span>
                                                </td>

                                                {/* Status badge */}
                                                <td className="py-3 px-4 text-center">
                                                    {item.status === 'completed' && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                            Concluído
                                                        </span>
                                                    )}
                                                    {item.status === 'active' && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                                            Em Dia
                                                        </span>
                                                    )}
                                                    {item.status === 'overdue' && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                                            Pendente
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPledgeForPayment(item);
                                                                setIsPaymentModalOpen(true);
                                                            }}
                                                            className="p-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg font-bold transition-colors cursor-pointer"
                                                            title="Dar Baixa em Parcela"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>

                                                        {item.contributorPhone && (
                                                            <button
                                                                onClick={() => handleOpenWhatsAppModal(item)}
                                                                className="p-1.5 text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg font-bold transition-colors cursor-pointer"
                                                                title="Enviar Lembrete via WhatsApp"
                                                            >
                                                                <MessageSquare className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => handleDeletePledge(item.id)}
                                                            className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                                            title="Remover Carnê"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Content Tab 2: Church Official Campaigns List */}
            {activeTab === 'campaigns' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCampaigns.map((camp) => {
                        const progressGoalPercent = camp.targetGoal > 0 
                            ? Math.min(100, Math.round(((camp.totalPledgedAmount || 0) / camp.targetGoal) * 100))
                            : 0;

                        return (
                            <div 
                                key={camp.id}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between shadow-2xs space-y-4"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                            {camp.category}
                                        </span>

                                        <button
                                            onClick={() => handleTogglePublication(camp.id)}
                                            className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border cursor-pointer transition-colors ${
                                                camp.isPublishedInPortal 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                            }`}
                                        >
                                            {camp.isPublishedInPortal ? 'No Portal' : 'Oculta'}
                                        </button>
                                    </div>

                                    <div>
                                        <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                                            {camp.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                                            {camp.description}
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 font-bold">Meta da Campanha:</span>
                                            <span className="font-black text-slate-900 dark:text-white">
                                                {formatCurrency(camp.targetGoal)}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500 font-bold">Valor Sugerido / Parcela:</span>
                                            <span className="font-black text-purple-600 dark:text-purple-400">
                                                {formatCurrency(camp.amountPerInstallment)} ({camp.totalInstallments}x)
                                            </span>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                <span>Arrecadado / Mapeado:</span>
                                                <span>{formatCurrency(camp.totalPledgedAmount || 0)} ({progressGoalPercent}%)</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full"
                                                    style={{ width: `${progressGoalPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        onClick={() => handleOpenCampaignModal(camp)}
                                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        Editar
                                    </button>

                                    <button
                                        onClick={() => handleTogglePublication(camp.id)}
                                        className="flex-1 py-2 px-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        {camp.isPublishedInPortal ? 'Ocultar Portal' : 'Publicar'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Create/Edit Campaign */}
            {isCampaignModalOpen && (
                <div 
                    style={{
                        transform: `translateY(${campaignSwipeY}px)`,
                        opacity: isCampaignSwiping ? Math.max(0.3, 1 - campaignSwipeY / 400) : 1,
                        transition: isCampaignSwiping ? 'none' : 'transform 0.25s ease-out, opacity 0.25s ease-out'
                    }}
                    className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden rounded-3xl shadow-2xl"
                >
                    <form onSubmit={handleSaveCampaign} className="flex flex-col h-full w-full overflow-hidden">
                        {/* Swipe Handle Bar */}
                        <div 
                            onMouseDown={(e) => {
                                campaignSwipeStartRef.current = e.clientY;
                                setIsCampaignSwiping(true);
                            }}
                            onTouchStart={(e) => {
                                campaignSwipeStartRef.current = e.touches[0].clientY;
                                setIsCampaignSwiping(true);
                            }}
                            className="w-full flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-white/5 shrink-0"
                            title="Deslize para baixo para fechar"
                        >
                            <div className="w-16 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full transition-all group-hover:bg-orange-500 group-hover:w-20" />
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 opacity-80 group-hover:opacity-100">
                                Deslize para baixo para fechar
                            </span>
                        </div>

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                            <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20">
                                        <Megaphone className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                            {editingCampaign ? 'Editar Campanha Oficial' : 'Nova Campanha da Igreja'}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                            Cadastre ou edite campanhas para engajar os dizimistas e contribuintes no Portal
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsCampaignModalOpen(false)}
                                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Form Body - Scrollable */}
                        <div className="p-8 flex-1 overflow-y-auto space-y-8 custom-scrollbar text-xs">
                            {/* Section 1: Informações Principais */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    1. Identificação da Campanha
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Título da Campanha *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={campTitle}
                                            onChange={(e) => setCampTitle(e.target.value)}
                                            placeholder="Ex: Carnê Reforma do Templo 2026, Voto de Fé Missionário..."
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Categoria *
                                        </label>
                                        <select
                                            value={campCategory}
                                            onChange={(e) => setCampCategory(e.target.value)}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold cursor-pointer"
                                        >
                                            <option value="Construção & Reforma">Construção & Reforma</option>
                                            <option value="Dízimo">Dízimo</option>
                                            <option value="Missões">Missões</option>
                                            <option value="Ação Social">Ação Social</option>
                                            <option value="Propósito de Fé">Propósito de Fé</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                        Descrição e Causa
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={campDesc}
                                        onChange={(e) => setCampDesc(e.target.value)}
                                        placeholder="Explique detalhadamente o objetivo, motivo e impacto comunitário desta campanha..."
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-medium"
                                    />
                                </div>
                            </div>

                            {/* Section 2: Valores & Metas */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    2. Metas Financeiras & Parcelamento
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Meta Global da Igreja (R$)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={campGoal}
                                            onChange={(e) => setCampGoal(e.target.value)}
                                            placeholder="50000.00"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-black"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Valor Sugerido por Parcela (R$)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={campInstallmentAmount}
                                            onChange={(e) => setCampInstallmentAmount(e.target.value)}
                                            placeholder="100.00"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Nº de Parcelas Padronizadas
                                        </label>
                                        <input
                                            type="number"
                                            value={campInstallments}
                                            onChange={(e) => setCampInstallments(e.target.value)}
                                            placeholder="12"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-orange-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Divulgação no Portal */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    3. Visibilidade & Publicação
                                </h3>
                                <div className="flex items-center justify-between bg-orange-50/50 dark:bg-slate-800/60 p-5 rounded-2xl border border-orange-100 dark:border-slate-700">
                                    <div className="space-y-0.5">
                                        <span className="font-extrabold text-slate-900 dark:text-white text-sm block">
                                            Disponibilizar no Portal do Contribuinte
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block max-w-2xl">
                                            Permite que os fiéis visualizem esta campanha e possam aderir ou gerar seus próprios carnês diretamente no Portal.
                                        </span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                                        <input
                                            type="checkbox"
                                            checked={campIsPublished}
                                            onChange={(e) => setCampIsPublished(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-orange-500"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/50 mt-auto">
                            <button
                                type="button"
                                onClick={() => setIsCampaignModalOpen(false)}
                                className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-full shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-full shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                            >
                                {editingCampaign ? 'Salvar Alterações' : 'Criar Campanha'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Register Installment Payment */}
            {isPaymentModalOpen && selectedPledgeForPayment && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative space-y-4">
                        <button
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center">
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                Registrar Baixa de Parcela
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {selectedPledgeForPayment.contributorName}
                            </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Campanha:</span>
                                <strong className="text-slate-900 dark:text-white">{selectedPledgeForPayment.campaignTitle}</strong>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Parcela Atual:</span>
                                <strong>#{selectedPledgeForPayment.paidInstallments + 1} de {selectedPledgeForPayment.totalInstallments || '∞'}</strong>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-700">
                                <span>Valor da Parcela:</span>
                                <strong className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                                    {formatCurrency(selectedPledgeForPayment.amountPerInstallment)}
                                </strong>
                            </div>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Forma de Recebimento
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                                >
                                    <option value="pix">Pix (Confirmado)</option>
                                    <option value="dinheiro">Espécie / Dinheiro em Mãos</option>
                                    <option value="transferencia">Transferência Bancária</option>
                                    <option value="cartao">Cartão de Débito/Crédito</option>
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Observação / Recibo
                                </label>
                                <input
                                    type="text"
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="Ex: Recebido no culto de domingo..."
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={() => setIsPaymentModalOpen(false)}
                                className="flex-1 px-5 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmPayment}
                                className="flex-1 px-5 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Confirmar Recebimento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Panel View: WhatsApp Avisos & Message Content Editor */}
            {isWhatsAppModalOpen && whatsAppPledge && (
                <div 
                    style={{
                        transform: `translateY(${whatsappSwipeY}px)`,
                        opacity: isWhatsappSwiping ? Math.max(0.3, 1 - whatsappSwipeY / 400) : 1,
                        transition: isWhatsappSwiping ? 'none' : 'transform 0.25s ease-out, opacity 0.25s ease-out'
                    }}
                    className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden rounded-3xl shadow-2xl"
                >
                    <div className="flex flex-col h-full w-full overflow-hidden">
                        {/* Swipe Handle Bar */}
                        <div 
                            onMouseDown={(e) => {
                                whatsappSwipeStartRef.current = e.clientY;
                                setIsWhatsappSwiping(true);
                            }}
                            onTouchStart={(e) => {
                                whatsappSwipeStartRef.current = e.touches[0].clientY;
                                setIsWhatsappSwiping(true);
                            }}
                            className="w-full flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-white/5 shrink-0"
                            title="Deslize para baixo para fechar"
                        >
                            <div className="w-16 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full transition-all group-hover:bg-emerald-500 group-hover:w-20" />
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 opacity-80 group-hover:opacity-100">
                                Deslize para baixo para fechar
                            </span>
                        </div>

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                            <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
                                        <MessageSquare className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                            Avisos no WhatsApp & Lembretes Pastorais
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                            Edite a mensagem personalizada, escolha o destinatário e envie o aviso direto pelo WhatsApp
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsWhatsAppModalOpen(false)}
                                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Body */}
                        <div className="p-8 flex-1 overflow-y-auto space-y-8 custom-scrollbar text-xs">
                            
                            {/* Section 1: Seleção de Destinatário */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    1. Destinatário Selecionado
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Selecionar Contribuinte / Carnê Pendente
                                        </label>
                                        <select
                                            value={whatsAppPledge.id}
                                            onChange={(e) => {
                                                const selected = pledges.find(p => p.id === e.target.value);
                                                if (selected) {
                                                    handleOpenWhatsAppModal(selected);
                                                }
                                            }}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-emerald-500/10 py-3.5 px-5 transition-all outline-none text-sm font-bold cursor-pointer"
                                        >
                                            {pledges
                                                .filter(p => p.contributorPhone)
                                                .map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.contributorName} — {p.campaignTitle} ({formatCurrency(p.amountPerInstallment)})
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 block uppercase tracking-wider">Telefone / WhatsApp</span>
                                            <span className="font-black text-slate-900 dark:text-white text-sm">
                                                {whatsAppPledge.contributorPhone || 'Sem telefone'}
                                            </span>
                                        </div>
                                        <span className="px-2.5 py-1 text-[10px] font-black rounded-full uppercase bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                                            {whatsAppPledge.status === 'overdue' ? 'Atrasado' : 'Em Dia'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Editor de Mensagem */}
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                        2. Editar Conteúdo da Mensagem
                                    </h3>
                                    
                                    {/* Tags / Variáveis */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 mr-1">Tags Dinâmicas:</span>
                                        {[
                                            { tag: '{NOME}', label: 'Nome' },
                                            { tag: '{CAMPANHA}', label: 'Campanha' },
                                            { tag: '{PARCELA}', label: 'Parcela' },
                                            { tag: '{VALOR}', label: 'Valor' },
                                            { tag: '{VENCIMENTO}', label: 'Vencimento' },
                                        ].map((item) => (
                                            <button
                                                key={item.tag}
                                                type="button"
                                                onClick={() => insertTag(item.tag)}
                                                className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-100 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                                                title={`Inserir ${item.label}`}
                                            >
                                                + {item.tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Area de Edição */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Texto Personalizável da Mensagem
                                        </label>
                                        <textarea
                                            rows={10}
                                            value={whatsappCustomMessage}
                                            onChange={(e) => setWhatsappCustomMessage(e.target.value)}
                                            placeholder="Escreva a mensagem personalizada aqui..."
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-emerald-500/10 py-3.5 px-5 transition-all outline-none text-xs font-mono leading-relaxed"
                                        />
                                        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1">
                                            <span>Suporta formatação do WhatsApp (*negrito*, _itálico_)</span>
                                            <span>{whatsappCustomMessage.length} caracteres</span>
                                        </div>
                                    </div>

                                    {/* Visualizador / Prévia no balão do WhatsApp */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                            Prévia Visual no WhatsApp
                                        </label>
                                        <div className="bg-[#E5DDD5] dark:bg-[#0B141A] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 min-h-[220px] flex flex-col justify-end">
                                            <div className="bg-white dark:bg-[#202C33] text-slate-900 dark:text-slate-100 p-4 rounded-2xl shadow-sm border border-slate-200/50 dark:border-white/5 space-y-2 whitespace-pre-line text-xs font-sans leading-relaxed max-w-md self-end relative">
                                                {whatsappCustomMessage}
                                                <div className="text-[9px] text-slate-400 text-right mt-2 font-mono">
                                                    12:00 ✓✓
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/50 mt-auto shrink-0">
                            <button
                                type="button"
                                onClick={handleRestoreDefaultTemplate}
                                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all tracking-wider uppercase cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restaurar Padrão
                            </button>

                            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsWhatsAppModalOpen(false)}
                                    className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-full shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSaveWhatsAppTemplate}
                                    className="flex items-center gap-2 px-6 py-2.5 text-[10px] font-black text-slate-800 dark:text-white bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    Salvar Modelo
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSendWhatsApp}
                                    className="flex items-center gap-2 px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full shadow-md shadow-emerald-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    Abrir WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
