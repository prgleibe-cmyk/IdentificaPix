
import { useEffect, useCallback, useRef } from 'react';
import { Transaction } from '../types';
import { consolidationService } from '../services/ConsolidationService';

interface UseLiveListSyncProps {
    user: any;
    setBankStatementFile: (fn: (prev: any[]) => any[]) => void;
    setSelectedBankIds: (fn: (prev: string[]) => string[]) => void;
    showToast?: (msg: string, type: 'success' | 'error') => void;
}

export const useLiveListSync = ({
    user,
    setBankStatementFile,
    setSelectedBankIds,
    showToast
}: UseLiveListSyncProps) => {
    const isHydrated = useRef(false);

    // --- HIDRATAÇÃO: Recupera do DB ao iniciar ---
    useEffect(() => {
        if (!user || isHydrated.current) return;

        const hydrate = async () => {
            try {
                const dbTransactions = await consolidationService.getPendingTransactions(user.id);
                if (!dbTransactions || dbTransactions.length === 0) {
                    isHydrated.current = true;
                    return;
                }

                const groupedByBank: Record<string, Transaction[]> = {};
                dbTransactions.forEach((t: any) => {
                    const bankId = t.bank_id || 'unknown';
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
                    content: '',
                    fileName: `Lista Viva (Recuperada)`,
                    rawFile: undefined,
                    processedTransactions: txs,
                    isRestored: true
                }));

                setBankStatementFile(() => restoredFiles);
                setSelectedBankIds(() => restoredFiles.map(f => f.bankId));
                isHydrated.current = true;
                console.log(`[Lista Viva] ${dbTransactions.length} transações restauradas.`);
            } catch (err) {
                console.error("Erro na hidratação da Lista Viva:", err);
            }
        };

        hydrate();
    }, [user, setBankStatementFile, setSelectedBankIds]);

    // --- PERSISTÊNCIA: Helper para salvar novas transações ---
    const persistTransactions = useCallback(async (bankId: string, transactions: Transaction[]) => {
        if (!user || transactions.length === 0) return;
        try {
            const data = transactions.map(t => ({
                transaction_date: t.date,
                amount: t.amount,
                description: t.description,
                type: (t.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
                pix_key: null,
                source: 'file' as 'file',
                user_id: user.id,
                bank_id: bankId
            }));
            await consolidationService.addTransactions(data);
        } catch (e) {
            console.warn("[Lista Viva] Falha na sincronização remota (Offline mode)", e);
        }
    }, [user]);

    const clearRemoteList = useCallback(async (bankId?: string) => {
        if (!user) return;
        try {
            await consolidationService.deletePendingTransactions(user.id, bankId);
        } catch (e) {
            console.error("[Lista Viva] Erro ao limpar banco remoto:", e);
        }
    }, [user]);

    return { persistTransactions, clearRemoteList };
};
