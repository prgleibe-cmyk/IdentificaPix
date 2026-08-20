/**
 * Generic In-Memory & SWR Cache with ETag / TTL Support for IdentificaPix
 * Provides instantaneous (0ms) reads on tab switching and background revalidation.
 */

interface CacheRecord<T> {
    data: T;
    timestamp: number;
    etag?: string;
}

const memoryStore = new Map<string, CacheRecord<any>>();

export interface CacheOptions {
    ttlMs?: number; // default: 60s
    forceRefresh?: boolean;
}

export const fetchWithMemoryCache = async <T>(
    url: string,
    options: RequestInit = {},
    cacheOptions: CacheOptions = {}
): Promise<T> => {
    const { ttlMs = 60000, forceRefresh = false } = cacheOptions;
    const now = Date.now();
    const cached = memoryStore.get(url) as CacheRecord<T> | undefined;

    // Return immediate memory cache if still fresh and not forced
    if (!forceRefresh && cached && (now - cached.timestamp < ttlMs)) {
        return cached.data;
    }

    try {
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string> || {})
        };

        if (cached?.etag && !forceRefresh) {
            headers['If-None-Match'] = cached.etag;
        }

        const res = await fetch(url, {
            ...options,
            headers
        });

        // 304 Not Modified
        if (res.status === 304 && cached) {
            cached.timestamp = now;
            return cached.data;
        }

        if (res.ok) {
            const data = await res.json();
            const etag = res.headers.get('ETag') || undefined;

            memoryStore.set(url, {
                data,
                timestamp: now,
                etag
            });

            return data;
        }
    } catch (err) {
        console.warn(`[ClientCache] Error fetching ${url}, falling back to cache:`, err);
    }

    return cached ? cached.data : ([] as unknown as T);
};

export const invalidateClientCache = (urlPattern?: string | RegExp) => {
    if (!urlPattern) {
        memoryStore.clear();
        return;
    }

    for (const key of memoryStore.keys()) {
        if (typeof urlPattern === 'string') {
            if (key.includes(urlPattern)) {
                memoryStore.delete(key);
            }
        } else if (urlPattern.test(key)) {
            memoryStore.delete(key);
        }
    }
};
