
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
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('owner_id, role')
                .eq('id', req.user.id)
                .single();

            if (profileError) {
                console.error(`[Reference API] Erro ao buscar perfil do usuário ${req.user.id}:`, profileError.message);
                return res.status(500).json({ error: 'Erro ao validar permissões.' });
            }

            const effectiveOwnerId = profile?.owner_id || req.user.id;

            if (effectiveOwnerId !== ownerId) {
                console.warn(`[Reference API] Acesso negado: Usuário ${req.user.id} tentou acessar dados do owner ${ownerId}, mas seu owner_id é ${effectiveOwnerId}`);
                return res.status(403).json({ error: "Acesso negado." });
            }

            console.log(`[Reference API] Buscando dados de referência para owner ${ownerId} (requisitado por ${req.user.id}, role: ${profile?.role})`);

            // Buscar bancos
            const { data: banks, error: banksError } = await supabase
                .from('banks')
                .select('*')
                .eq('user_id', ownerId);
            
            if (banksError) {
                console.error(`[Reference API] Erro ao buscar bancos para owner ${ownerId}:`, banksError.message);
            }

            // Buscar igrejas
            const { data: churches, error: churchesError } = await supabase
                .from('churches')
                .select('*')
                .eq('user_id', ownerId);

            if (churchesError) {
                console.error(`[Reference API] Erro ao buscar igrejas para owner ${ownerId}:`, churchesError.message);
            }

            console.log(`[Reference API] Retornando ${banks?.length || 0} bancos e ${churches?.length || 0} igrejas.`);

            res.json({ banks: banks || [], churches: churches || [] });
        } catch (error) {
            console.error("[Reference API] Erro:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/reports/:ownerId', async (req, res) => {
        const { ownerId } = req.params;
        const supabase = getSupabaseAdmin();

        if (!supabase) {
            return res.status(500).json({ error: "Erro de configuração: Service Role não encontrada." });
        }

        try {
            // Validação: O usuário logado deve ser o ownerId ou ter owner_id igual ao ownerId
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('owner_id, role')
                .eq('id', req.user.id)
                .single();

            if (profileError) return res.status(500).json({ error: 'Erro ao validar permissões.' });

            const effectiveOwnerId = profile?.owner_id || req.user.id;
            if (effectiveOwnerId !== ownerId) return res.status(403).json({ error: "Acesso negado." });

            const { data: reports, error: reportsError } = await supabase
                .from('saved_reports')
                .select('*')
                .eq('user_id', ownerId)
                .order('created_at', { ascending: false });

            if (reportsError) throw reportsError;

            res.json(reports || []);
        } catch (error) {
            console.error("[Reports API] Erro:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
