
import { useState, useCallback } from 'react';
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

export const useReconciliation = ({
    user,
    churches,
    banks,
    fileModels,
    similarityLevel,
    dayTolerance,
    customIgnoreKeywords,
    contributionKeywords,
    learnedAssociations,
    showToast,
    setIsLoading,
    setActiveView
}: any) => {

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
        // Removido setIsLoading local para não conflitar com o do componente que chama
        try {
            const result = await processFileContent(content, fileName, fileModels, customIgnoreKeywords);
            const stats = await persistTransactions(bankId, result.transactions);
            const feedback = `Recebidos: ${stats.total} | Novos: ${stats.added} | Ignorados: ${stats.skipped}`;

            if (stats.added === 0) {
                showToast(`Nenhuma linha nova detectada.\n${feedback}`, "error");
            } else {
                showToast(`Sucesso! ${feedback}`, "success");
            }
        } catch (error) {
            console.error("[Reconciliation] Upload Fail:", error);
            showToast("Erro no processamento.", "error");
        }
    }, [fileModels, customIgnoreKeywords, persistTransactions, showToast]);

    const importGmailTransactions = useCallback(async (transactions: Transaction[]) => {
        if (!user || transactions.length === 0) return;
        setIsLoading(true);
        try {
            const result = await IngestionOrchestrator.processVirtualData('Gmail', transactions, customIgnoreKeywords);
            const stats = await persistTransactions('gmail-sync', result.transactions);
            const feedback = `Recebidos: ${stats.total} | Novos: ${stats.added} | Ignorados: ${stats.skipped}`;
            if (stats.added === 0) showToast(`Gmail: Sem novos dados.\n${feedback}`, "success");
            else showToast(`Gmail sincronizado! ${feedback}`, "success");
        } finally {
            setIsLoading(false);
        }
    }, [user, customIgnoreKeywords, persistTransactions, showToast, setIsLoading]);

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

    return {
        activeBankFiles, contributorFiles, matchResults, reportPreviewData,
        activeReportId, setActiveReportId, hasActiveSession, setHasActiveSession,
        comparisonType, setComparisonType, selectedBankIds,
        manualIdentificationTx, setManualIdentificationTx,
        bulkIdentificationTxs, setBulkIdentificationTxs,
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
            if (allTransactions.length === 0) { showToast("Sem dados para comparar.", "error"); setIsLoading(false); return; }
            const results = matchTransactions(allTransactions, contributorFiles, { similarityThreshold: similarityLevel, dayTolerance: dayTolerance }, learnedAssociations, churches, customIgnoreKeywords);
            setMatchResults(results);
            regenerateReportPreview(results);
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
        }
    };
};
