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
    timeoutMs?: number; // default: 15s
}

export const fetchWithTimeout = async (
    url: string,
    options: RequestInit = {},
    timeoutMs: number = 15000
): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timer);
        return response;
    } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new Error(`Tempo limite de conexão esgotado (${timeoutMs / 1000}s). Verifique sua internet.`);
        }
        throw err;
    }
};

export const fetchWithMemoryCache = async <T>(
    url: string,
    options: RequestInit = {},
    cacheOptions: CacheOptions = {}
): Promise<T> => {
    const { ttlMs = 60000, forceRefresh = false, timeoutMs = 15000 } = cacheOptions;
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
        } else if (forceRefresh) {
            headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            headers['Pragma'] = 'no-cache';
        }

        const res = await fetchWithTimeout(url, {
            ...options,
            cache: forceRefresh ? 'no-store' : options.cache,
            headers
        }, timeoutMs);

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
