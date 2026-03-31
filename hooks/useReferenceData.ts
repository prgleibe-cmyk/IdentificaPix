import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

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
        learnedAssociations: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        async function fetchData() {
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

                setData({
                    banks: result.banks || [],
                    churches: result.churches || [],
                    reports: result.reports || [],
                    // Mantendo campos extras para compatibilidade com AppContext
                    fileModels: result.fileModels || [],
                    fetchModels: result.fetchModels || [],
                    customIgnoreKeywords: result.customIgnoreKeywords || [],
                    contributionKeywords: result.contributionKeywords || [],
                    learnedAssociations: result.learnedAssociations || []
                });

            } catch (err) {
                console.error("[useReferenceData] Erro ao carregar dados:", err);
                setError(err);
                setData({
                    banks: [],
                    churches: [],
                    reports: [],
                    fileModels: [],
                    fetchModels: [],
                    customIgnoreKeywords: [],
                    contributionKeywords: [],
                    learnedAssociations: []
                });
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [user?.id, subscription?.ownerId]);

    return {
        ...data,
        similarityLevel: 55,
        dayTolerance: 2,
        data: data.churches, // Fallback para 'data' como solicitado no template
        loading,
        error
    };
}
