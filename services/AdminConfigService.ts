
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
                .maybeSingle(); // Usa maybeSingle para evitar erro se não existir (retorna null)

            if (error) {
                console.warn(`[AdminConfig] Erro na consulta de '${key}':`, error);
                return null;
            }

            if (!data) {
                return null;
            }

            const value = data.value as T;
            this.cache.set(key, value);
            return value;
        } catch (e) {
            console.warn(`[AdminConfig] Exceção ao ler chave '${key}'`, e);
            return null;
        }
    },

    /**
     * Salva uma configuração no Supabase e atualiza o cache local.
     * Implementa lógica robusta de Check-then-Write para garantir persistência.
     */
    async set<T>(key: string, value: T): Promise<void> {
        // Atualiza cache imediatamente para refletir na UI (Optimistic)
        this.cache.set(key, value);

        try {
            // 1. Verifica se o registro já existe
            const { data: existing, error: fetchError } = await supabase
                .from('admin_config')
                .select('id')
                .eq('key', key)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (existing) {
                // 2A. Se existe, faz UPDATE pelo ID (Mais seguro que upsert por chave)
                const { error: updateError } = await supabase
                    .from('admin_config')
                    .update({
                        value: value as any,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
            } else {
                // 2B. Se não existe, faz INSERT
                const { error: insertError } = await supabase
                    .from('admin_config')
                    .insert({
                        key,
                        value: value as any,
                        updated_at: new Date().toISOString()
                    });

                if (insertError) throw insertError;
            }
            
            Logger.info(`[AdminConfig] Configuração '${key}' salva com sucesso.`);

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
