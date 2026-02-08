
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

    const findMatchResult = useCallback((txId: string) => {
        return matchResults.find(r => r.transaction.id === txId);
    }, [matchResults]);

    const handleStatementUpload = useCallback(async (content: string, fileName: string, bankId: string, rawFile?: File, base64?: string) => {
        const processKey = `${bankId}-${fileName}`;
        if (processingFilesRef.current.has(processKey)) return;

        processingFilesRef.current.add(processKey);
        setIsLoading(true);

        try {
            if (fetchModels) await fetchModels();
            
            // 🛡️ EXECUÇÃO DE CONTRATO: Obtém transações estruturadas diretamente do motor
            const result = await processFileContent(content, fileName, fileModels, customIgnoreKeywords, base64);
            const transactions = Array.isArray(result?.transactions) ? result.transactions : [];
            
            if (result.status === 'MODEL_REQUIRED' || (transactions.length === 0 && bankId !== 'gmail-sync')) {
                setModelRequiredData({ ...result, fileName, bankId });
                setIsLoading(false);
                processingFilesRef.current.delete(processKey);
                return;
            }

            if (transactions.length > 0) {
                // 🚀 INJEÇÃO NA LISTA VIVA: Persistência no banco e atualização imediata da UI
                const stats = await persistTransactions(bankId, transactions);
                if (stats.added > 0) {
                    showToast(`${stats.added} novas transações adicionadas à Lista Viva.`, "success");
                } else {
                    showToast("O arquivo foi processado, mas todas as transações já existiam na Lista Viva.", "success");
                }
                await hydrate();
            }
            
        } catch (error: any) {
            console.error("[Reconciliation] Upload Fail:", error);
            showToast("Erro no processamento do arquivo.", "error");
        } finally {
            processingFilesRef.current.delete(processKey);
            setIsLoading(false);
        }
    }, [fileModels, fetchModels, customIgnoreKeywords, persistTransactions, showToast, hydrate, setIsLoading, setModelRequiredData]);

    const importGmailTransactions = useCallback(async (transactions: Transaction[]) => {
        if (!user || transactions.length === 0) return;
        setIsLoading(true);
        try {
            const stats = await persistTransactions('gmail-sync', transactions);
            showToast(`Gmail sincronizado! ${stats.added} novas transações.`, "success");
            await hydrate();
        } finally {
            setIsLoading(false);
        }
    }, [user, persistTransactions, showToast, setIsLoading, hydrate]);

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
            return prev.filter(r => r.transaction.id !== txId);
        });
    }, [setMatchResults, setLaunchedResults]);

    const undoLaunch = useCallback((txId: string) => {
        setLaunchedResults(prevLaunched => {
            const item = prevLaunched.find(r => r.transaction.id === txId);
            if (!item) return prevLaunched;
            const nextLaunched = prevLaunched.filter(r => r.transaction.id !== txId);
            setMatchResults(prevResults => [...prevResults, item]);
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
        },
        removeBankStatementFile,
        handleRemoveSpecificFile: async (fileToRemove: any, bank: Bank) => {
            const remainingFiles = activeBankFiles.filter((f: any) => f.bankId === bank.id && f !== fileToRemove);
            await clearRemoteList(bank.id);
            if (remainingFiles.length > 0) {
                const allTxs = remainingFiles.flatMap((f: any) => f.processedTransactions || []);
                await persistTransactions(bank.id, allTxs);
            }
            await hydrate(false);
        },
        removeContributorFile: (churchId: string) => setContributorFiles(prev => prev.filter(f => f.churchId !== churchId)),
        toggleBankSelection: (id: string) => setSelectedBankIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]),
        handleCompare: async (overrideType?: ComparisonType, overrideLevel?: number, overrideTolerance?: number) => {
            if (overrideType) setComparisonType(overrideType);
            setIsLoading(true);
            const allTransactions = activeBankFiles.filter(f => selectedBankIds.includes(String(f.bankId))).flatMap(f => f.processedTransactions || []);
            if (allTransactions.length === 0) { showToast("Selecione pelo menos um extrato com dados.", "error"); setIsLoading(false); return; }
            const filteredExistingResults = matchResults.filter(r => selectedBankIds.includes(String(r.transaction.bank_id)));
            const results = matchTransactions(allTransactions, contributorFiles, { similarityThreshold: overrideLevel !== undefined ? overrideLevel : similarityLevel, dayTolerance: overrideTolerance !== undefined ? overrideTolerance : dayTolerance }, learnedAssociations, churches, customIgnoreKeywords, filteredExistingResults);
            setMatchResults(results);
            setHasActiveSession(true);
            setActiveView('reports');
            setIsLoading(false);
            showToast("Conciliação concluída!", "success");
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
