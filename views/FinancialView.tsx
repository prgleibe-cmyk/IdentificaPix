import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AppContext } from '../contexts/AppContext';
import { useTranslation } from '../contexts/I18nContext';
import { useUI } from '../contexts/UIContext';
import { 
    Plus, 
    Search, 
    Check, 
    X, 
    Calendar, 
    DollarSign, 
    Trash2, 
    User, 
    Users, 
    AlertCircle, 
    TrendingUp, 
    TrendingDown, 
    RefreshCw, 
    Edit, 
    Info,
    ChevronDown,
    Building,
    CheckCircle2,
    Link,
    Link2,
    Link2Off,
    AlertTriangle,
    FileSpreadsheet,
    PlusCircle,
    Sparkles
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

interface FinancialRecord {
    id: string;
    user_id: string;
    church_id: string | null;
    title: string;
    description: string;
    amount: number;
    type: 'invoice' | 'fixed' | 'other' | 'advance';
    status: 'pending' | 'paid';
    recipient_name: string;
    recipient_type: 'pastor' | 'employee' | 'supplier' | 'other';
    due_date: string | null;
    payment_date: string | null;
    recurrence: 'none' | 'monthly' | 'weekly';
    parent_id: string | null;
    bank_transaction_id?: string | null;
    bank_transaction_desc?: string | null;
    created_at: string;
    updated_at: string;
}

export const FinancialView: React.FC = () => {
    const { user } = useAuth();
    const { churches, matchResults } = useContext(AppContext);
    const { showToast, setActiveView } = useUI();
    const { language } = useTranslation();

    const [records, setRecords] = useState<FinancialRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'invoice' | 'fixed' | 'advance' | 'reconciliation'>('all');
    
    // Reconciliation active states
    const [selectedDebitId, setSelectedDebitId] = useState<string | null>(null);
    const [reconFilter, setReconFilter] = useState<'all' | 'pending' | 'matched'>('pending');
    const [reconSearch, setReconSearch] = useState('');
    const [reconPaneSearch, setReconPaneSearch] = useState('');
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChurchId, setSelectedChurchId] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');

    // New/Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);

    // Form State
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formType, setFormType] = useState<'invoice' | 'fixed' | 'other' | 'advance'>('invoice');
    const [formStatus, setFormStatus] = useState<'pending' | 'paid'>('pending');
    const [formRecipientName, setFormRecipientName] = useState('');
    const [formRecipientType, setFormRecipientType] = useState<'pastor' | 'employee' | 'supplier' | 'other'>('supplier');
    const [formChurchId, setFormChurchId] = useState<string>('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formPaymentDate, setFormPaymentDate] = useState('');
    const [formRecurrence, setFormRecurrence] = useState<'none' | 'monthly' | 'weekly'>('none');
    const [formBankTxId, setFormBankTxId] = useState<string | null>(null);
    const [formBankTxDesc, setFormBankTxDesc] = useState<string | null>(null);

    const fetchRecords = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/financial_records?user_id=${user.id}`);
            if (!res.ok) throw new Error('Falha ao buscar registros');
            const data = await res.json();
            setRecords(data);
        } catch (err: any) {
            console.error('Erro ao carregar registros financeiros:', err);
            showToast('Erro ao carregar registros financeiros.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
        if (churches && churches.length > 0) {
            setFormChurchId(churches[0].id);
        }
    }, [user?.id, churches]);

    // Summary calculation
    const summary = useMemo(() => {
        let totalPending = 0;
        let totalPaid = 0;
        let totalAdvances = 0;
        let overdueCount = 0;

        const today = new Date();
        today.setHours(0,0,0,0);

        records.forEach(r => {
            const amt = Number(r.amount);
            if (r.status === 'paid') {
                totalPaid += amt;
            } else {
                totalPending += amt;
                if (r.due_date) {
                    const due = new Date(r.due_date);
                    if (due < today) overdueCount++;
                }
            }
            if (r.type === 'advance') {
                totalAdvances += amt;
            }
        });

        return { totalPending, totalPaid, totalAdvances, overdueCount };
    }, [records]);

    // Handle delete
    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente excluir este registro financeiro?')) return;
        try {
            const res = await fetch(`/api/v1/financial_records/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Falha ao excluir registro');
            showToast('Registro excluído com sucesso!', 'success');
            fetchRecords();
        } catch (err: any) {
            console.error(err);
            showToast('Erro ao excluir registro.', 'error');
        }
    };

    // Toggle status
    const handleToggleStatus = async (record: FinancialRecord) => {
        const newStatus = record.status === 'pending' ? 'paid' : 'pending';
        const newPaymentDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;

        try {
            const res = await fetch(`/api/v1/financial_records/${record.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    payment_date: newPaymentDate
                })
            });
            if (!res.ok) throw new Error('Falha ao atualizar status');
            showToast(`Registro marcado como ${newStatus === 'paid' ? 'Pago' : 'Pendente'}`, 'success');
            fetchRecords();
        } catch (err: any) {
            console.error(err);
            showToast('Erro ao atualizar status.', 'error');
        }
    };

    // Open Modal for Create or Edit
    const openModal = (record: FinancialRecord | null = null) => {
        if (record) {
            setEditingRecord(record);
            setFormTitle(record.title);
            setFormDescription(record.description || '');
            setFormAmount(record.amount.toString());
            setFormType(record.type);
            setFormStatus(record.status);
            setFormRecipientName(record.recipient_name || '');
            setFormRecipientType(record.recipient_type || 'supplier');
            setFormChurchId(record.church_id || (churches && churches.length > 0 ? churches[0].id : ''));
            setFormDueDate(record.due_date ? record.due_date.split('T')[0] : '');
            setFormPaymentDate(record.payment_date ? record.payment_date.split('T')[0] : '');
            setFormRecurrence(record.recurrence || 'none');
            setFormBankTxId(record.bank_transaction_id || null);
            setFormBankTxDesc(record.bank_transaction_desc || null);
        } else {
            setEditingRecord(null);
            setFormTitle('');
            setFormDescription('');
            setFormAmount('');
            setFormType('invoice');
            setFormStatus('pending');
            setFormRecipientName('');
            setFormRecipientType('supplier');
            setFormChurchId(churches && churches.length > 0 ? churches[0].id : '');
            setFormDueDate('');
            setFormPaymentDate('');
            setFormRecurrence('none');
            setFormBankTxId(null);
            setFormBankTxDesc(null);
        }
        setIsModalOpen(true);
    };

    // Form Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle || !formAmount || !formType) {
            showToast('Por favor, preencha os campos obrigatórios.', 'error');
            return;
        }

        const payload = {
            user_id: user?.id,
            church_id: formChurchId || null,
            title: formTitle,
            description: formDescription,
            amount: parseFloat(formAmount),
            type: formType,
            status: formStatus,
            recipient_name: formRecipientName,
            recipient_type: formRecipientType,
            due_date: formDueDate ? new Date(formDueDate).toISOString() : null,
            payment_date: formPaymentDate ? new Date(formPaymentDate).toISOString() : null,
            recurrence: formRecurrence,
            bank_transaction_id: formBankTxId,
            bank_transaction_desc: formBankTxDesc
        };

        try {
            let res;
            if (editingRecord) {
                res = await fetch(`/api/v1/financial_records/${editingRecord.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/v1/financial_records', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) throw new Error('Falha ao salvar registro');
            showToast(editingRecord ? 'Lançamento atualizado!' : 'Lançamento cadastrado com sucesso!', 'success');
            setIsModalOpen(false);
            fetchRecords();
        } catch (err: any) {
            console.error(err);
            showToast('Erro ao salvar registro financeiro.', 'error');
        }
    };

    // === RECONCILIATION LOGIC ===

    // Parse all negative transactions (outflows/debits) from uploaded statement
    const bankDebits = useMemo(() => {
        const list: any[] = [];
        const seen = new Set<string>();
        const results = matchResults || [];
        
        results.forEach((r: any) => {
            if (r.transaction && r.transaction.amount < 0) {
                const txId = r.transaction.id;
                if (!seen.has(txId)) {
                    seen.add(txId);
                    // Check if already reconciled in our database records
                    const matchedRecord = records.find(rec => rec.bank_transaction_id === txId);
                    list.push({
                        transaction: r.transaction,
                        matchedRecord: matchedRecord || null
                    });
                }
            }
        });
        // Sort by date descending
        return list.sort((a, b) => new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime());
    }, [matchResults, records]);

    // Filtered debits based on search & filter tabs
    const filteredDebits = useMemo(() => {
        return bankDebits.filter(d => {
            // Filter by status (pending / matched)
            if (reconFilter === 'pending' && d.matchedRecord) return false;
            if (reconFilter === 'matched' && !d.matchedRecord) return false;

            // Search term
            if (reconSearch) {
                const term = reconSearch.toLowerCase();
                const matchDesc = d.transaction.description.toLowerCase().includes(term);
                const matchRaw = d.transaction.rawDescription?.toLowerCase().includes(term);
                const matchAmount = d.transaction.amount.toString().includes(term);
                if (!matchDesc && !matchRaw && !matchAmount) return false;
            }
            return true;
        });
    }, [bankDebits, reconFilter, reconSearch]);

    // Get number of pending debits
    const pendingDebitsCount = useMemo(() => {
        return bankDebits.filter(d => !d.matchedRecord).length;
    }, [bankDebits]);

    // Currently selected debit object
    const selectedDebit = useMemo(() => {
        if (!selectedDebitId) return null;
        return bankDebits.find(d => d.transaction.id === selectedDebitId) || null;
    }, [selectedDebitId, bankDebits]);

    // Pending records available to be associated with selected debit
    const pendingFinancialRecords = useMemo(() => {
        return records.filter(r => r.status === 'pending');
    }, [records]);

    // Suggest pending financial records based on closest amount match
    const suggestedRecords = useMemo(() => {
        if (!selectedDebit) return [];
        const debitAmt = Math.abs(selectedDebit.transaction.amount);
        
        return pendingFinancialRecords.filter(r => {
            const diff = Math.abs(Number(r.amount) - debitAmt);
            // Suggest if exact amount match or within 5% range
            const isAmountMatch = diff === 0 || diff / debitAmt <= 0.05;
            
            // Suggest if title contains parts of bank transaction description
            const descWords = selectedDebit.transaction.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const titleMatches = descWords.some(word => r.title.toLowerCase().includes(word));
            
            return isAmountMatch || titleMatches;
        });
    }, [selectedDebit, pendingFinancialRecords]);

    // Link a bank debit with a pending financial record
    const handleLinkRecord = async (recordId: string, transaction: any) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/financial_records/${recordId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'paid',
                    payment_date: transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    bank_transaction_id: transaction.id,
                    bank_transaction_desc: transaction.description
                })
            });
            if (!res.ok) throw new Error('Falha ao vincular lançamento');
            showToast('Lançamento financeiro conciliado com sucesso!', 'success');
            fetchRecords();
        } catch (err: any) {
            console.error(err);
            showToast('Erro ao conciliar lançamento financeiro.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Unlink a financial record from its bank transaction (Undo reconciliation)
    const handleUnlinkRecord = async (record: FinancialRecord) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/financial_records/${record.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'pending',
                    payment_date: null,
                    bank_transaction_id: null,
                    bank_transaction_desc: null
                })
            });
            if (!res.ok) throw new Error('Falha ao desvincular lançamento');
            showToast('Conciliação desfeita com sucesso!', 'success');
            fetchRecords();
        } catch (err: any) {
            console.error(err);
            showToast('Erro ao desfazer conciliação.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Open create modal pre-filled with bank debit details
    const handleImportAsExpense = (transaction: any) => {
        setEditingRecord(null);
        setFormTitle(transaction.description.toUpperCase());
        setFormDescription(`Lançado a partir de débito no extrato: ${transaction.description}`);
        setFormAmount(Math.abs(transaction.amount).toString());
        setFormType('invoice');
        setFormStatus('paid');
        setFormRecipientName('');
        setFormRecipientType('supplier');
        setFormChurchId(churches && churches.length > 0 ? churches[0].id : '');
        setFormDueDate(transaction.date ? transaction.date.split('T')[0] : '');
        setFormPaymentDate(transaction.date ? transaction.date.split('T')[0] : '');
        setFormRecurrence('none');
        setFormBankTxId(transaction.id);
        setFormBankTxDesc(transaction.description);
        setIsModalOpen(true);
    };

    // Filter logic
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            // Tab filter
            if (activeTab !== 'all' && r.type !== activeTab) return false;

            // Search term
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchTitle = r.title.toLowerCase().includes(term);
                const matchDesc = r.description?.toLowerCase().includes(term);
                const matchRecipient = r.recipient_name?.toLowerCase().includes(term);
                if (!matchTitle && !matchDesc && !matchRecipient) return false;
            }

            // Church filter
            if (selectedChurchId !== 'all' && r.church_id !== selectedChurchId) return false;

            // Status filter
            if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;

            return true;
        });
    }, [records, activeTab, searchTerm, selectedChurchId, selectedStatus]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                        <Building className="w-6 h-6 text-indigo-500" />
                        Controle Financeiro Integrado
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Gerencie faturas, despesas fixas, outros custos e adiantamentos de pastores e funcionários.
                    </p>
                </div>
                <button
                    onClick={() => openModal(null)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 transition-all text-sm cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    Novo Lançamento
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Pago (Mês)</span>
                        <span className="text-xl font-black text-emerald-500 font-mono">
                            {formatCurrency(summary.totalPaid, language)}
                        </span>
                    </div>
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Pendente</span>
                        <span className="text-xl font-black text-amber-500 font-mono">
                            {formatCurrency(summary.totalPending, language)}
                        </span>
                    </div>
                    <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-xl flex items-center justify-center">
                        <TrendingDown className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Adiantamentos Ativos</span>
                        <span className="text-xl font-black text-indigo-500 font-mono">
                            {formatCurrency(summary.totalAdvances, language)}
                        </span>
                    </div>
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Contas Atrasadas</span>
                        <span className={`text-xl font-black font-mono block ${summary.overdueCount > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                            {summary.overdueCount} {summary.overdueCount === 1 ? 'fatura' : 'faturas'}
                        </span>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${summary.overdueCount > 0 ? 'bg-red-50 dark:bg-red-950/30 text-red-500' : 'bg-slate-50 dark:bg-white/5 text-slate-400'}`}>
                        <AlertCircle className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Quick Filters / Search */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-4 rounded-2xl space-y-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Tabs */}
                    <div className="flex bg-slate-50 dark:bg-black/30 p-1 rounded-xl w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setActiveTab('invoice')}
                            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'invoice' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Faturas/Despesas
                        </button>
                        <button
                            onClick={() => setActiveTab('fixed')}
                            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'fixed' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Fixas Recorrentes
                        </button>
                        <button
                            onClick={() => setActiveTab('advance')}
                            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'advance' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Adiantamentos
                        </button>
                        <button
                            onClick={() => setActiveTab('reconciliation')}
                            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'reconciliation' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <span>Conciliar Extrato</span>
                            {pendingDebitsCount > 0 && (
                                <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none animate-pulse">
                                    {pendingDebitsCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Refresh Button */}
                    <button 
                        onClick={fetchRecords} 
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                        title="Atualizar"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {activeTab !== 'reconciliation' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por título, descrição ou beneficiário..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <select
                                value={selectedChurchId}
                                onChange={(e) => setSelectedChurchId(e.target.value)}
                                className="w-full px-4 py-2 text-xs font-semibold bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="all">Todas as Igrejas</option>
                                {churches?.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="w-full px-4 py-2 text-xs font-semibold bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="all">Todos os Status</option>
                                <option value="pending">Pendentes</option>
                                <option value="paid">Pagos</option>
                            </select>
                        </div>
                    </div>
                )}            {/* Records List or Reconciliation Split View */}
            {activeTab === 'reconciliation' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
                    {/* LEFT COLUMN: Bank statement debits */}
                    <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 space-y-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                            <div>
                                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider block">Débitos no Extrato</h3>
                                <p className="text-[10px] text-slate-400">Transações negativas encontradas no extrato.</p>
                            </div>
                            {/* Mode Selector (Pending vs Matched) */}
                            <div className="flex bg-slate-50 dark:bg-black/30 p-1 rounded-lg self-start sm:self-auto">
                                <button
                                    onClick={() => { setReconFilter('pending'); setSelectedDebitId(null); }}
                                    className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${reconFilter === 'pending' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400'}`}
                                >
                                    Pendentes
                                </button>
                                <button
                                    onClick={() => { setReconFilter('matched'); setSelectedDebitId(null); }}
                                    className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${reconFilter === 'matched' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400'}`}
                                >
                                    Conciliados
                                </button>
                            </div>
                        </div>

                        {/* Debits Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar transações do extrato..."
                                value={reconSearch}
                                onChange={(e) => setReconSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* List of Debits */}
                        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                            {bankDebits.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 flex flex-col items-center gap-3 bg-slate-50/50 dark:bg-black/10 rounded-xl">
                                    <FileSpreadsheet className="w-8 h-8 text-indigo-500 animate-bounce" />
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Nenhum extrato carregado</div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs">
                                        Para realizar a conciliação de despesas, você precisa importar um extrato (arquivos OFX ou planilhas Excel) na tela de Lançamento de Dados.
                                    </p>
                                    <button
                                        onClick={() => setActiveView('upload')}
                                        className="mt-2 flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] uppercase shadow-md shadow-indigo-600/10 transition-all active:scale-95 cursor-pointer"
                                    >
                                        <span>Importar Extrato Bancário</span>
                                    </button>
                                </div>
                            ) : filteredDebits.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-xs">
                                    Nenhuma transação encontrada para este filtro.
                                </div>
                            ) : (
                                filteredDebits.map((d) => {
                                    const isSelected = selectedDebitId === d.transaction.id;
                                    return (
                                        <div
                                            key={d.transaction.id}
                                            onClick={() => setSelectedDebitId(d.transaction.id)}
                                            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                                                isSelected 
                                                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-sm' 
                                                    : 'border-slate-150 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.01]'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[9px] font-mono font-bold text-slate-400 block">
                                                        {formatDate(d.transaction.date)}
                                                    </span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase block truncate" title={d.transaction.description}>
                                                        {d.transaction.description}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-mono font-black text-red-500 whitespace-nowrap">
                                                    {formatCurrency(Math.abs(d.transaction.amount), language)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-dashed border-slate-100 dark:border-white/5 pt-2 mt-1">
                                                {d.matchedRecord ? (
                                                    <div className="flex items-center gap-1.5 text-emerald-500">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-black uppercase">
                                                            Conciliado
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-amber-500">
                                                        <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                                                        <span className="text-[10px] font-bold uppercase">Pendente</span>
                                                    </div>
                                                )}

                                                {d.matchedRecord && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUnlinkRecord(d.matchedRecord);
                                                        }}
                                                        className="px-2 py-0.5 text-[9px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded border border-red-500/10 flex items-center gap-1 transition-all cursor-pointer"
                                                        title="Desfazer conciliação"
                                                    >
                                                        <Link2Off className="w-3 h-3" />
                                                        Desvincular
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Association Panel */}
                    <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-5 space-y-5 shadow-sm min-h-[300px]">
                        {!selectedDebit ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-20 text-slate-400 gap-3">
                                <Link className="w-10 h-10 text-indigo-500 animate-pulse" />
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Selecione uma transação do Extrato</span>
                                <span className="text-xs max-w-sm">
                                    Escolha um débito na lista ao lado para buscar lançamentos pendentes correspondentes ou realizar um novo cadastro integrado.
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fade-in">
                                {/* Active Transaction Header */}
                                <div className="bg-slate-50 dark:bg-black/30 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-white/5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Débito Selecionado no Extrato</span>
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <span className="text-sm font-black text-slate-800 dark:text-white uppercase leading-tight block">
                                                {selectedDebit.transaction.description}
                                            </span>
                                            <span className="text-xs font-mono font-semibold text-slate-500 mt-1 block">
                                                Data: {formatDate(selectedDebit.transaction.date)} | ID: {selectedDebit.transaction.id}
                                            </span>
                                        </div>
                                        <span className="text-base font-mono font-black text-red-500 whitespace-nowrap bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900/30">
                                            {formatCurrency(Math.abs(selectedDebit.transaction.amount), language)}
                                        </span>
                                    </div>

                                    {selectedDebit.matchedRecord ? (
                                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-900/40 p-3 rounded-lg text-emerald-700 dark:text-emerald-300 text-xs flex flex-col gap-1.5">
                                            <div className="font-bold flex items-center gap-1">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Esta transação já está conciliada!
                                            </div>
                                            <div className="font-medium text-[11px] opacity-90 pl-5">
                                                Vinculada ao lançamento: <strong className="uppercase">{selectedDebit.matchedRecord.title}</strong> ({formatCurrency(selectedDebit.matchedRecord.amount, language)})
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end pt-1">
                                            <button
                                                onClick={() => handleImportAsExpense(selectedDebit.transaction)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-white/5 dark:hover:bg-white/10 text-indigo-600 dark:text-indigo-400 rounded-lg font-black text-[10px] uppercase border border-indigo-500/10 transition-all active:scale-95 cursor-pointer animate-pulse"
                                            >
                                                <PlusCircle className="w-3.5 h-3.5" />
                                                Criar Lançamento com este Débito
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {!selectedDebit.matchedRecord && (
                                    <>
                                        {/* Suggested Matches Section */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                                                Sugestões de Vínculo Inteligente
                                            </h4>
                                            
                                            {suggestedRecords.length === 0 ? (
                                                <div className="p-4 text-center border border-dashed border-slate-100 dark:border-white/5 text-slate-400 text-xs rounded-xl bg-slate-50/20 dark:bg-black/5">
                                                    Nenhum lançamento pendente corresponde automaticamente a este valor ou descrição.
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {suggestedRecords.map(r => {
                                                        const isExactAmount = Math.abs(selectedDebit.transaction.amount) === Number(r.amount);
                                                        return (
                                                            <div key={r.id} className="p-3 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/10 dark:bg-indigo-950/10 rounded-xl flex items-center justify-between gap-4 transition-all hover:bg-indigo-50/20">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase">{r.title}</span>
                                                                        {isExactAmount && (
                                                                            <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide">
                                                                                Valor Exato
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                                                        {r.description || 'Sem descrição'} | Vencimento: {r.due_date ? formatDate(r.due_date) : '---'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-3 shrink-0">
                                                                    <span className="font-mono text-xs font-black text-slate-700 dark:text-slate-200">
                                                                        {formatCurrency(r.amount, language)}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleLinkRecord(r.id, selectedDebit.transaction)}
                                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] rounded-lg tracking-wider transition-all active:scale-95 shadow-sm shadow-indigo-600/10 cursor-pointer"
                                                                    >
                                                                        <Link2 className="w-3.5 h-3.5" />
                                                                        Vincular
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* All Other Pending Expenses */}
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                    Buscar Outros Lançamentos Pendentes
                                                </h4>
                                                <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full uppercase">
                                                    {pendingFinancialRecords.length} pendentes
                                                </span>
                                            </div>

                                            <div className="relative">
                                                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Pesquisar lançamentos pendentes..."
                                                    value={reconPaneSearch}
                                                    onChange={(e) => setReconPaneSearch(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>

                                            <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                                                {pendingFinancialRecords.length === 0 ? (
                                                    <div className="p-6 text-center text-slate-400 text-xs">
                                                        Nenhum lançamento financeiro pendente encontrado.
                                                    </div>
                                                ) : (
                                                    pendingFinancialRecords
                                                        .filter(r => {
                                                            if (reconPaneSearch) {
                                                                const term = reconPaneSearch.toLowerCase();
                                                                return r.title.toLowerCase().includes(term) || r.description?.toLowerCase().includes(term);
                                                            }
                                                            return true;
                                                        })
                                                        .map(r => (
                                                            <div key={r.id} className="p-2.5 border border-slate-100 dark:border-white/5 rounded-xl flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                                                                <div className="min-w-0">
                                                                    <span className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase block truncate">{r.title}</span>
                                                                    <span className="text-[9px] text-slate-400 block mt-0.5">
                                                                        Venc: {r.due_date ? formatDate(r.due_date) : '---'} | Fav: {r.recipient_name || '---'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                                                                        {formatCurrency(r.amount, language)}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleLinkRecord(r.id, selectedDebit.transaction)}
                                                                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-white/5 dark:hover:bg-indigo-600 text-slate-600 dark:text-slate-200 font-black uppercase text-[9px] rounded-lg transition-all cursor-pointer"
                                                                    >
                                                                        Vincular
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm animate-fade-in">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                            <span>Carregando dados financeiros...</span>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
                            <Info className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <span className="font-bold text-sm">Nenhum lançamento encontrado</span>
                            <span className="text-xs">Clique em "Novo Lançamento" para cadastrar sua primeira despesa ou adiantamento.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/10">
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Título / Descrição</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Igreja</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Favorecido</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Vencimento</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Valor</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map((record) => {
                                        const churchName = churches?.find((c: any) => c.id === record.church_id)?.name || '---';
                                        const isOverdue = record.status === 'pending' && record.due_date && new Date(record.due_date) < new Date();
                                        
                                        return (
                                            <tr key={record.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all">
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase flex items-center gap-1.5">
                                                        <span>{record.title}</span>
                                                        {record.bank_transaction_id && (
                                                            <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 border border-emerald-500/10 text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Conciliado com transação bancária">
                                                                <Link2 className="w-2.5 h-2.5" />
                                                                Conciliado
                                                            </span>
                                                        )}
                                                    </div>
                                                    {record.description && (
                                                        <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{record.description}</div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full uppercase">
                                                        {churchName}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {record.recipient_name ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="w-3 h-3 text-slate-400" />
                                                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                                                                {record.recipient_name}
                                                                <span className="text-[8px] bg-slate-50 dark:bg-white/5 text-slate-400 px-1 py-0.5 rounded ml-1.5 uppercase">
                                                                    {record.recipient_type === 'pastor' ? 'Pastor' : record.recipient_type === 'employee' ? 'Func.' : 'Fornec.'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">---</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {record.due_date ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`} />
                                                            <span className={`text-xs font-mono font-bold ${isOverdue ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                                                {formatDate(record.due_date)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">---</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                                        record.type === 'invoice' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-500' :
                                                        record.type === 'fixed' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-500' :
                                                        record.type === 'advance' ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500' :
                                                        'bg-slate-50 dark:bg-white/5 text-slate-400'
                                                    }`}>
                                                        {record.type === 'invoice' ? 'Fatura' : record.type === 'fixed' ? 'Fixa' : record.type === 'advance' ? 'Adiantam.' : 'Outra'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs font-mono font-black text-slate-700 dark:text-slate-200">
                                                    {formatCurrency(record.amount, language)}
                                                </td>
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => handleToggleStatus(record)}
                                                        className={`px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                                                            record.status === 'paid'
                                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 hover:bg-emerald-100'
                                                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-500 hover:bg-amber-100'
                                                        }`}
                                                    >
                                                        {record.status === 'paid' ? (
                                                            <>
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                PAGO
                                                            </>
                                                        ) : (
                                                            <>
                                                                <AlertCircle className="w-3 h-3" />
                                                                PENDENTE
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openModal(record)}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                                                            title="Editar"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(record.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
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
            </div>

            {/* Modal para Novo / Editar Lançamento */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] w-full max-w-xl shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-white/5">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                                {editingRecord ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-full transition-all cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Title & Amount */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Título *</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Fatura de Energia"
                                        value={formTitle}
                                        onChange={(e) => setFormTitle(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Valor *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formAmount}
                                        onChange={(e) => setFormAmount(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-mono font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descrição / Observações</label>
                                <textarea
                                    placeholder="Detalhes sobre a despesa ou finalidade do adiantamento..."
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500 h-20 resize-none"
                                />
                            </div>

                            {/* Church & Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Igreja Destinação</label>
                                    <select
                                        value={formChurchId}
                                        onChange={(e) => setFormChurchId(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        {churches?.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo de Lançamento *</label>
                                    <select
                                        value={formType}
                                        onChange={(e: any) => setFormType(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="invoice">Fatura / Despesa Geral</option>
                                        <option value="fixed">Despesa Fixa Recorrente</option>
                                        <option value="advance">Adiantamento</option>
                                        <option value="other">Outros</option>
                                    </select>
                                </div>
                            </div>

                            {/* Recipient Details */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Favorecido / Beneficiário</label>
                                    <input
                                        type="text"
                                        placeholder="Nome do pastor, funcionário ou fornecedor"
                                        value={formRecipientName}
                                        onChange={(e) => setFormRecipientName(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo do Favorecido</label>
                                    <select
                                        value={formRecipientType}
                                        onChange={(e: any) => setFormRecipientType(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="pastor">Pastor</option>
                                        <option value="employee">Funcionário</option>
                                        <option value="supplier">Fornecedor</option>
                                        <option value="other">Outro</option>
                                    </select>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Data de Vencimento</label>
                                    <input
                                        type="date"
                                        value={formDueDate}
                                        onChange={(e) => setFormDueDate(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-mono font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Data de Pagamento</label>
                                    <input
                                        type="date"
                                        value={formPaymentDate}
                                        onChange={(e) => setFormPaymentDate(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-mono font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Status & Recurrence */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status Inicial</label>
                                    <select
                                        value={formStatus}
                                        onChange={(e: any) => setFormStatus(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="pending">Pendente / Não Pago</option>
                                        <option value="paid">Pago</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recorrência</label>
                                    <select
                                        value={formRecurrence}
                                        onChange={(e: any) => setFormRecurrence(e.target.value)}
                                        className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="none">Nenhuma</option>
                                        <option value="monthly">Mensal</option>
                                        <option value="weekly">Semanal</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-xs font-extrabold bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                                >
                                    Salvar Lançamento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
