import { supabase } from './supabaseClient';
import { Logger } from './monitoringService';

/**
 * SERVIÇO DE CONFIGURAÇÃO ADMINISTRATIVA (V4 - PERSISTÊNCIA GARANTIDA)
 */
export const AdminConfigService = {
    cache: new Map<string, any>(),

    async get<T>(key: string): Promise<T | null> {
        if (this.cache.has(key)) {
            return this.cache.get(key) as T;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) return null;

            const response = await fetch(`/api/reference/config/${key}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Erro ao buscar config via API");

            const value = await response.json();
            if (value !== null) {
                this.cache.set(key, value);
            }
            return value as T;
        } catch (e) {
            console.warn(`[AdminConfig] Exceção ao ler chave '${key}' via API`, e);
            return null;
        }
    },

    async set<T>(key: string, value: T): Promise<void> {
        this.cache.set(key, value);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) throw new Error("Token não encontrado");

            const response = await fetch('/api/reference/config/save', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ key, value })
            });

            if (!response.ok) throw new Error("Erro ao salvar config via API");
            
            Logger.info(`[AdminConfig] Configuração '${key}' persistida via API.`);

        } catch (e) {
            Logger.error(`[AdminConfig] Falha de persistência via API para '${key}'`, e);
            throw e; 
        }
    },

    async getAll(): Promise<Record<string, any>> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) return {};

            const response = await fetch('/api/reference/config/list/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Erro ao listar configs via API");

            const config = await response.json();
            Object.entries(config).forEach(([key, value]) => {
                this.cache.set(key, value);
            });
            return config;
        } catch (e) {
            console.warn("[AdminConfig] Falha ao carregar lote via API.", e);
            return {};
        }
    }
};