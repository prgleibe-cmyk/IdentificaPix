
import { supabase } from './supabaseClient';
import { FileModel } from '../types';
import { Logger } from './monitoringService';
import { get, set, del } from 'idb-keyval';

const PERSISTENT_STORAGE_KEY = 'identificapix-models-storage-v12';

/**
 * 🧬 REIDRATADOR SOBERANO (V13 - BLOCK INTEGRITY)
 * Garante que independentemente de como o Supabase ou o Cache retornem o dado,
 * o objeto FileModel terá seus campos JSON (mapping, fingerprint, rules) como Objetos.
 * Especialmente focado em tornar blockRows acessível para modelos de IA.
 */
const normalizeModel = (row: any): FileModel => {
    if (!row) return row;
    
    // 1. Hidratação do Fingerprint
    const fingerprint = typeof row.fingerprint === 'string' ? JSON.parse(row.fingerprint) : row.fingerprint;
    
    // 2. 🛡️ HIDRATAÇÃO BLINDADA DO MAPPING (Crucial para blockRows)
    let mapping = row.mapping;
    if (typeof mapping === 'string') {
        try {
            mapping = JSON.parse(mapping);
        } catch (e) {
            console.error(`[ModelService] Erro crítico de parse no mapping do modelo ${row.id}`);
            mapping = { extractionMode: 'COLUMNS', dateColumnIndex: -1, descriptionColumnIndex: -1, amountColumnIndex: -1, skipRowsStart: 0, skipRowsEnd: 0, decimalSeparator: ',', thousandsSeparator: '.' };
        }
    }

    // 3. 🧪 AUDITORIA DE BLOCO
    // Verifica se os dados aprendidos (blockRows) foram preservados após a conversão
    if (mapping && mapping.extractionMode === 'BLOCK') {
        const rowsCount = Array.isArray(mapping.blockRows) ? mapping.blockRows.length : 0;
        console.log(`[ModelService:Hydrate] 🎯 Modelo BLOCK "${row.name}" reconhecido. blockRows carregados: ${rowsCount}`);
    }

    // 4. Hidratação de Parsing Rules
    const parsingRules = row.parsing_rules 
        ? (typeof row.parsing_rules === 'string' ? JSON.parse(row.parsing_rules) : row.parsing_rules) 
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

export const modelService = {
    getUserModels: async (userId: string): Promise<FileModel[]> => {
        try {
            const { data, error } = await supabase
                .from('file_models')
                .select('*')
                .or(`is_active.eq.true,user_id.eq.${userId}`);
            
            if (error) throw error;

            const remoteModels = data ? data.map(normalizeModel) : [];
            await set(PERSISTENT_STORAGE_KEY, remoteModels);
            return remoteModels;

        } catch (e) {
            console.warn("[ModelService] Usando cache local...", e);
            const cached = await get(PERSISTENT_STORAGE_KEY);
            return Array.isArray(cached) ? cached.map(normalizeModel) : [];
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

            // 🛡️ GARANTIA DE PERSISTÊNCIA BLOCK (V22)
            // Mapeia explicitamente rascunhos do editor para o campo oficial blockRows
            if (model.mapping && model.mapping.extractionMode === 'BLOCK') {
                const anyMapping = model.mapping as any;
                const learnedRows = anyMapping.blockRows || anyMapping.rows || anyMapping.examples || anyMapping.learnedRows || [];
                model.mapping.blockRows = learnedRows;
                console.log(`[ModelService:Save] Modelo BLOCK salvo com blockRows: ${learnedRows.length}`);
            }

            const { data, error } = await supabase
                .from('file_models')
                .insert([{
                    name: model.name,
                    user_id: session.user.id,
                    version: model.version || 1,
                    lineage_id: model.lineage_id || `mod-${Date.now()}`,
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
            await del(PERSISTENT_STORAGE_KEY);
            return normalizeModel(data); // 🧱 Hidratação imediata pós-save
        } catch (error) {
            Logger.error("Erro ao salvar modelo", error);
            throw error;
        }
    },

    updateModel: async (id: string, updates: Partial<FileModel>): Promise<FileModel | null> => {
        try {
            // 🛡️ GARANTIA DE PERSISTÊNCIA BLOCK EM UPDATE (V22)
            if (updates.mapping && updates.mapping.extractionMode === 'BLOCK') {
                const anyMapping = updates.mapping as any;
                const learnedRows = anyMapping.blockRows || anyMapping.rows || anyMapping.examples || anyMapping.learnedRows || [];
                updates.mapping.blockRows = learnedRows;
                console.log(`[ModelService:Save] Modelo BLOCK salvo com blockRows: ${learnedRows.length}`);
            }

            const { data, error } = await supabase
                .from('file_models')
                .update({
                    name: updates.name,
                    status: updates.status,
                    fingerprint: updates.fingerprint,
                    mapping: updates.mapping,
                    parsing_rules: updates.parsingRules,
                    snippet: updates.snippet,
                    last_used_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;
            await del(PERSISTENT_STORAGE_KEY);
            return normalizeModel(data); // 🧱 Hidratação imediata pós-update
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
        const { data, error } = await supabase.from('file_models').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return (data as any[]).map(normalizeModel); // 🧱 Hidratação para Admin
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
