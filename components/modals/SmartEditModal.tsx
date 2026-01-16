
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, SearchIcon, UserIcon, ArrowsRightLeftIcon, BanknotesIcon, SparklesIcon, FloppyDiskIcon } from '../Icons';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calculateNameSimilarity, normalizeString, parseDate } from '../../services/processingService';
import { Contributor, MatchResult, ReconciliationStatus, MatchMethod } from '../../types';

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
    
    const [manualName, setManualName] = useState('');
    const [manualAmount, setManualAmount] = useState('');
    const [manualChurchId, setManualChurchId] = useState('');
    const [isManualMode, setIsManualMode] = useState(false);

    const [position, setPosition] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{x: number, y: number}>({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    const isReverseMode = useMemo(() => smartEditTarget?.status === ReconciliationStatus.PENDING, [smartEditTarget]);

    useEffect(() => {
        if (smartEditTarget) {
            setSearchQuery('');
            const nameToEdit = smartEditTarget.contributor?.cleanedName || smartEditTarget.transaction.cleanedDescription || '';
            const amountToEdit = String(smartEditTarget.contributor?.amount || smartEditTarget.transaction.amount);
            
            setManualName(nameToEdit);
            setManualAmount(amountToEdit);
            
            if (isReverseMode && smartEditTarget.church) {
                setManualChurchId(smartEditTarget.church.id);
            } else if (smartEditTarget.church && smartEditTarget.church.id !== 'unidentified' && smartEditTarget.church.id !== 'placeholder') {
                setManualChurchId(smartEditTarget.church.id);
            } else if (churches.length === 1) {
                setManualChurchId(churches[0].id);
            } else {
                setManualChurchId('');
            }

            setIsManualMode(false);
            setPosition(null);
        }
    }, [smartEditTarget, isReverseMode, churches]);

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
        const handleMouseUp = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

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
        return matchResults.filter(r => r.status === ReconciliationStatus.UNIDENTIFIED);
    }, [matchResults]);

    useEffect(() => {
        if (smartEditTarget && !isReverseMode && allContributors.length > 0) {
            handleAnalyze(smartEditTarget.transaction, allContributors);
        }
    }, [smartEditTarget, isReverseMode, allContributors, handleAnalyze]);

    useEffect(() => {
        if (!smartEditTarget) return;
        let items: SuggestionItem[] = [];

        if (isReverseMode) {
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
                    id: tx.id, primaryText: tx.cleanedDescription || tx.description,
                    secondaryText: `Extrato • ${formatDate(tx.date)}`,
                    amount: tx.amount, date: tx.date, originalRef: res, score, type: 'transaction'
                };
            });
        } else {
            // FLUXO NORMAL: Sugerir contribuinte para transação do banco
            const tx = smartEditTarget.transaction;
            const txAmount = Math.abs(tx.amount);
            const txDate = parseDate(tx.date);
            items = allContributors.map(c => {
                let score = 0;
                // Match de valor é o mais forte
                if (Math.abs(c.amount - txAmount) < 0.05) score += 50;
                // Similaridade de nome
                const sim = calculateNameSimilarity(tx.description, c, effectiveIgnoreKeywords);
                score += sim * 0.4; 
                // Proximidade de data
                if (txDate && c.date) {
                    const cDate = parseDate(c.date);
                    if (cDate) {
                        const diffDays = Math.abs(txDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24);
                        if (diffDays <= 2) score += 20;
                        else if (diffDays <= 5) score += 10;
                    }
                }
                return {
                    id: c.id || `contributor-${Math.random()}`, primaryText: c.cleanedName || c.name,
                    secondaryText: `${c._churchName} • ${c.date ? formatDate(c.date) : 'S/D'}`,
                    amount: c.amount, date: c.date, originalRef: c, score, type: 'contributor'
                };
            });
        }

        // Filtra e ordena as sugestões
        let finalSuggestions = items.filter(i => i.score > 15).sort((a, b) => b.score - a.score).slice(0, 5);

        // Se o algoritmo já tinha uma sugestão guardada no matchResult, coloca no topo
        if (smartEditTarget.suggestion) {
            const s = smartEditTarget.suggestion;
            const alreadyInListIdx = finalSuggestions.findIndex(i => i.id === s.id);
            
            const church = churches.find(c => c.id === (s as any).church?.id || (s as any)._churchId);
            const sugItem: SuggestionItem = {
                id: s.id || `sug-${Math.random()}`, primaryText: s.cleanedName || s.name,
                secondaryText: `${church?.name || (s as any)._churchName || 'Igreja'} (Algoritmo)`,
                amount: s.amount, date: s.date, originalRef: s, score: 100, type: 'contributor', isAiSuggestion: true
            };

            if (alreadyInListIdx !== -1) {
                finalSuggestions[alreadyInListIdx] = sugItem;
            } else {
                finalSuggestions = [sugItem, ...finalSuggestions];
            }
        }

        if (aiSuggestion && smartEditTarget.transaction.id === aiSuggestion.id) {
            const suggestedItem = items.find(i => normalizeString(i.primaryText) === normalizeString(aiSuggestion.name));
            if (suggestedItem) {
                finalSuggestions = [{ ...suggestedItem, isAiSuggestion: true, secondaryText: 'Sugestão Inteligente IA' }, ...finalSuggestions.filter(i => i.id !== suggestedItem.id)];
            }
        }
        setSuggestions(finalSuggestions.slice(0, 5));
    }, [smartEditTarget, isReverseMode, allContributors, availableBankTransactions, effectiveIgnoreKeywords, aiSuggestion, churches]);

    const filteredList = useMemo(() => {
        if (!searchQuery) return [];
        const lowerQ = searchQuery.toLowerCase().trim();
        const pool: SuggestionItem[] = isReverseMode ? availableBankTransactions.map(res => ({
            id: res.transaction.id, primaryText: res.transaction.cleanedDescription || res.transaction.description,
            secondaryText: `Extrato • ${formatDate(res.transaction.date)}`, amount: res.transaction.amount, date: res.transaction.date, originalRef: res, score: 0, type: 'transaction'
        })) : allContributors.map(c => ({
            id: c.id || `c-${Math.random()}`, primaryText: c.cleanedName || c.name,
            secondaryText: `${c._churchName} • ${c.date ? formatDate(c.date) : 'S/D'}`, amount: c.amount, date: c.date, originalRef: c, score: 0, type: 'contributor'
        }));
        return pool.filter(item => item.primaryText.toLowerCase().includes(lowerQ) || String(Math.abs(item.amount)).includes(lowerQ)).slice(0, 20);
    }, [searchQuery, isReverseMode, allContributors, availableBankTransactions]);

    if (!smartEditTarget) return null;

    const handleSelect = (item: SuggestionItem) => {
        if (isReverseMode) {
            const targetMatchResult = item.originalRef as MatchResult;
            saveSmartEdit({ ...targetMatchResult, contributor: smartEditTarget.contributor, church: smartEditTarget.church, status: ReconciliationStatus.IDENTIFIED, matchMethod: MatchMethod.MANUAL, similarity: 100, contributorAmount: smartEditTarget.contributor?.amount, divergence: undefined });
        } else {
            const selectedContributor = item.originalRef;
            saveSmartEdit({ ...smartEditTarget, contributor: selectedContributor, church: churches.find(c => c.id === selectedContributor._churchId) || smartEditTarget.church, status: ReconciliationStatus.IDENTIFIED, matchMethod: item.isAiSuggestion ? MatchMethod.AI : MatchMethod.MANUAL, similarity: 100, contributorAmount: selectedContributor.amount, divergence: undefined });
        }
    };

    const handleSaveManual = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(manualAmount);
        if (!manualName.trim() || isNaN(amount)) return;
        saveSmartEdit({ ...smartEditTarget, contributor: { id: `man-${Date.now()}`, name: manualName, cleanedName: manualName, normalizedName: normalizeString(manualName), amount, date: smartEditTarget.contributor?.date || smartEditTarget.transaction.date }, church: churches.find(c => c.id === manualChurchId) || smartEditTarget.church, status: ReconciliationStatus.IDENTIFIED, matchMethod: MatchMethod.MANUAL, similarity: 100, contributorAmount: amount, divergence: undefined });
    };

    const ListItem: React.FC<{ item: SuggestionItem, isSuggestion?: boolean }> = ({ item, isSuggestion = false }) => (
        <button onClick={() => handleSelect(item)} className={`w-full text-left p-2 rounded-lg border transition-all duration-200 group flex items-center justify-between mb-1.5 ${item.isAiSuggestion ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 border-purple-200 dark:border-purple-700 shadow-sm ring-1 ring-purple-100' : isSuggestion ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-50'}`}>
            <div className="flex items-center gap-2 overflow-hidden">
                <div className={`p-1.5 rounded-full flex-shrink-0 ${item.isAiSuggestion ? 'bg-purple-100 text-purple-600' : isSuggestion ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>{item.isAiSuggestion ? <SparklesIcon className="w-3 h-3 animate-pulse" /> : (item.type === 'contributor' ? <UserIcon className="w-3 h-3" /> : <BanknotesIcon className="w-3 h-3" />)}</div>
                <div className="min-w-0"><p className={`text-[11px] font-bold truncate leading-tight ${item.isAiSuggestion ? 'text-purple-800 dark:text-purple-200' : isSuggestion ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>{item.primaryText}</p><p className={`text-[9px] truncate ${item.isAiSuggestion ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}>{item.secondaryText}</p></div>
            </div>
            <div className="text-right flex-shrink-0 ml-1"><span className={`text-[10px] font-bold font-mono ${item.isAiSuggestion ? 'text-purple-700 dark:text-purple-300' : isSuggestion ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(item.amount, language)}</span></div>
        </button>
    );

    return (
        <div className="glass-overlay animate-fade-in">
            <div ref={modalRef} style={{ position: position ? 'fixed' : 'relative', left: position ? position.x : 'auto', top: position ? position.y : 'auto', margin: 0, zIndex: 100, transform: position ? 'none' : undefined }} className="glass-modal w-[320px] flex flex-col max-h-[500px] animate-scale-in rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95">
                <div onMouseDown={handleMouseDown} className={`px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-move select-none group transition-colors ${isReverseMode ? 'bg-amber-50/50 dark:bg-amber-900/20' : 'bg-slate-50/50 dark:bg-slate-800/50'}`}>
                    <h3 className="text-xs font-black text-slate-700 dark:text-white tracking-tight flex items-center gap-2 uppercase"><ArrowsRightLeftIcon className="w-3 h-3 text-slate-400 group-hover:text-brand-blue rotate-45 transition-colors" />{isReverseMode ? 'Vincular Extrato' : 'Identificar'}</h3>
                    <button onClick={closeSmartEdit} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors" onMouseDown={(e) => e.stopPropagation()}><XMarkIcon className="w-4 h-4" /></button>
                </div>
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700 shrink-0">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0"><p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{isReverseMode ? 'Item Pendente (Lista)' : 'Transação (Banco)'}</p><p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight" title={isReverseMode ? smartEditTarget.contributor?.name : smartEditTarget.transaction.description}>{isReverseMode ? smartEditTarget.contributor?.name : smartEditTarget.transaction.description}</p><p className="text-[9px] text-slate-500 font-mono mt-0.5">{formatDate(isReverseMode ? smartEditTarget.contributor?.date : smartEditTarget.transaction.date)}</p></div>
                        <p className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tight whitespace-nowrap">{formatCurrency(isReverseMode ? (smartEditTarget.contributor?.amount || 0) : smartEditTarget.transaction.amount, language)}</p>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-white dark:bg-slate-900">
                    <div className="relative"><SearchIcon className="w-3 h-3 text-slate-400 absolute top-1/2 left-2.5 -translate-y-1/2" /><input type="text" autoFocus placeholder={isReverseMode ? "Buscar no extrato..." : "Buscar nome, valor..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium shadow-sm focus:ring-1 focus:ring-brand-blue outline-none transition-all placeholder:text-slate-400" /></div>
                    
                    {!searchQuery && !isManualMode && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <SearchIcon className="w-2.5 h-2.5 text-indigo-500" /> Sugestões
                                </h4>
                                {loadingAiId && <span className="flex items-center gap-1 text-[8px] text-purple-500 animate-pulse font-bold bg-purple-50 px-1.5 py-0.5 rounded-full"><SparklesIcon className="w-2 h-2" /> IA Pensando...</span>}
                            </div>
                            
                            {suggestions.length > 0 ? (
                                suggestions.map((item, idx) => <ListItem key={`sug-${idx}`} item={item} isSuggestion />)
                            ) : (
                                !loadingAiId && <div className="text-center py-4 text-slate-400 text-[10px] italic">Buscando as melhores opções...</div>
                            )}
                        </div>
                    )}

                    {searchQuery && (
                        <div><h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Resultados</h4>{filteredList.length > 0 ? (filteredList.map((item, idx) => <ListItem key={`res-${idx}`} item={item} />)) : (<div className="text-center py-4 text-slate-400 text-[10px] italic">Nada encontrado.</div>)}</div>
                    )}
                    
                    {(isManualMode) ? (
                        <div className="animate-fade-in">
                            <div className="flex items-center justify-between mb-2"><h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Edição Manual</h4>{isManualMode && <button onClick={() => setIsManualMode(false)} className="text-[9px] text-brand-blue hover:underline">Voltar</button>}</div>
                            <form onSubmit={handleSaveManual} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                                {!isReverseMode && (<div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Igreja</label><select value={manualChurchId} onChange={(e) => setManualChurchId(e.target.value)} className="w-full p-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold focus:ring-1 focus:ring-brand-blue outline-none"><option value="" disabled>Selecione a igreja</option>{churches.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>)}
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Nome / Descrição</label><input type="text" value={manualName} onChange={e => setManualName(e.target.value)} className="w-full p-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold focus:ring-1 focus:ring-brand-blue outline-none"/></div>
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Valor</label><input type="number" step="0.01" value={manualAmount} onChange={e => setManualAmount(e.target.value)} className="w-full p-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold focus:ring-1 focus:ring-brand-blue outline-none"/></div>
                                <button type="submit" disabled={!isReverseMode && !manualChurchId} className="w-full py-1.5 bg-brand-blue text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-blue-600 transition-colors shadow-sm flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"><FloppyDiskIcon className="w-3 h-3" /> Salvar</button>
                            </form>
                        </div>
                    ) : (
                        <button onClick={() => setIsManualMode(true)} className="w-full py-2 text-[10px] font-bold text-slate-500 hover:text-brand-blue border border-dashed border-slate-300 hover:border-brand-blue rounded-lg transition-all">Editar manualmente</button>
                    )}
                </div>
            </div>
        </div>
    );
};
