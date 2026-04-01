import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { MatchResult, ReconciliationStatus, MatchMethod, Transaction, Contributor } from '../../types';
import { PLACEHOLDER_CHURCH, strictNormalize } from '../../services/processingService';
import { consolidationService } from '../../services/ConsolidationService';

interface UseCloudSyncProps {
    user: any;
    effectiveUserId: string;
    matchResults: MatchResult[];
    setMatchResults: (update: (prev: MatchResult[]) => MatchResult[]) => void;
    setHasActiveSession: (has: boolean) => void;
    activeReportId: string | null;
    savedReports: any[];
    churches: any[];
    learnedAssociations: any[];
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export const useCloudSync = ({
    user,
    effectiveUserId,
    matchResults,
    setMatchResults,
    setHasActiveSession,
    activeReportId,
    savedReports,
    churches,
    learnedAssociations,
    showToast
}: UseCloudSyncProps) => {
    const lastCloudSyncRef = useRef<string>('');
    const isHydratingFromCloud = useRef<boolean>(false);
    const needsRetry = useRef<boolean>(false);
    const [triggerSync, setTriggerSync] = useState(0);
    const lastValidatedHash = useRef<string>('');
    const isValidating = useRef<boolean>(false);

    // ☁️ SINCRONIZAÇÃO COM A NUVEM (Trabalho Vivo)
    // Desativado o "blocão" JSON para sessões ativas para favorecer a atomização
    const syncToCloud = useCallback(async (results: MatchResult[]) => {
        // Agora o syncToCloud só deve ser usado para salvar snapshots manuais ou backups raros
        // A sincronização em tempo real agora é feita via deltas nas tabelas individuais
        return;
    }, []);

    // Auto-save desativado em favor da sincronização atômica por registro
    useEffect(() => {
        // O progresso agora é salvo individualmente em cada ação (Identificar/Confirmar)
    }, []);

    // 🔄 HIDRATAÇÃO ATÔMICA (Reconstrói a sessão a partir dos dados individuais)
    useEffect(() => {
        if (!effectiveUserId || activeReportId || !churches.length) return;

        const reconstructSession = async () => {
            // Se já estamos hidratando, marcamos que precisamos de outra rodada ao terminar
            if (isHydratingFromCloud.current) {
                needsRetry.current = true;
                return;
            }

            console.log("[CloudSync:ATOM] Reconstruindo sessão ativa a partir de registros individuais...");
            isHydratingFromCloud.current = true;
            needsRetry.current = false;

            try {
                // 1. Busca as transações que não estão pendentes (já foram tocadas nesta ou em sessões anteriores)
                const { data: txs, error } = await supabase
                    .from('consolidated_transactions')
                    .select('*')
                    .eq('user_id', effectiveUserId)
                    .neq('status', 'pending')
                    .order('transaction_date', { ascending: false })
                    .limit(1000);

                if (error) throw error;
                if (!txs || txs.length === 0) {
                    isHydratingFromCloud.current = false;
                    return;
                }

                // 2. Mapeia para MatchResults usando as associações aprendidas
                const reconstructed: MatchResult[] = txs.map((t: any) => {
                    const normalizedDesc = strictNormalize(t.description);
                    const assoc = (learnedAssociations || []).find((a: any) => a.normalizedDescription === normalizedDesc);
                    const church = churches.find(c => c.id === (assoc?.churchId || (t as any).church_id)) || PLACEHOLDER_CHURCH;

                    const transaction: Transaction = {
                        id: t.id,
                        date: t.transaction_date,
                        description: t.description,
                        rawDescription: t.description,
                        amount: t.amount,
                        bank_id: t.bank_id,
                        isConfirmed: t.is_confirmed
                    };

                    const contributor: Contributor | null = assoc ? {
                        name: assoc.contributorNormalizedName || t.description,
                        amount: t.amount,
                        cleanedName: assoc.contributorNormalizedName || t.description
                    } : null;

                    let status = ReconciliationStatus.UNIDENTIFIED;
                    if (t.status === 'resolved') status = ReconciliationStatus.RESOLVED;
                    else if (t.status === 'identified') status = ReconciliationStatus.IDENTIFIED;

                    return {
                        transaction,
                        contributor,
                        church,
                        status,
                        isConfirmed: t.is_confirmed,
                        matchMethod: assoc ? MatchMethod.LEARNED : MatchMethod.MANUAL,
                        similarity: 100
                    };
                });

                setMatchResults(prev => {
                    const updated = [...prev];
                    let hasChanges = false;

                    reconstructed.forEach(r => {
                        const idx = updated.findIndex(p => p.transaction.id === r.transaction.id);
                        if (idx !== -1) {
                            // Se já existe, atualizamos com o estado da nuvem (que é a verdade absoluta)
                            const hasStatusChange = updated[idx].status !== r.status;
                            const hasConfirmChange = updated[idx].isConfirmed !== r.isConfirmed;
                            const hasChurchChange = (updated[idx].church?.id || 'none') !== (r.church?.id || 'none');

                            if (hasStatusChange || hasConfirmChange || hasChurchChange) {
                                updated[idx] = { ...updated[idx], ...r };
                                hasChanges = true;
                            }
                        } else {
                            // Se não existe na lista local (ex: fantasmas ou itens já processados), adicionamos
                            updated.push(r);
                            hasChanges = true;
                        }
                    });

                    return hasChanges ? updated : prev;
                });

                setHasActiveSession(true);
                if (reconstructed.length > 0) {
                    showToast("Sessão ativa sincronizada.", "success");
                }
            } catch (e) {
                console.error("[CloudSync:ATOM_RECONSTRUCT_FAIL]", e);
            } finally {
                setTimeout(() => { 
                    isHydratingFromCloud.current = false; 
                    if (needsRetry.current) {
                        needsRetry.current = false;
                        setTriggerSync(prev => prev + 1);
                    }
                }, 500);
            }
        };

        reconstructSession();
    }, [effectiveUserId, activeReportId, churches, learnedAssociations, setMatchResults, setHasActiveSession, matchResults.length, showToast, triggerSync]);

    /**
     * 📡 REALTIME SYNC (Atomização)
     * Escuta mudanças individuais em transações e associações aprendidas
     */
    useEffect(() => {
        if (!effectiveUserId) return;
        
        const channel = supabase
            .channel(`reconciliation-atom-sync-${effectiveUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'consolidated_transactions',
                    filter: `user_id=eq.${effectiveUserId}`
                },
                (payload) => {
                    if (payload.new) {
                        const { id, is_confirmed, status } = payload.new;
                        
                        setMatchResults(prev => {
                            const idx = prev.findIndex(r => r.transaction.id === id);
                            if (idx === -1) return prev;
                            
                            const current = prev[idx];
                            if (current.isConfirmed === is_confirmed && current.status === status) return prev;

                            console.log(`[Realtime:ATOM] Atualizando transação ${id}: confirmed=${is_confirmed}, status=${status}`);
                            
                            const updated = [...prev];
                            const statusMap: Record<string, ReconciliationStatus> = {
                                'pending': ReconciliationStatus.UNIDENTIFIED,
                                'identified': ReconciliationStatus.IDENTIFIED,
                                'resolved': ReconciliationStatus.RESOLVED
                            };

                            updated[idx] = {
                                ...current,
                                status: statusMap[status] || current.status,
                                isConfirmed: is_confirmed,
                                transaction: { ...current.transaction, isConfirmed: is_confirmed }
                            };
                            return updated;
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'learned_associations',
                    filter: `user_id=eq.${effectiveUserId}`
                },
                (payload) => {
                    if (payload.new) {
                        const { normalized_description, church_id, contributor_normalized_name } = payload.new;
                        const fullChurch = churches.find((c: any) => c.id === church_id);
                        
                        if (fullChurch) {
                            console.log(`[Realtime:ATOM] Nova associação aprendida: ${normalized_description} -> ${fullChurch.name}`);
                            setMatchResults(prev => {
                                let hasChanges = false;
                                const updated = prev.map(r => {
                                    const desc = strictNormalize(r.transaction.description);
                                    if (desc === normalized_description && (r.church?.id !== church_id)) {
                                        hasChanges = true;
                                        return {
                                            ...r,
                                            church: fullChurch,
                                            contributor: r.contributor || {
                                                name: contributor_normalized_name || r.transaction.description,
                                                amount: r.transaction.amount,
                                                cleanedName: contributor_normalized_name || r.transaction.description
                                            },
                                            status: r.status === ReconciliationStatus.UNIDENTIFIED ? ReconciliationStatus.IDENTIFIED : r.status
                                        };
                                    }
                                    return r;
                                });
                                return hasChanges ? updated : prev;
                            });
                        }
                    }
                }
            )
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [effectiveUserId, churches, setMatchResults]);

    /**
     * 🛡️ INTEGRIDADE DO CACHE (Anti-Stale)
     */
    useEffect(() => {
        if (!effectiveUserId || matchResults.length === 0 || isValidating.current) return;

        const currentIdsHash = matchResults.map(r => r.transaction.id).sort().join(',');
        if (currentIdsHash === lastValidatedHash.current) return;

        const cleanStaleCache = async () => {
            isValidating.current = true;
            
            const realIds = matchResults
                .map(r => r.transaction.id)
                .filter(id => /^[0-9a-fA-F-]{36}$/.test(id));
            
            if (realIds.length === 0) {
                lastValidatedHash.current = currentIdsHash;
                isValidating.current = false;
                return;
            }

            try {
                const confirmedIds = await consolidationService.checkConfirmedTransactions(effectiveUserId, realIds);
                
                if (confirmedIds.length > 0) {
                    setMatchResults(prev => {
                        let hasChanges = false;
                        const updated = prev.map(r => {
                            if (confirmedIds.includes(r.transaction.id) && !r.isConfirmed) {
                                hasChanges = true;
                                return { 
                                    ...r, 
                                    isConfirmed: true, 
                                    transaction: { ...r.transaction, isConfirmed: true } 
                                };
                            }
                            return r;
                        });
                        
                        if (!hasChanges) return prev;
                        
                        lastValidatedHash.current = updated.map(r => r.transaction.id).sort().join(',');
                        return updated;
                    });
                } else {
                    lastValidatedHash.current = currentIdsHash;
                }
            } catch (e) {
                console.error("[CacheSync] Erro ao validar integridade do cache:", e);
            } finally {
                isValidating.current = false;
            }
        };

        const timer = setTimeout(cleanStaleCache, 500);
        return () => clearTimeout(timer);
    }, [effectiveUserId, matchResults, setMatchResults, triggerSync]);

    return {
        syncToCloud,
        isHydratingFromCloud
    };
};
