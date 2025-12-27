
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, SearchIcon, CheckCircleIcon, UserIcon, FloppyDiskIcon, ArrowsRightLeftIcon, BanknotesIcon } from '../Icons';
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
}

export const SmartEditModal: React.FC = () => {
    const { 
        smartEditTarget, 
        closeSmartEdit, 
        saveSmartEdit, 
        contributorFiles, 
        churches,
        matchResults, // Needed for Reverse Search (Bank Transactions)
        effectiveIgnoreKeywords 
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    
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
    // Otherwise, we are looking for a Contributor to match this Bank Transaction.
    const isReverseMode = useMemo(() => smartEditTarget?.status === 'PENDENTE', [smartEditTarget]);

    useEffect(() => {
        if (smartEditTarget) {
            setSearchQuery('');
            const nameToEdit = smartEditTarget.contributor?.cleanedName || smartEditTarget.transaction.cleanedDescription || '';
            const amountToEdit = String(smartEditTarget.contributor?.amount || smartEditTarget.transaction.amount);
            
            setManualName(nameToEdit);
            setManualAmount(amountToEdit);
            setIsManualMode(false);
            // Reset position on open so it centers automatically initially
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

    // 1. Contributors Source (Standard Mode)
    const allContributors = useMemo(() => {
        return contributorFiles.flatMap(file => {
            const church = churches.find(c => c.id === file.churchId);
            return file.contributors.map(c => ({
                ...c,
                _churchName: church?.name || 'Desconhecida',
                _churchId: church?.id
            }));
        });
    }, [contributorFiles, churches]);

    // 2. Bank Transactions Source (Reverse Mode) - Only Unidentified ones
    const availableBankTransactions = useMemo(() => {
        return matchResults.filter(r => r.status === 'NÃO IDENTIFICADO');
    }, [matchResults]);

    // --- SCORING & SUGGESTIONS LOGIC ---
    useEffect(() => {
        if (!smartEditTarget) return;

        let items: SuggestionItem[] = [];

        if (isReverseMode) {
            // REVERSE: We have a Contributor (in smartEditTarget), looking for a Transaction
            const targetContributor = smartEditTarget.contributor;
            if (!targetContributor) return;

            const targetAmount = targetContributor.amount;
            const targetDate = parseDate(targetContributor.date);
            const targetName = targetContributor.name; // Name to match against description

            items = availableBankTransactions.map(res => {
                const tx = res.transaction;
                let score = 0;

                // 1. Exact Amount Match
                if (Math.abs(tx.amount - targetAmount) < 0.05) score += 50;

                // 2. Name Similarity (Tx Description vs Contributor Name)
                // Note: normalizedString logic inside calculateNameSimilarity handles this direction too
                const sim = calculateNameSimilarity(tx.description, targetContributor, effectiveIgnoreKeywords);
                score += sim * 0.4;

                // 3. Date Proximity
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
                    originalRef: res, // The MatchResult containing the transaction
                    score,
                    type: 'transaction'
                };
            });

        } else {
            // STANDARD: We have a Transaction, looking for a Contributor
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
                    originalRef: c, // The Contributor object
                    score,
                    type: 'contributor'
                };
            });
        }

        // Filter and Sort
        const topMatches = items
            .filter(i => i.score > 20) 
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        setSuggestions(topMatches);

    }, [smartEditTarget, isReverseMode, allContributors, availableBankTransactions, effectiveIgnoreKeywords]);

    // --- SEARCH FILTERING ---
    const filteredList = useMemo(() => {
        if (!searchQuery) return [];
        
        const lowerQ = searchQuery.toLowerCase().trim();
        const dateQuery = lowerQ.replace(/[-.]/g, '/'); 
        
        let pool: SuggestionItem[] = [];

        if (isReverseMode) {
            // Filter Bank Transactions
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
            // Filter Contributors
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
            // 1. Text Match
            if (item.primaryText.toLowerCase().includes(lowerQ)) return true;
            
            // 2. Amount Match
            const amountStr = Math.abs(item.amount).toFixed(2);
            const amountStrComma = amountStr.replace('.', ',');
            const rawAmountStr = String(Math.abs(item.amount));
            if (amountStr.includes(lowerQ) || amountStrComma.includes(lowerQ) || rawAmountStr.includes(lowerQ)) return true;

            // 3. Date Match
            if (item.date) {
                if (item.date.includes(lowerQ)) return true; // ISO
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
            // REVERSE: We selected a Bank Transaction (from matchResults)
            // We want to assign the CURRENT PENDING CONTRIBUTOR to this transaction.
            const targetMatchResult = item.originalRef as MatchResult;
            const pendingContributor = smartEditTarget.contributor;
            const church = smartEditTarget.church; // The church associated with the pending item

            // We update the REAL transaction row
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
            // STANDARD: We selected a Contributor
            // We want to assign this CONTRIBUTOR to the CURRENT TRANSACTION.
            const selectedContributor = item.originalRef;
            const church = churches.find(c => c.id === selectedContributor._churchId);
            
            const updated: MatchResult = {
                ...smartEditTarget,
                contributor: selectedContributor,
                church: church || smartEditTarget.church,
                status: 'IDENTIFICADO',
                matchMethod: 'MANUAL',
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

        // If reverse mode, we can't really "Manually Create" a bank transaction easily here.
        // So manual mode basically edits the Ghost Row properties or overrides the contributor on a real row.
        // We assume standard behavior: Update the current target with manual info.
        
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
                ${isSuggestion 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 hover:border-indigo-300' 
                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }
            `}
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <div className={`p-1.5 rounded-full flex-shrink-0 ${isSuggestion ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-800 dark:text-indigo-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {item.type === 'contributor' ? <UserIcon className="w-3 h-3" /> : <BanknotesIcon className="w-3 h-3" />}
                </div>
                <div className="min-w-0">
                    <p className={`text-[11px] font-bold truncate leading-tight ${isSuggestion ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>
                        {item.primaryText}
                    </p>
                    <p className="text-[9px] text-slate-500 truncate">
                        {item.secondaryText}
                    </p>
                </div>
            </div>
            <div className="text-right flex-shrink-0 ml-1">
                <span className={`text-[10px] font-bold font-mono ${isSuggestion ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`}>
                    {formatCurrency(item.amount, language)}
                </span>
            </div>
        </button>
    );

    return (
        <div className="glass-overlay animate-fade-in" style={{ display: 'block', backgroundColor: 'transparent' }}> {/* Transparente para parecer flutuante */}
            <div 
                ref={modalRef}
                style={{
                    position: 'fixed',
                    left: position ? position.x : '50%',
                    top: position ? position.y : '50%',
                    transform: position ? 'none' : 'translate(-50%, -50%)',
                    margin: 0,
                    zIndex: 100
                }}
                className="glass-modal w-[320px] flex flex-col max-h-[500px] animate-scale-in rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 bg-white/95 dark:bg-slate-900/95"
            >
                
                {/* Header Compacto (Drag Handle) */}
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

                {/* Transaction Context Compacto */}
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

                {/* Main Content Compacto */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-white dark:bg-slate-900">
                    
                    {/* Search Bar Compacta */}
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

                    {/* Suggestions List */}
                    {!searchQuery && suggestions.length > 0 && !isManualMode && (
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <SearchIcon className="w-2.5 h-2.5 text-indigo-500" /> Sugestões
                            </h4>
                            {suggestions.map((item, idx) => <ListItem key={`sug-${idx}`} item={item} isSuggestion />)}
                        </div>
                    )}

                    {/* Search Results */}
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

                    {/* Manual Mode Toggle (Only for Standard Mode usually, but available for edits) */}
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
