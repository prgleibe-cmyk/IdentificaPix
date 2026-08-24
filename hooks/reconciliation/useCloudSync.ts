import { useCallback, useEffect, useRef, useState } from 'react';
import { MatchResult, ReconciliationStatus, MatchMethod, Transaction, Contributor } from '../../types';
import { PLACEHOLDER_CHURCH, strictNormalize, isInvalidOrNumericName } from '../../services/processingService';
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
    setIsLoading?: (loading: boolean) => void;
}

export const batchState = { isBatchUpdating: false, isAtomicUpdate: false };
export const lastRealtimeUpdate = { txId: null as string | null, timestamp: 0 };
const ENABLE_HEAVY_LOGS = false;

const toIsoDate = (str: string): string => {
    if (!str) return '';
    const clean = str.split('T')[0].trim();
    if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length === 3) {
            if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return clean;
};

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
    setContributorFiles,
    setIsLoading
}: UseCloudSyncProps) => {
    const lastCloudSyncRef = useRef<string>('');
    const isHydratingFromCloud = useRef<boolean>(false);
    const [isHydrating, setIsHydrating] = useState<boolean>(false);
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

    const dataReadyKey = `${effectiveUserId}-${churches?.length || 0}-${learnedAssociations?.length || 0}`;

    const lastDataReadyKeyRef = useRef<string>('');

    useEffect(() => {
        if (realtimeRefreshKey && realtimeRefreshKey > 0) {
            lastDataReadyKeyRef.current = '';
            lastSignatureRef.current = null;
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
            dataReadyKey,
            realtimeRefreshKey
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
            const hasDataAlready = Array.isArray(matchResults) && matchResults.length > 0;
            isHydratingFromCloud.current = true;
            setIsHydrating(true);
            if (setIsLoading && !hasDataAlready) setIsLoading(true);
            needsRetry.current = false;

            try {
                const pendingPromotions: { id: string; churchId: string; bankId: string }[] = [];

                // 1. Busca todas as transações consolidadas em paralelo com os contribuintes
                const fetchTransactionsPromise = (async () => {
                    let allTxs: any[] = [];
                    let from = 0;
                    const pageSize = 1000;

                    let queryParams = `user_id=${effectiveUserId}&limit=${pageSize}`;

                    while (true) {
                        const res = await fetch(`/api/v1/consolidated_transactions?${queryParams}&offset=${from}`);
                        if (!res.ok) {
                            throw new Error(`Erro ao buscar transações consolidadas do VPS: ${res.statusText}`);
                        }
                        const data = await res.json();
                        if (!data || data.length === 0) break;

                        allTxs = [...allTxs, ...data];
                        if (data.length < pageSize) break;
                        from += pageSize;
                    }
                    return allTxs;
                })();

                const fetchContributorsPromise = (async () => {
                    if (!churches || churches.length === 0) return [];
                    if (contributorFilesRef.current && contributorFilesRef.current.length > 0) {
                        return contributorFilesRef.current;
                    }

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

                const [txs, contributorFilesData] = await Promise.all([
                    fetchTransactionsPromise,
                    fetchContributorsPromise
                ]);

                // Atualiza os arquivos de contribuintes antes do mapeamento para garantir matching síncrono e correto
                if (setContributorFiles && contributorFilesData && contributorFilesData.length > 0) {
                    setContributorFiles(contributorFilesData);
                }
                contributorFilesRef.current = contributorFilesData;

                // 🆕 BUSCAR RELATÓRIOS SALVOS COMO BASE COMPLETA (Isolado por relatório ativo para evitar contaminação cruzada de dados antigos)
                const reportsMap = new Map<string, MatchResult>();

                const targetReport = activeReportId 
                    ? (savedReports || []).find((r: any) => r.id === activeReportId)
                    : (savedReports || []).find((r: any) => r.name === '[SESSÃO_ATIVA]');

                if (targetReport && targetReport.data && Array.isArray(targetReport.data.results)) {
                    targetReport.data.results.forEach((r: MatchResult) => {
                        if (r?.transaction?.id) {
                            reportsMap.set(r.transaction.id, r);
                        }
                    });
                }

                if (!activeReportId && (!txs || txs.length === 0)) {
                    setMatchResults([] as any);
                    setHasActiveSession(false);
                    const liveReport = (savedReports || []).find((r: any) => r.name === '[SESSÃO_ATIVA]');
                    if (liveReport && overwriteSavedReport) {
                        overwriteSavedReport(liveReport.id, []);
                    }
                    isHydratingFromCloud.current = false;
                    setIsHydrating(false);
                    if (setIsLoading) setIsLoading(false);
                    return;
                }

                if (activeReportId && (!txs || txs.length === 0) && reportsMap.size === 0) {
                    isHydratingFromCloud.current = false;
                    setIsHydrating(false);
                    if (setIsLoading) setIsLoading(false);
                    return;
                }

                // 2. Mapeia para MatchResults usando as associações aprendidas
                
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
                        type: t.type,
                        source: t.source,
                        pix_key: t.pix_key,
                        row_hash: t.row_hash
                    };

                    const regName = t.contributor_id ? getRegisteredContributorName(t.contributor_id) : null;
                    const rawNameCandidate = regName || assoc?.contributorNormalizedName;
                    const validContribName = (rawNameCandidate && !isInvalidOrNumericName(rawNameCandidate, t.description)) ? rawNameCandidate : null;

                    const contributor: Contributor | null = validContribName ? {
                        id: t.contributor_id || undefined,
                        name: validContribName,
                        amount: t.amount,
                        cleanedName: validContribName
                    } : null;

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

                    const result = {
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

                    return result;
                });

                // 🆕 COMBINAR COM RELATÓRIOS (Com prioridade absoluta para dados de transações do banco)
                const reconstructedMap = new Map<string, MatchResult>();

                // 1. Damos prioridade para transações do banco de dados (txResults)
                txResults.forEach(r => {
                    const saved = reportsMap.get(r.transaction.id);
                    if (saved) {
                        // Preserva metadados de identificação salvos no relatório (contribuinte, igreja, status, splits, isConfirmed),
                        // mas MANTÉM OS DADOS DA TRANSAÇÃO AUTÊNTICA DO BANCO (data, valor, descrição, origem, pix_key, row_hash)
                        reconstructedMap.set(r.transaction.id, {
                            ...saved,
                            transaction: {
                                ...saved.transaction,
                                ...r.transaction, // Campos autênticos do banco sobrensaem sempre
                                date: r.transaction.date, // Garantia imutável da data do banco
                                source: r.transaction.source || saved.transaction?.source // Garantia da origem do banco
                            },
                            updatedAt: r.updatedAt || saved.updatedAt
                        });
                    } else {
                        reconstructedMap.set(r.transaction.id, r);
                    }
                });

                // 2. Complementa com itens salvos no relatório que eventualmente não estejam na consulta do banco, RESPEITANDO O FILTRO DE PERÍODO
                // NOTA: Executado exclusivamente para relatórios históricos salvos (activeReportId != null).
                // Na Lista Viva (!activeReportId), o banco de dados (txs) é a única fonte da verdade: itens deletados do banco não devem ser ressuscitados.
                if (activeReportId) {
                    const startStr = searchFilters?.dateRange?.start ? toIsoDate(searchFilters.dateRange.start) : null;
                    const endStr = searchFilters?.dateRange?.end ? toIsoDate(searchFilters.dateRange.end) : null;

                    reportsMap.forEach((value, key) => {
                        if (!reconstructedMap.has(key)) {
                            const txDate = value.transaction?.date || (value as any).date;
                            if (txDate && (startStr || endStr)) {
                                const itemIso = toIsoDate(txDate);
                                if (startStr && itemIso < startStr) return;
                                if (endStr && itemIso > endStr) return;
                            }
                            reconstructedMap.set(key, value);
                        }
                    });
                }

                const reconstructed = Array.from(reconstructedMap.values());

                setMatchResults(prev => {
                    // Na Lista Viva (!activeReportId), 'reconstructed' contém a lista autêntica e atualizada de registros do banco de dados.
                    if (!activeReportId) {
                        return reconstructed;
                    }

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
                } else if (!activeReportId) {
                    const liveReport = (savedReports || []).find((r: any) => r.name === '[SESSÃO_ATIVA]');
                    if (liveReport && overwriteSavedReport) {
                        overwriteSavedReport(liveReport.id, reconstructed);
                    }
                }

                setHasActiveSession(true);

                if (reconstructed.length > 0 && !hasDataAlready) {
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
                lastSignatureRef.current = null;
                lastDataReadyKeyRef.current = '';
            } finally {
                isHydratingFromCloud.current = false;
                setIsHydrating(false);
                if (setIsLoading) setIsLoading(false);
                setTimeout(() => {
                    console.log('[Hydration:FINISHED]');
                }, 0);
                if (needsRetry.current) {
                    needsRetry.current = false;
                }
            }
        };

        reconstructSession();
    }, [isReady, dataReadyKey, effectiveUserId, activeReportId, setActiveReportId, savedReports, churches, learnedAssociations, setMatchResults, setHasActiveSession, overwriteSavedReport, showToast, handleCompare, isLoading, realtimeRefreshKey]);

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
        // Realtime sync handled via REST API & local state
        return () => {};
    }, [effectiveUserId, setMatchResults, realtimeRefreshKey]);

    /**
     * 🛡️ INTEGRIDADE DO CACHE (Anti-Stale)
     */
    useEffect(() => {
        if (!effectiveUserId || matchResults.length === 0 || isValidating.current) return;

        // Se for um update atômico de status/igreja, o ID hash com certeza não mudou
        if (batchState.isAtomicUpdate && lastValidatedHash.current) {
            return;
        }

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
            
            // Usamos uma assinatura fictícia simples de tamanho para evitar re-builds caros do array
            postProcessingSignatureRef.current = `atomic-skip-${matchResults.length}`;
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
        isHydratingFromCloud,
        isHydrating
    };
};
