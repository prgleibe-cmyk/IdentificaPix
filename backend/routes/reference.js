
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

            console.log(`[Reference API] Buscando dados para owner ${effectiveOwnerId} (requisitado por ${req.user.id})`);

            // Buscar bancos
            const { data: banks, error: banksError } = await supabase
                .from('banks')
                .select('*')
                .eq('user_id', effectiveOwnerId);

            if (banksError) {
                console.error(`[Reference API] Erro ao buscar bancos:`, banksError.message);
            }

            // Buscar igrejas
            const { data: churches, error: churchesError } = await supabase
                .from('churches')
                .select('*')
                .eq('user_id', effectiveOwnerId);

            if (churchesError) {
                console.error(`[Reference API] Erro ao buscar igrejas:`, churchesError.message);
            }

            // Buscar relatórios salvos (Organização completa para alimentar a Aba Relatórios)
            // 1. Obter todos os IDs de usuários da organização (Dono + Membros)
            const { data: orgProfiles } = await supabase
                .from('profiles')
                .select('id')
                .or(`id.eq.${effectiveOwnerId},owner_id.eq.${effectiveOwnerId}`);
            
            const orgUserIds = orgProfiles?.map(p => p.id) || [effectiveOwnerId];
            console.log(`[Reference API] Organização de ${effectiveOwnerId} possui ${orgUserIds.length} usuários: ${orgUserIds.join(', ')}`);

            // 2. Buscar relatórios salvos de toda a organização
            const { data: reports, error: reportsError } = await supabase
                .from('saved_reports')
                .select('id, name, created_at, record_count, user_id, data')
                .in('user_id', orgUserIds)
                .order('created_at', { ascending: false });

            if (reportsError) {
                console.error(`[Reference API] Erro ao buscar relatórios para organização de ${effectiveOwnerId}:`, reportsError.message);
            }

            console.log(`[Reference API] Retornando ${banks?.length || 0} bancos, ${churches?.length || 0} igrejas e ${reports?.length || 0} relatórios para a organização.`);

            res.json({ 
                banks: banks || [], 
                churches: churches || [],
                reports: reports || []
            });
        } catch (error) {
            console.error("[Reference API] Erro:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/report/:reportId', async (req, res) => {
        const { reportId } = req.params;
        const { ownerId } = req.query;
        const supabase = getSupabaseAdmin();

        if (!supabase) {
            return res.status(500).json({ error: "Erro de configuração." });
        }

        try {
            // Validação IDOR
            const { data: profile } = await supabase
                .from('profiles')
                .select('owner_id')
                .eq('id', req.user.id)
                .single();

            const effectiveOwnerId = profile?.owner_id || req.user.id;

            if (effectiveOwnerId !== ownerId) {
                return res.status(403).json({ error: "Acesso negado." });
            }

            // 1. Obter todos os IDs de usuários da organização
            const { data: orgProfiles } = await supabase
                .from('profiles')
                .select('id')
                .or(`id.eq.${effectiveOwnerId},owner_id.eq.${effectiveOwnerId}`);
            
            const orgUserIds = orgProfiles?.map(p => p.id) || [effectiveOwnerId];

            const { data, error } = await supabase
                .from('saved_reports')
                .select('data, name')
                .eq('id', reportId)
                .in('user_id', orgUserIds)
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            console.error("[Reference API] Erro ao buscar relatório:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
