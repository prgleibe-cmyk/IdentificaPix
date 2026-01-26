
import { supabase } from './supabaseClient';
import { FileModel } from '../types';
import { Logger } from './monitoringService';
import { get, set, del } from 'idb-keyval';

const PERSISTENT_STORAGE_KEY = 'identificapix-models-storage-v12';

export const modelService = {
    /**
     * Recupera os modelos do usuário.
     * V12: Sincronia total com o servidor para eliminar modelos excluídos (ghosts).
     */
    getUserModels: async (userId: string): Promise<FileModel[]> => {
        try {
            // 1. Busca a verdade absoluta no servidor
            const { data, error } = await supabase
                .from('file_models')
                .select('*')
                .eq('is_active', true)
                .eq('user_id', userId);
            
            if (error) throw error;

            const mapDbRowToModel = (row: any): FileModel => ({
                id: row.id,
                name: row.name,
                user_id: row.user_id,
                version: row.version || 1,
                lineage_id: row.lineage_id || row.id,
                is_active: row.is_active,
                status: row.status || 'draft',
                fingerprint: typeof row.fingerprint === 'string' ? JSON.parse(row.fingerprint) : row.fingerprint,
                mapping: typeof row.mapping === 'string' ? JSON.parse(row.mapping) : row.mapping,
                parsingRules: row.parsing_rules ? (typeof row.parsing_rules === 'string' ? JSON.parse(row.parsing_rules) : row.parsing_rules) : { ignoredKeywords: [], rowFilters: [] },
                snippet: row.snippet,
                createdAt: row.created_at || new Date().toISOString(),
                lastUsedAt: row.last_used_at
            });

            const remoteModels = data ? data.map(mapDbRowToModel) : [];
            
            // 2. Sobrescreve o cache local com a lista limpa do servidor
            await set(PERSISTENT_STORAGE_KEY, remoteModels);
            
            console.log(`[ModelService] Sincronizado: ${remoteModels.length} modelos ativos encontrados.`);
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

            // Desativa versões anteriores da mesma linhagem
            if (model.lineage_id) {
                await supabase.from('file_models')
                    .update({ is_active: false })
                    .eq('lineage_id', model.lineage_id);
            }

            const { data, error } = await supabase
                .from('file_models')
                .insert([{
                    name: model.name,
                    user_id: session.user.id,
                    version: model.version || 1,
                    lineage_id: model.lineage_id,
                    is_active: true,
                    status: model.status || 'approved',
                    fingerprint: model.fingerprint,
                    mapping: model.mapping,
                    parsing_rules: model.parsingRules,
                    snippet: model.snippet
                }])
                .select('*')
                .single();

            if (error) throw error;

            // Invalida cache local para forçar refresh na próxima leitura
            await del(PERSISTENT_STORAGE_KEY);
            
            return data;
        } catch (error) {
            Logger.error("Erro ao salvar modelo", error);
            throw error;
        }
    },

    deleteModel: async (id: string) => {
        const { error } = await supabase.from('file_models').delete().eq('id', id);
        if (!error) {
            await del(PERSISTENT_STORAGE_KEY); // Limpa cache
            return true;
        }
        return false;
    },

    getAllModelsAdmin: async (): Promise<FileModel[]> => {
        const { data, error } = await supabase.from('file_models').select('*').order('created_at', { ascending: false });
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
