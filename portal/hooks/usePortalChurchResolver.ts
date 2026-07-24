import { useState, useEffect } from 'react';
import { PortalChurch } from '../types/portal';

const DEFAULT_PORTAL_CHURCH: PortalChurch = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Igreja Sede Central',
    slug: 'igreja-sede-central',
    address: 'Sede Central',
    logoUrl: '',
    pastor: 'Pr. Responsável',
    description: 'Plataforma Oficial de Contribuição e Ofertas'
};

export const usePortalChurchResolver = (churchSlug?: string) => {
    const [church, setChurch] = useState<PortalChurch | null>(DEFAULT_PORTAL_CHURCH);
    const [churchesList, setChurchesList] = useState<PortalChurch[]>([DEFAULT_PORTAL_CHURCH]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
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
                        slug: (c.name || 'igreja').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                        address: c.address || '',
                        logoUrl: c.logoUrl || '',
                        pastor: c.pastor || '',
                        description: c.address ? `Endereço: ${c.address}` : 'Ambiente Oficial de Contribuição'
                    }));

                    setChurchesList(formattedChurches);

                    if (churchSlug) {
                        const slugClean = churchSlug.trim().toLowerCase();
                        const found = formattedChurches.find(c => 
                            c.id === churchSlug || 
                            c.slug === slugClean || 
                            c.slug.includes(slugClean)
                        );

                        if (found) {
                            setChurch(found);
                        } else {
                            setChurch(formattedChurches[0]);
                        }
                    } else {
                        setChurch(formattedChurches[0]);
                    }
                } else {
                    setChurchesList([DEFAULT_PORTAL_CHURCH]);
                    setChurch(DEFAULT_PORTAL_CHURCH);
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error('[usePortalChurchResolver] Erro:', err);
                    setError(err.message || 'Erro ao carregar dados da igreja');
                    setChurchesList([DEFAULT_PORTAL_CHURCH]);
                    setChurch(DEFAULT_PORTAL_CHURCH);
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

