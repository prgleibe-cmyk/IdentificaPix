import { useState, useEffect, useCallback } from 'react';

export interface ContributionRequestDetails {
    id: string;
    church_id: string;
    contributor_id: string;
    amount: number;
    description?: string;
    status: 'pending' | 'confirmed' | string;
    created_at: string;
    updated_at?: string;
}

export function useContributionRequestPolling(requestId?: string, churchId?: string) {
    const [requestDetails, setRequestDetails] = useState<ContributionRequestDetails | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const fetchStatus = useCallback(async () => {
        if (!requestId) return;

        try {
            let url = `/api/v1/contribution-requests/${encodeURIComponent(requestId)}`;
            if (churchId) {
                url += `?church_id=${encodeURIComponent(churchId)}`;
            }

            const response = await fetch(url, { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                setRequestDetails({
                    id: data.id,
                    church_id: data.church_id,
                    contributor_id: data.contributor_id,
                    amount: Number(data.amount),
                    description: data.description,
                    status: data.status,
                    created_at: data.created_at,
                    updated_at: data.updated_at
                });
            }
        } catch (err) {
            console.error('[useContributionRequestPolling] Erro ao consultar status da solicitação:', err);
        }
    }, [requestId, churchId]);

    useEffect(() => {
        if (!requestId) {
            setRequestDetails(null);
            return;
        }

        // Initial fetch immediately
        fetchStatus();

        // Polling interval ~ 10 seconds (10000ms)
        const intervalId = setInterval(() => {
            fetchStatus();
        }, 10000);

        return () => {
            clearInterval(intervalId);
        };
    }, [requestId, churchId, fetchStatus]);

    return {
        requestDetails,
        refetch: fetchStatus
    };
}
