import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, PlusIcon, TrashIcon, BuildingOfficeIcon } from '../Icons';
import { formatCurrency, formatDate, isPeriodClosed, getDateChurchLockReason } from '../../utils/formatters';
import { MatchResult, TransactionSplit } from '../../types';
import { Layers, Split, Calendar, User, Tag, CreditCard, DollarSign, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface SplitTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    matchResult: MatchResult | null;
    onSave: (splits: TransactionSplit[]) => void;
}

export const SplitTransactionModal: React.FC<SplitTransactionModalProps> = ({
    isOpen,
    onClose,
    matchResult,
    onSave
}) => {
    const { 
        contributionTypes, 
        contributionKeywords, 
        paymentMethods, 
        churches, 
        contributorFiles, 
        contributors: rawContributors,
        matchResults,
        language 
    } = useContext(AppContext);
    const { t } = useTranslation();

    const [splits, setSplits] = useState<TransactionSplit[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeSuggestionSplitId, setActiveSuggestionSplitId] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const activeTxIdRef = useRef<string | null>(null);

    // Detalhes da transação original
    const originalAmount = matchResult ? matchResult.transaction.amount : 0;
    const isExpense = originalAmount < 0;
    const absoluteOriginal = Math.abs(originalAmount);

    // Lista de todas as igrejas válidas
    const validChurches = useMemo(() => {
        return (churches || []).filter((c: any) => c && c.id && c.id !== 'unidentified');
    }, [churches]);

    // Métodos de pagamento cadastrados
    const paymentMethodsOptions = useMemo(() => {
        const list = Array.isArray(paymentMethods) ? [...paymentMethods] : [];
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
    }, [paymentMethods]);

    // Categorias / Tipos de contribuição dinâmicos baseados no tipo (Entrada / Saída)
    const categoryOptions = useMemo(() => {
        if (isExpense) {
            const registeredSaidas = (contributionTypes || [])
                .filter((ct: any) => ct.type === 'saida' && ct.is_active !== false)
                .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || (a.name || '').localeCompare(b.name || ''))
                .map((ct: any) => ct.name)
                .filter(Boolean);

            if (registeredSaidas.length > 0) return registeredSaidas;

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

        if (registeredEntradas.length > 0) return registeredEntradas;

        const list = Array.isArray(contributionKeywords) && contributionKeywords.length > 0 
            ? [...contributionKeywords] 
            : ['Dízimo', 'Oferta'];
        if (!list.includes('Dízimo')) list.unshift('Dízimo');
        if (!list.includes('Oferta')) list.push('Oferta');
        return list;
    }, [isExpense, contributionTypes, contributionKeywords]);

    // Lista consolidada de membros / contribuintes cadastrados para auto-sugestão
    const allContributors = useMemo(() => {
        if (contributorFiles && contributorFiles.length > 0) {
            return contributorFiles.flatMap(file => {
                const church = churches.find((c: any) => c.id === file.churchId);
                return (file.contributors || []).map(c => ({
                    ...c,
                    _churchName: church?.name || 'Desconhecida',
                    _churchId: church?.id
                }));
            });
        }
        if (rawContributors && rawContributors.length > 0) {
            return rawContributors.map((c: any) => {
                const church = churches.find((ch: any) => ch.id === c.churchId || ch.id === c._churchId);
                return {
                    ...c,
                    _churchName: church?.name || c._churchName || 'Desconhecida',
                    _churchId: church?.id || c.churchId || c._churchId
                };
            });
        }
        return [];
    }, [contributorFiles, rawContributors, churches]);

    // Fechar sugestões ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.contributor-suggestion-box')) {
                setActiveSuggestionSplitId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Salva alterações atômicas no estado e no rascunho persistente de sessão
    const updateSplitsWithPersistence = (updater: (prev: TransactionSplit[]) => TransactionSplit[]) => {
        setSplits(prev => {
            const next = updater(prev);
            const txId = matchResult?.transaction?.id;
            if (txId) {
                try {
                    sessionStorage.setItem(`rateio_draft_${txId}`, JSON.stringify(next));
                } catch (e) {
                    // Ignore
                }
            }
            return next;
        });
    };

    // Fechamento consciente limpando o rascunho e a trava de transação ativa
    const handleCloseModal = () => {
        const txId = matchResult?.transaction?.id;
        if (txId) {
            try {
                sessionStorage.removeItem(`rateio_draft_${txId}`);
            } catch (e) {
                // Ignore
            }
        }
        activeTxIdRef.current = null;
        onClose();
    };

    // Inicialização ao abrir o modal (estritamente executada UMA VEZ por transação aberta)
    useEffect(() => {
        if (!isOpen) {
            activeTxIdRef.current = null;
            return;
        }

        if (isOpen && matchResult) {
            const txId = matchResult.transaction?.id;
            if (!txId) return;

            // 🛡️ BLINDAGEM CONTRA PERDA DE ESTADO:
            // Se o modal já está aberto e inicializado para esta mesma transação, NÃO REINICIALIZAR!
            // Isso impede que revalidações em segundo plano (polling, websockets, refresh do AppContext)
            // sobrescrevam o que o usuário está ativamente editando.
            if (activeTxIdRef.current === txId) {
                return;
            }
            activeTxIdRef.current = txId;

            const defaultChurchId = matchResult.church?.id && matchResult.church.id !== 'unidentified' 
                ? matchResult.church.id 
                : (validChurches[0]?.id || '');
            const defaultChurchName = matchResult.church?.name && matchResult.church.name !== 'Sem Igreja' 
                ? matchResult.church.name 
                : (validChurches[0]?.name || 'Igreja');
            const defaultMethod = matchResult.paymentMethod || matchResult.transaction.paymentMethod || 'PIX';
            const defaultContributorName = matchResult.contributor?.name || matchResult.contributor?.cleanedName || matchResult.transaction.cleanedDescription || matchResult.transaction.description || '';
            const defaultContributorId = matchResult.contributor?.id || '';
            const defaultType = matchResult.contributor?.contributionType || matchResult.contributionType || categoryOptions[0] || (isExpense ? 'Despesa Geral' : 'Dízimo');

            // 1. Tenta recuperar rascunho ativo não salvo caso tenha ocorrido re-mount acidental
            let loadedFromDraft = false;
            try {
                const savedDraft = sessionStorage.getItem(`rateio_draft_${txId}`);
                if (savedDraft) {
                    const parsed = JSON.parse(savedDraft);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setSplits(parsed);
                        loadedFromDraft = true;
                    }
                }
            } catch (e) {
                // Ignore
            }

            if (!loadedFromDraft) {
                if (matchResult.splits && matchResult.splits.length > 0) {
                    // Carregar splits existentes garantindo todos os campos padronizados
                    setSplits(matchResult.splits.map(s => ({
                        ...s,
                        amount: Math.abs(Number(s.amount) || 0),
                        contributionType: s.contributionType || defaultType,
                        contributorName: s.contributorName || defaultContributorName,
                        contributorId: s.contributorId || defaultContributorId,
                        churchId: s.churchId || defaultChurchId,
                        churchName: s.churchName || defaultChurchName,
                        paymentMethod: s.paymentMethod || defaultMethod,
                        description: s.description || ''
                    })));
                } else {
                    // Inicializar com 1 split cobrindo o valor total
                    setSplits([
                        {
                            id: Math.random().toString(36).substring(2, 9),
                            amount: absoluteOriginal,
                            contributionType: defaultType,
                            contributorName: defaultContributorName,
                            contributorId: defaultContributorId,
                            churchId: defaultChurchId,
                            churchName: defaultChurchName,
                            paymentMethod: defaultMethod,
                            description: ''
                        }
                    ]);
                }
            }

            setErrorMessage(null);
            setActiveSuggestionSplitId(null);
        }
    }, [isOpen, matchResult?.transaction?.id, absoluteOriginal, isExpense]);

    const effectiveTxDate = matchResult?.contributor?.reference_date || matchResult?.reference_date || matchResult?.transaction?.reference_date || matchResult?.transaction?.date || '';
    const sourceChurchId = matchResult?.church?.id && matchResult.church.id !== 'unidentified' ? matchResult.church.id : ((matchResult as any)?._churchId || undefined);
    const sourceBankId = (matchResult?.transaction as any)?.bank_id || (matchResult as any)?.bankId || undefined;
    const sourceLockReason = useMemo(() => {
        if (!matchResult) return null;
        if (matchResult.isConfirmed || matchResult.transaction?.isConfirmed) {
            return 'TRANSAÇÃO CONFIRMADA: Lançamentos com Confirmação Final não podem ser rateados ou alterados.';
        }
        if (sourceChurchId && isPeriodClosed(effectiveTxDate, matchResults, sourceChurchId, sourceBankId)) {
            return 'PERÍODO CONGELADO: Este lançamento pertence a um período fechado definitivamente e não pode ser rateado.';
        }
        return null;
    }, [matchResult, effectiveTxDate, matchResults, sourceChurchId, sourceBankId]);

    const totalSplitAmount = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const difference = Math.round((absoluteOriginal - totalSplitAmount) * 100) / 100;
    const isSumPerfect = Math.abs(difference) < 0.01;
    const hasInvalidAmount = splits.some(s => (Number(s.amount) || 0) <= 0);
    const hasInvalidDestination = splits.some(s => !(s.contributionType || '').trim());
    const isSaveEnabled = !sourceLockReason && isSumPerfect && !hasInvalidAmount && !hasInvalidDestination;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') handleCloseModal();
            if (e.key === 'Enter' && isSaveEnabled && !e.shiftKey) {
                const target = e.target as HTMLElement;
                if (target?.tagName === 'INPUT' || target?.tagName === 'SELECT') return;
                handleSaveClick();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isSaveEnabled, isSumPerfect, splits, absoluteOriginal, isExpense]);

    if (!isOpen || !matchResult) return null;

    const handleAddSplit = () => {
        const remainingAmount = Math.max(0, difference);
        const defaultChurchId = matchResult.church?.id && matchResult.church.id !== 'unidentified' 
            ? matchResult.church.id 
            : (validChurches[0]?.id || '');
        const defaultChurchName = matchResult.church?.name && matchResult.church.name !== 'Sem Igreja' 
            ? matchResult.church.name 
            : (validChurches[0]?.name || 'Igreja');
        const defaultMethod = matchResult.paymentMethod || matchResult.transaction.paymentMethod || 'PIX';
        const defaultContributorName = matchResult.contributor?.name || matchResult.contributor?.cleanedName || matchResult.transaction.cleanedDescription || matchResult.transaction.description || '';
        const defaultContributorId = matchResult.contributor?.id || '';
        const defaultType = categoryOptions[0] || (isExpense ? 'Despesa Geral' : 'Dízimo');

        updateSplitsWithPersistence(prev => [
            ...prev,
            {
                id: Math.random().toString(36).substring(2, 9),
                amount: remainingAmount > 0 ? remainingAmount : 0,
                contributionType: defaultType,
                contributorName: defaultContributorName,
                contributorId: defaultContributorId,
                churchId: defaultChurchId,
                churchName: defaultChurchName,
                paymentMethod: defaultMethod,
                description: ''
            }
        ]);
    };

    const handleRemoveSplit = (id: string) => {
        if (splits.length <= 1) return;
        updateSplitsWithPersistence(prev => prev.filter(s => s.id !== id));
    };

    const handleSplitChange = (id: string, field: keyof TransactionSplit, value: any) => {
        updateSplitsWithPersistence(prev => prev.map(s => {
            if (s.id === id) {
                if (field === 'amount') {
                    const strVal = String(value ?? '').replace(',', '.');
                    const parsed = parseFloat(strVal);
                    return { ...s, amount: isNaN(parsed) ? 0 : Math.abs(parsed) };
                }
                if (field === 'churchId') {
                    const found = validChurches.find(c => c.id === value);
                    return { ...s, churchId: value, churchName: found?.name || s.churchName };
                }
                return { ...s, [field]: value };
            }
            return s;
        }));
    };

    const handleSelectContributor = (splitId: string, contributor: any) => {
        const contributorName = contributor.name || contributor.cleanedName || '';
        const chId = contributor._churchId || contributor.church_id;
        const chName = contributor._churchName || contributor.church?.name;

        updateSplitsWithPersistence(prev => prev.map(s => {
            if (s.id === splitId) {
                return {
                    ...s,
                    contributorName: contributorName,
                    contributorId: contributor.id || '',
                    churchId: chId || s.churchId,
                    churchName: chName || s.churchName,
                    contributionType: contributor.contributionType || s.contributionType
                };
            }
            return s;
        }));
        setActiveSuggestionSplitId(null);
    };

    const handleSaveClick = () => {
        if (sourceLockReason) {
            setErrorMessage(sourceLockReason);
            return;
        }

        if (!isSumPerfect) {
            setErrorMessage(`A soma das distribuições (${formatCurrency(totalSplitAmount, language)}) precisa ser exatamente igual ao valor total (${formatCurrency(absoluteOriginal, language)})`);
            return;
        }

        const hasInvalidAmount = splits.some(s => (Number(s.amount) || 0) <= 0);
        if (hasInvalidAmount) {
            setErrorMessage('Cada distribuição deve ter um valor maior que zero.');
            return;
        }

        const hasEmptyDestination = splits.some(s => !(s.contributionType || '').trim());
        if (hasEmptyDestination) {
            setErrorMessage('Selecione a "Descrição / Destino" em todas as linhas do rateio.');
            return;
        }

        for (const s of splits) {
            const targetChurchId = s.churchId || sourceChurchId;
            if (targetChurchId && targetChurchId !== 'unidentified') {
                const splitLockReason = getDateChurchLockReason(
                    effectiveTxDate,
                    targetChurchId,
                    matchResults,
                    sourceBankId,
                    matchResult.transaction?.id
                );
                if (splitLockReason) {
                    setErrorMessage(splitLockReason);
                    return;
                }
            }
        }

        // Ajusta o sinal dos valores das distribuições para manter fidelidade com o lançamento original (positivo p/ receitas, negativo p/ despesas)
        // e define o campo description com o valor do destino selecionado
        const finalSplits: TransactionSplit[] = splits.map(s => {
            const dest = (s.contributionType || '').trim();
            return {
                ...s,
                amount: isExpense ? -Math.abs(Number(s.amount)) : Math.abs(Number(s.amount)),
                description: dest,
                contributionType: dest,
                date: matchResult.transaction.date
            };
        });

        const txId = matchResult.transaction?.id;
        if (txId) {
            try {
                sessionStorage.removeItem(`rateio_draft_${txId}`);
            } catch (e) {
                // Ignore
            }
        }
        activeTxIdRef.current = null;

        onSave(finalSplits);
        onClose();
    };

    const displayName = matchResult.contributor?.name || matchResult.contributor?.cleanedName || matchResult.transaction.cleanedDescription || matchResult.transaction.description;
    const displayDate = formatDate(matchResult.transaction.date);

    return (
        <div
            className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            onClick={handleCloseModal}
        >
            <div
                ref={modalRef}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full shadow-elevated border border-slate-200/90 dark:border-slate-800 flex flex-col max-h-[calc(100dvh-5rem)] md:max-h-[min(90vh,calc(100dvh-3rem))] overflow-hidden animate-scale-in"
            >
                
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center shrink-0 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <Split className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                Rateio / Desmembramento
                            </h3>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Distribuição de Valores por Destino e Cadastros Reais
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">Esc</span>
                        <button 
                            type="button" 
                            onClick={handleCloseModal} 
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            aria-label="Fechar"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div
                    className="p-4 sm:p-6 flex-1 overflow-y-auto w-full custom-scrollbar space-y-5"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
                >
                    
                    {/* Source Information Box */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                        <div className="space-y-1.5 min-w-0">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lançamento de Origem</span>
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase truncate max-w-xl">
                                {displayName}
                            </h4>
                            <div className="flex items-center flex-wrap gap-2 pt-0.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 text-[11px] tabular-nums">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {displayDate}
                                </span>
                                <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 text-[11px]">
                                    <BuildingOfficeIcon className="w-3.5 h-3.5 text-slate-400" />
                                    {matchResult.church?.name || 'Igreja não identificada'}
                                </span>
                                <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 text-[11px]">
                                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                                    {matchResult.contributionType || (isExpense ? 'Despesa' : 'Dízimo')}
                                </span>
                            </div>
                        </div>
                        <div className="sm:text-right shrink-0 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Valor Total a Ratear</span>
                            <p className={`text-xl font-bold tabular-nums tracking-tight ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                                {formatCurrency(absoluteOriginal, language)}
                            </p>
                        </div>
                    </div>

                    {/* Distribution Section */}
                    <div className="space-y-3.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                    Distribuições do Rateio (Linhas do Relatório)
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Cada item abaixo torna-se uma linha individual padronizada no relatório.</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={handleAddSplit}
                                className="px-3.5 py-1.5 text-xs font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 rounded-lg border border-orange-200/80 dark:border-orange-800/60 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                            >
                                <PlusIcon className="w-3.5 h-3.5" /> Adicionar Destino
                            </button>
                        </div>

                        {/* Splits List */}
                        <div className="space-y-3">
                            {splits.map((split, index) => {
                                const currentSplitContributors = (() => {
                                    const search = (split.contributorName || '').toLowerCase().trim();
                                    if (!search) {
                                        return allContributors.slice(0, 8);
                                    }
                                    return allContributors.filter(c => {
                                        const name = (c.name || c.cleanedName || '').toLowerCase();
                                        const cpf = (c.cpf || '').replace(/\D/g, '');
                                        return name.includes(search) || (cpf && cpf.includes(search.replace(/\D/g, '')));
                                    }).slice(0, 10);
                                })();

                                return (
                                    <div 
                                        key={split.id} 
                                        className="p-3.5 sm:p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-3"
                                    >
                                        {/* Top Header of Split Card */}
                                        <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 flex items-center justify-center bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold text-[11px] rounded-md border border-orange-200/80 dark:border-orange-800/60 tabular-nums">
                                                    #{index + 1}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                    Destino do Rateio
                                                </span>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => handleRemoveSplit(split.id)}
                                                disabled={splits.length <= 1}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors disabled:opacity-20 cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                                                title="Remover este destino"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Excluir</span>
                                            </button>
                                        </div>

                                        {/* Row 1: Core Fields (Valor, Descrição/Destino, Igreja, Forma de Pagamento) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                                            
                                            {/* Valor (R$) */}
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                                                    <DollarSign className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                                                    Valor (R$) <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none group-focus-within:text-orange-600">R$</span>
                                                    <input 
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        value={split.amount || ''}
                                                        onChange={(e) => handleSplitChange(split.id, 'amount', e.target.value)}
                                                        placeholder="0,00"
                                                        className="w-full pl-9 pr-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500 outline-none transition-colors tabular-nums"
                                                    />
                                                </div>
                                            </div>

                                            {/* Descrição / Destino (Cadastros Reais) */}
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                                                    <Tag className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                                                    Descrição / Destino <span className="text-rose-500">*</span>
                                                </label>
                                                <select
                                                    value={split.contributionType}
                                                    onChange={(e) => handleSplitChange(split.id, 'contributionType', e.target.value)}
                                                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500 outline-none transition-colors cursor-pointer"
                                                >
                                                    {categoryOptions.map((opt: string) => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                    {!categoryOptions.includes(split.contributionType) && split.contributionType && (
                                                        <option value={split.contributionType}>{split.contributionType}</option>
                                                    )}
                                                </select>
                                            </div>

                                            {/* Igreja / Congregação (Cadastros Reais) */}
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                                                    <BuildingOfficeIcon className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                                                    Igreja / Congregação <span className="text-rose-500">*</span>
                                                </label>
                                                <select
                                                    value={split.churchId || ''}
                                                    onChange={(e) => handleSplitChange(split.id, 'churchId', e.target.value)}
                                                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500 outline-none transition-colors cursor-pointer truncate"
                                                >
                                                    {validChurches.map((ch: any) => (
                                                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Forma de Pagamento (Cadastros Reais) */}
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                                                    <CreditCard className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                    Forma de Pagamento
                                                </label>
                                                <select
                                                    value={split.paymentMethod || 'PIX'}
                                                    onChange={(e) => handleSplitChange(split.id, 'paymentMethod', e.target.value)}
                                                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500 outline-none transition-colors cursor-pointer uppercase"
                                                >
                                                    {paymentMethodsOptions.map((m: string) => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Row 2: Contribuinte / Membro / Favorecido */}
                                        <div className="w-full">
                                            
                                            {/* Contribuinte / Membro / Favorecido (Busca e Auto-Complete Real) */}
                                            <div className="relative contributor-suggestion-box">
                                                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                                                    <User className="w-3 h-3 text-slate-400" />
                                                    Contribuinte / Favorecido
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="text"
                                                        value={split.contributorName || ''}
                                                        onChange={(e) => {
                                                            handleSplitChange(split.id, 'contributorName', e.target.value);
                                                            setActiveSuggestionSplitId(split.id);
                                                        }}
                                                        onFocus={() => setActiveSuggestionSplitId(split.id)}
                                                        placeholder="Buscar membro cadastrado ou digitar nome..."
                                                        className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500 outline-none transition-colors uppercase"
                                                    />
                                                </div>

                                                {/* Suggestions Dropdown */}
                                                {activeSuggestionSplitId === split.id && currentSplitContributors.length > 0 && (
                                                    <div
                                                        className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-elevated z-30 max-h-48 overflow-y-auto custom-scrollbar p-1"
                                                        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                                                    >
                                                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
                                                            Membros / Contribuintes Cadastrados
                                                        </div>
                                                        {currentSplitContributors.map((c: any, cIdx: number) => (
                                                            <button
                                                                key={`${c.id || c.name}_${cIdx}`}
                                                                type="button"
                                                                onClick={() => handleSelectContributor(split.id, c)}
                                                                className="w-full text-left px-2.5 py-1.5 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-lg transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase truncate group-hover:text-orange-600 dark:group-hover:text-orange-400">
                                                                        {c.name || c.cleanedName}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 truncate tabular-nums">
                                                                        {c._churchName || c.church?.name || 'Igreja'} {c.cpf ? `• CPF: ${c.cpf}` : ''}
                                                                    </p>
                                                                </div>
                                                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded shrink-0">
                                                                    Selecionar
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Summary Balance Strip */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs">
                        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center divide-x divide-slate-200/70 dark:divide-slate-700">
                            <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Distribuído</span>
                                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                                    {formatCurrency(totalSplitAmount, language)}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Original</span>
                                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                                    {formatCurrency(absoluteOriginal, language)}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Saldo Restante</span>
                                <p className={`text-xs sm:text-sm font-bold mt-0.5 tabular-nums ${isSumPerfect ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {formatCurrency(difference, language)}
                                </p>
                            </div>
                        </div>

                        {/* Status Message */}
                        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700 flex flex-col items-center gap-1.5 justify-center">
                            {isSumPerfect ? (
                                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Total 100% conferido e distribuído com precisão!
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-200/80 dark:border-amber-800/60 tabular-nums">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {difference > 0 
                                        ? `Faltam ${formatCurrency(difference, language)} para completar o total.` 
                                        : `O valor ultrapassou o total em ${formatCurrency(Math.abs(difference), language)}.`}
                                </div>
                            )}

                            {hasInvalidDestination && (
                                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/80 dark:border-amber-800/60">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Selecione a "Descrição / Destino" em todas as linhas para liberar o botão Salvar.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error / Lock Banner */}
                    {(sourceLockReason || errorMessage) && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800/60 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{sourceLockReason || errorMessage}</span>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-slate-50/70 dark:bg-slate-900">
                    <button 
                        type="button" 
                        onClick={handleCloseModal} 
                        className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button 
                            type="button" 
                            onClick={handleSaveClick}
                            disabled={!isSaveEnabled}
                            className="w-full sm:w-auto px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Salvar Rateio ({splits.length} Linhas)
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
