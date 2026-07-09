import { useMemo, useRef } from 'react';
import { MatchResult } from '../types';
import { useAuth } from '../contexts/AuthContext';

const passesFilters = (r: any, dateRange: any, isSecondary: boolean, subscription: any, selectedBankId: string | null | undefined) => {
    if (dateRange && (dateRange.start || dateRange.end)) {
        const start = dateRange.start ? new Date(dateRange.start).getTime() : null;
        const end = dateRange.end ? new Date(dateRange.end).getTime() + 86400000 : null;
        const dateStr = r.status === 'PENDENTE' ? (r.contributor?.date || r.transaction?.date) : r.transaction?.date;
        if (dateStr) {
            const itemDate = new Date(dateStr.split('T')[0]).getTime();
            if (start && itemDate < start) return false;
            if (end && itemDate >= end) return false;
        }
    }

    if (isSecondary) {
        if (subscription.congregationIds && subscription.congregationIds.length > 0) {
            const churchId = r.church?.id || r._churchId || 'unidentified';
            if (churchId !== 'unidentified' && !subscription.congregationIds.includes(churchId)) {
                return false;
            }
        }
        if (subscription.bankIds && subscription.bankIds.length > 0) {
            if (!subscription.bankIds.includes(String(r.transaction?.bank_id))) {
                return false;
            }
        }
    }

    if (selectedBankId && selectedBankId !== 'all') {
        if (String(r.transaction?.bank_id) !== selectedBankId) {
            return false;
        }
    }

    return true;
};

const areFiltersIdentical = (f1: any, f2: any) => {
    if (!f1 || !f2) return false;
    if (f1.selectedBankId !== f2.selectedBankId) return false;
    if (f1.hasActiveSession !== f2.hasActiveSession) return false;
    if (f1.isHistorical !== f2.isHistorical) return false;
    if (f1.userId !== f2.userId) return false;
    
    if (f1.dateRange?.start !== f2.dateRange?.start) return false;
    if (f1.dateRange?.end !== f2.dateRange?.end) return false;
    
    if (f1.subscription?.ownerId !== f2.subscription?.ownerId) return false;
    if (f1.subscription?.role !== f2.subscription?.role) return false;
    
    const c1 = f1.subscription?.congregationIds || [];
    const c2 = f2.subscription?.congregationIds || [];
    if (c1.length !== c2.length) return false;
    for (let i = 0; i < c1.length; i++) {
        if (c1[i] !== c2[i]) return false;
    }
    
    const b1 = f1.subscription?.bankIds || [];
    const b2 = f2.subscription?.bankIds || [];
    if (b1.length !== b2.length) return false;
    for (let i = 0; i < b1.length; i++) {
        if (String(b1[i]) !== String(b2[i])) return false;
    }
    
    return true;
};

const fullRebuild = (
    matchResults: any[],
    dateRange: any,
    isSecondary: boolean,
    subscription: any,
    selectedBankId: string | null | undefined,
    hasSession: boolean,
    isHistorical: boolean
) => {
    const resultsMap = new Map<string, any>();
    const filteredMap = new Map<string, any>();
    const churchMap = new Map<string, number>();
    
    let identifiedCount = 0;
    let unidentifiedCount = 0;
    let totalValue = 0;
    const methodBreakdown: Record<string, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
    let autoVal = 0, manualVal = 0, pendingVal = 0;

    matchResults.forEach((r: any) => {
        const id = r.transaction?.id || r.id || r._injectedId;
        if (!id) return;
        resultsMap.set(id, r);

        const passed = passesFilters(r, dateRange, isSecondary, subscription, selectedBankId);
        if (passed) {
            filteredMap.set(id, r);
        }
    });

    if (hasSession && filteredMap.size > 0) {
        filteredMap.forEach((r: any) => {
            if (r.status === 'IDENTIFICADO') {
                identifiedCount++;
                const val = r.transaction?.amount || 0;
                totalValue += val;
                if (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI') {
                    manualVal += val;
                } else {
                    autoVal += val;
                }
                
                const method = r.matchMethod || 'AUTOMATIC';
                methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;

                const churchName = r.church?.name || 'Desconhecida';
                churchMap.set(churchName, (churchMap.get(churchName) || 0) + val);
            } else {
                if (r.status === 'NÃO IDENTIFICADO' || r.status === 'PENDENTE') {
                    unidentifiedCount++;
                }
                pendingVal += (r.contributorAmount || r.transaction?.amount || 0);
            }
        });
    }

    const valuePerChurch = Array.from(churchMap.entries())
        .sort((a, b) => b[1] - a[1]);

    const output = {
        identifiedCount,
        unidentifiedCount,
        totalValue,
        autoConfirmed: { value: autoVal },
        manualConfirmed: { value: manualVal },
        pending: { value: pendingVal },
        valuePerChurch,
        methodBreakdown,
        isHistorical
    };

    return {
        resultsMap,
        filteredMap,
        churchMap,
        output
    };
};

export const useSummaryData = (reconciliation: any, reportManager: any, selectedBankId?: string | null) => {
    const { subscription, user } = useAuth();

    const cacheRef = useRef<{
        prevMatchResults: any[] | null;
        prevFilters: any | null;
        resultsMap: Map<string, any>;
        filteredMap: Map<string, any>;
        churchMap: Map<string, number>;
        output: any;
    }>({
        prevMatchResults: null,
        prevFilters: null,
        resultsMap: new Map(),
        filteredMap: new Map(),
        churchMap: new Map(),
        output: null
    });

    return useMemo(() => {
        const matchResults = reconciliation.matchResults || [];
        const hasSession = reconciliation.hasActiveSession;
        const isHistorical = !hasSession && reportManager.savedReports.length > 0;

        const currentFilters = {
            dateRange: reportManager.searchFilters?.dateRange,
            selectedBankId,
            hasActiveSession: hasSession,
            isHistorical,
            userId: user?.id,
            subscription
        };

        const dateRange = currentFilters.dateRange;
        const isSecondary = (subscription.ownerId && subscription.ownerId !== user?.id) &&
            subscription.role !== 'owner' &&
            subscription.role !== 'admin' &&
            subscription.role !== 'principal';

        const prevMatchResults = cacheRef.current.prevMatchResults;
        const prevFilters = cacheRef.current.prevFilters;
        
        let needsFullRebuild = false;
        
        if (!prevMatchResults || !prevFilters || !areFiltersIdentical(prevFilters, currentFilters)) {
            needsFullRebuild = true;
        }
        
        if (!needsFullRebuild) {
            const resultsMap = cacheRef.current.resultsMap;
            const filteredMap = cacheRef.current.filteredMap;
            const churchMap = cacheRef.current.churchMap;
            const cachedOutput = cacheRef.current.output;
            
            const changedOrAdded: any[] = [];
            const seenIds = new Set<string>();
            
            for (let i = 0; i < matchResults.length; i++) {
                const r = matchResults[i];
                const id = r.transaction?.id || r.id || r._injectedId;
                if (!id) continue;
                seenIds.add(id);
                
                const prevR = resultsMap.get(id);
                if (!prevR || prevR !== r) {
                    changedOrAdded.push(r);
                }
            }
            
            const deletedIds: string[] = [];
            for (const id of resultsMap.keys()) {
                if (!seenIds.has(id)) {
                    deletedIds.push(id);
                }
            }
            
            const totalChanges = changedOrAdded.length + deletedIds.length;
            
            if (totalChanges > 20) {
                needsFullRebuild = true;
            } else if (totalChanges > 0) {
                let identifiedCount = cachedOutput.identifiedCount;
                let unidentifiedCount = cachedOutput.unidentifiedCount;
                let totalValue = cachedOutput.totalValue;
                let autoVal = cachedOutput.autoConfirmed.value;
                let manualVal = cachedOutput.manualConfirmed.value;
                let pendingVal = cachedOutput.pending.value;
                const methodBreakdown = { ...cachedOutput.methodBreakdown };
                
                // 1. Process deletions
                for (const id of deletedIds) {
                    const prevR = resultsMap.get(id);
                    resultsMap.delete(id);
                    
                    if (filteredMap.has(id)) {
                        filteredMap.delete(id);
                        
                        if (hasSession) {
                            if (prevR.status === 'IDENTIFICADO') {
                                identifiedCount = Math.max(0, identifiedCount - 1);
                                const val = prevR.transaction?.amount || 0;
                                totalValue = Math.max(0, totalValue - val);
                                
                                if (prevR.matchMethod === 'MANUAL' || prevR.matchMethod === 'AI') {
                                    manualVal = Math.max(0, manualVal - val);
                                } else {
                                    autoVal = Math.max(0, autoVal - val);
                                }
                                
                                const method = prevR.matchMethod || 'AUTOMATIC';
                                if (methodBreakdown[method] !== undefined) {
                                    methodBreakdown[method] = Math.max(0, methodBreakdown[method] - 1);
                                }
                                
                                const churchName = prevR.church?.name || 'Desconhecida';
                                const oldChurchTotal = churchMap.get(churchName) || 0;
                                const newChurchTotal = oldChurchTotal - val;
                                if (newChurchTotal <= 0) {
                                    churchMap.delete(churchName);
                                } else {
                                    churchMap.set(churchName, newChurchTotal);
                                }
                            } else {
                                if (prevR.status === 'NÃO IDENTIFICADO' || prevR.status === 'PENDENTE') {
                                    unidentifiedCount = Math.max(0, unidentifiedCount - 1);
                                }
                                const val = prevR.contributorAmount || prevR.transaction?.amount || 0;
                                pendingVal = Math.max(0, pendingVal - val);
                            }
                        }
                    }
                }
                
                // 2. Process changes/additions
                for (const r of changedOrAdded) {
                    const id = r.transaction?.id || r.id || r._injectedId;
                    const prevR = resultsMap.get(id);
                    
                    if (prevR && filteredMap.has(id)) {
                        if (hasSession) {
                            if (prevR.status === 'IDENTIFICADO') {
                                identifiedCount = Math.max(0, identifiedCount - 1);
                                const val = prevR.transaction?.amount || 0;
                                totalValue = Math.max(0, totalValue - val);
                                
                                if (prevR.matchMethod === 'MANUAL' || prevR.matchMethod === 'AI') {
                                    manualVal = Math.max(0, manualVal - val);
                                } else {
                                    autoVal = Math.max(0, autoVal - val);
                                }
                                
                                const method = prevR.matchMethod || 'AUTOMATIC';
                                if (methodBreakdown[method] !== undefined) {
                                    methodBreakdown[method] = Math.max(0, methodBreakdown[method] - 1);
                                }
                                
                                const churchName = prevR.church?.name || 'Desconhecida';
                                const oldChurchTotal = churchMap.get(churchName) || 0;
                                const newChurchTotal = oldChurchTotal - val;
                                if (newChurchTotal <= 0) {
                                    churchMap.delete(churchName);
                                } else {
                                    churchMap.set(churchName, newChurchTotal);
                                }
                            } else {
                                if (prevR.status === 'NÃO IDENTIFICADO' || prevR.status === 'PENDENTE') {
                                    unidentifiedCount = Math.max(0, unidentifiedCount - 1);
                                }
                                const val = prevR.contributorAmount || prevR.transaction?.amount || 0;
                                pendingVal = Math.max(0, pendingVal - val);
                            }
                        }
                        filteredMap.delete(id);
                    }
                    
                    resultsMap.set(id, r);
                    
                    const passed = passesFilters(r, dateRange, isSecondary, subscription, selectedBankId);
                    if (passed) {
                        filteredMap.set(id, r);
                        
                        if (hasSession) {
                            if (r.status === 'IDENTIFICADO') {
                                identifiedCount++;
                                const val = r.transaction?.amount || 0;
                                totalValue += val;
                                
                                if (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI') {
                                    manualVal += val;
                                } else {
                                    autoVal += val;
                                }
                                
                                const method = r.matchMethod || 'AUTOMATIC';
                                methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
                                
                                const churchName = r.church?.name || 'Desconhecida';
                                churchMap.set(churchName, (churchMap.get(churchName) || 0) + val);
                            } else {
                                if (r.status === 'NÃO IDENTIFICADO' || r.status === 'PENDENTE') {
                                    unidentifiedCount++;
                                }
                                const val = r.contributorAmount || r.transaction?.amount || 0;
                                pendingVal += val;
                            }
                        }
                    }
                }
                
                const valuePerChurch = Array.from(churchMap.entries())
                    .sort((a, b) => b[1] - a[1]);
                
                cacheRef.current.output = {
                    identifiedCount,
                    unidentifiedCount,
                    totalValue,
                    autoConfirmed: { value: autoVal },
                    manualConfirmed: { value: manualVal },
                    pending: { value: pendingVal },
                    valuePerChurch,
                    methodBreakdown,
                    isHistorical
                };
            }
        }

        if (needsFullRebuild) {
            const rebuilt = fullRebuild(
                matchResults,
                dateRange,
                isSecondary,
                subscription,
                selectedBankId,
                hasSession,
                isHistorical
            );
            cacheRef.current.resultsMap = rebuilt.resultsMap;
            cacheRef.current.filteredMap = rebuilt.filteredMap;
            cacheRef.current.churchMap = rebuilt.churchMap;
            cacheRef.current.output = rebuilt.output;
        }

        cacheRef.current.prevMatchResults = matchResults;
        cacheRef.current.prevFilters = currentFilters;
        
        return cacheRef.current.output;
    }, [
        reconciliation.matchResults,
        reconciliation.hasActiveSession,
        reportManager.savedReports,
        reportManager.searchFilters,
        selectedBankId,
        subscription,
        user?.id
    ]);
};
