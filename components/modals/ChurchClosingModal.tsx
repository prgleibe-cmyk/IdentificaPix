import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { X, ArrowRight, Building2, Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Check } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { MatchResult, Church, ReconciliationStatus } from '../../types';

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
}

export const ChurchClosingModal: React.FC<ChurchClosingModalProps> = ({
    isOpen,
    onClose,
    currentChurchId
}) => {
    const { 
        churches, 
        matchResults, 
        setMatchResults, 
        saveCurrentReportChanges,
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

    // Calculate metrics for selected origin church
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
    }, [originChurchId, matchResults]);

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
            // Find a church that has "matriz" or "sede" in the name if possible, otherwise default to first
            const matrix = destinationChurches.find(c => c.name.toLowerCase().includes('matriz') || c.name.toLowerCase().includes('sede'));
            setDestChurchId(matrix ? matrix.id : destinationChurches[0].id);
        } else {
            setDestChurchId('');
        }
    }, [destinationChurches]);

    if (!isOpen) return null;

    const parsedAmount = parseFloat(transferAmount.replace(',', '.')) || 0;

    const handleConfirm = async () => {
        setErrorMessage(null);
        if (!originChurchId) {
            setErrorMessage('Selecione uma igreja de origem.');
            return;
        }
        if (!destChurchId) {
            setErrorMessage('Selecione uma igreja matriz de destino.');
            return;
        }
        if (parsedAmount <= 0) {
            setErrorMessage('O valor a ser transportado deve ser maior que zero.');
            return;
        }

        setIsSubmitting(true);
        try {
            const originChurch = churches.find(c => c.id === originChurchId) || activeChurches.find(c => c.id === originChurchId);
            const destChurch = churches.find(c => c.id === destChurchId);

            if (!originChurch || !destChurch) {
                throw new Error('Igrejas de origem ou destino não encontradas.');
            }

            const timestamp = Date.now();
            const dateStr = closingDate;

            const memoText = customMemo.trim() || `FECHAMENTO DE CAIXA PERÍODO`;

            // 1. Create OUTFLOW (Saída) transaction in the Origin Church
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

            // 2. Create INFLOW (Entrada) transaction in the Destination Matrix Church
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

            // Add both transactions to matchResults
            let updatedResults: MatchResult[] = [];
            setMatchResults((prev: any) => {
                const next = [...(prev || []), originMatch, destMatch];
                updatedResults = next;
                return next;
            });

            // Persist the changes to database/cloud
            if (saveCurrentReportChanges) {
                await saveCurrentReportChanges(updatedResults);
            }

            setSuccessMessage(`Fechamento concluído com sucesso! Saldo de ${formatCurrency(parsedAmount, language)} transportado da filial "${originChurch.name}" para a matriz "${destChurch.name}".`);
            setTimeout(() => {
                onClose();
            }, 3000);

        } catch (error: any) {
            console.error('[ChurchClosingModal] Error performing closing:', error);
            setErrorMessage(error.message || 'Erro inesperado ao realizar o fechamento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 dark:border-white/5 animate-scale-up flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-black/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                Fechamento de Filial & Transporte de Saldo
                            </h3>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                                Gerencie e centralize os recursos das igrejas de forma profissional
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                    {successMessage ? (
                        <div className="p-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-500 mx-auto border border-emerald-100 dark:border-emerald-900/50 animate-bounce">
                                <Check className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white">Fechamento Concluído!</h4>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                                {successMessage}
                            </p>
                        </div>
                    ) : (
                        <>
                            {errorMessage && (
                                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400">
                                    {errorMessage}
                                </div>
                            )}

                            {/* Origin & Destination Selector Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                                {/* Filial de Origem */}
                                <div className="md:col-span-3 space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                        Igreja Filial (Origem)
                                    </label>
                                    <select
                                        value={originChurchId}
                                        onChange={e => setOriginChurchId(e.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                                    >
                                        <option value="" disabled>Selecione a Filial...</option>
                                        {activeChurches.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                        {activeChurches.length === 0 && (churches || []).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Flow Indicator */}
                                <div className="md:col-span-1 flex justify-center pt-4 md:pt-0">
                                    <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-500 border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                                        <ArrowRight className="w-4 h-4 rotate-90 md:rotate-0" />
                                    </div>
                                </div>

                                {/* Matriz de Destino */}
                                <div className="md:col-span-3 space-y-2">
                                    <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest ml-1">
                                        Igreja Matriz (Destino)
                                    </label>
                                    <select
                                        value={destChurchId}
                                        onChange={e => setDestChurchId(e.target.value)}
                                        disabled={destinationChurches.length === 0}
                                        className="w-full rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/10 dark:bg-indigo-950/10 p-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
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
                            </div>

                            {/* Resumo Financeiro da Filial */}
                            {originChurchId && (
                                <div className="bg-slate-50 dark:bg-black/25 rounded-3xl p-5 border border-slate-100 dark:border-white/5 space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-white/5 pb-2.5">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            Resultado Operacional no Período
                                        </span>
                                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-bold uppercase">
                                            {activeChurches.find(c => c.id === originChurchId)?.name || churches.find(c => c.id === originChurchId)?.name || 'Filial'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        {/* Receitas */}
                                        <div className="space-y-1 bg-white dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 uppercase tracking-wider">
                                                <ArrowUpRight className="w-3 h-3" />
                                                <span>Receitas</span>
                                            </div>
                                            <p className="text-sm font-black text-slate-800 dark:text-white font-mono leading-none pt-1">
                                                {formatCurrency(metrics.income, language)}
                                            </p>
                                        </div>

                                        {/* Despesas */}
                                        <div className="space-y-1 bg-white dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-500 uppercase tracking-wider">
                                                <ArrowDownRight className="w-3 h-3" />
                                                <span>Despesas</span>
                                            </div>
                                            <p className="text-sm font-black text-slate-800 dark:text-white font-mono leading-none pt-1">
                                                {formatCurrency(metrics.expenses, language)}
                                            </p>
                                        </div>

                                        {/* Saldo Disponível */}
                                        <div className="space-y-1 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-100/50 dark:border-indigo-950 flex flex-col justify-center">
                                            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                                                Saldo Líquido
                                            </span>
                                            <p className={`text-sm font-black font-mono leading-none pt-1 ${metrics.balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500'}`}>
                                                {formatCurrency(metrics.balance, language)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Transfer Config */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Valor do Aporte */}
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                        Valor a Transportar (R$)
                                    </label>
                                    <div className="relative group">
                                        <DollarSign className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                                        <input
                                            type="text"
                                            value={transferAmount}
                                            onChange={e => setTransferAmount(e.target.value.replace(/[^0-9,]/g, ''))}
                                            placeholder="0,00"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-indigo-500/10 py-3.5 pl-12 pr-4 transition-all outline-none text-sm font-black font-mono"
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-bold ml-1">
                                        Preenchido automaticamente com o Saldo Líquido atual da filial.
                                    </p>
                                </div>

                                {/* Data de Fechamento */}
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                        Data do Lançamento
                                    </label>
                                    <div className="relative group">
                                        <Calendar className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                                        <input
                                            type="date"
                                            value={closingDate}
                                            onChange={e => setClosingDate(e.target.value)}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-indigo-500/10 py-3.5 pl-12 pr-4 transition-all outline-none text-sm font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Histórico / Observação */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                    Histórico / Descrição do Lançamento
                                </label>
                                <input
                                    type="text"
                                    value={customMemo}
                                    onChange={e => setCustomMemo(e.target.value)}
                                    placeholder="Ex: FECHAMENTO DE CAIXA REFERENTE AO MÊS DE JUNHO"
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-indigo-500/10 p-3.5 outline-none text-sm font-bold uppercase placeholder:normal-case placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                                <p className="text-[9px] text-slate-400 font-semibold ml-1">
                                    O sistema criará automaticamente duas transações de transferência vinculadas pelo histórico, garantindo transparência contábil completa.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!successMessage && (
                    <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/10 flex justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 text-xs font-bold rounded-full border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={isSubmitting || destinationChurches.length === 0}
                            onClick={handleConfirm}
                            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black rounded-full shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {isSubmitting ? 'Processando...' : 'Confirmar Fechamento'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
