
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
            console.log(`[Reference API] Iniciando busca de dados para ownerId: ${ownerId}`);
            
            // Validação: O usuário logado deve ser o ownerId ou ter owner_id igual ao ownerId
            // Tenta buscar em user_profiles primeiro, depois em profiles como fallback
            let profile = null;
            let { data: upProfile, error: upError } = await supabase
                .from('user_profiles')
                .select('owner_id, role')
                .eq('id', req.user.id)
                .maybeSingle();

            if (upError) {
                console.error(`[Reference API] Erro ao buscar em user_profiles para ${req.user.id}:`, upError.message);
            }

            if (upProfile) {
                profile = upProfile;
            } else {
                console.log(`[Reference API] Perfil não encontrado em user_profiles para ${req.user.id}, tentando fallback em profiles...`);
                // Fallback para profiles
                const { data: pProfile, error: pError } = await supabase
                    .from('profiles')
                    .select('owner_id, role')
                    .eq('id', req.user.id)
                    .maybeSingle();
                
                if (pError) {
                    console.error(`[Reference API] Erro ao buscar em profiles para ${req.user.id}:`, pError.message);
                }
                profile = pProfile;
            }

            // Se ainda não encontrou, assume que é o dono (owner)
            const effectiveOwnerId = profile?.owner_id || req.user.id;
            const userRole = profile?.role || 'owner';

            console.log(`[Reference API] Contexto: effectiveOwnerId=${effectiveOwnerId}, requesterId=${req.user.id}, role=${userRole}`);

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
            console.log(`[Reference API] Buscando membros da organização para effectiveOwnerId: ${effectiveOwnerId}`);
            
            const orgUserIds = new Set([effectiveOwnerId]);
            
            try {
                const [upRes, pRes] = await Promise.all([
                    supabase.from('user_profiles').select('id').eq('owner_id', effectiveOwnerId),
                    supabase.from('profiles').select('id').eq('owner_id', effectiveOwnerId)
                ]);
                
                if (upRes.error) console.error(`[Reference API] Erro ao buscar membros em user_profiles:`, upRes.error.message);
                if (pRes.error) console.error(`[Reference API] Erro ao buscar membros em profiles:`, pRes.error.message);

                upRes.data?.forEach(p => { if (p.id) orgUserIds.add(p.id); });
                pRes.data?.forEach(p => { if (p.id) orgUserIds.add(p.id); });
            } catch (memberError) {
                console.error(`[Reference API] Erro ao processar membros da organização:`, memberError);
            }
            
            const finalUserIds = Array.from(orgUserIds).filter(id => id && typeof id === 'string');
            console.log(`[Reference API] Organização possui ${finalUserIds.length} IDs válidos.`);

            // 2. Buscar relatórios salvos de toda a organização
            // OTIMIZAÇÃO: Não buscamos a coluna 'data' aqui pois ela é muito grande e causa 500/Timeout
            // O frontend buscará os dados completos individualmente ao abrir o relatório
            console.log(`[Reference API] Buscando lista de relatórios para ${finalUserIds.length} usuários...`);
            const { data: reports, error: reportsError } = await supabase
                .from('saved_reports')
                .select('id, name, created_at, record_count, user_id')
                .in('user_id', finalUserIds)
                .order('created_at', { ascending: false });

            if (reportsError) {
                console.error(`[Reference API] Erro Supabase ao buscar relatórios:`, JSON.stringify(reportsError, null, 2));
                throw reportsError;
            }

            console.log(`[Reference API] Sucesso! Retornando ${banks?.length || 0} bancos, ${churches?.length || 0} igrejas e ${reports?.length || 0} relatórios.`);

            res.json({ 
                banks: banks || [], 
                churches: churches || [],
                reports: reports || []
            });
        } catch (error) {
            console.error("[Reference API] Erro Fatal:", error);
            res.status(500).json({ 
                error: error.message || "Erro interno no servidor ao processar dados de referência.",
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
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
            let profile = null;
            const { data: upProfile } = await supabase
                .from('user_profiles')
                .select('owner_id')
                .eq('id', req.user.id)
                .maybeSingle();
            
            if (upProfile) {
                profile = upProfile;
            } else {
                const { data: pProfile } = await supabase
                    .from('profiles')
                    .select('owner_id')
                    .eq('id', req.user.id)
                    .maybeSingle();
                profile = pProfile;
            }

            const effectiveOwnerId = profile?.owner_id || req.user.id;

            if (effectiveOwnerId !== ownerId) {
                return res.status(403).json({ error: "Acesso negado." });
            }

            // 1. Obter todos os IDs de usuários da organização
            const orgUserIds = new Set([effectiveOwnerId]);
            try {
                const [upRes, pRes] = await Promise.all([
                    supabase.from('user_profiles').select('id').eq('owner_id', effectiveOwnerId),
                    supabase.from('profiles').select('id').eq('owner_id', effectiveOwnerId)
                ]);
                upRes.data?.forEach(p => { if (p.id) orgUserIds.add(p.id); });
                pRes.data?.forEach(p => { if (p.id) orgUserIds.add(p.id); });
            } catch (e) {
                console.error("[Reference API] Erro ao buscar membros para relatório individual:", e);
            }
            
            const finalUserIds = Array.from(orgUserIds).filter(id => id && typeof id === 'string');

            const { data, error } = await supabase
                .from('saved_reports')
                .select('data, name')
                .eq('id', reportId)
                .in('user_id', finalUserIds)
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
