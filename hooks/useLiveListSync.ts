
import { useEffect, useCallback, useRef, useState } from 'react';
import { Transaction } from '../types';
import { consolidationService } from '../services/ConsolidationService';
import { LaunchService } from '../services/LaunchService';

export const useLiveListSync = ({
    user,
    setBankStatementFile,
    setSelectedBankIds,
    showToast
}: any) => {
    const isHydrating = useRef(false);
    const lastUserId = useRef<string | null>(null);
    const [isCleaning, setIsCleaning] = useState(false);

    const hydrate = useCallback(async (forceClearUI: boolean = false) => {
        if (!user || isCleaning) return;
        
        // Permite que chamadas sequenciais ocorram, evitando o travamento da UI 
        // caso o estado isHydrating fique "preso"
        isHydrating.current = true;
        
        try {
            if (forceClearUI) {
                setBankStatementFile(() => []);
                setSelectedBankIds(() => []);
            }

            const dbTransactions = await consolidationService.getPendingTransactions(user.id);
            
            if (!dbTransactions || dbTransactions.length === 0) {
                setBankStatementFile(() => []);
                setSelectedBankIds(() => []);
                return;
            }

            const groupedByBank: Record<string, Transaction[]> = {};
            dbTransactions.forEach((t: any) => {
                const bankId = t.bank_id || 'gmail-sync';
                const tx: Transaction = {
                    id: t.id,
                    date: t.transaction_date,
                    description: t.description,
                    rawDescription: t.description,
                    amount: t.amount,
                    originalAmount: String(t.amount.toFixed(2)),
                    contributionType: t.type === 'income' ? 'ENTRADA' : 'SAÍDA',
                    cleanedDescription: t.description
                };
                if (!groupedByBank[bankId]) groupedByBank[bankId] = [];
                groupedByBank[bankId].push(tx);
            });

            const restoredFiles = Object.entries(groupedByBank).map(([bankId, txs]) => ({
                bankId,
                fileName: bankId === 'gmail-sync' ? 'Sincronização Gmail' : `Lista Viva (Sincronizada)`,
                processedTransactions: txs,
                isRestored: true
            }));

            setBankStatementFile(() => restoredFiles);
            setSelectedBankIds((prev: string[]) => {
                const ids = restoredFiles.map(f => f.bankId);
                return Array.from(new Set([...prev.filter(id => ids.includes(id)), ...ids]));
            });
            
        } catch (err) {
            console.error("[Lista Viva] Falha na hidratação:", err);
        } finally {
            isHydrating.current = false;
        }
    }, [user, setBankStatementFile, setSelectedBankIds, isCleaning]);

    useEffect(() => {
        if (user?.id && user.id !== lastUserId.current) {
            lastUserId.current = user.id;
            hydrate();
        }
    }, [user, hydrate]);

    const persistTransactions = useCallback(async (bankId: string, transactions: Transaction[]) => {
        if (!user) return { added: 0, skipped: 0, total: transactions.length };
        const stats = await LaunchService.launchToBank(user.id, bankId, transactions);
        // Pequena espera para garantir que o banco persistiu antes de ler de volta
        await new Promise(resolve => setTimeout(resolve, 500));
        await hydrate();
        return stats;
    }, [user, hydrate]);

    const clearRemoteList = useCallback(async (bankId?: string) => {
        if (!user) return;
        setIsCleaning(true);
        try {
            setBankStatementFile(() => []);
            setSelectedBankIds(() => []);
            await consolidationService.deletePendingTransactions(user.id, bankId);
            console.log("[Lista Viva] Banco limpo com sucesso.");
        } finally {
            setIsCleaning(false);
            await hydrate(true);
        }
    }, [user, setBankStatementFile, setSelectedBankIds, hydrate]);

    return { persistTransactions, clearRemoteList, hydrate };
};
