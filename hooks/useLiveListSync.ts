
import { useEffect, useCallback, useRef, useState } from 'react';
import { Transaction } from '../types';
import { consolidationService } from '../services/ConsolidationService';
import { LaunchService } from '../services/LaunchService';
import { useUI } from '../contexts/UIContext';

export const useLiveListSync = ({
    user,
    setBankStatementFile,
    setSelectedBankIds
}: any) => {
    const { showToast } = useUI();
    const isHydrating = useRef(false);
    const lastUserId = useRef<string | null>(null);
    const [isCleaning, setIsCleaning] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    const hydrate = useCallback(async (forceClearUI: boolean = false) => {
        if (!user || isCleaning) return;
        
        isHydrating.current = true;
        setSyncError(null);
        
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
                const bankId = t.bank_id || 'virtual';
                const tx: Transaction = {
                    id: t.id,
                    date: t.transaction_date,
                    description: t.description,
                    rawDescription: t.description,
                    amount: t.amount,
                    originalAmount: String(t.amount.toFixed(2)),
                    contributionType: t.type === 'income' ? 'ENTRADA' : 'SAÍDA',
                    paymentMethod: t.pix_key || 'OUTROS',
                    cleanedDescription: t.description,
                    bank_id: t.bank_id
                };
                if (!groupedByBank[bankId]) groupedByBank[bankId] = [];
                groupedByBank[bankId].push(tx);
            });

            const restoredFiles = Object.entries(groupedByBank).map(([bankId, txs]) => ({
                bankId,
                fileName: bankId === 'gmail-sync' ? 'Sincronização Gmail' : (bankId === 'virtual' ? 'Lista Virtual' : `Lista Viva (Sincronizada)`),
                processedTransactions: txs,
                isRestored: true
            }));

            setBankStatementFile(restoredFiles);
            
            // Sincroniza a seleção automaticamente com o que veio do banco
            setSelectedBankIds((prev: string[]) => {
                const availableIds = restoredFiles.map(f => f.bankId);
                return Array.from(new Set([...prev.filter(id => availableIds.includes(id)), ...availableIds]));
            });
            
        } catch (err: any) {
            console.error("[Lista Viva] Erro na hidratação:", err);
            showToast("Falha ao sincronizar Lista Viva.", "error");
        } finally {
            isHydrating.current = false;
        }
    }, [user, setBankStatementFile, setSelectedBankIds, isCleaning, showToast]);

    useEffect(() => {
        if (user?.id && user.id !== lastUserId.current) {
            lastUserId.current = user.id;
            hydrate(true);
        }
    }, [user, hydrate]);

    const persistTransactions = useCallback(async (bankId: string, transactions: Transaction[]) => {
        if (!user) return { added: 0, skipped: 0, total: transactions.length };
        
        try {
            const stats = await LaunchService.launchToBank(user.id, bankId, transactions);
            return stats;
        } catch (e: any) {
            showToast("Erro no Lançamento: " + (e.message || "Erro de rede."), "error");
            throw e; 
        }
    }, [user, showToast]);

    const clearRemoteList = useCallback(async (bankId?: string) => {
        if (!user) return;
        setIsCleaning(true);
        try {
            await consolidationService.deletePendingTransactions(user.id, bankId);
            if (bankId && bankId !== 'all') {
                setBankStatementFile((prev: any[]) => prev.filter(f => f.bankId !== bankId));
                setSelectedBankIds((prev: string[]) => prev.filter(id => id !== bankId));
            } else {
                setBankStatementFile([]);
                setSelectedBankIds([]);
            }
        } finally {
            setIsCleaning(false);
            await hydrate(false);
        }
    }, [user, setBankStatementFile, setSelectedBankIds, hydrate]);

    return { persistTransactions, clearRemoteList, hydrate, syncError };
};
