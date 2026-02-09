import { supabase } from './supabaseClient';
import { FileModel } from '../types';
import { Logger } from './monitoringService';
import { get, set, del } from 'idb-keyval';

const PERSISTENT_STORAGE_KEY = 'identificapix-models-storage-v12';

export const modelService = {
    /**
     * Recupera os modelos acessíveis ao usuário:
     * 1. Modelos Globais (Qualquer modelo com is_active = true)
     * 2. Modelos Privados (Modelos criados pelo próprio usuário, incluindo rascunhos)
     */
    getUserModels: async (userId: string): Promise<FileModel[]> => {
        try {
            const { data, error } = await supabase
                .from('file_models')
                .select('*')
                .or(`is_active.eq.true,user_id.eq.${userId}`);
            
            if (error) throw error;

            const mapDbRowToModel = (row: any): FileModel => {
                const fingerprint = typeof row.fingerprint === 'string'
                    ? JSON.parse(row.fingerprint)
                    : row.fingerprint;

                const mapping = typeof row.mapping === 'string'
                    ? JSON.parse(row.mapping)
                    : row.mapping;

                const parsingRules = row.parsing_rules
                    ? (typeof row.parsing_rules === 'string'
                        ? JSON.parse(row.parsing_rules)
                        : row.parsing_rules)
                    : { ignoredKeywords: [], rowFilters: [] };

                return {
                    ...row,
                    id: row.id,
                    name: row.name,
                    user_id: row.user_id,
                    version: row.version || 1,
                    lineage_id: row.lineage_id || row.id,
                    is_active: row.is_active,
                    status: row.status || 'approved',
                    fingerprint,
                    mapping,
                    parsingRules,
                    snippet: row.snippet,
                    createdAt: row.created_at || new Date().toISOString(),
                    lastUsedAt: row.last_used_at
                };
            };

            const remoteModels = data ? data.map(mapDbRowToModel) : [];
            await set(PERSISTENT_STORAGE_KEY, remoteModels);
            return remoteModels;

        } catch (e) {
            console.warn("[ModelService] Falha na rede, tentando ler cache local...", e);
            const cached = await get(PERSISTENT_STORAGE_KEY);
            return Array.isArray(cached) ? cached : [];
        }
    },

    saveModel: async (model: Omit<FileModel, 'id' | 'createdAt'>): Promise<FileModel | null> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão expirada.");

            if (model.lineage_id) {
                await supabase.from('file_models')
                    .update({ is_active: false })
                    .eq('lineage_id', model.lineage_id);
            }

            const safeMapping = {
                ...model.mapping,
                blockRows: model.mapping?.blockRows || [],
                blockText: model.mapping?.blockText || ''
            };

            const { data, error } = await supabase
                .from('file_models')
                .insert([{
                    name: model.name,
                    user_id: session.user.id,
                    version: model.version || 1,
                    lineage_id: model.lineage_id || `mod-${Date.now()}`,
                    is_active: true,
                    status: model.status || 'approved',
                    fingerprint: JSON.stringify(model.fingerprint),
                    mapping: JSON.stringify(safeMapping),
                    parsing_rules: JSON.stringify(model.parsingRules),
                    snippet: model.snippet
                }])
                .select('*')
                .single();

            if (error) throw error;
            await del(PERSISTENT_STORAGE_KEY);
            return data;
        } catch (error) {
            Logger.error("Erro ao salvar modelo", error);
            throw error;
        }
    },

    updateModel: async (id: string, updates: Partial<FileModel>): Promise<FileModel | null> => {
        try {
            const safeMapping = updates.mapping
                ? {
                    ...updates.mapping,
                    blockRows: updates.mapping?.blockRows || [],
                    blockText: updates.mapping?.blockText || ''
                }
                : undefined;

            const { data, error } = await supabase
                .from('file_models')
                .update({
                    name: updates.name,
                    status: updates.status,
                    fingerprint: updates.fingerprint ? JSON.stringify(updates.fingerprint) : undefined,
                    mapping: safeMapping ? JSON.stringify(safeMapping) : undefined,
                    parsing_rules: updates.parsingRules ? JSON.stringify(updates.parsingRules) : undefined,
                    snippet: updates.snippet,
                    last_used_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;
            await del(PERSISTENT_STORAGE_KEY);
            return data;
        } catch (error) {
            Logger.error("Erro ao atualizar modelo", error);
            throw error;
        }
    },

    deleteModel: async (id: string) => {
        const { error } = await supabase.from('file_models').delete().eq('id', id);
        if (!error) {
            await del(PERSISTENT_STORAGE_KEY);
            return true;
        }
        return false;
    },

    getAllModelsAdmin: async (): Promise<FileModel[]> => {
        const { data, error } = await supabase
            .from('file_models')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return [];
        return data as any[];
    },

    updateModelName: async (id: string, name: string) => {
        const { error } = await supabase.from('file_models').update({ name }).eq('id', id);
        if (!error) {
            await del(PERSISTENT_STORAGE_KEY);
            return true;
        }
        return false;
    }
};
