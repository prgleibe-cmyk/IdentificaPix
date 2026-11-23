import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { 
    X, 
    Pencil, 
    CheckCircle2, 
    Building2, 
    Calendar, 
    DollarSign, 
    Tag, 
    CreditCard, 
    Landmark,
    User, 
    ArrowUpRight, 
    ArrowDownRight,
    AlertCircle,
    ArrowLeft,
    ChevronDown,
    Search,
    SquarePen
} from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { useAuth } from '../../contexts/AuthContext';
import { MatchResult, Church } from '../../types';
import { getCachedContributors, subscribeToContributorUpdates } from '../../services/contributorsCache';
import { resolveContributionType, resolvePaymentMethod, isPeriodClosed, getDateChurchLockReason } from '../../utils/formatters';
import { ExpenseDocumentUploader } from '../financial/ExpenseDocumentUploader';
import { ExpenseAttachment } from '../../types/domain';
import { getAttachmentsForTransaction, saveAttachmentsForTransaction } from '../../services/expenseAttachmentService';
import { QuickRegisterModal, QuickRegisterEntity } from './QuickRegisterModal';

interface EditManualTransactionModalProps {
    isOpen: boolean;
    row: MatchResult | null;
    onClose: () => void;
    onSave?: (updatedRow: MatchResult) => Promise<{ success: boolean; error?: string } | void> | void;
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
        showToast,
        updateReportData,
        matchResults
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
        const dStr = typeof d === 'string' ? d : String(d);
        return dStr.includes('T') ? dStr.split('T')[0] : dStr;
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
        if (!row) return isInitialExpense ? 'Despesa Geral' : 'Dízimo';
        const rawType = row.contributionType || 
               (row.contributor as any)?.contributionType || 
               (row.transaction as any)?.contributionType || '';
        const cleanRaw = typeof rawType === 'string' ? rawType.trim().toUpperCase() : '';
        const isGeneric = !cleanRaw || ['ENTRADA', 'SAÍDA', 'SAIDA', 'ENTRADAS', 'SAIDAS', 'INCOME', 'EXPENSE', 'GERAL', 'DIVERSOS', '---', 'NONE', 'NULL', 'UNDEFINED'].includes(cleanRaw);
        if (!isGeneric) {
            return rawType.trim();
        }
        return resolveContributionType(row, contributionTypes, contributionKeywords);
    }, [row, isInitialExpense, contributionTypes, contributionKeywords]);

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
    const [quickRegisterEntity, setQuickRegisterEntity] = useState<QuickRegisterEntity | null>(null);
    const initializedRowIdRef = useRef<string | null>(null);

    // Contributor suggestions
    const [dbContributors, setDbContributors] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showTypeSuggestions, setShowTypeSuggestions] = useState(false);

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

    const filteredTypeOptions = useMemo(() => {
        const q = contributionType.trim().toLowerCase();
        if (!q || typeOptions.some((opt: string) => opt.toLowerCase() === q)) return typeOptions;
        const matches = typeOptions.filter((opt: string) => opt.toLowerCase().includes(q));
        return matches.length > 0 ? matches : typeOptions;
    }, [contributionType, typeOptions]);

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

            // Carrega anexos da linha ou do IndexedDB/nuvem sob demanda
            const activeTxId = row.transaction?.id || (row as any)?.id;
            initializedRowIdRef.current = activeTxId || null;
            const existingAtts = row.attachments || row.transaction?.attachments;
            if (Array.isArray(existingAtts) && existingAtts.length > 0) {
                setAttachments(existingAtts);
                const needsHydration = existingAtts.some((a: any) => a && !a.dataUrl && a.hasDataUrl);
                if (needsHydration && activeTxId) {
                    getAttachmentsForTransaction(activeTxId).then(loaded => {
                        if (initializedRowIdRef.current === activeTxId && Array.isArray(loaded) && loaded.length > 0) {
                            setAttachments(loaded);
                        }
                    }).catch(() => {});
                }
            } else if (activeTxId) {
                getAttachmentsForTransaction(activeTxId).then(loaded => {
                    if (initializedRowIdRef.current === activeTxId) {
                        setAttachments(loaded || []);
                    }
                }).catch(() => setAttachments([]));
            } else {
                setAttachments([]);
            }
        }
    }, [isOpen, row, isInitialExpense, initialAmount, initialDescription, initialDate, initialChurchId, initialBankId, initialContributionType, initialPaymentMethod, paymentMethodsOptions]);

    useEffect(() => {
        let isMounted = true;
        const loadContributors = (forceRefresh = false) => {
            getCachedContributors(forceRefresh).then(list => {
                if (isMounted && Array.isArray(list)) {
                    setDbContributors(list);
                }
            }).catch(err => {
                console.error('[EditManualTransactionModal] Erro ao carregar contribuintes:', err);
            });
        };
        loadContributors(false);
        const unsubscribe = subscribeToContributorUpdates(() => loadContributors(true));
        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    // Filter suggestions based on typed description with similarity algorithm
    const filteredContributors = useMemo(() => {
        if (!description || description.trim().length < 1) return [];
        const rawQuery = description.trim();
        const queryNorm = rawQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const queryDigits = rawQuery.replace(/\D/g, '');
        const queryTokens = queryNorm.split(/\s+/).filter(Boolean);

        const scoredMatches: { item: any; score: number }[] = [];
        const seenKeys = new Set<string>();

        for (const c of dbContributors) {
            const name = (c.name || c.canonical_name || c.cleanedName || '');
            const normName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const trade = (c.trade_name || '');
            const normTrade = trade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const contactPerson = (c.contact_person || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const cpfClean = (c.cpf || '').replace(/\D/g, '');

            let score = 0;

            if (queryDigits.length >= 3 && cpfClean.includes(queryDigits)) {
                score = 1000 + (cpfClean === queryDigits ? 500 : 0);
            }

            if (normName === queryNorm || normTrade === queryNorm) {
                score = Math.max(score, 900);
            } else if (normName.startsWith(queryNorm) || normTrade.startsWith(queryNorm)) {
                score = Math.max(score, 750);
            } else if (normName.includes(queryNorm) || normTrade.includes(queryNorm)) {
                score = Math.max(score, 600);
            } else if (queryTokens.length > 0) {
                const targetText = `${normName} ${normTrade} ${contactPerson}`;
                const allTokensMatch = queryTokens.every(tok => targetText.includes(tok));
                if (allTokensMatch) {
                    score = Math.max(score, 500 + (queryTokens.length * 10));
                } else {
                    const targetWords = targetText.split(/\s+/).filter(Boolean);
                    let matchedWordCount = 0;
                    for (const qTok of queryTokens) {
                        if (qTok.length < 2) continue;
                        const hasWordMatch = targetWords.some(tWord => tWord.includes(qTok) || qTok.includes(tWord));
                        if (hasWordMatch) matchedWordCount++;
                    }
                    if (matchedWordCount > 0 && matchedWordCount >= Math.ceil(queryTokens.length / 2)) {
                        score = Math.max(score, 300 + (matchedWordCount * 20));
                    }
                }
            }

            if (score > 0) {
                const key = c.id || name;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    scoredMatches.push({ item: c, score });
                }
            }
        }

        scoredMatches.sort((a, b) => b.score - a.score);
        return scoredMatches.slice(0, 10).map(m => m.item);
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
        const chosenName = contrib.name || contrib.canonical_name || '';
        setDescription(chosenName);
        setSelectedContributorId(contrib.id || null);

        // Preenchimento imediato da igreja conforme o cadastro
        const targetChurch = (churches || []).find((c: any) => 
            (contrib.church_id && c.id === contrib.church_id) ||
            (contrib.churchId && c.id === contrib.churchId) ||
            (contrib._churchId && c.id === contrib._churchId) ||
            (contrib.congregation && c.name && c.name.trim().toLowerCase() === contrib.congregation.trim().toLowerCase()) ||
            (contrib.church_name && c.name && c.name.trim().toLowerCase() === contrib.church_name.trim().toLowerCase())
        ) || (churches && churches.length === 1 ? churches[0] : null);

        if (targetChurch?.id) {
            setChurchId(targetChurch.id);
        }
        setShowSuggestions(false);
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDescription(val);
        const valNorm = val.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = dbContributors.find((c: any) => {
            const cName = (c.name || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const cTrade = (c.trade_name || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return cName === valNorm || cTrade === valNorm;
        });
        setSelectedContributorId(match ? match.id : null);
        if (match) {
            const targetChurch = (churches || []).find((c: any) => 
                (match.church_id && c.id === match.church_id) ||
                (match.churchId && c.id === match.churchId) ||
                (match.congregation && c.name && c.name.trim().toLowerCase() === match.congregation.trim().toLowerCase())
            ) || (churches && churches.length === 1 ? churches[0] : null);
            if (targetChurch?.id) {
                setChurchId(targetChurch.id);
            }
        }
        setShowSuggestions(true);
        if (errorMessage) setErrorMessage(null);
    };

    const handleTypeSwitch = (newType: 'entrada' | 'saida') => {
        setType(newType);
        if (newType === 'saida') {
            const firstSaida = (contributionTypes || []).find((ct: any) => ct.type === 'saida' && ct.is_active !== false)?.name;
            setContributionType(firstSaida || 'Despesa Geral');
            setSelectedContributorId(null);
        } else {
            const firstEntrada = (contributionTypes || []).find((ct: any) => (ct.type === 'entrada' || !ct.type) && ct.is_active !== false)?.name;
            setContributionType(firstEntrada || 'Dízimo');
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

            if (row.isConfirmed || row.transaction?.isConfirmed) {
                setErrorMessage('TRANSAÇÃO CONFIRMADA: Este lançamento possui Confirmação Final e não pode ser alterado.');
                return;
            }

            const origChurchId = row.church?.id && row.church.id !== 'unidentified' ? row.church.id : undefined;
            if (origChurchId && isPeriodClosed(initialDate, matchResults, origChurchId, initialBankId || undefined)) {
                setErrorMessage('PERÍODO CONGELADO: Este lançamento pertence a um período fechado definitivamente e não pode ser alterado.');
                return;
            }

            const targetLockReason = getDateChurchLockReason(
                date,
                selectedChurch.id,
                matchResults,
                bankId || undefined,
                row.transaction?.id
            );
            if (targetLockReason) {
                setErrorMessage(targetLockReason);
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
                    _churchId: (row.contributor as any)?._churchId || (row.contributor as any)?.church_id || selectedChurch.id,
                    church_id: (row.contributor as any)?._churchId || (row.contributor as any)?.church_id || selectedChurch.id
                } : null,
                church: selectedChurch,
                _churchId: selectedChurch.id,
                contributionType: contributionType,
                paymentMethod: paymentMethod,
                updatedAt: nowIso
            };

            // 🛡️ PERSISTÊNCIA CENTRALIZADA COM CONFIRMAÇÃO DO BACKEND (FECHADO POR PADRÃO / FAIL-SAFE)
            let saveResult: { success: boolean; error?: string } = { 
                success: false, 
                error: 'Mecanismo de persistência indisponível no momento.' 
            };

            if (updateReportData) {
                saveResult = await updateReportData(updatedRow);
            } else if (onSave) {
                try {
                    const res = await onSave(updatedRow);
                    if (res && typeof res === 'object' && 'success' in res && (res as any).success === true) {
                        saveResult = { success: true };
                    } else if (res && typeof res === 'object' && 'success' in res && (res as any).success === false) {
                        saveResult = res as { success: boolean; error?: string };
                    } else {
                        saveResult = { 
                            success: false, 
                            error: 'Não foi possível confirmar a gravação no servidor.' 
                        };
                    }
                } catch (saveErr: any) {
                    saveResult = { 
                        success: false, 
                        error: saveErr?.message || 'Falha ao executar gravação.' 
                    };
                }
            }

            if (!saveResult || saveResult.success !== true) {
                const errorMsg = saveResult?.error || 'Erro ao persistir lançamento manual no banco de dados.';
                setErrorMessage(errorMsg);
                return;
            }

            // Persiste anexos no armazenamento local somente após confirmação do backend
            if (row.transaction.id) {
                try {
                    await saveAttachmentsForTransaction(row.transaction.id, attachments);
                } catch (attErr) {
                    console.error('[EditManualTransactionModal] Erro ao persistir anexos:', attErr);
                }
            }

            if (showToast) {
                showToast('Lançamento manual atualizado com sucesso!', 'success');
            }

            onClose();
        } catch (err: any) {
            console.error('[EditManualTransactionModal] Erro ao salvar:', err);
            setErrorMessage(err?.message || 'Ocorreu um erro ao salvar as alterações.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderFormContent = () => (
        <div className="space-y-4">
            {/* Alerta de erro */}
            {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Tipo de Movimentação — idêntico ao Novo Lançamento */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
                        Tipo de Movimentação
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ajuste as informações abaixo para atualizar o livro caixa.
                    </p>
                </div>

                <div className="inline-grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 gap-1 sm:min-w-[260px]">
                    <button
                        type="button"
                        onClick={() => handleTypeSwitch('entrada')}
                        className={`py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none ${
                            type === 'entrada'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400'
                        }`}
                        id="edit-modal-btn-entrada"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Entrada (Receita)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTypeSwitch('saida')}
                        className={`py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none ${
                            type === 'saida'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400'
                        }`}
                        id="edit-modal-btn-saida"
                    >
                        <ArrowDownRight className="w-4 h-4" />
                        <span>Saída (Despesa)</span>
                    </button>
                </div>
            </div>

            {/* Anexos para Saídas (mesma posição do Novo Lançamento) */}
            {type === 'saida' && (
                <div className="pt-1 animate-fade-in">
                    <ExpenseDocumentUploader
                        attachments={attachments}
                        onChangeAttachments={(newAtts) => {
                            setAttachments(newAtts);
                            const activeTxId = row?.transaction?.id || (row as any)?.id;
                            if (activeTxId) {
                                saveAttachmentsForTransaction(activeTxId, newAtts).catch(console.error);
                            }
                        }}
                        currentAmount={parsedCurrentAmount}
                        recipientName={description}
                        onApplyExtractedAmount={(val) => {
                            setAmountStr(val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        }}
                        onApplyExtractedRecipient={(recipient) => {
                            setDescription(recipient);
                        }}
                        onDocumentDataExtracted={(extracted) => {
                            if ((!amountStr || amountStr === '0,00' || amountStr.trim() === '') && extracted.extractedAmount) {
                                setAmountStr(extracted.extractedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                            }
                            if ((!description || description.trim().length === 0) && extracted.extractedRecipient) {
                                setDescription(extracted.extractedRecipient);
                            }
                        }}
                    />
                </div>
            )}

            {/* Linha 1: Data do Lançamento e Valor (R$) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                        Data do Lançamento
                    </label>
                    <input 
                        type="date"
                        value={date ? (String(date).includes('T') ? String(date).split('T')[0] : String(date)) : ''}
                        onChange={(e) => setDate(e.target.value)}
                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 px-3 transition-all outline-none text-xs font-semibold tabular-nums"
                    />
                </div>

                <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                        Valor (R$) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative group">
                        <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-orange-600 transition-colors pointer-events-none" />
                        <input 
                            type="text"
                            inputMode="numeric"
                            value={amountStr}
                            onChange={handleAmountChange}
                            placeholder="0,00"
                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 py-2 pl-9 pr-3 transition-all outline-none text-xs font-bold tabular-nums placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            {/* Linha 2: Contribuinte / Favorecido */}
            <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                        {type === 'saida' ? 'Favorecido / Razão Social' : 'Nome do Contribuinte'} <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                        Selecionar um cadastro preenche a igreja automaticamente
                    </span>
                </div>
                <div className="flex items-stretch rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                    <div className="relative flex-1 min-w-0 group">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-orange-600 transition-colors pointer-events-none" />
                        <input 
                            type="text"
                            value={description}
                            onChange={handleDescriptionChange}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && showSuggestions && filteredContributors.length > 0) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelectContributor(filteredContributors[0]);
                                } else if (e.key === 'Escape') {
                                    setShowSuggestions(false);
                                }
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => {
                                setTimeout(() => setShowSuggestions(false), 180);
                            }}
                            placeholder={type === 'saida' ? 'Digite o nome, razão social ou CNPJ/CPF do favorecido...' : 'Digite o nome ou CPF do contribuinte...'}
                            className="block w-full rounded-l-lg border-0 bg-transparent text-slate-900 dark:text-white py-2 pl-9 pr-3 transition-all outline-none text-xs font-medium placeholder:text-slate-400"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setQuickRegisterEntity('contributors')}
                        title="Gerenciar Empresas e Pessoas"
                        aria-label="Gerenciar Empresas e Pessoas"
                        className="shrink-0 w-9 flex items-center justify-center border-l border-slate-200 dark:border-slate-700/80 bg-slate-50/70 hover:bg-orange-50 dark:bg-slate-800/50 dark:hover:bg-orange-950/40 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer rounded-r-lg"
                    >
                        <SquarePen className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Dropdown de sugestões */}
                {showSuggestions && filteredContributors.length > 0 && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto custom-scrollbar">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Search className="w-3.5 h-3.5 text-slate-400" />
                                <span>Cadastros encontrados</span>
                            </div>
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Preenche a igreja</span>
                        </div>
                        {filteredContributors.map((c: any) => {
                            const matchedChurch = (churches || []).find((ch: any) => 
                                (c.church_id && ch.id === c.church_id) ||
                                (c.churchId && ch.id === c.churchId) ||
                                (c.congregation && ch.name && ch.name.trim().toLowerCase() === c.congregation.trim().toLowerCase())
                            ) || (churches && churches.length === 1 ? churches[0] : null);
                            const churchName = matchedChurch?.name || c.congregation || c.church_name;
                            const isPj = c.person_type === 'PJ' || (c.cpf && c.cpf.replace(/\D/g, '').length === 14);
                            const hasTrade = c.trade_name && c.trade_name.trim() && c.trade_name.trim().toLowerCase() !== (c.name || '').trim().toLowerCase();

                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelectContributor(c);
                                    }}
                                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-50 dark:border-white/5 last:border-0 flex items-center justify-between cursor-pointer transition-colors"
                                >
                                    <div className="flex flex-col min-w-0 pr-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{c.name}</span>
                                            {isPj && (
                                                <span className="text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200/80 dark:border-blue-800">
                                                    PJ
                                                </span>
                                            )}
                                        </div>
                                        {hasTrade && (
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate">
                                                {c.trade_name}
                                            </span>
                                        )}
                                        {c.cpf && <span className="text-[10px] text-slate-400 font-mono mt-0.5">{c.cpf}</span>}
                                    </div>
                                    {churchName && (
                                        <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700 shrink-0 max-w-[170px] truncate">
                                            {churchName}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Linha 3: Igreja de Destino e Conta / Caixa de Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                        Igreja de Destino
                    </label>
                    <div className="flex items-stretch rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                        <div className="relative flex-1 min-w-0 group">
                            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-orange-600 transition-colors pointer-events-none" />
                            <select
                                value={churchId}
                                onChange={(e) => setChurchId(e.target.value)}
                                className={`block w-full border-0 bg-transparent text-slate-900 dark:text-white py-2 pl-9 pr-8 transition-all outline-none text-xs font-semibold appearance-none cursor-pointer ${!isSecondaryUser ? 'rounded-l-lg' : 'rounded-lg'}`}
                            >
                                {churches.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        {!isSecondaryUser && (
                            <button
                                type="button"
                                onClick={() => setQuickRegisterEntity('churches')}
                                title="Gerenciar Igrejas e Congregações"
                                aria-label="Gerenciar Igrejas e Congregações"
                                className="shrink-0 w-9 flex items-center justify-center border-l border-slate-200 dark:border-slate-700/80 bg-slate-50/70 hover:bg-orange-50 dark:bg-slate-800/50 dark:hover:bg-orange-950/40 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer rounded-r-lg"
                            >
                                <SquarePen className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                        Conta / Caixa de Destino
                    </label>
                    <div className="flex items-stretch rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                        <div className="relative flex-1 min-w-0 group">
                            <Landmark className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-orange-600 transition-colors pointer-events-none" />
                            <select
                                value={bankId}
                                onChange={(e) => setBankId(e.target.value)}
                                className={`block w-full border-0 bg-transparent text-slate-900 dark:text-white py-2 pl-9 pr-8 transition-all outline-none text-xs font-semibold appearance-none cursor-pointer ${!isSecondaryUser ? 'rounded-l-lg' : 'rounded-lg'}`}
                            >
                                <option value="">Sem vínculo de banco (Caixa Físico)</option>
                                {availableBanks.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.account_name || b.name || 'Conta Bancária / Caixa'}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        {!isSecondaryUser && (
                            <button
                                type="button"
                                onClick={() => setQuickRegisterEntity('banks')}
                                title="Gerenciar Contas e Caixas"
                                aria-label="Gerenciar Contas e Caixas"
                                className="shrink-0 w-9 flex items-center justify-center border-l border-slate-200 dark:border-slate-700/80 bg-slate-50/70 hover:bg-orange-50 dark:bg-slate-800/50 dark:hover:bg-orange-950/40 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer rounded-r-lg"
                            >
                                <SquarePen className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Linha 4: Descrição / Categoria e Forma de Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5 relative">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                        Descrição / Categoria
                    </label>
                    <div className="relative flex items-stretch rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                        <div className="relative flex-1 min-w-0 group">
                            <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-orange-600 transition-colors pointer-events-none" />
                            <input
                                type="text"
                                value={contributionType}
                                onChange={e => {
                                    setContributionType(e.target.value);
                                    setShowTypeSuggestions(true);
                                }}
                                onFocus={() => setShowTypeSuggestions(true)}
                                onBlur={() => {
                                    setTimeout(() => setShowTypeSuggestions(false), 200);
                                }}
                                placeholder={type === 'saida' ? 'Digite ou escolha (ex: Despesa Geral, Fatura, Manutenção)...' : 'Digite ou escolha (ex: Dízimo, Oferta)...'}
                                className="block w-full rounded-l-lg border-0 bg-transparent text-slate-900 dark:text-white py-2 pl-9 pr-14 transition-all outline-none text-xs font-semibold placeholder:text-slate-400 placeholder:font-normal"
                            />
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                {contributionType && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setContributionType('');
                                            setShowTypeSuggestions(false);
                                        }}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 text-xs cursor-pointer"
                                        title="Limpar campo"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setShowTypeSuggestions(prev => !prev);
                                    }}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer transition-transform"
                                    title="Ver modelos cadastrados"
                                >
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTypeSuggestions ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setQuickRegisterEntity('contribution')}
                            title="Gerenciar Descrições (Entrada/Saída)"
                            aria-label="Gerenciar Descrições (Entrada/Saída)"
                            className="shrink-0 w-9 flex items-center justify-center border-l border-slate-200 dark:border-slate-700/80 bg-slate-50/70 hover:bg-orange-50 dark:bg-slate-800/50 dark:hover:bg-orange-950/40 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer rounded-r-lg"
                        >
                            <SquarePen className="w-3.5 h-3.5" />
                        </button>

                        {showTypeSuggestions && filteredTypeOptions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto custom-scrollbar">
                                <div className="p-1.5 space-y-0.5">
                                    {filteredTypeOptions.map((opt: string) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setContributionType(opt);
                                                setShowTypeSuggestions(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                                contributionType.toUpperCase() === opt.toUpperCase()
                                                    ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400'
                                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                            }`}
                                        >
                                            <span>{opt}</span>
                                            <span className="text-[10px] text-slate-400">Modelo</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 ml-0.5">
                        Forma de Pagamento
                    </label>
                    {isCustomPaymentMethod ? (
                        <div className="flex items-stretch rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                            <input
                                type="text"
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value.toUpperCase())}
                                placeholder="Digite a forma (ex: DINHEIRO, PIX)"
                                className="flex-1 min-w-0 rounded-l-lg border-0 bg-transparent text-slate-900 dark:text-white py-2 px-3 transition-all outline-none text-xs font-semibold"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCustomPaymentMethod(false);
                                    setPaymentMethod('DINHEIRO');
                                }}
                                className="px-2.5 border-l border-slate-200 dark:border-slate-700/80 bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer transition-colors shrink-0"
                            >
                                Lista
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickRegisterEntity('payment')}
                                title="Gerenciar Formas de Recebimento / Pagamento"
                                aria-label="Gerenciar Formas de Recebimento / Pagamento"
                                className="shrink-0 w-9 flex items-center justify-center border-l border-slate-200 dark:border-slate-700/80 bg-slate-50/70 hover:bg-orange-50 dark:bg-slate-800/50 dark:hover:bg-orange-950/40 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer rounded-r-lg"
                            >
                                <SquarePen className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-stretch rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                            <div className="relative flex-1 min-w-0 group">
                                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-orange-600 transition-colors pointer-events-none" />
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
                                    className="block w-full rounded-l-lg border-0 bg-transparent text-slate-900 dark:text-white py-2 pl-9 pr-8 transition-all outline-none text-xs font-semibold appearance-none cursor-pointer"
                                >
                                    {paymentMethodsOptions.map((method: string) => (
                                        <option key={method} value={method}>{method}</option>
                                    ))}
                                    <option value="__CUSTOM__">Outro (digitar manualmente...)</option>
                                </select>
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQuickRegisterEntity('payment')}
                                title="Gerenciar Formas de Recebimento / Pagamento"
                                aria-label="Gerenciar Formas de Recebimento / Pagamento"
                                className="shrink-0 w-9 flex items-center justify-center border-l border-slate-200 dark:border-slate-700/80 bg-slate-50/70 hover:bg-orange-50 dark:bg-slate-800/50 dark:hover:bg-orange-950/40 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer rounded-r-lg"
                            >
                                <SquarePen className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Rodapé / Ações — unificado com Novo Lançamento */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {!description.trim()
                        ? `Informe o ${type === 'saida' ? 'favorecido / descrição' : 'nome do contribuinte'}.`
                        : !amountStr || parsedCurrentAmount <= 0
                            ? 'Informe um valor maior que zero.'
                            : 'Pronto para salvar alterações.'}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/90 dark:border-slate-700 shadow-xs"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !amountStr || parsedCurrentAmount <= 0 || !description.trim()}
                        className={`px-5 py-2 text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5 active:scale-95 ${
                            isSaving || !amountStr || parsedCurrentAmount <= 0 || !description.trim()
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer'
                        }`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    if (asView) {
        return (
            <div className="px-2 py-3 md:px-4 w-full max-w-4xl mx-auto space-y-4 min-h-full flex flex-col animate-fade-in pb-8 md:pb-6">
                {/* Header Card — Idêntico ao Novo Lançamento */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex-shrink-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                                <Pencil className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    Editar Lançamento Manual
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Ajuste os valores, data, destino e classificação deste registro contábil.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/90 dark:border-slate-700 shadow-xs active:scale-95"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Voltar</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Card — Idêntico ao Novo Lançamento */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-5">
                    {renderFormContent()}
                </div>

                <QuickRegisterModal
                    entity={quickRegisterEntity}
                    onClose={() => setQuickRegisterEntity(null)}
                />
            </div>
        );
    }

    return (
        <>
            <div
                className="fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
                onClick={onClose}
            >
                <div 
                    className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-elevated w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Cabeçalho */}
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                                <Pencil className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    Editar Lançamento Manual
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Ajuste os valores, data, destino e classificação deste registro.
                                </p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Corpo do Formulário */}
                    <div
                        className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1"
                        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                    >
                        {renderFormContent()}
                    </div>
                </div>
            </div>

            <QuickRegisterModal
                entity={quickRegisterEntity}
                onClose={() => setQuickRegisterEntity(null)}
            />
        </>
    );
};
