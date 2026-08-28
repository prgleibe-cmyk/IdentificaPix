import express from 'express';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = express.Router();

export default () => {
    const getVpsApiUrl = () => {
        const defaultPort = process.env.PORT || '3000';
        const vpsUrl = process.env.CONTRIBUTORS_API_URL || (process.env.INTEGRATED_MODE === 'true' ? `http://127.0.0.1:${defaultPort}` : 'http://127.0.0.1:3010');
        return vpsUrl.endsWith('/') ? vpsUrl.slice(0, -1) : vpsUrl;
    };

    const fetchVps = async (endpoint, options = {}) => {
        const baseUrl = getVpsApiUrl();
        const primaryUrl = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(primaryUrl, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (primaryErr) {
            console.warn(`[Users API] Falha ao conectar em ${primaryUrl}: ${primaryErr.message}. Tentando fallback local...`);
            
            const fallbackPort = process.env.PORT || '3000';
            const fallbackUrl = `http://127.0.0.1:${fallbackPort}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
            
            if (fallbackUrl !== primaryUrl) {
                return await fetch(fallbackUrl, options);
            }
            throw primaryErr;
        }
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
            "confirmar_final": permissions?.confirmar_final !== undefined ? permissions.confirmar_final : (permissions?.confirmFinal !== undefined ? permissions.confirmFinal : true),
            "identificar": permissions?.identificar !== undefined ? permissions.identificar : (permissions?.identifyPayments !== undefined ? permissions.identifyPayments : true),
            "desfazer_identificacao": permissions?.desfazer_identificacao !== undefined ? permissions.desfazer_identificacao : (permissions?.undoIdentification !== undefined ? permissions.undoIdentification : true),
            "baixar_arquivo": permissions?.baixar_arquivo !== undefined ? permissions.baixar_arquivo : (permissions?.downloadFile !== undefined ? permissions.downloadFile : true),
            "imprimir": permissions?.imprimir !== undefined ? permissions.imprimir : (permissions?.printReport !== undefined ? permissions.printReport : true),
            "gestao_contas": permissions?.gestao_contas !== undefined ? permissions.gestao_contas : (permissions?.manageAccounts !== undefined ? permissions.manageAccounts : false),
            "carnes_propositos": permissions?.carnes_propositos !== undefined ? permissions.carnes_propositos : (permissions?.managePledges !== undefined ? permissions.managePledges : false),
            "patrimonio": permissions?.patrimonio !== undefined ? permissions.patrimonio : (permissions?.managePatrimony !== undefined ? permissions.managePatrimony : false),
            "bankIds": permissions?.bankIds || [],
            "congregationIds": churchIds
        };

        try {
            // Resolver se já existe profile ou user cadastrado com este e-mail para manter a mesma identidade canônica
            let userId = null;
            try {
                const checkRes = await fetchVps(`/api/v1/profiles/${encodeURIComponent(email)}`);
                if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    if (checkData?.data?.id) {
                        userId = checkData.data.id;
                    }
                }
            } catch (checkErr) {
                console.warn("[Users API] Aviso ao verificar perfil existente:", checkErr.message);
            }

            if (!userId) {
                userId = crypto.randomUUID();
            }
            
            // 1. Criar ou atualizar perfil na tabela profiles com o ID canônico
            const profilePayload = {
                id: userId,
                email: email,
                name: req.body.name || null,
                owner_id: ownerId,
                role: 'member',
                permissions: permissionsObject,
                congregation: churchIds[0] || null
            };

            const response = await fetchVps('/api/v1/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profilePayload)
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.message || data?.error || "Falha ao criar perfil na VPS API");
            }

            // 2. Criar ou atualizar credenciais em app_users para autenticação do usuário secundário garantindo mesmo ID
            try {
                await fetchVps('/api/v1/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        name: req.body.name || null,
                        role: 'member',
                        owner_id: ownerId,
                        church_id: churchIds[0] || null
                    })
                });
            } catch (authErr) {
                console.warn("[Users API] Aviso ao cadastrar credenciais de autenticação:", authErr.message);
            }

            console.log("[Users API] Usuário e perfil vinculados com sucesso! ID:", userId);
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
            
            const authHeader = req.headers.authorization;
            const fetchOptions = authHeader ? { headers: { 'Authorization': authHeader } } : {};
            const response = await fetchVps(`/api/v1/profiles?owner_id=${effectiveOwnerId}`, fetchOptions);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || "Erro ao consultar VPS API");
            }

            const profilesList = data.data || (Array.isArray(data) ? data : []);
            const currentUserId = req.user ? req.user.id : null;
            const currentUserEmail = req.user ? req.user.email?.toLowerCase().trim() : null;

            // Filtro de segurança para excluir o próprio administrador solicitante
            const filteredData = profilesList.filter(p => {
                if (currentUserId && p.id === currentUserId) return false;
                if (currentUserEmail && p.email && p.email.toLowerCase().trim() === currentUserEmail) return false;
                return true;
            });
            
            console.log("[Users API] Total de usuários secundários retornados:", filteredData.length);
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
            
            const response = await fetchVps(`/api/v1/profiles/${userId}`, { method: 'DELETE' });
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
        const { name, churchIds, permissions, ownerId, password } = req.body;

        try {
            console.log("[Users API] Atualizando usuário:", userId, "solicitado por owner:", ownerId);
            
            validateOwnerAccess(req, ownerId);
            
            const permissionsObject = {
                ...permissions,
                "congregationIds": churchIds
            };
            
            const response = await fetchVps(`/api/v1/profiles/${userId}`, {
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

            // Atualizar senha se fornecida
            if (password && req.body.email) {
                try {
                    await fetchVps('/api/v1/auth/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: req.body.email,
                            password: password,
                            name: name || null
                        })
                    });
                } catch (pwdErr) {
                    console.warn("[Users API] Aviso ao atualizar senha na auth:", pwdErr.message);
                }
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