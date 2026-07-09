import { MatchResult, Transaction, SavedReport } from '../types';
import React, { createContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useReferenceData } from '../hooks/useReferenceData';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportManager } from '../hooks/useReportManager';
import { useReconciliationActions } from '../hooks/useReconciliationActions';
import { useModalController } from '../hooks/useModalController';
import { useDataDeletion } from '../hooks/useDataDeletion';
import { useAiAutoIdentify } from '../hooks/useAiAutoIdentify';
import { useSummaryData } from '../hooks/useSummaryData';
import { supabase } from '../services/supabaseClient';
import { PLACEHOLDER_CHURCH } from '../services/processingService';
const ENABLE_HEAVY_LOGS = false;

export const AppContext = createContext<any>(null!);

/**
 * @frozen-architecture
 * 🛡️ APP CONTEXT ORCHESTRATION (THE HIVE)
 * Centralizador de estado e orquestração de hooks especializados.
 * 
 * REGRAS DE CONGELAMENTO:
 * 1. Manter o BLOQUEIO ABSOLUTO de hidratação de relatório quando a sessão cloud está ativa.
 * 2. O Broadcast Sync (sync-granular) deve permanecer como canal de comunicação leve e não persistente.
 * 3. Proibido unificar os fluxos de 'useCloudSync' e 'AppContext' para evitar loops reativos.
 * 4. Jamais remover os filtros de segurança (isSecondary check) que garantem multi-tenancy.
 */
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, subscription } = useAuth();
    const { showToast, setIsLoading, setActiveView, isLoading } = useUI();

    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

    const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0);

    // 📡 ESCUTA DE VISIBILIDADE / CONEXÃO (ROBUSTEZ PARA CELULAR, TABLET E NOTEBOOK)
    useEffect(() => {
        let lastTriggerTime = 0;
        const triggerRefresh = () => {
            const now = Date.now();
            if (now - lastTriggerTime < 1500) return; // debounce de 1.5s
            lastTriggerTime = now;
            
            console.log("[AppContext:RealtimeRefresh] Dispositivos / Foco reativado. Sincronizando canais de tempo real e forçando hidratação.");
            setRealtimeRefreshKey(prev => prev + 1);
            
            if (supabase && (supabase as any).realtime) {
                try {
                    (supabase as any).realtime.disconnect();
                    (supabase as any).realtime.connect();
                } catch (e) {
                    console.error("[AppContext:RealtimeRefresh] Erro ao reconectar cliente Supabase:", e);
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                triggerRefresh();
            }
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', triggerRefresh);
        window.addEventListener('online', triggerRefresh);

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', triggerRefresh);
            window.removeEventListener('online', triggerRefresh);
        };
    }, []);

    const modalController = useModalController();
    const referenceData = useReferenceData(user, showToast, realtimeRefreshKey);
    const reportManager = useReportManager(user, showToast, referenceData.reports, realtimeRefreshKey);

    const reconciliation = useReconciliation({
        user: user,
        subscription,
        churches: referenceData.churches,
        banks: referenceData.banks,
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance,
        contributionKeywords: referenceData.contributionKeywords,
        learnedAssociations: referenceData.learnedAssociations,
        savedReports: reportManager.savedReports,
        overwriteSavedReport: reportManager.overwriteSavedReport,
        showToast,
        isLoading,
        setIsLoading,
        setActiveView,
        searchFilters: reportManager.searchFilters,
        setSearchFilters: reportManager.setSearchFilters,
        realtimeRefreshKey
    });

    const viewSavedReport = useCallback(async (reportId: string) => {
        const report = reportManager.savedReports.find(r => r.id === reportId);
        if (ENABLE_HEAVY_LOGS) {
            console.log('[AUDIT][OPEN_REPORT_TRIGGER]', { reportId: report?.id, report });
        }
        if (!report) return;

        setIsLoading(true);
        try {
            let results;
            let spreadsheet;

            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const ownerId = subscription.ownerId || currentUser?.id;

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(`/api/reference/report/${reportId}?ownerId=${ownerId}`, {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const resData = await response.json();
                const rawData = resData.data;
                let parsedData;
                try {
                    parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                } catch (error) {
                    console.error("JSON corrompido detectado:", error);
                    parsedData = {
                        results: [],
                        spreadsheet: null
                    };
                }

                results = Array.isArray(parsedData) ? parsedData : parsedData?.transactions || parsedData?.results;
                spreadsheet = parsedData?.spreadsheet;
            } else {
                throw new Error("Falha ao buscar detalhes do relatório via API.");
            }

            if (((results || []).length > 0) || spreadsheet) {
                if (ENABLE_HEAVY_LOGS) {
                    console.log('[AUDIT][BEFORE_NAVIGATION]', { reportId });
                }
                reconciliation.setActiveReportId(reportId);
                reconciliation.setHasActiveSession(true);

                // Carrega dados da planilha se existirem
                if (spreadsheet) {
                    reconciliation.setActiveSpreadsheetData(spreadsheet);
                }

                if ((results || []).length > 0) {
                    const churchMap = new Map<string, any>();
                    (referenceData.churches || []).forEach((c: any) => {
                        if (c.id) churchMap.set(c.id, c);
                    });

                    let hydrated = (results || []).map((r: any) => ({
                        ...r,
                        church:
                            churchMap.get(r.church?.id || r._churchId) ||
                            r.church ||
                            PLACEHOLDER_CHURCH
                    }));

                    const isSecondary = (subscription.ownerId && subscription.ownerId !== user?.id) &&
                        subscription.role !== 'owner' &&
                        subscription.role !== 'admin' &&
                        subscription.role !== 'principal';
                    if (isSecondary && (subscription.congregationIds || []).length > 0) {
                        hydrated = (hydrated || []).filter((r: any) => {
                            const churchId = r.church?.id || r._churchId || 'unidentified';
                            return churchId === 'unidentified' || (subscription.congregationIds || []).includes(churchId);
                        });
                    }

                    reconciliation.setMatchResults(hydrated);
                    if (false) {
                        setActiveView('reports');
                    }
                } else if (spreadsheet) {
                    setActiveView('smart_analysis');
                }

                if (ENABLE_HEAVY_LOGS) {
                    console.log('[AUDIT][AFTER_NAVIGATION]', { reportId });
                }
                showToast(`Relatório "${report.name}" carregado.`, "success");
            } else {
                showToast("Este relatório está vazio.", "error");
            }

        } catch (error: any) {
            if (ENABLE_HEAVY_LOGS) {
                console.error('[AUDIT][LOAD_REPORT_ERROR]', error);
            }
            console.error("[AppContext] Erro ao abrir relatório:", error);
            showToast("Erro ao carregar os dados do relatório.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [reportManager.savedReports, referenceData.churches, reconciliation, setActiveView, setIsLoading, showToast]);

    // 🔄 SINCRONIZAÇÃO DE DADOS DO RELATÓRIO ATIVO (UNIFICADO)
    const lastLoadedReportId = useRef<string | null>(null);

    useEffect(() => {
        const activeId = reconciliation.activeReportId;
        if (!activeId || reconciliation.isHydratingFromCloud.current) {
            return;
        }

        const isNewReport = activeId !== lastLoadedReportId.current;
        const isEmpty = reconciliation.fullMatchResults.length === 0;

        if (isNewReport || isEmpty) {
            const savedReport = reportManager.savedReports.find(r => r.id === activeId);
            if (savedReport) {
                if (savedReport.data?.results?.length > 0) {
                    console.log("[AppContext:Hydration] Auto-carregando dados do relatório ativo:", activeId);
                    
                    const rawData = savedReport.data.results;
                    const churchMap = new Map<string, any>();
                    (referenceData.churches || []).forEach((c: any) => {
                        if (c.id) churchMap.set(c.id, c);
                    });

                    let hydrated = rawData.map((r: any) => ({
                        ...r,
                        church:
                            churchMap.get(r.church?.id || r._churchId) ||
                            r.church ||
                            PLACEHOLDER_CHURCH
                    }));

                    const isSecondary = (subscription.ownerId && subscription.ownerId !== user?.id) &&
                        subscription.role !== 'owner' &&
                        subscription.role !== 'admin' &&
                        subscription.role !== 'principal';
                    if (isSecondary && subscription.congregationIds?.length > 0) {
                        hydrated = hydrated.filter((r: any) => {
                            const churchId = r.church?.id || r._churchId || 'unidentified';
                            return churchId === 'unidentified' || subscription.congregationIds.includes(churchId);
                        });
                    }

                    reconciliation.setMatchResults(hydrated);
                    reconciliation.setHasActiveSession(true);
                    lastLoadedReportId.current = activeId;
                } else {
                    console.log("[AppContext:Hydration] Dados vazios na lista, buscando detalhes sob demanda:", activeId);
                    viewSavedReport(activeId).then(() => {
                        lastLoadedReportId.current = activeId;
                    }).catch(err => {
                        console.error("[AppContext:Hydration] Erro ao carregar detalhes sob demanda:", err);
                    });
                }
            }
        }
    }, [
        reconciliation.activeReportId,
        reconciliation.fullMatchResults.length,
        reportManager.savedReports,
        referenceData.churches,
        subscription,
        user,
        viewSavedReport
    ]);

    // Removido o segundo useEffect redundante que causava resets indesejados

    const persistActiveReport = useCallback(async (customResults?: MatchResult[]) => {
        // 🛡️ Prevenção de sobrescrita por dado antigo durante hidratação
        if (reconciliation.isHydratingFromCloud.current) {
            console.log("[AppContext] Persistência adiada: Hidratação em curso.");
            return;
        }

        const reportId = reconciliation.activeReportId;
        const resultsToSave = customResults || reconciliation.fullMatchResults;

        if (reportId && (resultsToSave.length > 0 || reportManager.savedReports.find(r => r.id === reportId)?.data?.spreadsheet)) {
            setIsSyncing(true);
            try {
                await reportManager.overwriteSavedReport(reportId, resultsToSave);
            } finally {
                setTimeout(() => setIsSyncing(false), 500);
            }
        } else if (!reportId && resultsToSave.length > 0) {
            // Se não há um relatório salvo, mas há dados, sincronizamos como sessão ativa
            reconciliation.syncToCloud(resultsToSave);
        }
    }, [reconciliation.activeReportId, reconciliation.fullMatchResults, reconciliation.syncToCloud, reportManager]);

    // 💾 AUTO-SAVE: Desativado em favor da atomização (cada clique salva individualmente)
    useEffect(() => {
        // O progresso agora é sincronizado via deltas em consolidated_transactions e learned_associations
    }, []);

    // 📡 REAL-TIME SYNC: Sincroniza o relatório ativo se houver mudanças remotas
    useEffect(() => {
        const ownerId = subscription.ownerId || user?.id;
        if (!ownerId) return;

        // Canal de Broadcast para sincronização granular em tempo real
        const channel = supabase
            .channel(`sync-granular-${ownerId}`)
            .on('broadcast', { event: 'transaction_updated' }, ({ payload }) => {
                console.log("[Sync:Broadcast] Recebendo atualização granular:", payload);
                
                // Atualização direta do estado conforme solicitado
                reconciliation.setMatchResults(prev =>
    prev.map(item => {
        if (item.transaction.id !== payload.transaction?.id) return item;

        return {
            ...item,

            // 🔥 ATUALIZAÇÃO EXPLÍCITA (ESSENCIAL)
            status: payload.status ?? item.status,
            isConfirmed: payload.isConfirmed ?? item.isConfirmed,
            contributionType: payload.contributionType ?? item.contributionType,
            paymentMethod: payload.paymentMethod ?? item.paymentMethod,
            contributor: payload.contributor ?? item.contributor,
            church: payload.church ?? item.church,

            // 🔒 transaction NÃO deve sobrescrever tudo
            transaction: {
                ...item.transaction,
                ...(payload.transaction || {})
            }
        };
    })
);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, subscription.ownerId]);

    // 🔄 SYNC DO RELATÓRIO SALVO (Via Tabelas)
    useEffect(() => {
        const activeId = reconciliation.activeReportId;
        
        // 🛡️ BLOQUEIO ABSOLUTO: Se existe sessão realtime ativa, o Sync Passivo do AppContext é desativado
        // para evitar rollback visual e loops reativos. O useCloudSync assume o controle.
        if (!activeId || isSyncing || isLoading || reconciliation.hasActiveSession) {
            return;
        }

        const savedReport = reportManager.savedReports.find(r => r.id === activeId);
        if (!savedReport || !savedReport.data?.results) return;

        const cloudResults = (savedReport.data.results || []) as MatchResult[];
        const localResults = reconciliation.fullMatchResults || [];
        
        const cloudTotal = cloudResults.length;
        const localTotal = localResults.length;

        // Se o tamanho é diferente, sincronizamos a lista toda
        if (cloudTotal !== localTotal && localTotal > 0) {
            console.log("[AppContext] Sincronizando mudança remota (tamanho) no relatório ativo.");
            const hydrated = cloudResults.map((r: any) => ({
                ...r,
                church: referenceData.churches.find((c: any) => c.id === (r.church?.id || r._churchId)) || r.church || PLACEHOLDER_CHURCH
            }));
            reconciliation.setMatchResults(hydrated);
            return;
        }

        // Se o tamanho é igual, checamos diferenças de conteúdo (Tipo, Forma, Status, Confirmação)
        const cloudSample = cloudResults.slice(0, 500).map((r: any) => `${r.status}-${r.isConfirmed}-${r.contributionType || ''}-${r.paymentMethod || ''}-${r.church?.id || r._churchId}`).join('|');
        const localSample = localResults.slice(0, 500).map((r: any) => `${r.status}-${r.isConfirmed}-${r.contributionType || ''}-${r.paymentMethod || ''}-${r.church?.id || r._churchId}`).join('|');

        if (cloudSample !== localSample && localTotal > 0) {
            console.log("[AppContext] Aplicando sincronização passiva de banco.");
            const hydrated = cloudResults.map((r: any) => ({
                ...r,
                church: referenceData.churches.find((c: any) => c.id === (r.church?.id || r._churchId)) || r.church || PLACEHOLDER_CHURCH
            }));
            reconciliation.setMatchResults(hydrated);
        }
    }, [reportManager.savedReports, reconciliation.activeReportId, referenceData.churches, reconciliation.fullMatchResults.length]);

    const wrappedConfirmSaveReport = useCallback(async (nameOrData: string | { name: string, spreadsheetData: any }) => {
        const newId = await reportManager.confirmSaveReport(nameOrData);
        // NÃO ativar automaticamente ao duplicar (objetos são duplicações ou salvamento direto de dados)
        // apenas ativar se for string (salvamento via modal de criação normal)
        if (newId && typeof nameOrData === 'string') {
            reconciliation.setActiveReportId(newId);
            reconciliation.setHasActiveSession(true);
        }
    }, [reportManager, reconciliation]);

    const reconciliationActions = useReconciliationActions({
        reconciliation,
        referenceData,
        reportManager,
        showToast,
        onAfterAction: persistActiveReport
    });

    const { confirmDeletion } = useDataDeletion({
        user: user,
        modalController,
        referenceData,
        reportManager,
        reconciliation,
        showToast
    });

    const { runAiAutoIdentification } = useAiAutoIdentify({
        reconciliation,
        referenceData,
        setIsLoading,
        showToast,
        onAfterIdentification: persistActiveReport
    });

    const summary = useSummaryData(reconciliation, reportManager, selectedBankId);

    const bankList = useMemo(() => {
        if (!referenceData.banks) return [];
        let list = referenceData.banks.map((b: any) => ({ id: b.id, name: b.account_name ?? b.name }));

        const isSecondary = (subscription.ownerId && subscription.ownerId !== user?.id) &&
            subscription.role !== 'owner' &&
            subscription.role !== 'admin' &&
            subscription.role !== 'principal';
        if (isSecondary) {
            const allowedIds = subscription.bankIds || [];
            if (allowedIds.length > 0) {
                list = list.filter((b: any) => allowedIds.includes(b.id));
            }
        }

        return list.sort((a: any, b: any) => a.name.localeCompare(b.name));
    }, [referenceData.banks, subscription, user?.id]);

    useEffect(() => {
        if (user !== undefined) setInitialDataLoaded(true);
    }, [user]);

    const value = useMemo(() => ({
        ...referenceData,
        ...reportManager,
        confirmSaveReport: wrappedConfirmSaveReport,
        ...reconciliation,
        ...reconciliationActions,
        ...modalController,
        initialDataLoaded,
        summary,
        isSyncing,
        selectedBankId,
        setSelectedBankId,
        bankList,
        saveCurrentReportChanges: persistActiveReport,
        confirmDeletion,
        runAiAutoIdentification,
        findMatchResult: reconciliation.findMatchResult,
        loadingAiId: reconciliation.loadingAiId,
        viewSavedReport
    }), [
        referenceData,
        reportManager,
        wrappedConfirmSaveReport,
        reconciliation,
        reconciliationActions,
        modalController,
        initialDataLoaded,
        summary,
        isSyncing,
        persistActiveReport,
        confirmDeletion,
        runAiAutoIdentification,
        viewSavedReport,
        selectedBankId,
        bankList
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};