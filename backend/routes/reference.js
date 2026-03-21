
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

export default () => {
    const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
    
    const getSupabaseAdmin = () => {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.SERVICE_ROLE_KEY ||
                               process.env.SUPABASE_SERVICE_KEY;
                               
        if (!serviceRoleKey) return null;

        return createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    };

    router.get('/data/:ownerId', async (req, res) => {
        const { ownerId } = req.params;
        const supabase = getSupabaseAdmin();

        if (!supabase) {
            return res.status(500).json({ error: "Erro de configuração: Service Role não encontrada." });
        }

        try {
            // Validação: O usuário logado deve ser o ownerId ou ter owner_id igual ao ownerId
            const { data: profile } = await supabase
                .from('profiles')
                .select('owner_id')
                .eq('id', req.user.id)
                .single();

            const effectiveOwnerId = profile?.owner_id || req.user.id;

            if (effectiveOwnerId !== ownerId) {
                return res.status(403).json({ error: "Acesso negado." });
            }

            // Buscar bancos
            const { data: banks } = await supabase
                .from('banks')
                .select('*')
                .eq('user_id', ownerId);

            // Buscar igrejas
            const { data: churches } = await supabase
                .from('churches')
                .select('*')
                .eq('user_id', ownerId);

            res.json({ banks: banks || [], churches: churches || [] });
        } catch (error) {
            console.error("[Reference API] Erro:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
