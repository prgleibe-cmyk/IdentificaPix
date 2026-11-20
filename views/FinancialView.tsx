import React, { useState, useEffect, useContext, useMemo, memo } from 'react';
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
    Sparkles,
    SlidersHorizontal,
    Zap,
    FileText,
    Paperclip,
    Eye,
    CheckCircle,
    HelpCircle,
    FileCheck,
    FileMinus,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate, isPeriodClosed } from '../utils/formatters';
import { PastorAutomationTab } from '../components/PastorAutomationTab';
import { ExpenseDocumentUploader } from '../components/financial/ExpenseDocumentUploader';
import { ExpenseAttachment, ExtractedExpenseDoc, ExpenseValidationStatus, validateExpenseAgainstDocument } from '../utils/expenseDocumentParser';
import { getAuthToken } from '../services/auth/authAdapter';

interface FinancialRecord {
    id: string;
    user_id: string;
    church_id: string | null;
    account_id?: string | null;
    bank_id?: string | null;
    title: string;
    description: string;
    amount: number;
    type: 'invoice' | 'fixed' | 'other' | 'advance' | 'receivable';
    status: 'pending' | 'paid';
    recipient_name: string;
    recipient_type: 'pastor' | 'employee' | 'supplier' | 'other';
    due_date: string | null;
    payment_date: string | null;
    recurrence: 'none' | 'monthly' | 'weekly';
    parent_id: string | null;
    bank_transaction_id?: string | null;
    bank_transaction_desc?: string | null;
    attachments?: ExpenseAttachment[];
    validation_status?: ExpenseValidationStatus;
    validation_notes?: string;
    created_at: string;
    updated_at: string;
}

const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
];

export const FinancialView: React.FC = memo(() => {
    const { user, subscription, isSecondaryUser } = useAuth();
    const { churches, matchResults, banks } = useContext(AppContext);
    const { showToast, setActiveView } = useUI();
    const { language } = useTranslation();

    const allowedBankIds = useMemo(() => {
        if (!isSecondaryUser) return null;
        return subscription?.bankIds || [];
    }, [isSecondaryUser, subscription?.bankIds]);

    const availableBanks = useMemo(() => {
        const raw = banks || [];
        if (!isSecondaryUser || !allowedBankIds || allowedBankIds.length === 0) return raw;
        return raw.filter((b: any) => allowedBankIds.includes(b.id));
    }, [banks, isSecondaryUser, allowedBankIds]);

    const [records, setRecords] = useState<FinancialRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'payable' | 'receivable' | 'payments' | 'reconciliation' | 'pastors'>('payable');
    
    // Reconciliation active states
    const [selectedDebitId, setSelectedDebitId] = useState<string | null>(null);
    const [reconFilter, setReconFilter] = useState<'all' | 'pending' | 'matched'>('pending');
    const [reconSearch, setReconSearch] = useState('');
    const [reconPaneSearch, setReconPaneSearch] = useState('');
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChurchId, setSelectedChurchId] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [dateRangeType, setDateRangeType] = useState<'all' | 'this_month' | 'last_month' | 'last_30' | 'custom'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Advanced Filters Modal States
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [tempChurchId, setTempChurchId] = useState('all');
    const [tempStatus, setTempStatus] = useState('all');
    const [tempYear, setTempYear] = useState('all');
    const [tempMonth, setTempMonth] = useState('all');
    const [tempDateRangeType, setTempDateRangeType] = useState<'all' | 'this_month' | 'last_month' | 'last_30' | 'custom'>('all');
    const [tempStartDate, setTempStartDate] = useState('');
    const [tempEndDate, setTempEndDate] = useState('');

    useEffect(() => {
        if (isFilterModalOpen) {
            setTempChurchId(selectedChurchId);
            setTempStatus(selectedStatus);
            setTempYear(selectedYear);
            setTempMonth(selectedMonth);
            setTempDateRangeType(dateRangeType);
            setTempStartDate(startDate);
            setTempEndDate(endDate);
        }
    }, [isFilterModalOpen, selectedChurchId, selectedStatus, selectedYear, selectedMonth, dateRangeType, startDate, endDate]);

    const handleApplyFilters = () => {
        setSelectedChurchId(tempChurchId);
        setSelectedStatus(tempStatus);
        setSelectedYear(tempYear);
        setSelectedMonth(tempMonth);
        setDateRangeType(tempDateRangeType);
        setStartDate(tempStartDate);
        setEndDate(tempEndDate);
        setIsFilterModalOpen(false);
    };

    const handleClearAllFilters = () => {
        setSelectedChurchId('all');
        setSelectedStatus('all');
        setSelectedYear('all');
        setSelectedMonth('all');
        setDateRangeType('all');
        setStartDate('');
        setEndDate('');
        setIsFilterModalOpen(false);
    };

    const hasActiveFilters = selectedChurchId !== 'all' || selectedStatus !== 'all' || dateRangeType !== 'all' || selectedYear !== 'all' || selectedMonth !== 'all';
    
    const activeFiltersCount = [
        selectedChurchId !== 'all',
        selectedStatus !== 'all',
        dateRangeType !== 'all',
        selectedYear !== 'all',
        selectedMonth !== 'all'
    ].filter(Boolean).length;

    // New/Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);

    // Form State
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formType, setFormType] = useState<'invoice' | 'fixed' | 'other' | 'advance' | 'receivable'>('invoice');
    const [formStatus, setFormStatus] = useState<'pending' | 'paid'>('pending');
    const [formRecipientName, setFormRecipientName] = useState('');
    const [formRecipientType, setFormRecipientType] = useState<'pastor' | 'employee' | 'supplier' | 'other'>('supplier');
    const [formChurchId, setFormChurchId] = useState<string>('');
    const [formBankId, setFormBankId] = useState<string>('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formPaymentDate, setFormPaymentDate] = useState('');
    const [formRecurrence, setFormRecurrence] = useState<'none' | 'monthly' | 'weekly'>('none');
    const [formBankTxId, setFormBankTxId] = useState<string | null>(null);
    const [formBankTxDesc, setFormBankTxDesc] = useState<string | null>(null);
    const [formAttachments, setFormAttachments] = useState<ExpenseAttachment[]>([]);
    const [documentValidationFilter, setDocumentValidationFilter] = useState<'all' | 'validated' | 'divergent' | 'pending_attachment'>('all');
    const [selectedDocPreview, setSelectedDocPreview] = useState<{ record: FinancialRecord; attachment?: ExpenseAttachment } | null>(null);

    const fetchRecords = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const targetUserId = subscription?.ownerId || user?.owner_id || user.id;
            const res = await fetch(`/api/v1/financial_records?user_id=${targetUserId}`, { headers });
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

    useEffect(() => {
        if (isSecondaryUser && activeTab === 'reconciliation') {
            setActiveTab('payable');
        }
    }, [isSecondaryUser, activeTab]);

    // Years dynamic option calculation
    const years = useMemo(() => {
        const yearsSet = new Set<string>();
        const currentYear = new Date().getFullYear().toString();
        yearsSet.add(currentYear);
        // Also add previous year and next year as standard defaults
        const prevYear = (new Date().getFullYear() - 1).toString();
        const nextYear = (new Date().getFullYear() + 1).toString();
        yearsSet.add(prevYear);
        yearsSet.add(nextYear);
        
        records.forEach(r => {
            const date = r.due_date || r.payment_date || r.created_at;
            if (date && date.length >= 4) {
                yearsSet.add(date.substring(0, 4));
            }
        });
        return Array.from(yearsSet).sort((a, b) => b.localeCompare(a)); // Descending order
    }, [records]);

    // Summary calculation
    const summary = useMemo(() => {
        let totalPayable = 0;
        let totalReceivable = 0;
        let totalPaid = 0;
        let totalReceived = 0;
        let overdueCount = 0;

        const today = new Date();
        today.setHours(0,0,0,0);

        records.forEach(r => {
            const amt = Number(r.amount);
            const isReceivable = r.type === 'receivable';

            if (r.status === 'paid') {
                if (isReceivable) {
                    totalReceived += amt;
                } else {
                    totalPaid += amt;
                }
            } else {
                if (isReceivable) {
                    totalReceivable += amt;
                } else {
                    totalPayable += amt;
                    if (r.due_date) {
                        const due = new Date(r.due_date);
                        if (due < today) overdueCount++;
                    }
                }
            }
        });

        return { totalPayable, totalReceivable, totalPaid, totalReceived, overdueCount };
    }, [records]);

    // Handle delete
    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente excluir este registro financeiro?')) return;
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`/api/v1/financial_records/${id}`, { method: 'DELETE', headers });
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
            const token = await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/v1/financial_records/${record.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    status: newStatus,
                    payment_date: newPaymentDate
                })
            });
            if (!res.ok) throw new Error('Falha ao atualizar status');
            const isReceivable = record.type === 'receivable';
            showToast(`Registro marcado como ${newStatus === 'paid' ? (isReceivable ? 'Recebido' : 'Pago') : 'Pendente'}`, 'success');
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
            setFormBankId(record.bank_id || record.account_id || (availableBanks.length === 1 ? availableBanks[0].id : ''));
            setFormDueDate(record.due_date ? record.due_date.split('T')[0] : '');
            setFormPaymentDate(record.payment_date ? record.payment_date.split('T')[0] : '');
            setFormRecurrence(record.recurrence || 'none');
            setFormBankTxId(record.bank_transaction_id || null);
            setFormBankTxDesc(record.bank_transaction_desc || null);
            setFormAttachments(record.attachments || []);
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
            setFormBankId(availableBanks.length === 1 ? availableBanks[0].id : '');
            setFormDueDate('');
            setFormPaymentDate('');
            setFormRecurrence('none');
            setFormBankTxId(null);
            setFormBankTxDesc(null);
            setFormAttachments([]);
        }
        setIsModalOpen(true);
    };

    // Preenchimento automático inteligente e determinístico a partir dos dados lidos do documento
    const handleDocumentDataExtracted = (extracted: ExtractedExpenseDoc, _attachment: ExpenseAttachment) => {
        let appliedCount = 0;

        // 1. Preenche valor se estiver vazio ou zerado (preserva valor se o usuário já digitou)
        if ((!formAmount || parseFloat(formAmount) === 0) && extracted.extractedAmount) {
            setFormAmount(extracted.extractedAmount.toFixed(2));
            appliedCount++;
        }

        // 2. Preenche favorecido / beneficiário se vazio
        if (!formRecipientName.trim() && extracted.extractedRecipient) {
            setFormRecipientName(extracted.extractedRecipient);
            appliedCount++;
        }

        // 3. Preenche vencimento se vazio
        if (!formDueDate && extracted.extractedDueDate) {
            setFormDueDate(extracted.extractedDueDate);
            appliedCount++;
        }

        // 4. Preenche data de pagamento / emissão se vazio
        if (!formPaymentDate && extracted.extractedDate) {
            setFormPaymentDate(extracted.extractedDate);
            appliedCount++;
        }

        // 5. Preenche título com base nos dados do documento se vazio
        if (!formTitle.trim()) {
            if (extracted.documentNumber && extracted.extractedRecipient) {
                setFormTitle(`NF-e ${extracted.documentNumber} - ${extracted.extractedRecipient}`);
                appliedCount++;
            } else if (extracted.extractedRecipient) {
                setFormTitle(`${extracted.documentTypeLabel || 'Despesa'} - ${extracted.extractedRecipient}`);
                appliedCount++;
            } else if (extracted.documentTypeLabel) {
                setFormTitle(`${extracted.documentTypeLabel}`);
                appliedCount++;
            }
        }

        // 6. Preenche descrição com itens e metadados se vazia
        if (!formDescription.trim()) {
            const descLines: string[] = [];
            if (extracted.extractedRecipientCnpjCpf) {
                descLines.push(`CNPJ/CPF Favorecido: ${extracted.extractedRecipientCnpjCpf}`);
            }
            if (extracted.documentNumber) {
                descLines.push(`Nº Documento: ${extracted.documentNumber}`);
            }
            if (extracted.accessKey) {
                descLines.push(`Chave de Acesso: ${extracted.accessKey}`);
            }
            if (extracted.barcodeOrAuth) {
                descLines.push(`Linha Digitável / Cód: ${extracted.barcodeOrAuth}`);
            }
            if (extracted.items && extracted.items.length > 0) {
                descLines.push(`\nItens do Documento (${extracted.items.length}):`);
                extracted.items.forEach((it, idx) => {
                    const qtyStr = it.quantity ? ` (${it.quantity}x)` : '';
                    const valStr = it.totalPrice ? ` - R$ ${it.totalPrice.toFixed(2)}` : (it.unitPrice ? ` - R$ ${it.unitPrice.toFixed(2)}` : '');
                    descLines.push(`${idx + 1}. ${it.name}${qtyStr}${valStr}`);
                });
            }
            if (descLines.length > 0) {
                setFormDescription(descLines.join('\n'));
                appliedCount++;
            }
        }

        // 7. Tipo de favorecido: se CNPJ detectado, seleciona fornecedor
        if (extracted.extractedRecipientCnpjCpf && extracted.extractedRecipientCnpjCpf.replace(/\D/g, '').length === 14) {
            setFormRecipientType('supplier');
        }

        // 8. Tipo de lançamento: NF ou Fatura => 'invoice'
        if (extracted.documentType === 'nota_fiscal' || extracted.documentType === 'fatura' || extracted.documentType === 'boleto') {
            setFormType('invoice');
        }

        if (appliedCount > 0) {
            showToast(`Documento lido: ${appliedCount} campo(s) preenchido(s) automaticamente para conferência.`, 'success');
        }
    };

    // Form Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle || !formAmount || !formType) {
            showToast('Por favor, preencha os campos obrigatórios.', 'error');
            return;
        }

        const targetDate = formPaymentDate || formDueDate || new Date().toISOString().split('T')[0];
        if (isSecondaryUser && isPeriodClosed(targetDate, matchResults, formChurchId)) {
            showToast("Este período já foi fechado de forma definitiva pelo usuário principal. Não é permitido realizar novos lançamentos ou edições.", "error");
            return;
        }

        // Calculate document validation status
        let docValidationStatus: ExpenseValidationStatus = 'pending_attachment';
        let docValidationNotes: string | null = null;

        const currentAmountNum = parseFloat(formAmount);

        if (formAttachments && formAttachments.length > 0) {
            let foundValidated = false;
            let divergentNote: string | null = null;

            for (const att of formAttachments) {
                if (att.extractedData) {
                    const validation = validateExpenseAgainstDocument(currentAmountNum, att.extractedData);
                    if (validation.status === 'validated') {
                        docValidationStatus = 'validated';
                        docValidationNotes = validation.message;
                        foundValidated = true;
                        break;
                    } else if (validation.status === 'divergent' && !divergentNote) {
                        divergentNote = validation.message;
                    }
                } else if (att.validationStatus === 'validated') {
                    docValidationStatus = 'validated';
                    docValidationNotes = att.validationNotes || 'Documento validado com sucesso';
                    foundValidated = true;
                    break;
                }
            }

            if (!foundValidated) {
                if (divergentNote) {
                    docValidationStatus = 'divergent';
                    docValidationNotes = divergentNote;
                } else {
                    docValidationStatus = formAttachments[0].validationStatus || 'manual_review';
                    docValidationNotes = formAttachments[0].validationNotes || 'Documento anexado sem divergência identificada';
                }
            }
        }

        const payload = {
            user_id: user?.id,
            church_id: formChurchId || null,
            bank_id: formBankId || null,
            account_id: formBankId || null,
            title: formTitle,
            description: formDescription,
            amount: currentAmountNum,
            type: formType,
            status: formStatus,
            recipient_name: formRecipientName,
            recipient_type: formRecipientType,
            due_date: formDueDate ? new Date(formDueDate).toISOString() : null,
            payment_date: formPaymentDate ? new Date(formPaymentDate).toISOString() : null,
            recurrence: formRecurrence,
            bank_transaction_id: formBankTxId,
            bank_transaction_desc: formBankTxDesc,
            attachments: formAttachments,
            validation_status: docValidationStatus,
            validation_notes: docValidationNotes
        };

        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            let res;
            if (editingRecord) {
                res = await fetch(`/api/v1/financial_records/${editingRecord.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/v1/financial_records', {
                    method: 'POST',
                    headers,
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
            const token = await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/v1/financial_records/${recordId}`, {
                method: 'PUT',
                headers,
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
            const token = await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/v1/financial_records/${record.id}`, {
                method: 'PUT',
                headers,
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
            if (activeTab === 'payable') {
                if (r.status !== 'pending' || r.type === 'receivable') return false;
            } else if (activeTab === 'receivable') {
                if (r.status !== 'pending' || r.type !== 'receivable') return false;
            } else if (activeTab === 'payments') {
                if (r.status !== 'paid') return false;
            } else if (activeTab === 'reconciliation') {
                return false;
            }

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

            const targetDate = r.due_date || r.payment_date || r.created_at;
            if (targetDate) {
                const recordDate = new Date(targetDate);
                
                // Period / Date Range filter
                if (dateRangeType === 'this_month') {
                    const now = new Date();
                    if (recordDate.getMonth() !== now.getMonth() || recordDate.getFullYear() !== now.getFullYear()) {
                        return false;
                    }
                } else if (dateRangeType === 'last_month') {
                    const now = new Date();
                    const targetMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
                    const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
                    if (recordDate.getMonth() !== targetMonth || recordDate.getFullYear() !== targetYear) {
                        return false;
                    }
                } else if (dateRangeType === 'last_30') {
                    const limit = new Date();
                    limit.setDate(limit.getDate() - 30);
                    if (recordDate < limit) return false;
                } else if (dateRangeType === 'custom') {
                    if (startDate) {
                        const start = new Date(startDate);
                        start.setHours(0,0,0,0);
                        if (recordDate < start) return false;
                    }
                    if (endDate) {
                        const end = new Date(endDate);
                        end.setHours(23,59,59,999);
                        if (recordDate > end) return false;
                    }
                }

                // Legacy Year and Month filter
                if (targetDate.length >= 7) {
                    const year = targetDate.substring(0, 4);
                    const month = targetDate.substring(5, 7);
                    
                    if (selectedYear !== 'all' && year !== selectedYear) return false;
                    if (selectedMonth !== 'all' && month !== selectedMonth) return false;
                } else if (selectedYear !== 'all' || selectedMonth !== 'all') {
                    return false;
                }
            } else if (selectedYear !== 'all' || selectedMonth !== 'all' || dateRangeType !== 'all') {
                return false;
            }

            // Document Validation Filter
            if (documentValidationFilter !== 'all') {
                const status = r.validation_status || (r.attachments && r.attachments.length > 0 ? (r.attachments[0].validationStatus || 'manual_review') : 'pending_attachment');
                if (documentValidationFilter === 'validated' && status !== 'validated') return false;
                if (documentValidationFilter === 'divergent' && status !== 'divergent') return false;
                if (documentValidationFilter === 'pending_attachment' && (r.attachments && r.attachments.length > 0)) return false;
            }

            return true;
        });
    }, [records, activeTab, searchTerm, selectedChurchId, selectedStatus, selectedYear, selectedMonth, dateRangeType, startDate, endDate, documentValidationFilter]);

    // Pagination for financial records table
    const [currentPage, setCurrentPage] = useState<number>(1);
    const ITEMS_PER_PAGE = 50;

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchTerm, selectedChurchId, selectedStatus, selectedYear, selectedMonth, dateRangeType, startDate, endDate, documentValidationFilter]);

    const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredRecords.length, totalPages, currentPage]);

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredRecords, currentPage]);

    return (
        <div className="px-1 py-3 md:px-2 w-full space-y-4 max-w-full min-h-full pb-8 md:pb-4">
            {/* Header Area */}
            <div className="flex flex-col gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
                {/* Top Row: Title & Subtitle + Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <Building className="w-4 h-4" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                Gestão de Contas
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                Gerencie contas a pagar, contas a receber, pagamentos e faça a conciliação bancária do seu extrato.
                            </p>
                        </div>
                    </div>

                    {/* Compact Action Buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                        <button
                            onClick={() => openModal(null)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Novo Lançamento</span>
                        </button>

                        <button 
                            onClick={fetchRecords} 
                            className="flex items-center justify-center w-9 h-9 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer shrink-0"
                            title="Atualizar"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Bottom Row: Tabs Selector + Search Input & Filter Button */}
                <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {/* Tabs on Top Left */}
                    <div className="flex bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 flex-wrap gap-0.5">
                        <button
                            onClick={() => setActiveTab('payable')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeTab === 'payable' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            Contas a Pagar
                        </button>
                        <button
                            onClick={() => setActiveTab('receivable')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeTab === 'receivable' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            Contas a Receber
                        </button>
                        <button
                            onClick={() => setActiveTab('payments')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeTab === 'payments' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            Pagamentos
                        </button>
                        {!isSecondaryUser && (
                            <button
                                onClick={() => setActiveTab('reconciliation')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'reconciliation' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                <span>Conciliar Extrato</span>
                                {pendingDebitsCount > 0 && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none tabular-nums ${activeTab === 'reconciliation' ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'}`}>
                                        {pendingDebitsCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {!isSecondaryUser && (
                            <button
                                onClick={() => setActiveTab('pastors')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'pastors' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                <Zap className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'pastors' ? 'text-white' : 'text-orange-600 dark:text-orange-400'}`} />
                                <span>Automação de Recorrentes</span>
                            </button>
                        )}
                    </div>

                    {/* Compact Search & Icon-only Filter on Bottom Right */}
                    {activeTab !== 'reconciliation' && (
                        <div className="flex items-center gap-2 flex-1 lg:max-w-md">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por título, descrição ou beneficiário..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                                />
                            </div>
                            <button
                                onClick={() => setIsFilterModalOpen(true)}
                                className="flex items-center justify-center w-9 h-9 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer relative"
                                title="Filtros Avançados"
                            >
                                <SlidersHorizontal className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-orange-600 text-white text-[9px] font-bold min-w-[18px] h-[18px] px-1 rounded-md flex items-center justify-center tabular-nums shadow-xs">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide block">Contas a Pagar</span>
                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums block">
                            {formatCurrency(summary.totalPayable, language)}
                        </span>
                        {summary.overdueCount > 0 && (
                            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 px-1.5 py-0.5 rounded-md tabular-nums inline-block">
                                {summary.overdueCount} {summary.overdueCount === 1 ? 'atrasada' : 'atrasadas'}
                            </span>
                        )}
                    </div>
                    <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center shrink-0">
                        <TrendingDown className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide block">Contas a Receber</span>
                        <span className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums block">
                            {formatCurrency(summary.totalReceivable, language)}
                        </span>
                    </div>
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center shrink-0">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide block">Total Pago</span>
                        <span className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums block">
                            {formatCurrency(summary.totalPaid, language)}
                        </span>
                    </div>
                    <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide block">Total Recebido</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums block">
                            {formatCurrency(summary.totalReceived, language)}
                        </span>
                    </div>
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Records List or Reconciliation Split View */}
            {activeTab === 'reconciliation' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* LEFT COLUMN: Bank statement debits */}
                    <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 space-y-4 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                            <div>
                                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide block">Débitos no Extrato</h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">Transações negativas encontradas no extrato.</p>
                            </div>
                            {/* Mode Selector (Pending vs Matched) */}
                            <div className="flex bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 self-start sm:self-auto">
                                <button
                                    onClick={() => { setReconFilter('pending'); setSelectedDebitId(null); }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${reconFilter === 'pending' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                >
                                    Pendentes
                                </button>
                                <button
                                    onClick={() => { setReconFilter('matched'); setSelectedDebitId(null); }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${reconFilter === 'matched' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
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
                                className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                            />
                        </div>

                        {/* List of Debits */}
                        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                            {bankDebits.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                    <FileSpreadsheet className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Nenhum extrato carregado</div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                                        Para realizar a conciliação de despesas, você precisa importar um extrato (arquivos OFX ou planilhas Excel) na tela de Lançamento de Dados.
                                    </p>
                                    <button
                                        onClick={() => setActiveView('upload')}
                                        className="mt-1 flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors cursor-pointer"
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
                                            className={`p-3 rounded-xl border transition-colors cursor-pointer flex flex-col gap-2 ${
                                                isSelected 
                                                    ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/20 shadow-2xs' 
                                                    : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[10px] tabular-nums font-semibold text-slate-500 dark:text-slate-400 block">
                                                        {formatDate(d.transaction.date)}
                                                    </span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs uppercase block truncate" title={d.transaction.description}>
                                                        {d.transaction.description}
                                                    </span>
                                                </div>
                                                <span className="text-xs tabular-nums font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                                    {formatCurrency(Math.abs(d.transaction.amount), language)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-dashed border-slate-200/70 dark:border-slate-800 pt-2 mt-1">
                                                {d.matchedRecord ? (
                                                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-bold uppercase">
                                                            Conciliado
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                                        <AlertTriangle className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-semibold uppercase">Pendente</span>
                                                    </div>
                                                )}

                                                {d.matchedRecord && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUnlinkRecord(d.matchedRecord);
                                                        }}
                                                        className="px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md border border-rose-200/70 dark:border-rose-900/40 flex items-center gap-1 transition-colors cursor-pointer"
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
                    <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-xs min-h-[300px]">
                        {!selectedDebit ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-20 text-slate-400 gap-3">
                                <Link className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Selecione uma transação do Extrato</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                                    Escolha um débito na lista ao lado para buscar lançamentos pendentes correspondentes ou realizar um novo cadastro integrado.
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Active Transaction Header */}
                                <div className="bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-xl space-y-3 border border-slate-200/80 dark:border-slate-700/60">
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Débito Selecionado no Extrato</span>
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <span className="text-sm font-bold text-slate-900 dark:text-white uppercase leading-tight block">
                                                {selectedDebit.transaction.description}
                                            </span>
                                            <span className="text-xs tabular-nums font-medium text-slate-500 dark:text-slate-400 mt-1 block">
                                                Data: {formatDate(selectedDebit.transaction.date)} | ID: {selectedDebit.transaction.id}
                                            </span>
                                        </div>
                                        <span className="text-base tabular-nums font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-lg border border-rose-200/70 dark:border-rose-900/40">
                                            {formatCurrency(Math.abs(selectedDebit.transaction.amount), language)}
                                        </span>
                                    </div>

                                    {selectedDebit.matchedRecord ? (
                                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 p-3 rounded-lg text-emerald-700 dark:text-emerald-300 text-xs flex flex-col gap-1.5">
                                            <div className="font-semibold flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Esta transação já está conciliada!
                                            </div>
                                            <div className="font-medium text-[11px] opacity-90 pl-5 tabular-nums">
                                                Vinculada ao lançamento: <strong className="uppercase">{selectedDebit.matchedRecord.title}</strong> ({formatCurrency(selectedDebit.matchedRecord.amount, language)})
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end pt-1">
                                            <button
                                                onClick={() => handleImportAsExpense(selectedDebit.transaction)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 text-orange-700 dark:text-orange-400 rounded-lg font-semibold text-xs border border-orange-200/70 dark:border-orange-900/40 transition-colors cursor-pointer"
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
                                            <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                                <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                                Sugestões de Vínculo Inteligente
                                            </h4>
                                            
                                            {suggestedRecords.length === 0 ? (
                                                <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                                                    Nenhum lançamento pendente corresponde automaticamente a este valor ou descrição.
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {suggestedRecords.map(r => {
                                                        const isExactAmount = Math.abs(selectedDebit.transaction.amount) === Number(r.amount);
                                                        return (
                                                            <div key={r.id} className="p-3 border border-orange-200/80 dark:border-orange-900/40 bg-orange-50/20 dark:bg-orange-950/10 rounded-xl flex items-center justify-between gap-4 transition-colors hover:bg-orange-50/40">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 uppercase">{r.title}</span>
                                                                        {isExactAmount && (
                                                                            <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md">
                                                                                Valor Exato
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 tabular-nums">
                                                                        {r.description || 'Sem descrição'} | Vencimento: {r.due_date ? formatDate(r.due_date) : '---'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-3 shrink-0">
                                                                    <span className="tabular-nums text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                        {formatCurrency(r.amount, language)}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleLinkRecord(r.id, selectedDebit.transaction)}
                                                                        className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
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
                                                <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                    Buscar Outros Lançamentos Pendentes
                                                </h4>
                                                <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40 px-2 py-0.5 rounded-md tabular-nums">
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
                                                    className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                                                />
                                            </div>

                                            <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
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
                                                            <div key={r.id} className="p-2.5 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                                                <div className="min-w-0">
                                                                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 uppercase block truncate">{r.title}</span>
                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 tabular-nums">
                                                                        Venc: {r.due_date ? formatDate(r.due_date) : '---'} | Fav: {r.recipient_name || '---'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="tabular-nums text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                        {formatCurrency(r.amount, language)}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleLinkRecord(r.id, selectedDebit.transaction)}
                                                                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-orange-600 hover:text-white dark:bg-slate-800 dark:hover:bg-orange-600 text-slate-700 dark:text-slate-200 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
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
            ) : activeTab === 'pastors' ? (
                <PastorAutomationTab
                    user={user}
                    churches={churches}
                    records={records}
                    fetchRecords={fetchRecords}
                    showToast={showToast}
                    language={language}
                />
            ) : (
                <div className="space-y-3">
                    {/* Quick Semaphore Filter Bar for Outflows/Expenses */}
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                Auditoria de Comprovantes / NF:
                            </span>
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-lg border border-slate-200/70 dark:border-slate-700/60 flex-wrap">
                                <button
                                    onClick={() => setDocumentValidationFilter('all')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer tabular-nums ${
                                        documentValidationFilter === 'all'
                                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Todos ({records.length})
                                </button>
                                <button
                                    onClick={() => setDocumentValidationFilter('validated')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                                        documentValidationFilter === 'validated'
                                            ? 'bg-emerald-600 text-white shadow-2xs'
                                            : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                    }`}
                                >
                                    <FileCheck className="w-3.5 h-3.5" />
                                    <span>Validados</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${documentValidationFilter === 'validated' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'}`}>
                                        {records.filter(r => r.validation_status === 'validated' || r.attachments?.[0]?.validationStatus === 'validated').length}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setDocumentValidationFilter('divergent')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                                        documentValidationFilter === 'divergent'
                                            ? 'bg-rose-600 text-white shadow-2xs'
                                            : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                    }`}
                                >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Com Divergência</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${documentValidationFilter === 'divergent' ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300'}`}>
                                        {records.filter(r => r.validation_status === 'divergent' || r.attachments?.[0]?.validationStatus === 'divergent').length}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setDocumentValidationFilter('pending_attachment')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                                        documentValidationFilter === 'pending_attachment'
                                            ? 'bg-amber-600 text-white shadow-2xs'
                                            : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                    }`}
                                >
                                    <FileMinus className="w-3.5 h-3.5" />
                                    <span>Sem Comprovante</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${documentValidationFilter === 'pending_attachment' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'}`}>
                                        {records.filter(r => (!r.attachments || r.attachments.length === 0) && r.type !== 'receivable').length}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block tabular-nums">
                            Mostrando <strong className="text-slate-900 dark:text-white font-semibold">{filteredRecords.length}</strong> de {records.length} lançamentos
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-orange-600 dark:text-orange-400" />
                            <span className="text-xs font-medium">Carregando dados financeiros...</span>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="p-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
                            <Info className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Nenhum lançamento encontrado</span>
                            <span className="text-xs">Clique em "Novo Lançamento" para cadastrar sua primeira despesa ou adiantamento.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}>
                            <table className="w-full text-left border-collapse min-w-[950px]">
                                <thead>
                                    <tr className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80">
                                        <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Título / Descrição</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Igreja</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Favorecido</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vencimento</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipo</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Comprovante / NF</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                                        <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRecords.map((record) => {
                                        const churchName = churches?.find((c: any) => c.id === record.church_id)?.name || '---';
                                        const isOverdue = record.status === 'pending' && record.due_date && new Date(record.due_date) < new Date();
                                        const hasAttachments = record.attachments && record.attachments.length > 0;
                                        const primaryDoc = hasAttachments ? record.attachments![0] : null;
                                        const docStatus: ExpenseValidationStatus = record.validation_status || (primaryDoc?.validationStatus || (hasAttachments ? 'manual_review' : 'pending_attachment'));
                                        
                                        return (
                                            <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800/70 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-xs uppercase flex items-center gap-1.5">
                                                        <span>{record.title}</span>
                                                        {record.bank_transaction_id && (
                                                            <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md flex items-center gap-0.5" title="Conciliado com transação bancária">
                                                                <Link2 className="w-2.5 h-2.5" />
                                                                Conciliado
                                                            </span>
                                                        )}
                                                    </div>
                                                    {record.description && (
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{record.description}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md uppercase">
                                                        {churchName}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {record.recipient_name ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 uppercase">
                                                                {record.recipient_name}
                                                                <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md ml-1.5 uppercase font-semibold">
                                                                    {record.recipient_type === 'pastor' ? 'Pastor' : record.recipient_type === 'employee' ? 'Func.' : 'Fornec.'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">---</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {record.due_date ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                                                            <span className={`text-xs tabular-nums font-semibold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {formatDate(record.due_date)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">---</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase ${
                                                        record.type === 'invoice' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' :
                                                        record.type === 'fixed' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' :
                                                        record.type === 'advance' ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400' :
                                                        record.type === 'receivable' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' :
                                                        'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                        {record.type === 'invoice' ? 'Fatura' : record.type === 'fixed' ? 'Fixa' : record.type === 'advance' ? 'Adiantam.' : record.type === 'receivable' ? 'Receita' : 'Outra'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-xs tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                                    {formatCurrency(record.amount, language)}
                                                </td>

                                                {/* Comprovante / NF Semaphore Column */}
                                                <td className="px-4 py-3.5">
                                                    {record.type === 'receivable' ? (
                                                        <span className="text-[11px] text-slate-400">N/A</span>
                                                    ) : hasAttachments && primaryDoc ? (
                                                        <div className="flex items-center gap-1.5">
                                                            {docStatus === 'validated' ? (
                                                                <button
                                                                    onClick={() => setSelectedDocPreview({ record, attachment: primaryDoc })}
                                                                    className="px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-900/40 hover:bg-emerald-100 transition-colors cursor-pointer"
                                                                    title={record.validation_notes || 'Valor confere exatamente com o documento'}
                                                                >
                                                                    <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                                    <span>VALIDADO</span>
                                                                    {record.attachments!.length > 1 && (
                                                                        <span className="bg-emerald-200 dark:bg-emerald-800 text-[9px] px-1 rounded-md tabular-nums">
                                                                            +{record.attachments!.length - 1}
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            ) : docStatus === 'divergent' ? (
                                                                <button
                                                                    onClick={() => setSelectedDocPreview({ record, attachment: primaryDoc })}
                                                                    className="px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/40 hover:bg-rose-100 transition-colors cursor-pointer"
                                                                    title={record.validation_notes || 'Divergência entre o valor lançado e o documento anexado'}
                                                                >
                                                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                                                    <span>DIVERGÊNCIA</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setSelectedDocPreview({ record, attachment: primaryDoc })}
                                                                    className="px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                                    title="Comprovante anexado (Clique para visualizar)"
                                                                >
                                                                    <Paperclip className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                                                                    <span>ANEXADO</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setSelectedDocPreview({ record, attachment: primaryDoc })}
                                                                className="p-1 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                                title="Visualizar documento"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => openModal(record)}
                                                            className="px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-dashed border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                                                            title="Clique para editar e anexar a nota fiscal ou comprovante"
                                                        >
                                                            <FileMinus className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                            <span>Sem anexo</span>
                                                        </button>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    <button
                                                        onClick={() => handleToggleStatus(record)}
                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                                            record.status === 'paid'
                                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100'
                                                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100'
                                                        }`}
                                                    >
                                                        {record.status === 'paid' ? (
                                                            <>
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                {record.type === 'receivable' ? 'RECEBIDO' : 'PAGO'}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <AlertCircle className="w-3 h-3" />
                                                                PENDENTE
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => openModal(record)}
                                                            className="p-1.5 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                            title="Editar"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(record.id)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
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
                    {filteredRecords.length > ITEMS_PER_PAGE && (
                        <div className="flex-shrink-0 flex justify-between items-center px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800">
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                Página <strong className="text-slate-900 dark:text-white font-semibold">{currentPage}</strong> de {totalPages} ({filteredRecords.length} lançamentos)
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 cursor-pointer transition-colors"
                                >
                                    Primeira
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-30 cursor-pointer transition-colors"
                                    title="Página Anterior"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-30 cursor-pointer transition-colors"
                                    title="Próxima Página"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 cursor-pointer transition-colors"
                                >
                                    Última
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                </div>
            )}

            {/* Modal para Novo / Editar Lançamento */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
                >
                    <form
                        onSubmit={handleSubmit}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-elevated w-full max-w-3xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col overflow-hidden animate-scale-in"
                    >
                        {/* Header */}
                        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-row justify-between items-center gap-3 shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                                    <PlusCircle className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                                        {editingRecord ? 'Editar Lançamento' : 'Novo Lançamento'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                                        {editingRecord ? 'Atualizar registro financeiro' : 'Cadastrar conta ou receita'}
                                    </p>
                                </div>
                            </div>

                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 flex-1 overflow-y-auto w-full custom-scrollbar bg-slate-50/40 dark:bg-slate-950" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                            <div className="space-y-5 w-full max-w-5xl mx-auto">
                                {/* Title & Amount */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2 space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Título *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Fatura de Energia"
                                            value={formTitle}
                                            onChange={(e) => setFormTitle(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Valor (R$) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={formAmount}
                                            onChange={(e) => setFormAmount(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm tabular-nums font-semibold focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                        Descrição / Observações
                                    </label>
                                    <textarea
                                        placeholder="Detalhes sobre a despesa ou finalidade do adiantamento..."
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors h-24 resize-none"
                                    />
                                </div>

                                {/* Comprovante / Nota Fiscal / Boleto (Validação Automática sem IA) */}
                                {formType !== 'receivable' && (
                                    <div className="pt-1">
                                        <ExpenseDocumentUploader
                                            launchAmount={formAmount ? parseFloat(formAmount) : undefined}
                                            recipientName={formRecipientName}
                                            attachments={formAttachments}
                                            onChangeAttachments={(updated) => setFormAttachments(updated)}
                                            onApplyExtractedAmount={(amt) => setFormAmount(amt.toFixed(2))}
                                            onApplyExtractedRecipient={(rec) => setFormRecipientName(rec)}
                                            onDocumentDataExtracted={handleDocumentDataExtracted}
                                        />
                                    </div>
                                )}

                                {/* Church, Account & Type */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Igreja Destinação
                                        </label>
                                        <select
                                            value={formChurchId}
                                            onChange={(e) => setFormChurchId(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        >
                                            {churches?.map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Conta Bancária / Caixa
                                        </label>
                                        <select
                                            value={formBankId}
                                            onChange={(e) => setFormBankId(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        >
                                            <option value="">-- Sem Conta / Caixa Principal --</option>
                                            {availableBanks.map((b: any) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.account_name || b.name || 'Conta Bancária / Caixa'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Tipo de Lançamento *
                                        </label>
                                        <select
                                            value={formType}
                                            onChange={(e: any) => setFormType(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        >
                                            <option value="invoice">Fatura / Despesa Geral</option>
                                            <option value="fixed">Despesa Fixa Recorrente</option>
                                            <option value="advance">Adiantamento</option>
                                            <option value="receivable">Conta a Receber (Receita)</option>
                                            <option value="other">Outros</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Recipient Details */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2 space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            {formType === 'receivable' ? 'Doador / Origem da Receita' : 'Favorecido / Beneficiário'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={formType === 'receivable' ? "Ex: Membro doador, Empresa patrocinadora" : "Nome do pastor, funcionário ou fornecedor"}
                                            value={formRecipientName}
                                            onChange={(e) => setFormRecipientName(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Tipo do Favorecido / Origem
                                        </label>
                                        <select
                                            value={formRecipientType}
                                            onChange={(e: any) => setFormRecipientType(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        >
                                            <option value="pastor">Pastor</option>
                                            <option value="employee">Funcionário</option>
                                            <option value="supplier">Fornecedor / Terceiro</option>
                                            <option value="other">Outro / Membro</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            {formType === 'receivable' ? 'Previsão de Recebimento' : 'Data de Vencimento'}
                                        </label>
                                        <input
                                            type="date"
                                            value={formDueDate}
                                            onChange={(e) => setFormDueDate(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm tabular-nums font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            {formType === 'receivable' ? 'Data de Recebimento' : 'Data de Pagamento'}
                                        </label>
                                        <input
                                            type="date"
                                            value={formPaymentDate}
                                            onChange={(e) => setFormPaymentDate(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm tabular-nums font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Status & Recurrence */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Status Inicial
                                        </label>
                                        <select
                                            value={formStatus}
                                            onChange={(e: any) => setFormStatus(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        >
                                            <option value="pending">
                                                {formType === 'receivable' ? 'Pendente / Não Recebido' : 'Pendente / Não Pago'}
                                            </option>
                                            <option value="paid">
                                                {formType === 'receivable' ? 'Recebido' : 'Pago'}
                                            </option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Recorrência
                                        </label>
                                        <select
                                            value={formRecurrence}
                                            onChange={(e: any) => setFormRecurrence(e.target.value)}
                                            className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-2.5 px-3.5 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        >
                                            <option value="none">Nenhuma</option>
                                            <option value="monthly">Mensal</option>
                                            <option value="weekly">Semanal</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4 flex justify-end gap-3 border-t border-slate-200/80 dark:border-slate-800 mt-auto">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                                Salvar Lançamento
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Advanced Financial Filters Modal */}
            {isFilterModalOpen && (
                <div
                    className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setIsFilterModalOpen(false); }}
                >
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col shadow-elevated overflow-hidden animate-scale-in">
                        {/* Header Compacto */}
                        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 flex-shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                                    <SlidersHorizontal className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">Filtros Avançados</h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">Refine sua busca na gestão de contas</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setIsFilterModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/40 dark:bg-slate-950/40" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Igreja / Centro de Custo */}
                                <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-2xs">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Igreja / Centro de Custo</label>
                                        <select
                                            value={tempChurchId}
                                            onChange={(e) => setTempChurchId(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        >
                                            <option value="all">Todas as Igrejas</option>
                                            {churches?.map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Status do Lançamento</label>
                                        <select
                                            value={tempStatus}
                                            onChange={(e) => setTempStatus(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        >
                                            <option value="all">Todos os Status</option>
                                            <option value="pending">Pendentes</option>
                                            <option value="paid">Pagos</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Period & Date Filters */}
                                <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-2xs">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Filtrar por Período</label>
                                        <select
                                            value={tempDateRangeType}
                                            onChange={(e) => setTempDateRangeType(e.target.value as any)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                        >
                                            <option value="all">Qualquer Período</option>
                                            <option value="this_month">Este Mês</option>
                                            <option value="last_month">Mês Anterior</option>
                                            <option value="last_30">Últimos 30 Dias</option>
                                            <option value="custom">Personalizado...</option>
                                        </select>
                                    </div>

                                    {tempDateRangeType !== 'custom' ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Ano</label>
                                                <select
                                                    value={tempYear}
                                                    onChange={(e) => setTempYear(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors tabular-nums"
                                                >
                                                    <option value="all">Todos os Anos</option>
                                                    {years.map(y => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Mês</label>
                                                <select
                                                    value={tempMonth}
                                                    onChange={(e) => setTempMonth(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors"
                                                >
                                                    <option value="all">Todos os Meses</option>
                                                    {months.map(m => (
                                                        <option key={m.value} value={m.value}>{m.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">De</label>
                                                <input
                                                    type="date"
                                                    value={tempStartDate}
                                                    onChange={(e) => setTempStartDate(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors tabular-nums"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Até</label>
                                                <input
                                                    type="date"
                                                    value={tempEndDate}
                                                    onChange={(e) => setTempEndDate(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-colors tabular-nums"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Compacto */}
                        <div className="bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4 flex justify-between items-center border-t border-slate-200/80 dark:border-slate-800 flex-shrink-0">
                            <button
                                type="button"
                                onClick={handleClearAllFilters}
                                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            >
                                Limpar Filtros
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsFilterModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyFilters}
                                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Aplicar Filtros
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Document Preview & Validation Details Modal */}
            {selectedDocPreview && (
                <div
                    className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setSelectedDocPreview(null); }}
                >
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col shadow-elevated overflow-hidden animate-scale-in">
                        {/* Header */}
                        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                                        Auditoria do Documento
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate max-w-md">
                                        {selectedDocPreview.record.title}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDocPreview(null)}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                            {/* Validation Status Banner */}
                            {(() => {
                                const rec = selectedDocPreview.record;
                                const doc = selectedDocPreview.attachment || (rec.attachments && rec.attachments[0]);
                                const status = rec.validation_status || doc?.validationStatus || 'manual_review';
                                const notes = rec.validation_notes || doc?.validationNotes;
                                const extracted = doc?.extractedData;

                                return (
                                    <div className="space-y-4">
                                        <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                                            status === 'validated'
                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                                                : status === 'divergent'
                                                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-900/40 text-rose-800 dark:text-rose-300'
                                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                        }`}>
                                            <div className="mt-0.5 shrink-0">
                                                {status === 'validated' ? (
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                ) : status === 'divergent' ? (
                                                    <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                                ) : (
                                                    <Paperclip className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-wide">
                                                        {status === 'validated'
                                                            ? 'Lançamento Validado com Sucesso'
                                                            : status === 'divergent'
                                                            ? 'Divergência de Valores Detectada'
                                                            : 'Documento Anexado (Revisão Manual)'}
                                                    </span>
                                                </div>
                                                <p className="text-xs mt-1 font-medium leading-relaxed opacity-90">
                                                    {notes || (status === 'validated'
                                                        ? 'O valor lançado no sistema confere exatamente com o valor total identificado no documento.'
                                                        : status === 'divergent'
                                                        ? 'O valor lançado no sistema é diferente do valor indicado no documento fiscal/comprovante.'
                                                        : 'Documento anexado para conferência manual.')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Comparison Cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                                                <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide block">
                                                    Valor Lançado na Saída
                                                </span>
                                                <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                                                    {formatCurrency(rec.amount, language)}
                                                </span>
                                            </div>

                                            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                                                <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide block">
                                                    Valor no Documento (Extraído)
                                                </span>
                                                <span className={`text-lg font-bold tabular-nums ${
                                                    status === 'validated' ? 'text-emerald-600 dark:text-emerald-400' : status === 'divergent' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                                                }`}>
                                                    {extracted?.extractedAmount != null ? formatCurrency(extracted.extractedAmount, language as any) : 'Não detectado'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Extracted Details Grid */}
                                        {extracted && (
                                            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs">
                                                <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide block">
                                                    Dados Estruturados Extraídos do PDF:
                                                </span>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 tabular-nums">
                                                    {extracted.documentTypeLabel && (
                                                        <div>
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">Tipo de Documento</span>
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200">{extracted.documentTypeLabel}</span>
                                                        </div>
                                                    )}
                                                    {extracted.extractedDate && (
                                                        <div>
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">Data do Documento</span>
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200">{extracted.extractedDate}</span>
                                                        </div>
                                                    )}
                                                    {extracted.barcodeOrAuth && (
                                                        <div>
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">Autenticação / Código</span>
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{extracted.barcodeOrAuth}</span>
                                                        </div>
                                                    )}
                                                    {extracted.extractedRecipient && (
                                                        <div className="col-span-2">
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">Favorecido / Destinatário</span>
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{extracted.extractedRecipient}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Document Preview Area */}
                                        {doc && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">
                                                        Visualização do Arquivo ({doc.fileName})
                                                    </span>
                                                    {doc.dataUrl && (
                                                        <a
                                                            href={doc.dataUrl}
                                                            download={doc.fileName}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-semibold text-orange-600 hover:text-orange-700 underline flex items-center gap-1"
                                                        >
                                                            Abrir / Baixar Arquivo
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 min-h-[260px] flex items-center justify-center">
                                                    {doc.fileType?.includes('pdf') || doc.fileName?.toLowerCase().endsWith('.pdf') ? (
                                                        <iframe
                                                            src={doc.dataUrl}
                                                            className="w-full h-80 border-0 rounded-xl"
                                                            title="Pré-visualização do PDF"
                                                        />
                                                    ) : doc.fileType?.includes('image') ? (
                                                        <img
                                                            src={doc.dataUrl}
                                                            alt={doc.fileName}
                                                            className="max-h-80 object-contain mx-auto p-2"
                                                        />
                                                    ) : (
                                                        <div className="p-8 text-center text-slate-400 space-y-2">
                                                            <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                                                            <p className="text-xs font-semibold">{doc.fileName}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4 flex justify-between items-center border-t border-slate-200/80 dark:border-slate-800 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    const rec = selectedDocPreview.record;
                                    setSelectedDocPreview(null);
                                    openModal(rec);
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Editar Lançamento</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedDocPreview(null)}
                                className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
