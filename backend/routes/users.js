
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

export default () => {
    const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    let supabaseAdmin = null;
    if (supabaseKey) {
        try {
            supabaseAdmin = createClient(supabaseUrl, supabaseKey);
        } catch (e) {
            console.error("[Users API] Supabase Init Error:", e.message);
        }
    }

    router.post('/create', async (req, res) => {
        const { email, password, churchId, permissions, ownerId } = req.body;

        if (!supabaseAdmin) return res.status(500).json({ error: "Conexão com banco de dados não configurada." });
        if (!email || !password || !churchId || !ownerId) {
            return res.status(400).json({ error: "Dados incompletos para criação de usuário." });
        }

        try {
            // 1. Verificar se o solicitante é OWNER
            const { data: ownerProfile, error: ownerError } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', ownerId)
                .single();

            if (ownerError || !ownerProfile || ownerProfile.role !== 'owner') {
                return res.status(403).json({ error: "Apenas usuários titulares podem criar novos usuários." });
            }

            // 2. Criar usuário no Supabase Auth
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
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
            const { error: profileError } = await supabaseAdmin
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
                await supabaseAdmin.auth.admin.deleteUser(newUser.id);
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
