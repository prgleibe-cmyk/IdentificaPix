
import { supabase } from './supabaseClient';
import { FileModel } from '../types';
import { Logger } from './monitoringService';
import { get, set } from 'idb-keyval';

const LOCAL_MODELS_KEY = 'identificapix-local-models';

// Helper para converter DB Row -> FileModel
const mapDbRowToModel = (row: any): FileModel => ({
    id: row.id,
    name: row.name,
    user_id: row.user_id,
    version: row.version,
    lineage_id: row.lineage_id,
    is_active: row.is_active,
    fingerprint: row.fingerprint,
    mapping: row.mapping,
    parsingRules: row.parsing_rules, // Snake -> Camel
    snippet: row.snippet,
    createdAt: row.created_at, // Snake -> Camel
    lastUsedAt: row.last_used_at // Snake -> Camel
});

export const modelService = {
    /**
     * Salva um novo modelo ou uma nova versão de um modelo existente.
     */
    saveModel: async (model: Omit<FileModel, 'id' | 'createdAt'>): Promise<FileModel | null> => {
        try {
            // Tenta desativar versão anterior (se houver)
            if (model.version > 1) {
                try {
                    await supabase
                        .from('file_models')
                        .update({ is_active: false })
                        .eq('lineage_id', model.lineage_id)
                        .eq('user_id', model.user_id);
                } catch (e) {
                    console.warn("Falha ao desativar modelo anterior (ignorado no fallback)", e);
                }
            }

            const dbPayload = {
                name: model.name,
                user_id: model.user_id,
                version: model.version,
                lineage_id: model.lineage_id,
                is_active: true,
                fingerprint: model.fingerprint,
                mapping: model.mapping,
                parsing_rules: model.parsingRules,
                snippet: model.snippet || null,
                last_used_at: model.lastUsedAt || null
            };

            const { data, error } = await supabase
                .from('file_models')
                .insert([dbPayload])
                .select()
                .single();

            if (error) {
                throw error; // Lança erro para cair no catch e salvar localmente
            }
            return mapDbRowToModel(data);

        } catch (error: any) {
            Logger.warn("Erro no Supabase (404/500). Salvando modelo localmente...", error);
            
            // FALLBACK: Salvar localmente
            try {
                const localId = `local-${Date.now()}`;
                const newLocalModel: FileModel = {
                    ...model,
                    id: localId,
                    createdAt: new Date().toISOString(),
                    parsingRules: model.parsingRules, // Mantém CamelCase no local
                };

                const currentLocals = (await get(LOCAL_MODELS_KEY)) || [];
                // Remove versões anteriores da mesma linhagem do local storage
                const filteredLocals = currentLocals.filter((m: FileModel) => 
                    m.lineage_id !== model.lineage_id || m.user_id !== model.user_id
                );
                
                await set(LOCAL_MODELS_KEY, [...filteredLocals, newLocalModel]);
                return newLocalModel;
            } catch (localError) {
                Logger.error("Erro crítico: Falha ao salvar no Supabase e no LocalStorage", localError);
                return null;
            }
        }
    },

    /**
     * Atualiza apenas o nome do modelo.
     */
    updateModelName: async (modelId: string, newName: string): Promise<boolean> => {
        if (modelId.startsWith('local-')) {
            const currentLocals = (await get(LOCAL_MODELS_KEY)) || [];
            const newLocals = currentLocals.map((m: FileModel) => 
                m.id === modelId ? { ...m, name: newName } : m
            );
            await set(LOCAL_MODELS_KEY, newLocals);
            return true;
        }

        const { error } = await supabase
            .from('file_models')
            .update({ name: newName })
            .eq('id', modelId);
        
        return !error;
    },

    /**
     * Busca todos os modelos ativos do usuário (Supabase + Local).
     */
    getUserModels: async (userId: string): Promise<FileModel[]> => {
        let models: FileModel[] = [];

        // 1. Tenta buscar do Supabase
        try {
            const { data, error } = await supabase
                .from('file_models')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true);
            
            if (!error && data) {
                models = data.map(mapDbRowToModel);
            }
        } catch (e) {
            console.warn("Supabase offline ou tabela inexistente.");
        }

        // 2. Busca do Local Storage (Fallback)
        try {
            const localData = (await get(LOCAL_MODELS_KEY)) || [];
            const userLocals = localData.filter((m: FileModel) => m.user_id === userId && m.is_active);
            
            // Mescla, dando preferência aos locais se o ID for 'local-' (recém criados offline)
            models = [...models, ...userLocals];
        } catch (e) {
            console.warn("Erro ao ler modelos locais");
        }

        return models;
    },

    /**
     * ADMIN: Busca todos os modelos.
     */
    getAllModelsAdmin: async (): Promise<(FileModel & { user_email?: string })[]> => {
        try {
            const { data: models, error } = await supabase
                .from('file_models')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!models || models.length === 0) return [];

            const userIds = [...new Set(models.map(m => m.user_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email')
                .in('id', userIds);

            return models.map(m => ({
                ...mapDbRowToModel(m),
                user_email: profiles?.find(p => p.id === m.user_id)?.email || 'Usuário Desconhecido'
            }));

        } catch (error) {
            // Em caso de erro no admin, tenta retornar os locais apenas para visualização
            try {
                const localData = (await get(LOCAL_MODELS_KEY)) || [];
                return localData.map((m: FileModel) => ({ ...m, user_email: '[LOCAL STORAGE]' }));
            } catch (e) {
                return [];
            }
        }
    },

    /**
     * ADMIN: Exclui modelo.
     */
    deleteModel: async (modelId: string): Promise<boolean> => {
        if (modelId.startsWith('local-')) {
            const currentLocals = (await get(LOCAL_MODELS_KEY)) || [];
            const newLocals = currentLocals.filter((m: FileModel) => m.id !== modelId);
            await set(LOCAL_MODELS_KEY, newLocals);
            return true;
        }

        const { error } = await supabase
            .from('file_models')
            .delete()
            .eq('id', modelId);
        
        return !error;
    }
};
