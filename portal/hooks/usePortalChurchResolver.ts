import { useState, useEffect } from 'react';
import { PortalChurch } from '../types/portal';

const CACHE_KEY = 'iggestor_portal_churches_cache';
const ACTIVE_CHURCH_SLUG_KEY = 'iggestor_portal_active_church_slug';

const DEFAULT_PORTAL_CHURCH: PortalChurch = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Igreja',
    slug: 'igreja',
    address: '',
    logoUrl: '',
    pastor: 'Pr. Responsável',
    description: 'Plataforma Oficial de Contribuição e Ofertas'
};

export const normalizeChurchSlug = (text?: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const getCachedChurches = (): PortalChurch[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (_) {}
    return [];
};

export const extractSlugFromLocation = (paramSlug?: string): string => {
    if (paramSlug && paramSlug.trim()) {
        return paramSlug.trim().toLowerCase();
    }
    if (typeof window === 'undefined') return '';

    // 1. Query parameter (?church=... or ?igreja=... or ?c=...)
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('church') || urlParams.get('igreja') || urlParams.get('c');
    if (querySlug && querySlug.trim()) {
        return querySlug.trim().toLowerCase();
    }

    // 2. Hash or Pathname
    const hash = (window.location.hash || '').replace(/^#/, '');
    const path = window.location.pathname || '';
    const rawPath = (hash.startsWith('/portal') || hash.startsWith('/cadastro') || hash.startsWith('/church')) ? hash : path;
    const cleanPath = (rawPath || '').toLowerCase().replace(/^\/portal/, '');
    const parts = cleanPath.split('/').filter(Boolean);

    if (parts[0] === 'church' && parts[1]) {
        return parts[1].trim().toLowerCase();
    }
    if (parts[0] === 'cadastro' && parts[1]) {
        return parts[1].trim().toLowerCase();
    }
    if (parts[0] && !['identify', 'reports', 'pledges', 'coming_soon', 'not_found', 'cadastro', 'cadastrar', 'register'].includes(parts[0])) {
        return parts[0].trim().toLowerCase();
    }

    // 3. Last remembered active church in session
    try {
        const saved = localStorage.getItem(ACTIVE_CHURCH_SLUG_KEY);
        if (saved && saved.trim() && saved !== 'igreja') {
            return saved.trim().toLowerCase();
        }
    } catch (_) {}

    return '';
};

export const resolveChurchFromList = (list: PortalChurch[], targetSlug?: string | null): PortalChurch | null => {
    if (!list || list.length === 0) return null;
    if (!targetSlug || !targetSlug.trim()) return list[0];

    const cleanTarget = targetSlug.trim().toLowerCase();
    const targetNorm = normalizeChurchSlug(cleanTarget);

    // 1. EXACT match by ID (UUID or database identifier)
    const byId = list.find(c => c.id && String(c.id).toLowerCase() === cleanTarget);
    if (byId) return byId;

    // 2. EXACT match by stored slug
    const bySlug = list.find(c => c.slug && String(c.slug).trim().toLowerCase() === cleanTarget);
    if (bySlug) return bySlug;

    // 3. EXACT match by normalized slug
    const byNormSlug = list.find(c => normalizeChurchSlug(c.slug) === targetNorm);
    if (byNormSlug) return byNormSlug;

    // 4. EXACT match by normalized church name
    const byNormName = list.find(c => normalizeChurchSlug(c.name) === targetNorm);
    if (byNormName) return byNormName;

    // 5. EXACT match by raw trimmed church name (case-insensitive)
    const byRawName = list.find(c => c.name && String(c.name).trim().toLowerCase() === cleanTarget);
    if (byRawName) return byRawName;

    // STRICT: Absolutely NO substring or partial matching (.includes)!
    // A substring match previously caused "PRIMAVERA III" to resolve to "PRIMAVERA II" because "primavera-ii" is a substring of "primavera-iii".
    return null;
};

export const usePortalChurchResolver = (churchSlug?: string) => {
    const [initialState] = useState(() => {
        const effectiveSlug = extractSlugFromLocation(churchSlug);
        const cached = getCachedChurches();

        if (cached.length > 0) {
            const resolved = resolveChurchFromList(cached, effectiveSlug);
            if (resolved) {
                return {
                    church: resolved,
                    list: cached,
                    loading: false
                };
            } else if (!effectiveSlug) {
                return {
                    church: cached[0],
                    list: cached,
                    loading: false
                };
            }
        }

        return {
            church: null,
            list: [],
            loading: true
        };
    });

    const [church, setChurch] = useState<PortalChurch | null>(initialState.church);
    const [churchesList, setChurchesList] = useState<PortalChurch[]>(initialState.list);
    const [isLoading, setIsLoading] = useState<boolean>(initialState.loading);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (!church) {
            setIsLoading(true);
        }
        setError(null);

        const fetchChurches = async () => {
            try {
                const response = await fetch('/api/v1/churches', { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`Falha ao carregar dados das igrejas (${response.status})`);
                }
                const data = await response.json();
                
                if (!isMounted) return;

                if (Array.isArray(data) && data.length > 0) {
                    const formattedChurches: PortalChurch[] = data.map((c: any) => ({
                        id: c.id,
                        name: c.name || 'Igreja',
                        slug: c.slug || normalizeChurchSlug(c.name) || 'igreja',
                        address: c.address || '',
                        logoUrl: c.logoUrl || '',
                        pastor: c.pastor || '',
                        description: c.address ? `Endereço: ${c.address}` : 'Ambiente Oficial de Contribuição'
                    }));

                    try {
                        localStorage.setItem(CACHE_KEY, JSON.stringify(formattedChurches));
                    } catch (_) {}

                    setChurchesList(formattedChurches);

                    const targetSlug = extractSlugFromLocation(churchSlug);
                    const found = resolveChurchFromList(formattedChurches, targetSlug);
                    const chosen = found || (targetSlug ? null : formattedChurches[0]) || formattedChurches[0] || DEFAULT_PORTAL_CHURCH;
                    
                    setChurch(chosen);

                    if (chosen && chosen.slug && chosen.slug !== 'igreja') {
                        try {
                            localStorage.setItem(ACTIVE_CHURCH_SLUG_KEY, chosen.slug);
                        } catch (_) {}
                    }
                } else {
                    setChurchesList([DEFAULT_PORTAL_CHURCH]);
                    setChurch(DEFAULT_PORTAL_CHURCH);
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error('[usePortalChurchResolver] Erro:', err);
                    setError(err.message || 'Erro ao carregar dados da igreja');
                    if (!church) {
                        setChurchesList([DEFAULT_PORTAL_CHURCH]);
                        setChurch(DEFAULT_PORTAL_CHURCH);
                    }
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchChurches();

        return () => {
            isMounted = false;
        };
    }, [churchSlug]);

    return { church, churchesList, isLoading, error };
};
