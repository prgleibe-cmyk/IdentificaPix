
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { XMarkIcon, SearchIcon, UserIcon, ArrowsRightLeftIcon, BanknotesIcon, SparklesIcon, FloppyDiskIcon, TagIcon, ChevronDownIcon, CheckCircleIcon, BuildingOfficeIcon, CreditCardIcon } from '../Icons';
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
    contributionType?: string;
    paymentMethod?: string;
    churchId?: string;
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
        contributionKeywords,
        paymentMethods,
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
    const [manualType, setManualType] = useState('');
    const [manualPaymentMethod, setManualPaymentMethod] = useState('');
    const [isManualMode, setIsManualMode] = useState(false);

    const [position, setPosition] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{x: number, y: number}>({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    const isReverseMode = useMemo(() => smartEditTarget?.status === ReconciliationStatus.PENDING, [smartEditTarget]);

    // Verifica se a configuração atual veio de uma sugestão da IA
    const isAiProposed = useMemo(() => !!smartEditTarget?.suggestion || !!aiSuggestion, [smartEditTarget, aiSuggestion]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeSmartEdit();
            if (e.key === 'Enter' && !isManualMode && suggestions.length > 0 && !searchQuery) {
                const topSug = suggestions[0];
                if (topSug.churchId === manualChurchId) {
                    handleSelect(topSug);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeSmartEdit, isManualMode, suggestions, searchQuery, manualChurchId]);

    useEffect(() => {
        if (smartEditTarget) {
            setSearchQuery('');
            const nameToEdit = smartEditTarget.contributor?.cleanedName || smartEditTarget.contributor?.name || smartEditTarget.transaction.cleanedDescription || '';
            const amountToEdit = String(smartEditTarget.contributor?.amount || smartEditTarget.transaction.amount);
            
            const sug = smartEditTarget.suggestion as any;
            const typeToEdit = sug?.contributionType || smartEditTarget.contributor?.contributionType || smartEditTarget.transaction.contributionType || '';
            const formToEdit = sug?.paymentMethod || smartEditTarget.contributor?.paymentMethod || smartEditTarget.transaction.paymentMethod || '';
            const churchIdToEdit = sug?._churchId || sug?.church?.id || smartEditTarget.church?.id;

            setManualName(nameToEdit);
            setManualAmount(amountToEdit);
            setManualType(typeToEdit);
            setManualPaymentMethod(formToEdit);
            
            if (isReverseMode && smartEditTarget.church) {
                setManualChurchId(smartEditTarget.church.id);
            } else if (churchIdToEdit && churchIdToEdit !== 'unidentified' && churchIdToEdit !== 'placeholder') {
                setManualChurchId(churchIdToEdit);
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
            dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
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
        if (!smartEditTarget) return;
        let items: SuggestionItem[] = [];

        if (isReverseMode) {
            const targetContributor = smartEditTarget.contributor;
            if (!targetContributor) return;
            items = availableBankTransactions.map(res => {
                const tx = res.transaction;
                const score = calculateNameSimilarity(tx.description, targetContributor, effectiveIgnoreKeywords);
                return {
                    id: tx.id, primaryText: tx.cleanedDescription || tx.description,
                    secondaryText: `Extrato • ${formatDate(tx.date)}`,
                    amount: tx.amount, date: tx.date, originalRef: res, score, type: 'transaction'
                };
            });
        } else {
            const tx = smartEditTarget.transaction;
            items = allContributors.map(c => {
                let score = calculateNameSimilarity(tx.description, c, effectiveIgnoreKeywords);
                if (manualChurchId && c._churchId === manualChurchId) score += 50; 
                else if (manualChurchId && c._churchId !== manualChurchId) score -= 80;

                return {
                    id: c.id || `contributor-${Math.random()}`, primaryText: c.cleanedName || c.name,
                    secondaryText: `${c._churchName} • ${c.date ? formatDate(c.date) : 'S/D'}`,
                    amount: c.amount, date: c.date, originalRef: c, score, type: 'contributor', contributionType: c.contributionType,
                    paymentMethod: c.paymentMethod,
                    churchId: c._churchId
                };
            });
        }

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            items = items.filter(i => 
                i.primaryText.toLowerCase().includes(lowerQuery) || 
                String(i.amount).includes(lowerQuery)
            );
        }

        let finalSuggestions = items
            .filter(i => i.score > 20 || searchQuery.trim())
            .sort((a, b) => b.score - a.score)
            .slice(0, 15);

        if (smartEditTarget.suggestion && !searchQuery.trim()) {
            const s = smartEditTarget.suggestion as any;
            const sChurchId = s.church?.id || s._churchId;
            
            if (!manualChurchId || sChurchId === manualChurchId) {
                const church = churches.find(c => c.id === sChurchId);
                const sugItem: SuggestionItem = {
                    id: s.id || `sug-${Math.random()}`, primaryText: s.cleanedName || s.name,
                    secondaryText: `${church?.name || s._churchName || 'Igreja'} (Match IA)`,
                    amount: s.amount, date: s.date, originalRef: s, score: 200, type: 'contributor', 
                    contributionType: s.contributionType, paymentMethod: s.paymentMethod, isAiSuggestion: true, churchId: sChurchId
                };
                finalSuggestions = [sugItem, ...finalSuggestions.filter(i => i.id !== s.id)].slice(0, 5);
            }
        }

        setSuggestions(finalSuggestions);
    }, [smartEditTarget, isReverseMode, allContributors, availableBankTransactions, effectiveIgnoreKeywords, manualChurchId, churches, searchQuery]);

    if (!smartEditTarget) return null;

    const handleSelect = (item: SuggestionItem) => {
        if (isReverseMode) {
            const targetMatchResult = item.originalRef as MatchResult;
            saveSmartEdit({ ...targetMatchResult, contributor: smartEditTarget.contributor, church: smartEditTarget.church, status: ReconciliationStatus.IDENTIFIED, matchMethod: MatchMethod.MANUAL, similarity: 100, contributorAmount: smartEditTarget.contributor?.amount, divergence: undefined, contributionType: manualType || smartEditTarget.contributor?.contributionType, paymentMethod: manualPaymentMethod || smartEditTarget.contributor?.paymentMethod });
        } else {
            const selectedContributor = item.originalRef;
            saveSmartEdit({ ...smartEditTarget, contributor: selectedContributor, church: churches.find(c => c.id === selectedContributor._churchId) || smartEditTarget.church, status: ReconciliationStatus.IDENTIFIED, matchMethod: item.isAiSuggestion ? MatchMethod.AI : MatchMethod.MANUAL, similarity: 100, contributorAmount: selectedContributor.amount, divergence: undefined, contributionType: manualType || selectedContributor.contributionType, paymentMethod: manualPaymentMethod || selectedContributor.paymentMethod });
        }
    };

    const handleSaveManual = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(manualAmount);
        if (!manualName.trim() || isNaN(amount)) return;
        saveSmartEdit({ 
            ...smartEditTarget, 
            contributor: { 
                id: `man-${Date.now()}`, 
                name: manualName, 
                cleanedName: manualName, 
                normalizedName: normalizeString(manualName), 
                amount, 
                date: smartEditTarget.contributor?.date || smartEditTarget.transaction.date,
                contributionType: manualType,
                paymentMethod: manualPaymentMethod
            }, 
            church: churches.find(c => c.id === manualChurchId) || smartEditTarget.church, 
            status: ReconciliationStatus.IDENTIFIED, 
            matchMethod: MatchMethod.MANUAL, 
            similarity: 100, 
            contributorAmount: amount, 
            divergence: undefined,
            contributionType: manualType,
            paymentMethod: manualPaymentMethod 
        });
    };

    const ListItem: React.FC<{ item: SuggestionItem, isSuggestion?: boolean, index?: number }> = ({ item, isSuggestion = false, index = 0 }) => (
        <button onClick={() => handleSelect(item)} className={`w-full text-left p-2 rounded-lg border transition-all duration-200 group flex items-center justify-between mb-1.5 ${item.isAiSuggestion ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 border-purple-200 dark:border-purple-700 shadow-sm ring-1 ring-purple-100' : isSuggestion ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-50'}`}>
            <div className="flex items-center gap-2 overflow-hidden">
                <div className={`p-1.5 rounded-full flex-shrink-0 ${item.isAiSuggestion ? 'bg-purple-100 text-purple-600' : isSuggestion ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>{item.isAiSuggestion ? <SparklesIcon className="w-3 h-3 animate-pulse" /> : (item.type === 'contributor' ? <UserIcon className="w-3 h-3" /> : <BanknotesIcon className="w-3 h-3" />)}</div>
                <div className="min-w-0">
                    <p className={`text-[11px] font-bold truncate leading-tight ${item.isAiSuggestion ? 'text-purple-800 dark:text-purple-200' : isSuggestion ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>{item.primaryText}</p>
                    <p className={`text-[9px] truncate ${item.isAiSuggestion ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}>{item.secondaryText}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-1">
                {isSuggestion && index === 0 && !searchQuery && item.churchId === manualChurchId && (
                    <span className="text-[7px] font-black bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 uppercase">Enter</span>
                )}
                <span className={`text-[10px] font-bold font-mono ${item.isAiSuggestion ? 'text-purple-700 dark:text-purple-300' : isSuggestion ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(item.amount, language)}</span>
            </div>
        </button>
    );

    return (
        <div className="glass-overlay animate-fade-in">
            <div ref={modalRef} style={{ position: position ? 'fixed' : 'relative', left: position ? position.x : 'auto', top: position ? position.y : 'auto', margin: 0, zIndex: 100, transform: position ? 'none' : undefined }} className="glass-modal w-[320px] flex flex-col max-h-[550px] animate-scale-in rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95">
                <div onMouseDown={handleMouseDown} className={`px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-move select-none group transition-colors ${isReverseMode ? 'bg-amber-50/50 dark:bg-amber-900/20' : 'bg-slate-50/50 dark:bg-slate-800/50'}`}>
                    <h3 className="text-xs font-black text-slate-700 dark:text-white tracking-tight flex items-center gap-2 uppercase"><ArrowsRightLeftIcon className="w-3 h-3 text-slate-400 group-hover:text-brand-blue rotate-45 transition-colors" />{isReverseMode ? 'Vincular Extrato' : 'Identificar'}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[7px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-700 px-1 rounded">Esc</span>
                        <button onClick={closeSmartEdit} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors" onMouseDown={(e) => e.stopPropagation()}><XMarkIcon className="w-4 h-4" /></button>
                    </div>
                </div>
                
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700 shrink-0">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0"><p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{isReverseMode ? 'Item Pendente' : 'Transação (Banco)'}</p><p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight" title={isReverseMode ? smartEditTarget.contributor?.name : smartEditTarget.transaction.description}>{isReverseMode ? smartEditTarget.contributor?.name : smartEditTarget.transaction.description}</p><p className="text-[9px] text-slate-500 font-mono mt-0.5">{formatDate(isReverseMode ? smartEditTarget.contributor?.date : smartEditTarget.transaction.date)}</p></div>
                        <p className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tight whitespace-nowrap">{formatCurrency(isReverseMode ? (smartEditTarget.contributor?.amount || 0) : smartEditTarget.transaction.amount, language)}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 bg-white dark:bg-slate-900">
                    
                    <div className={`p-3 rounded-xl border transition-all duration-500 ${isAiProposed ? 'bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-slate-50/50 border-slate-100 dark:border-slate-800'}`}>
                        {!isReverseMode && (
                            <div className="mb-2">
                                <label className={`block text-[8px] font-bold uppercase tracking-widest mb-1 ml-1 flex items-center gap-1 ${isAiProposed ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                                    {isAiProposed && <SparklesIcon className="w-2.5 h-2.5" />} Destinar para Igreja
                                </label>
                                <div className="relative group">
                                    <BuildingOfficeIcon className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${isAiProposed ? 'text-purple-500' : 'text-slate-400'}`} />
                                    <select 
                                        value={manualChurchId} 
                                        onChange={(e) => setManualChurchId(e.target.value)}
                                        className={`w-full bg-white dark:bg-slate-950 border rounded-lg py-1.5 pl-9 pr-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-blue outline-none transition-all appearance-none ${isAiProposed ? 'border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100' : 'border-slate-200 dark:border-slate-800'}`}
                                    >
                                        <option value="" disabled>Selecione a igreja</option>
                                        {churches.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <ChevronDownIcon className={`w-3 h-3 ${isAiProposed ? 'text-purple-400' : 'text-slate-400'}`} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={`block text-[8px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 ${isAiProposed ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-500'}`}>
                                    <TagIcon className="w-2.5 h-2.5" /> Tipo de Contribuição
                                </label>
                                <div className="relative">
                                    <select 
                                        value={manualType} 
                                        onChange={(e) => setManualType(e.target.value)}
                                        className={`w-full bg-white dark:bg-slate-950 border rounded-lg py-1.5 px-3 text-[10px] font-bold focus:ring-2 focus:ring-brand-blue outline-none transition-all appearance-none ${isAiProposed ? 'border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100' : 'border-indigo-200 dark:border-indigo-800 text-slate-700 dark:text-slate-200'}`}
                                    >
                                        <option value="">Sem categoria</option>
                                        {contributionKeywords.map((k: string) => (
                                            <option key={k} value={k}>{k}</option>
                                        ))}
                                        <option value="OUTROS">OUTROS</option>
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <ChevronDownIcon className={`w-2.5 h-2.5 ${isAiProposed ? 'text-purple-400' : 'text-indigo-400'}`} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className={`block text-[8px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 ${isAiProposed ? 'text-purple-600 dark:text-purple-400' : 'text-blue-500'}`}>
                                    <CreditCardIcon className="w-2.5 h-2.5" /> Forma de Pagamento
                                </label>
                                <div className="relative">
                                    <select 
                                        value={manualPaymentMethod} 
                                        onChange={(e) => setManualPaymentMethod(e.target.value)}
                                        className={`w-full bg-white dark:bg-slate-950 border rounded-lg py-1.5 px-3 text-[10px] font-bold focus:ring-2 focus:ring-brand-blue outline-none transition-all appearance-none ${isAiProposed ? 'border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100' : 'border-blue-200 dark:border-blue-800 text-slate-700 dark:text-slate-200'}`}
                                    >
                                        <option value="">Sem forma</option>
                                        {paymentMethods.map((m: string) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                        <option value="OUTROS">OUTROS</option>
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <ChevronDownIcon className={`w-2.5 h-2.5 ${isAiProposed ? 'text-purple-400' : 'text-blue-400'}`} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveManual}
                            disabled={!manualChurchId}
                            className={`w-full mt-3 py-2 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 ${isAiProposed ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/20' : 'bg-brand-blue hover:bg-blue-600'}`}
                        >
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            Confirmar Identidade
                        </button>
                    </div>

                    <div className="relative"><SearchIcon className="w-3 h-3 text-slate-400 absolute top-1/2 left-2.5 -translate-y-1/2" /><input type="text" autoFocus={!smartEditTarget.suggestion} placeholder={isReverseMode ? "Buscar no extrato..." : "Trocar contribuinte..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium shadow-sm focus:ring-1 focus:ring-brand-blue outline-none transition-all placeholder:text-slate-400" /></div>
                    
                    {!searchQuery && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <SearchIcon className="w-2.5 h-2.5 text-indigo-500" /> Melhores Matches
                                </h4>
                                {loadingAiId && <span className="flex items-center gap-1 text-[8px] text-purple-500 animate-pulse font-bold bg-purple-50 px-1.5 py-0.5 rounded-full"><SparklesIcon className="w-2 h-2" /> Analisando...</span>}
                            </div>
                            
                            {suggestions.length > 0 ? (
                                suggestions.map((item, idx) => <ListItem key={`sug-${idx}`} item={item} isSuggestion index={idx} />)
                            ) : (
                                !loadingAiId && <div className="text-center py-4 text-slate-400 text-[10px] italic">Nenhuma opção óbvia nesta igreja.</div>
                            )}
                        </div>
                    )}

                    {searchQuery && (
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Resultados da busca</h4>
                            {suggestions.length > 0 ? (
                                suggestions.map((item, idx) => <ListItem key={`res-${idx}`} item={item} />)
                            ) : (
                                <div className="text-center py-4 text-slate-400 text-[10px] italic">Nada encontrado.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
