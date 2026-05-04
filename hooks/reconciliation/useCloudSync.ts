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
    setActiveReportId: (id: string | null) => void;
    savedReports: any[];
    overwriteSavedReport: (reportId: string, results: MatchResult[]) => Promise<void>;
    churches: any[];
    learnedAssociations: any[];
    showToast: (msg: string, type: 'success' | 'error') => void;
    handleCompare?: (isAuto?: boolean) => Promise<void>;
    isLoading?: boolean;
    activeBankFiles?: any[];
    selectedBankIds?: string[];
}

export const batchState = { isBatchUpdating: false };

export const useCloudSync = ({
    user,
    effectiveUserId,
    matchResults,
    setMatchResults,
    setHasActiveSession,
    activeReportId,
    setActiveReportId,
    savedReports,
    overwriteSavedReport,
    churches,
    learnedAssociations,
    showToast,
    handleCompare,
    isLoading,
    activeBankFiles,
    selectedBankIds
}: UseCloudSyncProps) => {
    const lastCloudSyncRef = useRef<string>('');
    const isHydratingFromCloud = useRef<boolean>(false);
    const needsRetry = useRef<boolean>(false);
    const lastValidatedHash = useRef<string>('');
    const isValidating = useRef<boolean>(false);
    const stableTimeoutRef = useRef<any>(null);
    const lastProcessedLength = useRef<number>(0);
    const postProcessingSignatureRef = useRef<string>('');
    const lastAutoProcessSignatureRef = useRef<string | null>(null);

    // 🚀 CONTROLE DE PRONTIDÃO PARA HIDRATAÇÃO
    const isReady =
        !!effectiveUserId &&
        Array.isArray(churches) &&
        Array.isArray(learnedAssociations) &&
        churches.length > 0 &&
        learnedAssociations.length > 0;

    const isContextReady = isReady && activeReportId !== null;

    const dataReadyKey = `${effectiveUserId}-${churches.length}-${learnedAssociations.length}`;

    const lastDataReadyKeyRef = useRef<string>('');

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

    const lastSignatureRef = useRef<string | null>(null);

    // 🔄 HIDRATAÇÃO ATÔMICA (Reconstrói a sessão a partir dos dados individuais)
    useEffect(() => {
        const currentSignature = JSON.stringify({
            activeReportId,
            assocCount: learnedAssociations?.length,
            churchesCount: churches?.length
        });

        if (lastSignatureRef.current === currentSignature) {
            return;
        }

        lastSignatureRef.current = currentSignature;

        console.log('[CloudSync:ATOM_EFFECT_TRIGGER]', {
            isReady,
            activeReportId,
            effectiveUserId,
            churchesCount: churches?.length,
            assocCount: learnedAssociations?.length,
            lastDataReadyKey: lastDataReadyKeyRef.current,
            dataReadyKey
        });

        if (!isReady || activeReportId) return;

        // 🛡️ Evita reconstrução com dados incompletos repetidos
        if (lastDataReadyKeyRef.current === dataReadyKey) return;
        lastDataReadyKeyRef.current = dataReadyKey;

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
                // 1. Busca as transações que não estão pendentes (últimos 30 dias) - Loop paginado para trazer 100% dos dados
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const dateThreshold = thirtyDaysAgo.toISOString().split('T')[0];

                console.log('[RECONSTRUCT:FILTER]', {
                    effectiveUserId,
                    dateThreshold
                });

                let allTxs: any[] = [];
                let from = 0;
                const pageSize = 1000;

                while (true) {
                    const { data, error } = await supabase
                        .from('consolidated_transactions')
                        .select('*')
                        .eq('user_id', effectiveUserId)
                        .gte('transaction_date', dateThreshold)
                        .order('transaction_date', { ascending: false })
                        .range(from, from + pageSize - 1);

                    if (error) throw error;
                    if (!data || data.length === 0) break;

                    console.log('[RECONSTRUCT:RAW_DATA]', data);

                    allTxs = [...allTxs, ...data];
                    console.log('[DEBUG:RAW_COUNT]', allTxs.length);
                    if (data.length < pageSize) break;
                    from += pageSize;
                }

                const txs = allTxs;
                console.log('[DEBUG:TOTAL_RAW_COUNT]', txs.length);

                // 🆕 BUSCAR RELATÓRIOS SALVOS COMO BASE COMPLETA
                const reportsMap = new Map<string, MatchResult>();

                (savedReports || []).forEach((report: any) => {
                    const results = report?.data?.results || [];
                    results.forEach((r: MatchResult) => {
                        if (r?.transaction?.id) {
                            reportsMap.set(r.transaction.id, r);
                        }
                    });
                });

                console.log('[RECONSTRUCT:REPORTS_MAP]', Array.from(reportsMap.values()));

                if ((!txs || txs.length === 0) && reportsMap.size === 0) {
                    isHydratingFromCloud.current = false;
                    return;
                }

                // 2. Mapeia para MatchResults usando as associações aprendidas
                console.log('[DEBUG:BEFORE_MAP_TXS]', txs.length);
                
                // 🛡️ RESTAURAÇÃO AUTOMÁTICA DE REPORT_ID (Se não houver um ativo)
                if (!activeReportId && savedReports && savedReports.length > 0) {
                    let target = savedReports[0];
                    if (savedReports.length > 1) {
                        target = [...savedReports].sort((a, b) => {
                            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                            return dateB - dateA;
                        })[0];
                    }
                    if (target && target.id) {
                        console.log('[REPORT:RESTORED]', { activeReportId: target.id });
                        setActiveReportId(target.id);
                    }
                }

                const txResults: MatchResult[] = txs.map((t: any) => {
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
                        reportId: t.report_id,
                        status,
                        isConfirmed: t.is_confirmed,
                        matchMethod: assoc ? MatchMethod.LEARNED : MatchMethod.MANUAL,
                        similarity: 100,
                        updatedAt: t.updated_at
                    };
                });

                console.log('[DEBUG:AFTER_MAP_TXS]', txResults.length);
                console.log('[RECONSTRUCT:PROCESSED]', txResults);
                console.log('[DEBUG:PROCESSED_COUNT]', txResults.length);

                // 🆕 COMBINAR COM RELATÓRIOS
                const reconstructedMap = new Map<string, MatchResult>();

                // prioridade para relatórios
                reportsMap.forEach((value, key) => {
                    reconstructedMap.set(key, value);
                });

                // depois complementar com transações
                txResults.forEach(r => {
                    if (!reconstructedMap.has(r.transaction.id)) {
                        reconstructedMap.set(r.transaction.id, r);
                    }
                });

                const reconstructed = Array.from(reconstructedMap.values());

                console.log('[DEBUG:FINAL_COUNT]', reconstructed.length);
                console.log('[RECONSTRUCT:FINAL_COMBINED]', reconstructed);

                setMatchResults(prev => {
                    const map = new Map(prev.map(p => [p.transaction.id, p]));
                    let hasChanges = false;

                    reconstructed.forEach(r => {
                        const current = map.get(r.transaction.id);
                        
                        // 🛡️ BLOCK_REGRESSION: Apenas atualizamos se os dados da nuvem forem mais recentes ou se o item for novo
                        const currentUpdatedAt = current?.updatedAt ? new Date(current.updatedAt).getTime() : 0;
                        const incomingUpdatedAt = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;

                        if (current && incomingUpdatedAt < currentUpdatedAt) {
                            console.log('[BLOCK_REGRESSION:HYDRATE] Ignorando item antigo do banco:', r.transaction.id);
                            return;
                        }

                        map.set(r.transaction.id, r);
                        hasChanges = true;
                    });

                    const final = Array.from(map.values());
                    return hasChanges ? final : prev;
                });

                // 🆕 Persistência automática após reconstrução inicial
                if (activeReportId && reconstructed.length > 0) {
                    console.log('[AutoSave:RECONSTRUCT] Atualizando relatório automaticamente após hidratação');
                    overwriteSavedReport(activeReportId, reconstructed);
                }

                setHasActiveSession(true);

                if (reconstructed.length > 0) {
                    showToast("Sessão ativa sincronizada.", "success");
                }
            } catch (e) {
                console.error("[CloudSync:ATOM_RECONSTRUCT_FAIL]", e);
            } finally {
                isHydratingFromCloud.current = false;
                setTimeout(() => {
                    console.log('[Hydration:FINISHED]');
                }, 0);
                if (needsRetry.current) {
                    needsRetry.current = false;
                }
            }
        };

        reconstructSession();
    }, [isReady, dataReadyKey, effectiveUserId, activeReportId, setActiveReportId, savedReports, churches, learnedAssociations, setMatchResults, setHasActiveSession, overwriteSavedReport, showToast, handleCompare, isLoading]);

    // 🚀 AUTO-PROCESSAMENTO INICIAL (Lista Viva)
    useEffect(() => {
        if (isReady && !isLoading && matchResults?.length === 0) {
            console.log('[AUTO_PROCESS] Executando processamento inicial da lista viva...');
            handleCompare?.(false); // isAuto = true
        }
    }, [isReady, isLoading, matchResults?.length, handleCompare]);

    /**
     * 📡 REALTIME SYNC (Atomização)
     * Escuta mudanças individuais em transações e associações aprendidas
     */
    useEffect(() => {
        if (!effectiveUserId) return;

        console.log('[REALTIME:USER]', {
          userId: user?.id,
          effectiveUserId
        });
        
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
                    // DELETE: Agora usamos map em vez de filter para nunca remover itens do estado em tempo real
                    if (payload.eventType === 'DELETE') {
                        const deletedId = payload.old?.id;
                        if (deletedId) {
                            setMatchResults(prev => prev.map(r => r.transaction.id === deletedId ? { ...r, status: ReconciliationStatus.UNIDENTIFIED } : r));
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
                                // NUNCA retornar antes ou remover — garantimos que o item sempre entre no array
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
                            
                            if (status === 'pending') {
                                console.log(`[REALTIME:UPDATE_INSTEAD_REMOVE] Transação ${id} movida para pendente, atualizando em vez de remover.`);
                            }

                            const current = prev[idx];
                            
                            // 🛡️ BLOCK_REGRESSION: Proteção contra updates atrasados do banco
                            const currentUpdatedAt = current?.updatedAt ? new Date(current.updatedAt).getTime() : 0;
                            const incomingUpdatedAt = updated_at ? new Date(updated_at).getTime() : 0;

                            if (incomingUpdatedAt < currentUpdatedAt) {
                                console.log('[BLOCK_REGRESSION] Ignorando update antigo do banco', {
                                    id,
                                    incomingUpdatedAt,
                                    currentUpdatedAt
                                });
                                return prev;
                            }
                            
                            const cloudUpdatedAt = updated_at;
                            
                            const statusMap: Record<string, ReconciliationStatus> = {
                                'identified': ReconciliationStatus.IDENTIFIED,
                                'resolved': ReconciliationStatus.RESOLVED,
                                'pending': ReconciliationStatus.UNIDENTIFIED
                            };

                           const newStatus = statusMap[status] || current.status;
                            
                            // 🏥 RECONSTRUÇÃO DO CONTRIBUTOR EM TEMPO REAL
                            const normalizedDesc = strictNormalize(current.transaction.description);
                            const assoc = (learnedAssociations || []).find((a: any) => a.normalizedDescription === normalizedDesc);
                            
                            const dbChurch = churches.find(c => c.id === church_id);
                            const newChurch = dbChurch || current.church || PLACEHOLDER_CHURCH;
                            
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

                            console.log(`[Realtime:ATOM] Atualizando transação ${id}: confirmed=${is_confirmed}, status=${status}`);
                            
                            const updated = [...prev];
                            updated[idx] = {
                                ...current,
                                // 🔥 MANTER CONSISTÊNCIA DE AGRUPAMENTO
                                reportId: current.reportId || (payload.new as any).report_id,
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
    }, [effectiveUserId, matchResults, setMatchResults]);

    /**
     * 🚀 GATILHO PÓS-RECONSTRUÇÃO (Executa processamento após carregar dados do banco)
     * Estabilização por tamanho para evitar processamento parcial durante paginação
     */
    useEffect(() => {
        if ((!isContextReady && matchResults.length === 0) || isLoading) {
            console.log('[PostReconstruct:SKIPPED]', { isContextReady, isLoading });
            if (stableTimeoutRef.current) clearTimeout(stableTimeoutRef.current);
            return;
        }

        if (matchResults.length === 0) {
            return;
        }

        // Se o conteúdo mudou, resetamos o timer de estabilidade
        const currentSignature = matchResults.map(item => `${item.transaction.id}-${item.status}-${item.isConfirmed}-${item.updatedAt}`).join('|');

        if (currentSignature !== postProcessingSignatureRef.current) {
            console.log('[PostReconstruct:WAIT_STABLE]', { signatureChanged: true });
            
            if (stableTimeoutRef.current) clearTimeout(stableTimeoutRef.current);
            
            stableTimeoutRef.current = setTimeout(() => {
                console.log('[PostReconstruct:STABLE]', matchResults.length);
                postProcessingSignatureRef.current = currentSignature;
                lastProcessedLength.current = matchResults.length;
                
                if (typeof handleCompare === 'function') {
                    if (lastAutoProcessSignatureRef.current === currentSignature) {
                        return;
                    }

                    lastAutoProcessSignatureRef.current = currentSignature;

                    console.log('[AutoProcess:FINAL_TRIGGER]');
                    handleCompare(false);
                }
            }, 200);
        }

        return () => {
            if (stableTimeoutRef.current) clearTimeout(stableTimeoutRef.current);
        };
    }, [matchResults, isLoading, handleCompare, isContextReady]);

    return {
        syncToCloud,
        isHydratingFromCloud
    };
};
