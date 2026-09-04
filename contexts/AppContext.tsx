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
import { getAuthToken, getAuthSession } from '../services/auth/authAdapter';
import { PLACEHOLDER_CHURCH } from '../services/processingService';
import { resolveContributionType } from '../utils/formatters';
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
    const { user, subscription, isSubscriptionReady } = useAuth();
    const { showToast, setIsLoading, setActiveView, isLoading } = useUI();

    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

    const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0);

    // 📡 ESCUTA DE SINCRONIZAÇÃO EM TEMPO REAL (Multi-dispositivos, abas e reconexão)
    useEffect(() => {
        let lastTriggerTime = 0;
        const triggerRefresh = () => {
            const now = Date.now();
            if (now - lastTriggerTime < 4000) return; // debounce de 4s
            lastTriggerTime = now;
            
            console.log("[AppContext:RealtimeRefresh] Sincronização em tempo real acionada.");
            setRealtimeRefreshKey(prev => prev + 1);
        };

        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible') {
                triggerRefresh();
            }
        };

        window.addEventListener('online', triggerRefresh);
        document.addEventListener('visibilitychange', handleVisibilityOrFocus);
        window.addEventListener('focus', handleVisibilityOrFocus);

        // Polling suave em segundo plano para manter dados sincronizados entre múltiplos aparelhos/usuários
        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible' && user?.id) {
                triggerRefresh();
            }
        }, 15000);

        // BroadcastChannel para sincronização instantânea entre abas no mesmo navegador
        let bc: BroadcastChannel | null = null;
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                bc = new BroadcastChannel('identificapix_realtime_sync');
                bc.onmessage = (event) => {
                    if (event.data?.type === 'TRANSACTION_UPDATED') {
                        triggerRefresh();
                    }
                };
            } catch (e) {
                // Ignore
            }
        }

        return () => {
            window.removeEventListener('online', triggerRefresh);
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
            window.removeEventListener('focus', handleVisibilityOrFocus);
            clearInterval(intervalId);
            if (bc) bc.close();
        };
    }, [user?.id]);

    const modalController = useModalController();
    const referenceData = useReferenceData(user, showToast, realtimeRefreshKey);
    const reportManager = useReportManager(user, showToast, referenceData.reports, realtimeRefreshKey);

    const isReferenceReady = Boolean(isSubscriptionReady && referenceData.isReady);

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
        realtimeRefreshKey,
        isReferenceReady
    });

    const initialDataLoaded = Boolean(
        !user || (isSubscriptionReady && referenceData.isReady && reportManager.isReportsReady && (reconciliation.hasCompletedInitialHydration || !isReferenceReady))
    );

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

            const session = await getAuthSession();
            const currentUser = session?.user;
            const ownerId = subscription.ownerId || currentUser?.id;

            const token = await getAuthToken();

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

        // Se o tamanho é igual, checamos diferenças de conteúdo (Tipo, Forma, Status, Confirmação, Splits)
        const cloudSample = cloudResults.slice(0, 500).map((r: any) => `${r.status}-${r.isConfirmed}-${r.contributionType || ''}-${r.paymentMethod || ''}-${r.church?.id || r._churchId}-${r.splits ? JSON.stringify(r.splits) : ''}`).join('|');
        const localSample = localResults.slice(0, 500).map((r: any) => `${r.status}-${r.isConfirmed}-${r.contributionType || ''}-${r.paymentMethod || ''}-${r.church?.id || r._churchId}-${r.splits ? JSON.stringify(r.splits) : ''}`).join('|');

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

    const summary = useSummaryData(reconciliation, reportManager, selectedBankId, referenceData.churches);

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

    // 📊 DADOS CONSOLIDADOS PARA RELATÓRIOS E LIVRO CAIXA
    const reportData = useMemo(() => {
        const results = reconciliation.fullMatchResults || reconciliation.matchResults || [];

        const churchMap = new Map<string, any>();
        (referenceData.churches || []).forEach((c: any) => {
            if (c.id) churchMap.set(c.id, c);
        });

        const bankMap = new Map<string, any>();
        (referenceData.banks || []).forEach((b: any) => {
            if (b.id) bankMap.set(b.id, b);
        });

        return results.map((r: any) => {
            const tx = r.transaction || {};
            const contrib = r.contributor || {};
            const churchObj = churchMap.get(r.church?.id || r._churchId || tx.church_id) || r.church || {};

            const bankId = tx.bank_id || tx.bankId || r.bank_id || r.bankId || r._bankId || r.bank?.id || '';
            const bankObj = bankMap.get(bankId) || r.bank || {};
            const bankName = bankObj.account_name || bankObj.name || (typeof bankObj === 'string' ? bankObj : '');

            const refDateRaw = contrib.reference_date || r.reference_date || tx.reference_date || '';
            const bankDateRaw = tx.date || contrib.date || r.launchedAt || '';
            const dateRaw = refDateRaw || bankDateRaw;
            const dateClean = dateRaw ? String(dateRaw).split('T')[0] : '';
            const bankDateClean = bankDateRaw ? String(bankDateRaw).split('T')[0] : '';
            const refDateClean = refDateRaw ? String(refDateRaw).split('T')[0] : '';

            const desc = tx.description || tx.rawDescription || contrib.name || 'Lançamento de Caixa';
            const payer = contrib.name || (r.status === 'IDENTIFICADO' ? (contrib.cleanedName || contrib.name) : null) || 'NÃO IDENTIFICADO';
            const resolvedType = resolveContributionType(r, referenceData.contributionTypes, referenceData.contributionKeywords);
            const category = r.contributionType || tx.contributionType || contrib.contributionType || resolvedType || 'Geral';
            const paymentMethod = r.paymentMethod || tx.paymentMethod || contrib.paymentMethod || 'PIX';
            const churchName = churchObj.name || (typeof churchObj === 'string' ? churchObj : 'Igreja Sede');
            const churchId = churchObj.id || r._churchId || tx.church_id || '';

            const amount = Number(tx.amount) || Number(r.contributorAmount) || Number(contrib.amount) || 0;
            const isExpense = amount < 0 || 
                tx.type === 'expense' || 
                tx.type === 'saida' || 
                (category && category.toLowerCase().includes('saida')) ||
                (category && category.toLowerCase().includes('saída'));

            return {
                id: tx.id || r.id || r._injectedId,
                date: dateClean,
                reference_date: refDateClean || null,
                referenceDate: refDateClean || null,
                bank_date: bankDateClean || null,
                bankDate: bankDateClean || null,
                desc: desc,
                description: desc,
                historico: desc,
                payer: payer,
                contribuinte: payer,
                nome: payer,
                category: category,
                categoria: category,
                contributionType: category,
                categoryName: category,
                paymentMethod: paymentMethod,
                forma: paymentMethod,
                church: churchName,
                churchId: churchId,
                bankId: bankId,
                bankName: bankName,
                amount: amount,
                val: amount,
                type: isExpense ? 'expense' : 'income',
                status: r.status,
                isConfirmed: r.isConfirmed,
                splits: (Array.isArray(r.splits) && r.splits.length > 0) ? r.splits : ((Array.isArray(tx.splits) && tx.splits.length > 0) ? tx.splits : null),
                attachments: r.attachments || tx.attachments || null,
                raw: r
            };
        });
    }, [reconciliation.fullMatchResults, reconciliation.matchResults, reportManager.savedReports, referenceData.churches, referenceData.banks, referenceData.contributionTypes, referenceData.contributionKeywords]);

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
        reportData,
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
        bankList,
        reportData
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};