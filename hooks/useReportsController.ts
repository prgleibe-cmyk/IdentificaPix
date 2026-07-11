import { useState, useMemo, useEffect, useContext, useCallback, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { MatchResult, ReconciliationStatus } from '../types';
import { ExportService } from '../services/ExportService';
import { consolidationService } from '../services/ConsolidationService';
import { filterByUniversalQuery, applyAdvancedFilters } from '../services/processingService';
import { batchState, lastRealtimeUpdate } from './reconciliation/useCloudSync';

export type ReportCategory = 'general' | 'churches' | 'unidentified' | 'expenses';

export const useReportsController = () => {
    const { 
        reportPreviewData, 
        activeReportId, 
        saveCurrentReportChanges, 
        openSaveReportModal, 
        matchResults,
        updateReportData,
        runAiAutoIdentification,
        searchFilters,
        setSearchFilters,
        selectedBankId,
        setSelectedBankId,
        bankList,
        hydrate,
        regenerateReportPreview,
        churches
    } = useContext(AppContext);
    
    const { language } = useTranslation();
    const { setActiveView } = useUI();
    const { subscription, user } = useAuth();
    
    const isSecondary = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
        subscription?.role !== 'owner' &&
        subscription?.role !== 'admin' &&
        subscription?.role !== 'principal';
    
    const [activeCategory, setActiveCategory] = useState<ReportCategory>('general');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const syncHashRef = useRef<string>('');
    const isProcessingRef = useRef(false);
    const debounceRef = useRef<any>(null);
    const lastSyncTimeRef = useRef<number>(0);

    // Refs de Cache para Otimização de Delta
    const cacheRef = useRef<{
        prevMatchResults: MatchResult[] | null;
        prevChurches: any[] | null;
        prevSubscription: any | null;
        prevSelectedBankId: string | null;
        prevActiveCategory: string | null;
        prevSelectedReportId: string | null;
        prevSearchFilters: any | null;
        prevSearchTerm: string | null;

        resultsMap: Map<string, MatchResult>;
        churchList: { id: string; name: string; count: number; total: number }[];
        counts: { general: number; churches: number; pending: number; expenses: number };
        activeData: MatchResult[];
        stableKey: string;
    }>({
        prevMatchResults: null,
        prevChurches: null,
        prevSubscription: null,
        prevSelectedBankId: null,
        prevActiveCategory: null,
        prevSelectedReportId: null,
        prevSearchFilters: null,
        prevSearchTerm: null,

        resultsMap: new Map(),
        churchList: [],
        counts: { general: 0, churches: 0, pending: 0, expenses: 0 },
        activeData: [],
        stableKey: ''
    });

    const isPendingTx = useCallback((r: MatchResult) => {
        return r.status === ReconciliationStatus.UNIDENTIFIED || r.status === ReconciliationStatus.PENDING;
    }, []);

    const isExpenseTx = useCallback((r: MatchResult) => {
        const amount = r.status === 'PENDENTE' ? r.contributorAmount : r.transaction?.amount;
        const displayAmount = amount !== undefined ? amount : (r.transaction?.amount || 0);
        return displayAmount < 0 || 
               r.transaction?.type?.toLowerCase() === 'expense' || 
               r.transaction?.type?.toLowerCase() === 'saida' || 
               r.contributionType?.toLowerCase() === 'saída' || 
               r.contributionType?.toLowerCase() === 'saida';
    }, []);

    // ⚡ Executa a sincronização incremental ou o rebuild completo do cache
    const currentResults = matchResults || [];
    const prevResults = cacheRef.current.prevMatchResults;
    const prevChurchesList = cacheRef.current.prevChurches;
    const prevSub = cacheRef.current.prevSubscription;
    const prevBankId = cacheRef.current.prevSelectedBankId;
    const prevCat = cacheRef.current.prevActiveCategory;
    const prevRepId = cacheRef.current.prevSelectedReportId;
    const prevFiltersObj = cacheRef.current.prevSearchFilters;
    const prevTerm = cacheRef.current.prevSearchTerm;

    const filtersChanged = 
        prevChurchesList !== churches ||
        prevSub !== subscription ||
        prevBankId !== selectedBankId ||
        prevCat !== activeCategory ||
        prevRepId !== selectedReportId ||
        JSON.stringify(prevFiltersObj) !== JSON.stringify(searchFilters) ||
        prevTerm !== searchTerm;

    const needsFullRebuild = 
        !prevResults || 
        filtersChanged || 
        Math.abs(currentResults.length - prevResults.length) > 1 ||
        !lastRealtimeUpdate.txId;

    if (needsFullRebuild) {
        // 1. Rebuild resultsMap
        const resultsMap = new Map<string, MatchResult>();
        currentResults.forEach(r => resultsMap.set(r.transaction.id, r));
        cacheRef.current.resultsMap = resultsMap;

        // 2. Rebuild churchList
        const allowedIds = isSecondary ? (subscription?.congregationIds || []) : null;
        const churchesMap = new Map<string, any>();
        (churches || []).forEach((c: any) => {
            if (c.id) churchesMap.set(c.id, c);
        });

        const churchMap = new Map<string, { id: string, name: string, count: number, total: number }>();
        currentResults.forEach(r => {
            const hasValidChurch = (r.church?.id && r.church.id !== 'unidentified') || 
                                 (r._churchId && r._churchId !== 'unidentified');
            if (hasValidChurch) {
                const churchId = (r.church?.id && r.church.id !== 'unidentified') ? r.church?.id : r._churchId!;
                if (allowedIds && !allowedIds.includes(churchId)) return;
                
                // Guarantee alignment with dashboard: only count identified transactions
                if (r.status !== 'IDENTIFICADO') return;
                
                const realChurch = churchesMap.get(churchId);
                if (!realChurch) return;
                
                const existing = churchMap.get(churchId);
                if (existing) {
                    existing.count++;
                    existing.total += (r.transaction?.amount || 0);
                } else {
                    churchMap.set(churchId, {
                        id: churchId,
                        name: realChurch.name,
                        count: 1,
                        total: r.transaction?.amount || 0
                    });
                }
            }
        });
        const churchListComputed = Array.from(churchMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        cacheRef.current.churchList = churchListComputed;

        // 3. Rebuild counts
        let generalCount = currentResults.length;
        let churchesCount = churchListComputed.length;
        let pendingCount = 0;
        let expensesCount = 0;

        const countSource = isSecondary && subscription.congregationIds && subscription.congregationIds.length > 0
            ? currentResults.filter(r => {
                const churchId = r.church?.id || r._churchId || 'unidentified';
                return churchId === 'unidentified' || subscription.congregationIds.includes(churchId);
              })
            : currentResults;

        countSource.forEach(r => {
            if (isPendingTx(r)) pendingCount++;
            if (isExpenseTx(r)) expensesCount++;
        });

        cacheRef.current.counts = {
            general: isSecondary ? countSource.length : generalCount,
            churches: isSecondary ? (subscription.congregationIds || []).length : churchesCount,
            pending: pendingCount,
            expenses: expensesCount
        };

        // 4. Rebuild activeData
        let filteredData: MatchResult[] = [];
        if (activeCategory === 'general') {
            filteredData = currentResults;
        } else if (activeCategory === 'unidentified') {
            filteredData = currentResults.filter(isPendingTx);
        } else if (activeCategory === 'expenses') {
            filteredData = currentResults.filter(isExpenseTx);
        } else {
            if (isSecondary && subscription.congregationIds && subscription.congregationIds.length > 0) {
                const activeId = selectedReportId && subscription.congregationIds.includes(selectedReportId)
                    ? selectedReportId
                    : subscription.congregationIds[0];
                filteredData = reportPreviewData?.income?.[activeId] || [];
            } else if (selectedReportId) {
                filteredData = reportPreviewData?.income?.[selectedReportId] || [];
            }

            if (filteredData.length > 0) {
                filteredData = filteredData.map((r: MatchResult) => {
                    const live = resultsMap.get(r.transaction.id);
                    if (live) {
                        return {
                            ...r,
                            status: live.status,
                            isConfirmed: live.isConfirmed,
                            contributor: live.contributor,
                            church: live.church,
                            _churchId: live._churchId,
                            updatedAt: live.updatedAt,
                            splits: live.splits,
                            contributionType: live.contributionType
                        };
                    }
                    return r;
                });

                if (selectedReportId) {
                    filteredData = filteredData.filter((r: MatchResult) => {
                        const liveChurchId = r.church?.id || r._churchId;
                        return liveChurchId === selectedReportId;
                    });
                }
            }
        }

        // Apply filters
        if (selectedBankId && selectedBankId !== 'all') {
            filteredData = filteredData.filter(r => String(r.transaction?.bank_id) === selectedBankId);
        } else if (isSecondary && subscription?.bankIds && subscription.bankIds.length > 0) {
            filteredData = filteredData.filter(r => subscription.bankIds.includes(String(r.transaction?.bank_id)));
        }

        if (searchFilters.dateRange && (searchFilters.dateRange.start || searchFilters.dateRange.end)) {
            const start = searchFilters.dateRange.start ? new Date(searchFilters.dateRange.start).getTime() : null;
            const end = searchFilters.dateRange.end ? new Date(searchFilters.dateRange.end).getTime() + 86400000 : null;
            
            filteredData = filteredData.filter(r => {
                const dateStr = r.status === 'PENDENTE' ? (r.contributor?.date || r.transaction?.date) : r.transaction?.date;
                if (!dateStr) return true;
                const itemDate = new Date(dateStr.split('T')[0]).getTime();
                if (start && itemDate < start) return false;
                if (end && itemDate >= end) return false;
                return true;
            });
        }

        if (searchFilters) {
            filteredData = applyAdvancedFilters(filteredData, searchFilters);
        }

        if (searchTerm && searchTerm.trim()) {
            filteredData = filteredData.filter(r => filterByUniversalQuery(r, searchTerm));
        }

        cacheRef.current.activeData = filteredData;

        // 5. Stable Key
        const currentTotal = currentResults.length;
        const currentIdentified = currentResults.filter(r => r.status === ReconciliationStatus.IDENTIFIED || r.status === ReconciliationStatus.RESOLVED).length;
        const currentConfirmed = currentResults.filter(r => !!r.isConfirmed).length;
        const currentWithChurch = currentResults.filter(r => r.church?.id && r.church.id !== 'unidentified').length;
        cacheRef.current.stableKey = `${currentTotal}-${currentIdentified}-${currentConfirmed}-${currentWithChurch}`;

        // Save current inputs to cache
        cacheRef.current.prevMatchResults = currentResults;
        cacheRef.current.prevChurches = churches;
        cacheRef.current.prevSubscription = subscription;
        cacheRef.current.prevSelectedBankId = selectedBankId;
        cacheRef.current.prevActiveCategory = activeCategory;
        cacheRef.current.prevSelectedReportId = selectedReportId;
        cacheRef.current.prevSearchFilters = searchFilters;
        cacheRef.current.prevSearchTerm = searchTerm;
    } else {
        const txId = lastRealtimeUpdate.txId!;
        const oldItem = cacheRef.current.resultsMap.get(txId);
        const newItem = currentResults.find(r => r.transaction.id === txId);

        if (newItem) {
            // 1. Update resultsMap
            cacheRef.current.resultsMap.set(txId, newItem);

            // 2. Update churchList incrementally
            const allowedIds = isSecondary ? (subscription?.congregationIds || []) : null;
            const churchesMap = new Map<string, any>();
            (churches || []).forEach((c: any) => {
                if (c.id) churchesMap.set(c.id, c);
            });

            const adjustChurch = (item: MatchResult, factor: 1 | -1) => {
                const hasValidChurch = (item.church?.id && item.church.id !== 'unidentified') || 
                                     (item._churchId && item._churchId !== 'unidentified');
                if (hasValidChurch) {
                    const churchId = (item.church?.id && item.church.id !== 'unidentified') ? item.church?.id : item._churchId!;
                    if (allowedIds && !allowedIds.includes(churchId)) return;
                    
                    const realChurch = churchesMap.get(churchId);
                    if (!realChurch) return;

                    // Guarantee alignment with dashboard: only count identified transactions
                    if (item.status !== 'IDENTIFICADO') return;

                    const idx = cacheRef.current.churchList.findIndex(c => c.id === churchId);
                    if (idx !== -1) {
                        const existing = cacheRef.current.churchList[idx];
                        const newCount = existing.count + factor;
                        const newTotal = existing.total + factor * (item.transaction?.amount || 0);
                        if (newCount <= 0) {
                            cacheRef.current.churchList = cacheRef.current.churchList.filter(c => c.id !== churchId);
                        } else {
                            const updatedList = [...cacheRef.current.churchList];
                            updatedList[idx] = {
                                ...existing,
                                count: newCount,
                                total: newTotal
                            };
                            cacheRef.current.churchList = updatedList;
                        }
                    } else if (factor === 1) {
                        cacheRef.current.churchList = [
                            ...cacheRef.current.churchList,
                            {
                                id: churchId,
                                name: realChurch.name,
                                count: 1,
                                total: item.transaction?.amount || 0
                            }
                        ].sort((a, b) => a.name.localeCompare(b.name));
                    }
                }
            };

            if (oldItem) {
                adjustChurch(oldItem, -1);
            }
            adjustChurch(newItem, 1);

            // 3. Update counts incrementally
            let countsDelta = { pending: 0, expenses: 0 };
            
            const matchesCountFilters = (item: MatchResult) => {
                if (!isSecondary) return true;
                const churchId = item.church?.id || item._churchId || 'unidentified';
                return churchId === 'unidentified' || (subscription.congregationIds || []).includes(churchId);
            };

            if (oldItem && matchesCountFilters(oldItem)) {
                if (isPendingTx(oldItem)) countsDelta.pending--;
                if (isExpenseTx(oldItem)) countsDelta.expenses--;
            }
            if (matchesCountFilters(newItem)) {
                if (isPendingTx(newItem)) countsDelta.pending++;
                if (isExpenseTx(newItem)) countsDelta.expenses++;
            }

            cacheRef.current.counts = {
                ...cacheRef.current.counts,
                pending: cacheRef.current.counts.pending + countsDelta.pending,
                expenses: cacheRef.current.counts.expenses + countsDelta.expenses,
                churches: isSecondary ? (subscription.congregationIds || []).length : cacheRef.current.churchList.length
            };

            // 4. Update activeData incrementally
            const matchesFilters = (item: MatchResult) => {
                let matchesCat = false;
                if (activeCategory === 'general') {
                    matchesCat = true;
                } else if (activeCategory === 'unidentified') {
                    matchesCat = isPendingTx(item);
                } else if (activeCategory === 'expenses') {
                    matchesCat = isExpenseTx(item);
                } else {
                    const churchId = item.church?.id || item._churchId;
                    matchesCat = churchId === selectedReportId;
                }

                if (!matchesCat) return false;

                if (selectedBankId && selectedBankId !== 'all') {
                    if (String(item.transaction?.bank_id) !== selectedBankId) return false;
                } else if (isSecondary && subscription?.bankIds && subscription.bankIds.length > 0) {
                    if (!subscription.bankIds.includes(String(item.transaction?.bank_id))) return false;
                }

                if (searchFilters.dateRange && (searchFilters.dateRange.start || searchFilters.dateRange.end)) {
                    const start = searchFilters.dateRange.start ? new Date(searchFilters.dateRange.start).getTime() : null;
                    const end = searchFilters.dateRange.end ? new Date(searchFilters.dateRange.end).getTime() + 86400000 : null;
                    const dateStr = item.status === 'PENDENTE' ? (item.contributor?.date || item.transaction?.date) : item.transaction?.date;
                    if (dateStr) {
                        const itemDate = new Date(dateStr.split('T')[0]).getTime();
                        if (start && itemDate < start) return false;
                        if (end && itemDate >= end) return false;
                    }
                }

                if (searchFilters) {
                    const res = applyAdvancedFilters([item], searchFilters);
                    if (res.length === 0) return false;
                }

                if (searchTerm && searchTerm.trim()) {
                    if (!filterByUniversalQuery(item, searchTerm)) return false;
                }

                return true;
            };

            const oldMatched = oldItem ? matchesFilters(oldItem) : false;
            const newMatched = matchesFilters(newItem);

            const idxInActive = cacheRef.current.activeData.findIndex(r => r.transaction.id === txId);

            if (oldMatched && newMatched) {
                if (idxInActive !== -1) {
                    const updatedActive = [...cacheRef.current.activeData];
                    updatedActive[idxInActive] = newItem;
                    cacheRef.current.activeData = updatedActive;
                } else {
                    cacheRef.current.activeData = [...cacheRef.current.activeData, newItem];
                }
            } else if (oldMatched && !newMatched) {
                if (idxInActive !== -1) {
                    cacheRef.current.activeData = cacheRef.current.activeData.filter(r => r.transaction.id !== txId);
                }
            } else if (!oldMatched && newMatched) {
                cacheRef.current.activeData = [...cacheRef.current.activeData, newItem];
            }

            // 5. Update stableKey incrementally
            let stableKeyDelta = { identified: 0, confirmed: 0, withChurch: 0 };
            const getStableKeyMetrics = (item: MatchResult) => {
                const identified = item.status === ReconciliationStatus.IDENTIFIED || item.status === ReconciliationStatus.RESOLVED;
                const confirmed = !!item.isConfirmed;
                const withChurch = !!(item.church?.id && item.church.id !== 'unidentified');
                return { identified, confirmed, withChurch };
            };

            if (oldItem) {
                const oldMetrics = getStableKeyMetrics(oldItem);
                if (oldMetrics.identified) stableKeyDelta.identified--;
                if (oldMetrics.confirmed) stableKeyDelta.confirmed--;
                if (oldMetrics.withChurch) stableKeyDelta.withChurch--;
            }
            const newMetrics = getStableKeyMetrics(newItem);
            if (newMetrics.identified) stableKeyDelta.identified++;
            if (newMetrics.confirmed) stableKeyDelta.confirmed++;
            if (newMetrics.withChurch) stableKeyDelta.withChurch++;

            const prevStableKeyParts = cacheRef.current.stableKey.split('-');
            if (prevStableKeyParts.length === 4) {
                const newTotal = parseInt(prevStableKeyParts[0]) + (oldItem ? 0 : 1);
                const newIdentified = parseInt(prevStableKeyParts[1]) + stableKeyDelta.identified;
                const newConfirmed = parseInt(prevStableKeyParts[2]) + stableKeyDelta.confirmed;
                const newWithChurch = parseInt(prevStableKeyParts[3]) + stableKeyDelta.withChurch;
                cacheRef.current.stableKey = `${newTotal}-${newIdentified}-${newConfirmed}-${newWithChurch}`;
            }
        }

        cacheRef.current.prevMatchResults = currentResults;
    }

    const stableKey = cacheRef.current.stableKey;
    const churchList = cacheRef.current.churchList;
    const counts = cacheRef.current.counts;
    const activeData = cacheRef.current.activeData;

    // Forçar categoria para membros
    useEffect(() => {
        const isSecondary = (subscription.ownerId && subscription.ownerId !== user?.id) &&
            subscription.role !== 'owner' &&
            subscription.role !== 'admin' &&
            subscription.role !== 'principal';
        if (isSecondary && subscription.congregationIds && (subscription.congregationIds || []).length > 0) {
            setActiveCategory('churches');
            if (!selectedReportId || !(subscription.congregationIds || []).includes(selectedReportId)) {
                setSelectedReportId(subscription.congregationIds[0]);
            }
        }
    }, [subscription, selectedReportId, user?.id]);

    useEffect(() => {
        if (!reportPreviewData) return;
        
        const isSecondary = (subscription.ownerId && subscription.ownerId !== user?.id) &&
            subscription.role !== 'owner' &&
            subscription.role !== 'admin' &&
            subscription.role !== 'principal';
        // Se for membro, garante que está na categoria correta e com uma igreja válida
        if (isSecondary && subscription.congregationIds && (subscription.congregationIds || []).length > 0) {
            setActiveCategory('churches');
            if (!selectedReportId || !(subscription.congregationIds || []).includes(selectedReportId)) {
                setSelectedReportId(subscription.congregationIds[0]);
            }
            return;
        }

        if (activeCategory === 'general') {
            setSelectedReportId('general_all');
        } else if (activeCategory === 'churches') {
            const incomeData = reportPreviewData.income || {};
            const churchIds = Object.keys(incomeData).filter(k => k !== 'unidentified').sort();
            if ((churchIds || []).length > 0) {
                if (!selectedReportId || !churchIds.includes(selectedReportId) || selectedReportId === 'general_all') {
                    setSelectedReportId(churchIds[0]);
                }
            } else {
                setSelectedReportId(null);
            }
        } else if (activeCategory === 'unidentified') {
            setSelectedReportId('unidentified');
        } else if (activeCategory === 'expenses') {
            setSelectedReportId('all_expenses_group');
        }
    }, [activeCategory, reportPreviewData, subscription]);

    const sortedData = useMemo(() => {
        const source = Array.isArray(activeData) ? activeData : [];
        if ((source || []).length === 0) return [];
        if (!sortConfig) return source;

        return [...source].sort((a, b) => {
            let valA: any, valB: any;
            const key = sortConfig.key;

            if (key === 'contributor.name' || key === 'transaction.description') {
                valA = a.contributor?.name || a.contributor?.cleanedName || a.transaction?.cleanedDescription || a.transaction?.description || '';
                valB = b.contributor?.name || b.contributor?.cleanedName || b.transaction?.cleanedDescription || b.transaction?.description || '';
            } else if (key.includes('.')) {
                const parts = key.split('.');
                valA = parts.reduce((obj: any, k) => obj?.[k], a);
                valB = parts.reduce((obj: any, k) => obj?.[k], b);
            } else {
                valA = (a as any)[key];
                valB = (b as any)[key];
            }

            valA = (valA ?? ''); 
            valB = (valB ?? '');
            
            if (typeof valA === 'string' && typeof valB === 'string') { 
                valA = valA.toLowerCase(); 
                valB = valB.toLowerCase(); 
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [activeData, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const activeSummary = useMemo(() => {
        if (!Array.isArray(activeData)) {
            return { count: 0, total: 0, auto: 0, autoValue: 0, manual: 0, manualValue: 0, pending: 0, pendingValue: 0 };
        }

        const parseNumeric = (val: any): number => {
            if (val === undefined || val === null) return 0;
            if (typeof val === 'number') {
                return isNaN(val) ? 0 : val;
            }
            if (typeof val === 'string') {
                let clean = val.trim();
                clean = clean.replace(/[R$\s]/g, '');
                if (clean.includes(',') && clean.includes('.')) {
                    if (clean.indexOf('.') < clean.indexOf(',')) {
                        clean = clean.replace(/\./g, '').replace(',', '.');
                    } else {
                        clean = clean.replace(/,/g, '');
                    }
                } else if (clean.includes(',')) {
                    clean = clean.replace(',', '.');
                }
                const num = parseFloat(clean);
                return isNaN(num) ? 0 : num;
            }
            return 0;
        };

        const getFinalAmount = (r: MatchResult) => {
            const rawAmount = r.status === 'PENDENTE' ? r.contributorAmount : r.transaction?.amount;
            const amount = parseNumeric(rawAmount);
            const isExp = amount < 0 || 
                          r.transaction?.type?.toLowerCase() === 'expense' || 
                          r.transaction?.type?.toLowerCase() === 'saida' || 
                          r.contributionType?.toLowerCase() === 'saída' || 
                          r.contributionType?.toLowerCase() === 'saida';
            return isExp ? -Math.abs(amount) : amount;
        };

        const total = activeCategory === 'churches'
            ? activeData.filter(r => r.status === 'IDENTIFICADO').reduce((sum, r) => sum + getFinalAmount(r), 0)
            : activeData.reduce((sum, r) => sum + getFinalAmount(r), 0);

        const count = activeCategory === 'churches'
            ? activeData.filter(r => r.status === 'IDENTIFICADO').length
            : (activeData || []).length;

        const autoTxs = activeData.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'AUTOMATIC' || r.matchMethod === 'LEARNED' || !r.matchMethod || r.matchMethod === 'TEMPLATE'));
        const manualTxs = activeData.filter(r => r.status === 'IDENTIFICADO' && (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI'));
        const pendingTxs = activeData.filter(r => r.status === 'PENDENTE' || r.status === 'NÃO IDENTIFICADO');

        return { 
            count, total, 
            auto: (autoTxs || []).length, autoValue: autoTxs.reduce((s, r) => s + getFinalAmount(r), 0),
            manual: (manualTxs || []).length, manualValue: manualTxs.reduce((s, r) => s + getFinalAmount(r), 0),
            pending: (pendingTxs || []).length, pendingValue: pendingTxs.reduce((s, r) => s + getFinalAmount(r), 0)
        };
    }, [activeData, activeCategory]);

    const handleDownload = () => ExportService.downloadCsv(sortedData, `relatorio_${new Date().toISOString().slice(0,10)}.csv`);

    const handleDownloadExcel = () => {
        const title = activeCategory === 'general' ? 'Relatório Geral' : activeCategory === 'churches' ? (churchList.find(c => c.id === selectedReportId)?.name || 'Relatório') : activeCategory === 'unidentified' ? 'Pendentes' : 'Saídas';
        ExportService.downloadExcel(sortedData, `relatorio_${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const handleDownloadPdf = () => {
        const title = activeCategory === 'general' ? 'Relatório Geral' : activeCategory === 'churches' ? (churchList.find(c => c.id === selectedReportId)?.name || 'Relatório') : activeCategory === 'unidentified' ? 'Pendentes' : 'Saídas';
        ExportService.downloadPdf(sortedData, title, `relatorio_${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
    };
    
    const handlePrint = () => {
        const title = activeCategory === 'general' ? 'Relatório Geral' : activeCategory === 'churches' ? (churchList.find(c => c.id === selectedReportId)?.name || 'Relatório') : activeCategory === 'unidentified' ? 'Pendentes' : 'Saídas';
        ExportService.printHtml(sortedData, title, activeSummary, language);
    };

    const handleSaveReport = () => openSaveReportModal({ type: 'global', results: matchResults, groupName: 'Geral' });

    return {
        activeCategory, setActiveCategory,
        selectedReportId, setSelectedReportId,
        selectedBankId, setSelectedBankId,
        searchTerm, setSearchTerm,
        sortConfig, setSortConfig,
        handleSort,
        churchList, bankList, counts, activeSummary, sortedData,
        activeReportId, saveCurrentReportChanges, runAiAutoIdentification,
        handleDownload, handleDownloadExcel, handleDownloadPdf, handlePrint, handleSaveReport, updateReportData,
        setActiveView, reportPreviewData,
        searchFilters, setSearchFilters
    };
};