
import express from 'express';
import { createAsaasPayment, getAsaasPaymentStatus } from '../../services/serverHelpers.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';

const router = express.Router();

router.post('/create', authMiddleware, async (req, res) => {
    try {
        if (req.body?.userId) {
            validateOwnerAccess(req, req.body.userId);
        }
        const responseData = await createAsaasPayment(req.body);
        res.json(responseData);
    } catch (error) {
        console.error("[Payments Route] Erro no checkout:", error);
        res.status(error?.status || 500).json({ error: error.message || "Erro ao processar pagamento." });
    }
});

router.get('/status/:id', authMiddleware, async (req, res) => {
    try {
        const responseData = await getAsaasPaymentStatus(req.params.id);
        res.json(responseData);
    } catch (error) {
        console.error("[Payments Route] Erro no status:", error);
        res.status(error?.status || 500).json({ error: "Erro ao verificar status." });
    }
});

export default router;
