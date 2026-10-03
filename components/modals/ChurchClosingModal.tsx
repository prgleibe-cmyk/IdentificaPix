import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import { X, ArrowRight, Building2, Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Check, MessageCircle, PenTool, ShieldCheck, Lock, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { MatchResult, Church, ReconciliationStatus } from '../../types';
import { DigitalSignature, MonthClosingRecord } from '../../types/domain';
import { DigitalSignatureCollectionSection } from './DigitalSignatureCollectionSection';
import { saveMonthClosingRecord, getMonthClosingRecord, generateClosingIntegrityHash, reopenMonthClosingRecord } from '../../services/monthClosingService';

const formatDateBRL = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

interface ChurchClosingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClosingComplete?: (record: MonthClosingRecord) => void;
    currentChurchId: string | null;
    currentBankId?: string | null;
    initialMonth?: number;
    initialYear?: number;
    asView?: boolean;
    periodLabel?: string;
    initialClosingDate?: string;
    finalBalance?: number;
    totalIncome?: number;
    totalExpenses?: number;
}

export const ChurchClosingModal: React.FC<ChurchClosingModalProps> = ({
    isOpen,
    onClose,
    onClosingComplete,
    currentChurchId,
    currentBankId,
    initialMonth,
    initialYear,
    asView = false,
    periodLabel,
    initialClosingDate,
    finalBalance,
    totalIncome,
    totalExpenses
}) => {
    const { 
        churches, 
        banks,
        matchResults, 
        setMatchResults, 
        saveCurrentReportChanges,
        openWhatsAppReceiptModal,
        language,
        showToast 
    } = useContext(AppContext);
    
    const { t } = useTranslation();
    const { user, subscription } = useAuth();

    // Verificação do Usuário Principal (owner, admin, principal ou dono da conta)
    const isPrincipalUser = !subscription?.role || subscription?.role === 'owner' || subscription?.role === 'admin' || subscription?.role === 'principal' || subscription?.ownerId === user?.id;

    const [originChurchId, setOriginChurchId] = useState<string>('');
    const [originBankId, setOriginBankId] = useState<string>(currentBankId || 'all');
    const [destChurchId, setDestChurchId] = useState<string>('');
    const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState<boolean>(false);
    const [transferAmount, setTransferAmount] = useState<string>(() => {
        if (finalBalance !== undefined) {
            const abs = Math.abs(finalBalance);
            return abs > 0 ? abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
        }
        return '';
    });
    const [closingDate, setClosingDate] = useState<string>(() => initialClosingDate || new Date().toISOString().split('T')[0]);
    const [customMemo, setCustomMemo] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Gestão de Assinaturas Digitais e Fechamento Sem Papel
    const [signatures, setSignatures] = useState<DigitalSignature[]>([]);
    const [isTransferEnabled, setIsTransferEnabled] = useState<boolean>(true);
    const [existingRecord, setExistingRecord] = useState<MonthClosingRecord | null>(null);
    const [activeTab, setActiveTab] = useState<'transfer' | 'signatures'>('transfer');
    const [calculatedHash, setCalculatedHash] = useState<string>('');

    // Helpers de chave de persistência por Igreja e Conta Bancária
    const getBankKey = (bId?: string | null) => (!bId || bId === 'all') ? 'all' : bId;
    const getStorageKey = (cId: string, bId?: string | null) => `iggestor_cg_${cId}_${getBankKey(bId)}`;

    // Identifica o ID efetivo do Caixa Geral para a igreja e conta bancária atuais
    const effectiveGeneralCashId = useMemo(() => {
        if (!originChurchId) return '';
        try {
            // 1. Definição específica para esta Igreja + Conta Bancária
            const specific = localStorage.getItem(getStorageKey(originChurchId, originBankId));
            if (specific && churches?.some((c: any) => c.id === specific && c.id !== originChurchId)) {
                return specific;
            }

            // 2. Definição geral para esta Igreja (todas as contas)
            const churchOnly = localStorage.getItem(getStorageKey(originChurchId, 'all'));
            if (churchOnly && churches?.some((c: any) => c.id === churchOnly && c.id !== originChurchId)) {
                return churchOnly;
            }

            // 3. Definição global anterior do Caixa Geral
            const globalSaved = localStorage.getItem('iggestor_general_cash_church_id');
            if (globalSaved && churches?.some((c: any) => c.id === globalSaved && c.id !== originChurchId)) {
                return globalSaved;
            }
        } catch (e) {}

        const markedChurch = churches?.find((c: any) => c.is_general_cash && c.id !== originChurchId);
        if (markedChurch) return markedChurch.id;

        const namedChurch = churches?.find((c: any) => c.name?.toLowerCase().includes('caixa geral') && c.id !== originChurchId);
        if (namedChurch) return namedChurch.id;

        return '';
    }, [originChurchId, originBankId, churches]);

    // Define e ativa o Caixa Geral Oficial para a Igreja e Conta Bancária ativas
    const handleSetAsGeneralCash = (targetId: string) => {
        if (!targetId || !originChurchId) return;
        try {
            // Salva na chave específica da congregação e conta bancária
            localStorage.setItem(getStorageKey(originChurchId, originBankId), targetId);
            // Salva também como padrão geral desta congregação
            localStorage.setItem(getStorageKey(originChurchId, 'all'), targetId);
            // Mantém como fallback global
            localStorage.setItem('iggestor_general_cash_church_id', targetId);
        } catch (e) {}

        setDestChurchId(targetId);
        const targetName = churches?.find((c: any) => c.id === targetId)?.name || 'Caixa Geral';
        const originName = churches?.find((c: any) => c.id === originChurchId)?.name || 'Igreja';
        const bankName = originBankId && originBankId !== 'all' 
            ? (banks?.find((b: any) => b.id === originBankId)?.name || 'Conta Selecionada') 
            : 'Todas as Contas';
        setSuccessMessage(`"${targetName}" definido como Caixa Geral Oficial para "${originName}" (${bankName}).`);
        setTimeout(() => setSuccessMessage(null), 4000);
    };

    const isOriginGeneralCash = !!(originChurchId && effectiveGeneralCashId && originChurchId === effectiveGeneralCashId);

    // List of active churches from the report data (churches with active transactions)
    const activeChurches = useMemo(() => {
        const map = new Map<string, string>();
        matchResults?.forEach(r => {
            const id = r.church?.id || r._churchId;
            const name = r.church?.name || 'Igreja Desconhecida';
            if (id && id !== 'unidentified') {
                map.set(id, name);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [matchResults]);

    // Mês e Ano do Fechamento
    const closingMonth = useMemo(() => {
        if (initialMonth) return initialMonth;
        if (closingDate) {
            const parts = closingDate.split('-');
            if (parts.length === 3) return parseInt(parts[1], 10);
        }
        return new Date().getMonth() + 1;
    }, [initialMonth, closingDate]);

    const closingYear = useMemo(() => {
        if (initialYear) return initialYear;
        if (closingDate) {
            const parts = closingDate.split('-');
            if (parts.length === 3) return parseInt(parts[0], 10);
        }
        return new Date().getFullYear();
    }, [initialYear, closingDate]);

    // Initializer: set selected origin church
    useEffect(() => {
        if (isOpen) {
            if (currentChurchId && currentChurchId !== 'general_all' && currentChurchId !== 'unidentified' && currentChurchId !== 'all_expenses_group') {
                setOriginChurchId(currentChurchId);
            } else if (activeChurches.length > 0) {
                setOriginChurchId(activeChurches[0].id);
            } else if (churches && churches.length > 0) {
                setOriginChurchId(churches[0].id);
            }
            if (currentBankId) {
                setOriginBankId(currentBankId);
            } else {
                setOriginBankId('all');
            }
            setErrorMessage(null);
            setSuccessMessage(null);
            setCustomMemo('');
        }
    }, [isOpen, currentChurchId, currentBankId, activeChurches, churches]);

    // Calculate metrics for selected origin church and bank for this month/period
    const metrics = useMemo(() => {
        if (!originChurchId || !matchResults) {
            return { income: 0, expenses: 0, balance: 0 };
        }

        const getFinalAmount = (r: MatchResult) => {
            const amount = r.contributorAmount || r.contributor?.amount || r.transaction?.amount || 0;
            const isExp = amount < 0 || 
                          r.transaction?.type?.toLowerCase() === 'expense' || 
                          r.transaction?.type?.toLowerCase() === 'saida' || 
                          r.contributionType?.toLowerCase() === 'saída' || 
                          r.contributionType?.toLowerCase() === 'saida';
            return isExp ? -Math.abs(amount) : amount;
        };

        let incomeSum = 0;
        let expensesSum = 0;

        matchResults.forEach(r => {
            const churchId = r.church?.id || r._churchId;
            if (churchId === originChurchId) {
                // Filtro por conta bancária se selecionada
                if (originBankId && originBankId !== 'all') {
                    const txBankId = (r.transaction as any)?.bank_id || (r.transaction as any)?.bankId || (r as any).bankId || (r as any)._bankId;
                    if (txBankId && txBankId !== originBankId) {
                        return;
                    }
                }

                // Filtra pelo mês e ano se a data da transação existir (prioridade à data de referência)
                const txDate = r.contributor?.reference_date || r.reference_date || r.transaction?.reference_date || r.transaction?.date || '';
                if (txDate) {
                    const parts = txDate.split('-');
                    if (parts.length >= 2) {
                        const y = parseInt(parts[0], 10);
                        const m = parseInt(parts[1], 10);
                        if (y !== closingYear || m !== closingMonth) {
                            return;
                        }
                    }
                }
                const amt = getFinalAmount(r);
                if (amt >= 0) {
                    incomeSum += amt;
                } else {
                    expensesSum += Math.abs(amt);
                }
            }
        });

        return {
            income: incomeSum,
            expenses: expensesSum,
            balance: incomeSum - expensesSum
        };
    }, [originChurchId, originBankId, matchResults, closingMonth, closingYear]);

    // Valores contábeis efetivos (priorizam o cálculo consolidado do Livro Caixa)
    const effectiveBalance = finalBalance !== undefined ? finalBalance : metrics.balance;
    const effectiveIncome = totalIncome !== undefined ? totalIncome : metrics.income;
    const effectiveExpenses = totalExpenses !== undefined ? totalExpenses : metrics.expenses;

    useEffect(() => {
        if (initialClosingDate) {
            setClosingDate(initialClosingDate);
        }
    }, [initialClosingDate]);

    // Carrega fechamento existente para este mês e ano caso já tenha sido homologado
    useEffect(() => {
        let isMounted = true;
        async function loadExistingClosing() {
            if (!originChurchId || !isOpen) return;
            try {
                const rec = await getMonthClosingRecord(originChurchId, closingYear, closingMonth);
                if (isMounted) {
                    setExistingRecord(rec);
                    if (rec && rec.signatures && rec.signatures.length > 0) {
                        setSignatures(rec.signatures);
                        setCalculatedHash(rec.integrityHash);
                        if (rec.notes) setCustomMemo(rec.notes);
                    } else {
                        setSignatures([]);
                    }
                }
            } catch (err) {
                console.error('[ChurchClosingModal] Erro ao buscar fechamento:', err);
            }
        }
        loadExistingClosing();
        return () => { isMounted = false; };
    }, [originChurchId, closingYear, closingMonth, isOpen]);

    // Recalcula o Hash SHA-256 de integridade contábil
    useEffect(() => {
        let isMounted = true;
        async function updateHash() {
            if (!originChurchId) return;
            const hash = await generateClosingIntegrityHash({
                churchId: originChurchId,
                month: closingMonth,
                year: closingYear,
                totalIncome: effectiveIncome,
                totalExpenses: effectiveExpenses,
                previousBalance: 0,
                finalBalance: effectiveBalance,
                timestamp: closingDate
            });
            if (isMounted) {
                setCalculatedHash(hash);
            }
        }
        updateHash();
        return () => { isMounted = false; };
    }, [originChurchId, closingMonth, closingYear, effectiveIncome, effectiveExpenses, effectiveBalance, closingDate]);

    // 🛡️ Preenche automaticamente com o saldo do Livro Caixa (respeitando se o usuário editou manualmente)
    useEffect(() => {
        if (!isAmountManuallyEdited && effectiveBalance !== undefined) {
            const absVal = Math.abs(effectiveBalance || 0);
            if (absVal > 0) {
                setTransferAmount(absVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            } else {
                setTransferAmount('0,00');
            }
        }
    }, [effectiveBalance, isAmountManuallyEdited]);

    // Filter destination churches: list of all registered churches except origin
    const destinationChurches = useMemo(() => {
        return (churches || []).filter(c => c.id !== originChurchId);
    }, [churches, originChurchId]);

    // Selecionar o caixa de destino padrão (prioriza o Caixa Geral oficial da Igreja/Conta)
    useEffect(() => {
        if (destinationChurches.length > 0) {
            setDestChurchId(prev => {
                if (effectiveGeneralCashId && destinationChurches.some(c => c.id === effectiveGeneralCashId)) {
                    return effectiveGeneralCashId;
                }
                if (prev && destinationChurches.some(c => c.id === prev)) {
                    return prev;
                }
                const namedGeneral = destinationChurches.find(c => c.name.toLowerCase().includes('caixa geral'));
                if (namedGeneral) return namedGeneral.id;

                const matrix = destinationChurches.find(c => c.name.toLowerCase().includes('matriz') || c.name.toLowerCase().includes('sede'));
                return matrix ? matrix.id : destinationChurches[0].id;
            });
        } else {
            setDestChurchId('');
        }
    }, [destinationChurches, effectiveGeneralCashId, originChurchId, originBankId]);

    const parsedAmount = useMemo(() => {
        if (!transferAmount) return 0;
        if (transferAmount.includes(',')) {
            const clean = transferAmount.replace(/\./g, '').replace(',', '.');
            return parseFloat(clean) || 0;
        }
        return parseFloat(transferAmount) || 0;
    }, [transferAmount]);

    if (!isOpen) return null;

    const fullChurch = (churches || []).find(c => c.id === originChurchId);
    const selectedOriginChurch = fullChurch || activeChurches.find(c => c.id === originChurchId);

    const handleConfirm = async () => {
        setErrorMessage(null);
        if (!originChurchId) {
            setErrorMessage('Selecione uma igreja de origem.');
            return;
        }

        const originChurch = churches.find(c => c.id === originChurchId) || activeChurches.find(c => c.id === originChurchId);
        if (!originChurch) {
            setErrorMessage('Igreja de origem não encontrada.');
            return;
        }

        // Validação se transporte para Caixa Geral estiver ativado
        let destChurch: Church | undefined;
        if (isTransferEnabled && destinationChurches.length > 0 && parsedAmount > 0) {
            if (!destChurchId) {
                setErrorMessage('Selecione um caixa de destino para transportar o saldo.');
                return;
            }
            if (parsedAmount < 0) {
                setErrorMessage('O valor a ser transportado não pode ser negativo.');
                return;
            }
            destChurch = churches.find(c => c.id === destChurchId);
            if (!destChurch) {
                setErrorMessage('Caixa de destino não encontrado.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const timestamp = Date.now();
            const dateStr = closingDate;
            const memoText = customMemo.trim() || `FECHAMENTO DE CAIXA PERÍODO ${periodLabel || `${String(closingMonth).padStart(2, '0')}/${closingYear}`}`;

            // 1. Processar transferência de saldo se habilitada e valor > 0
            let originMatch: MatchResult | null = null;
            let destMatch: MatchResult | null = null;

            if (isTransferEnabled && destChurch && parsedAmount > 0) {
                const isNegative = effectiveBalance < 0;
                const originTxId = `closing-${isNegative ? 'deficit-cover' : 'outflow'}-${timestamp}`;
                const destTxId = `closing-${isNegative ? 'deficit-transfer' : 'inflow'}-${timestamp}`;

                // Se negativo: Caixa Geral envia aporte para a igreja atual (Entrada na igreja, Saída no Caixa Geral) -> Caixa fecha em ZERO
                // Se positivo: Igreja atual envia saldo para o Caixa Geral (Saída na igreja, Entrada no Caixa Geral) -> Caixa fecha em ZERO
                const originAmount = isNegative ? parsedAmount : -parsedAmount;
                const destAmount = isNegative ? -parsedAmount : parsedAmount;

                const originDescription = isNegative
                    ? `[APORTE/FECHAMENTO] ${memoText} - COBERTURA DE SALDO PELO ${destChurch.name.toUpperCase()}`
                    : `[FECHAMENTO] ${memoText} - TRANSP. SALDO PARA ${destChurch.name.toUpperCase()}`;

                const destDescription = isNegative
                    ? `[REPASSE/FECHAMENTO] ${memoText} - REPASSE DE COBERTURA PARA ${originChurch.name.toUpperCase()}`
                    : `[RECEBIMENTO] ${memoText} - SALDO RECEBIDO DE ${originChurch.name.toUpperCase()}`;

                originMatch = {
                    transaction: {
                        id: originTxId,
                        date: dateStr,
                        description: originDescription,
                        rawDescription: originDescription,
                        amount: originAmount,
                        isConfirmed: true,
                        bank_id: originBankId && originBankId !== 'all' ? originBankId : undefined
                    },
                    contributor: null,
                    status: ReconciliationStatus.IDENTIFIED,
                    church: {
                        id: originChurch.id,
                        name: originChurch.name,
                        address: originChurch.address || '',
                        logoUrl: originChurch.logoUrl || '',
                        pastor: originChurch.pastor || ''
                    },
                    _churchId: originChurch.id,
                    isConfirmed: true,
                    contributionType: isNegative ? 'ENTRADA / TRANSFERÊNCIA' : 'SAÍDA / TRANSFERÊNCIA',
                    updatedAt: new Date().toISOString()
                };

                destMatch = {
                    transaction: {
                        id: destTxId,
                        date: dateStr,
                        description: destDescription,
                        rawDescription: destDescription,
                        amount: destAmount,
                        isConfirmed: true
                    },
                    contributor: null,
                    status: ReconciliationStatus.IDENTIFIED,
                    church: {
                        id: destChurch.id,
                        name: destChurch.name,
                        address: destChurch.address || '',
                        logoUrl: destChurch.logoUrl || '',
                        pastor: destChurch.pastor || ''
                    },
                    _churchId: destChurch.id,
                    isConfirmed: true,
                    contributionType: isNegative ? 'SAÍDA / TRANSFERÊNCIA' : 'ENTRADA / TRANSFERÊNCIA',
                    updatedAt: new Date().toISOString()
                };
            }

            // Confirma automaticamente todas as transações da congregação no período contábil
            let updatedResults: MatchResult[] = [];
            setMatchResults((prev: any) => {
                const confirmedList = (prev || []).map((r: MatchResult) => {
                    const cId = r.church?.id || r._churchId;
                    if (cId === originChurch.id) {
                        const txDate = r.contributor?.reference_date || r.reference_date || r.transaction?.reference_date || r.transaction?.date || '';
                        if (txDate) {
                            const parts = txDate.split('-');
                            if (parts.length >= 2) {
                                const y = parseInt(parts[0], 10);
                                const m = parseInt(parts[1], 10);
                                if (y === closingYear && m === closingMonth) {
                                    return {
                                        ...r,
                                        isConfirmed: true,
                                        transaction: r.transaction ? { ...r.transaction, isConfirmed: true } : r.transaction
                                    };
                                }
                            }
                        }
                    }
                    return r;
                });

                const next = (originMatch && destMatch)
                    ? [...confirmedList, originMatch, destMatch]
                    : confirmedList;
                updatedResults = next;
                return next;
            });

            if (saveCurrentReportChanges) {
                await saveCurrentReportChanges(updatedResults);
            }

            // 2. Salvar Registro de Fechamento Contábil com Assinaturas Digitais e Hash SHA-256
            const closingRecord: MonthClosingRecord = {
                id: `closing_${originChurch.id}_${closingYear}_${closingMonth}`,
                churchId: originChurch.id,
                churchName: originChurch.name,
                month: closingMonth,
                year: closingYear,
                closedAt: new Date().toISOString(),
                totalIncome: effectiveIncome,
                totalExpenses: effectiveExpenses,
                previousBalance: 0,
                finalBalance: effectiveBalance,
                transferredBalance: isTransferEnabled ? (effectiveBalance < 0 ? -parsedAmount : parsedAmount) : undefined,
                targetChurchId: isTransferEnabled && destChurch ? destChurch.id : null,
                targetChurchName: isTransferEnabled && destChurch ? destChurch.name : undefined,
                signatures: signatures,
                integrityHash: calculatedHash || 'HASH-AUTENTICADO',
                status: signatures.length > 0 ? 'signed' : 'draft',
                notes: customMemo.trim() || undefined
            };

            await saveMonthClosingRecord(closingRecord);
            setExistingRecord(closingRecord);
            if (onClosingComplete) {
                onClosingComplete(closingRecord);
            }
            window.dispatchEvent(new CustomEvent('month_closing_updated', { detail: closingRecord }));

            let successText = `Fechamento do mês ${String(closingMonth).padStart(2, '0')}/${closingYear} registrado com sucesso para a igreja "${originChurch.name}".`;
            if (signatures.length > 0) {
                successText += ` ${signatures.length} assinatura(s) digital(is) homologada(s) com Hash SHA-256 inviolável.`;
            }
            if (isTransferEnabled && destChurch) {
                if (metrics.balance < 0) {
                    successText += ` Aporte de ${formatCurrency(parsedAmount, language)} transferido do caixa "${destChurch.name}" para cobrir o déficit e fechar com saldo zero.`;
                } else {
                    successText += ` Saldo de ${formatCurrency(parsedAmount, language)} transportado para o caixa "${destChurch.name}".`;
                }
            }
            setSuccessMessage(successText);

        } catch (error: any) {
            console.error('[ChurchClosingModal] Error performing closing:', error);
            setErrorMessage(error.message || 'Erro inesperado ao realizar o fechamento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const [isReopening, setIsReopening] = useState(false);

    const handleReopenClosing = async () => {
        if (!isPrincipalUser) {
            alert('Apenas o Usuário Principal tem autorização para desfazer fechamentos e reabrir períodos contábeis.');
            return;
        }

        const originChurch = churches?.find(c => c.id === originChurchId);
        const churchName = originChurch?.name || 'Congregação Selecionada';
        const formattedPeriod = `${String(closingMonth).padStart(2, '0')}/${closingYear}`;

        const confirmText = `⚠️ ATENÇÃO: DESFAZER FECHAMENTO FINAL\n\n` +
            `Deseja realmente desfazer o Fechamento Final de ${formattedPeriod} para a igreja "${churchName}"?\n\n` +
            `• O bloqueio será removido imediatamente.\n` +
            `• O período será reaberto para novos lançamentos, edições e correções.\n` +
            `• Eventuais transferências automáticas de saldo deste fechamento serão revertidas.\n\n` +
            `Deseja prosseguir com a reabertura imediata?`;

        if (!window.confirm(confirmText)) {
            return;
        }

        setIsReopening(true);
        setErrorMessage(null);
        try {
            const success = await reopenMonthClosingRecord(originChurchId, closingYear, closingMonth);
            if (!success) {
                throw new Error('Falha ao registrar a reabertura no servidor.');
            }

            // Remove transações de fechamento automático que estavam no state ativo
            const targetMonthStr = `${closingYear}-${String(closingMonth).padStart(2, '0')}`;
            let hasRemovedTxs = false;
            let updatedList: MatchResult[] = [];

            setMatchResults((prev: any) => {
                if (!Array.isArray(prev)) return prev;
                const next = prev.filter((r: MatchResult) => {
                    const txId = r.transaction?.id || (r as any).id || '';
                    const isClosingTx = txId.startsWith('closing-');
                    const txDate = r.transaction?.date || (r as any).date || '';
                    if (isClosingTx && txDate.startsWith(targetMonthStr)) {
                        hasRemovedTxs = true;
                        return false;
                    }
                    return true;
                });
                updatedList = next;
                return next;
            });

            if (hasRemovedTxs && saveCurrentReportChanges) {
                await saveCurrentReportChanges(updatedList);
            }

            setExistingRecord(null);
            setSignatures([]);
            setSuccessMessage(null);

            if (showToast) {
                showToast(`Fechamento desfeito com sucesso! O período ${formattedPeriod} foi reaberto para novos lançamentos.`, 'success');
            } else {
                alert(`Fechamento desfeito com sucesso! O período ${formattedPeriod} foi reaberto.`);
            }

            onClose();
        } catch (err: any) {
            console.error('[ChurchClosingModal] Erro ao reabrir período contábil:', err);
            setErrorMessage(err.message || 'Erro ao reabrir período contábil.');
        } finally {
            setIsReopening(false);
        }
    };

    const renderInnerContent = () => (
        <div className="space-y-5">
            {successMessage ? (
                <div className="p-8 text-center space-y-5">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-500 mx-auto border border-emerald-100 dark:border-emerald-900/50 animate-bounce">
                        <Check className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white">Fechamento Homologado!</h4>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                        {successMessage}
                    </p>

                    {calculatedHash && (
                        <div className="max-w-md mx-auto p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-left space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Código de Integridade SHA-256 (Inviolável)</span>
                            </div>
                            <p className="font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all select-all">
                                {calculatedHash}
                            </p>
                        </div>
                    )}

                    <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (openWhatsAppReceiptModal) {
                                    const originChurch = churches?.find(c => c.id === originChurchId);
                                    openWhatsAppReceiptModal({
                                        contributorName: 'Contribuintes & Dízimistas',
                                        amount: isTransferEnabled ? (parseFloat(transferAmount) || 0) : metrics.income,
                                        contributionType: 'Fechamento Mensal',
                                        churchName: originChurch?.name || 'Igreja Sede',
                                        date: closingDate
                                    });
                                }
                                onClose();
                            }}
                            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                            <MessageCircle className="w-4 h-4" />
                            <span>Notificar via WhatsApp</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                            Concluir e Voltar
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {errorMessage && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-bold text-red-600 dark:text-red-400">
                            {errorMessage}
                        </div>
                    )}

                    {existingRecord && existingRecord.status !== 'reopened' && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div>
                                    <h5 className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                                        Fechamento de {String(closingMonth).padStart(2, '0')}/{closingYear} Já Homologado
                                    </h5>
                                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                                        {existingRecord.signatures && existingRecord.signatures.length > 0 
                                            ? `Possui ${existingRecord.signatures.length} assinatura(s) colhida(s). Novos lançamentos estão bloqueados.` 
                                            : 'Período contábil fechado. Novos lançamentos bloqueados.'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-lg shrink-0">
                                    STATUS: HOMOLOGADO
                                </span>
                                {isPrincipalUser && (
                                    <button
                                        type="button"
                                        disabled={isReopening}
                                        onClick={handleReopenClosing}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 shrink-0"
                                        title="Desfazer o fechamento final e liberar os lançamentos deste período"
                                    >
                                        <Lock className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                        <span>{isReopening ? 'Reabrindo...' : 'Desfazer Fechamento'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="max-w-2xl mx-auto space-y-5 py-1">
                        {/* Card Principal: Período, Saldo a Transportar e Caixa de Destino */}
                        <div className="bg-slate-50/80 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-200/70 dark:border-slate-800 gap-3">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Período do Livro Caixa
                                    </span>
                                    <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                                        <Calendar className="w-4 h-4 text-orange-500" />
                                        <span>{periodLabel || `Mês ${String(closingMonth).padStart(2, '0')}/${closingYear}`}</span>
                                    </h4>
                                </div>
                                <div className="sm:text-right">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Caixa de Origem
                                    </span>
                                    {activeChurches.length > 1 && !currentChurchId ? (
                                        <select
                                            value={originChurchId}
                                            onChange={e => setOriginChurchId(e.target.value)}
                                            className="block mt-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white px-2 py-1 outline-none"
                                        >
                                            {activeChurches.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mt-0.5">
                                            {selectedOriginChurch?.name || 'Igreja Local'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Destaque: Saldo a Transportar & Campo Editável */}
                            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                effectiveBalance >= 0 
                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200/80 dark:border-emerald-800/50' 
                                    : 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200/80 dark:border-rose-800/50'
                            }`}>
                                <div className="space-y-1">
                                    <span className={`text-[10px] font-black uppercase tracking-wider block ${
                                        effectiveBalance >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                                    }`}>
                                        {effectiveBalance >= 0 ? 'Saldo a Transportar (Superávit)' : 'Saldo a Transportar (Déficit / Aporte)'}
                                    </span>
                                    <span className={`text-2xl font-black font-mono tracking-tight block ${
                                        effectiveBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                        {formatCurrency(effectiveBalance, language)}
                                    </span>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {effectiveBalance >= 0
                                            ? 'Ao confirmar, este saldo será enviado ao Caixa de destino, zerando este caixa para o próximo mês.'
                                            : 'Ao confirmar, o Caixa de destino enviará um repasse para cobrir este déficit e fechar com saldo zero.'}
                                    </p>
                                </div>

                                <div className="w-full sm:w-56 space-y-1 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 shrink-0">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Saldo a Transportar (R$)
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={transferAmount}
                                            onChange={e => {
                                                setIsAmountManuallyEdited(true);
                                                setTransferAmount(e.target.value.replace(/[^0-9,.]/g, ''));
                                            }}
                                            placeholder="0,00"
                                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500 py-1.5 pl-8 pr-2.5 outline-none text-sm font-black font-mono"
                                        />
                                    </div>
                                    <span className="text-[9px] text-slate-400 block text-right">Preenchido auto • Editável se desejar</span>
                                </div>
                            </div>

                            {/* Caixa de Destino */}
                            <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider ml-0.5">
                                        Caixa de Destino
                                    </label>
                                    {destChurchId === effectiveGeneralCashId && (
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            ⭐ Caixa Geral Oficial
                                        </span>
                                    )}
                                </div>
                                <select
                                    value={destChurchId}
                                    onChange={e => setDestChurchId(e.target.value)}
                                    disabled={destinationChurches.length === 0}
                                    className="w-full rounded-xl border-2 border-orange-400/80 dark:border-orange-500/80 bg-white dark:bg-slate-900 p-3 text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-xs cursor-pointer"
                                >
                                    {destinationChurches.length === 0 ? (
                                        <option value="">Nenhum outro caixa registrado</option>
                                    ) : (
                                        <>
                                            <option value="" disabled>Selecione o Caixa de Destino...</option>
                                            {destinationChurches.map(c => {
                                                const isCG = c.id === effectiveGeneralCashId;
                                                return (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} {isCG ? '⭐ (Caixa Geral Oficial)' : ''}
                                                    </option>
                                                );
                                            })}
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Data do Fechamento */}
                            <div className="space-y-1 pt-1">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 ml-0.5">
                                    Data do Fechamento
                                </label>
                                <div className="relative">
                                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        type="date"
                                        value={closingDate}
                                        onChange={e => setClosingDate(e.target.value)}
                                        className="w-full sm:w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500 py-1.5 pl-9 pr-3 outline-none text-xs font-bold"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 ml-0.5">
                                    Definida automaticamente pelo período do Livro Caixa ({formatDateBRL(closingDate)}).
                                </p>
                            </div>

                            {/* Opções Avançadas Recolhidas por Padrão */}
                            <details className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                                <summary className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer select-none py-1">
                                    + Observações e Assinaturas Digitais (Opcional)
                                </summary>
                                <div className="space-y-3 pt-2">
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Parecer / Observações do Fechamento
                                        </label>
                                        <input
                                            type="text"
                                            value={customMemo}
                                            onChange={e => setCustomMemo(e.target.value)}
                                            placeholder="Ex: CONTAS ANALISADAS E APROVADAS SEM RESSALVAS"
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs font-semibold uppercase placeholder:normal-case outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>

                                    <DigitalSignatureCollectionSection
                                        signatures={signatures}
                                        onChangeSignatures={setSignatures}
                                        church={fullChurch}
                                        defaultPastorName={selectedOriginChurch?.pastor || ''}
                                        defaultTreasurerName={fullChurch?.treasurer || ''}
                                        targetChurch={churches?.find(c => c.id === destChurchId) || null}
                                        defaultTargetTreasurerName=""
                                    />
                                </div>
                            </details>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer"
                            >
                                Voltar ao Livro Caixa
                            </button>

                            <button
                                type="button"
                                disabled={isSubmitting || !originChurchId || (destinationChurches.length > 0 && !destChurchId)}
                                onClick={handleConfirm}
                                className="w-full sm:w-auto px-8 py-3 text-xs font-black text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 rounded-xl shadow-lg shadow-orange-500/25 transition-all uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                <span>{isSubmitting ? 'Confirmando Fechamento...' : 'Confirmar Fechamento'}</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    if (asView) {
        return (
            <div className="w-full space-y-4 max-w-full min-h-full flex flex-col animate-fade-in pb-8 md:pb-4">
                {/* Header Card - Exactly identical to Livro Caixa's Header Card */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex-shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl text-white shadow-md shadow-orange-500/20 shrink-0">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                    Fechamento do Livro Caixa
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Confira o saldo a transportar, selecione o Caixa de destino e confirme o fechamento.
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
                                <span>Voltar ao Livro Caixa</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Card - Exactly identical to Livro Caixa's Main Content Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 md:p-6 shadow-sm space-y-5">
                    {/* Control & Filter Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                    Fechamento do Livro Caixa
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    {selectedOriginChurch?.name ? `${selectedOriginChurch.name} • ` : ''}Mês {String(closingMonth).padStart(2, '0')}/{closingYear}
                                </p>
                            </div>
                        </div>

                        {existingRecord ? (
                            <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>FECHAMENTO HOMOLOGADO ({existingRecord.signatures?.length || 0} ASSINATURAS)</span>
                            </span>
                        ) : (
                            <span className="px-3 py-1 rounded-xl text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5" />
                                <span>PRONTO PARA HOMOLOGAÇÃO</span>
                            </span>
                        )}
                    </div>

                    {renderInnerContent()}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in my-auto">
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-black/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl text-white shadow-md shadow-orange-500/20 shrink-0">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                Fechamento do Livro Caixa
                            </h3>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                                Confira o saldo a transportar, selecione o Caixa de destino e confirme
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {renderInnerContent()}
                </div>
            </div>
        </div>
    );
};
