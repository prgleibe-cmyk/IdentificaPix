
import { supabase } from './supabaseClient';
import { Logger } from './monitoringService';

// ⚠️ “Configuração Administrativa Persistente — NÃO HARDCODAR”
// ⚠️ “Qualquer ajuste do Admin deve ser salvo no Supabase”

export const AdminConfigService = {
    // Cache em memória para evitar leituras repetidas e garantir performance
    cache: new Map<string, any>(),

    /**
     * Recupera uma configuração do Banco de Dados.
     * Retorna NULL se não existir.
     */
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

    /**
     * Salva uma configuração no Supabase usando UPSERT (Update or Insert).
     * Garante que apenas uma linha exista para cada chave de configuração.
     */
    async set<T>(key: string, value: T): Promise<void> {
        // Atualiza cache imediatamente para refletir na UI (Optimistic)
        this.cache.set(key, value);

        try {
            // O uso de onConflict: 'key' exige que a coluna 'key' tenha constraint UNIQUE no banco
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
            
            Logger.info(`[AdminConfig] Configuração '${key}' salva com sucesso.`);

        } catch (e) {
            Logger.error(`[AdminConfig] Falha de persistência para '${key}'`, e);
            throw e; 
        }
    },

    /**
     * Recupera todas as configurações para carga inicial.
     */
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
            console.warn("[AdminConfig] Falha ao carregar configurações em lote.", e);
            return {};
        }
    }
};
