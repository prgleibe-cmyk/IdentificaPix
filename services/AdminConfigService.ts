
import { supabase } from './supabaseClient';
import { Logger } from './monitoringService';

// ⚠️ “Configuração Administrativa Persistente — NÃO HARDCODAR”
// ⚠️ “Qualquer ajuste do Admin deve ser salvo no Supabase”

export const AdminConfigService = {
    // Cache em memória para evitar leituras repetidas e garantir performance
    cache: new Map<string, any>(),

    /**
     * Recupera uma configuração do Banco de Dados.
     * Retorna NULL se não existir, para que o consumidor decida se usa default.
     * Isso garante que "Nada no banco" != "Valor Default do Código".
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
                .single();

            if (error || !data) {
                // Retorna null explicitamente para indicar "Sem configuração definida pelo Admin"
                return null;
            }

            const value = data.value as T;
            this.cache.set(key, value);
            return value;
        } catch (e) {
            console.warn(`[AdminConfig] Erro ao ler chave '${key}'`, e);
            return null;
        }
    },

    /**
     * Salva uma configuração no Supabase e atualiza o cache local.
     */
    async set<T>(key: string, value: T): Promise<void> {
        // Atualiza cache imediatamente para refletir na UI
        this.cache.set(key, value);

        try {
            const { error } = await supabase
                .from('admin_config')
                .upsert({
                    key,
                    value: value as any,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (error) throw error;
        } catch (e) {
            Logger.error(`[AdminConfig] Falha de persistência para '${key}'`, e);
            throw e; // Propaga erro para a UI saber que não salvou
        }
    },

    /**
     * Recupera todas as configurações para carga inicial (opcional).
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
