import { getSupabaseAdmin } from '../lib/supabase.js';

export class ReportService {
    static async listReports(req, effectiveOwnerId) {
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            throw new Error("Erro de configuração: Service Role não encontrada.");
        }

        // 🚀 Otimização crítica anti-timeout:
        // Selecionamos apenas os metadados dos relatórios (excluindo a coluna 'data' que contém megabytes de JSON por registro).
        // Isso reduz o payload de ~200MB para alguns kilobytes, evitando timeout em bancos grandes.
        let query = supabaseAdmin
            .from('saved_reports')
            .select('id, name, created_at, record_count, user_id, church_id')
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

        const { data: reportsMetadata, error: metadataError } = await query;

        if (metadataError) {
            throw metadataError;
        }

        if (!reportsMetadata || reportsMetadata.length === 0) {
            return [];
        }

        // ⚡ Buscamos a SESSÃO ATIVA por ID separado (point-query rápido) contendo 'data', 
        // pois ela precisa ser hidratada em tempo real pelo useCloudSync/useCloudSync.ts no front-end.
        const activeReportId = `LIVE_SESSION_${effectiveOwnerId}`;
        const { data: activeReportFull, error: activeReportError } = await supabaseAdmin
            .from('saved_reports')
            .select('id, name, created_at, record_count, user_id, church_id, data')
            .eq('id', activeReportId)
            .maybeSingle();

        if (activeReportError) {
            console.error("[ReportService] Erro ao buscar sessão ativa para merge:", activeReportError);
        }

        // Fazemos o merge dos metadados rápidos com a sessão ativa completa
        const mergedReports = reportsMetadata.map(report => {
            if (report.id === activeReportId && activeReportFull) {
                return activeReportFull;
            }
            return {
                ...report,
                data: null // O front-end lidará graciosamente com data=null ao listar, e carregará sob demanda por ID ao visualizar
            };
        });

        return mergedReports;
    }
}
