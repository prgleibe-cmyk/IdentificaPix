import { useState, useEffect } from 'react';

export const DEFAULT_PORTAL_ROLES: string[] = [
    'Membro',
    'Visitante',
    'Pastor / Pastora',
    'Diácono / Diaconisa',
    'Presbítero / Evangelista',
    'Obreiro / Obreira',
    'Líder de Ministério / Célula',
    'Voluntário',
    'Dizimista',
    'Músico / Louvor',
    'Prestador de Serviços',
    'Fornecedor / Empresa',
    'Concessionária / Utilidades',
    'Outro'
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

function mergeRoles(base: string[], additions: string[]): string[] {
    const list = [...base];
    for (const item of additions) {
        if (typeof item === 'string' && item.trim()) {
            const trimmed = item.trim();
            if (!list.some(x => x.toLowerCase() === trimmed.toLowerCase())) {
                // Insere antes de 'Outro' se existir
                const outroIdx = list.findIndex(x => x.toLowerCase() === 'outro');
                if (outroIdx !== -1) {
                    list.splice(outroIdx, 0, trimmed);
                } else {
                    list.push(trimmed);
                }
            }
        }
    }
    return list;
}

export function usePortalRoles() {
    const [roles, setRoles] = useState<string[]>(() => {
        let initial = [...DEFAULT_PORTAL_ROLES];
        try {
            const saved = localStorage.getItem('iggestor_custom_roles_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    initial = mergeRoles(initial, parsed);
                }
            }
        } catch (_) {}
        return initial;
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
                        setRoles(prev => mergeRoles(prev, serverRoles));
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
                    if (Array.isArray(parsed)) {
                        setRoles(prev => mergeRoles(prev, parsed));
                    }
                } catch (_) {}
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => {
            isMounted = false;
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const defaultMembro = getMembroOption(roles);

    return {
        roles,
        defaultMembro,
        loading
    };
}
