import React, { useState, useEffect, useMemo, useRef, useContext, useCallback } from 'react';
import { AppContext } from '../../../contexts/AppContext';
import { useTranslation } from '../../../contexts/I18nContext';
import { calculateNameSimilarity, normalizeString, parseDate } from '../../../services/processingService';
import { Contributor, MatchResult, ReconciliationStatus, MatchMethod } from '../../../types';

export interface SuggestionItem {
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

export const useSmartEditController = () => {
    const { 
        smartEditTarget, closeSmartEdit, saveSmartEdit, contributorFiles, churches,
        matchResults, effectiveIgnoreKeywords, contributionKeywords, paymentMethods,
        aiSuggestion, loadingAiId
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
    const isAiProposed = useMemo(() => !!smartEditTarget?.suggestion || !!aiSuggestion, [smartEditTarget, aiSuggestion]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeSmartEdit();
            if (e.key === 'Enter' && !isManualMode && suggestions.length > 0 && !searchQuery) {
                const topSug = suggestions[0];
                if (topSug.churchId === manualChurchId) handleSelect(topSug);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeSmartEdit, isManualMode, suggestions, searchQuery, manualChurchId]);

    // Data initialization
    useEffect(() => {
        if (smartEditTarget) {
            setSearchQuery('');
            const nameToEdit = smartEditTarget.contributor?.cleanedName || smartEditTarget.contributor?.name || smartEditTarget.transaction.cleanedDescription || '';
            const amountToEdit = String(smartEditTarget.contributor?.amount || smartEditTarget.transaction.amount);
            const sug = smartEditTarget.suggestion as any;
            
            setManualName(nameToEdit);
            setManualAmount(amountToEdit);
            setManualType(sug?.contributionType || smartEditTarget.contributor?.contributionType || smartEditTarget.transaction.contributionType || '');
            setManualPaymentMethod(sug?.paymentMethod || smartEditTarget.contributor?.paymentMethod || smartEditTarget.transaction.paymentMethod || '');
            
            const churchIdToEdit = sug?._churchId || sug?.church?.id || smartEditTarget.church?.id;
            if (isReverseMode && smartEditTarget.church) setManualChurchId(smartEditTarget.church.id);
            else if (churchIdToEdit && churchIdToEdit !== 'unidentified' && churchIdToEdit !== 'placeholder') setManualChurchId(churchIdToEdit);
            else setManualChurchId(churches.length === 1 ? churches[0].id : '');

            setIsManualMode(false);
            setPosition(null);
        }
    }, [smartEditTarget, isReverseMode, churches]);

    // Fix: Added React to imports and typed event as React.MouseEvent
    const handleMouseDown = (e: React.MouseEvent) => {
        if (modalRef.current) {
            setIsDragging(true);
            const rect = modalRef.current.getBoundingClientRect();
            dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
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

    const handleSelect = (item: SuggestionItem) => {
        if (isReverseMode) {
            const targetMatchResult = item.originalRef as MatchResult;
            saveSmartEdit({ ...targetMatchResult, contributor: smartEditTarget.contributor, church: smartEditTarget.church, status: ReconciliationStatus.IDENTIFIED, matchMethod: MatchMethod.MANUAL, similarity: 100, contributorAmount: smartEditTarget.contributor?.amount, divergence: undefined, contributionType: manualType || smartEditTarget.contributor?.contributionType, paymentMethod: manualPaymentMethod || smartEditTarget.contributor?.paymentMethod });
        } else {
            const selectedContributor = item.originalRef;
            saveSmartEdit({ ...smartEditTarget, contributor: selectedContributor, church: churches.find((c: any) => c.id === selectedContributor._churchId) || smartEditTarget.church, status: ReconciliationStatus.IDENTIFIED, matchMethod: item.isAiSuggestion ? MatchMethod.AI : MatchMethod.MANUAL, similarity: 100, contributorAmount: selectedContributor.amount, divergence: undefined, contributionType: manualType || selectedContributor.contributionType, paymentMethod: manualPaymentMethod || selectedContributor.paymentMethod });
        }
    };

    const handleSaveManual = () => {
        const amount = parseFloat(manualAmount);
        if (!manualName.trim() || isNaN(amount)) return;
        saveSmartEdit({ 
            ...smartEditTarget, 
            contributor: { id: `man-${Date.now()}`, name: manualName, cleanedName: manualName, normalizedName: normalizeString(manualName), amount, date: smartEditTarget.contributor?.date || smartEditTarget.transaction.date, contributionType: manualType, paymentMethod: manualPaymentMethod }, 
            church: churches.find((c: any) => c.id === manualChurchId) || smartEditTarget.church, 
            status: ReconciliationStatus.IDENTIFIED, matchMethod: MatchMethod.MANUAL, similarity: 100, contributorAmount: amount, divergence: undefined, contributionType: manualType, paymentMethod: manualPaymentMethod 
        });
    };

    return {
        smartEditTarget, closeSmartEdit, suggestions, setSuggestions, searchQuery, setSearchQuery,
        manualName, setManualName, manualAmount, setManualAmount, manualChurchId, setManualChurchId,
        manualType, setManualType, manualPaymentMethod, setManualPaymentMethod,
        handleSelect, handleSaveManual, position, handleMouseDown, modalRef, language,
        isReverseMode, isAiProposed, churches, loadingAiId, contributionKeywords, paymentMethods,
        effectiveIgnoreKeywords, matchResults, contributorFiles
    };
};