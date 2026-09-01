import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, PlusIcon, TrashIcon, BuildingOfficeIcon } from '../Icons';
import { formatCurrency, formatDate } from '../../utils/formatters';
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
        language 
    } = useContext(AppContext);
    const { t } = useTranslation();

    const [splits, setSplits] = useState<TransactionSplit[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeSuggestionSplitId, setActiveSuggestionSplitId] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

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

    // Inicialização ao abrir o modal
    useEffect(() => {
        if (isOpen && matchResult) {
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

            if (matchResult.splits && matchResult.splits.length > 0) {
                // Carregar splits existentes garantindo todos os campos padronizados
                setSplits(matchResult.splits.map(s => ({
                    ...s,
                    amount: Math.abs(s.amount),
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
            setErrorMessage(null);
            setActiveSuggestionSplitId(null);
        }
    }, [isOpen, matchResult, absoluteOriginal, isExpense, validChurches, categoryOptions]);

    const totalSplitAmount = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const difference = Math.round((absoluteOriginal - totalSplitAmount) * 100) / 100;
    const isSumPerfect = Math.abs(difference) < 0.01;
    const hasInvalidAmount = splits.some(s => (Number(s.amount) || 0) <= 0);
    const isAllDescriptionsFilled = splits.every(s => (s.description || '').trim().length > 0);
    const isSaveEnabled = isSumPerfect && !hasInvalidAmount && isAllDescriptionsFilled;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
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

        setSplits(prev => [
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
        setSplits(prev => prev.filter(s => s.id !== id));
    };

    const handleSplitChange = (id: string, field: keyof TransactionSplit, value: any) => {
        setSplits(prev => prev.map(s => {
            if (s.id === id) {
                if (field === 'amount') {
                    const parsed = parseFloat(value) || 0;
                    return { ...s, amount: Math.abs(parsed) };
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

        setSplits(prev => prev.map(s => {
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
        if (!isSumPerfect) {
            setErrorMessage(`A soma das distribuições (${formatCurrency(totalSplitAmount, language)}) precisa ser exatamente igual ao valor total (${formatCurrency(absoluteOriginal, language)})`);
            return;
        }

        const hasInvalidAmount = splits.some(s => (Number(s.amount) || 0) <= 0);
        if (hasInvalidAmount) {
            setErrorMessage('Cada distribuição deve ter um valor maior que zero.');
            return;
        }

        if (!isAllDescriptionsFilled) {
            setErrorMessage('O campo "Observação / Destino Específico" é obrigatório em todas as linhas do rateio.');
            return;
        }

        // Ajusta o sinal dos valores das distribuições para manter fidelidade com o lançamento original (positivo p/ receitas, negativo p/ despesas)
        const finalSplits: TransactionSplit[] = splits.map(s => ({
            ...s,
            amount: isExpense ? -Math.abs(Number(s.amount)) : Math.abs(Number(s.amount)),
            description: (s.description || '').trim(),
            date: matchResult.transaction.date
        }));

        onSave(finalSplits);
        onClose();
    };

    const displayName = matchResult.contributor?.name || matchResult.contributor?.cleanedName || matchResult.transaction.cleanedDescription || matchResult.transaction.description;
    const displayDate = formatDate(matchResult.transaction.date);

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fade-in">
            <div 
                ref={modalRef}
                className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] overflow-hidden animate-scale-in my-auto"
            >
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center shrink-0 bg-slate-50/70 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 text-white shadow-md shadow-orange-500/20">
                            <Split className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                Rateio / Desmembramento
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                Distribuição de Valores por Destino e Cadastros Reais
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded">Esc</span>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 flex-1 overflow-y-auto w-full custom-scrollbar space-y-5">
                    
                    {/* Source Information Box */}
                    <div className="bg-slate-50/90 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                        <div className="space-y-1.5 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lançamento de Origem</span>
                            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase truncate max-w-xl">
                                {displayName}
                            </h4>
                            <div className="flex items-center flex-wrap gap-2 pt-0.5 text-xs text-slate-500 font-semibold">
                                <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700/70 text-[11px]">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {displayDate}
                                </span>
                                <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700/70 text-[11px]">
                                    <BuildingOfficeIcon className="w-3.5 h-3.5 text-slate-400" />
                                    {matchResult.church?.name || 'Igreja não identificada'}
                                </span>
                                <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700/70 text-[11px]">
                                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                                    {matchResult.contributionType || (isExpense ? 'Despesa' : 'Dízimo')}
                                </span>
                            </div>
                        </div>
                        <div className="sm:text-right shrink-0 bg-white dark:bg-slate-800/90 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Total a Ratear</span>
                            <p className={`text-xl sm:text-2xl font-black tabular-nums tracking-tight ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                                {formatCurrency(absoluteOriginal, language)}
                            </p>
                        </div>
                    </div>

                    {/* Distribution Section */}
                    <div className="space-y-3.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-orange-500" />
                                    Distribuições do Rateio (Linhas do Relatório)
                                </h4>
                                <p className="text-[10px] text-slate-400 font-medium">Cada item abaixo torna-se uma linha individual padronizada no relatório.</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={handleAddSplit}
                                className="px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 rounded-xl border border-orange-200 dark:border-orange-800/60 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
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
                                        className="p-3.5 sm:p-4 bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-3"
                                    >
                                        {/* Top Header of Split Card */}
                                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 flex items-center justify-center bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 font-black text-[11px] rounded-lg border border-orange-200 dark:border-orange-800/60">
                                                    #{index + 1}
                                                </span>
                                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                    Destino do Rateio
                                                </span>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => handleRemoveSplit(split.id)}
                                                disabled={splits.length <= 1}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all disabled:opacity-20 cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                                                title="Remover este destino"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Excluir</span>
                                            </button>
                                        </div>

                                        {/* Row 1: Core Fields (Valor, Categoria, Igreja, Forma de Pagamento) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                                            
                                            {/* Valor (R$) */}
                                            <div>
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-0.5 flex items-center gap-1">
                                                    <DollarSign className="w-2.5 h-2.5 text-orange-500" />
                                                    Valor (R$) <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none group-focus-within:text-orange-600">R$</span>
                                                    <input 
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        value={split.amount || ''}
                                                        onChange={(e) => handleSplitChange(split.id, 'amount', e.target.value)}
                                                        placeholder="0,00"
                                                        className="w-full pl-9 pr-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* Tipo de Contribuição / Categoria (Cadastros Reais) */}
                                            <div>
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-0.5 flex items-center gap-1">
                                                    <Tag className="w-2.5 h-2.5 text-indigo-500" />
                                                    Tipo / Categoria <span className="text-rose-500">*</span>
                                                </label>
                                                <select
                                                    value={split.contributionType}
                                                    onChange={(e) => handleSplitChange(split.id, 'contributionType', e.target.value)}
                                                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
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
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-0.5 flex items-center gap-1">
                                                    <BuildingOfficeIcon className="w-2.5 h-2.5 text-sky-500" />
                                                    Igreja / Congregação <span className="text-rose-500">*</span>
                                                </label>
                                                <select
                                                    value={split.churchId || ''}
                                                    onChange={(e) => handleSplitChange(split.id, 'churchId', e.target.value)}
                                                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all cursor-pointer truncate"
                                                >
                                                    {validChurches.map((ch: any) => (
                                                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Forma de Pagamento (Cadastros Reais) */}
                                            <div>
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-0.5 flex items-center gap-1">
                                                    <CreditCard className="w-2.5 h-2.5 text-emerald-500" />
                                                    Forma de Pagamento
                                                </label>
                                                <select
                                                    value={split.paymentMethod || 'PIX'}
                                                    onChange={(e) => handleSplitChange(split.id, 'paymentMethod', e.target.value)}
                                                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer uppercase"
                                                >
                                                    {paymentMethodsOptions.map((m: string) => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Row 2: Contribuinte com busca + Observação */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                                            
                                            {/* Contribuinte / Membro / Favorecido (Busca e Auto-Complete Real) */}
                                            <div className="relative contributor-suggestion-box">
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-0.5 flex items-center gap-1">
                                                    <User className="w-2.5 h-2.5 text-violet-500" />
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
                                                        className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all uppercase"
                                                    />
                                                </div>

                                                {/* Suggestions Dropdown */}
                                                {activeSuggestionSplitId === split.id && currentSplitContributors.length > 0 && (
                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                        <div className="px-2 py-1 text-[8px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
                                                            Membros / Contribuintes Cadastrados
                                                        </div>
                                                        {currentSplitContributors.map((c: any, cIdx: number) => (
                                                            <button
                                                                key={`${c.id || c.name}_${cIdx}`}
                                                                type="button"
                                                                onClick={() => handleSelectContributor(split.id, c)}
                                                                className="w-full text-left px-2.5 py-1.5 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate group-hover:text-violet-600 dark:group-hover:text-violet-400">
                                                                        {c.name || c.cleanedName}
                                                                    </p>
                                                                    <p className="text-[9px] text-slate-400 truncate">
                                                                        {c._churchName || c.church?.name || 'Igreja'} {c.cpf ? `• CPF: ${c.cpf}` : ''}
                                                                    </p>
                                                                </div>
                                                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded shrink-0">
                                                                    Selecionar
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Observação / Finalidade / Destino */}
                                            <div>
                                                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-0.5 flex items-center justify-between">
                                                    <span className="flex items-center gap-1">
                                                        <FileText className="w-2.5 h-2.5 text-amber-500" />
                                                        Observação / Destino Específico
                                                    </span>
                                                    <span className="text-[7px] font-black text-amber-600 dark:text-amber-400 uppercase bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200/60 dark:border-amber-800/40">
                                                        * Obrigatório
                                                    </span>
                                                </label>
                                                <input 
                                                    type="text"
                                                    value={split.description || ''}
                                                    onChange={(e) => {
                                                        handleSplitChange(split.id, 'description', e.target.value);
                                                        if (errorMessage) setErrorMessage(null);
                                                    }}
                                                    placeholder="Ex: Oferta Especial, Missões, Reforma, etc."
                                                    className={`w-full px-3 py-2 text-xs font-semibold border rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs outline-none transition-all ${
                                                        !(split.description || '').trim() 
                                                            ? 'border-amber-300 dark:border-amber-700/60 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500' 
                                                            : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue'
                                                    }`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Summary Balance Strip */}
                    <div className="bg-slate-50/90 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
                        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center divide-x divide-slate-200/60 dark:divide-slate-800">
                            <div>
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400">Total Distribuído</span>
                                <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                                    {formatCurrency(totalSplitAmount, language)}
                                </p>
                            </div>
                            <div>
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400">Total Original</span>
                                <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                                    {formatCurrency(absoluteOriginal, language)}
                                </p>
                            </div>
                            <div>
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400">Saldo Restante</span>
                                <p className={`text-xs sm:text-sm font-black mt-0.5 tabular-nums ${isSumPerfect ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {formatCurrency(difference, language)}
                                </p>
                            </div>
                        </div>

                        {/* Status Message */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-col items-center gap-1.5 justify-center">
                            {isSumPerfect ? (
                                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800/60">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Total 100% conferido e distribuído com precisão!
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-200/80 dark:border-amber-800/60">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {difference > 0 
                                        ? `Faltam ${formatCurrency(difference, language)} para completar o total.` 
                                        : `O valor ultrapassou o total em ${formatCurrency(Math.abs(difference), language)}.`}
                                </div>
                            )}

                            {!isAllDescriptionsFilled && (
                                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/80 dark:border-amber-800/60">
                                    <AlertCircle className="w-3 h-3" />
                                    Preencha o campo "Observação / Destino Específico" em todas as linhas para liberar o botão Salvar.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-bold rounded-xl border border-red-200 dark:border-red-800/60 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-slate-900/50">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button 
                            type="button" 
                            onClick={handleSaveClick}
                            disabled={!isSaveEnabled}
                            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 hover:from-orange-600 hover:to-black text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
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
