import express from 'express';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = express.Router();

export default () => {
    const getVpsApiUrl = () => {
        const vpsUrl = process.env.CONTRIBUTORS_API_URL || 'http://127.0.0.1:3010';
        return vpsUrl.endsWith('/') ? vpsUrl.slice(0, -1) : vpsUrl;
    };

    // Rota de diagnóstico para verificar o ambiente
    router.get('/debug-env', (req, res) => {
        res.json({
            vpsApiUrl: getVpsApiUrl(),
            envFileExists: fs.existsSync(path.join(process.cwd(), '.env')),
            cwd: process.cwd(),
            nodeVersion: process.version
        });
    });

    router.post('/create', async (req, res) => {
        console.log("[Users API] Recebida requisição de criação de usuário:", req.body.email);
        const { email, password, churchIds, permissions, ownerId } = req.body;
        
        if (!email || !password || !churchIds || !ownerId) {
            console.error("[Users API] Dados incompletos:", { email, hasPassword: !!password, churchIds, ownerId });
            return res.status(400).json({ error: "Dados incompletos para criação de usuário." });
        }

        // Verificação de segurança centralizada (IDOR Protection)
        validateOwnerAccess(req, ownerId);

        const permissionsObject = {
            "confirmar_final": permissions.confirmar_final !== undefined ? permissions.confirmar_final : true,
            "identificar": permissions.identificar !== undefined ? permissions.identificar : true,
            "desfazer_identificacao": permissions.desfazer_identificacao !== undefined ? permissions.desfazer_identificacao : true,
            "baixar_arquivo": permissions.baixar_arquivo !== undefined ? permissions.baixar_arquivo : true,
            "imprimir": permissions.imprimir !== undefined ? permissions.imprimir : true,
            "gestao_contas": permissions.gestao_contas !== undefined ? permissions.gestao_contas : false,
            "carnes_propositos": permissions.carnes_propositos !== undefined ? permissions.carnes_propositos : false,
            "patrimonio": permissions.patrimonio !== undefined ? permissions.patrimonio : false,
            "bankIds": permissions.bankIds || [],
            "congregationIds": churchIds
        };

        try {
            const userId = crypto.randomUUID();
            const targetUrl = `${getVpsApiUrl()}/api/v1/profiles`;
            
            const profilePayload = {
                id: userId,
                email: email,
                name: req.body.name,
                owner_id: ownerId,
                role: 'member',
                permissions: permissionsObject,
                congregation: churchIds[0] || null
            };

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profilePayload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || data.error || "Falha ao criar perfil na VPS API");
            }

            console.log("[Users API] Usuário e perfil criados com sucesso na VPS!");
            res.json({ success: true, message: "Usuário criado com sucesso", userId: userId });

        } catch (error) {
            console.error("[Users API] Erro fatal na criação de usuário:", error);
            res.status(500).json({ 
                error: error.message || "Falha ao criar usuário secundário.",
                code: error.code || null
            });
        }
    });

    // Listar usuários de um owner
    router.get('/list/:ownerId', async (req, res) => {
        const { ownerId } = req.params;

        try {
            const effectiveOwnerId = (req.user && (req.user.owner_id || req.user.id)) || ownerId;

            validateOwnerAccess(req, effectiveOwnerId);

            console.log("[Users API] Listando usuários para owner:", effectiveOwnerId);
            
            const targetUrl = `${getVpsApiUrl()}/api/v1/profiles?owner_id=${effectiveOwnerId}`;
            const response = await fetch(targetUrl);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || "Erro ao consultar VPS API");
            }

            const profilesList = data.data || (Array.isArray(data) ? data : []);
            const currentUserId = req.user ? req.user.id : null;
            const filteredData = profilesList.filter(p => p.id !== currentUserId);
            
            console.log("[Users API] Total após filtro:", filteredData.length);
            res.json(filteredData);
        } catch (error) {
            console.error("[Users API] Erro ao listar usuários:", error);
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    // Excluir usuário
    router.delete('/delete/:userId', async (req, res) => {
        const { userId } = req.params;
        const { ownerId } = req.query;

        if (!ownerId) {
            return res.status(400).json({ error: "ownerId é obrigatório para exclusão." });
        }

        validateOwnerAccess(req, ownerId);

        try {
            console.log("[Users API] Tentando excluir usuário:", userId, "solicitado por owner:", ownerId);
            
            const targetUrl = `${getVpsApiUrl()}/api/v1/profiles/${userId}`;
            const response = await fetch(targetUrl, { method: 'DELETE' });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || "Erro ao excluir perfil na VPS");
            }

            console.log("[Users API] Usuário excluído com sucesso!");
            res.json({ success: true });
        } catch (error) {
            console.error("[Users API] Erro fatal ao excluir usuário:", error);
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    // Atualizar usuário
    router.post('/update/:userId', async (req, res) => {
        const { userId } = req.params;
        const { name, churchIds, permissions, ownerId } = req.body;

        try {
            console.log("[Users API] Atualizando usuário:", userId, "solicitado por owner:", ownerId);
            
            validateOwnerAccess(req, ownerId);
            
            const permissionsObject = {
                ...permissions,
                "congregationIds": churchIds
            };
            
            const targetUrl = `${getVpsApiUrl()}/api/v1/profiles/${userId}`;
            const response = await fetch(targetUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    email: req.body.email || undefined,
                    permissions: permissionsObject,
                    congregation: churchIds ? churchIds[0] || null : undefined
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || data.error || "Erro ao atualizar perfil na VPS");
            }

            console.log("[Users API] Usuário atualizado com sucesso!");
            res.json({ success: true });
        } catch (error) {
            console.error("[Users API] Erro ao atualizar usuário:", error);
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    return router;
};