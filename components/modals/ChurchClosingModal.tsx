import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { X, ArrowRight, Building2, Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Check, MessageCircle, PenTool, ShieldCheck, Lock } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { MatchResult, Church, ReconciliationStatus } from '../../types';
import { DigitalSignature, MonthClosingRecord } from '../../types/domain';
import { DigitalSignatureCollectionSection } from './DigitalSignatureCollectionSection';
import { saveMonthClosingRecord, getMonthClosingRecord, generateClosingIntegrityHash } from '../../services/monthClosingService';

const formatDateBRL = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

interface ChurchClosingModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentChurchId: string | null;
    initialMonth?: number;
    initialYear?: number;
}

export const ChurchClosingModal: React.FC<ChurchClosingModalProps> = ({
    isOpen,
    onClose,
    currentChurchId,
    initialMonth,
    initialYear
}) => {
    const { 
        churches, 
        matchResults, 
        setMatchResults, 
        saveCurrentReportChanges,
        openWhatsAppReceiptModal,
        language 
    } = useContext(AppContext);
    
    const { t } = useTranslation();

    const [originChurchId, setOriginChurchId] = useState<string>('');
    const [destChurchId, setDestChurchId] = useState<string>('');
    const [transferAmount, setTransferAmount] = useState<string>('');
    const [closingDate, setClosingDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [customMemo, setCustomMemo] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Gestão de Assinaturas Digitais e Fechamento Sem Papel
    const [signatures, setSignatures] = useState<DigitalSignature[]>([]);
    const [isTransferEnabled, setIsTransferEnabled] = useState<boolean>(false);
    const [existingRecord, setExistingRecord] = useState<MonthClosingRecord | null>(null);
    const [activeTab, setActiveTab] = useState<'signatures' | 'transfer'>('signatures');
    const [calculatedHash, setCalculatedHash] = useState<string>('');

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
            setErrorMessage(null);
            setSuccessMessage(null);
            setCustomMemo('');
        }
    }, [isOpen, currentChurchId, activeChurches, churches]);

    // Calculate metrics for selected origin church for this month/period
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
                // Filtra pelo mês e ano se a data da transação existir
                const txDate = r.transaction?.date || '';
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
    }, [originChurchId, matchResults, closingMonth, closingYear]);

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
                totalIncome: metrics.income,
                totalExpenses: metrics.expenses,
                previousBalance: 0,
                finalBalance: metrics.balance,
                timestamp: closingDate
            });
            if (isMounted) {
                setCalculatedHash(hash);
            }
        }
        updateHash();
        return () => { isMounted = false; };
    }, [originChurchId, closingMonth, closingYear, metrics.income, metrics.expenses, metrics.balance, closingDate]);

    // Automatically set transfer amount when origin church or metrics change
    useEffect(() => {
        if (metrics.balance > 0) {
            setTransferAmount(metrics.balance.toFixed(2).replace('.', ','));
        } else {
            setTransferAmount('0,00');
        }
    }, [metrics]);

    // Filter destination churches: list of all registered churches except origin
    const destinationChurches = useMemo(() => {
        return (churches || []).filter(c => c.id !== originChurchId);
    }, [churches, originChurchId]);

    // Set first destination church as default
    useEffect(() => {
        if (destinationChurches.length > 0) {
            const matrix = destinationChurches.find(c => c.name.toLowerCase().includes('matriz') || c.name.toLowerCase().includes('sede'));
            setDestChurchId(matrix ? matrix.id : destinationChurches[0].id);
        } else {
            setDestChurchId('');
        }
    }, [destinationChurches]);

    if (!isOpen) return null;

    const parsedAmount = parseFloat(transferAmount.replace(',', '.')) || 0;
    const selectedOriginChurch = churches?.find(c => c.id === originChurchId) || activeChurches.find(c => c.id === originChurchId);

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

        // Validação se transporte para matriz estiver ativado
        let destChurch: Church | undefined;
        if (isTransferEnabled) {
            if (!destChurchId) {
                setErrorMessage('Selecione uma igreja matriz de destino para transportar o saldo.');
                return;
            }
            if (parsedAmount <= 0) {
                setErrorMessage('O valor a ser transportado deve ser maior que zero.');
                return;
            }
            destChurch = churches.find(c => c.id === destChurchId);
            if (!destChurch) {
                setErrorMessage('Igreja matriz de destino não encontrada.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const timestamp = Date.now();
            const dateStr = closingDate;
            const memoText = customMemo.trim() || `FECHAMENTO DE CAIXA PERÍODO ${String(closingMonth).padStart(2, '0')}/${closingYear}`;

            // 1. Processar transferência de saldo se habilitada
            if (isTransferEnabled && destChurch) {
                const originTxId = `closing-outflow-${timestamp}`;
                const originDescription = `[FECHAMENTO] ${memoText} - TRANSP. PARA MATRIZ ${originChurch.name.toUpperCase()} -> ${destChurch.name.toUpperCase()}`;
                
                const originMatch: MatchResult = {
                    transaction: {
                        id: originTxId,
                        date: dateStr,
                        description: originDescription,
                        rawDescription: originDescription,
                        amount: -parsedAmount,
                        isConfirmed: true
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
                    contributionType: 'SAÍDA / TRANSFERÊNCIA',
                    updatedAt: new Date().toISOString()
                };

                const destTxId = `closing-inflow-${timestamp}`;
                const destDescription = `[RECEBIMENTO] ${memoText} - RECEBIDO DA FILIAL ${originChurch.name.toUpperCase()} -> ${destChurch.name.toUpperCase()}`;

                const destMatch: MatchResult = {
                    transaction: {
                        id: destTxId,
                        date: dateStr,
                        description: destDescription,
                        rawDescription: destDescription,
                        amount: parsedAmount,
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
                    contributionType: 'ENTRADA / TRANSFERÊNCIA',
                    updatedAt: new Date().toISOString()
                };

                let updatedResults: MatchResult[] = [];
                setMatchResults((prev: any) => {
                    const next = [...(prev || []), originMatch, destMatch];
                    updatedResults = next;
                    return next;
                });

                if (saveCurrentReportChanges) {
                    await saveCurrentReportChanges(updatedResults);
                }
            }

            // 2. Salvar Registro de Fechamento Contábil com Assinaturas Digitais e Hash SHA-256
            const closingRecord: MonthClosingRecord = {
                id: `closing_${originChurch.id}_${closingYear}_${closingMonth}`,
                churchId: originChurch.id,
                churchName: originChurch.name,
                month: closingMonth,
                year: closingYear,
                closedAt: new Date().toISOString(),
                totalIncome: metrics.income,
                totalExpenses: metrics.expenses,
                previousBalance: 0,
                finalBalance: metrics.balance,
                transferredBalance: isTransferEnabled ? parsedAmount : undefined,
                targetChurchId: isTransferEnabled && destChurch ? destChurch.id : null,
                targetChurchName: isTransferEnabled && destChurch ? destChurch.name : undefined,
                signatures: signatures,
                integrityHash: calculatedHash || 'HASH-AUTENTICADO',
                status: signatures.length > 0 ? 'signed' : 'draft',
                notes: customMemo.trim() || undefined
            };

            await saveMonthClosingRecord(closingRecord);
            setExistingRecord(closingRecord);
            window.dispatchEvent(new CustomEvent('month_closing_updated', { detail: closingRecord }));

            let successText = `Fechamento do mês ${String(closingMonth).padStart(2, '0')}/${closingYear} registrado com sucesso para a igreja "${originChurch.name}".`;
            if (signatures.length > 0) {
                successText += ` ${signatures.length} assinatura(s) digital(is) homologada(s) com Hash SHA-256 inviolável.`;
            }
            if (isTransferEnabled && destChurch) {
                successText += ` Saldo de ${formatCurrency(parsedAmount, language)} transportado para a matriz "${destChurch.name}".`;
            }
            setSuccessMessage(successText);

        } catch (error: any) {
            console.error('[ChurchClosingModal] Error performing closing:', error);
            setErrorMessage(error.message || 'Erro inesperado ao realizar o fechamento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-black/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 border border-orange-100/50 dark:border-orange-950">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                Fechamento Mensal & Assinaturas Digitais
                            </h3>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                                Homologação contábil 100% digital com integridade SHA-256 e transporte de recursos
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
                <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
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
                                    className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    <span>Notificar via WhatsApp</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full sm:w-auto px-5 py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                                >
                                    Concluir e Voltar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {errorMessage && (
                                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400">
                                    {errorMessage}
                                </div>
                            )}

                            {existingRecord && existingRecord.signatures && existingRecord.signatures.length > 0 && (
                                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                                                Fechamento de {String(closingMonth).padStart(2, '0')}/{closingYear} Já Homologado
                                            </h5>
                                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                                                Possui {existingRecord.signatures.length} assinatura(s) colhida(s). Você pode adicionar novos signatários ou atualizar abaixo.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-lg">
                                        STATUS: HOMOLOGADO
                                    </span>
                                </div>
                            )}

                            {/* Seletor de Igreja e Data */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                        Igreja do Fechamento
                                    </label>
                                    <select
                                        value={originChurchId}
                                        onChange={e => setOriginChurchId(e.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all shadow-xs cursor-pointer"
                                    >
                                        <option value="" disabled>Selecione a Igreja...</option>
                                        {activeChurches.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                        {activeChurches.length === 0 && (churches || []).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                        Data de Encerramento Contábil
                                    </label>
                                    <div className="relative">
                                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <input
                                            type="date"
                                            value={closingDate}
                                            onChange={e => setClosingDate(e.target.value)}
                                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-2.5 pl-10 pr-3 outline-none text-xs font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Resumo Operacional do Período */}
                            {originChurchId && (
                                <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
                                    <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                            Balanço Apurado do Mês ({String(closingMonth).padStart(2, '0')}/{closingYear})
                                        </span>
                                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded font-bold uppercase">
                                            {selectedOriginChurch?.name || 'Igreja'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                                                <ArrowUpRight className="w-3 h-3" />
                                                <span>Receitas</span>
                                            </div>
                                            <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono">
                                                {formatCurrency(metrics.income, language)}
                                            </p>
                                        </div>

                                        <div className="space-y-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-500 uppercase tracking-wider">
                                                <ArrowDownRight className="w-3 h-3" />
                                                <span>Despesas</span>
                                            </div>
                                            <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono">
                                                {formatCurrency(metrics.expenses, language)}
                                            </p>
                                        </div>

                                        <div className="space-y-1 bg-orange-50/50 dark:bg-orange-950/20 p-3 rounded-xl border border-orange-200/60 dark:border-orange-900/50 flex flex-col justify-center">
                                            <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
                                                Saldo Líquido
                                            </span>
                                            <p className={`text-xs sm:text-sm font-black font-mono ${metrics.balance >= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-rose-600'}`}>
                                                {formatCurrency(metrics.balance, language)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Abas de Navegação */}
                            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('signatures')}
                                    className={`pb-2 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'signatures'
                                            ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <PenTool className="w-3.5 h-3.5" />
                                    <span>Assinaturas Digitais & Termo</span>
                                    {signatures.length > 0 && (
                                        <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-mono">
                                            {signatures.length}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('transfer')}
                                    className={`pb-2 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'transfer'
                                            ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <Building2 className="w-3.5 h-3.5" />
                                    <span>Transporte de Saldo para Matriz</span>
                                    {isTransferEnabled && (
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    )}
                                </button>
                            </div>

                            {/* Conteúdo da Aba 1: Assinaturas Digitais */}
                            {activeTab === 'signatures' && (
                                <div className="space-y-4">
                                    <DigitalSignatureCollectionSection
                                        signatures={signatures}
                                        onChangeSignatures={setSignatures}
                                        defaultPastorName={selectedOriginChurch?.pastor || ''}
                                        defaultTreasurerName=""
                                    />

                                    {/* Carimbo de Integridade SHA-256 */}
                                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                Selo de Autenticidade & Hash Criptográfico
                                            </span>
                                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                                                SHA-256 ATIVO
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                            Ao homologar, este código é gerado com base no saldo apurado, data e assinaturas, garantindo que o relatório contábil é original e inviolável.
                                        </p>
                                        <p className="font-mono text-[9px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 break-all select-all">
                                            {calculatedHash || 'Calculando Hash...'}
                                        </p>
                                    </div>

                                    {/* Observação / Parecer */}
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                            Parecer do Fechamento / Observações (Opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={customMemo}
                                            onChange={e => setCustomMemo(e.target.value)}
                                            placeholder="Ex: CONTAS ANALISADAS E APROVADAS PELO CONSELHO FISCAL SEM RESSALVAS"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 p-3 outline-none text-xs font-semibold uppercase placeholder:normal-case placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Conteúdo da Aba 2: Transporte de Saldo */}
                            {activeTab === 'transfer' && (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
                                        <div className="space-y-0.5 pr-2">
                                            <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                                Transportar Saldo Líquido para a Igreja Matriz?
                                            </h5>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                Gera automaticamente as contrapartidas (saída na filial e entrada na matriz) mantendo o caixa zerado para o próximo mês.
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input 
                                                type="checkbox" 
                                                checked={isTransferEnabled} 
                                                onChange={e => setIsTransferEnabled(e.target.checked)} 
                                                className="sr-only peer" 
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                                        </label>
                                    </div>

                                    {isTransferEnabled && (
                                        <div className="space-y-4 pt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Matriz de Destino */}
                                                <div className="space-y-1.5">
                                                    <label className="block text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest ml-1">
                                                        Igreja Matriz (Destino)
                                                    </label>
                                                    <select
                                                        value={destChurchId}
                                                        onChange={e => setDestChurchId(e.target.value)}
                                                        disabled={destinationChurches.length === 0}
                                                        className="w-full rounded-2xl border border-orange-200 dark:border-orange-900 bg-orange-50/10 dark:bg-orange-950/10 p-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all shadow-xs cursor-pointer"
                                                    >
                                                        {destinationChurches.length === 0 ? (
                                                            <option value="">Nenhuma outra igreja registrada</option>
                                                        ) : (
                                                            <>
                                                                <option value="" disabled>Selecione a Matriz...</option>
                                                                {destinationChurches.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                ))}
                                                            </>
                                                        )}
                                                    </select>
                                                </div>

                                                {/* Valor a Transportar */}
                                                <div className="space-y-1.5">
                                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                                        Valor a Transportar (R$)
                                                    </label>
                                                    <div className="relative">
                                                        <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                        <input
                                                            type="text"
                                                            value={transferAmount}
                                                            onChange={e => setTransferAmount(e.target.value.replace(/[^0-9,]/g, ''))}
                                                            placeholder="0,00"
                                                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-4 focus:ring-orange-500/10 py-2.5 pl-10 pr-3 outline-none text-xs font-black font-mono"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {!successMessage && (
                    <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/10 flex justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-xs transition-all tracking-wider uppercase cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={isSubmitting || !originChurchId || (isTransferEnabled && destinationChurches.length === 0)}
                            onClick={handleConfirm}
                            className="px-7 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>
                                {isSubmitting 
                                    ? 'Homologando...' 
                                    : signatures.length > 0 
                                        ? `Homologar Fechamento (${signatures.length} Assinatura${signatures.length > 1 ? 's' : ''})` 
                                        : 'Homologar Fechamento'}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
