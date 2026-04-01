import express from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';
import { ReportService } from '../services/ReportService.js';

const router = express.Router();

export default () => {
    router.get('/data/:ownerId', async (req, res) => {
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return res.status(500).json({ error: "Erro de configuração: Service Role não encontrada." });
        }

        const effectiveOwnerId = req.user.owner_id || req.user.id;

        // 🔥 CORREÇÃO AQUI
        validateOwnerAccess(req, effectiveOwnerId);
        
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        try {
            console.log(`[Reference API] Buscando dados de referência para owner ${effectiveOwnerId} (requisitado por ${req.user.id})`);

            const { data: banks, error: banksError } = await supabaseAdmin
                .from('banks')
                .select('id, name, user_id')
                .eq('user_id', effectiveOwnerId);
            
            if (banksError) {
                console.error(`[Reference API] Erro ao buscar bancos para owner ${effectiveOwnerId}:`, banksError.message);
            }

            const { data: churches, error: churchesError } = await supabaseAdmin
                .from('churches')
                .select('id, name, user_id, address, pastor, logoUrl')
                .eq('user_id', effectiveOwnerId);

            if (churchesError) {
                console.error(`[Reference API] Erro ao buscar igrejas para owner ${effectiveOwnerId}:`, churchesError.message);
            }

            const { data: associations } = await supabaseAdmin
                .from('learned_associations')
                .select('id, normalized_description, contributor_normalized_name, church_id, user_id')
                .eq('user_id', effectiveOwnerId);

            const { data: models } = await supabaseAdmin
                .from('file_models')
                .select('id, name, fingerprint, mapping, parsing_rules, lineage_id, version')
                .eq('user_id', effectiveOwnerId)
                .eq('is_active', true);

            let reports = [];
            try {
                reports = await ReportService.listReports(req, effectiveOwnerId, limit, offset);
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

        const effectiveOwnerId = req.user.owner_id || req.user.id;

        // 🔥 CORREÇÃO AQUI
        validateOwnerAccess(req, effectiveOwnerId);

        try {
            const { data: result, error } = await supabaseAdmin
                .from('saved_reports')
                .upsert({
                    id: reportId,
                    name: name,
                    data: data,
                    record_count: recordCount,
                    user_id: effectiveOwnerId,
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
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return res.status(500).json({ error: "Erro de configuração." });
        }

        const effectiveOwnerId = req.user.owner_id || req.user.id;

        // 🔥 CORREÇÃO AQUI
        validateOwnerAccess(req, effectiveOwnerId);

        try {
            const { data, error } = await supabaseAdmin
                .from('saved_reports')
                .select('data, name')
                .eq('id', reportId)
                .eq('user_id', effectiveOwnerId)
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