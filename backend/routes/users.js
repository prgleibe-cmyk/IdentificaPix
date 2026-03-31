
import express from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { validateOwnerAccess } from '../lib/validateOwnerAccess.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

export default () => {
    // Rota de diagnóstico para verificar as chaves (sem mostrá-las inteiras)
    router.get('/debug-env', (req, res) => {
        const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.SERVICE_ROLE_KEY ||
                    process.env.SUPABASE_SERVICE_KEY;
                    
        const ak = process.env.SUPABASE_ANON_KEY || 
                   process.env.VITE_SUPABASE_ANON_KEY || 
                   process.env.ANON_KEY;
        
        res.json({
            supabaseUrl: supabaseUrl,
            hasServiceRoleKey: !!srk,
            serviceRoleKeyLength: srk ? srk.length : 0,
            serviceRoleKeyStart: srk ? `${srk.substring(0, 10)}...` : 'N/A',
            hasAnonKey: !!ak,
            detectedKeys: Object.keys(process.env).filter(k => 
                k.includes('SUPABASE') || k.includes('API_KEY') || k.includes('VITE_') || k.includes('SERVICE')
            ),
            envFileExists: fs.existsSync(path.join(process.cwd(), '.env')),
            cwd: process.cwd(),
            nodeVersion: process.version
        });
    });

    router.post('/create', async (req, res) => {
        console.log("[Users API] Recebida requisição de criação de usuário:", req.body.email);
        const { email, password, churchIds, permissions, ownerId } = req.body;
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            console.error("[Users API] Falha ao inicializar Supabase");
            return res.status(500).json({ error: "Erro de configuração: Cliente Supabase não pôde ser inicializado. Verifique as variáveis de ambiente." });
        }
        
        if (!email || !password || !churchIds || !ownerId) {
            console.error("[Users API] Dados incompletos:", { email, hasPassword: !!password, churchIds, ownerId });
            return res.status(400).json({ error: "Dados incompletos para criação de usuário." });
        }

        // Verificação de segurança centralizada (IDOR Protection)
        validateOwnerAccess(req, ownerId);

        const permissionsObject = {
            "confirmar_final": permissions.confirmar_final,
            "identificar": permissions.identificar,
            "desfazer_identificacao": permissions.desfazer_identificacao,
            "baixar_arquivo": permissions.baixar_arquivo,
            "imprimir": permissions.imprimir,
            "bankIds": permissions.bankIds || [],
            "congregationIds": churchIds // Armazenamos o array completo no JSON de permissões
        };

        try {
            // 1. Verificar se o solicitante é OWNER
            console.log("[Users API] Verificando permissão do owner:", ownerId);
            const { data: ownerProfile, error: ownerError } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', ownerId)
                .single();

            if (ownerError) {
                console.error("[Users API] Erro ao buscar perfil do owner:", ownerError);
                throw new Error(`Erro ao validar permissão: ${ownerError.message}`);
            }

            if (!ownerProfile || ownerProfile.role !== 'owner') {
                console.error("[Users API] Usuário não é owner ou não encontrado:", ownerProfile);
                return res.status(403).json({ error: "Apenas usuários titulares podem criar novos usuários." });
            }

            // 2. Criar usuário no Supabase Auth
            console.log("[Users API] Criando usuário no Auth...");
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true // Confirmar automaticamente para usuários secundários
            });

            if (authError) {
                console.error("[Users API] Erro no Auth.admin.createUser:", authError);
                
                // Supabase retorna 422 e código 'email_exists' para duplicatas
                const isDuplicate = authError.code === 'email_exists' || 
                                   (authError.message && authError.message.toLowerCase().includes('already registered')) ||
                                   (authError.message && authError.message.toLowerCase().includes('already been registered'));

                if (isDuplicate) {
                    return res.status(409).json({ 
                        error: "Este e-mail já está cadastrado no sistema.",
                        code: 'email_exists'
                    });
                }
                throw authError;
            }

            const newUser = authData.user;
            console.log("[Users API] Usuário criado no Auth com ID:", newUser.id);

            // 3. Criar ou atualizar registro na tabela profiles
            console.log("[Users API] Criando/Atualizando perfil na tabela profiles...");
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: newUser.id,
                    email: email,
                    name: req.body.name, // Nome completo do formulário
                    owner_id: ownerId,
                    role: 'member',
                    permissions: permissionsObject,
                    congregation: churchIds[0] || null // Apenas o primeiro ID (UUID) para evitar erro de sintaxe
                }, { onConflict: 'id' });

            if (profileError) {
                console.error("[Users API] Erro ao criar perfil:", profileError);
                // Se falhar ao criar o perfil, tentamos remover o usuário do auth para manter consistência
                console.log("[Users API] Removendo usuário do Auth devido a falha no perfil...");
                await supabaseAdmin.auth.admin.deleteUser(newUser.id);
                throw profileError;
            }

            console.log("[Users API] Usuário e perfil criados com sucesso!");
            res.json({ success: true, message: "Usuário criado com sucesso", userId: newUser.id });

        } catch (error) {
            console.error("[Users API] Erro fatal na criação de usuário:", error);
            
            // Tenta extrair o status code do erro original
            let statusCode = error.status || 500;
            let errorMessage = error.message || "Falha ao criar usuário secundário.";

            // Reforço para erro de e-mail duplicado no catch
            if (error.code === 'email_exists' || 
                (error.message && error.message.toLowerCase().includes('already registered')) ||
                (error.message && error.message.toLowerCase().includes('already been registered'))) {
                statusCode = 409;
                errorMessage = "Este e-mail já está cadastrado no sistema.";
            }
            
            res.status(statusCode).json({ 
                error: errorMessage,
                details: error.details || error.hint || null,
                code: error.code || null
            });
        }
    });

    // Listar usuários de um owner
    router.get('/list/:ownerId', async (req, res) => {
        const { ownerId } = req.params;
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return res.status(500).json({ error: "Erro de configuração" });
        }

        validateOwnerAccess(req, ownerId);

        try {
            console.log("[Users API] Listando usuários para owner:", ownerId);
            
            // Buscamos todos os perfis onde o owner_id é o solicitado
            const { data, error, count } = await supabaseAdmin
                .from('profiles')
                .select('*', { count: 'exact' })
                .eq('owner_id', ownerId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("[Users API] Erro na query do Supabase:", error);
                throw error;
            }

            console.log(`[Users API] Encontrados ${count || 0} usuários para o owner ${ownerId}`);
            
            if (data && data.length > 0) {
                console.log("[Users API] IDs dos usuários encontrados:", data.map(u => u.id));
            }

            // Retornamos a lista, garantindo que não incluímos o próprio usuário logado na lista de "gerenciáveis" 
            // (geralmente não se edita a si mesmo nesta tela)
            const filteredData = (data || []).filter(p => p.id !== req.user.id);
            
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
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return res.status(500).json({ error: "Erro de configuração" });
        }

        if (!ownerId) {
            return res.status(400).json({ error: "ownerId é obrigatório para exclusão." });
        }

        validateOwnerAccess(req, ownerId);

        try {
            console.log("[Users API] Tentando excluir usuário:", userId, "solicitado por owner:", ownerId);
            
            // 1. Validar se o solicitante é o owner desse usuário
            const { data: userProfile, error: userError } = await supabaseAdmin
                .from('profiles')
                .select('owner_id')
                .eq('id', userId)
                .single();

            if (userError) {
                console.error("[Users API] Erro ao buscar perfil para exclusão:", userError);
                throw userError;
            }

            if (userProfile.owner_id !== ownerId) {
                console.error("[Users API] Tentativa de exclusão não autorizada. Owner do perfil:", userProfile.owner_id, "Solicitante:", ownerId);
                return res.status(403).json({ error: "Sem permissão para excluir este usuário." });
            }

            // 2. Excluir do Auth (isso deve disparar a exclusão do profile se houver trigger, senão excluímos manualmente)
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
            if (authError) {
                console.error("[Users API] Erro ao excluir do Auth:", authError);
                throw authError;
            }

            // 3. Garantir que o profile foi removido (caso não haja trigger)
            await supabaseAdmin.from('profiles').delete().eq('id', userId);

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
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return res.status(500).json({ error: "Erro de configuração" });
        }

        try {
            console.log("[Users API] Atualizando usuário:", userId, "solicitado por owner:", ownerId);
            
            // Verificação de segurança centralizada (IDOR Protection)
            validateOwnerAccess(req, ownerId);
            
            const permissionsObject = {
                ...permissions,
                "congregationIds": churchIds // Armazenamos o array completo no JSON de permissões
            };
            
            console.log("[Users API] permissionsObject final para salvamento:", JSON.stringify(permissionsObject, null, 2));
            
            // 1. Validar se o solicitante é o owner desse usuário
            const { data: userProfile, error: userError } = await supabaseAdmin
                .from('profiles')
                .select('owner_id')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            if (userProfile.owner_id !== ownerId) {
                return res.status(403).json({ error: "Sem permissão para editar este usuário." });
            }

            // 2. Atualizar no Auth se email ou senha forem fornecidos
            if (req.body.email || req.body.password) {
                console.log("[Users API] Atualizando dados no Auth...");
                const updateData = {};
                if (req.body.email) updateData.email = req.body.email;
                if (req.body.password) updateData.password = req.body.password;

                const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
                    userId,
                    updateData
                );

                if (authUpdateError) {
                    console.error("[Users API] Erro ao atualizar Auth:", authUpdateError);
                    throw authUpdateError;
                }
            }

            // 3. Atualizar o profile
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({
                    name: name,
                    email: req.body.email || undefined, // Atualiza o email no profile também se mudou
                    permissions: permissionsObject,
                    congregation: churchIds[0] || null // Apenas o primeiro ID (UUID)
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            console.log("[Users API] Usuário atualizado com sucesso!");
            res.json({ success: true });
        } catch (error) {
            console.error("[Users API] Erro ao atualizar usuário:", error);
            
            let statusCode = error.status || 500;
            let errorMessage = error.message || "Falha ao atualizar usuário.";

            // Reforço para erro de e-mail duplicado no catch
            if (error.code === 'email_exists' || 
                (error.message && error.message.toLowerCase().includes('already registered')) ||
                (error.message && error.message.toLowerCase().includes('already been registered'))) {
                statusCode = 409;
                errorMessage = "Este e-mail já está sendo usado por outro usuário.";
            }

            res.status(statusCode).json({ 
                error: errorMessage,
                details: error.details || error.hint || null,
                code: error.code || null
            });
        }
    });

    return router;
};
