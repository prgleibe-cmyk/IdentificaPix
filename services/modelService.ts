
import { supabase } from './supabaseClient';
import { FileModel } from '../types';
import { Logger } from './monitoringService';

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
            // Se for um refinamento, desativa a versão anterior da mesma linhagem
            if (model.version > 1) {
                await supabase
                    .from('file_models')
                    .update({ is_active: false })
                    .eq('lineage_id', model.lineage_id)
                    .eq('user_id', model.user_id);
            }

            const { parsingRules, ...rest } = model;

            const { data, error } = await supabase
                .from('file_models')
                .insert([{
                    ...rest,
                    parsing_rules: parsingRules, // Camel -> Snake
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;
            return mapDbRowToModel(data);
        } catch (error) {
            Logger.error("Erro ao salvar modelo aprendido", error);
            return null;
        }
    },

    /**
     * Busca todos os modelos ativos do usuário.
     */
    getUserModels: async (userId: string): Promise<FileModel[]> => {
        const { data, error } = await supabase
            .from('file_models')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true);
        
        if (error || !data) return [];
        return data.map(mapDbRowToModel);
    },

    /**
     * ADMIN: Busca todos os modelos do sistema com informações básicas do usuário.
     */
    getAllModelsAdmin: async (): Promise<(FileModel & { user_email?: string })[]> => {
        try {
            // Busca modelos
            const { data: models, error } = await supabase
                .from('file_models')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!models || models.length === 0) return [];

            // Busca perfis para enriquecer com email/nome
            const userIds = [...new Set(models.map(m => m.user_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email')
                .in('id', userIds);

            // Mapeia email no modelo
            return models.map(m => ({
                ...mapDbRowToModel(m),
                user_email: profiles?.find(p => p.id === m.user_id)?.email || 'Usuário Desconhecido'
            }));

        } catch (error) {
            Logger.error("Erro ao buscar modelos admin", error);
            return [];
        }
    },

    /**
     * ADMIN: Exclui (desativa) um modelo.
     */
    deleteModel: async (modelId: string): Promise<boolean> => {
        const { error } = await supabase
            .from('file_models')
            .delete() // Hard delete para limpar o banco
            .eq('id', modelId);
        
        return !error;
    }
};
