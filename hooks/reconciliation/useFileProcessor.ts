import { useCallback, useRef } from 'react';
import { Transaction, ContributorFile } from '../../types';
import { processFileContent, parseContributors } from '../../services/processingService';
import { IngestionOrchestrator } from '../../core/engine/IngestionOrchestrator';

interface UseFileProcessorProps {
    user: any;
    fileModels: any[];
    fetchModels: () => Promise<void>;
    customIgnoreKeywords: string[];
    contributionKeywords: string[];
    persistTransactions: (bankId: string, transactions: Transaction[]) => Promise<any>;
    showToast: (msg: string, type: 'success' | 'error') => void;
    hydrate: () => Promise<void>;
    setIsLoading: (loading: boolean) => void;
    clearRemoteList: (bankId: string) => Promise<void>;
    churches: any[];
    setContributorFiles: (update: (prev: ContributorFile[]) => ContributorFile[]) => void;
    setModelRequiredData: (data: any) => void;
    setSelectedBankIds: (update: (prev: string[]) => string[]) => void;
}

export const useFileProcessor = ({
    user,
    fileModels,
    fetchModels,
    customIgnoreKeywords,
    contributionKeywords,
    persistTransactions,
    showToast,
    hydrate,
    setIsLoading,
    clearRemoteList,
    churches,
    setContributorFiles,
    setModelRequiredData,
    setSelectedBankIds
}: UseFileProcessorProps) => {
    const processingFilesRef = useRef<Set<string>>(new Set());

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
    }, [fileModels, fetchModels, customIgnoreKeywords, persistTransactions, showToast, hydrate, setIsLoading, setModelRequiredData]);

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

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string) => {
        const church = churches.find((c: any) => c.id === churchId);
        const contributors = parseContributors(content, customIgnoreKeywords, contributionKeywords);
        setContributorFiles(prev => [...prev.filter(f => f.churchId !== churchId), { church, churchId, contributors, fileName }]);
        showToast(`Lista carregada (${contributors.length} nomes).`, "success");
    }, [churches, customIgnoreKeywords, contributionKeywords, setContributorFiles, showToast]);

    const removeContributorFile = useCallback((churchId: string) => {
        setContributorFiles(prev => prev.filter(f => f.churchId !== churchId));
    }, [setContributorFiles]);

    const toggleBankSelection = useCallback((id: string) => {
        setSelectedBankIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }, [setSelectedBankIds]);

    return {
        handleStatementUpload,
        importGmailTransactions,
        removeBankStatementFile,
        handleContributorsUpload,
        removeContributorFile,
        toggleBankSelection
    };
};
