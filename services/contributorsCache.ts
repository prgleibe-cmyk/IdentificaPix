/**
 * Singleton Cache para a lista de Contribuintes do Sistema.
 * Evita chamadas duplicadas ao backend /api/v1/contributors ao navegar entre telas ou hooks.
 */

import { fetchWithMemoryCache, invalidateClientCache } from './clientDataCache';

const CONTRIBUTORS_SYNC_CHANNEL = 'iggestor_contributors_sync';

export const getCachedContributors = async (forceRefresh = false): Promise<any[]> => {
    const list = await fetchWithMemoryCache<any[]>('/api/v1/contributors', {}, {
        ttlMs: forceRefresh ? 0 : 30000,
        forceRefresh
    });
    return Array.isArray(list) ? list : [];
};

export const invalidateContributorsCache = () => {
    invalidateClientCache('/api/v1/contributors');
};

/**
 * Notifies all open tabs, windows and components that a contributor was created or updated.
 * Dispatches via memory cache invalidation, window CustomEvent, BroadcastChannel, and localStorage storage event.
 */
export const notifyContributorUpdated = (contributorData?: any) => {
    // 1. Invalidate local client-side memory cache
    invalidateContributorsCache();

    // 2. Dispatch local custom event for current window
    if (typeof window !== 'undefined') {
        try {
            window.dispatchEvent(new CustomEvent('contributor_updated', { detail: contributorData }));
        } catch (_) {}

        // 3. Post to HTML5 BroadcastChannel for immediate cross-tab synchronization
        try {
            if ('BroadcastChannel' in window) {
                const channel = new BroadcastChannel(CONTRIBUTORS_SYNC_CHANNEL);
                channel.postMessage({ type: 'contributor_updated', data: contributorData, timestamp: Date.now() });
                channel.close();
            }
        } catch (_) {}

        // 4. Update localStorage heartbeat key to trigger native cross-window 'storage' events
        try {
            localStorage.setItem('iggestor_last_contributor_sync', String(Date.now()));
            window.dispatchEvent(new Event('storage'));
        } catch (_) {}
    }
};

/**
 * Subscribes a component to real-time contributor updates across all tabs and components.
 * Returns an unsubscribe cleanup function.
 */
export const subscribeToContributorUpdates = (onUpdate: (data?: any) => void): (() => void) => {
    if (typeof window === 'undefined') return () => {};

    const handleCustomEvent = (e: any) => {
        onUpdate(e?.detail);
    };

    const handleStorageEvent = (e: StorageEvent | Event) => {
        if ('key' in e && e.key && e.key !== 'iggestor_last_contributor_sync' && e.key !== 'iggestor_portal_contributor') {
            return;
        }
        onUpdate();
    };

    window.addEventListener('contributor_updated', handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);

    let broadcastChannel: BroadcastChannel | null = null;
    try {
        if ('BroadcastChannel' in window) {
            broadcastChannel = new BroadcastChannel(CONTRIBUTORS_SYNC_CHANNEL);
            broadcastChannel.onmessage = (event) => {
                if (event?.data?.type === 'contributor_updated') {
                    invalidateContributorsCache();
                    onUpdate(event.data.data);
                }
            };
        }
    } catch (_) {}

    return () => {
        window.removeEventListener('contributor_updated', handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
        if (broadcastChannel) {
            try {
                broadcastChannel.close();
            } catch (_) {}
        }
    };
};

