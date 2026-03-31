
import express from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';
import { ReportService } from '../services/ReportService.js';

const router = express.Router();

export default () => {
    router.get('/data/:ownerId', async (req, res) => {
        const { ownerId } = req.params;
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return res.status(500).json({ error: "Erro de configuração: Service Role não encontrada." });
        }

        // Verificação de segurança centralizada (IDOR Protection)
        validateOwnerAccess(req, ownerId);
        
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        try {
            console.log(`[Reference API] Buscando dados de referência para owner ${ownerId} (requisitado por ${req.user.id})`);

            // Buscar bancos (Otimizado: apenas campos necessários)
            const { data: banks, error: banksError } = await supabaseAdmin
                .from('banks')
                .select('id, name, user_id')
                .eq('user_id', ownerId);
            
            if (banksError) {
                console.error(`[Reference API] Erro ao buscar bancos para owner ${ownerId}:`, banksError.message);
            }

            // Buscar igrejas (Otimizado: apenas campos necessários)
            const { data: churches, error: churchesError } = await supabaseAdmin
                .from('churches')
                .select('id, name, user_id, address, pastor, logoUrl')
                .eq('user_id', ownerId);

            if (churchesError) {
                console.error(`[Reference API] Erro ao buscar igrejas para owner ${ownerId}:`, churchesError.message);
            }

            // --- BUSCA DE ASSOCIAÇÕES APRENDIDAS (Consolidado) ---
            const { data: associations } = await supabaseAdmin
                .from('learned_associations')
                .select('id, normalized_description, contributor_normalized_name, church_id, user_id')
                .eq('user_id', ownerId);

            // --- BUSCA DE MODELOS DE ARQUIVO (Consolidado) ---
            const { data: models } = await supabaseAdmin
                .from('file_models')
                .select('id, name, fingerprint, mapping, parsing_rules, lineage_id, version')
                .eq('user_id', ownerId)
                .eq('is_active', true);

            // --- BUSCA DE RELATÓRIOS (Centralizado via ReportService) ---
            let reports = [];
            try {
                reports = await ReportService.listReports(req, ownerId, limit, offset);
            } catch (reportsErr) {
                console.error("[Reference API] Erro crítico ao buscar relatórios via ReportService:", reportsErr);
            }

            console.log(`[Reference API] Finalizado: ${banks?.length || 0} bancos, ${churches?.length || 0} igrejas, ${reports.length} relatórios, ${associations?.length || 0} associações.`);

            res.json({ 
                banks: banks || [], 
                churches: churches || [],
                reports: reports,
                associations: associations || [],
                models: models || []
            });
        } catch (error) {
            console.error("[Reference API] Erro:", error);
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    router.post('/report/sync', async (req, res) => {
        const { reportId, name, data, recordCount, churchId, ownerId } = req.body;
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return res.status(500).json({ error: "Erro de configuração." });
        }

        validateOwnerAccess(req, ownerId);

        try {
            // Upsert do relatório usando Service Role (ignora RLS)
            // Usamos o ownerId como user_id do relatório para que seja compartilhado
            const { data: result, error } = await supabaseAdmin
                .from('saved_reports')
                .upsert({
                    id: reportId,
                    name: name,
                    data: data,
                    record_count: recordCount,
                    user_id: ownerId, // Salva sempre com o ID do Owner para ser compartilhado
                    church_id: churchId
                }, { onConflict: 'id' })
                .select()
                .single();

            if (error) throw error;
            res.json(result);
        } catch (error) {
            console.error("[Reference API] Erro ao sincronizar relatório:", error);
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    router.get('/report/:reportId', async (req, res) => {
        const { reportId } = req.params;
        const { ownerId } = req.query;
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return res.status(500).json({ error: "Erro de configuração." });
        }

        validateOwnerAccess(req, ownerId);

        try {
            const { data, error } = await supabaseAdmin
                .from('saved_reports')
                .select('data, name')
                .eq('id', reportId)
                .eq('user_id', ownerId)
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            console.error("[Reference API] Erro ao buscar relatório:", error);
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    return router;
};
