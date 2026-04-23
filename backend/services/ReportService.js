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
     * @returns {Promise<Array>} - Lista de relatórios formatada
     */
    async listReports(req, ownerId) {
        const supabaseAdmin = getSupabaseAdmin();
        const user = req.user;
        const effectiveUserId = user.owner_id || user.id;
        
        const isActualOwner = user.id === ownerId;

        let reports = [];

        try {
            const fetchAllReports = async (queryBuilder) => {
                let allData = [];
                let from = 0;
                const pageSize = 1000;
                while (true) {
                    const { data, error } = await queryBuilder
                        .range(from, from + pageSize - 1);
                    
                    if (error) throw error;
                    if (!data || data.length === 0) break;
                    
                    allData = [...allData, ...data];
                    if (data.length < pageSize) break;
                    from += pageSize;
                }
                return allData;
            };

            if (isActualOwner) {
                const query = supabaseAdmin
                    .from('saved_reports')
                    .select('id, name, created_at, record_count, user_id, church_id')
                    .eq('user_id', effectiveUserId)
                    .order('created_at', { ascending: false });
                
                reports = await fetchAllReports(query);
            } else {
                const query = supabaseAdmin
                    .from('saved_reports')
                    .select('id, name, created_at, record_count, user_id, church_id')
                    .or(`user_id.eq.${user.id},and(user_id.eq.${ownerId},name.eq.[SESSÃO_ATIVA])`)
                    .order('created_at', { ascending: false });
                
                reports = await fetchAllReports(query);

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