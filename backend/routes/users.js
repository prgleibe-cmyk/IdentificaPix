
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

export default () => {
    const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
    const hardcodedAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
    
    // Função para obter o cliente Supabase atualizado com as chaves do ambiente
    const getSupabaseAdmin = () => {
        // Tenta várias nomenclaturas comuns
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.SERVICE_ROLE_KEY ||
                               process.env.SUPABASE_SERVICE_KEY;
                               
        const anonKey = process.env.SUPABASE_ANON_KEY || 
                        process.env.VITE_SUPABASE_ANON_KEY || 
                        process.env.ANON_KEY ||
                        hardcodedAnon;
                        
        const key = serviceRoleKey || anonKey;

        if (!key) {
            console.error("[Users API] Nenhuma chave Supabase encontrada no ambiente.");
            return null;
        }

        try {
            return {
                client: createClient(supabaseUrl, key, {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                }),
                isServiceRole: !!serviceRoleKey,
                keyUsed: serviceRoleKey ? 'SERVICE_ROLE' : 'ANON'
            };
        } catch (e) {
            console.error("[Users API] Supabase Init Error:", e.message);
            return null;
        }
    };

    // Rota de diagnóstico para verificar as chaves (sem mostrá-las inteiras)
    router.get('/debug-env', (req, res) => {
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
        const supabase = getSupabaseAdmin();

        if (!supabase || !supabase.client) {
            console.error("[Users API] Falha ao inicializar Supabase");
            return res.status(500).json({ error: "Erro de configuração: Cliente Supabase não pôde ser inicializado. Verifique as variáveis de ambiente." });
        }

        // Removemos o bloqueio fatal para ver o erro real do Supabase se a chave for insuficiente
        if (!supabase.isServiceRole) {
            console.warn("[Users API] Aviso: Chave de serviço (Service Role) não detectada. Tentando com chave disponível...");
        }
        
        if (!email || !password || !churchIds || !ownerId) {
            console.error("[Users API] Dados incompletos:", { email, hasPassword: !!password, churchIds, ownerId });
            return res.status(400).json({ error: "Dados incompletos para criação de usuário." });
        }

        // Validação IDOR: Garantir que o usuário autenticado é o dono solicitado ou um admin do mesmo dono
        const { data: requesterProfile, error: requesterError } = await supabase.client
            .from('profiles')
            .select('owner_id, role')
            .eq('id', req.user.id)
            .single();

        if (requesterError) {
            console.error("[Users API] Erro ao buscar perfil do solicitante:", requesterError);
            return res.status(500).json({ error: "Erro ao validar permissões." });
        }

        const requesterEffectiveOwnerId = requesterProfile.owner_id || req.user.id;

        if (req.user.id !== ownerId && requesterEffectiveOwnerId !== ownerId) {
            console.error("[Users API] Tentativa de criação não autorizada. Autenticado:", req.user.id, "Solicitado:", ownerId);
            return res.status(403).json({ error: "Acesso negado: Você não tem permissão para criar usuários nesta conta." });
        }

        const permissionsObject = {
            "confirmar_final": permissions.confirmar_final,
            "identificar": permissions.identificar,
            "desfazer_identificacao": permissions.desfazer_identificacao,
            "baixar_arquivo": permissions.baixar_arquivo,
            "imprimir": permissions.imprimir,
            "congregationIds": churchIds // Armazenamos o array completo no JSON de permissões
        };

        try {
            // 1. Verificar se o solicitante é OWNER
            console.log("[Users API] Verificando permissão do owner:", ownerId);
            const { data: ownerProfile, error: ownerError } = await supabase.client
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
            const { data: authData, error: authError } = await supabase.client.auth.admin.createUser({
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
            const { error: profileError } = await supabase.client
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
                await supabase.client.auth.admin.deleteUser(newUser.id);
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
        const supabase = getSupabaseAdmin();

        // Validação IDOR: Garantir que o usuário autenticado é o dono solicitado
        if (req.user.id !== ownerId) {
            return res.status(403).json({ error: "Acesso negado: Você só pode listar seus próprios usuários." });
        }

        if (!supabase || !supabase.client) {
            return res.status(500).json({ error: "Erro de configuração" });
        }

        try {
            const { ownerId } = req.params;
            
            // Validação IDOR: O usuário só pode listar usuários se for o owner ou se for um subordinado do mesmo owner
            // Primeiro buscamos o perfil do usuário logado para verificar seu owner_id
            const { data: currentUserProfile, error: authProfileError } = await supabase.client
                .from('profiles')
                .select('owner_id, role')
                .eq('id', req.user.id)
                .single();

            if (authProfileError) throw authProfileError;

            const userEffectiveOwnerId = currentUserProfile.owner_id || req.user.id;
            
            // Se o usuário logado não for o owner solicitado E o owner do usuário logado também não for o owner solicitado
            if (req.user.id !== ownerId && userEffectiveOwnerId !== ownerId) {
                return res.status(403).json({ error: "Acesso negado. Você não tem permissão para listar estes usuários." });
            }

            console.log("[Users API] Listando usuários para owner:", ownerId);
            
            // Buscamos todos os perfis onde o owner_id é o solicitado
            const { data, error, count } = await supabase.client
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
            res.status(500).json({ error: error.message });
        }
    });

    // Excluir usuário
    router.delete('/delete/:userId', async (req, res) => {
        const { userId } = req.params;
        const { ownerId } = req.query;
        const supabase = getSupabaseAdmin();

        if (!supabase || !supabase.client) {
            return res.status(500).json({ error: "Erro de configuração" });
        }

        if (!ownerId) {
            return res.status(400).json({ error: "ownerId é obrigatório para exclusão." });
        }

        // Validação IDOR: Garantir que o usuário autenticado é o dono solicitado ou um admin do mesmo dono
        const { data: requesterProfile, error: requesterError } = await supabase.client
            .from('profiles')
            .select('owner_id, role')
            .eq('id', req.user.id)
            .single();

        if (requesterError) {
            console.error("[Users API] Erro ao buscar perfil do solicitante:", requesterError);
            return res.status(500).json({ error: "Erro ao validar permissões." });
        }

        const requesterEffectiveOwnerId = requesterProfile.owner_id || req.user.id;

        if (req.user.id !== ownerId && requesterEffectiveOwnerId !== ownerId) {
            return res.status(403).json({ error: "Acesso negado: Você não tem permissão para excluir usuários desta conta." });
        }

        try {
            console.log("[Users API] Tentando excluir usuário:", userId, "solicitado por owner:", ownerId);
            
            // 1. Validar se o solicitante é o owner desse usuário
            const { data: userProfile, error: userError } = await supabase.client
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
            const { error: authError } = await supabase.client.auth.admin.deleteUser(userId);
            if (authError) {
                console.error("[Users API] Erro ao excluir do Auth:", authError);
                throw authError;
            }

            // 3. Garantir que o profile foi removido (caso não haja trigger)
            await supabase.client.from('profiles').delete().eq('id', userId);

            console.log("[Users API] Usuário excluído com sucesso!");
            res.json({ success: true });
        } catch (error) {
            console.error("[Users API] Erro fatal ao excluir usuário:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Atualizar usuário
    router.post('/update/:userId', async (req, res) => {
        const { userId } = req.params;
        const { name, churchIds, permissions, ownerId } = req.body;
        const supabase = getSupabaseAdmin();

        if (!supabase || !supabase.client) {
            return res.status(500).json({ error: "Erro de configuração" });
        }

        try {
            console.log("[Users API] Atualizando usuário:", userId, "solicitado por owner:", ownerId);
            
            // Validação IDOR: Garantir que o usuário autenticado é o dono solicitado ou um admin do mesmo dono
            const { data: requesterProfile, error: requesterError } = await supabase.client
                .from('profiles')
                .select('owner_id, role')
                .eq('id', req.user.id)
                .single();

            if (requesterError) {
                console.error("[Users API] Erro ao buscar perfil do solicitante:", requesterError);
                return res.status(500).json({ error: "Erro ao validar permissões." });
            }

            const requesterEffectiveOwnerId = requesterProfile.owner_id || req.user.id;

            if (req.user.id !== ownerId && requesterEffectiveOwnerId !== ownerId) {
                return res.status(403).json({ error: "Acesso negado: Você não tem permissão para editar usuários desta conta." });
            }
            
            const permissionsObject = {
                ...permissions,
                "congregationIds": churchIds // Armazenamos o array completo no JSON de permissões
            };
            
            // 1. Validar se o solicitante é o owner desse usuário
            const { data: userProfile, error: userError } = await supabase.client
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

                const { error: authUpdateError } = await supabase.client.auth.admin.updateUserById(
                    userId,
                    updateData
                );

                if (authUpdateError) {
                    console.error("[Users API] Erro ao atualizar Auth:", authUpdateError);
                    throw authUpdateError;
                }
            }

            // 3. Atualizar o profile
            const { error: updateError } = await supabase.client
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
