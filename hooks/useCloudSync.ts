import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { MatchResult } from '../types';
import { PLACEHOLDER_CHURCH } from '../services/processingService';

interface UseCloudSyncProps {
    user: any;
    effectiveUserId: string;
    matchResults: MatchResult[];
    setMatchResults: (results: MatchResult[]) => void;
    setHasActiveSession: (has: boolean) => void;
    activeReportId: string | null;
    savedReports: any[];
    churches: any[];
}

/**
 * @frozen-architecture
 * 🛡️ CLOUD SYNC & SESSION RECONSTRUCTION
 * Esta lógica é crítica para a consistência multi-usuário e integridade dos dados.
 * 
 * REGRAS DE CONGELAMENTO:
 * 1. Não substituir a hidratação incremental por reconstrução total automática.
 * 2. Manter a detecção de mudanças baseada em payload (lastCloudSyncRef).
 * 3. Preservar o vínculo com objetos de igreja (Hidratação) para manter a UI estável.
 */
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

    // ☁️ SINCRONIZAÇÃO COM A NUVEM (Trabalho Vivo)
    const syncToCloud = useCallback(async (results: MatchResult[]) => {
        if (!user?.id || !effectiveUserId || isHydratingFromCloud.current) return;
        
        // Payload simplificado para comparação de mudanças reais
        // Incluindo Tipo e Forma para garantir que alterações manuais disparem a sincronização
        const payload = JSON.stringify(results.map(r => ({
            id: r.transaction.id,
            status: r.status,
            churchId: r.church?.id || r._churchId,
            contributorId: r.contributor?.id,
            type: r.contributionType,
            form: r.paymentMethod
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

                setMatchResults(hydratedResults);
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
    }, [savedReports, effectiveUserId, activeReportId, churches]);

    return {
        syncToCloud,
        isHydratingFromCloud
    };
};
