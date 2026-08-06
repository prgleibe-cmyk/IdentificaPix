import { getAuthToken } from './auth/authAdapter';

export interface AutomationMacro {
    id: string;
    user_id: string;
    bank_id?: string | null;
    name: string;
    steps: any;
    target_url?: string | null;
    created_at?: string;
}

export const AutomationMacroService = {
    async getAll(userId?: string): Promise<AutomationMacro[]> {
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const url = userId ? `/api/v1/automation-macros?user_id=${encodeURIComponent(userId)}` : '/api/v1/automation-macros';
            const response = await fetch(url, { method: 'GET', headers });

            if (!response.ok) {
                console.warn(`[AutomationMacroService] HTTP ${response.status} ao carregar macros`);
                return [];
            }

            const json = await response.json();
            return json.success && Array.isArray(json.data) ? json.data : [];
        } catch (err) {
            console.error('[AutomationMacroService] Erro ao carregar macros:', err);
            return [];
        }
    },

    async getById(id: string): Promise<AutomationMacro | null> {
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`/api/v1/automation-macros/${encodeURIComponent(id)}`, { method: 'GET', headers });
            if (!response.ok) return null;

            const json = await response.json();
            return json.success ? json.data : null;
        } catch (err) {
            console.error(`[AutomationMacroService] Erro ao buscar macro ${id}:`, err);
            return null;
        }
    },

    async create(macro: { user_id: string; name: string; steps: any; target_url?: string | null; bank_id?: string | null }): Promise<AutomationMacro> {
        const token = await getAuthToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch('/api/v1/automation-macros', {
            method: 'POST',
            headers,
            body: JSON.stringify(macro)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.message || `HTTP ${response.status} ao criar macro`);
        }

        const json = await response.json();
        if (!json.success || !json.data) {
            throw new Error(json.message || 'Falha ao salvar macro de automação');
        }

        return json.data;
    },

    async update(id: string, updates: Partial<AutomationMacro>): Promise<AutomationMacro> {
        const token = await getAuthToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api/v1/automation-macros/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updates)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.message || `HTTP ${response.status} ao atualizar macro`);
        }

        const json = await response.json();
        return json.data;
    },

    async delete(id: string): Promise<boolean> {
        const token = await getAuthToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api/v1/automation-macros/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers
        });

        if (!response.ok) return false;
        const json = await response.json();
        return json.success;
    }
};
