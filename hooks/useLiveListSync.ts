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
     * 🛡️ BUILD KEY (ESPELHO DO LAUNCHSERVICE)
     * Garante que a UI e o Banco usem o mesmo DNA para dedupe.
     */
    const buildKey = (tx: any, userId: string) => {
        return LaunchService.computeBaseHash(tx, userId);
    };

    const hydrate = useCallback(async (forceClearUI: boolean = false) => {
        if (!user || isCleaning || isHydrating.current) return;
        
        isHydrating.current = true;
        setSyncError(null);
        
        try {
            if (forceClearUI) {
                setBankStatementFile(() => []);
                setSelectedBankIds(() => []);
            }

            // Busca as pendências reais do banco
            const dbTransactions = await consolidationService.getPendingTransactions(user.id);
            
            if (!dbTransactions || dbTransactions.length === 0) {
                if (forceClearUI) {
                    setBankStatementFile(() => []);
                    setSelectedBankIds(() => []);
                }
                isHydrating.current = false;
                return;
            }

            const groupedByBank: Record<string, Transaction[]> = {};
            dbTransactions.forEach((t: any) => {
                let bankId = t.bank_id;
                if (!bankId && t.pix_key && t.pix_key.includes('-')) {
                    bankId = t.pix_key;
                }
                const finalBankId = bankId || 'virtual';

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
                
                if (!groupedByBank[finalBankId]) groupedByBank[finalBankId] = [];
                groupedByBank[finalBankId].push(tx);
            });

            const restoredFiles = Object.entries(groupedByBank).map(([bankId, txs]) => ({
                bankId,
                fileName: bankId.includes('gmail')
                    ? 'Importação Gmail'
                    : (bankId === 'virtual' ? 'Lista Virtual' : `Lista Viva Sincronizada`),
                processedTransactions: txs,
                isRestored: true
            }));

            // ✅ MERGE COM BLINDAGEM DE DUPLICATAS
            setBankStatementFile((prev: any[]) => {
                const finalMap = new Map<string, any>();
                
                // 1. Preserva o que já está na UI
                if (prev) prev.forEach(f => finalMap.set(f.bankId, f));

                // 2. Funde com o Banco aplicando o Triplet Check
                restoredFiles.forEach(dbFile => {
                    if (finalMap.has(dbFile.bankId)) {
                        const uiFile = finalMap.get(dbFile.bankId);
                        const txMap = new Map<string, Transaction>();

                        // Mapeia usando a chave normalizada
                        uiFile.processedTransactions.forEach((tx: Transaction) => {
                            const key = buildKey(tx, user.id);
                            txMap.set(key, tx);
                        });

                        dbFile.processedTransactions.forEach((tx: Transaction) => {
                            const key = buildKey(tx, user.id);
                            // O banco sempre vence em caso de colisão por ter ID real
                            txMap.set(key, tx);
                        });

                        finalMap.set(dbFile.bankId, {
                            ...uiFile,
                            processedTransactions: Array.from(txMap.values())
                        });
                    } else {
                        finalMap.set(dbFile.bankId, dbFile);
                    }
                });

                return Array.from(finalMap.values());
            });
            
            setSelectedBankIds((prev: string[]) => {
                const availableIds = restoredFiles.map(f => f.bankId);
                return Array.from(new Set([...prev, ...availableIds]));
            });
            
        } catch (err: any) {
            console.error("[Lista Viva] Erro na hidratação:", err);
        } finally {
            isHydrating.current = false;
        }
    }, [user, isCleaning, setBankStatementFile, setSelectedBankIds]);

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
            await hydrate(false);
            return stats;
        } catch (e: any) {
            showToast("Erro no Lançamento: " + (e.message || "Erro de rede."), "error");
            throw e; 
        }
    }, [user, showToast, hydrate]);

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