import { supabaseAdmin } from './supabase.js';

/**
 * Valida se o usuário autenticado tem permissão para acessar dados de um Owner específico.
 * Centraliza a lógica de proteção contra IDOR (Insecure Direct Object Reference).
 * 
 * @param {Object} req - Objeto da requisição Express (deve conter req.user)
 * @param {string} ownerId - O ID do Owner que se deseja acessar
 * @returns {Promise<boolean>} - Retorna true se o acesso for permitido, false caso contrário
 */
export async function validateOwnerAccess(req, ownerId) {
    if (!req.user || !req.user.id) return false;

    try {
        // 1. Tenta usar dados já presentes no req.user (caso o middleware tenha sido expandido)
        // ou busca o perfil atualizado no banco de dados.
        let role = req.user.role;
        let linkedOwnerId = req.user.owner_id;

        if (!role) {
            const { data: profile, error } = await supabaseAdmin
                .from('profiles')
                .select('owner_id, role')
                .eq('id', req.user.id)
                .single();

            if (error || !profile) return false;
            
            role = profile.role;
            linkedOwnerId = profile.owner_id;
        }

        // 2. Aplica as regras de negócio por papel (Role)
        
        // Caso OWNER: Só pode acessar seu próprio ID
        if (role === 'owner') {
            return req.user.id === ownerId;
        }

        // Caso ADMIN: Pode acessar o ownerId ao qual está vinculado
        if (role === 'admin') {
            return linkedOwnerId === ownerId;
        }

        // Caso MEMBER: Pode acessar o ownerId ao qual está vinculado
        // (A filtragem por congregação é feita em nível de dados, não de ownerId)
        if (role === 'member') {
            return linkedOwnerId === ownerId;
        }

        return false;
    } catch (err) {
        console.error('[validateOwnerAccess] Erro crítico na validação:', err.message);
        return false;
    }
}
