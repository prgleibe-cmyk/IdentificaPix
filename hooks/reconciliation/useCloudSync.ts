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
    searchFilters?: any;
    setSearchFilters?: any;
    realtimeRefreshKey?: number;
    contributorFiles?: any[];
    setContributorFiles?: (files: any[]) => void;
}

export const batchState = { isBatchUpdating: false, isAtomicUpdate: false };
const ENABLE_HEAVY_LOGS = false;

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
    selectedBankIds,
    searchFilters,
    setSearchFilters,
    realtimeRefreshKey,
    contributorFiles,
    setContributorFiles
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
    const isAutoProcessingRef = useRef<boolean>(false);
    const lastAutoProcessTimeRef = useRef<number>(0);

    const churchesRef = useRef(churches);
    const learnedAssociationsRef = useRef(learnedAssociations);
    const handleCompareRef = useRef(handleCompare);
    const contributorFilesRef = useRef(contributorFiles);

    useEffect(() => {
        churchesRef.current = churches;
    }, [churches]);

    useEffect(() => {
        learnedAssociationsRef.current = learnedAssociations;
    }, [learnedAssociations]);

    useEffect(() => {
        handleCompareRef.current = handleCompare;
    }, [handleCompare]);

    useEffect(() => {
        contributorFilesRef.current = contributorFiles;
    }, [contributorFiles]);

    const getRegisteredContributorName = (contributorId: string | null | undefined): string | null => {
        if (!contributorId || !contributorFilesRef.current) return null;
        const found = contributorFilesRef.current
            .flatMap((f: any) => f.contributors || [])
            .find((c: any) => c.id === contributorId);
        return found ? (found.name || found.cleanedName || found.canonical_name || null) : null;
    };

    // 🚀 CONTROLE DE PRONTIDÃO PARA HIDRATAÇÃO
    const isReady =
        !!effectiveUserId &&
        Array.isArray(churches) &&
        Array.isArray(learnedAssociations);

    const isContextReady = isReady && activeReportId !== null;

    const dataReadyKey = `${effectiveUserId}-${searchFilters?.dateRange?.start || ''}-${searchFilters?.dateRange?.end || ''}`;

    const lastDataReadyKeyRef = useRef<string>('');

    useEffect(() => {
        if (realtimeRefreshKey && realtimeRefreshKey > 0) {
            lastDataReadyKeyRef.current = '';
        }
    }, [realtimeRefreshKey]);

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
            dataReadyKey
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

        // ⚡ SE NENHUM PERÍODO FOR SELECIONADO, DEIXA CARREGAMENTO ZERADO (SUPER LEVE)
        if (!searchFilters?.dateRange?.start || !searchFilters?.dateRange?.end) {
            console.log("[CloudSync] Carregamento zerado: aguardando seleção de período pelo usuário.");
            if (matchResults.length > 0) {
                setMatchResults(() => []);
            }
            setHasActiveSession(false);
            return;
        }

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
                const pendingPromotions: { id: string; churchId: string; bankId: string }[] = [];

                // 1. Busca as transações que estão dentro do período selecionado em paralelo com os contribuintes
                const startDate = searchFilters.dateRange.start;
                const endDate = searchFilters.dateRange.end;

                console.log('[RECONSTRUCT:FILTER]', {
                    effectiveUserId,
                    startDate,
                    endDate
                });

                const fetchTransactionsPromise = (async () => {
                    let allTxs: any[] = [];
                    let from = 0;
                    const pageSize = 1000;

                    while (true) {
                        const res = await fetch(`/api/v1/consolidated_transactions?user_id=${effectiveUserId}&start_date=${startDate}&end_date=${endDate}&limit=${pageSize}&offset=${from}`);
                        if (!res.ok) {
                            throw new Error(`Erro ao buscar transações consolidadas do VPS: ${res.statusText}`);
                        }
                        const data = await res.json();
                        if (!data || data.length === 0) break;

                        console.log('[RECONSTRUCT:RAW_DATA]', data);

                        allTxs = [...allTxs, ...data];
                        console.log('[DEBUG:RAW_COUNT]', allTxs.length);
                        if (data.length < pageSize) break;
                        from += pageSize;
                    }
                    return allTxs;
                })();

                const fetchContributorsPromise = (async () => {
                    if (!churches || churches.length === 0) return [];

                    const promises = churches.map(async (church: any) => {
                        const resp = await fetch(`/api/v1/contributors?church_id=${church.id}`);
                        if (resp.ok) {
                            const list = await resp.json();
                            return Array.isArray(list) ? list : [];
                        }
                        return [];
                    });

                    const results = await Promise.all(promises);
                    const data = results.flat();

                    const allowedChurchIds = new Set((churches || []).map((ch: any) => ch.id));

                    const grouped = new Map<string, any[]>();
                    data.forEach((c: any) => {
                        if (c.status !== 'inactive') {
                            const cid = c.church_id;
                            if (!allowedChurchIds.has(cid)) return;

                            if (!grouped.has(cid)) {
                                grouped.set(cid, []);
                            }
                            grouped.get(cid)!.push({
                                id: c.id,
                                name: c.canonical_name,
                                cleanedName: c.canonical_name,
                                _churchId: cid,
                                cpf: c.cpf,
                                email: c.email,
                                phone: c.phone,
                                amount: 0
                            });
                        }
                    });

                    const newFiles = Array.from(grouped.entries()).map(([cid, list]) => {
                        const church = churches.find((ch: any) => ch.id === cid)!;
                        return {
                            church,
                            churchId: cid,
                            contributors: list,
                            fileName: 'Banco de Dados VPS'
                        };
                    });

                    return newFiles;
                })();

                console.log("[CloudSync:PromiseAll] Buscando transações e contribuintes em paralelo...");
                const [txs, contributorFilesData] = await Promise.all([
                    fetchTransactionsPromise,
                    fetchContributorsPromise
                ]);
                console.log("[CloudSync:PromiseAll] Downloads concluídos!");

                // Atualiza os arquivos de contribuintes antes do mapeamento para garantir matching síncrono e correto
                if (setContributorFiles) {
                    setContributorFiles(contributorFilesData);
                }
                contributorFilesRef.current = contributorFilesData;

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
                
                // Pre-build Maps for O(1) lookups to optimize from O(N * M) to O(N + M)
                const assocMap = new Map<string, any>();
                (learnedAssociations || []).forEach((a: any) => {
                    if (a.normalizedDescription) {
                        assocMap.set(a.normalizedDescription, a);
                    }
                });

                const churchMap = new Map<string, any>();
                (churches || []).forEach((c: any) => {
                    if (c.id) {
                        churchMap.set(c.id, c);
                    }
                });

                const txResults: MatchResult[] = txs.map((t: any) => {
                    const normalizedDesc = strictNormalize(t.description);
                    const assoc = assocMap.get(normalizedDesc);
                    const church = churchMap.get(assoc?.churchId || (t as any).church_id) || PLACEHOLDER_CHURCH;

                    if (ENABLE_HEAVY_LOGS) {
                        console.log("[DIAGNOSTIC:RECONSTRUCT_ROW_MAPPING]", {
                            txId: t.id,
                            description: t.description,
                            t_type: t.type,
                            t_pix_key: t.pix_key,
                            t_church_id: t.church_id,
                            assoc_found: !!assoc,
                            assoc_churchId: assoc?.churchId,
                            church_resolved: church?.name,
                        });
                    }

                    const transaction: Transaction = {
                        id: t.id,
                        date: t.transaction_date,
                        description: t.description,
                        rawDescription: t.description,
                        amount: t.amount,
                        bank_id: t.bank_id,
                        isConfirmed: t.is_confirmed,
                        type: t.type
                    };

                    const regName = t.contributor_id ? getRegisteredContributorName(t.contributor_id) : null;

                    const contributor: Contributor | null = assoc ? {
                        id: t.contributor_id || undefined,
                        name: regName || assoc.contributorNormalizedName || t.description,
                        amount: t.amount,
                        cleanedName: regName || assoc.contributorNormalizedName || t.description
                    } : (t.contributor_id ? {
                        id: t.contributor_id,
                        name: regName || t.description,
                        amount: t.amount,
                        cleanedName: regName || t.description
                    } : null);

                    let status = ReconciliationStatus.UNIDENTIFIED;
                    if (t.status === 'resolved') status = ReconciliationStatus.RESOLVED;
                    else if (t.status === 'identified') status = ReconciliationStatus.IDENTIFIED;

                    // ⚡ AUTO-IDENTIFICAÇÃO DE VÍNCULOS SALVOS (SEM IA)
                    // Se a transação no banco está 'pending', mas existe uma associação aprendida (assoc),
                    // promovemos localmente para IDENTIFIED e agendamos a atualização no banco em segundo plano (sequencialmente).
                    if (assoc && t.status === 'pending') {
                        status = ReconciliationStatus.IDENTIFIED;
                        pendingPromotions.push({
                            id: t.id,
                            churchId: church.id,
                            bankId: t.bank_id
                        });
                    }

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
                        
                        // 🛡️ BLOCK_REGRESSION: Proteção contra updates atrasados do banco
                        const currentUpdatedAt = current?.updatedAt ? new Date(current.updatedAt).getTime() : 0;
                        const incomingUpdatedAt = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;

                        // 🛡️ EXCEÇÃO FASE 2.3: Permitimos 'regressão' para pending ou unconfirmed se for uma mudança legítima de estado
                        const isUndoingHydrate = r.status === ReconciliationStatus.UNIDENTIFIED || r.isConfirmed === false;

                        if (current && incomingUpdatedAt < currentUpdatedAt && !isUndoingHydrate) {
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

                if (pendingPromotions.length > 0) {
                    console.log(`[CloudSync] Agendando auto-promoção sequencial de ${pendingPromotions.length} transações...`);
                    (async () => {
                        for (let i = 0; i < pendingPromotions.length; i++) {
                            const p = pendingPromotions[i];
                            try {
                                await consolidationService.updateTransactionStatus(
                                    p.id,
                                    'identified',
                                    p.churchId,
                                    p.bankId,
                                    undefined,
                                    false
                                );
                                // Espera 100ms entre as requisições para espalhar a carga de IO
                                await new Promise(resolve => setTimeout(resolve, 100));
                            } catch (err) {
                                console.error(`[Auto-promote] Erro ao salvar transação ${p.id}:`, err);
                            }
                        }
                    })();
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
    }, [isReady, dataReadyKey, effectiveUserId, activeReportId, setActiveReportId, savedReports, churches, learnedAssociations, setMatchResults, setHasActiveSession, overwriteSavedReport, showToast, handleCompare, isLoading, searchFilters, realtimeRefreshKey]);

    // 🚀 AUTO-PROCESSAMENTO INICIAL (Lista Viva)
    useEffect(() => {
        if (isReady && !isLoading && matchResults?.length === 0 && !isHydratingFromCloud.current) {
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
                    console.log("[DIAGNOSTIC:REALTIME_RECEIVE]", { eventType: payload.eventType, old: payload.old, new: payload.new });
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
                        
                        batchState.isAtomicUpdate = true;
                        setMatchResults(prev => {
                            const idx = prev.findIndex(r => r.transaction.id === id);
                            
                            // 🛡️ ADIÇÃO AUTOMÁTICA: Se o item não existe localmente, criamos e adicionamos.
                            // Isso garante a sincronização em tempo real entre dispositivos.
                            if (idx === -1) {
                                // NUNCA retornar antes ou remover — garantimos que o item sempre entre no array
                                const t = payload.new;
                                const normalizedDesc = strictNormalize(t.description);
                                const assoc = (learnedAssociationsRef.current || []).find((a: any) => a.normalizedDescription === normalizedDesc);
                                const church = churchesRef.current.find(c => c.id === (assoc?.churchId || (t as any).church_id)) || PLACEHOLDER_CHURCH;

                                console.log("[DIAGNOSTIC:REALTIME_NEW_ROW]", {
                                    txId: t.id,
                                    description: t.description,
                                    t_type: t.type,
                                    t_pix_key: t.pix_key,
                                    t_church_id: t.church_id,
                                    assoc_found: !!assoc,
                                    church_resolved: church?.name,
                                });

                                const transaction: Transaction = {
                                    id: t.id,
                                    date: t.transaction_date,
                                    description: t.description,
                                    rawDescription: t.description,
                                    amount: t.amount,
                                    bank_id: t.bank_id,
                                    isConfirmed: !!t.is_confirmed,
                                    type: t.type
                                };

                                const regName = t.contributor_id ? getRegisteredContributorName(t.contributor_id) : null;

                                const contributor: Contributor | null = assoc ? {
                                    id: t.contributor_id || undefined,
                                    name: regName || assoc.contributorNormalizedName || t.description,
                                    amount: t.amount,
                                    cleanedName: regName || assoc.contributorNormalizedName || t.description
                                } : (t.contributor_id ? {
                                    id: t.contributor_id,
                                    name: regName || t.description,
                                    amount: t.amount,
                                    cleanedName: regName || t.description
                                } : null);

                                let matchStatus = ReconciliationStatus.UNIDENTIFIED;
                                if (t.status === 'resolved') matchStatus = ReconciliationStatus.RESOLVED;
                                else if (t.status === 'identified') matchStatus = ReconciliationStatus.IDENTIFIED;

                                // ⚡ AUTO-IDENTIFICAÇÃO DE VÍNCULOS SALVOS EM TEMPO REAL
                                if (assoc && t.status === 'pending') {
                                    matchStatus = ReconciliationStatus.IDENTIFIED;
                                    consolidationService.updateTransactionStatus(
                                        t.id, 
                                        'identified', 
                                        church.id, 
                                        t.bank_id,
                                        undefined,
                                        false
                                    ).catch(e => console.error("[Realtime Auto-promote] Erro:", e));
                                }

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

                            // 🛡️ EXCEÇÃO FASE 2.3: Se o status mudar para pending ou confirmed para false, permitimos a atualização
                            // mesmo que o timestamp local seja maior, para garantir que 'desfazer' funcione via realtime.
                            const isUndoingRealtime = status === 'pending' || is_confirmed === false;

                            if (incomingUpdatedAt < currentUpdatedAt && !isUndoingRealtime) {
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
                            const assoc = (learnedAssociationsRef.current || []).find((a: any) => a.normalizedDescription === normalizedDesc);
                            
                            const dbChurch = church_id ? churchesRef.current.find(c => c.id === church_id) : null;
                            
                            // 🔥 CORREÇÃO REALTIME: Se o status for 'pending' (undo) ou church_id for explicitamente null,
                            // limpamos a igreja em vez de herdar a antiga (current.church).
                            const newChurch = (status === 'pending' || church_id === null) 
                                ? null 
                                : (dbChurch || (church_id ? PLACEHOLDER_CHURCH : current.church));
                            
                            const regName = contributor_id ? getRegisteredContributorName(contributor_id) : null;

                            const newContributor: Contributor | null = assoc ? {
                                id: contributor_id || undefined,
                                name: regName || assoc.contributorNormalizedName || current.transaction.description,
                                amount: current.transaction.amount,
                                cleanedName: regName || assoc.contributorNormalizedName || current.transaction.description
                            } : (contributor_id ? {
                                id: contributor_id,
                                name: regName || current.transaction.description,
                                amount: current.transaction.amount,
                                cleanedName: regName || current.transaction.description
                            } : (newStatus === ReconciliationStatus.UNIDENTIFIED ? null : current.contributor));

                            console.log(`[Realtime:ATOM] Atualizando transação ${id}: confirmed=${is_confirmed}, status=${status}`);
                            
                            const updated = [...prev];
                            updated[idx] = {
                                ...current,
                                // 🔥 MANTER CONSISTÊNCIA DE AGRUPAMENTO
                                reportId: current.reportId || (payload.new as any).report_id,
                                status: newStatus,
                                church: newChurch, 
                                _churchId: church_id, // 🔥 Sincroniza o ID bruto para o filtro de ejeção visual
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
                        const fullChurch = churchesRef.current.find((c: any) => c.id === church_id);
                        
                        if (fullChurch) {
                            console.log(`[Realtime:ATOM] Associação aprendida (Event:${payload.eventType}): ${normalized_description} -> ${fullChurch.name}`);
                            batchState.isAtomicUpdate = true;
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
    }, [effectiveUserId, setMatchResults, realtimeRefreshKey]);

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
        if ((!isContextReady && (matchResults?.length || 0) === 0) || isLoading) {
            console.log('[PostReconstruct:SKIPPED]', { isContextReady, isLoading });
            if (stableTimeoutRef.current) clearTimeout(stableTimeoutRef.current);
            return;
        }

        if (!matchResults || matchResults.length === 0) {
            return;
        }

        // 🛡️ TRAVA DE SEGURANÇA: Evita disparar se já estiver processando
        if (isAutoProcessingRef.current) {
            return;
        }

        // 🛡️ GATILHO ATÔMICO: Se a última mudança foi uma ação simples (confirmar, realtime, etc), não disparamos AutoProcess
        if (batchState.isAtomicUpdate) {
            if (stableTimeoutRef.current) {
                clearTimeout(stableTimeoutRef.current);
                stableTimeoutRef.current = null;
            }
            console.log('[PostReconstruct:BLOCK] Pulando AutoProcess em resposta a atualização atômica.');
            // Deferimos o reset para garantir que todos os hooks observadores vejam a flag antes de limpar
            setTimeout(() => { batchState.isAtomicUpdate = false; }, 200);
            
            // Atualizamos a assinatura para marcar que já vimos esse estado, mas sem disparar
            const currentSignature = matchResults.map(item => `${item.transaction.id}-${item.status}-${item.isConfirmed}-${item.updatedAt}`).join('|');
            postProcessingSignatureRef.current = currentSignature;
            return;
        }

        // Se o conteúdo mudou, resetamos o timer de estabilidade
        const stableSignature = JSON.stringify(
            (matchResults || [])
                .map(r => ({
                    id: r.transaction.id,
                    status: r.status,
                    is_confirmed: r.isConfirmed
                }))
                .sort((a, b) => a.id.localeCompare(b.id))
        );

        const currentSignature = matchResults.map(item => `${item.transaction.id}-${item.status}-${item.isConfirmed}-${item.updatedAt}`).join('|');

        if (currentSignature !== postProcessingSignatureRef.current) {
            console.log('[PostReconstruct:WAIT_STABLE]', { signatureChanged: true });
            
            if (stableTimeoutRef.current) clearTimeout(stableTimeoutRef.current);
            
            stableTimeoutRef.current = setTimeout(async () => {
                const now = Date.now();
                
                // 🛡️ THROTTLE: Janela de resfriamento de 1.5s para evitar tempestade de re-processamento
                if (now - lastAutoProcessTimeRef.current < 1500) {
                    console.log('[PostReconstruct:THROTTLED]');
                    return;
                }

                if (isAutoProcessingRef.current) {
                    console.log('[PostReconstruct:LOCKED]');
                    return;
                }

                console.log('[PostReconstruct:STABLE]', matchResults.length);
                postProcessingSignatureRef.current = currentSignature;
                lastProcessedLength.current = matchResults.length;
                
                if (typeof handleCompareRef.current === 'function') {
                    if (lastAutoProcessSignatureRef.current === stableSignature) {
                        return;
                    }
 
                    lastAutoProcessSignatureRef.current = stableSignature;
                    lastAutoProcessTimeRef.current = now;
                    isAutoProcessingRef.current = true;
 
                    console.log('[AutoProcess:FINAL_TRIGGER]');
                    try {
                        await handleCompareRef.current(false);
                    } catch (err) {
                        console.error('[AutoProcess:ERROR]', err);
                    } finally {
                        isAutoProcessingRef.current = false;
                    }
                }
            }, 800); // Janela de estabilização aumentada para 800ms
        }

        return () => {
            if (stableTimeoutRef.current) clearTimeout(stableTimeoutRef.current);
        };
    }, [matchResults, isLoading, isContextReady]);

    return {
        syncToCloud,
        isHydratingFromCloud
    };
};
