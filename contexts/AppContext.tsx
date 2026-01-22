
import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useReferenceData } from '../hooks/useReferenceData';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportManager } from '../hooks/useReportManager';
import { useReconciliationActions } from '../hooks/useReconciliationActions';
import { useModalController } from '../hooks/useModalController';
import { useDataDeletion } from '../hooks/useDataDeletion';
import { supabase } from '../services/supabaseClient';
import { 
    MatchResult, 
    Transaction,
    ReconciliationStatus,
    MatchMethod
} from '../types';
import { groupResultsByChurch, normalizeString } from '../services/processingService';

export const AppContext = createContext<any>(null!);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, systemSettings } = useAuth();
    const { showToast, setIsLoading, setActiveView } = useUI();
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);

    const modalController = useModalController();
    const referenceData = useReferenceData(user, showToast);
    const reportManager = useReportManager(user, showToast);
    
    // --- ESTADO DE AUTOMAÇÃO ---
    const [automationMacros, setAutomationMacros] = useState<any[]>([]);

    const fetchMacros = useCallback(async (silent = false) => {
        if (!user) return;
        if (!silent) console.log("[AppContext] Buscando macros no banco para o usuário:", user.id);
        
        const { data, error } = await supabase
            .from('automation_macros')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error("[AppContext] Erro ao buscar macros:", error.message);
            return;
        }
        if (data) {
            console.log("[AppContext] Macros carregadas com sucesso:", data.length);
            setAutomationMacros(data);
        }
    }, [user]);

    useEffect(() => {
        fetchMacros();
    }, [fetchMacros]);

    const effectiveIgnoreKeywords = useMemo(() => {
        return [...(referenceData.customIgnoreKeywords || []), ...(systemSettings.globalIgnoreKeywords || [])];
    }, [referenceData.customIgnoreKeywords, systemSettings.globalIgnoreKeywords]);

    const reconciliation = useReconciliation({
        user,
        churches: referenceData.churches,
        banks: referenceData.banks,
        fileModels: referenceData.fileModels,
        similarityLevel: referenceData.similarityLevel,
        dayTolerance: referenceData.dayTolerance,
        customIgnoreKeywords: effectiveIgnoreKeywords,
        contributionKeywords: referenceData.contributionKeywords,
        learnedAssociations: referenceData.learnedAssociations,
        showToast,
        setIsLoading,
        setActiveView
    });

    const reconciliationActions = useReconciliationActions({
        reconciliation,
        referenceData,
        showToast
    });

    const { confirmDeletion } = useDataDeletion({
        user,
        modalController,
        referenceData,
        reportManager,
        reconciliation,
        showToast
    });

    const [isSyncing, setIsSyncing] = useState(false);

    // --- LISTENER DA EXTENSÃO ATUALIZADO (V4) ---
    useEffect(() => {
        const handleExtensionMessage = async (event: MessageEvent) => {
            // Aceita mensagens tanto diretas quanto via chrome.runtime bridge
            if (!event.data || event.data.source !== "IdentificaPixExt") return;

            const { type, payload } = event.data;
            console.log(`%c[AppContext] MENSAGEM RECEBIDA DA EXTENSÃO: ${type}`, "color: #8b5cf6; font-weight: bold;");

            if (type === "SAVE_TRAINING" && user) {
                console.log("[AppContext] Iniciando salvamento da macro no Supabase...");
                setIsLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('automation_macros')
                        .insert({
                            user_id: user.id,
                            name: `Macro ${payload.bankName || 'Treino'} - ${new Date().toLocaleTimeString()}`,
                            steps: payload.steps,
                            target_url: payload.targetUrl || null
                        })
                        .select();

                    if (error) throw error;
                    
                    console.log("[AppContext] Macro salva no DB com ID:", data[0].id);
                    // Atualização imediata do estado
                    setAutomationMacros(prev => [data[0], ...prev]);
                    showToast("IA: Novo percurso aprendido e habilitado!", "success");
                } catch (e: any) {
                    console.error("[AppContext] ERRO CRÍTICO AO SALVAR MACRO NO BANCO:", e.message);
                    showToast("Erro ao salvar aprendizado no banco de dados.", "error");
                } finally {
                    setIsLoading(false);
                }
            }
        };

        window.addEventListener("message", handleExtensionMessage);
        return () => window.removeEventListener("message", handleExtensionMessage);
    }, [user, setIsLoading, showToast]);

    const saveSmartEdit = useCallback((result: MatchResult) => {
        reconciliation.updateReportData(result);
        if (result.status === 'IDENTIFICADO' && result.contributor && result.church) {
             referenceData.learnAssociation(result);
        }
        modalController.closeSmartEdit();
        showToast("Identificação atualizada.", "success");
    }, [reconciliation, referenceData, modalController, showToast]);

    const openManualIdentify = useCallback((txId: string) => {
        const tx = reconciliation.matchResults.find((r: any) => r.transaction.id === txId)?.transaction;
        if (tx) reconciliation.setManualIdentificationTx(tx);
    }, [reconciliation]);

    const runAiAutoIdentification = useCallback(() => {
        if (reconciliation.matchResults.length === 0) return;
        
        setIsLoading(true);
        let identifiedCount = 0;
        
        const currentResults = [...reconciliation.matchResults];
        const nextResults = currentResults.map(res => {
            if (res.status === ReconciliationStatus.UNIDENTIFIED) {
                const txDescNorm = normalizeString(res.transaction.description, effectiveIgnoreKeywords);
                const learned = referenceData.learnedAssociations.find((la: any) => la.normalizedDescription === txDescNorm);
                
                if (learned) {
                    const church = referenceData.churches.find((c: any) => c.id === learned.churchId);
                    if (church) {
                        identifiedCount++;
                        return {
                            ...res,
                            status: ReconciliationStatus.IDENTIFIED,
                            church: church,
                            matchMethod: MatchMethod.LEARNED,
                            similarity: 100,
                            contributor: res.suggestion || { name: learned.contributorNormalizedName, amount: res.transaction.amount },
                            contributorAmount: res.transaction.amount,
                            suggestion: undefined
                        };
                    }
                }

                if (res.suggestion && (res.similarity || 0) >= 90) {
                    const churchId = (res.suggestion as any)._churchId || res.suggestion.church?.id;
                    const church = referenceData.churches.find((c: any) => c.id === churchId);
                    
                    if (church) {
                        identifiedCount++;
                        return {
                            ...res,
                            status: ReconciliationStatus.IDENTIFIED,
                            contributor: res.suggestion,
                            church: church,
                            matchMethod: MatchMethod.AI,
                            similarity: res.similarity,
                            contributorAmount: res.suggestion.amount,
                            suggestion: undefined
                        };
                    }
                }
            }
            return res;
        });

        if (identifiedCount > 0) {
            reconciliation.setMatchResults(nextResults);
            const incomeResults = nextResults.filter(r => r.transaction.amount >= 0 || r.status === ReconciliationStatus.PENDING);
            const expenseResults = nextResults.filter(r => r.transaction.amount < 0 && r.status !== ReconciliationStatus.PENDING);

            reconciliation.setReportPreviewData({
                income: groupResultsByChurch(incomeResults),
                expenses: { 'all_expenses_group': expenseResults }
            });

            showToast(`${identifiedCount} transações identificadas automaticamente.`, "success");
        } else {
            showToast("Nenhuma sugestão de alta confiança encontrada.", "info");
        }
        
        setIsLoading(false);
    }, [reconciliation, referenceData, effectiveIgnoreKeywords, setIsLoading, showToast]);

    const handleGmailSyncSuccess = useCallback((transactions: Transaction[]) => {
        reconciliation.importGmailTransactions(transactions);
        setTimeout(() => reconciliation.handleCompare(), 500);
    }, [reconciliation]);

    const summary = useMemo(() => {
        const results = reconciliation.matchResults;
        const hasSession = reconciliation.hasActiveSession;
        
        let identifiedCount = 0;
        let unidentifiedCount = 0;
        let totalValue = 0;
        let valuePerChurch: [string, number][] = [];
        let methodBreakdown: Record<string, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
        
        let autoVal = 0, manualVal = 0, pendingVal = 0;

        if (hasSession && results.length > 0) {
            identifiedCount = results.filter((r: any) => r.status === 'IDENTIFICADO').length;
            unidentifiedCount = results.filter((r: any) => r.status === 'NÃO IDENTIFICADO' || r.status === 'PENDENTE').length;
            
            results.forEach((r: any) => {
                if (r.status === 'IDENTIFICADO') {
                    const val = r.transaction.amount;
                    totalValue += val;
                    if (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI') manualVal += val;
                    else autoVal += val;
                    
                    const method = r.matchMethod || 'AUTOMATIC';
                    methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
                } else {
                    pendingVal += (r.contributorAmount || r.transaction.amount);
                }
            });

            const grouped = groupResultsByChurch(results.filter((r: any) => r.status === 'IDENTIFICADO'));
            valuePerChurch = Object.values(grouped).map((group: any) => {
                const churchName = group[0]?.church?.name || 'Desconhecida';
                const total = (group as any[]).reduce((acc: number, curr: any) => acc + curr.transaction.amount, 0);
                return [churchName, total] as [string, number];
            }).sort((a, b) => b[1] - a[1]);

        } else if (reportManager.savedReports.length > 0) {
            reportManager.savedReports.forEach(rep => {
                if (rep.data && rep.data.results) {
                    const repResults = rep.data.results as MatchResult[];
                    identifiedCount += repResults.filter(r => r.status === 'IDENTIFICADO').length;
                    
                    repResults.forEach(r => {
                        if (r.status === 'IDENTIFICADO') {
                            const method = r.matchMethod || 'AUTOMATIC';
                            methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
                        }
                    });
                }
            });
        }

        return {
            identifiedCount,
            unidentifiedCount,
            totalValue,
            autoConfirmed: { value: autoVal },
            manualConfirmed: { value: manualVal },
            pending: { value: pendingVal },
            valuePerChurch,
            methodBreakdown,
            isHistorical: !hasSession && reportManager.savedReports.length > 0
        };
    }, [reconciliation.matchResults, reconciliation.hasActiveSession, reportManager.savedReports]);

    const activeSpreadsheetData = useMemo(() => {
        if (!reconciliation.activeReportId) return undefined;
        const report = reportManager.savedReports.find(r => r.id === reconciliation.activeReportId);
        return report?.data?.spreadsheet;
    }, [reconciliation.activeReportId, reportManager.savedReports]);

    useEffect(() => {
        if (user !== undefined) setInitialDataLoaded(true);
    }, [user]);

    const value = useMemo(() => ({
        ...referenceData,
        effectiveIgnoreKeywords,
        ...reportManager,
        ...reconciliation,
        ...reconciliationActions,
        ...modalController,
        automationMacros,
        fetchMacros,
        initialDataLoaded,
        summary,
        activeSpreadsheetData,
        saveSmartEdit,
        isSyncing,
        handleGmailSyncSuccess,
        confirmDeletion,
        openManualIdentify,
        runAiAutoIdentification
    }), [
        referenceData, effectiveIgnoreKeywords, reportManager, reconciliation, reconciliationActions,
        modalController, automationMacros, fetchMacros, initialDataLoaded, summary, activeSpreadsheetData, 
        saveSmartEdit, isSyncing, handleGmailSyncSuccess, confirmDeletion, openManualIdentify,
        runAiAutoIdentification
    ]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
