import { useCallback, useRef } from 'react';
import { Transaction, ContributorFile } from '../../types';
import { processFileContent, parseContributors } from '../../services/processingService';

interface UseFileProcessorProps {
    user: any;
    banks: any[];
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
    banks,
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
            const bank = banks?.find(b => b.id === bankId);
            const executorResult = await processFileContent(content, fileName, [], base64, bank);
            const transactions = Array.isArray(executorResult?.transactions) ? executorResult.transactions : [];
            
            const isSicoobBypass = executorResult.strategyName === 'Sicoob Bypass Validation';

            if (!isSicoobBypass) {
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
            }

            if (isSicoobBypass) {
                showToast("Bypass Sicoob validado com sucesso!", "success");
            } else {
                const stats = await persistTransactions(bankId, transactions);
                showToast(stats.added === 0 ? "Lista Sincronizada." : `Sucesso! Total: ${stats.total}`, "success");
            }
            await hydrate();
            
        } catch (error: any) {
            showToast(error.message || "Erro no processamento do arquivo.", "error");
        } finally {
            processingFilesRef.current.delete(processKey);
            setIsLoading(false);
        }
    }, [persistTransactions, showToast, hydrate, setIsLoading, setModelRequiredData, banks]);

    const importGmailTransactions = useCallback(async (transactions: Transaction[]) => {
        if (!user || transactions.length === 0) return;
        const gmailKey = `gmail-sync-active`;
        if (processingFilesRef.current.has(gmailKey)) return;
        
        processingFilesRef.current.add(gmailKey);
        setIsLoading(true);
        try {
            const result = {
                source: 'virtual',
                transactions: transactions || [],
                status: 'SUCCESS',
                fileName: 'Gmail',
                strategyUsed: 'Virtual Injection'
            };
            const stats = await persistTransactions('gmail-sync', result.transactions);
            showToast(`Gmail sincronizado! Total: ${stats.total}`, "success");
            await hydrate();
        } finally {
            processingFilesRef.current.delete(gmailKey);
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

    const handleContributorsUpload = useCallback((content: string, fileName: string, churchId: string) => {
        const church = churches.find((c: any) => c.id === churchId);
        const contributors = parseContributors(content, contributionKeywords);
        setContributorFiles(prev => [...prev.filter(f => f.churchId !== churchId), { church, churchId, contributors, fileName }]);
        showToast(`Lista carregada (${contributors.length} nomes).`, "success");
    }, [churches, contributionKeywords, setContributorFiles, showToast]);

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
