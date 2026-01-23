
import { useState, useCallback, useRef } from 'react';
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
    const [activeBankFiles, setBankStatementFile] = useState<any[]>([]);
    const [contributorFiles, setContributorFiles] = useState<ContributorFile[]>([]);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
    const [reportPreviewData, setReportPreviewData] = useState<{ income: GroupedReportData; expenses: GroupedReportData } | null>(null);
    const [activeReportId, setActiveReportId] = useState<string | null>(null);
    const [hasActiveSession, setHasActiveSession] = useState(false);
    const [comparisonType, setComparisonType] = useState<ComparisonType>('income');
    const [manualIdentificationTx, setManualIdentificationTx] = useState<Transaction | null>(null);
    const [bulkIdentificationTxs, setBulkIdentificationTxs] = useState<Transaction[]>([]);
    const [modelRequiredData, setModelRequiredData] = useState<any | null>(null);
    
    const [launchedResults, setLaunchedResults] = usePersistentState<MatchResult[]>(`identificapix-launched${userSuffix}`, [], true);

    const processingFilesRef = useRef<Set<string>>(new Set());

    const { persistTransactions, clearRemoteList, hydrate } = useLiveListSync({
        user,
        setBankStatementFile,
        setSelectedBankIds,
        showToast
    });

    const regenerateReportPreview = useCallback((results: MatchResult[]) => {
        const uniqueResults = Array.from(new Map(results.map(r => [r.transaction.id, r])).values());
        const incomeResults = uniqueResults.filter(r => r.transaction.amount >= 0 || r.status === ReconciliationStatus.PENDING);
        const expenseResults = uniqueResults.filter(r => r.transaction.amount < 0 && r.status !== ReconciliationStatus.PENDING);

        setReportPreviewData({
            income: groupResultsByChurch(incomeResults),
            expenses: { 'all_expenses_group': expenseResults }
        });
    }, []);

    const handleStatementUpload = useCallback(async (content: string, fileName: string, bankId: string, rawFile?: File) => {
        const processKey = `${bankId}-${fileName}`;
        if (processingFilesRef.current.has(processKey)) {
            return;
        }

        processingFilesRef.current.add(processKey);
        setIsLoading(true);

        try {
            // RECARGA SEGURA DE MODELOS
            if (fetchModels) await fetchModels();

            // EXECUÇÃO DO PIPELINE
            const executorResult = await processFileContent(content, fileName, fileModels, customIgnoreKeywords);
            
            // GOVERNANÇA: Bloqueio de Lançamento se não houver modelo ou se o resultado for vazio em arquivo físico
            const transactions = Array.isArray(executorResult?.transactions) ? executorResult.transactions : [];
            
            if (executorResult.status === 'MODEL_REQUIRED' || (transactions.length === 0 && bankId !== 'gmail-sync')) {
                console.log("[Pipeline:GOV] Interrompendo por falta de modelo ou extração vazia.");
                setModelRequiredData({
                    ...executorResult,
                    status: 'MODEL_REQUIRED',
                    fileName,
                    bankId
                });
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
            console.error("[Pipeline:ERROR] Falha crítica no upload:", error);
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
        } catch (e) {
            showToast("Erro ao remover lista.", "error");
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
            showToast("Sistema reiniciado.", "success");
            setActiveView('upload');
        } finally {
            setIsLoading(false);
        }
    }, [clearRemoteList, showToast, setActiveView, setIsLoading]);

    const markAsLaunched = useCallback((txId: string) => {
        setMatchResults(prev => {
            const itemIndex = prev.findIndex(r => r.transaction.id === txId);
            if (itemIndex === -1) return prev;

            const item = prev[itemIndex];
            
            setLaunchedResults(launched => [{ 
                ...item, 
                launchedAt: new Date().toISOString() 
            }, ...launched]);

            const next = prev.filter(r => r.transaction.id !== txId);
            setTimeout(() => regenerateReportPreview(next), 0);
            return next;
        });
    }, [setMatchResults, setLaunchedResults, regenerateReportPreview]);

    const deleteLaunchedItem = useCallback((txId: string) => {
        setLaunchedResults(prev => prev.filter(r => r.transaction.id !== txId));
        showToast("Item removido do histórico de lançados.", "success");
    }, [setLaunchedResults, showToast]);

    return {
        activeBankFiles, contributorFiles, matchResults, reportPreviewData,
        activeReportId, setActiveReportId, hasActiveSession, setHasActiveSession,
        comparisonType, setComparisonType, selectedBankIds,
        manualIdentificationTx, setManualIdentificationTx,
        bulkIdentificationTxs, setBulkIdentificationTxs,
        modelRequiredData, setModelRequiredData,
        launchedResults, setLaunchedResults, markAsLaunched, deleteLaunchedItem,
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
            const allTransactions = activeBankFiles.filter(f => selectedBankIds.includes(f.bankId)).flatMap(f => f.processedTransactions || []);
            
            if (allTransactions.length === 0) { 
                showToast("Sem dados para processar.", "error"); 
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
            regenerateReportPreview(results);
            setHasActiveSession(true);
            setActiveView('reports');
            setIsLoading(false);
            showToast("Processamento concluído!", "success");
        },
        resetReconciliation,
        updateReportData: (updatedRow: MatchResult) => {
            setMatchResults(prev => {
                const next = [...prev];
                const idx = next.findIndex(r => r.transaction.id === updatedRow.transaction.id);
                if (idx !== -1) next[idx] = updatedRow;
                else next.push(updatedRow);
                regenerateReportPreview(next);
                return next;
            });
        },
        revertMatch: (txId: string) => {
            setMatchResults(prev => {
                const next = prev.map(r => r.transaction.id === txId ? { ...r, status: ReconciliationStatus.UNIDENTIFIED, contributor: null, church: PLACEHOLDER_CHURCH } : r);
                regenerateReportPreview(next);
                return next;
            });
        },
        closeManualIdentify: () => { setManualIdentificationTx(null); setBulkIdentificationTxs([]); },
        removeTransaction: (id: string) => {
            setMatchResults(prev => {
                const next = prev.filter(r => r.transaction.id !== id);
                regenerateReportPreview(next);
                return next;
            });
        },
        hydrate,
        setMatchResults,
        setReportPreviewData
    };
};
