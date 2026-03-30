
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
    MatchResult, 
    Transaction, 
    Church, 
    Bank, 
    FileModel, 
    ComparisonType,
    ContributorFile,
    GroupedReportData,
    ReconciliationStatus
} from '../types';
import { 
    processFileContent, 
    parseContributors, 
    matchTransactions, 
    groupResultsByChurch,
    PLACEHOLDER_CHURCH
} from '../services/processingService';
import { IngestionOrchestrator } from '../core/engine/IngestionOrchestrator';
import { useLiveListSync } from './useLiveListSync';
import { usePersistentState } from './usePersistentState';
import { consolidationService } from '../services/ConsolidationService';
import { supabase } from '../services/supabaseClient';

export const useReconciliation = ({
    user,
    subscription,
    churches,
    banks,
    fileModels,
    fetchModels,
    similarityLevel,
    dayTolerance,
    customIgnoreKeywords,
    contributionKeywords,
    learnedAssociations,
    savedReports,
    showToast,
    setIsLoading,
    setActiveView
}: any) => {

    const effectiveUserId = subscription?.ownerId;
    const userSuffix = effectiveUserId ? `-${effectiveUserId}` : '-guest';
    
    // ESTADOS PERSISTENTES (Mantêm o progresso do relatório)
    const [activeReportId, setActiveReportId] = usePersistentState<string | null>(`identificapix-active-report-id${userSuffix}`, null);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>(`identificapix-match-results${userSuffix}`, [], true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>(`identificapix-has-session${userSuffix}`, false);
    
    const lastCloudSyncRef = useRef<string>('');
    const isHydratingFromCloud = useRef<boolean>(false);

    // ☁️ SINCRONIZAÇÃO COM A NUVEM (Trabalho Vivo)
    const syncToCloud = useCallback(async (results: MatchResult[]) => {
        if (!user?.id || !effectiveUserId || isHydratingFromCloud.current) return;
        
        // Payload simplificado para comparação de mudanças reais
        const payload = JSON.stringify(results.map(r => ({
            id: r.transaction.id,
            status: r.status,
            churchId: r.church?.id || r._churchId,
            contributorId: r.contributor?.id
        })));

        if (payload === lastCloudSyncRef.current) return;
        lastCloudSyncRef.current = payload;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Sincroniza imediatamente
            await fetch('/api/reference/report/sync', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    reportId: `LIVE_SESSION_${effectiveUserId}`,
                    name: '[SESSÃO_ATIVA]',
                    data: { results }, // Envia os resultados completos
                    recordCount: results.length,
                    ownerId: effectiveUserId
                })
            });
        } catch (e) {
            console.error("[CloudSync] Erro ao sincronizar sessão ativa:", e);
        }
    }, [user?.id, effectiveUserId]);

    // Auto-save para a nuvem (mais frequente para evitar perda de dados)
    useEffect(() => {
        if (matchResults.length > 0 && !activeReportId) {
            const timer = setTimeout(() => syncToCloud(matchResults), 1000);
            return () => clearTimeout(timer);
        }
    }, [matchResults, activeReportId, syncToCloud]);

    // Hidratação e Vínculo com Objetos de Igreja
    useEffect(() => {
        if (!effectiveUserId || activeReportId || !churches.length) return;

        const liveReport = (savedReports || []).find((r: any) => r.name === '[SESSÃO_ATIVA]');
        if (liveReport && liveReport.data?.results) {
            const cloudResults = liveReport.data.results;
            
            // Compara se há mudança real na identificação ou status
            const cloudCheck = JSON.stringify(cloudResults.map((r: any) => ({ id: r.transaction.id, c: r.church?.id || r._churchId, s: r.status })));
            const localCheck = JSON.stringify(matchResults.map(r => ({ id: r.transaction.id, c: r.church?.id || r._churchId, s: r.status })));

            if (matchResults.length === 0 || cloudCheck !== localCheck) {
                isHydratingFromCloud.current = true;
                
                // RE-VINCULA os objetos de igreja (Hidratação)
                const hydratedResults = cloudResults.map((r: any) => {
                    const churchId = r.church?.id || r._churchId || (r.transaction as any)?.church_id;
                    const fullChurch = churches.find((c: any) => c.id === churchId);
                    return {
                        ...r,
                        church: fullChurch || r.church || PLACEHOLDER_CHURCH
                    };
                });

                setMatchResults(hydratedResults);
                setHasActiveSession(true);
                lastCloudSyncRef.current = JSON.stringify(hydratedResults.map((r: any) => ({
                    id: r.transaction.id,
                    status: r.status,
                    churchId: r.church?.id || r._churchId,
                    contributorId: r.contributor?.id
                })));
                
                setTimeout(() => { isHydratingFromCloud.current = false; }, 500);
            }
        }
    }, [savedReports, effectiveUserId, activeReportId, churches]);
    
    const [activeBankFiles, setBankStatementFile] = useState<any[]>([]);
    const [contributorFiles, setContributorFiles] = useState<ContributorFile[]>([]);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    const [reportPreviewData, setReportPreviewData] = useState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(null);
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[]>([]);
    const [modelRequiredData, setModelRequiredData] = useState<any | null>(null);
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    const [triggerSync, setTriggerSync] = useState(0);
    
    const [launchedResults, setLaunchedResults] = usePersistentState<MatchResult[]>(`identificapix-launched${userSuffix}`, [], true);

    // Filtros de segurança para membros
    const filteredMatchResults = useMemo(() => {
        let results = matchResults;
        const isSecondary = subscription?.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary) {
            if (subscription.congregationIds && subscription.congregationIds.length > 0) {
                results = results.filter(r => {
                    const churchId = r.church?.id || r._churchId || (r.transaction as any)?.church_id;
                    return subscription.congregationIds.includes(churchId);
                });
            }
            if (subscription.bankIds && subscription.bankIds.length > 0) {
                results = results.filter(r => subscription.bankIds.includes(String(r.transaction.bank_id)));
            }
        }
        return results;
    }, [matchResults, subscription, user?.id]);

    const filteredLaunchedResults = useMemo(() => {
        let results = launchedResults;
        const isSecondary = subscription?.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary) {
            if (subscription.congregationIds && subscription.congregationIds.length > 0) {
                results = results.filter(r => {
                    const churchId = r.church?.id || r._churchId || (r.transaction as any)?.church_id;
                    return subscription.congregationIds.includes(churchId);
                });
            }
            if (subscription.bankIds && subscription.bankIds.length > 0) {
                results = results.filter(r => subscription.bankIds.includes(String(r.transaction.bank_id)));
            }
        }
        return results;
    }, [launchedResults, subscription, user?.id]);

    const processingFilesRef = useRef<Set<string>>(new Set());
    const lastValidatedHash = useRef<string>('');
    const isValidating = useRef<boolean>(false);

    /**
     * 📡 REALTIME SYNC (Escuta mudanças de confirmação)
     */
    useEffect(() => {
        if (!effectiveUserId) return;
        
        const channel = supabase
            .channel(`reconciliation-status-sync-${effectiveUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'consolidated_transactions',
                    filter: `user_id=eq.${effectiveUserId}`
                },
                (payload) => {
                    if (payload.new && payload.new.is_confirmed === true) {
                        // Força a re-validação do cache local
                        lastValidatedHash.current = '';
                        setTriggerSync(prev => prev + 1);
                    }
                }
            )
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [effectiveUserId]);

    /**
     * 🛡️ INTEGRIDADE DO CACHE (Anti-Stale)
     * Valida se as transações no cache local já foram confirmadas no banco por outro dispositivo.
     * Em vez de remover, atualiza o status para 'FECHADO'.
     */
    useEffect(() => {
        if (!effectiveUserId || matchResults.length === 0 || isValidating.current) return;

        const currentIdsHash = matchResults.map(r => r.transaction.id).sort().join(',');
        if (currentIdsHash === lastValidatedHash.current) return;

        const cleanStaleCache = async () => {
            isValidating.current = true;
            
            const realIds = matchResults
                .map(r => r.transaction.id)
                .filter(id => /^[0-9a-fA-F-]{36}$/.test(id));
            
            if (realIds.length === 0) {
                lastValidatedHash.current = currentIdsHash;
                isValidating.current = false;
                return;
            }

            try {
                const confirmedIds = await consolidationService.checkConfirmedTransactions(effectiveUserId, realIds);
                
                if (confirmedIds.length > 0) {
                    setMatchResults(prev => {
                        let hasChanges = false;
                        const updated = prev.map(r => {
                            if (confirmedIds.includes(r.transaction.id) && !r.isConfirmed) {
                                hasChanges = true;
                                return { 
                                    ...r, 
                                    isConfirmed: true, 
                                    transaction: { ...r.transaction, isConfirmed: true } 
                                };
                            }
                            return r;
                        });
                        
                        if (!hasChanges) return prev;
                        
                        lastValidatedHash.current = updated.map(r => r.transaction.id).sort().join(',');
                        return updated;
                    });
                } else {
                    lastValidatedHash.current = currentIdsHash;
                }
            } catch (e) {
                console.error("[CacheSync] Erro ao validar integridade do cache:", e);
            } finally {
                isValidating.current = false;
            }
        };

        const timer = setTimeout(cleanStaleCache, 500);
        return () => clearTimeout(timer);
    }, [effectiveUserId, matchResults, setMatchResults, triggerSync]);

    const { persistTransactions, clearRemoteList, hydrate } = useLiveListSync({
        user,
        subscription,
        setBankStatementFile,
        setSelectedBankIds
    });

    const findMatchResult = useCallback((txId: string) => {
        return matchResults.find(r => r.transaction.id === txId);
    }, [matchResults]);

    const regenerateReportPreview = useCallback((results: MatchResult[]) => {
        // Filtro de segurança para membros no preview
        let filteredResults = results || [];
        const isSecondary = subscription?.ownerId && subscription.ownerId !== user?.id;
        if (isSecondary && subscription.congregationIds && subscription.congregationIds.length > 0) {
            filteredResults = (results || []).filter(r => subscription.congregationIds.includes(r.church?.id || r._churchId));
        }

        const uniqueResults = Array.from(new Map(filteredResults.map(r => [r.transaction.id, r])).values());
        
        const incomeResults = uniqueResults.filter(r => {
            const val = r.status === ReconciliationStatus.PENDING 
                ? (r.contributorAmount || r.contributor?.amount || 0) 
                : r.transaction.amount;
            return val >= 0; 
        });
        
        const expenseResults = uniqueResults.filter(r => {
            const val = r.status === ReconciliationStatus.PENDING 
                ? (r.contributorAmount || r.contributor?.amount || 0) 
                : r.transaction.amount;
            return val < 0;
        });

        setReportPreviewData({
            income: groupResultsByChurch(incomeResults),
            expenses: { 'all_expenses_group': expenseResults }
        });
    }, [subscription, user]);

    // Sincroniza o Preview sempre que os resultados persistentes mudarem
    useEffect(() => {
        // Sempre regenera, mesmo que vazio, para evitar estado 'null' que trava a UI
        regenerateReportPreview(matchResults);
    }, [matchResults, regenerateReportPreview]);

    const handleStatementUpload = useCallback(async (content: string, fileName: string, bankId: string, rawFile?: File, base64?: string) => {
        const processKey = `${bankId}-${fileName}`;
        if (processingFilesRef.current.has(processKey)) return;

        processingFilesRef.current.add(processKey);
        setIsLoading(true);

        try {
            if (fetchModels) await fetchModels();
            const executorResult = await processFileContent(content, fileName, fileModels, customIgnoreKeywords, base64);
            const transactions = Array.isArray(executorResult?.transactions) ? executorResult.transactions : [];
            
            if (executorResult.status === 'MODEL_REQUIRED' || (transactions.length === 0 && bankId !== 'gmail-sync')) {
                setModelRequiredData({ ...executorResult, status: 'MODEL_REQUIRED', fileName, bankId });
                setIsLoading(false);
                processingFilesRef.current.delete(processKey);
                return;
            }

            if (transactions.length === 0) {
                showToast("Nenhuma transação extraída do arquivo.", "error");
                setIsLoading(false);
                processingFilesRef.current.delete(processKey);
                return;
            }

            const stats = await persistTransactions(bankId, transactions);
            showToast(stats.added === 0 ? "Lista Sincronizada." : `Sucesso! Total: ${stats.total}`, "success");
            await hydrate();
            
        } catch (error: any) {
            showToast("Erro no processamento do arquivo.", "error");
        } finally {
            processingFilesRef.current.delete(processKey);
            setIsLoading(false);
        }
    }, [fileModels, fetchModels, customIgnoreKeywords, persistTransactions, showToast, hydrate, setIsLoading]);

    const importGmailTransactions = useCallback(async (transactions: Transaction[]) => {
        if (!user || transactions.length === 0) return;
        const gmailKey = `gmail-sync-active`;
        if (processingFilesRef.current.has(gmailKey)) return;
        
        processingFilesRef.current.add(gmailKey);
        setIsLoading(true);
        try {
            const result = await IngestionOrchestrator.processVirtualData('Gmail', transactions, customIgnoreKeywords);
            const stats = await persistTransactions('gmail-sync', result.transactions);
            showToast(`Gmail sincronizado! Total: ${stats.total}`, "success");
            await hydrate();
        } finally {
            processingFilesRef.current.delete(gmailKey);
            setIsLoading(false);
        }
    }, [user, customIgnoreKeywords, persistTransactions, showToast, setIsLoading, hydrate]);

    const removeBankStatementFile = useCallback(async (bankId: string) => {
        setIsLoading(true);
        try {
            await clearRemoteList(bankId);
            showToast("Lista removida do sistema.", "success");
        } finally {
            setIsLoading(false);
        }
    }, [clearRemoteList, showToast, setIsLoading]);

    const resetReconciliation = useCallback(async () => {
        setIsLoading(true);
        try {
            await clearRemoteList('all');
            setMatchResults([]);
            setReportPreviewData(null);
            setContributorFiles([]);
            setHasActiveSession(false);
            setActiveReportId(null);
            showToast("Sistema reiniciado.", "success");
            setActiveView('upload');
        } finally {
            setIsLoading(false);
        }
    }, [clearRemoteList, showToast, setActiveView, setIsLoading, setMatchResults, setHasActiveSession, setActiveReportId]);

    const markAsLaunched = useCallback((txId: string) => {
        setMatchResults(prev => {
            const itemIndex = prev.findIndex(r => r.transaction.id === txId);
            if (itemIndex === -1) return prev;
            const item = prev[itemIndex];
            setLaunchedResults(launched => [{ ...item, launchedAt: new Date().toISOString() }, ...launched]);
            const next = prev.filter(r => r.transaction.id !== txId);
            return next;
        });
    }, [setMatchResults, setLaunchedResults]);

    const undoLaunch = useCallback((txId: string) => {
        setLaunchedResults(prevLaunched => {
            const item = prevLaunched.find(r => r.transaction.id === txId);
            if (!item) return prevLaunched;
            const nextLaunched = prevLaunched.filter(r => r.transaction.id !== txId);
            setMatchResults(prevResults => {
                if (prevResults.some(r => r.transaction.id === txId)) return prevResults;
                return [...prevResults, item];
            });
            return nextLaunched;
        });
        showToast("Lançamento desfeito.", "success");
    }, [setMatchResults, setLaunchedResults, showToast]);

    const deleteLaunchedItem = useCallback((txId: string) => {
        setLaunchedResults(prev => prev.filter(r => r.transaction.id !== txId));
        showToast("Item removido.", "success");
    }, [setLaunchedResults, showToast]);

    return {
        activeBankFiles, contributorFiles, matchResults: filteredMatchResults, reportPreviewData,
        activeReportId, setActiveReportId, hasActiveSession, setHasActiveSession,
        comparisonType, setComparisonType, selectedBankIds,
        manualIdentificationTx, setManualIdentificationTx,
        bulkIdentificationTxs, setBulkIdentificationTxs,
        modelRequiredData, setModelRequiredData,
        loadingAiId, setLoadingAiId, findMatchResult,
        launchedResults: filteredLaunchedResults, setLaunchedResults, markAsLaunched, undoLaunch, deleteLaunchedItem,
        importGmailTransactions, handleStatementUpload, 
        handleContributorsUpload: (content: string, fileName: string, churchId: string) => {
             const church = churches.find((c: any) => c.id === churchId);
             const contributors = parseContributors(content, customIgnoreKeywords, contributionKeywords);
             setContributorFiles(prev => [...prev.filter(f => f.churchId !== churchId), { church, churchId, contributors, fileName }]);
             showToast(`Lista carregada (${contributors.length} nomes).`, "success");
        },
        removeBankStatementFile,
        removeContributorFile: (churchId: string) => setContributorFiles(prev => prev.filter(f => f.churchId !== churchId)),
        toggleBankSelection: (id: string) => setSelectedBankIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]),
        handleCompare: async () => {
            setIsLoading(true);
            
            // 🔍 FILTRAGEM RIGOROSA DE TRANSAÇÕES
            // Garante que apenas as transações dos bancos selecionados entrem no pipeline de matching
            const allTransactions = activeBankFiles
                .filter(f => selectedBankIds.includes(String(f.bankId)))
                .flatMap(f => f.processedTransactions || []);
            
            if (allTransactions.length === 0) { 
                showToast("Selecione pelo menos um extrato com dados.", "error"); 
                setIsLoading(false); 
                return; 
            }

            // 🔍 FILTRAGEM RIGOROSA DE RESULTADOS EXISTENTES
            // Ao rodar a comparação, preservamos apenas os resultados manuais ou já identificados 
            // que pertençam aos bancos atualmente selecionados.
            const filteredExistingResults = matchResults.filter(r => 
                selectedBankIds.includes(String(r.transaction.bank_id))
            );

            // 🧬 FUSÃO INTELIGENTE: Executa o matching apenas no escopo selecionado
            const results = matchTransactions(
                allTransactions, 
                contributorFiles, 
                { similarityThreshold: similarityLevel, dayTolerance: dayTolerance }, 
                learnedAssociations, 
                churches, 
                customIgnoreKeywords,
                filteredExistingResults 
            );

            setMatchResults(results);
            setHasActiveSession(true);
            if (false) {
                setActiveView('reports');
            }
            setIsLoading(false);
            showToast("Conciliação concluída para os itens selecionados!", "success");
        },
        resetReconciliation,
        updateReportData: (updatedRow: MatchResult) => {
            setMatchResults(prev => {
                const next = [...prev];
                const idx = next.findIndex(r => r.transaction.id === updatedRow.transaction.id);
                if (idx !== -1) next[idx] = updatedRow;
                else next.push(updatedRow);
                return next;
            });
        },
        revertMatch: (txId: string) => {
            setMatchResults(prev => prev.map(r => r.transaction.id === txId ? { ...r, status: ReconciliationStatus.UNIDENTIFIED, contributor: null, church: PLACEHOLDER_CHURCH } : r));
        },
        closeManualIdentify: () => { setManualIdentificationTx(null); setBulkIdentificationTxs([]); },
        removeTransaction: (id: string) => {
            setMatchResults(prev => prev.filter(r => r.transaction.id !== id));
        },
        hydrate,
        setMatchResults,
        setReportPreviewData
    };
};
