
import express from 'express';
import { createAsaasPayment, getAsaasPaymentStatus } from '../../services/serverHelpers.js';

const router = express.Router();

router.post('/create', async (req, res) => {
    try {
        const responseData = await createAsaasPayment(req.body);
        res.json(responseData);
    } catch (error) {
        console.error("[Payments Route] Erro no checkout:", error);
        res.status(500).json({ error: error.message || "Erro ao processar pagamento." });
    }
});

router.get('/status/:id', async (req, res) => {
    try {
        const responseData = await getAsaasPaymentStatus(req.params.id);
        res.json(responseData);
    } catch (error) {
        console.error("[Payments Route] Erro no status:", error);
        res.status(500).json({ error: "Erro ao verificar status." });
    }
});

export default router;
