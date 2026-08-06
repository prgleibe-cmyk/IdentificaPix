import { getAuthToken } from './auth/authAdapter';

export interface ProfileData {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  owner_id?: string | null;
  subscription_status?: string;
  subscription_ends_at?: string | null;
  trial_ends_at?: string | null;
  limit_ai?: number;
  usage_ai?: number;
  max_churches?: number;
  max_banks?: number;
  custom_price?: number | null;
  is_blocked?: boolean;
  is_lifetime?: boolean;
  permissions?: any;
  congregation?: string | null;
  created_at?: string;
  updated_at?: string;
}

async function getHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const profileService = {
  getProfile: async (id: string): Promise<ProfileData | null> => {
    try {
      const headers = await getHeaders();
      const response = await fetch(`/api/v1/profiles/${encodeURIComponent(id)}`, { method: 'GET', headers });
      if (!response.ok) return null;
      const json = await response.json();
      return json.success ? json.data : null;
    } catch (err) {
      console.error(`[ProfileService] Erro ao buscar perfil ${id}:`, err);
      return null;
    }
  },

  getProfilesByOwner: async (ownerId: string): Promise<ProfileData[]> => {
    try {
      const headers = await getHeaders();
      const response = await fetch(`/api/v1/profiles?owner_id=${encodeURIComponent(ownerId)}`, { method: 'GET', headers });
      if (!response.ok) return [];
      const json = await response.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (err) {
      console.error(`[ProfileService] Erro ao buscar perfis do owner ${ownerId}:`, err);
      return [];
    }
  },

  getAllProfiles: async (): Promise<ProfileData[]> => {
    try {
      const headers = await getHeaders();
      const response = await fetch('/api/v1/profiles', { method: 'GET', headers });
      if (!response.ok) return [];
      const json = await response.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (err) {
      console.error('[ProfileService] Erro ao buscar todos os perfis:', err);
      return [];
    }
  },

  upsertProfile: async (data: Partial<ProfileData> & { id: string }): Promise<ProfileData | null> => {
    try {
      const headers = await getHeaders();
      const response = await fetch('/api/v1/profiles', {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || `HTTP ${response.status} ao salvar perfil`);
      }
      const json = await response.json();
      return json.data;
    } catch (err) {
      console.error('[ProfileService] Erro ao criar/atualizar perfil:', err);
      throw err;
    }
  },

  updateProfile: async (id: string, updates: Partial<ProfileData>): Promise<ProfileData | null> => {
    try {
      const headers = await getHeaders();
      const response = await fetch(`/api/v1/profiles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || `HTTP ${response.status} ao atualizar perfil`);
      }
      const json = await response.json();
      return json.data;
    } catch (err) {
      console.error(`[ProfileService] Erro ao atualizar perfil ${id}:`, err);
      throw err;
    }
  },

  deleteProfile: async (id: string): Promise<boolean> => {
    try {
      const headers = await getHeaders();
      const response = await fetch(`/api/v1/profiles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) return false;
      const json = await response.json();
      return json.success;
    } catch (err) {
      console.error(`[ProfileService] Erro ao excluir perfil ${id}:`, err);
      return false;
    }
  }
};
