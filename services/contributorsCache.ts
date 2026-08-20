/**
 * Singleton Cache para a lista de Contribuintes do Sistema.
 * Evita chamadas duplicadas ao backend /api/v1/contributors ao navegar entre telas ou hooks.
 */

import { fetchWithMemoryCache, invalidateClientCache } from './clientDataCache';

export const getCachedContributors = async (forceRefresh = false): Promise<any[]> => {
    const list = await fetchWithMemoryCache<any[]>('/api/v1/contributors', {}, {
        ttlMs: 45000, // 45 seconds cache
        forceRefresh
    });
    return Array.isArray(list) ? list : [];
};

export const invalidateContributorsCache = () => {
    invalidateClientCache('/api/v1/contributors');
};

