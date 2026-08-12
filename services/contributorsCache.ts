/**
 * Singleton Cache para a lista de Contribuintes do Sistema.
 * Evita chamadas duplicadas ao backend /api/v1/contributors ao navegar entre telas ou hooks.
 */

interface CacheEntry {
    data: any[];
    timestamp: number;
}

let contributorsCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60000; // Cache válido por 1 minuto

export const getCachedContributors = async (forceRefresh = false): Promise<any[]> => {
    const now = Date.now();

    if (!forceRefresh && contributorsCache && (now - contributorsCache.timestamp < CACHE_TTL_MS)) {
        return contributorsCache.data;
    }

    try {
        const response = await fetch('/api/v1/contributors');
        if (response.ok) {
            const data = await response.json();
            const list = Array.isArray(data) ? data : [];
            contributorsCache = {
                data: list,
                timestamp: now
            };
            return list;
        }
    } catch (err) {
        console.error('[ContributorsCache] Error fetching contributors:', err);
    }

    return contributorsCache ? contributorsCache.data : [];
};

export const invalidateContributorsCache = () => {
    contributorsCache = null;
};
