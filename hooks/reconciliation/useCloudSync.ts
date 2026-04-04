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

    // 🚀 CONTROLE DE PRONTIDÃO PARA HIDRATAÇÃO
    const isReady = !!effectiveUserId && churches.length > 0 && learnedAssociations.length > 0;

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
        if (!isReady || activeReportId) return;

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
                // 1. Busca as transações que não estão pendentes (últimos 30 dias)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const dateThreshold = thirtyDaysAgo.toISOString().split('T')[0];

                const { data: txs, error } = await supabase
                    .from('consolidated_transactions')
                    .select('*')
                    .eq('user_id', effectiveUserId)
                    .neq('status', 'pending')
                    .gte('transaction_date', dateThreshold)
                    .order('transaction_date', { ascending: false });

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
                        id: t.contributor_id || undefined,
                        name: assoc.contributorNormalizedName || t.description,
                        amount: t.amount,
                        cleanedName: assoc.contributorNormalizedName || t.description
                    } : (t.contributor_id ? {
                        id: t.contributor_id,
                        name: t.description,
                        amount: t.amount
                    } : null);

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
                        similarity: 100,
                        updatedAt: t.updated_at
                    };
                });

                setMatchResults(prev => {
                    const updated = [...prev];
                    let hasChanges = false;

                    reconstructed.forEach(r => {
                        const idx = updated.findIndex(p => p.transaction.id === r.transaction.id);
                        if (idx !== -1) {
                            const local = updated[idx];
                            
                            // 🛡️ REGRAS DE MERGE (Prioridade ao dado mais recente/forte)
                            
                            // 1. Se o local está confirmado/resolvido e o banco não, 
                            // e o banco não é explicitamente mais novo, mantemos o local.
                            const localIsStrong = local.isConfirmed || local.status === ReconciliationStatus.RESOLVED;
                            const cloudIsWeak = !r.isConfirmed && r.status !== ReconciliationStatus.RESOLVED;
                            
                            if (localIsStrong && cloudIsWeak) {
                                if (!r.updatedAt || !local.updatedAt || new Date(r.updatedAt) <= new Date(local.updatedAt)) {
                                    // Ignora dado fraco do banco se o local for forte e mais novo/igual
                                    return;
                                }
                            }

                            // 2. Comparação direta de timestamps se ambos existirem
                            if (local.updatedAt && r.updatedAt) {
                                const localTime = new Date(local.updatedAt).getTime();
                                const cloudTime = new Date(r.updatedAt).getTime();
                                if (localTime >= cloudTime) return; // Local é mais novo ou igual
                            }

                            // Se chegou aqui, o dado da nuvem é considerado mais novo ou o local é fraco
                            const hasStatusChange = local.status !== r.status;
                            const hasConfirmChange = local.isConfirmed !== r.isConfirmed;
                            const hasChurchChange = (local.church?.id || 'none') !== (r.church?.id || 'none');
                            const hasContributorChange = local.contributor?.id !== r.contributor?.id || local.contributor?.name !== r.contributor?.name;

                            if (hasStatusChange || hasConfirmChange || hasChurchChange || hasContributorChange) {
                                updated[idx] = { ...local, ...r };
                                hasChanges = true;
                            }
                        } else {
                            // adicionar novo item vindo da nuvem
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
    }, [isReady, effectiveUserId, activeReportId, churches, learnedAssociations, setMatchResults, setHasActiveSession, matchResults.length, showToast, triggerSync]);

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
                    event: '*',
                    schema: 'public',
                    table: 'consolidated_transactions',
                    filter: `user_id=eq.${effectiveUserId}`
                },
                (payload) => {
                    // DELETE
                    if (payload.eventType === 'DELETE') {
                        const deletedId = payload.old?.id;
                        if (deletedId) {
                            setMatchResults(prev => prev.filter(r => r.transaction.id !== deletedId));
                        }
                        return;
                    }

                    if (payload.new) {
                        const { id, is_confirmed, status, church_id, contributor_id, bank_id, updated_at } = payload.new;
                        
                        setMatchResults(prev => {
                            const idx = prev.findIndex(r => r.transaction.id === id);
                            
                            // 🛡️ ADIÇÃO AUTOMÁTICA: Se o item não existe localmente, criamos e adicionamos.
                            // Isso garante a sincronização em tempo real entre dispositivos.
                            if (idx === -1) {
                                if (status === 'pending') return prev;

                                const t = payload.new;
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
                                    isConfirmed: !!t.is_confirmed
                                };

                                const contributor: Contributor | null = assoc ? {
                                    id: t.contributor_id || undefined,
                                    name: assoc.contributorNormalizedName || t.description,
                                    amount: t.amount,
                                    cleanedName: assoc.contributorNormalizedName || t.description
                                } : (t.contributor_id ? {
                                    id: t.contributor_id,
                                    name: t.description,
                                    amount: t.amount
                                } : null);

                                let matchStatus = ReconciliationStatus.UNIDENTIFIED;
                                if (t.status === 'resolved') matchStatus = ReconciliationStatus.RESOLVED;
                                else if (t.status === 'identified') matchStatus = ReconciliationStatus.IDENTIFIED;

                                const newItem: MatchResult = {
                                    transaction,
                                    contributor,
                                    church,
                                    status: matchStatus,
                                    isConfirmed: !!t.is_confirmed,
                                    matchMethod: assoc ? MatchMethod.LEARNED : MatchMethod.MANUAL,
                                    similarity: 100,
                                    updatedAt: t.updated_at
                                };

                                console.log(`[Realtime:ATOM] Adicionando nova transação via realtime: ${id}`);
                                return [newItem, ...prev];
                            }
                            
                            // 🛡️ CORREÇÃO SEGURA: Se o item foi movido para 'pending' remotamente, 
                            // removemos do estado local para evitar inconsistência entre as listas (Trabalho Vivo vs Lista Viva).
                            if (status === 'pending') {
                                console.log(`[Realtime:ATOM] Removendo transação movida para pendente: ${id}`);
                                return prev.filter(r => r.transaction.id !== id);
                            }

                            const current = prev[idx];
                            const cloudUpdatedAt = updated_at;

                            // 🛡️ Regra de Realtime: Se o local é mais novo, ignoramos o evento
                            if (current.updatedAt && cloudUpdatedAt) {
                                if (new Date(cloudUpdatedAt) <= new Date(current.updatedAt)) {
                                    return prev;
                                }
                            }
                            
                            const statusMap: Record<string, ReconciliationStatus> = {
                                'identified': ReconciliationStatus.IDENTIFIED,
                                'resolved': ReconciliationStatus.RESOLVED
                            };

                            const newStatus = statusMap[status] || current.status;
                            
                            // 🏥 RECONSTRUÇÃO DO CONTRIBUTOR EM TEMPO REAL
                            const normalizedDesc = strictNormalize(current.transaction.description);
                            const assoc = (learnedAssociations || []).find((a: any) => a.normalizedDescription === normalizedDesc);
                            
                            const newChurch = churches.find(c => c.id === church_id) || (church_id === null ? PLACEHOLDER_CHURCH : current.church);
                            
                            const newContributor: Contributor | null = assoc ? {
                                id: contributor_id || undefined,
                                name: assoc.contributorNormalizedName || current.transaction.description,
                                amount: current.transaction.amount,
                                cleanedName: assoc.contributorNormalizedName || current.transaction.description
                            } : (contributor_id ? {
                                id: contributor_id,
                                name: current.transaction.description,
                                amount: current.transaction.amount
                            } : (newStatus === ReconciliationStatus.UNIDENTIFIED ? null : current.contributor));

                            if (current.isConfirmed === !!is_confirmed && 
                                current.status === newStatus && 
                                current.church?.id === church_id &&
                                current.contributor?.id === contributor_id &&
                                current.contributor?.name === newContributor?.name) return prev;

                            console.log(`[Realtime:ATOM] Atualizando transação ${id}: confirmed=${is_confirmed}, status=${status}`);
                            
                            const updated = [...prev];
                            updated[idx] = {
                                ...current,
                                status: newStatus,
                                church: newChurch,
                                contributor: newContributor,
                                isConfirmed: !!is_confirmed,
                                transaction: { ...current.transaction, isConfirmed: !!is_confirmed, bank_id: bank_id },
                                updatedAt: cloudUpdatedAt
                            };
                            return updated;
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'learned_associations',
                    filter: `user_id=eq.${effectiveUserId}`
                },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        // Se uma associação for deletada, não removemos o resultado, mas ele perde o vínculo "learned"
                        return;
                    }

                    if (payload.new) {
                        const { normalized_description, church_id, contributor_normalized_name } = payload.new;
                        const fullChurch = churches.find((c: any) => c.id === church_id);
                        
                        if (fullChurch) {
                            console.log(`[Realtime:ATOM] Associação aprendida (Event:${payload.eventType}): ${normalized_description} -> ${fullChurch.name}`);
                            setMatchResults(prev => {
                                let hasChanges = false;
                                const updated = prev.map(r => {
                                    const desc = strictNormalize(r.transaction.description);
                                    if (desc === normalized_description) {
                                        const hasChurchChange = r.church?.id !== church_id;
                                        const hasContributorChange = r.contributor?.name !== contributor_normalized_name;
                                        
                                        if (hasChurchChange || hasContributorChange) {
                                            hasChanges = true;
                                            return {
                                                ...r,
                                                church: fullChurch || r.church,
                                                contributor: {
                                                    name: contributor_normalized_name || r.transaction.description,
                                                    amount: r.transaction.amount,
                                                    cleanedName: contributor_normalized_name || r.transaction.description
                                                },
                                                status: r.status === ReconciliationStatus.UNIDENTIFIED ? ReconciliationStatus.IDENTIFIED : r.status,
                                                updatedAt: new Date().toISOString() // Força prioridade no próximo merge
                                            };
                                        }
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
    }, [effectiveUserId, churches, setMatchResults, learnedAssociations]);

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
