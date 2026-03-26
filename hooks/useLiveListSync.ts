import { useEffect, useCallback, useRef, useState } from 'react';
import { Transaction } from '../types';
import { consolidationService } from '../services/ConsolidationService';
import { LaunchService } from '../services/LaunchService';
import { useUI } from '../contexts/UIContext';
import { supabase } from '../services/supabaseClient';

export const useLiveListSync = ({
    user,
    session,
    subscription,
    setBankStatementFile,
    setSelectedBankIds
}: any) => {
    const { showToast } = useUI();
    const isHydrating = useRef(false);
    const [vivaHydrated, setVivaHydrated] = useState(false);
    const lastUserId = useRef<string | null>(null);
    const [isCleaning, setIsCleaning] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    /**
     * 🛡️ HYDRATE (O FUNIL DE SAÍDA PARA A UI)
     * Garante que a UI só exiba o que está validado no banco de dados.
     */
    const hydrate = useCallback(async (forceClearUI: boolean = false) => {
        if (!user || isCleaning || isHydrating.current) return;
        
        isHydrating.current = true;
        setSyncError(null);
        
        try {
            const ownerId = subscription?.ownerId || user.id;
            const isMember = subscription?.role === 'member';
            
            let dbTransactions: any[] = [];
            
            if (!isMember) {
                dbTransactions = await consolidationService.getPendingTransactions(user.id);
            } else {
                // Para membros, usamos a API do backend que ignora RLS (via Service Role)
                const token = session?.access_token;
                if (!token) {
                    setVivaHydrated(true);
                    isHydrating.current = false;
                    return;
                }

                const response = await fetch(`/api/reference/pending/${ownerId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    dbTransactions = await response.json();
                } else {
                    console.error("[Lista Viva] Erro API Backend:", response.status);
                    // Fallback para Supabase se a API falhar (provavelmente retornará vazio por RLS)
                    dbTransactions = await consolidationService.getPendingTransactions(user.id);
                }
            }
            
            if (!dbTransactions || dbTransactions.length === 0) {
                setBankStatementFile([]);
                if (forceClearUI) setSelectedBankIds([]);
                setVivaHydrated(true);
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
                    bank_id: t.bank_id,
                    // Fix: isConfirmed is now a valid property of Transaction
                    isConfirmed: !!t.is_confirmed
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

            setBankStatementFile(restoredFiles);
            
            if (forceClearUI) {
                setSelectedBankIds(restoredFiles.map(f => f.bankId));
            } else {
                setSelectedBankIds((prev: string[]) => {
                    const availableIds = restoredFiles.map(f => f.bankId);
                    return prev.filter(id => availableIds.includes(id));
                });
            }
            
            setVivaHydrated(true);
        } catch (err: any) {
            console.error("[Lista Viva] Erro na sincronização da UI:", err);
            setSyncError("Falha ao sincronizar dados.");
            setVivaHydrated(true);
        } finally {
            isHydrating.current = false;
        }
    }, [user?.id, isCleaning, setBankStatementFile, setSelectedBankIds]);

    /**
     * 📡 REALTIME SYNC (ESCUTA MULTI-SESSÃO)
     */
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`realtime-viva-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'consolidated_transactions',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    hydrate(false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, hydrate]);

    useEffect(() => {
        if (!user) {
            setVivaHydrated(true);
            setBankStatementFile([]);
        } else {
            setVivaHydrated(false);
            setBankStatementFile([]);
        }
    }, [user, setBankStatementFile]);

    useEffect(() => {
        if (user?.id && user.id !== lastUserId.current) {
            lastUserId.current = user.id;
            hydrate(true);
        }
    }, [user?.id, hydrate]);

    /**
     * 📥 PERSIST (O FUNIL DE ENTRADA)
     */
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
        } finally {
            setIsCleaning(false);
            await hydrate(false);
        }
    }, [user, hydrate]);

    return { persistTransactions, clearRemoteList, hydrate, syncError, isHydrated: vivaHydrated };
};