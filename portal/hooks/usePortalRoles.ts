import { useState, useEffect } from 'react';

export const DEFAULT_PORTAL_ROLES: string[] = [
    'Membro'
];

/**
 * Encontra a opção "Membro" cadastrada na lista de cargos de forma case-insensitive.
 * Garante que a opção cadastrada no sistema seja selecionada por padrão.
 */
export function getMembroOption(rolesList: string[]): string {
    if (!Array.isArray(rolesList) || rolesList.length === 0) return 'Membro';
    const exact = rolesList.find(r => r.trim().toLowerCase() === 'membro');
    if (exact) return exact;
    const starts = rolesList.find(r => r.trim().toLowerCase().startsWith('membro'));
    if (starts) return starts;
    const partial = rolesList.find(r => r.trim().toLowerCase().includes('membro'));
    if (partial) return partial;
    return rolesList[0] || 'Membro';
}

export function usePortalRoles() {
    const [roles, setRoles] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('iggestor_custom_roles_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (_) {}
        return [...DEFAULT_PORTAL_ROLES];
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadRoles = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/v1/contributors/roles', { cache: 'no-store' });
                if (res.ok) {
                    const serverRoles = await res.json();
                    if (isMounted && Array.isArray(serverRoles) && serverRoles.length > 0) {
                        setRoles(serverRoles);
                        try {
                            localStorage.setItem('iggestor_custom_roles_v1', JSON.stringify(serverRoles));
                        } catch (_) {}
                    }
                }
            } catch (err) {
                console.error('[usePortalRoles] Falha ao buscar cargos do servidor:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadRoles();

        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'iggestor_custom_roles_v1' && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setRoles(parsed);
                    }
                } catch (_) {}
            }
        };

        const handleRolesUpdated = () => {
            loadRoles();
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('contributor_roles_updated', handleRolesUpdated);
        return () => {
            isMounted = false;
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('contributor_roles_updated', handleRolesUpdated);
        };
    }, []);

    const defaultMembro = getMembroOption(roles);

    return {
        roles,
        defaultMembro,
        loading
    };
}
