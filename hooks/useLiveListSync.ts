
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

    /**
     * Recupera os dados da Lista Viva do servidor.
     * Mantém o estado local em caso de erro transitório de rede.
     */
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
                // Preserva seleção ativa se os bancos ainda existem na lista restaurada
                return Array.from(new Set([...prev.filter(id => ids.includes(id)), ...ids]));
            });
            
        } catch (err: any) {
            console.error("[Lista Viva] Erro crítico de hidratação:", err);
            const msg = err.message || "Erro desconhecido na sincronização.";
            setSyncError(msg);
            
            // Se for erro de esquema, avisa o usuário com toast persistente
            if (msg.includes('ERRO_COLUNA_AUSENTE')) {
                showToast("Banco de dados desatualizado. Acesse o Admin e execute o Diagnóstico.", "error");
            } else {
                showToast("Falha ao recuperar Lista Viva: " + msg, "error");
            }
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
            await hydrate();
            return stats;
        } catch (e: any) {
            // O erro já foi logado no LaunchService
            showToast("Erro no Lançamento: " + (e.message || "Erro de rede."), "error");
            throw e; 
        }
    }, [user, hydrate, showToast]);

    const clearRemoteList = useCallback(async (bankId?: string) => {
        if (!user) return;
        setIsCleaning(true);
        try {
            if (bankId && bankId !== 'all') {
                setBankStatementFile((prev: any[]) => prev.filter(f => f.bankId !== bankId));
                setSelectedBankIds((prev: string[]) => prev.filter(id => id !== bankId));
            } else {
                setBankStatementFile(() => []);
                setSelectedBankIds(() => []);
            }

            await consolidationService.deletePendingTransactions(user.id, bankId);
        } finally {
            setIsCleaning(false);
            await hydrate(false);
        }
    }, [user, setBankStatementFile, setSelectedBankIds, hydrate]);

    return { persistTransactions, clearRemoteList, hydrate, syncError };
};
