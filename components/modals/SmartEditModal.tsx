
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, SearchIcon, UserIcon, ArrowsRightLeftIcon, BanknotesIcon, SparklesIcon, FloppyDiskIcon } from '../Icons';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calculateNameSimilarity, normalizeString, parseDate } from '../../services/processingService';
import { Contributor, MatchResult } from '../../types';

interface SuggestionItem {
    id: string;
    primaryText: string;
    secondaryText: string;
    amount: number;
    date?: string;
    originalRef: any;
    score: number;
    type: 'contributor' | 'transaction';
    isAiSuggestion?: boolean;
}

export const SmartEditModal: React.FC = () => {
    const { 
        smartEditTarget, 
        closeSmartEdit, 
        saveSmartEdit, 
        contributorFiles, 
        churches,
        matchResults, 
        effectiveIgnoreKeywords,
        handleAnalyze,
        aiSuggestion,
        loadingAiId
    } = useContext(AppContext);
    const { language } = useTranslation();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    
    // States for Manual Override
    const [manualName, setManualName] = useState('');
    const [manualAmount, setManualAmount] = useState('');
    const [isManualMode, setIsManualMode] = useState(false);

    // Draggable State
    const [position, setPosition] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{x: number, y: number}>({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    // Determine Mode: If PENDENTE, we are looking for a Bank Transaction to match this Contributor.
    const isReverseMode = useMemo(() => smartEditTarget?.status === 'PENDENTE', [smartEditTarget]);

    useEffect(() => {
        if (smartEditTarget) {
            setSearchQuery('');
            const nameToEdit = smartEditTarget.contributor?.cleanedName || smartEditTarget.transaction.cleanedDescription || '';
            const amountToEdit = String(smartEditTarget.contributor?.amount || smartEditTarget.transaction.amount);
            
            setManualName(nameToEdit);
            setManualAmount(amountToEdit);
            setIsManualMode(false);
            setPosition(null);
        }
    }, [smartEditTarget]);

    // Drag Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if (modalRef.current) {
            setIsDragging(true);
            const rect = modalRef.current.getBoundingClientRect();
            dragStart.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                e.preventDefault();
                const newX = e.clientX - dragStart.current.x;
                const newY = e.clientY - dragStart.current.y;
                setPosition({ x: newX, y: newY });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // --- DATA PREPARATION ---
    const allContributors = useMemo(() => {
        return contributorFiles.flatMap(file => {
            const church = churches.find(c => c.id === file.churchId);
            return file.contributors?.map(c => ({
                ...c,
                _churchName: church?.name || 'Desconhecida',
                _churchId: church?.id
            })) || [];
        });
    }, [contributorFiles, churches]);

    const availableBankTransactions = useMemo(() => {
        return matchResults.filter(r => r.status === 'NÃO IDENTIFICADO');
    }, [matchResults]);

    // --- TRIGGER AI ANALYSIS ---
    useEffect(() => {
        if (smartEditTarget && !isReverseMode && allContributors.length > 0) {
            // Se já tiver sugestão (do algoritmo), não precisa chamar a IA imediatamente, mas pode.
            // Aqui mantemos a chamada da IA (Gemini) para complementar/validar
            handleAnalyze(smartEditTarget.transaction, allContributors);
        }
    }, [smartEditTarget, isReverseMode, allContributors, handleAnalyze]);

    // --- SCORING & SUGGESTIONS LOGIC ---
    useEffect(() => {
        if (!smartEditTarget) return;

        let items: SuggestionItem[] = [];

        if (isReverseMode) {
            // ... (Reverse Logic - Same as before)
            const targetContributor = smartEditTarget.contributor;
            if (!targetContributor) return;

            const targetAmount = targetContributor.amount;
            const targetDate = parseDate(targetContributor.date);

            items = availableBankTransactions.map(res => {
                const tx = res.transaction;
                let score = 0;
                if (Math.abs(tx.amount - targetAmount) < 0.05) score += 50;
                const sim = calculateNameSimilarity(tx.description, targetContributor, effectiveIgnoreKeywords);
                score += sim * 0.4;
                if (targetDate) {
                    const txDate = parseDate(tx.date);
                    if (txDate) {
                        const diffDays = Math.abs(txDate.getTime() - targetDate.getTime()) / (1000 * 3600 * 24);
                        if (diffDays <= 2) score += 20;
                        else if (diffDays <= 5) score += 10;
                    }
                }
                return {
                    id: tx.id,
                    primaryText: tx.cleanedDescription || tx.description,
                    secondaryText: `Extrato • ${formatDate(tx.date)}`,
                    amount: tx.amount,
                    date: tx.date,
                    originalRef: res,
                    score,
                    type: 'transaction'
                };
            });

        } else {
            const tx = smartEditTarget.transaction;
            const txAmount = Math.abs(tx.amount);
            const txDate = parseDate(tx.date);

            items = allContributors.map(c => {
                let score = 0;
                if (Math.abs(c.amount - txAmount) < 0.05) score += 50;
                const sim = calculateNameSimilarity(tx.description, c, effectiveIgnoreKeywords);
                score += sim * 0.4; 
                if (txDate && c.date) {
                    const cDate = parseDate(c.date);
                    if (cDate) {
                        const diffDays = Math.abs(txDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24);
                        if (diffDays <= 2) score += 20;
                        else if (diffDays <= 5) score += 10;
                    }
                }
                return {
                    id: c.id || `contributor-${Math.random()}`,
                    primaryText: c.cleanedName || c.name,
                    secondaryText: `${c._churchName} • ${c.date ? formatDate(c.date) : 'S/D'}`,
                    amount: c.amount,
                    date: c.date,
                    originalRef: c,
                    score,
                    type: 'contributor'
                };
            });
        }

        const topMatches = items
            .filter(i => i.score > 20) 
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        // --- INJETAR SUGESTÕES ---
        let finalSuggestions = [...topMatches];

        // 1. Sugestão Algorítmica Pré-Calculada (do MatchResult)
        if (smartEditTarget.suggestion) {
            // Verifica se já está na lista
            const alreadyInList = finalSuggestions.some(i => i.originalRef === smartEditTarget.suggestion);
            if (!alreadyInList) {
                const s = smartEditTarget.suggestion;
                const church = churches.find(c => c.id === (s as any).church?.id || (s as any)._churchId);
                const item: SuggestionItem = {
                    id: s.id || `sug-${Math.random()}`,
                    primaryText: s.cleanedName || s.name,
                    secondaryText: `${church?.name || s._churchName || 'Igreja'} (Algoritmo)`,
                    amount: s.amount,
                    date: s.date,
                    originalRef: s,
                    score: 100, // Força topo
                    type: 'contributor',
                    isAiSuggestion: true
                };
                finalSuggestions = [item, ...finalSuggestions];
            }
        }

        // 2. Sugestão da IA (Gemini) - Sobrescreve ou Adiciona
        if (aiSuggestion && smartEditTarget.transaction.id === aiSuggestion.id) {
            const suggestedItem = items.find(i => 
                normalizeString(i.primaryText) === normalizeString(aiSuggestion.name)
            );
            
            if (suggestedItem) {
                // Remove dos matches normais para não duplicar e adiciona no topo
                finalSuggestions = finalSuggestions.filter(i => i.id !== suggestedItem.id);
                finalSuggestions = [
                    { ...suggestedItem, isAiSuggestion: true, secondaryText: 'Sugestão Inteligente IA' },
                    ...finalSuggestions
                ];
            }
        }

        setSuggestions(finalSuggestions.slice(0, 5));

    }, [smartEditTarget, isReverseMode, allContributors, availableBankTransactions, effectiveIgnoreKeywords, aiSuggestion, churches]);

    // --- SEARCH FILTERING ---
    const filteredList = useMemo(() => {
        if (!searchQuery) return [];
        const lowerQ = searchQuery.toLowerCase().trim();
        const dateQuery = lowerQ.replace(/[-.]/g, '/'); 
        let pool: SuggestionItem[] = [];

        if (isReverseMode) {
            pool = availableBankTransactions.map(res => ({
                id: res.transaction.id,
                primaryText: res.transaction.cleanedDescription || res.transaction.description,
                secondaryText: `Extrato • ${formatDate(res.transaction.date)}`,
                amount: res.transaction.amount,
                date: res.transaction.date,
                originalRef: res,
                score: 0,
                type: 'transaction'
            }));
        } else {
            pool = allContributors.map(c => ({
                id: c.id || `c-${Math.random()}`,
                primaryText: c.cleanedName || c.name,
                secondaryText: `${c._churchName} • ${c.date ? formatDate(c.date) : 'S/D'}`,
                amount: c.amount,
                date: c.date,
                originalRef: c,
                score: 0,
                type: 'contributor'
            }));
        }

        return pool.filter(item => {
            if (item.primaryText.toLowerCase().includes(lowerQ)) return true;
            const amountStr = Math.abs(item.amount).toFixed(2);
            const amountStrComma = amountStr.replace('.', ',');
            const rawAmountStr = String(Math.abs(item.amount));
            if (amountStr.includes(lowerQ) || amountStrComma.includes(lowerQ) || rawAmountStr.includes(lowerQ)) return true;
            if (item.date) {
                if (item.date.includes(lowerQ)) return true;
                const parts = item.date.split('-');
                if (parts.length === 3) {
                    const brDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    const shortDate = `${parts[2]}/${parts[1]}`;
                    if (brDate.includes(dateQuery) || shortDate.includes(dateQuery)) return true;
                }
            }
            return false;
        }).slice(0, 20);

    }, [searchQuery, isReverseMode, allContributors, availableBankTransactions]);

    if (!smartEditTarget) return null;

    const handleSelect = (item: SuggestionItem) => {
        if (isReverseMode) {
            const targetMatchResult = item.originalRef as MatchResult;
            const pendingContributor = smartEditTarget.contributor;
            const church = smartEditTarget.church;
            const updated: MatchResult = {
                ...targetMatchResult,
                contributor: pendingContributor,
                church: church,
                status: 'IDENTIFICADO',
                matchMethod: 'MANUAL',
                similarity: 100,
                contributorAmount: pendingContributor?.amount,
                divergence: undefined
            };
            saveSmartEdit(updated);
        } else {
            const selectedContributor = item.originalRef;
            const church = churches.find(c => c.id === selectedContributor._churchId);
            const updated: MatchResult = {
                ...smartEditTarget,
                contributor: selectedContributor,
                church: church || smartEditTarget.church,
                status: 'IDENTIFICADO',
                matchMethod: item.isAiSuggestion ? 'AI' : 'MANUAL',
                similarity: 100,
                contributorAmount: selectedContributor.amount,
                divergence: undefined
            };
            saveSmartEdit(updated);
        }
    };

    const handleSaveManual = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(manualAmount);
        if (!manualName.trim() || isNaN(amount)) return;

        const manualContributor: Contributor = {
            id: `manual-edit-${smartEditTarget.transaction.id}-${Date.now()}`,
            name: manualName,
            cleanedName: manualName,
            normalizedName: normalizeString(manualName),
            amount: amount,
            date: smartEditTarget.contributor?.date || smartEditTarget.transaction.date
        };
        const updated: MatchResult = {
            ...smartEditTarget,
            contributor: manualContributor,
            church: smartEditTarget.church, 
            status: 'IDENTIFICADO',
            matchMethod: 'MANUAL',
            similarity: 100,
            contributorAmount: amount,
            divergence: undefined
        };
        saveSmartEdit(updated);
        setIsManualMode(false);
    };

    const ListItem: React.FC<{ item: SuggestionItem, isSuggestion?: boolean }> = ({ item, isSuggestion = false }) => (
        <button 
            onClick={() => handleSelect(item)}
            className={`w-full text-left p-2 rounded-lg border transition-all duration-200 group flex items-center justify-between mb-1.5
                ${item.isAiSuggestion 
                    ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border-purple-200 dark:border-purple-700 shadow-sm ring-1 ring-purple-100 dark:ring-purple-900' 
                    : isSuggestion 
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 hover:border-indigo-300' 
                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }
            `}
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <div className={`p-1.5 rounded-full flex-shrink-0 ${item.isAiSuggestion ? 'bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-200' : isSuggestion ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-800 dark:text-indigo-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {item.isAiSuggestion ? <SparklesIcon className="w-3 h-3 animate-pulse" /> : (item.type === 'contributor' ? <UserIcon className="w-3 h-3" /> : <BanknotesIcon className="w-3 h-3" />)}
                </div>
                <div className="min-w-0">
                    <p className={`text-[11px] font-bold truncate leading-tight ${item.isAiSuggestion ? 'text-purple-800 dark:text-purple-200' : isSuggestion ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>
                        {item.primaryText}
                    </p>
                    <p className={`text-[9px] truncate ${item.isAiSuggestion ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}>
                        {item.secondaryText}
                    </p>
                </div>
            </div>
            <div className="text-right flex-shrink-0 ml-1">
                <span className={`text-[10px] font-bold font-mono ${item.isAiSuggestion ? 'text-purple-700 dark:text-purple-300' : isSuggestion ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`}>
                    {formatCurrency(item.amount, language)}
                </span>
            </div>
        </button>
    );

    return (
        <div className="glass-overlay animate-fade-in">
            <div 
                ref={modalRef}
                style={{
                    position: position ? 'fixed' : 'relative',
                    left: position ? position.x : 'auto',
                    top: position ? position.y : 'auto',
                    margin: 0,
                    zIndex: 100,
                    transform: position ? 'none' : undefined 
                }}
                className="glass-modal w-[320px] flex flex-col max-h-[500px] animate-scale-in rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 bg-white/95 dark:bg-slate-900/95"
            >
                <div 
                    onMouseDown={handleMouseDown}
                    className={`px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-move select-none group transition-colors ${isReverseMode ? 'bg-amber-50/50 dark:bg-amber-900/20' : 'bg-slate-50/50 dark:bg-slate-800/50'}`}
                >
                    <h3 className="text-xs font-black text-slate-700 dark:text-white tracking-tight flex items-center gap-2 uppercase">
                        <ArrowsRightLeftIcon className="w-3 h-3 text-slate-400 group-hover:text-brand-blue rotate-45 transition-colors" />
                        {isReverseMode ? 'Vincular Extrato' : 'Identificar'}
                    </h3>
                    <button 
                        onClick={closeSmartEdit} 
                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700 shrink-0">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                                {isReverseMode ? 'Item Pendente (Lista)' : 'Transação (Banco)'}
                            </p>
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight" title={isReverseMode ? smartEditTarget.contributor?.name : smartEditTarget.transaction.description}>
                                {isReverseMode ? smartEditTarget.contributor?.name : smartEditTarget.transaction.description}
                            </p>
                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                                {formatDate(isReverseMode ? smartEditTarget.contributor?.date : smartEditTarget.transaction.date)}
                            </p>
                        </div>
                        <p className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tight whitespace-nowrap">
                            {formatCurrency(isReverseMode ? (smartEditTarget.contributor?.amount || 0) : smartEditTarget.transaction.amount, language)}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-white dark:bg-slate-900">
                    <div className="relative">
                        <SearchIcon className="w-3 h-3 text-slate-400 absolute top-1/2 left-2.5 -translate-y-1/2" />
                        <input 
                            type="text" 
                            autoFocus
                            placeholder={isReverseMode ? "Buscar no extrato..." : "Buscar nome, valor..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium shadow-sm focus:ring-1 focus:ring-brand-blue outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>

                    {!searchQuery && suggestions.length > 0 && !isManualMode && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <SearchIcon className="w-2.5 h-2.5 text-indigo-500" /> Sugestões
                                </h4>
                                {loadingAiId && (
                                    <span className="flex items-center gap-1 text-[8px] text-purple-500 animate-pulse font-bold bg-purple-50 px-1.5 py-0.5 rounded-full">
                                        <SparklesIcon className="w-2 h-2" /> IA Pensando...
                                    </span>
                                )}
                            </div>
                            {suggestions.map((item, idx) => <ListItem key={`sug-${idx}`} item={item} isSuggestion />)}
                        </div>
                    )}

                    {searchQuery && (
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Resultados</h4>
                            {filteredList.length > 0 ? (
                                filteredList.map((item, idx) => <ListItem key={`res-${idx}`} item={item} />)
                            ) : (
                                <div className="text-center py-4 text-slate-400 text-[10px] italic">Nada encontrado.</div>
                            )}
                        </div>
                    )}

                    {(!suggestions.length && !searchQuery) || isManualMode ? (
                        <div className="animate-fade-in">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Edição Manual</h4>
                                {isManualMode && <button onClick={() => setIsManualMode(false)} className="text-[9px] text-brand-blue hover:underline">Voltar</button>}
                            </div>
                            <form onSubmit={handleSaveManual} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Nome / Descrição</label>
                                    <input 
                                        type="text" 
                                        value={manualName} 
                                        onChange={e => setManualName(e.target.value)} 
                                        className="w-full p-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Valor</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={manualAmount} 
                                        onChange={e => setManualAmount(e.target.value)} 
                                        className="w-full p-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                                <button type="submit" className="w-full py-1.5 bg-brand-blue text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-blue-600 transition-colors shadow-sm flex items-center justify-center gap-1.5 mt-2">
                                    <FloppyDiskIcon className="w-3 h-3" /> Salvar
                                </button>
                            </form>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsManualMode(true)}
                            className="w-full py-2 text-[10px] font-bold text-slate-500 hover:text-brand-blue border border-dashed border-slate-300 hover:border-brand-blue rounded-lg transition-all"
                        >
                            Editar manualmente
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
