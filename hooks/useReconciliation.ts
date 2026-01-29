
import { useState, useCallback, useRef, useEffect } from 'react';
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

export const useReconciliation = ({
    user,
    churches,
    banks,
    fileModels,
    fetchModels,
    similarityLevel,
    dayTolerance,
    customIgnoreKeywords,
    contributionKeywords,
    learnedAssociations,
    showToast,
    setIsLoading,
    setActiveView
}: any) => {

    const userSuffix = user ? `-${user.id}` : '-guest';
    
    const [activeReportId, setActiveReportId] = usePersistentState<string | null>(`identificapix-active-report-id${userSuffix}`, null);
    const [matchResults, setMatchResults] = usePersistentState<MatchResult[]>(`identificapix-match-results${userSuffix}`, [], true);
    const [hasActiveSession, setHasActiveSession] = usePersistentState<boolean>(`identificapix-has-session${userSuffix}`, false);
    
    const [activeBankFiles, setBankStatementFile] = useState<any[]>([]);
    const [contributorFiles, setContributorFiles] = useState<ContributorFile[]>([]);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    const [reportPreviewData, setReportPreviewData] = useState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(null);
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[]>([]);
    const [modelRequiredData, setModelRequiredData] = useState<any | null>(null);
    const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
    
    const [launchedResults, setLaunchedResults] = usePersistentState<MatchResult[]>(`identificapix-launched${userSuffix}`, [], true);

    const processingFilesRef = useRef<Set<string>>(new Set());

    const { persistTransactions, clearRemoteList, hydrate } = useLiveListSync({
        user,
        setBankStatementFile,
        setSelectedBankIds,
        showToast
    });

    const handleCompare = useCallback(async () => {
        setIsLoading(true);
        // Busca dados atualizados do estado (que foi populado pelo hydrate)
        const allTransactions = activeBankFiles
            .filter(f => selectedBankIds.includes(f.bankId))
            .flatMap(f => f.processedTransactions || []);
        
        if (allTransactions.length === 0) { 
            setIsLoading(false); 
            return; 
        }

        const results = matchTransactions(
            allTransactions, 
            contributorFiles, 
            { similarityThreshold: similarityLevel, dayTolerance: dayTolerance }, 
            learnedAssociations, 
            churches, 
            customIgnoreKeywords
        );

        setMatchResults(results);
        setHasActiveSession(true);
        setIsLoading(false);
    }, [activeBankFiles, selectedBankIds, contributorFiles, similarityLevel, dayTolerance, learnedAssociations, churches, customIgnoreKeywords, setIsLoading, setMatchResults, setHasActiveSession]);

    // Sincroniza o Preview sempre que os resultados persistentes mudarem (inclusive no load)
    useEffect(() => {
        if (matchResults.length > 0) {
            regenerateReportPreview(matchResults);
        }
    }, [matchResults.length]);

    const findMatchResult = useCallback((txId: string) => {
        return matchResults.find(r => r.transaction.id === txId);
    }, [matchResults]);

    const regenerateReportPreview = useCallback((results: MatchResult[]) => {
        const uniqueResults = Array.from(new Map(results.map(r => [r.transaction.id, r])).values());
        
        const incomeResults = uniqueResults.filter(r => {
            const val = r.status === ReconciliationStatus.PENDING 
                ? (r.contributorAmount || r.contributor?.amount || 0) 
                : r.transaction.amount;
            return val > 0;
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
    }, []);

    /**
     * ⚡ MANIPULADOR DE UPLOAD (V2 - COM AUTO-REFRESH)
     */
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

            // 1. Persiste no banco (Supabase)
            const stats = await persistTransactions(bankId, transactions);
            
            // 2. Hidrata o estado local para refletir a nova Lista Viva
            await hydrate();

            // 3. SE houver sessão ativa, atualiza o relatório IMEDIATAMENTE
            if (hasActiveSession) {
                // Forçamos a atualização dos IDs selecionados para garantir que o novo banco esteja incluso
                setSelectedBankIds(prev => Array.from(new Set([...prev, bankId])));
                // Aguarda o estado assíncrono e re-compara
                setTimeout(() => handleCompare(), 100);
            }

            showToast(stats.added === 0 ? "Lista Atualizada." : `Sucesso! +${stats.added} registros.`, "success");
            
        } catch (error: any) {
            showToast("Erro no processamento do arquivo.", "error");
        } finally {
            processingFilesRef.current.delete(processKey);
            setIsLoading(false);
        }
    }, [fileModels, fetchModels, customIgnoreKeywords, persistTransactions, showToast, hydrate, setIsLoading, hasActiveSession, handleCompare, setSelectedBankIds]);

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
            if (hasActiveSession) setTimeout(() => handleCompare(), 100);
        } finally {
            processingFilesRef.current.delete(gmailKey);
            setIsLoading(false);
        }
    }, [user, customIgnoreKeywords, persistTransactions, showToast, setIsLoading, hydrate, hasActiveSession, handleCompare]);

    const removeBankStatementFile = useCallback(async (bankId: string) => {
        setIsLoading(true);
        try {
            await clearRemoteList(bankId);
            showToast("Lista removida do sistema.", "success");
            if (hasActiveSession) setTimeout(() => handleCompare(), 100);
        } finally {
            setIsLoading(false);
        }
    }, [clearRemoteList, showToast, setIsLoading, hasActiveSession, handleCompare]);

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
        activeBankFiles, contributorFiles, matchResults, reportPreviewData,
        activeReportId, setActiveReportId, hasActiveSession, setHasActiveSession,
        comparisonType, setComparisonType, selectedBankIds,
        manualIdentificationTx, setManualIdentificationTx,
        bulkIdentificationTxs, setBulkIdentificationTxs,
        modelRequiredData, setModelRequiredData,
        loadingAiId, setLoadingAiId, findMatchResult,
        launchedResults, setLaunchedResults, markAsLaunched, undoLaunch, deleteLaunchedItem,
        importGmailTransactions, handleStatementUpload, 
        handleContributorsUpload: (content: string, fileName: string, churchId: string) => {
             const church = churches.find((c: any) => c.id === churchId);
             const contributors = parseContributors(content, customIgnoreKeywords, contributionKeywords);
             setContributorFiles(prev => [...prev.filter(f => f.churchId !== churchId), { church, churchId, contributors, fileName }]);
             showToast(`Lista carregada (${contributors.length} nomes).`, "success");
             if (hasActiveSession) setTimeout(() => handleCompare(), 100);
        },
        removeBankStatementFile,
        removeContributorFile: (churchId: string) => {
            setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
            if (hasActiveSession) setTimeout(() => handleCompare(), 100);
        },
        toggleBankSelection: (id: string) => {
            setSelectedBankIds(prev => {
                const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
                return next;
            });
            if (hasActiveSession) setTimeout(() => handleCompare(), 100);
        },
        handleCompare,
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
        setReportPreviewData,
        setSelectedBankIds
    };
};
