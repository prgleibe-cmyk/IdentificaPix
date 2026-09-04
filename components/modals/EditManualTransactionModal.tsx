import React, { useState, useContext, useEffect, useMemo } from 'react';
import { 
    X, 
    Pencil, 
    CheckCircle2, 
    Building2, 
    Calendar, 
    DollarSign, 
    FileText, 
    Tag, 
    CreditCard, 
    Building, 
    User, 
    ArrowUpRight, 
    ArrowDownRight,
    AlertCircle,
    ArrowLeft,
    ChevronDown,
    Search
} from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useAuth } from '../../contexts/AuthContext';
import { MatchResult, Church } from '../../types';
import { getCachedContributors } from '../../services/contributorsCache';
import { resolveContributionType, resolvePaymentMethod } from '../../utils/formatters';
import { ExpenseDocumentUploader } from '../financial/ExpenseDocumentUploader';
import { ExpenseAttachment } from '../../types/domain';
import { getAttachmentsForTransaction, saveAttachmentsForTransaction } from '../../services/expenseAttachmentService';

interface EditManualTransactionModalProps {
    isOpen: boolean;
    row: MatchResult | null;
    onClose: () => void;
    onSave: (updatedRow: MatchResult) => void;
    asView?: boolean;
}

export const EditManualTransactionModal: React.FC<EditManualTransactionModalProps> = ({
    isOpen,
    row,
    onClose,
    onSave,
    asView = false
}) => {
    const { 
        churches, 
        banks, 
        contributionTypes,
        contributionKeywords, 
        paymentMethods: sysPaymentMethods, 
        showToast 
    } = useContext(AppContext);
    const { language } = useTranslation();
    const { subscription, user, isSecondaryUser } = useAuth();

    // Initial values from row
    const isInitialExpense = useMemo(() => {
        if (!row) return false;
        const amt = row.transaction?.amount ?? (row.contributor as any)?.amount ?? 0;
        return amt < 0 || 
               row.transaction?.type?.toLowerCase() === 'expense' || 
               row.transaction?.type?.toLowerCase() === 'saida';
    }, [row]);

    const initialAmount = useMemo(() => {
        if (!row) return '';
        const amt = Math.abs(row.transaction?.amount ?? (row.contributor as any)?.amount ?? 0);
        if (amt === 0) return '';
        return amt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, [row]);

    const initialDescription = useMemo(() => {
        if (!row) return '';
        return row.contributor?.name || 
               row.transaction?.description || 
               row.transaction?.rawDescription || 
               '';
    }, [row]);

    const initialDate = useMemo(() => {
        if (!row) return new Date().toISOString().split('T')[0];
        const d = row.contributor?.reference_date || 
                  row.contributor?.date || 
                  row.transaction?.reference_date || 
                  row.transaction?.date;
        if (!d) return new Date().toISOString().split('T')[0];
        return d.includes('T') ? d.split('T')[0] : d;
    }, [row]);

    const initialChurchId = useMemo(() => {
        if (!row?.church?.id || row.church.id === 'unidentified') {
            return churches[0]?.id || '';
        }
        return row.church.id;
    }, [row, churches]);

    const initialBankId = useMemo(() => {
        if (!row) return '';
        return (row.transaction as any)?.bank_id || (row as any).bankId || '';
    }, [row]);

    const initialContributionType = useMemo(() => {
        if (!row) return 'Dízimo';
        return row.contributionType || 
               (row.contributor as any)?.contributionType || 
               (isInitialExpense ? 'Despesa Geral' : 'Dízimo');
    }, [row, isInitialExpense]);

    const initialPaymentMethod = useMemo(() => {
        if (!row) return 'DINHEIRO';
        return row.paymentMethod || 
               (row.contributor as any)?.paymentMethod || 
               row.transaction?.paymentMethod || 
               'DINHEIRO';
    }, [row]);

    // Permissões de usuários secundários para contas
    const allowedBankIds = useMemo(() => {
        if (!isSecondaryUser) return null;
        return subscription?.bankIds || [];
    }, [isSecondaryUser, subscription?.bankIds]);

    const availableBanks = useMemo(() => {
        const raw = banks || [];
        if (!isSecondaryUser || !allowedBankIds || allowedBankIds.length === 0) return raw;
        return raw.filter((b: any) => allowedBankIds.includes(b.id));
    }, [banks, isSecondaryUser, allowedBankIds]);

    // Local form state
    const [type, setType] = useState<'entrada' | 'saida'>(isInitialExpense ? 'saida' : 'entrada');
    const [amountStr, setAmountStr] = useState<string>(initialAmount);
    const [description, setDescription] = useState<string>(initialDescription);
    const [selectedContributorId, setSelectedContributorId] = useState<string | null>(null);
    const [date, setDate] = useState<string>(initialDate);
    const [churchId, setChurchId] = useState<string>(initialChurchId);
    const [bankId, setBankId] = useState<string>(initialBankId);
    const [contributionType, setContributionType] = useState<string>(initialContributionType);
    const [paymentMethod, setPaymentMethod] = useState<string>(initialPaymentMethod);
    const [isCustomPaymentMethod, setIsCustomPaymentMethod] = useState(false);
    const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Contributor suggestions
    const [dbContributors, setDbContributors] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // --- OPÇÕES DINÂMICAS DE DESCRIÇÃO / CATEGORIA (CADASTRADAS NO SISTEMA) ---
    const typeOptions = useMemo(() => {
        if (type === 'saida') {
            const registeredSaidas = (contributionTypes || [])
                .filter((ct: any) => ct.type === 'saida' && ct.is_active !== false)
                .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || (a.name || '').localeCompare(b.name || ''))
                .map((ct: any) => ct.name)
                .filter(Boolean);

            if (registeredSaidas.length > 0) {
                return registeredSaidas;
            }

            return [
                'Despesa Geral',
                'Fatura / Conta',
                'Adiantamento',
                'Fornecedor / Compra',
                'Manutenção',
                'Aluguel',
                'Energia / Água',
                'Folha / Preletor',
                'Outros'
            ];
        }

        const registeredEntradas = (contributionTypes || [])
            .filter((ct: any) => (ct.type === 'entrada' || !ct.type) && ct.is_active !== false)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || (a.name || '').localeCompare(b.name || ''))
            .map((ct: any) => ct.name)
            .filter(Boolean);

        if (registeredEntradas.length > 0) {
            return registeredEntradas;
        }

        const list = Array.isArray(contributionKeywords) && contributionKeywords.length > 0 
            ? [...contributionKeywords] 
            : ['Dízimo', 'Oferta'];
        if (!list.includes('Dízimo')) list.unshift('Dízimo');
        if (!list.includes('Oferta')) list.push('Oferta');
        return list;
    }, [type, contributionTypes, contributionKeywords]);

    const paymentMethodsOptions = useMemo(() => {
        const list = Array.isArray(sysPaymentMethods) ? [...sysPaymentMethods] : [];
        if (!list.some(m => m.toUpperCase() === 'DINHEIRO')) {
            list.unshift('DINHEIRO');
        } else {
            const idx = list.findIndex(m => m.toUpperCase() === 'DINHEIRO');
            if (idx > 0) {
                const [item] = list.splice(idx, 1);
                list.unshift(item);
            }
        }
        if (!list.some(m => m.toUpperCase() === 'PIX')) {
            list.push('PIX');
        }
        return list;
    }, [sysPaymentMethods]);

    const parsedCurrentAmount = useMemo(() => {
        if (!amountStr) return 0;
        const sanitized = amountStr.replace(/\./g, '').replace(',', '.').trim();
        return parseFloat(sanitized) || 0;
    }, [amountStr]);

    useEffect(() => {
        if (isOpen && row) {
            const expense = isInitialExpense;
            setType(expense ? 'saida' : 'entrada');
            setAmountStr(initialAmount);
            setDescription(initialDescription);
            setDate(initialDate);
            setChurchId(initialChurchId);
            setBankId(initialBankId);
            setContributionType(initialContributionType);
            setPaymentMethod(initialPaymentMethod);
            setErrorMessage(null);
            setIsSaving(false);

            const initContribId = row.contributor?.id || (row.transaction as any)?.contributor_id || null;
            setSelectedContributorId(initContribId);

            if (initialPaymentMethod && !paymentMethodsOptions.map(m => m.toUpperCase()).includes(initialPaymentMethod.toUpperCase())) {
                setIsCustomPaymentMethod(true);
            } else {
                setIsCustomPaymentMethod(false);
            }

            // Carrega anexos da linha ou do IndexedDB
            const existingAtts = row.attachments || row.transaction?.attachments;
            if (Array.isArray(existingAtts) && existingAtts.length > 0) {
                setAttachments(existingAtts);
            } else if (row.transaction?.id) {
                getAttachmentsForTransaction(row.transaction.id).then(loaded => {
                    setAttachments(loaded || []);
                }).catch(() => setAttachments([]));
            } else {
                setAttachments([]);
            }
        }
    }, [isOpen, row, isInitialExpense, initialAmount, initialDescription, initialDate, initialChurchId, initialBankId, initialContributionType, initialPaymentMethod, paymentMethodsOptions]);

    useEffect(() => {
        let isMounted = true;
        getCachedContributors().then(list => {
            if (isMounted && Array.isArray(list)) {
                setDbContributors(list);
            }
        }).catch(err => {
            console.error('[EditManualTransactionModal] Erro ao carregar contribuintes:', err);
        });
        return () => { isMounted = false; };
    }, []);

    // Filter suggestions based on typed description
    const filteredContributors = useMemo(() => {
        if (!description || description.trim().length < 2) return [];
        const lower = description.toLowerCase().trim();
        return dbContributors.filter((c: any) => {
            const name = (c.name || '').toLowerCase();
            const cpf = (c.cpf || '').replace(/\D/g, '');
            return name.includes(lower) || cpf.includes(lower);
        }).slice(0, 5);
    }, [description, dbContributors]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawDigits = e.target.value.replace(/\D/g, '');
        if (!rawDigits || parseInt(rawDigits, 10) === 0) {
            setAmountStr('');
            return;
        }
        const truncated = rawDigits.slice(0, 11);
        const numericValue = parseInt(truncated, 10) / 100;
        const formatted = numericValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        setAmountStr(formatted);
        if (errorMessage) setErrorMessage(null);
    };

    const handleSelectContributor = (contrib: any) => {
        setDescription(contrib.name || '');
        setSelectedContributorId(contrib.id || null);
        if (contrib.church_id && churches.some(c => c.id === contrib.church_id)) {
            setChurchId(contrib.church_id);
        }
        setShowSuggestions(false);
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDescription(val);
        const match = dbContributors.find((c: any) => (c.name || '').trim().toLowerCase() === val.trim().toLowerCase());
        setSelectedContributorId(match ? match.id : null);
        setShowSuggestions(true);
        if (errorMessage) setErrorMessage(null);
    };

    const handleTypeSwitch = (newType: 'entrada' | 'saida') => {
        setType(newType);
        if (newType === 'saida') {
            if (contributionType === 'Dízimo' || contributionType === 'Oferta' || !contributionType) {
                setContributionType('Despesa Geral');
            }
            setSelectedContributorId(null);
        } else {
            if (contributionType === 'Despesa Geral' || contributionType === 'Saída Geral') {
                setContributionType('Dízimo');
            }
        }
    };

    if (!isOpen || !row) return null;

    const handleSave = async () => {
        try {
            setErrorMessage(null);

            // Validations
            const cleanDesc = description.trim();
            if (!cleanDesc) {
                setErrorMessage('A descrição ou nome do contribuinte é obrigatória.');
                return;
            }

            const cleanAmountStr = amountStr.replace(/\./g, '').replace(',', '.').trim();
            const parsedAmount = parseFloat(cleanAmountStr);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                setErrorMessage('Informe um valor válido maior que zero.');
                return;
            }

            const selectedChurch = churches.find(c => c.id === churchId) || row.church || churches[0];
            if (!selectedChurch) {
                setErrorMessage('Selecione uma igreja/congregação.');
                return;
            }

            setIsSaving(true);

            // Resolução segura do ID de contribuinte
            let finalContributorId: string | null = null;
            if (type === 'entrada') {
                if (selectedContributorId) {
                    finalContributorId = selectedContributorId;
                } else {
                    const match = dbContributors.find((c: any) => (c.name || '').trim().toLowerCase() === cleanDesc.toLowerCase());
                    if (match) {
                        finalContributorId = match.id;
                    }
                }
            } else {
                // Saídas/despesas não devem ficar associadas a ID de membro
                finalContributorId = null;
            }

            const finalAmount = type === 'saida' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
            const finalType = type === 'saida' ? 'expense' : 'income';
            const nowIso = new Date().toISOString();

            const updatedRow: MatchResult = {
                ...row,
                transaction: {
                    ...row.transaction,
                    amount: finalAmount,
                    description: cleanDesc,
                    rawDescription: cleanDesc,
                    date: date,
                    reference_date: date,
                    type: finalType,
                    bank_id: bankId || undefined,
                    paymentMethod: paymentMethod,
                    contributionType: contributionType,
                    source: 'manual',
                    isManual: true,
                    attachments: attachments && attachments.length > 0 ? attachments : undefined
                },
                attachments: attachments && attachments.length > 0 ? attachments : undefined,
                contributor: cleanDesc ? {
                    id: finalContributorId || undefined,
                    name: cleanDesc,
                    cleanedName: cleanDesc,
                    amount: finalAmount,
                    date: date,
                    reference_date: date,
                    contributionType: contributionType,
                    paymentMethod: paymentMethod,
                    _churchId: selectedChurch.id
                } : null,
                church: selectedChurch,
                _churchId: selectedChurch.id,
                contributionType: contributionType,
                paymentMethod: paymentMethod,
                updatedAt: nowIso
            };

            // Persiste anexos no armazenamento local
            if (row.transaction.id) {
                try {
                    await saveAttachmentsForTransaction(row.transaction.id, attachments);
                } catch (attErr) {
                    console.error('[EditManualTransactionModal] Erro ao persistir anexos:', attErr);
                }
            }

            // Call in-memory updater
            onSave(updatedRow);

            // Persist to backend database via PUT
            const txId = row.transaction.id;
            if (txId && !txId.startsWith('temp-') && !txId.startsWith('ghost-')) {
                try {
                    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    await fetch(`/api/v1/consolidated_transactions/${txId}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({
                            amount: finalAmount,
                            description: cleanDesc,
                            type: finalType,
                            transaction_date: date,
                            church_id: selectedChurch.id && selectedChurch.id !== 'unidentified' ? selectedChurch.id : null,
                            bank_id: bankId || null,
                            contributor_id: finalContributorId || null,
                            contribution_type: contributionType,
                            payment_method: paymentMethod,
                            source: 'manual',
                            status: 'identified',
                            is_confirmed: row.isConfirmed ?? false
                        })
                    });
                } catch (apiErr) {
                    console.error('[EditManualTransactionModal] Erro ao persistir na API:', apiErr);
                }
            }

            if (showToast) {
                showToast('Lançamento manual atualizado com sucesso!', 'success');
            }

            onClose();
        } catch (err: any) {
            console.error('[EditManualTransactionModal] Erro ao salvar:', err);
            setErrorMessage('Ocorreu um erro ao salvar as alterações.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderFormContent = (isWide: boolean = false) => (
        <div className="space-y-4">
            {/* Alerta de erro */}
            {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Alternador Tipo: Entrada / Saída */}
            <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Tipo de Movimentação
                </label>
                <div className="grid grid-cols-2 gap-2 max-w-md">
                    <button
                        type="button"
                        onClick={() => handleTypeSwitch('entrada')}
                        className={`py-2.5 px-3 rounded-xl font-bold uppercase text-[11px] flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                            type === 'entrada'
                                ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/20'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                        }`}
                        id="edit-modal-btn-entrada"
                    >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Entrada (Receita)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTypeSwitch('saida')}
                        className={`py-2.5 px-3 rounded-xl font-bold uppercase text-[11px] flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                            type === 'saida'
                                ? 'bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/20'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                        }`}
                        id="edit-modal-btn-saida"
                    >
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        <span>Saída (Despesa)</span>
                    </button>
                </div>
            </div>

            {/* Linha 2: Data de Competência e Valor (R$) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Data */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Data de Competência
                    </label>
                    <input 
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2.5 px-3.5 transition-all outline-none text-xs font-bold"
                    />
                </div>

                {/* Valor */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        Valor (R$)
                    </label>
                    <div className="relative w-full">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                        <input 
                            type="text"
                            inputMode="numeric"
                            value={amountStr}
                            onChange={handleAmountChange}
                            placeholder="0,00"
                            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2.5 pl-9 pr-3.5 transition-all outline-none text-xs font-mono font-black"
                        />
                    </div>
                </div>
            </div>

            {/* Linha 3: Contribuinte / Doador ou Favorecido */}
            <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {type === 'entrada' ? 'Nome do Contribuinte / Doador' : 'Fornecedor / Favorecido / Descrição'}
                    </label>
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200/60 dark:border-amber-800/40">
                        * Obrigatório
                    </span>
                </div>
                <div className="relative">
                    <input 
                        type="text"
                        value={description}
                        onChange={handleDescriptionChange}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder={type === 'entrada' ? 'Digite o nome do contribuinte ou selecione abaixo...' : 'Ex: Copel, Sanepar, Papelaria Alfa, etc.'}
                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2.5 px-3.5 transition-all outline-none text-xs font-bold"
                    />
                </div>

                {/* Dropdown de sugestões */}
                {showSuggestions && filteredContributors.length > 0 && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        <div className="p-1.5 bg-slate-50 dark:bg-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 flex items-center gap-1">
                            <Search className="w-3 h-3 text-slate-400" />
                            <span>Contribuintes Cadastrados Sugeridos</span>
                        </div>
                        {filteredContributors.map((c: any) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectContributor(c)}
                                className="w-full text-left px-3 py-2 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-xs font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-50 dark:border-slate-800/40 last:border-0 flex items-center justify-between cursor-pointer"
                            >
                                <span className="truncate">{c.name}</span>
                                {c.cpf && <span className="text-[10px] text-slate-400 font-mono">{c.cpf}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Linha 4: Igreja e Conta/Caixa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Igreja */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Escolha a Igreja de Destino
                    </label>
                    <div className="relative">
                        <select
                            value={churchId}
                            onChange={(e) => setChurchId(e.target.value)}
                            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2.5 px-3.5 pr-9 transition-all outline-none text-xs font-bold appearance-none cursor-pointer"
                        >
                            {churches.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>

                {/* Banco / Caixa */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        Conta / Caixa de Destino
                    </label>
                    <div className="relative">
                        <select
                            value={bankId}
                            onChange={(e) => setBankId(e.target.value)}
                            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2.5 px-3.5 pr-9 transition-all outline-none text-xs font-bold appearance-none cursor-pointer"
                        >
                            <option value="">Sem vínculo de banco (Caixa Físico)</option>
                            {availableBanks.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.account_name || b.name || 'Conta Bancária / Caixa'}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Linha 5: Descrição / Categoria e Forma de Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* DESCRIÇÃO / CATEGORIA */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                            Descrição / Categoria
                        </label>
                        <div className="flex items-center gap-1.5">
                            <select
                                value=""
                                onChange={e => {
                                    if (e.target.value) {
                                        setContributionType(e.target.value);
                                    }
                                }}
                                className="bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 text-[10px] font-bold py-0.5 px-2 rounded-lg border border-orange-200/70 dark:border-orange-800/70 cursor-pointer outline-none transition-colors"
                                title="Escolher modelo ou categoria pré-definida"
                            >
                                <option value="" disabled>📋 Carregar Modelo...</option>
                                {typeOptions.map((opt: string) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="relative w-full">
                        <input
                            type="text"
                            value={contributionType}
                            onChange={e => setContributionType(e.target.value)}
                            placeholder="Digite a descrição detalhada ou selecione um modelo..."
                            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2.5 px-3.5 transition-all outline-none text-xs font-bold"
                        />
                    </div>
                    {/* Atalhos rápidos de modelos mais frequentes */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar">
                        {typeOptions.slice(0, 6).map((opt: string) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => setContributionType(opt)}
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                                    contributionType === opt
                                        ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* FORMA DE PAGAMENTO */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                            Forma de Pagamento
                        </label>
                        <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-800/50">
                            💵 Padrão Dinheiro (Lançamento Manual)
                        </span>
                    </div>
                    {isCustomPaymentMethod ? (
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value.toUpperCase())}
                                placeholder="Digite a forma (ex: DINHEIRO, PIX)"
                                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2.5 px-3 transition-all outline-none text-xs font-bold"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCustomPaymentMethod(false);
                                    setPaymentMethod('DINHEIRO');
                                }}
                                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold rounded-xl text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all shrink-0"
                            >
                                Lista
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <select
                                value={paymentMethod}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === '__CUSTOM__') {
                                        setIsCustomPaymentMethod(true);
                                        setPaymentMethod('');
                                    } else {
                                        setPaymentMethod(val);
                                    }
                                }}
                                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2.5 px-3.5 pr-9 transition-all outline-none text-xs font-bold appearance-none cursor-pointer"
                            >
                                {paymentMethodsOptions.map((method: string) => (
                                    <option key={method} value={method}>{method}</option>
                                ))}
                                <option value="__CUSTOM__">✍️ Outro (Digitar manual...)</option>
                            </select>
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown className="w-3.5 h-3.5" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Linha 6: Anexos para Saídas */}
            {type === 'saida' && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                    <ExpenseDocumentUploader
                        attachments={attachments}
                        onChangeAttachments={setAttachments}
                        currentAmount={parsedCurrentAmount}
                        onApplyExtractedAmount={(val) => {
                            setAmountStr(val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        }}
                        onApplyExtractedRecipient={(recipient) => {
                            if (!description || description.trim().length === 0) {
                                setDescription(recipient);
                            }
                        }}
                    />
                </div>
            )}

            {/* Rodapé / Ações */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !amountStr || !description.trim()}
                    className="px-6 py-2.5 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 hover:opacity-95 text-white rounded-xl shadow-md shadow-orange-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 border border-orange-400/30 active:scale-95"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
            </div>
        </div>
    );

    if (asView) {
        return (
            <div className="w-full space-y-4 max-w-full min-h-full flex flex-col animate-fade-in pb-8 md:pb-4">
                {/* Header Card - Idêntico ao Livro Caixa e Novo Lançamento */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex-shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl text-white shadow-md shadow-orange-500/20 shrink-0">
                                <Pencil className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                    Editar Lançamento Manual
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Ajuste os valores, data, destino e classificação deste registro contábil.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all tracking-wider uppercase cursor-pointer border border-slate-200 dark:border-slate-700 active:scale-95"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Voltar</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || !amountStr || !description.trim()}
                                className={`flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-black text-white rounded-xl shadow-xs transition-all tracking-wider uppercase border border-orange-400/30 active:scale-95 ${
                                    isSaving || !amountStr || !description.trim()
                                        ? 'bg-slate-400 dark:bg-slate-700 opacity-60 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 hover:opacity-95 cursor-pointer shadow-orange-500/20'
                                }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Card - Idêntico ao Livro Caixa e Novo Lançamento */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-sm space-y-5">
                    {/* Control & Header Row */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                    Dados do Registro
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    {description || 'Lançamento Contábil'} • {type === 'entrada' ? 'Receita' : 'Despesa'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${
                                type === 'entrada'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}>
                                {type === 'entrada' ? (
                                    <>
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                        <span>Entrada / Receita</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowDownRight className="w-3.5 h-3.5" />
                                        <span>Saída / Despesa</span>
                                    </>
                                )}
                            </span>
                            {parsedCurrentAmount > 0 && (
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border ${
                                    type === 'entrada'
                                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-300/60 dark:border-emerald-800'
                                        : 'bg-rose-50/60 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border-rose-300/60 dark:border-rose-800'
                                }`}>
                                    {type === 'entrada' ? '+' : '-'} R$ {amountStr}
                                </span>
                            )}
                        </div>
                    </div>

                    {renderFormContent(true)}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabeçalho */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Pencil className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                Editar Lançamento Manual
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Ajuste os valores, data, destino e classificação deste registro.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Corpo do Formulário */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 text-xs">
                    {renderFormContent(false)}
                </div>
            </div>
        </div>
    );
};
