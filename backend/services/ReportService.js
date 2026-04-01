import { getSupabaseAdmin } from '../lib/supabase.js';

/**
 * ReportService - Centraliza a lógica de listagem, filtragem e permissões de relatórios.
 */
export const ReportService = {
    /**
     * Lista os relatórios baseados no ownerId e nas permissões do usuário requisitante.
     * 
     * @param {Object} req - Objeto de requisição do Express (contém req.user)
     * @param {string} ownerId - ID do proprietário dos dados
     * @param {number} limit - Limite de registros (default: 50)
     * @param {number} offset - Deslocamento de registros (default: 0)
     * @returns {Promise<Array>} - Lista de relatórios formatada
     */
    async listReports(req, ownerId, limit = 50, offset = 0) {
        const supabaseAdmin = getSupabaseAdmin();
        const user = req.user;
        const effectiveUserId = user.owner_id || user.id;
        
        const isActualOwner = user.id === ownerId;

        let reports = [];

        try {
            if (isActualOwner) {
                const { data: ownerReports, error } = await supabaseAdmin
                    .from('saved_reports')
                    .select('id, name, created_at, record_count, user_id, church_id')
                    .eq('user_id', effectiveUserId)
                    .order('created_at', { ascending: false })
                    .limit(limit)
                    .range(offset, offset + limit - 1);
                
                if (error) throw error;
                reports = ownerReports || [];
            } else {
                const { data: combinedReports, error } = await supabaseAdmin
                    .from('saved_reports')
                    .select('id, name, created_at, record_count, user_id, church_id')
                    .or(`user_id.eq.${user.id},and(user_id.eq.${ownerId},name.eq.[SESSÃO_ATIVA])`)
                    .order('created_at', { ascending: false })
                    .limit(limit)
                    .range(offset, offset + limit - 1);
                
                if (error) throw error;
                reports = combinedReports || [];

                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('permissions')
                    .eq('id', user.id)
                    .single();

                let allowedChurchIds = [];
                try {
                    const perms = typeof profile?.permissions === 'string' 
                        ? JSON.parse(profile.permissions) 
                        : (profile?.permissions || {});
                    
                    if (Array.isArray(perms.congregationIds)) {
                        allowedChurchIds = perms.congregationIds.map(id => String(id));
                    }
                } catch (e) {}

                if (allowedChurchIds.length > 0) {
                    reports = reports.filter(r => 
                        r.name === '[SESSÃO_ATIVA]' || 
                        !r.church_id || 
                        allowedChurchIds.includes(String(r.church_id))
                    );
                }
            }

            return reports;

        } catch (error) {
            console.error("[ReportService] Erro ao listar relatórios:", error);
            throw error;
        }
    }
};