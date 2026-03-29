
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

export default () => {
    const supabaseUrl = process.env.SUPABASE_URL || 
                        process.env.VITE_SUPABASE_URL || 
                        'https://uflheoknbopcgmzyjbft.supabase.co';
    
    const getSupabaseAdmin = () => {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.SERVICE_ROLE_KEY ||
                               process.env.SUPABASE_SERVICE_KEY;
                               
        if (!serviceRoleKey) {
            console.error("[Reference API] Service Role Key não encontrada no ambiente.");
            return null;
        }

        try {
            console.log(`[Reference API] Inicializando cliente Supabase para URL: ${supabaseUrl}`);
            return createClient(supabaseUrl, serviceRoleKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });
        } catch (e) {
            console.error("[Reference API] Erro ao criar cliente Supabase:", e.message);
            return null;
        }
    };

    router.get('/data/:ownerId', async (req, res) => {
        const { ownerId } = req.params;
        console.log(`[Reference API] Request recebido para ownerId: ${ownerId} por usuário: ${req.user?.id}`);
        
        const supabase = getSupabaseAdmin();

        if (!supabase) {
            console.error("[Reference API] Falha ao inicializar Supabase Admin.");
            return res.status(500).json({ error: "Erro de configuração: Service Role não encontrada." });
        }

        try {
            console.log(`[Reference API] Iniciando busca de dados para ownerId: ${ownerId}`);
            
            // Validação: O usuário logado deve ser o ownerId ou ter owner_id igual ao ownerId
            // Tenta buscar em user_profiles primeiro, depois em profiles como fallback
            let profile = null;
            try {
                console.log(`[Reference API] Buscando perfil do usuário ${req.user.id} em user_profiles...`);
                let { data: upProfile, error: upError } = await supabase
                    .from('user_profiles')
                    .select('owner_id, role')
                    .eq('id', req.user.id)
                    .maybeSingle();

                if (upError) {
                    console.error(`[Reference API] Erro ao buscar em user_profiles para ${req.user.id}:`, upError.message);
                }

                if (upProfile) {
                    console.log(`[Reference API] Perfil encontrado em user_profiles.`);
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
                    if (pProfile) {
                        console.log(`[Reference API] Perfil encontrado em profiles.`);
                        profile = pProfile;
                    } else {
                        console.log(`[Reference API] Perfil não encontrado em nenhuma tabela.`);
                    }
                }
            } catch (profileCatch) {
                console.error(`[Reference API] Exceção ao buscar perfil:`, profileCatch);
            }

            // Se ainda não encontrou, assume que é o dono (owner)
            const effectiveOwnerId = profile?.owner_id || req.user.id;
            const userRole = profile?.role || 'owner';

            console.log(`[Reference API] Contexto: effectiveOwnerId=${effectiveOwnerId}, requesterId=${req.user.id}, role=${userRole}`);

            // Buscar bancos
            let banks = [];
            try {
                console.log(`[Reference API] Buscando bancos para ${effectiveOwnerId}...`);
                const { data: bData, error: banksError } = await supabase
                    .from('banks')
                    .select('*')
                    .eq('user_id', effectiveOwnerId);

                if (banksError) {
                    console.error(`[Reference API] Erro ao buscar bancos:`, banksError.message);
                } else {
                    banks = bData || [];
                }
            } catch (bCatch) {
                console.error(`[Reference API] Exceção ao buscar bancos:`, bCatch);
            }

            // Buscar igrejas
            let churches = [];
            try {
                console.log(`[Reference API] Buscando igrejas para ${effectiveOwnerId}...`);
                const { data: cData, error: churchesError } = await supabase
                    .from('churches')
                    .select('*')
                    .eq('user_id', effectiveOwnerId);

                if (churchesError) {
                    console.error(`[Reference API] Erro ao buscar igrejas:`, churchesError.message);
                } else {
                    churches = cData || [];
                }
            } catch (cCatch) {
                console.error(`[Reference API] Exceção ao buscar igrejas:`, cCatch);
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
            console.log(`[Reference API] Organização possui ${finalUserIds.length} IDs válidos: ${finalUserIds.join(', ')}`);

            // 2. Buscar relatórios salvos de toda a organização
            // OTIMIZAÇÃO: Não buscamos a coluna 'data' aqui pois ela é muito grande e causa 500/Timeout
            // O frontend buscará os dados completos individualmente ao abrir o relatório
            let reports = [];
            if (finalUserIds.length > 0) {
                try {
                    console.log(`[Reference API] Buscando lista de relatórios para ${finalUserIds.length} usuários...`);
                    const { data: rData, error: reportsError } = await supabase
                        .from('saved_reports')
                        .select('id, name, created_at, record_count, user_id')
                        .in('user_id', finalUserIds)
                        .order('created_at', { ascending: false });

                    if (reportsError) {
                        console.error(`[Reference API] Erro Supabase ao buscar relatórios:`, reportsError.message);
                        // Não lançamos erro aqui para não quebrar a resposta inteira se apenas relatórios falharem
                    } else {
                        reports = rData || [];
                    }
                } catch (rCatch) {
                    console.error(`[Reference API] Exceção ao buscar relatórios:`, rCatch);
                }
            }

            console.log(`[Reference API] Sucesso! Retornando ${banks.length} bancos, ${churches.length} igrejas e ${reports.length} relatórios.`);

            res.json({ 
                banks, 
                churches,
                reports: reports || []
            });
        } catch (error) {
            console.error("[Reference API] Erro Fatal no try-catch externo:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
            
            res.status(500).json({ 
                error: errorMessage || "Erro interno no servidor ao processar dados de referência.",
                details: errorMessage,
                stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
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
                .select('data, name, user_id')
                .eq('id', reportId)
                .in('user_id', finalUserIds)
                .single();

            if (error) throw error;
            
            console.log(`[Reference API] Relatório ${reportId} encontrado. UserID: ${data.user_id}, Name: ${data.name}`);
            res.json(data);
        } catch (error) {
            console.error("[Reference API] Erro ao buscar relatório:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
