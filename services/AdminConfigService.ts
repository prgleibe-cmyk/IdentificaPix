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
            const { data, error } = await supabase
                .from('admin_config')
                .select('value')
                .eq('key', key)
                .order('updated_at', { ascending: false })
                .limit(1);

            if (error) {
                console.warn(`[AdminConfig] Erro na consulta de '${key}':`, error);
                return null;
            }

            if (!data || data.length === 0) {
                return null;
            }

            const value = data[0].value as T;
            this.cache.set(key, value);
            return value;
        } catch (e) {
            console.warn(`[AdminConfig] Exceção ao ler chave '${key}'`, e);
            return null;
        }
    },

    async set<T>(key: string, value: T): Promise<void> {
        this.cache.set(key, value);

        try {
            // O onConflict: 'key' agora funciona pois o SQL V12 adicionou a constraint UNIQUE
            const { error } = await supabase
                .from('admin_config')
                .upsert(
                    { 
                        key, 
                        value: value as any, 
                        updated_at: new Date().toISOString() 
                    }, 
                    { onConflict: 'key' }
                );

            if (error) {
                console.error("[AdminConfig] Erro no UPSERT:", error);
                throw error;
            }
            
            Logger.info(`[AdminConfig] Configuração '${key}' persistida.`);

        } catch (e) {
            Logger.error(`[AdminConfig] Falha de persistência para '${key}'`, e);
            throw e; 
        }
    },

    async getAll(): Promise<Record<string, any>> {
        try {
            const { data, error } = await supabase
                .from('admin_config')
                .select('key, value');

            if (error) throw error;

            const config: Record<string, any> = {};
            data?.forEach(row => {
                config[row.key] = row.value;
                this.cache.set(row.key, row.value);
            });
            return config;
        } catch (e) {
            console.warn("[AdminConfig] Falha ao carregar lote.", e);
            return {};
        }
    }
};