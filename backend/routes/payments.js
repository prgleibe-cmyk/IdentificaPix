
import express from 'express';
import { createMockPayment, getMockPaymentStatus } from '../../services/serverHelpers.js';

const router = express.Router();

router.post('/create', async (req, res) => {
    try {
        const responseData = await createMockPayment(req.body);
        res.json(responseData);
    } catch (error) {
        console.error("[Payments Route] Erro no checkout:", error);
        res.status(500).json({ error: "Erro ao processar pagamento." });
    }
});

router.get('/status/:id', async (req, res) => {
    try {
        const responseData = await getMockPaymentStatus(req.params.id);
        res.json(responseData);
    } catch (error) {
        console.error("[Payments Route] Erro no status:", error);
        res.status(500).json({ error: "Erro ao verificar status." });
    }
});

export default router;
