import { FileModel } from '../types';
import { Logger } from './monitoringService';
import { get, set, del } from 'idb-keyval';
import { getAuthSession, getAuthToken } from './auth/authAdapter';

const PERSISTENT_STORAGE_KEY = 'identificapix-models-storage-v12';

async function getHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const modelService = {
    /**
     * Recupera os modelos acessíveis ao usuário:
     * 1. Modelos Globais (Qualquer modelo com is_active = true)
     * 2. Modelos Privados (Modelos criados pelo próprio usuário)
     */
    getUserModels: async (userId: string): Promise<FileModel[]> => {
        try {
            const headers = await getHeaders();
            const url = `/api/v1/file-models?user_id=${encodeURIComponent(userId)}`;
            const response = await fetch(url, { method: 'GET', headers });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ao buscar modelos`);
            }

            const json = await response.json();
            const data = json.success && Array.isArray(json.data) ? json.data : [];

            const mapDbRowToModel = (row: any): FileModel => {
                const fingerprint = typeof row.fingerprint === 'string' ? JSON.parse(row.fingerprint) : row.fingerprint;
                const mapping = typeof row.mapping === 'string' ? JSON.parse(row.mapping) : row.mapping;
                const parsingRules = row.parsing_rules ? (typeof row.parsing_rules === 'string' ? JSON.parse(row.parsing_rules) : row.parsing_rules) : { rowFilters: [] };

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

            const remoteModels = data.map(mapDbRowToModel);
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
            const session = await getAuthSession();
            if (!session) throw new Error("Sessão expirada.");

            const userId = model.user_id || session.user?.id;
            console.log(`[WRITE:FIX] Salvando modelo com userId na VPS: ${userId}`);

            const headers = await getHeaders();
            const payload = {
                name: model.name,
                user_id: userId,
                version: model.version || 1,
                lineage_id: model.lineage_id || `mod-${Date.now()}`,
                is_active: true,
                status: model.status || 'approved',
                fingerprint: model.fingerprint,
                mapping: model.mapping,
                parsing_rules: model.parsingRules,
                snippet: model.snippet
            };

            const response = await fetch('/api/v1/file-models', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || `HTTP ${response.status} ao salvar modelo`);
            }

            const json = await response.json();
            await del(PERSISTENT_STORAGE_KEY);
            return json.data;
        } catch (error) {
            Logger.error("Erro ao salvar modelo", error);
            throw error;
        }
    },

    updateModel: async (id: string, updates: Partial<FileModel>): Promise<FileModel | null> => {
        try {
            const headers = await getHeaders();
            const payload = {
                name: updates.name,
                status: updates.status,
                fingerprint: updates.fingerprint,
                mapping: updates.mapping,
                parsing_rules: updates.parsingRules,
                snippet: updates.snippet
            };

            const response = await fetch(`/api/v1/file-models/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ao atualizar modelo`);
            }

            const json = await response.json();
            await del(PERSISTENT_STORAGE_KEY);
            return json.data;
        } catch (error) {
            Logger.error("Erro ao atualizar modelo", error);
            throw error;
        }
    },

    deleteModel: async (id: string) => {
        try {
            const headers = await getHeaders();
            const response = await fetch(`/api/v1/file-models/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers
            });

            if (response.ok) {
                await del(PERSISTENT_STORAGE_KEY);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Erro ao deletar modelo:", error);
            return false;
        }
    },

    getAllModelsAdmin: async (): Promise<FileModel[]> => {
        try {
            const headers = await getHeaders();
            const response = await fetch('/api/v1/file-models/admin/all', { method: 'GET', headers });
            if (!response.ok) return [];

            const json = await response.json();
            return json.success && Array.isArray(json.data) ? json.data : [];
        } catch (error) {
            console.error("Erro ao buscar modelos admin:", error);
            return [];
        }
    },

    updateModelName: async (id: string, name: string) => {
        try {
            const headers = await getHeaders();
            const response = await fetch(`/api/v1/file-models/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                await del(PERSISTENT_STORAGE_KEY);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Erro ao atualizar nome do modelo:", error);
            return false;
        }
    }
};
