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
                const seen = new Set<string>();
                return parsed.filter((c: any) => {
                    const nameStr = String(c?.name || '').trim();
                    const key = String(c?.id || nameStr).trim().toLowerCase();
                    if (!key || !nameStr || nameStr.toLowerCase() === 'igreja' || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
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

    // 1. Query parameter (?church=... or ?igreja=... or ?c=... or ?slug=... or ?church_id=...)
    const urlParams = new URLSearchParams(window.location.search);
    let querySlug = urlParams.get('church') || urlParams.get('igreja') || urlParams.get('c') || urlParams.get('slug') || urlParams.get('church_id') || urlParams.get('id');

    // Also check query parameters inside hash (e.g., #/cadastro?church=... or #/portal?church=...)
    if (!querySlug && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        const hashParams = new URLSearchParams(hashQuery);
        querySlug = hashParams.get('church') || hashParams.get('igreja') || hashParams.get('c') || hashParams.get('slug') || hashParams.get('church_id') || hashParams.get('id');
    }

    if (querySlug && querySlug.trim()) {
        return querySlug.trim().toLowerCase();
    }

    // 2. Hash or Pathname (strip query parameters first)
    const hash = (window.location.hash || '').replace(/^#/, '');
    const path = window.location.pathname || '';
    const rawPath = (hash.startsWith('/portal') || hash.startsWith('/cadastro') || hash.startsWith('/church')) ? hash : path;
    const pathWithoutQuery = (rawPath || '').split('?')[0];
    const cleanPath = pathWithoutQuery.toLowerCase().replace(/^\/portal/, '');
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
    const targetAlphaNum = cleanTarget.replace(/[^a-z0-9]/g, '');

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

    // 6. Alphanumeric match (handles differences in punctuation or hyphenation, e.g. "congregacao-b" vs "congregacaob")
    if (targetAlphaNum) {
        const byAlphaNum = list.find(c => {
            const cAlphaNumSlug = normalizeChurchSlug(c.slug || '').replace(/[^a-z0-9]/g, '');
            const cAlphaNumName = normalizeChurchSlug(c.name || '').replace(/[^a-z0-9]/g, '');
            return cAlphaNumSlug === targetAlphaNum || cAlphaNumName === targetAlphaNum;
        });
        if (byAlphaNum) return byAlphaNum;
    }

    // 7. Sede keyword match fallback
    if (cleanTarget === 'sede' || targetNorm === 'sede') {
        const sedeChurch = list.find(c => c.name.toLowerCase().includes('sede'));
        if (sedeChurch) return sedeChurch;
    }

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
                const targetSlug = extractSlugFromLocation(churchSlug);
                const queryParam = targetSlug ? `?church=${encodeURIComponent(targetSlug)}` : '';
                const response = await fetch(`/api/v1/churches${queryParam}`, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`Falha ao carregar dados das igrejas (${response.status})`);
                }
                const data = await response.json();
                
                if (!isMounted) return;

                if (Array.isArray(data) && data.length > 0) {
                    const validData = data.filter((c: any) => c.name && String(c.name).trim() !== '' && String(c.name).trim().toLowerCase() !== 'igreja');
                    const formattedChurches: PortalChurch[] = validData.map((c: any) => ({
                        id: c.id,
                        name: String(c.name).trim(),
                        slug: c.slug || normalizeChurchSlug(c.name),
                        address: c.address || '',
                        logoUrl: c.logoUrl || '',
                        pastor: c.pastor || '',
                        description: c.address ? `Endereço: ${c.address}` : 'Ambiente Oficial de Contribuição'
                    }));

                    if (formattedChurches.length > 0) {
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify(formattedChurches));
                        } catch (_) {}

                        setChurchesList(formattedChurches);

                        const targetSlug = extractSlugFromLocation(churchSlug);
                        const found = resolveChurchFromList(formattedChurches, targetSlug);
                        const chosen = found || formattedChurches[0];
                        
                        setChurch(chosen);

                        if (chosen && chosen.slug && chosen.slug !== 'igreja') {
                            try {
                                localStorage.setItem(ACTIVE_CHURCH_SLUG_KEY, chosen.slug);
                            } catch (_) {}
                        }
                    }
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error('[usePortalChurchResolver] Erro:', err);
                    setError(err.message || 'Erro ao carregar dados da igreja');
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
