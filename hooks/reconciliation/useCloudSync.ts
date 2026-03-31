import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { MatchResult } from '../../types';
import { PLACEHOLDER_CHURCH } from '../../services/processingService';
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
}

export const useCloudSync = ({
    user,
    effectiveUserId,
    matchResults,
    setMatchResults,
    setHasActiveSession,
    activeReportId,
    savedReports,
    churches
}: UseCloudSyncProps) => {
    const lastCloudSyncRef = useRef<string>('');
    const isHydratingFromCloud = useRef<boolean>(false);
    const [triggerSync, setTriggerSync] = useState(0);
    const lastValidatedHash = useRef<string>('');
    const isValidating = useRef<boolean>(false);

    // ☁️ SINCRONIZAÇÃO COM A NUVEM (Trabalho Vivo)
    const syncToCloud = useCallback(async (results: MatchResult[]) => {
        if (!user?.id || !effectiveUserId || isHydratingFromCloud.current) return;
        
        // Payload simplificado para comparação de mudanças reais
        const payload = JSON.stringify(results.map(r => ({
            id: r.transaction.id,
            status: r.status,
            churchId: r.church?.id || r._churchId,
            contributorId: r.contributor?.id
        })));

        if (payload === lastCloudSyncRef.current) return;
        lastCloudSyncRef.current = payload;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Sincroniza imediatamente
            await fetch('/api/reference/report/sync', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    reportId: `LIVE_SESSION_${effectiveUserId}`,
                    name: '[SESSÃO_ATIVA]',
                    data: { results }, // Envia os resultados completos
                    recordCount: results.length,
                    ownerId: effectiveUserId
                })
            });
        } catch (e) {
            console.error("[CloudSync] Erro ao sincronizar sessão ativa:", e);
        }
    }, [user?.id, effectiveUserId]);

    // Auto-save para a nuvem (mais frequente para evitar perda de dados)
    useEffect(() => {
        if (matchResults.length > 0 && !activeReportId) {
            const timer = setTimeout(() => syncToCloud(matchResults), 1000);
            return () => clearTimeout(timer);
        }
    }, [matchResults, activeReportId, syncToCloud]);

    // Hidratação e Vínculo com Objetos de Igreja
    useEffect(() => {
        if (!effectiveUserId || activeReportId || !churches.length) return;

        const liveReport = (savedReports || []).find((r: any) => r.name === '[SESSÃO_ATIVA]');
        if (liveReport && liveReport.data?.results) {
            const cloudResults = liveReport.data.results;
            
            // Compara se há mudança real na identificação ou status
            const cloudCheck = JSON.stringify(cloudResults.map((r: any) => ({ id: r.transaction.id, c: r.church?.id || r._churchId, s: r.status })));
            const localCheck = JSON.stringify(matchResults.map(r => ({ id: r.transaction.id, c: r.church?.id || r._churchId, s: r.status })));

            if (matchResults.length === 0 || cloudCheck !== localCheck) {
                isHydratingFromCloud.current = true;
                
                // RE-VINCULA os objetos de igreja (Hidratação)
                const hydratedResults = cloudResults.map((r: any) => {
                    const churchId = r.church?.id || r._churchId || (r.transaction as any)?.church_id;
                    const fullChurch = churches.find((c: any) => c.id === churchId);
                    return {
                        ...r,
                        church: fullChurch || r.church || PLACEHOLDER_CHURCH
                    };
                });

                setMatchResults(() => hydratedResults);
                setHasActiveSession(true);
                lastCloudSyncRef.current = JSON.stringify(hydratedResults.map((r: any) => ({
                    id: r.transaction.id,
                    status: r.status,
                    churchId: r.church?.id || r._churchId,
                    contributorId: r.contributor?.id
                })));
                
                setTimeout(() => { isHydratingFromCloud.current = false; }, 500);
            }
        }
    }, [savedReports, effectiveUserId, activeReportId, churches, setMatchResults, setHasActiveSession, matchResults]);

    /**
     * 📡 REALTIME SYNC (Escuta mudanças de confirmação)
     */
    useEffect(() => {
        if (!effectiveUserId) return;
        
        const channel = supabase
            .channel(`reconciliation-status-sync-${effectiveUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'consolidated_transactions',
                    filter: `user_id=eq.${effectiveUserId}`
                },
                (payload) => {
                    if (payload.new && payload.new.is_confirmed === true) {
                        // Força a re-validação do cache local
                        lastValidatedHash.current = '';
                        setTriggerSync(prev => prev + 1);
                    }
                }
            )
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [effectiveUserId]);

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
