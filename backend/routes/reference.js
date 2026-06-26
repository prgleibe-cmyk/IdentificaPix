import express from 'express';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';
import { ReportService } from '../services/ReportService.js';

const router = express.Router();

export default () => {
    router.get('/data/:ownerId', async (req, res) => {
        const effectiveOwnerId = req.user.owner_id || req.user.id;

        // 🔥 CORREÇÃO AQUI
        validateOwnerAccess(req, effectiveOwnerId);

        try {
            console.log(`[Reference API] Buscando dados de referência para owner ${effectiveOwnerId} (requisitado por ${req.user.id})`);

            const vpsUrl = process.env.CONTRIBUTORS_API_URL || 'http://127.0.0.1:3010';
            const cleanVpsUrl = vpsUrl.endsWith('/') ? vpsUrl.slice(0, -1) : vpsUrl;

            const [banksRes, churchesRes, associationsRes] = await Promise.all([
                fetch(`${cleanVpsUrl}/api/v1/banks?user_id=${effectiveOwnerId}`),
                fetch(`${cleanVpsUrl}/api/v1/churches?user_id=${effectiveOwnerId}`),
                fetch(`${cleanVpsUrl}/api/v1/learned_associations?user_id=${effectiveOwnerId}`)
            ]);

            const banks = banksRes.ok ? await banksRes.json() : [];
            const churches = churchesRes.ok ? await churchesRes.json() : [];
            const associations = associationsRes.ok ? await associationsRes.json() : [];

            let reports = [];
            try {
                reports = await ReportService.listReports(req, effectiveOwnerId);
            } catch (reportsErr) {
                console.error("[Reference API] Erro crítico ao buscar relatórios via ReportService:", reportsErr);
            }

            console.log(`[Reference API] Finalizado: ${banks?.length || 0} bancos, ${churches?.length || 0} igrejas, ${reports.length} relatórios, ${associations?.length || 0} associações.`);

            res.json({ 
                banks: banks || [], 
                churches: churches || [],
                reports: reports,
                associations: associations || []
            });
        } catch (error) {
            console.error("[Reference API] Erro:", error);
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    router.post('/report/sync', async (req, res) => {
        const { reportId, name, data, recordCount, churchId } = req.body;
        const effectiveOwnerId = req.user.owner_id || req.user.id;

        // 🔥 CORREÇÃO AQUI
        validateOwnerAccess(req, effectiveOwnerId);

        try {
            const vpsUrl = process.env.CONTRIBUTORS_API_URL || 'http://127.0.0.1:3010';
            const cleanVpsUrl = vpsUrl.endsWith('/') ? vpsUrl.slice(0, -1) : vpsUrl;

            const response = await fetch(`${cleanVpsUrl}/api/v1/saved_reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: reportId,
                    name: name,
                    data: data,
                    record_count: recordCount,
                    user_id: effectiveOwnerId,
                    church_id: churchId
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to sync report to VPS: ${response.statusText}`);
            }

            const result = await response.json();
            res.json(result);
        } catch (error) {
            console.error("[Reference API] Erro ao sincronizar relatório:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/report/:reportId', async (req, res) => {
        const { reportId } = req.params;
        const effectiveOwnerId = req.user.owner_id || req.user.id;

        // 🔥 CORREÇÃO AQUI
        validateOwnerAccess(req, effectiveOwnerId);

        try {
            const vpsUrl = process.env.CONTRIBUTORS_API_URL || 'http://127.0.0.1:3010';
            const cleanVpsUrl = vpsUrl.endsWith('/') ? vpsUrl.slice(0, -1) : vpsUrl;

            // Wait, we want to fetch a single saved report, but we don't have GET /api/v1/saved_reports/:id.
            // Oh, but we can query GET /api/v1/saved_reports?user_id=... and filter in memory, or add GET /api/v1/saved_reports/:id to VPS!
            // Wait, let's see if we can query GET /api/v1/saved_reports?user_id=... and filter, which is very simple. Or better yet, we can check if VPS supports getting saved_reports. Let's see: yes, filtering by ID on client/proxy side is extremely robust and avoids needing to edit too many routes.
            // Wait, let's check if the list query can return it. Yes:
            const response = await fetch(`${cleanVpsUrl}/api/v1/saved_reports?user_id=${effectiveOwnerId}`);
            if (!response.ok) {
                throw new Error(`Failed to get reports from VPS: ${response.statusText}`);
            }
            const list = await response.json();
            const found = list.find(r => r.id === reportId);
            if (!found) {
                return res.status(404).json({ error: 'NOT_FOUND' });
            }

            // Return { data: found.data, name: found.name }
            res.json({
                name: found.name,
                data: typeof found.data === 'string' ? JSON.parse(found.data) : found.data
            });
        } catch (error) {
            console.error("[Reference API] Erro ao buscar relatório:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};