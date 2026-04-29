import { useEffect, useCallback, useRef, useState } from 'react';
import { Transaction } from '../types';
import { consolidationService } from '../services/ConsolidationService';
import { LaunchService } from '../services/LaunchService';
import { useUI } from '../contexts/UIContext';
import { supabase } from '../services/supabaseClient';

export const useLiveListSync = ({
    user,
    subscription,
    setBankStatementFile,
    setSelectedBankIds,
    activeBankFiles
}: any) => {
    const { showToast } = useUI();
    const isHydrating = useRef(false);
    const lastUserId = useRef<string | null>(null);
    const [isCleaning, setIsCleaning] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    const pendingHydrate = useRef(false);

    /**
     * 🛡️ HYDRATE (O FUNIL DE SAÍDA PARA A UI)
     * Garante que a UI só exiba o que está validado no banco de dados.
     */
    const hydrate = useCallback(async (forceClearUI: boolean = false) => {
        const effectiveUserId = subscription?.ownerId || user?.owner_id || user?.id;
        if (!effectiveUserId || isCleaning) return;
        
        if (isHydrating.current) {
            pendingHydrate.current = true;
            return;
        }
        
        isHydrating.current = true;
        pendingHydrate.current = false;
        setSyncError(null);
        
        try {
            const dbTransactions = await consolidationService.getPendingTransactions(effectiveUserId);
            
            // 🛡️ BLOCK_REGRESSION: Mapeia timestamps locais atuais
            const currentTimestamps = new Map<string, number>();
            (activeBankFiles || []).forEach((file: any) => {
                (file.processedTransactions || []).forEach((tx: any) => {
                    if (tx.id && tx.updatedAt) {
                        currentTimestamps.set(tx.id, new Date(tx.updatedAt).getTime());
                    }
                });
            });

            // AJUSTE CIRÚRGICO: Remover rigorosamente qualquer linha com valor 0,00 (independente da descrição)
            const filteredDbTransactions = (dbTransactions || []).filter((t: any) => {
                const amount = Math.abs(Number(t.amount || 0));
                if (amount < 0.01) return false;

                // 🛡️ Verificação de Regressão
                const incomingTs = t.updated_at ? new Date(t.updated_at).getTime() : 0;
                const currentTs = currentTimestamps.get(t.id) || 0;

                if (incomingTs < currentTs) {
                    console.log('[BLOCK_REGRESSION:HYDRATE] Evitando sobrescrita por dado antigo do banco para:', t.id);
                    // Nota: Se ignorarmos aqui, a transação sumiria da "Lista Viva" se for um refresh total.
                    // Para evitar sumiço, deveríamos manter a versão local no processamento.
                }
                return true;
            });

            if (!filteredDbTransactions || filteredDbTransactions.length === 0) {
                setBankStatementFile([]);
                if (forceClearUI) setSelectedBankIds([]);
                return;
            }

            const groupedByBank: Record<string, Transaction[]> = {};
            filteredDbTransactions.forEach((t: any) => {
                let bankId = t.bank_id;
                if (!bankId && t.pix_key && t.pix_key.includes('-')) {
                    bankId = t.pix_key;
                }
                const finalBankId = bankId || 'virtual';

                // Verificamos se usamos a versão do banco ou a local (mais recente)
                const currentTs = currentTimestamps.get(t.id) || 0;
                const incomingTs = t.updated_at ? new Date(t.updated_at).getTime() : 0;

                let tx: Transaction;

                if (currentTs > incomingTs) {
                    // Recupera a versão local da transação que está no activeBankFiles
                    const localTx = (activeBankFiles || [])
                        .flatMap((f: any) => f.processedTransactions || [])
                        .find((tx: any) => tx.id === t.id);
                    
                    tx = localTx || {
                        id: t.id,
                        date: t.transaction_date,
                        description: t.description,
                        rawDescription: t.description,
                        amount: t.amount,
                        originalAmount: String(t.amount.toFixed(2)),
                        contributionType: t.type === 'income' ? 'ENTRADA' : 'SAÍDA',
                        paymentMethod: t.pix_key || 'OUTROS',
                        cleanedDescription: t.description,
                        bank_id: t.bank_id,
                        isConfirmed: !!t.is_confirmed,
                        updatedAt: t.updated_at
                    };
                } else {
                    tx = {
                        id: t.id,
                        date: t.transaction_date,
                        description: t.description,
                        rawDescription: t.description,
                        amount: t.amount,
                        originalAmount: String(t.amount.toFixed(2)),
                        contributionType: t.type === 'income' ? 'ENTRADA' : 'SAÍDA',
                        paymentMethod: t.pix_key || 'OUTROS',
                        cleanedDescription: t.description,
                        bank_id: t.bank_id,
                        isConfirmed: !!t.is_confirmed,
                        updatedAt: t.updated_at
                    };
                }
                
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

            setBankStatementFile(restoredFiles);
            
            if (forceClearUI) {
                setSelectedBankIds(restoredFiles.map(f => f.bankId));
            } else {
                setSelectedBankIds((prev: string[]) => {
                    const availableIds = restoredFiles.map(f => f.bankId);
                    return prev.filter(id => availableIds.includes(id));
                });
            }
            
        } catch (err: any) {
            console.error("[Lista Viva] Erro na sincronização da UI:", err);
            setSyncError("Falha ao sincronizar dados.");
        } finally {
            isHydrating.current = false;
            if (pendingHydrate.current) {
                pendingHydrate.current = false;
                hydrate(forceClearUI);
            }
        }
    }, [user, subscription, isCleaning, setBankStatementFile, setSelectedBankIds]);

    /**
     * 📡 REALTIME SYNC (ESCUTA MULTI-SESSÃO)
     */
    useEffect(() => {
        const ownerId = subscription?.ownerId || user?.owner_id || user?.id;
        if (!ownerId) return;

        const channel = supabase
            .channel(`realtime-viva-${ownerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'consolidated_transactions',
                    filter: `user_id=eq.${ownerId}`
                },
                () => {
                    hydrate(false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, subscription?.ownerId, subscription?.role, hydrate]);

    useEffect(() => {
        const effectiveUserId = subscription?.ownerId || user?.owner_id || user?.id;
        if (effectiveUserId && effectiveUserId !== lastUserId.current) {
            lastUserId.current = effectiveUserId;
            hydrate(true);
        }
    }, [user, subscription, hydrate]);

    /**
     * 📥 PERSIST (O FUNIL DE ENTRADA)
     */
    const persistTransactions = useCallback(async (bankId: string, transactions: Transaction[]) => {
        const effectiveUserId = subscription?.ownerId || user?.owner_id || user?.id;
        if (!effectiveUserId) return { added: 0, skipped: 0, total: transactions.length };
        
        try {
            const stats = await LaunchService.launchToBank(effectiveUserId, bankId, transactions);
            await hydrate(false);
            return stats;
        } catch (e: any) {
            showToast("Erro no Lançamento: " + (e.message || "Erro de rede."), "error");
            throw e; 
        }
    }, [user, subscription, showToast, hydrate]);

    const clearRemoteList = useCallback(async (bankId?: string) => {
        const effectiveUserId = subscription?.ownerId || user?.owner_id || user?.id;
        if (!effectiveUserId) return;
        setIsCleaning(true);
        try {
            await consolidationService.deletePendingTransactions(effectiveUserId, bankId);
        } finally {
            setIsCleaning(false);
            await hydrate(false);
        }
    }, [user, subscription, hydrate]);

    return { persistTransactions, clearRemoteList, hydrate, syncError };
};