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
        
        // Função auxiliar para busca paginada completa (Garante 100% dos dados)
        const fetchAll = async (table, select, userIdField = 'user_id', extraFilters = (q) => q) => {
            let allData = [];
            let from = 0;
            const pageSize = 1000;
            
            while (true) {
                let query = supabaseAdmin
                    .from(table)
                    .select(select)
                    .eq(userIdField, effectiveOwnerId)
                    .range(from, from + pageSize - 1);
                
                query = extraFilters(query);
                
                const { data, error } = await query;
                if (error) throw error;
                if (!data || data.length === 0) break;
                
                allData = [...allData, ...data];
                if (data.length < pageSize) break;
                from += pageSize;
            }
            return allData;
        };

        try {
            console.log(`[Reference API] Buscando dados de referência para owner ${effectiveOwnerId} (requisitado por ${req.user.id})`);

            const banks = await fetchAll('banks', 'id, name, user_id');
            const churches = await fetchAll('churches', 'id, name, user_id, address, pastor, logoUrl');
            const associations = await fetchAll('learned_associations', 'id, normalized_description, contributor_normalized_name, church_id, user_id');
            const models = await fetchAll('file_models', 'id, name, fingerprint, mapping, parsing_rules, lineage_id, version', 'user_id', (q) => q.eq('is_active', true));

            let reports = [];
            try {
                // Removemos a limitação de paginação fixa do ReportService
                reports = await ReportService.listReports(req, effectiveOwnerId);
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