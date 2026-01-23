
import React, { useMemo, useEffect } from 'react';
import { SearchIcon, XMarkIcon, SparklesIcon } from '../../Icons';
import { SmartEditListItem } from './SmartEditListItem';
import { SuggestionItem } from './useSmartEditController';
import { calculateNameSimilarity } from '../../../services/processingService';

interface SmartEditSuggestionsProps {
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    suggestions: SuggestionItem[];
    setSuggestions: (v: SuggestionItem[]) => void;
    loadingAiId: string | null;
    isReverseMode: boolean;
    manualChurchId: string;
    onSelect: (item: SuggestionItem) => void;
    target: any;
    allContributors: any[];
    availableBankTransactions: any[];
    effectiveIgnoreKeywords: string[];
    churches: any[];
    language: any;
}

export const SmartEditSuggestions: React.FC<SmartEditSuggestionsProps> = ({
    searchQuery, setSearchQuery, suggestions, setSuggestions, loadingAiId,
    isReverseMode, manualChurchId, onSelect, target, allContributors,
    availableBankTransactions, effectiveIgnoreKeywords, churches, language
}) => {
    useEffect(() => {
        if (!target) return;
        let items: SuggestionItem[] = [];

        if (isReverseMode) {
            const targetContributor = target.contributor;
            if (!targetContributor) return;
            items = availableBankTransactions.map(res => {
                const tx = res.transaction;
                const score = calculateNameSimilarity(tx.description, targetContributor, effectiveIgnoreKeywords);
                return {
                    id: tx.id, primaryText: tx.cleanedDescription || tx.description,
                    secondaryText: `Extrato • ${tx.date}`, amount: tx.amount, originalRef: res, score, type: 'transaction'
                };
            });
        } else {
            const tx = target.transaction;
            items = allContributors.map(c => {
                let score = calculateNameSimilarity(tx.description, c, effectiveIgnoreKeywords);
                if (manualChurchId && c._churchId === manualChurchId) score += 50; 
                else if (manualChurchId && c._churchId !== manualChurchId) score -= 80;
                return {
                    id: c.id || `c-${Math.random()}`, primaryText: c.cleanedName || c.name,
                    secondaryText: `${c._churchName} • ${c.date || 'S/D'}`,
                    amount: c.amount, originalRef: c, score, type: 'contributor', churchId: c._churchId
                };
            });
        }

        if (searchQuery.trim()) {
            const lq = searchQuery.toLowerCase();
            items = items.filter(i => i.primaryText.toLowerCase().includes(lq) || String(i.amount).includes(lq));
        }

        let final = items.filter(i => i.score > 20 || searchQuery.trim()).sort((a, b) => b.score - a.score).slice(0, 15);
        
        if (target.suggestion && !searchQuery.trim()) {
            const s = target.suggestion as any;
            const sChurchId = s.church?.id || s._churchId;
            if (!manualChurchId || sChurchId === manualChurchId) {
                const church = churches.find(c => c.id === sChurchId);
                const sugItem: SuggestionItem = {
                    id: s.id || `sug-${Math.random()}`, primaryText: s.cleanedName || s.name,
                    secondaryText: `${church?.name || s._churchName || 'Igreja'} (Match IA)`,
                    amount: s.amount, originalRef: s, score: 200, type: 'contributor', isAiSuggestion: true, churchId: sChurchId
                };
                final = [sugItem, ...final.filter(i => i.id !== s.id)].slice(0, 5);
            }
        }
        setSuggestions(final);
    }, [target, isReverseMode, allContributors, availableBankTransactions, effectiveIgnoreKeywords, manualChurchId, churches, searchQuery, setSuggestions]);

    return (
        <div className="space-y-4">
            <div className="relative">
                <SearchIcon className="w-3 h-3 text-slate-400 absolute top-1/2 left-2.5 -translate-y-1/2" />
                <input type="text" placeholder={isReverseMode ? "Buscar no extrato..." : "Trocar contribuinte..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium shadow-sm focus:ring-1 focus:ring-brand-blue outline-none transition-all placeholder:text-slate-400" />
            </div>
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><SearchIcon className="w-2.5 h-2.5 text-indigo-500" /> {searchQuery ? 'Resultados' : 'Melhores Matches'}</h4>
                    {loadingAiId && <span className="flex items-center gap-1 text-[8px] text-purple-500 animate-pulse font-bold bg-purple-50 px-1.5 py-0.5 rounded-full"><SparklesIcon className="w-2 h-2" /> Analisando...</span>}
                </div>
                {suggestions.length > 0 ? suggestions.map((item, idx) => (
                    <SmartEditListItem key={item.id} item={item} isSuggestion={!searchQuery} index={idx} language={language} onSelect={onSelect} manualChurchId={manualChurchId} />
                )) : !loadingAiId && <div className="text-center py-4 text-slate-400 text-[10px] italic">Nada encontrado.</div>}
            </div>
        </div>
    );
};
