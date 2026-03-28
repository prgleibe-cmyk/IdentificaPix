
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
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return [];

            const response = await fetch(`/api/reference/models/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Erro ao buscar modelos via API");
            const data = await response.json();
            
            const mapDbRowToModel = (row: any): FileModel => {
                // Reidratação segura de campos JSONB
                const fingerprint = typeof row.fingerprint === 'string' ? JSON.parse(row.fingerprint) : row.fingerprint;
                const mapping = typeof row.mapping === 'string' ? JSON.parse(row.mapping) : row.mapping;
                const parsingRules = row.parsing_rules ? (typeof row.parsing_rules === 'string' ? JSON.parse(row.parsing_rules) : row.parsing_rules) : { ignoredKeywords: [], rowFilters: [] };

                return {
                    ...row, // Preserva campos não mapeados explicitamente (DNA extra, patterns, etc)
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
            console.warn("[ModelService] Falha na rede via API, tentando ler cache local...", e);
            const cached = await get(PERSISTENT_STORAGE_KEY);
            return Array.isArray(cached) ? cached : [];
        }
    },

    saveModel: async (model: Omit<FileModel, 'id' | 'createdAt'>): Promise<FileModel | null> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sessão expirada.");

            const response = await fetch('/api/reference/models/save', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    model: {
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
                    }
                })
            });

            if (!response.ok) throw new Error("Erro ao salvar modelo via API");
            const data = await response.json();
            await del(PERSISTENT_STORAGE_KEY);
            return data;
        } catch (error) {
            Logger.error("Erro ao salvar modelo via API", error);
            throw error;
        }
    },

    updateModel: async (id: string, updates: Partial<FileModel>): Promise<FileModel | null> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sessão expirada.");

            const response = await fetch('/api/reference/models/save', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    model: {
                        id,
                        name: updates.name,
                        status: updates.status,
                        fingerprint: updates.fingerprint,
                        mapping: updates.mapping,
                        parsing_rules: updates.parsingRules,
                        snippet: updates.snippet,
                        last_used_at: new Date().toISOString()
                    }
                })
            });

            if (!response.ok) throw new Error("Erro ao atualizar modelo via API");
            const data = await response.json();
            await del(PERSISTENT_STORAGE_KEY);
            return data;
        } catch (error) {
            Logger.error("Erro ao atualizar modelo via API", error);
            throw error;
        }
    },

    deleteModel: async (id: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sessão expirada.");

            const response = await fetch(`/api/reference/models/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Erro ao deletar modelo via API");
            await del(PERSISTENT_STORAGE_KEY);
            return true;
        } catch (error) {
            Logger.error("Erro ao deletar modelo via API", error);
            return false;
        }
    },

    getAllModelsAdmin: async (): Promise<FileModel[]> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return [];

            const response = await fetch(`/api/reference/models/all`, { // Precisaria criar essa rota no backend se necessário
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Erro ao buscar todos os modelos via API");
            return await response.json();
        } catch (error) {
            console.error("[ModelService] Erro ao buscar todos os modelos via API:", error);
            return [];
        }
    },

    updateModelName: async (id: string, name: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sessão expirada.");

            const response = await fetch('/api/reference/models/save', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    model: { id, name }
                })
            });

            if (!response.ok) throw new Error("Erro ao atualizar nome do modelo via API");
            await del(PERSISTENT_STORAGE_KEY);
            return true;
        } catch (error) {
            Logger.error("Erro ao atualizar nome do modelo via API", error);
            return false;
        }
    }
};
