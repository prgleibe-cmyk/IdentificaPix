import { Logger } from './monitoringService';
import { getAuthToken } from './auth/authAdapter';

/**
 * SERVIÇO DE CONFIGURAÇÃO ADMINISTRATIVA (MIGRAÇÃO VPS - POSTGRESQL API)
 */
export const AdminConfigService = {
    cache: new Map<string, any>(),

    async get<T>(key: string): Promise<T | null> {
        if (this.cache.has(key)) {
            return this.cache.get(key) as T;
        }

        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`/api/v1/admin-config/${encodeURIComponent(key)}`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                console.warn(`[AdminConfig] HTTP ${response.status} na consulta de '${key}'`);
                return null;
            }

            const json = await response.json();
            if (!json.success || json.value === undefined) {
                return null;
            }

            const value = json.value as T;
            this.cache.set(key, value);
            return value;
        } catch (e) {
            console.warn(`[AdminConfig] Exceção ao ler chave '${key}' via API VPS`, e);
            return null;
        }
    },

    async set<T>(key: string, value: T): Promise<void> {
        this.cache.set(key, value);

        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('/api/v1/admin-config', {
                method: 'PUT',
                headers,
                body: JSON.stringify({ key, value })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                console.error("[AdminConfig] Erro no PUT API VPS:", errData);
                throw new Error(errData?.message || `HTTP ${response.status} ao salvar '${key}'`);
            }

            Logger.info(`[AdminConfig] Configuração '${key}' persistida na VPS PostgreSQL.`);
        } catch (e) {
            Logger.error(`[AdminConfig] Falha de persistência na VPS para '${key}'`, e);
            throw e;
        }
    },

    async getAll(): Promise<Record<string, any>> {
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('/api/v1/admin-config', {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                console.warn(`[AdminConfig] HTTP ${response.status} ao carregar lote.`);
                return {};
            }

            const json = await response.json();
            if (!json.success || !json.config) {
                return {};
            }

            const config: Record<string, any> = json.config;
            Object.entries(config).forEach(([k, v]) => {
                this.cache.set(k, v);
            });
            return config;
        } catch (e) {
            console.warn("[AdminConfig] Falha ao carregar lote via API VPS.", e);
            return {};
        }
    }
};
