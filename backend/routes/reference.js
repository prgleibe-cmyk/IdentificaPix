import express from 'express';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';
import { ReportService } from '../services/ReportService.js';

const router = express.Router();

export default () => {
    const getVpsApiUrl = () => {
        const defaultPort = process.env.PORT || (process.env.NODE_ENV === 'production' ? '3000' : '3001');
        const rawUrl = process.env.CONTRIBUTORS_API_URL;
        const vpsUrl = (rawUrl && !rawUrl.includes('contributors-api:3010'))
            ? rawUrl
            : (process.env.INTEGRATED_MODE === 'true' ? `http://127.0.0.1:${defaultPort}` : 'http://127.0.0.1:3010');
        return vpsUrl.endsWith('/') ? vpsUrl.slice(0, -1) : vpsUrl;
    };

    router.get('/data/:ownerId', async (req, res) => {
        const userRole = String(req.user?.role || '').toLowerCase().trim();
        const isSuper = req.user?.is_superadmin || req.user?.isSuperAdmin || req.user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';
        const isSecondary = !isSuper && ['secondary', 'member', 'operador', 'colaborador'].includes(userRole) && Boolean(req.user?.owner_id && req.user.owner_id !== req.user.id);
        const effectiveOwnerId = isSecondary ? req.user.owner_id : req.user.id;

        validateOwnerAccess(req, effectiveOwnerId);

        try {
            console.log(`[Reference API] Buscando dados de referência para owner ${effectiveOwnerId} (requisitado por ${req.user.id})`);

            const cleanVpsUrl = getVpsApiUrl();

            const authHeader = req.headers.authorization ? { 'Authorization': req.headers.authorization } : {};
            const [banksRes, churchesRes, associationsRes] = await Promise.all([
                fetch(`${cleanVpsUrl}/api/v1/banks?user_id=${effectiveOwnerId}`, { headers: authHeader }),
                fetch(`${cleanVpsUrl}/api/v1/churches?user_id=${effectiveOwnerId}`, { headers: authHeader }),
                fetch(`${cleanVpsUrl}/api/v1/learned_associations?user_id=${effectiveOwnerId}`, { headers: authHeader })
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

        validateOwnerAccess(req, effectiveOwnerId);

        try {
            const cleanVpsUrl = getVpsApiUrl();
            const authHeader = req.headers.authorization ? { 'Authorization': req.headers.authorization } : {};

            const response = await fetch(`${cleanVpsUrl}/api/v1/saved_reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeader
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

        validateOwnerAccess(req, effectiveOwnerId);

        try {
            const cleanVpsUrl = getVpsApiUrl();
            const authHeader = req.headers.authorization ? { 'Authorization': req.headers.authorization } : {};

            const response = await fetch(`${cleanVpsUrl}/api/v1/saved_reports?user_id=${effectiveOwnerId}`, {
                headers: authHeader
            });
            if (!response.ok) {
                throw new Error(`Failed to get reports from VPS: ${response.statusText}`);
            }
            const list = await response.json();
            const found = list.find(r => r.id === reportId);
            if (!found) {
                return res.status(404).json({ error: 'NOT_FOUND' });
            }

            let parsedData = found.data;
            if (typeof parsedData === 'string') {
                try {
                    parsedData = JSON.parse(parsedData);
                } catch (_) {}
            }

            res.json({
                name: found.name,
                data: parsedData
            });
        } catch (error) {
            console.error("[Reference API] Erro ao buscar relatório:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};