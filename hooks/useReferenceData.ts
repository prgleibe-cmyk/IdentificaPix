import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { usePersistentState } from './usePersistentState';
import { SavedReport, SearchFilters, SavingReportState, MatchResult, SpreadsheetData } from '../types';

export function useReferenceData(user?: any, showToast?: any) {
    const { subscription } = useAuth();
    const [churches, setChurches] = useState<any[]>([]);
    const [banks, setBanks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Outros estados para manter compatibilidade
    const [fileModels, setFileModels] = useState<any[]>([]);
    const [fetchModels, setFetchModels] = useState<any[]>([]);
    const [similarityLevel] = useState(55);
    const [dayTolerance] = useState(2);
    const [customIgnoreKeywords, setCustomIgnoreKeywords] = useState<any[]>([]);
    const [contributionKeywords, setContributionKeywords] = useState<any[]>([]);
    const [learnedAssociations, setLearnedAssociations] = useState<any[]>([]);

    useEffect(() => {
        let ignore = false;

        const loadData = async () => {
            try {
                setLoading(true);
                
                // PRIORIDADE 1: localStorage
                const stored = localStorage.getItem('referenceData');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.churches) setChurches(parsed.churches);
                    if (parsed.banks) setBanks(parsed.banks);
                    if (parsed.fileModels) setFileModels(parsed.fileModels);
                    if (parsed.fetchModels) setFetchModels(parsed.fetchModels);
                    if (parsed.customIgnoreKeywords) setCustomIgnoreKeywords(parsed.customIgnoreKeywords);
                    if (parsed.contributionKeywords) setContributionKeywords(parsed.contributionKeywords);
                    if (parsed.learnedAssociations) setLearnedAssociations(parsed.learnedAssociations);
                }

                // PRIORIDADE 2: API se tivermos ownerId
                if (user?.id && subscription?.ownerId) {
                    const apiOwnerId = subscription.ownerId;
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    const response = await fetch(`/api/reference/data/${apiOwnerId}`, {
                        method: 'GET',
                        cache: 'no-store',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const resData = await response.json();
                        if (ignore) return;

                        if (resData.churches) setChurches(resData.churches);
                        if (resData.banks) setBanks(resData.banks);
                        
                        // Salvar no localStorage para próxima vez
                        const newData = {
                            ...JSON.parse(localStorage.getItem('referenceData') || '{}'),
                            churches: resData.churches || [],
                            banks: resData.banks || []
                        };
                        localStorage.setItem('referenceData', JSON.stringify(newData));
                    }
                }
            } catch (err: any) {
                console.error("[useReferenceData] Erro ao carregar dados:", err);
                setError(err.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        };

        loadData();
        return () => { ignore = true; };
    }, [user?.id, subscription?.ownerId]);

    return {
        churches,
        banks,
        fileModels,
        fetchModels,
        similarityLevel,
        dayTolerance,
        customIgnoreKeywords,
        contributionKeywords,
        learnedAssociations,
        data: churches, // Fallback para 'data' como solicitado no template
        loading,
        error
    };
}
