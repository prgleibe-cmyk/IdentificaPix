
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

export default () => {
    const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
    const hardcodedAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
    
    // Função para obter o cliente Supabase atualizado com as chaves do ambiente
    const getSupabaseAdmin = () => {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || hardcodedAnon;
        const key = serviceRoleKey || anonKey;

        if (!key) return null;

        try {
            return {
                client: createClient(supabaseUrl, key, {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                }),
                isServiceRole: !!serviceRoleKey
            };
        } catch (e) {
            console.error("[Users API] Supabase Init Error:", e.message);
            return null;
        }
    };

    // Rota de diagnóstico para verificar as chaves (sem mostrá-las inteiras)
    router.get('/debug-env', (req, res) => {
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        const ak = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        
        res.json({
            hasServiceRoleKey: !!srk,
            serviceRoleKeyLength: srk ? srk.length : 0,
            serviceRoleKeyStart: srk ? `${srk.substring(0, 5)}...` : 'N/A',
            hasAnonKey: !!ak,
            anonKeyStart: ak ? `${ak.substring(0, 5)}...` : 'N/A',
            nodeEnv: process.env.NODE_ENV || 'development'
        });
    });

    router.post('/create', async (req, res) => {
        const { email, password, churchId, permissions, ownerId } = req.body;
        const supabase = getSupabaseAdmin();

        if (!supabase || !supabase.client) {
            return res.status(500).json({ error: "Erro de configuração: Cliente Supabase não pôde ser inicializado." });
        }

        if (!supabase.isServiceRole) {
            return res.status(500).json({ 
                error: "A chave 'SUPABASE_SERVICE_ROLE_KEY' não foi encontrada no ambiente. Esta chave é obrigatória para criar usuários via API. Verifique se ela está configurada corretamente no seu servidor de hospedagem." 
            });
        }
        if (!email || !password || !churchId || !ownerId) {
            return res.status(400).json({ error: "Dados incompletos para criação de usuário." });
        }

        try {
            // 1. Verificar se o solicitante é OWNER
            const { data: ownerProfile, error: ownerError } = await supabase.client
                .from('profiles')
                .select('role')
                .eq('id', ownerId)
                .single();

            if (ownerError || !ownerProfile || ownerProfile.role !== 'owner') {
                return res.status(403).json({ error: "Apenas usuários titulares podem criar novos usuários." });
            }

            // 2. Criar usuário no Supabase Auth
            const { data: authData, error: authError } = await supabase.client.auth.admin.createUser({
                email,
                password,
                email_confirm: true // Confirmar automaticamente para usuários secundários
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    return res.status(400).json({ error: "Este e-mail já está cadastrado no sistema." });
                }
                throw authError;
            }

            const newUser = authData.user;

            // 3. Criar registro na tabela profiles
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
                // Se falhar ao criar o perfil, tentamos remover o usuário do auth para manter consistência
                await supabase.client.auth.admin.deleteUser(newUser.id);
                throw profileError;
            }

            res.json({ success: true, message: "Usuário criado com sucesso", userId: newUser.id });

        } catch (error) {
            console.error("[Users API] Erro na criação de usuário:", error.message);
            res.status(500).json({ error: "Falha ao criar usuário secundário. Verifique os dados e tente novamente." });
        }
    });

    return router;
};
