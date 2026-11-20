import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, 
    Trash2, 
    Edit, 
    Calendar, 
    DollarSign, 
    AlertTriangle, 
    Check, 
    X,
    User, 
    CheckCircle, 
    Settings,
    ArrowUpRight,
    ArrowDownLeft,
    PiggyBank,
    Clock,
    Sparkles,
    RefreshCw
} from 'lucide-react';
import { PastorAutomation } from '../types/domain';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Language } from '../types/ui';
import { WhatsAppTemplateConfig } from './WhatsAppTemplateConfig';
import { getAuthToken } from '../services/auth/authAdapter';

interface PastorAutomationTabProps {
    user: any;
    churches: any[];
    records: any[];
    fetchRecords: () => Promise<void>;
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    language: Language;
}

export const PastorAutomationTab: React.FC<PastorAutomationTabProps> = ({
    user,
    churches,
    records,
    fetchRecords,
    showToast,
    language
}) => {
    const [rules, setRules] = useState<PastorAutomation[]>([]);
    const [loading, setLoading] = useState(false);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<PastorAutomation | null>(null);

    // Form rule states
    const [pastorName, setPastorName] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [pixKeyType, setPixKeyType] = useState('cpf');
    const [paymentDay, setPaymentDay] = useState(10);
    const [grossAmount, setGrossAmount] = useState('');
    const [titheEnabled, setTitheEnabled] = useState(true);
    const [titheAmount, setTitheAmount] = useState('');
    const [churchId, setChurchId] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Advance Modal States
    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
    const [selectedRuleForAdvance, setSelectedRuleForAdvance] = useState<PastorAutomation | null>(null);
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().substring(0, 10));
    const [advanceDescription, setAdvanceDescription] = useState('Adiantamento de Espótula');

    const fetchRules = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
            const res = await fetch(`/api/v1/pastor_automations?user_id=${user.id}`, { headers });
            if (!res.ok) throw new Error('Falha ao carregar regras de automação');
            const data = await res.json();
            setRules(data);
        } catch (err: any) {
            console.error('Erro ao buscar regras de pastores:', err);
            showToast('Erro ao carregar regras de automação.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, [user?.id]);

    // Handle automated net value calculation
    const calculatedNet = useMemo(() => {
        const gross = parseFloat(grossAmount) || 0;
        const tithe = titheEnabled ? (parseFloat(titheAmount) || 0) : 0;
        return Math.max(0, gross - tithe);
    }, [grossAmount, titheEnabled, titheAmount]);

    // Open Modal for New Rule
    const handleNewRule = () => {
        setEditingRule(null);
        setPastorName('');
        setPixKey('');
        setPixKeyType('cpf');
        setPaymentDay(10);
        setGrossAmount('3000');
        setTitheEnabled(true);
        setTitheAmount('300');
        setChurchId(churches[0]?.id || '');
        setIsActive(true);
        setIsRuleModalOpen(true);
    };

    // Open Modal for Editing Rule
    const handleEditRule = (rule: PastorAutomation) => {
        setEditingRule(rule);
        setPastorName(rule.pastor_name);
        setPixKey(rule.pix_key);
        setPixKeyType(rule.pix_key_type);
        setPaymentDay(rule.payment_day);
        setGrossAmount(rule.gross_amount.toString());
        setTitheEnabled(rule.tithe_enabled);
        setTitheAmount(rule.tithe_amount.toString());
        setChurchId(rule.church_id || '');
        setIsActive(rule.active);
        setIsRuleModalOpen(true);
    };

    // Save or Update Rule
    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;

        if (!pastorName.trim()) {
            showToast('O nome do pastor é obrigatório.', 'error');
            return;
        }
        if (!pixKey.trim()) {
            showToast('A chave Pix é obrigatória.', 'error');
            return;
        }

        const gross = parseFloat(grossAmount) || 0;
        const tithe = titheEnabled ? (parseFloat(titheAmount) || 0) : 0;
        const net = Math.max(0, gross - tithe);

        const payload = {
            user_id: user.id,
            pastor_name: pastorName.trim(),
            pix_key: pixKey.trim(),
            pix_key_type: pixKeyType,
            payment_day: Number(paymentDay),
            gross_amount: gross,
            net_amount: net,
            tithe_amount: tithe,
            tithe_enabled: titheEnabled,
            church_id: churchId || null,
            active: isActive
        };

        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            let res;
            if (editingRule) {
                res = await fetch(`/api/v1/pastor_automations/${editingRule.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/v1/pastor_automations', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) throw new Error('Erro ao salvar regra');
            showToast(editingRule ? 'Regra atualizada com sucesso!' : 'Regra de automação criada com sucesso!', 'success');
            setIsRuleModalOpen(false);
            fetchRules();
        } catch (err: any) {
            console.error('Erro ao salvar regra:', err);
            showToast('Erro ao salvar regra de automação.', 'error');
        }
    };

    // Delete Rule
    const handleDeleteRule = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir esta regra de automação?')) return;
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
            const res = await fetch(`/api/v1/pastor_automations/${id}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) throw new Error('Erro ao deletar regra');
            showToast('Regra de automação excluída com sucesso.', 'success');
            fetchRules();
        } catch (err: any) {
            console.error('Erro ao excluir regra:', err);
            showToast('Erro ao excluir regra de automação.', 'error');
        }
    };

    // Current month advances calculation
    const currentMonthAdvances = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        return records.filter(r => {
            const isAdvance = r.type === 'advance' || (r.title && r.title.toLowerCase().includes('adiantamento')) || (r.description && r.description.toLowerCase().includes('adiantamento'));
            if (!isAdvance) return false;
            
            const dateStr = r.payment_date || r.due_date || r.created_at;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
    }, [records]);

    // Current month main payments calculation (to check if already paid)
    const currentMonthPayments = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        return records.filter(r => {
            const titleLower = r.title ? r.title.toLowerCase() : '';
            const isPayment = titleLower.includes('espótula') || titleLower.includes('recorrente') || titleLower.includes('mensalidade');
            if (!isPayment) return false;
            if (r.status !== 'paid') return false;

            const dateStr = r.payment_date || r.due_date || r.created_at;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
    }, [records]);

    // Register Advance
    const handleOpenAdvance = (rule: PastorAutomation) => {
        setSelectedRuleForAdvance(rule);
        setAdvanceAmount('');
        setAdvanceDescription(`Adiantamento Recorrente - ${rule.pastor_name}`);
        setAdvanceDate(new Date().toISOString().substring(0, 10));
        setIsAdvanceModalOpen(true);
    };

    const handleSaveAdvance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !selectedRuleForAdvance) return;

        const amt = parseFloat(advanceAmount);
        if (!amt || amt <= 0) {
            showToast('Insira um valor de adiantamento válido.', 'error');
            return;
        }

        const isPastor = selectedRuleForAdvance.pastor_name.toLowerCase().includes('pr.') || selectedRuleForAdvance.pastor_name.toLowerCase().includes('pastor');
        const advanceTitle = isPastor ? `Adiantamento - ${selectedRuleForAdvance.pastor_name}` : `Adiantamento Recorrente - ${selectedRuleForAdvance.pastor_name}`;

        const payload = {
            user_id: user.id,
            church_id: selectedRuleForAdvance.church_id || null,
            title: advanceTitle,
            description: advanceDescription.trim(),
            amount: amt,
            type: 'advance',
            status: 'paid',
            recipient_name: selectedRuleForAdvance.pastor_name,
            recipient_type: 'pastor',
            due_date: advanceDate,
            payment_date: advanceDate,
            recurrence: 'none'
        };

        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/v1/financial_records', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao registrar adiantamento');
            showToast('Adiantamento registrado com sucesso!', 'success');
            setIsAdvanceModalOpen(false);
            fetchRecords(); // refresh records to recalculate balances
        } catch (err: any) {
            console.error('Erro ao registrar adiantamento:', err);
            showToast('Erro ao registrar adiantamento.', 'error');
        }
    };

    // Confirm monthly payment & generate double-entry (Recorrente Outflow + Discount/Tithe Inflow)
    const handleConfirmMonthlyPayment = async (rule: PastorAutomation, remainingAmount: number) => {
        if (!user?.id) return;

        const isPastor = rule.pastor_name.toLowerCase().includes('pr.') || rule.pastor_name.toLowerCase().includes('pastor');
        const termBruto = isPastor ? 'Espótula Bruta' : 'Valor Bruto';
        const termDesconto = isPastor ? 'Entrada de Dízimo Retido' : 'Desconto/Contribuição Retida';

        const confirmMsg = `Confirmar o pagamento mensal para ${rule.pastor_name}?\n` +
            `Isso irá lançar:\n` +
            `- Uma Saída (${termBruto}) de R$ ${rule.gross_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
            `${rule.tithe_enabled ? `- Uma ${termDesconto} de R$ ${rule.tithe_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` : ''}` +
            `Valor líquido final a ser transferido: R$ ${remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const today = new Date().toISOString().substring(0, 10);
            
            // 1. Launch Gross Outflow
            const mainTitle = isPastor ? `Espótula - ${rule.pastor_name}` : `Recorrente - ${rule.pastor_name}`;
            const mainDesc = isPastor ? `Pagamento mensal de espótula integral para ${rule.pastor_name}` : `Pagamento mensal recorrente integral para ${rule.pastor_name}`;

            const expensePayload = {
                user_id: user.id,
                church_id: rule.church_id || null,
                title: mainTitle,
                description: mainDesc,
                amount: rule.gross_amount,
                type: 'fixed',
                status: 'paid',
                recipient_name: rule.pastor_name,
                recipient_type: 'pastor',
                due_date: today,
                payment_date: today,
                recurrence: 'none'
            };

            const token = await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const expRes = await fetch('/api/v1/financial_records', {
                method: 'POST',
                headers,
                body: JSON.stringify(expensePayload)
            });

            if (!expRes.ok) throw new Error('Falha ao lançar despesa recorrente');

            // 2. Launch Discount/Tithe Inflow if enabled
            if (rule.tithe_enabled && rule.tithe_amount > 0) {
                const discountTitle = isPastor ? `Dízimo Retido - ${rule.pastor_name}` : `Retenção/Desconto - ${rule.pastor_name}`;
                const discountDesc = isPastor ? `Dízimo de pastor retido/descontado em folha` : `Desconto/contribuição retida de pagamento recorrente`;

                const incomePayload = {
                    user_id: user.id,
                    church_id: rule.church_id || null,
                    title: discountTitle,
                    description: discountDesc,
                    amount: rule.tithe_amount,
                    type: 'receivable', // income
                    status: 'paid',
                    recipient_name: rule.pastor_name,
                    recipient_type: 'pastor',
                    due_date: today,
                    payment_date: today,
                    recurrence: 'none'
                };

                const incRes = await fetch('/api/v1/financial_records', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(incomePayload)
                });

                if (!incRes.ok) throw new Error('Falha ao lançar retenção/desconto');
            }

            showToast('Lançamentos recorrentes realizados com sucesso!', 'success');
            fetchRecords();
        } catch (err: any) {
            console.error('Erro ao efetuar pagamento mensal:', err);
            showToast('Erro ao realizar lançamentos recorrentes.', 'error');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in relative min-h-[500px]">
            {/* Top overview card */}
            <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0 mt-0.5">
                        <PiggyBank className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                        <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                            Automação de Lançamentos Recorrentes
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                            Configure e acompanhe pagamentos recorrentes para prestadores de serviços, fornecedores ou colaboradores. Controle adiantamentos avulsos, retenções mensais e gere lançamentos automáticos no extrato.
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleNewRule}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg shadow-xs text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    Nova Regra
                </button>
            </div>

            {/* List of rules */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Active Rules List */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            <Settings className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            Regras Ativas de Recorrência
                        </h3>
                        <button 
                            onClick={fetchRules}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                            title="Atualizar lista"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                            <RefreshCw className="w-5 h-5 animate-spin text-orange-600" />
                            <span className="text-xs font-medium">Buscando regras...</span>
                        </div>
                    ) : rules.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                            <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nenhuma regra cadastrada</span>
                            <span className="text-xs text-slate-400">Cadastre regras de recorrência para automatizar lançamentos.</span>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                            {rules.map((rule) => {
                                const church = churches.find(c => c.id === rule.church_id);
                                const isRulePastor = rule.pastor_name.toLowerCase().includes('pr.') || rule.pastor_name.toLowerCase().includes('pastor');

                                return (
                                    <div key={rule.id} className={`p-4 border rounded-xl flex flex-col gap-3 transition-colors ${rule.active ? 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30' : 'border-slate-200/60 dark:border-slate-800/60 opacity-60 bg-slate-100/50 dark:bg-slate-900/40'}`}>
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                                    <User className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                                                    {rule.pastor_name}
                                                    {!rule.active && (
                                                        <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold px-2 py-0.5 rounded-md">Inativo</span>
                                                    )}
                                                </h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                                                    Igreja: {church ? church.name : '---'} • Chave Pix ({rule.pix_key_type.toUpperCase()}): {rule.pix_key}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => handleEditRule(rule)}
                                                    className="p-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-300 transition-colors cursor-pointer"
                                                    title="Editar Regra"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border border-rose-200/60 dark:border-rose-900/40 rounded-lg text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                                    title="Excluir Regra"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Amounts Breakdown Grid */}
                                        <div className="grid grid-cols-3 gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                                            <div className="text-center">
                                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wide">{isRulePastor ? 'Espótula Bruta' : 'Valor Bruto'}</span>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums block mt-0.5">
                                                    {formatCurrency(rule.gross_amount, language)}
                                                </span>
                                            </div>
                                            <div className="text-center border-x border-slate-100 dark:border-slate-800">
                                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wide">{isRulePastor ? 'Dízimo Desconto' : 'Retenção/Desconto'}</span>
                                                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums block mt-0.5">
                                                    {rule.tithe_enabled ? `- ${formatCurrency(rule.tithe_amount, language)}` : '---'}
                                                </span>
                                            </div>
                                            <div className="text-center">
                                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wide">Pix Líquido Final</span>
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
                                                    {formatCurrency(rule.net_amount, language)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                            <span className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                                Vencimento recorrente: Todo dia {rule.payment_day}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Reminders & Real-time Alerts Panel */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs flex flex-col">
                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            Lembretes e Controle de Saldos
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Calculado dinamicamente com base em adiantamentos e pagamentos confirmados no mês atual.</p>
                    </div>

                    <div className="space-y-4 flex-1 overflow-y-auto max-h-[550px] pr-1 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                        {rules.filter(r => r.active).length === 0 ? (
                            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                                <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nenhum lembrete para este mês</span>
                                <span className="text-xs text-slate-400">Ative ou cadastre regras de recorrência para visualizar os status de vencimento.</span>
                            </div>
                        ) : (
                            rules.filter(r => r.active).map(rule => {
                                // Calculate total advances this month
                                const ruleAdvances = currentMonthAdvances.filter(adv => adv.recipient_name?.toLowerCase() === rule.pastor_name.toLowerCase());
                                const totalAdvances = ruleAdvances.reduce((sum, r) => sum + Number(r.amount), 0);
                                const finalRemainingToPay = Math.max(0, rule.net_amount - totalAdvances);

                                // Check if already paid this month
                                const isAlreadyPaid = currentMonthPayments.some(pay => pay.recipient_name?.toLowerCase() === rule.pastor_name.toLowerCase());

                                return (
                                    <div key={`reminder-${rule.id}`} className={`p-4 border rounded-xl flex flex-col gap-3 relative overflow-hidden ${isAlreadyPaid ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/15' : totalAdvances > 0 ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/15' : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30'}`}>
                                        
                                        {/* Status header banner */}
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                {rule.pastor_name}
                                            </span>
                                            {isAlreadyPaid ? (
                                                <span className="bg-emerald-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Pago este mês
                                                </span>
                                            ) : (
                                                <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 tabular-nums">
                                                    <Clock className="w-3 h-3 text-orange-600 dark:text-orange-400" /> Pendente dia {rule.payment_day}
                                                </span>
                                            )}
                                        </div>

                                        {/* Real-time Advance Warning alert */}
                                        {totalAdvances > 0 ? (
                                            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-lg text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                                <div className="space-y-0.5">
                                                    <span className="text-[11px] font-bold block leading-none">Atenção: Adiantamentos Detectados</span>
                                                    <p className="text-xs leading-relaxed">
                                                        Este favorecido recebeu um total de <strong className="tabular-nums">{formatCurrency(totalAdvances, language)}</strong> em adiantamentos este mês.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-lg text-slate-500 dark:text-slate-400 text-xs">
                                                Nenhum adiantamento registrado para este favorecido neste mês.
                                            </div>
                                        )}

                                        {/* List details of registered advances in small tags */}
                                        {ruleAdvances.length > 0 && (
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">Lista de Adiantamentos:</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {ruleAdvances.map(adv => (
                                                        <span key={adv.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1.5 tabular-nums">
                                                            <span>{formatDate(adv.payment_date || adv.due_date || adv.created_at)}</span>
                                                            <span className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">{formatCurrency(adv.amount, language)}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Bottom remaining calculation statement */}
                                        <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                                            <div>
                                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">Líquido Ajustado</span>
                                                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums block mt-0.5">
                                                    {formatCurrency(finalRemainingToPay, language)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Register Advance Trigger */}
                                                {!isAlreadyPaid && (
                                                    <button
                                                        onClick={() => handleOpenAdvance(rule)}
                                                        className="px-3 py-1.5 border border-amber-300 dark:border-amber-700/60 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                    >
                                                        Registrar Adiantamento
                                                    </button>
                                                )}

                                                {/* Action to auto split and confirm payment */}
                                                {!isAlreadyPaid && (
                                                    <button
                                                        onClick={() => handleConfirmMonthlyPayment(rule, finalRemainingToPay)}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Confirmar Pagamento
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Section: Configuração de Mensagens de Agradecimento e Bênção Pastoral via WhatsApp */}
            <WhatsAppTemplateConfig showToast={showToast as any} />

            {/* MODAL 1: Create or Edit Rule - Suspended Sub-Screen Modal */}
            {isRuleModalOpen && (
                <div
                    className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setIsRuleModalOpen(false); }}
                >
                    <form
                        onSubmit={handleSaveRule}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-elevated w-full max-w-3xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
                    >
                        {/* Header */}
                        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center gap-3 shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                                    <Settings className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                                        {editingRule ? 'Editar Regra de Automação' : 'Nova Regra de Automação'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                                        {editingRule ? 'Atualizar regra de pagamento recorrente' : 'Cadastrar automação de fornecedor ou prestador'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setIsRuleModalOpen(false)} 
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 flex-1 overflow-y-auto w-full custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                            <div className="space-y-5 w-full max-w-3xl mx-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Nome do Beneficiário / Prestador *
                                        </label>
                                        <input
                                            type="text"
                                            value={pastorName}
                                            onChange={(e) => setPastorName(e.target.value)}
                                            placeholder="Ex: Pr. João Santos, Maria Silva, Fornecedor"
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-medium"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Igreja Associada
                                        </label>
                                        <select
                                            value={churchId}
                                            onChange={(e) => setChurchId(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-medium"
                                        >
                                            <option value="">Selecione uma Igreja...</option>
                                            {churches.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Tipo de Chave Pix
                                        </label>
                                        <select
                                            value={pixKeyType}
                                            onChange={(e) => setPixKeyType(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-medium"
                                        >
                                            <option value="cpf">CPF</option>
                                            <option value="cnpj">CNPJ</option>
                                            <option value="phone">Celular</option>
                                            <option value="email">E-mail</option>
                                            <option value="random">Chave Aleatória</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Chave Pix *
                                        </label>
                                        <input
                                            type="text"
                                            value={pixKey}
                                            onChange={(e) => setPixKey(e.target.value)}
                                            placeholder="Digite a chave pix..."
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-medium"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Dia de Vencimento *
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={paymentDay}
                                            onChange={(e) => setPaymentDay(Math.min(31, Math.max(1, Number(e.target.value))))}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-semibold tabular-nums"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Valor Bruto (R$) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={grossAmount}
                                            onChange={(e) => setGrossAmount(e.target.value)}
                                            placeholder="Ex: 3000"
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-semibold tabular-nums"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                                                Habilitar Desconto Retido (Ex: Dízimo)
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                Deduzir valor automaticamente do pagamento líquido final.
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={titheEnabled}
                                            onChange={(e) => setTitheEnabled(e.target.checked)}
                                            className="w-4 h-4 accent-orange-600 cursor-pointer rounded"
                                        />
                                    </div>

                                    {titheEnabled && (
                                        <div className="space-y-1.5 animate-fade-in">
                                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                                Valor do Desconto / Retenção (R$)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={titheAmount}
                                                onChange={(e) => setTitheAmount(e.target.value)}
                                                placeholder="Ex: 300"
                                                className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-semibold tabular-nums"
                                            />
                                        </div>
                                    )}

                                    <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex justify-between items-center text-xs">
                                        <span className="font-semibold text-slate-600 dark:text-slate-300">Valor Líquido do Pix:</span>
                                        <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400 text-base">
                                            {formatCurrency(calculatedNet, language)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 bg-slate-50/70 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="w-4 h-4 accent-orange-600 cursor-pointer rounded"
                                    />
                                    <label htmlFor="isActive" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                        Regra Ativa (habilitar lembretes automáticos e controle de saldos)
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-4 flex justify-end gap-3 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
                            <button 
                                type="button" 
                                onClick={() => setIsRuleModalOpen(false)} 
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                                {editingRule ? 'Salvar Alterações' : 'Criar Automação'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL 2: Register Advance - Suspended Sub-Screen Modal */}
            {isAdvanceModalOpen && selectedRuleForAdvance && (
                <div
                    className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setIsAdvanceModalOpen(false); }}
                >
                    <form
                        onSubmit={handleSaveAdvance}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-elevated w-full max-w-2xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
                    >
                        {/* Header */}
                        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center gap-3 shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                                    <Plus className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                                        Registrar Adiantamento
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                                        Lançar adiantamento de valor recorrente
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setIsAdvanceModalOpen(false)} 
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 flex-1 overflow-y-auto w-full custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                            <div className="space-y-5 w-full max-w-3xl mx-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Favorecido / Beneficiário
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedRuleForAdvance.pastor_name}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-2.5 px-3.5 text-sm font-medium cursor-not-allowed outline-none"
                                            disabled
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Valor do Adiantamento (R$) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={advanceAmount}
                                            onChange={(e) => setAdvanceAmount(e.target.value)}
                                            placeholder="Ex: 500"
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-semibold tabular-nums"
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Data do Adiantamento *
                                        </label>
                                        <input
                                            type="date"
                                            value={advanceDate}
                                            onChange={(e) => setAdvanceDate(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-medium tabular-nums"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Descrição / Finalidade *
                                        </label>
                                        <input
                                            type="text"
                                            value={advanceDescription}
                                            onChange={(e) => setAdvanceDescription(e.target.value)}
                                            placeholder="Ex: Adiantamento solicitado para despesas extraordinárias"
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 py-2.5 px-3.5 transition-all outline-none text-sm font-medium"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 dark:bg-slate-900/80 px-6 py-4 flex justify-end gap-3 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
                            <button 
                                type="button" 
                                onClick={() => setIsAdvanceModalOpen(false)} 
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                                Registrar Adiantamento
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
