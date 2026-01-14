
import { supabase } from './supabaseClient';
import { FileModel } from '../types';
import { Logger } from './monitoringService';
import { get, set } from 'idb-keyval';

// --- CONFIGURAÇÃO DE PERSISTÊNCIA DEFINITIVA ---
const PERSISTENT_STORAGE_KEY = 'identificapix-models-storage-final';

const LEGACY_KEYS = [
    'identificapix-local-models-v2', 
    'identificapix-local-models-v1',
    'identificapix-local-models'
];

/**
 * Função de Migração e Consolidação
 */
const getConsolidatedLocalModels = async (): Promise<FileModel[]> => {
    try {
        let currentModels = (await get(PERSISTENT_STORAGE_KEY)) || [];
        const modelMap = new Map<string, FileModel>();
        
        // Garante que é um array
        if (!Array.isArray(currentModels)) currentModels = [];

        currentModels.forEach((m: FileModel) => {
            if(m && m.id) modelMap.set(m.id, m);
        });
        
        let hasChanges = false;

        for (const legacyKey of LEGACY_KEYS) {
            const legacyData = await get(legacyKey);
            if (legacyData && Array.isArray(legacyData) && legacyData.length > 0) {
                legacyData.forEach((model: FileModel) => {
                    if (model && model.id && !modelMap.has(model.id)) {
                        modelMap.set(model.id, model);
                        hasChanges = true;
                    }
                });
            }
        }

        if (hasChanges) {
            const consolidated = Array.from(modelMap.values());
            await set(PERSISTENT_STORAGE_KEY, consolidated);
            Logger.info(`[ModelService] Migração automática: ${consolidated.length} modelos consolidados.`);
            return consolidated;
        }

        return Array.from(modelMap.values());
    } catch (e) {
        console.error("Erro ao consolidar modelos locais:", e);
        return [];
    }
};

const mapDbRowToModel = (row: any): FileModel => ({
    id: row.id,
    name: row.name,
    user_id: row.user_id,
    version: row.version,
    lineage_id: row.lineage_id,
    is_active: row.is_active,
    status: row.status || 'draft',
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    fingerprint: row.fingerprint,
    mapping: row.mapping,
    parsingRules: row.parsing_rules,
    snippet: row.snippet,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at
});

export const modelService = {
    /**
     * Salva um novo modelo ou uma nova versão.
     */
    saveModel: async (model: Omit<FileModel, 'id' | 'createdAt'>): Promise<FileModel | null> => {
        try {
            // Tenta desativar versão anterior no DB
            if (model.version > 1) {
                try {
                    await supabase
                        .from('file_models')
                        .update({ is_active: false })
                        .eq('lineage_id', model.lineage_id)
                        .eq('user_id', model.user_id);
                } catch (e) {
                    // Ignora erro na desativação
                }
            }

            const dbPayload: any = {
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

            if (model.status) dbPayload.status = model.status;
            if (model.approvedBy) dbPayload.approved_by = model.approvedBy;
            if (model.approvedAt) dbPayload.approved_at = model.approvedAt;

            const { data, error } = await supabase
                .from('file_models')
                .insert([dbPayload])
                .select()
                .single();

            if (error) {
                console.warn(`[ModelService] Falha ao salvar no banco. Ativando fallback local.`);
                throw error; 
            }
            
            return mapDbRowToModel(data);

        } catch (error: any) {
            Logger.warn("Erro no Supabase. Salvando modelo localmente (Modo Fallback)...", error);
            
            try {
                const localId = `local-${Date.now()}`;
                const newLocalModel: FileModel = {
                    ...model,
                    id: localId,
                    createdAt: new Date().toISOString(),
                    parsingRules: model.parsingRules,
                    status: model.status || 'draft'
                };

                const currentLocals = await getConsolidatedLocalModels();
                
                // Remove versões antigas da mesma linhagem localmente para não duplicar
                const filteredLocals = currentLocals.filter((m: FileModel) => 
                    !m.lineage_id || m.lineage_id !== model.lineage_id
                );
                
                await set(PERSISTENT_STORAGE_KEY, [newLocalModel, ...filteredLocals]);
                Logger.info("Modelo salvo localmente com sucesso (Fallback)", { id: newLocalModel.id });
                return newLocalModel;
            } catch (localError) {
                Logger.error("Erro crítico: Falha ao salvar no LocalStorage", localError);
                return null;
            }
        }
    },

    /**
     * Atualiza apenas o nome.
     */
    updateModelName: async (modelId: string, newName: string): Promise<boolean> => {
        if (modelId.startsWith('local-')) {
            const currentLocals = await getConsolidatedLocalModels();
            const newLocals = currentLocals.map((m: FileModel) => 
                m.id === modelId ? { ...m, name: newName } : m
            );
            await set(PERSISTENT_STORAGE_KEY, newLocals);
            return true;
        }

        const { error } = await supabase
            .from('file_models')
            .update({ name: newName })
            .eq('id', modelId);
        
        return !error;
    },

    /**
     * Busca modelos do usuário.
     * FIX: Agora retorna modelos locais MESMO se o user_id não bater exatamente,
     * assumindo que se está no LocalStorage do navegador, pertence ao usuário atual.
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
        } catch (e) { /* Silently fail remote */ }

        // 2. Busca do Local Storage
        try {
            const localData = await getConsolidatedLocalModels();
            
            // FILTRO PERMISSIVO:
            // Aceita se o ID do usuário bater OU se for um modelo puramente local ('local-')
            // Isso previne que modelos sumam se o ID do usuário mudar ou a sessão reiniciar.
            const userLocals = localData.filter((m: FileModel) => 
                (m.id.startsWith('local-')) || (m.user_id === userId && m.is_active !== false)
            );
            
            // Mescla, colocando locais primeiro para prioridade visual
            models = [...userLocals, ...models];
            
            // Deduplicação por lineage_id (mantém o mais recente)
            const uniqueModels = new Map();
            models.forEach(m => {
                // Se já tem um modelo dessa linhagem, só substitui se o atual for mais novo/local
                if (!uniqueModels.has(m.lineage_id)) {
                    uniqueModels.set(m.lineage_id, m);
                }
            });
            
            return Array.from(uniqueModels.values());

        } catch (e) { 
            console.warn("Erro ao ler modelos locais", e);
            return models; 
        }
    },

    /**
     * ADMIN: Busca todos os modelos (Supabase e Local).
     */
    getAllModelsAdmin: async (): Promise<(FileModel & { user_email?: string })[]> => {
        let allModels: (FileModel & { user_email?: string })[] = [];

        // 1. Busca Remota
        try {
            const { data: models, error } = await supabase
                .from('file_models')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (!error && models && models.length > 0) {
                let profiles: any[] = [];
                try {
                    const userIds = [...new Set(models.map(m => m.user_id))];
                    const { data } = await supabase.from('profiles').select('id, email').in('id', userIds);
                    profiles = data || [];
                } catch(e) {}

                const remoteMapped = models.map(m => ({
                    ...mapDbRowToModel(m),
                    user_email: profiles.find(p => p.id === m.user_id)?.email || 'Usuário Remoto'
                }));
                allModels = [...allModels, ...remoteMapped];
            }
        } catch (error) {
            console.warn("Admin: Erro ao buscar remotos", error);
        }

        // 2. Busca Local (TUDO)
        try {
            const localData = await getConsolidatedLocalModels();
            const localMapped = localData.map((m: FileModel) => ({ 
                ...m, 
                user_email: '[LOCAL STORAGE] (Sincronize)' 
            }));
            allModels = [...allModels, ...localMapped];
        } catch (e) {
            console.warn("Admin: Erro ao buscar locais", e);
        }

        return allModels.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime() || 0;
            const dateB = new Date(b.createdAt).getTime() || 0;
            return dateB - dateA;
        });
    },

    /**
     * ADMIN: Exclui modelo.
     */
    deleteModel: async (modelId: string): Promise<boolean> => {
        if (modelId.startsWith('local-')) {
            const currentLocals = await getConsolidatedLocalModels();
            const newLocals = currentLocals.filter((m: FileModel) => m.id !== modelId);
            await set(PERSISTENT_STORAGE_KEY, newLocals);
            return true;
        }

        const { error } = await supabase
            .from('file_models')
            .delete()
            .eq('id', modelId);
        
        return !error;
    }
};
