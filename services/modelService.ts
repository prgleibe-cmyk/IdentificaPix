import { supabase } from './supabaseClient';
import { FileModel } from '../types';
import { Logger } from './monitoringService';
import { get, set } from 'idb-keyval';

const PERSISTENT_STORAGE_KEY = 'identificapix-models-storage-v11';

const getConsolidatedLocalModels = async (): Promise<FileModel[]> => {
    try {
        const currentModels = await get(PERSISTENT_STORAGE_KEY);
        return Array.isArray(currentModels) ? currentModels : [];
    } catch (e) { 
        return []; 
    }
};

const mapDbRowToModel = (row: any): FileModel => {
    const parseJson = (val: any) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch (e) { return val; }
        }
        return val;
    };

    const model = {
        id: row.id,
        name: row.name,
        user_id: row.user_id,
        version: row.version || 1,
        lineage_id: row.lineage_id || row.id,
        is_active: row.is_active,
        status: row.status || 'draft',
        fingerprint: parseJson(row.fingerprint),
        mapping: parseJson(row.mapping),
        parsingRules: row.parsing_rules ? parseJson(row.parsing_rules) : { ignoredKeywords: [], rowFilters: [] },
        snippet: row.snippet,
        createdAt: row.created_at || new Date().toISOString(),
        lastUsedAt: row.last_used_at
    };

    return model;
};

export const modelService = {
    /**
     * SALVAMENTO BLINDADO (V12)
     * Garante integridade absoluta antes de enviar ao Supabase.
     */
    saveModel: async (model: Omit<FileModel, 'id' | 'createdAt'>): Promise<FileModel | null> => {
        try {
            // 1. Validação de Sessão Ativa
            const { data: { session } } = await supabase.auth.getSession();
            if (!session || !session.access_token) {
                Logger.error("[Model:SAVE_ABORT] Sessão inexistente ou token ausente.");
                throw new Error("Sessão expirada. Faça login novamente.");
            }

            // 2. Validação de Payload (Campos Obrigatórios)
            const snippetLines = (model.snippet || "").split(/\r?\n/).filter(l => l.trim().length > 0);
            
            if (!model.user_id || model.user_id !== session.user.id) {
                Logger.error("[Model:SAVE_ABORT] Inconsistência de UserID.", { modelUser: model.user_id, sessionUser: session.user.id });
                throw new Error("Erro de permissão: Dados do usuário divergentes.");
            }

            if (!model.name || model.name.trim().length < 3) {
                Logger.error("[Model:SAVE_ABORT] Nome inválido ou muito curto.");
                throw new Error("O nome do modelo é obrigatório.");
            }

            if (snippetLines.length === 0) {
                Logger.error("[Model:SAVE_ABORT] Snippet vazio ou inválido.");
                throw new Error("Não é possível salvar um modelo sem exemplos de linhas.");
            }

            // 3. Preparação Atômica de Linhagem
            if (model.lineage_id) {
                const { error: deactivateError } = await supabase.from('file_models')
                    .update({ is_active: false })
                    .eq('lineage_id', model.lineage_id)
                    .eq('user_id', session.user.id);
                
                if (deactivateError) {
                    Logger.warn("[Model:LINEAGE_FIX] Falha ao desativar versão anterior, prosseguindo com insert.", deactivateError);
                }
            }

            // 4. Execução da Persistência Remota
            const dbPayload = {
                name: model.name,
                user_id: session.user.id,
                version: model.version || 1,
                lineage_id: model.lineage_id,
                is_active: true,
                status: model.status || 'approved',
                fingerprint: model.fingerprint,
                mapping: model.mapping,
                parsing_rules: model.parsingRules || { ignoredKeywords: [], rowFilters: [] },
                snippet: model.snippet || null
            };

            const { data, error, status } = await supabase
                .from('file_models')
                .insert([dbPayload])
                .select()
                .single();

            // 5. Tratamento de Erro HTTP/PostgREST
            if (error || !data || (status !== 201 && status !== 200)) {
                Logger.error(`[Model:SAVE_ERROR] Status: ${status}`, error, { payloadPreview: model.name });
                throw new Error(error?.message || `Erro na gravação remota (${status})`);
            }

            // 6. Confirmação e Sincronia Local
            const savedModel = mapDbRowToModel(data);
            const currentLocals = await getConsolidatedLocalModels();
            const updatedLocals = [savedModel, ...currentLocals.filter(m => m.lineage_id !== model.lineage_id)];
            await set(PERSISTENT_STORAGE_KEY, updatedLocals);

            console.log(`[Model:SAVE_OK] ${savedModel.name} | v${savedModel.version} | ${snippetLines.length} linhas`);
            return savedModel;

        } catch (error: any) {
            Logger.error("Erro crítico no serviço de modelo", error);
            throw error;
        }
    },

    getUserModels: async (userId: string): Promise<FileModel[]> => {
        let remoteModels: FileModel[] = [];
        try {
            const { data, error } = await supabase
                .from('file_models')
                .select('*')
                .eq('is_active', true);
            
            if (data) {
                remoteModels = data.map(mapDbRowToModel);
            }
        } catch (e) {
            console.error("Falha ao ler modelos remotos", e);
        }

        const localModels = await getConsolidatedLocalModels();
        const uniqueModels = new Map<string, FileModel>();
        
        [...remoteModels, ...localModels].forEach(m => {
            const existing = uniqueModels.get(m.lineage_id);
            if (!existing || new Date(m.createdAt) > new Date(existing.createdAt)) {
                uniqueModels.set(m.lineage_id, m);
            }
        });

        return Array.from(uniqueModels.values());
    },

    deleteModel: async (id: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;

        const { error } = await supabase
            .from('file_models')
            .delete()
            .eq('id', id)
            .eq('user_id', session.user.id);
            
        return !error;
    },

    getAllModelsAdmin: async (): Promise<FileModel[]> => {
        const { data, error } = await supabase
            .from('file_models')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) return [];
        return data.map(mapDbRowToModel);
    },

    updateModelName: async (id: string, name: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;

        const { error } = await supabase
            .from('file_models')
            .update({ name })
            .eq('id', id)
            .eq('user_id', session.user.id);
            
        return !error;
    }
};