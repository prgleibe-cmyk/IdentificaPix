import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { strictNormalize } from '../services/utils/parsingUtils';

export function useReferenceData(user?: any, showToast?: any) {
    const { subscription } = useAuth();
    const [data, setData] = useState({
        banks: [],
        churches: [],
        reports: [],
        fileModels: [],
        fetchModels: [],
        customIgnoreKeywords: [],
        contributionKeywords: [],
        learnedAssociations: [] as any[]
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const fetchData = useCallback(async () => {
        // Se não houver usuário ou ownerId, não podemos buscar dados reais ainda
        if (!user?.id || !subscription?.ownerId) {
            if (user !== undefined) setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const apiOwnerId = subscription.ownerId;
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Usando o endpoint real existente no projeto: /api/reference/data/:ownerId
            const response = await fetch(`/api/reference/data/${apiOwnerId}`, {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erro ao buscar dados de referência');
            }

            const result = await response.json();

            // Mapear associações aprendidas de snake_case para camelCase
            const mappedLearning = (result.learnedAssociations || []).map((la: any) => ({
                normalizedDescription: la.normalized_description,
                churchId: la.church_id,
                contributorNormalizedName: la.contributor_normalized_name
            }));

            setData({
                banks: result.banks || [],
                churches: result.churches || [],
                reports: result.reports || [],
                fileModels: result.fileModels || [],
                fetchModels: result.fetchModels || [],
                customIgnoreKeywords: result.customIgnoreKeywords || [],
                contributionKeywords: result.contributionKeywords || [],
                learnedAssociations: mappedLearning
            });

        } catch (err) {
            console.error("[useReferenceData] Erro ao carregar dados:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, subscription?.ownerId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const learnAssociation = async (result: any) => {
        if (!result.church?.id || !result.contributor?.name) return;

        const association = {
            normalizedDescription: strictNormalize(result.transaction.description),
            churchId: result.church.id,
            contributorNormalizedName: result.contributor.name
        };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch('/api/reference/learn', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ association })
            });

            if (response.ok) {
                // Atualiza localmente para feedback imediato
                setData(prev => ({
                    ...prev,
                    learnedAssociations: [...prev.learnedAssociations, association]
                }));
            }
        } catch (err) {
            console.error("[useReferenceData] Erro ao salvar associação:", err);
        }
    };

    return {
        ...data,
        similarityLevel: 55,
        dayTolerance: 2,
        data: data.churches, // Fallback para 'data' como solicitado no template
        loading,
        error,
        learnAssociation,
        refresh: fetchData
    };
}
