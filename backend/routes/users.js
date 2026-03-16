
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
        const { email, password, churchId, permissions, ownerId } = req.body;
        const supabase = getSupabaseAdmin();

        if (!supabase || !supabase.client) {
            console.error("[Users API] Falha ao inicializar Supabase");
            return res.status(500).json({ error: "Erro de configuração: Cliente Supabase não pôde ser inicializado. Verifique as variáveis de ambiente." });
        }

        // Removemos o bloqueio fatal para ver o erro real do Supabase se a chave for insuficiente
        if (!supabase.isServiceRole) {
            console.warn("[Users API] Aviso: Chave de serviço (Service Role) não detectada. Tentando com chave disponível...");
        }
        
        if (!email || !password || !churchId || !ownerId) {
            console.error("[Users API] Dados incompletos:", { email, hasPassword: !!password, churchId, ownerId });
            return res.status(400).json({ error: "Dados incompletos para criação de usuário." });
        }

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
                if (authError.message.includes('already registered')) {
                    return res.status(400).json({ error: "Este e-mail já está cadastrado no sistema." });
                }
                throw authError;
            }

            const newUser = authData.user;
            console.log("[Users API] Usuário criado no Auth com ID:", newUser.id);

            // 3. Criar registro na tabela profiles
            console.log("[Users API] Criando perfil na tabela profiles...");
            const { error: profileError } = await supabase.client
                .from('profiles')
                .insert({
                    id: newUser.id,
                    email: email,
                    name: req.body.name, // Nome completo do formulário
                    owner_id: ownerId,
                    role: 'member',
                    permissions: permissions,
                    congregation: churchId // Usando o ID da congregação
                });

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
            res.status(500).json({ 
                error: error.message || "Falha ao criar usuário secundário.",
                details: error.details || error.hint || null,
                code: error.code || null
            });
        }
    });

    return router;
};
