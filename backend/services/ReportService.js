import { getSupabaseAdmin } from '../lib/supabase.js';

export class ReportService {
    static async listReports(req, effectiveOwnerId) {
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            throw new Error("Erro de configuração: Service Role não encontrada.");
        }

        let query = supabaseAdmin
            .from('saved_reports')
            .select('*')
            .eq('user_id', effectiveOwnerId)
            .order('created_at', { ascending: false });

        // Suportar paginação opcional através de req.query.limit e req.query.offset se presentes
        if (req && req.query) {
            const limit = parseInt(req.query.limit, 10);
            const offset = parseInt(req.query.offset, 10);

            if (!isNaN(limit) && !isNaN(offset)) {
                query = query.range(offset, offset + limit - 1);
            } else if (!isNaN(limit)) {
                query = query.range(0, limit - 1);
            }
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return data || [];
    }
}
