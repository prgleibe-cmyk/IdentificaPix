import { useState, useEffect } from 'react';
import { PortalChurch } from '../types/portal';

const CACHE_KEY = 'iggestor_portal_churches_cache';

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

export const resolveChurchFromList = (list: PortalChurch[], targetSlug?: string | null): PortalChurch | null => {
    if (!list || list.length === 0) return null;
    if (!targetSlug) return list[0];

    const cleanTarget = targetSlug.trim().toLowerCase();
    const targetNorm = normalizeChurchSlug(cleanTarget);

    const found = list.find(c => {
        const cSlugNorm = normalizeChurchSlug(c.slug);
        const cNameNorm = normalizeChurchSlug(c.name);
        return (
            c.id === cleanTarget ||
            c.slug === cleanTarget ||
            cSlugNorm === targetNorm ||
            (targetNorm && (cSlugNorm.includes(targetNorm) || targetNorm.includes(cSlugNorm))) ||
            (targetNorm && (cNameNorm.includes(targetNorm) || targetNorm.includes(cNameNorm)))
        );
    });

    return found || list[0];
};

export const usePortalChurchResolver = (churchSlug?: string) => {
    const [initialState] = useState(() => {
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const querySlug = urlParams ? (urlParams.get('church') || urlParams.get('igreja') || urlParams.get('c')) : null;
        
        let pathSlug: string | null = null;
        if (typeof window !== 'undefined') {
            const cleanPath = (window.location.pathname || '').toLowerCase().replace(/^\/portal/, '');
            const parts = cleanPath.split('/').filter(Boolean);
            if (parts[0] === 'church' && parts[1]) {
                pathSlug = parts[1];
            } else if (parts[0] && !['identify', 'reports', 'pledges', 'coming_soon', 'not_found', 'cadastro', 'cadastrar', 'register'].includes(parts[0])) {
                pathSlug = parts[0];
            }
        }

        const effectiveSlug = (churchSlug || querySlug || pathSlug || '').trim().toLowerCase();
        const cached = getCachedChurches();

        if (cached.length > 0) {
            const resolved = resolveChurchFromList(cached, effectiveSlug);
            return {
                church: resolved || cached[0],
                list: cached,
                loading: false
            };
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

                    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                    const querySlug = urlParams ? (urlParams.get('church') || urlParams.get('igreja') || urlParams.get('c')) : null;
                    const targetSlug = (churchSlug || querySlug || '').trim().toLowerCase();

                    const found = resolveChurchFromList(formattedChurches, targetSlug);
                    setChurch(found || formattedChurches[0]);
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

