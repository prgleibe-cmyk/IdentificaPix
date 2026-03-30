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
        const ownerId = req.params.ownerId?.trim();
        const supabase = getSupabaseAdmin();

        if (!supabase) {
            return res.status(500).json({ error: "Erro de configuração: Service Role não encontrada." });
        }

        try {
            console.log(`[Reference API] [1] Iniciando busca. OwnerId: ${ownerId}, ReqUser: ${req.user.id}`);
            
            const { data: sampleData, count: totalCount, error: countError } = await supabase
                .from('saved_reports')
                .select('id, user_id, church_id, name', { count: 'exact' })
                .limit(5);
            
            console.log(`[Reference API] [2] Debug Tabela: Total=${totalCount}, Erro=${countError?.message || 'Nenhum'}`);
            if (sampleData && sampleData.length > 0) {
                console.log(`[Reference API] [3] Amostra IDs:`, sampleData.map(s => s.user_id));
            }

            console.log(`[Reference API] [4] Buscando perfil...`);
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('owner_id, role, congregation, permissions')
                .eq('id', req.user.id)
                .single();
            
            if (profileError) {
                console.error(`[Reference API] [!] Erro Perfil:`, profileError.message);
                return res.status(500).json({ error: 'Erro ao validar permissões.' });
            }

            console.log(`[Reference API] [5] Perfil carregado: role=${profile?.role}, owner_id=${profile?.owner_id}`);

            const effectiveOwnerId = profile?.owner_id || req.user.id;

            if (effectiveOwnerId !== ownerId) {
                console.warn(`[Reference API] [!] Acesso negado: owner_id ${effectiveOwnerId} != ${ownerId}`);
                return res.status(403).json({ error: "Acesso negado." });
            }

            const { data: banks } = await supabase
                .from('banks')
                .select('*')
                .eq('user_id', ownerId);

            const { data: churches } = await supabase
                .from('churches')
                .select('*')
                .eq('user_id', ownerId);

            let reports = [];
            
            try {
                const isActualOwner = req.user.id === ownerId;
                console.log(`[Reference API] [6] isActualOwner: ${isActualOwner}`);

                if (isActualOwner) {
                    console.log(`[Reference API] [7a] Buscando como Owner...`);
                    const { data: ownerReports } = await supabase
                        .from('saved_reports')
                        .select('id, user_id, church_id, name, created_at, record_count, data') // ✅ CORREÇÃO AQUI
                        .eq('user_id', ownerId)
                        .order('created_at', { ascending: false });

                    reports = ownerReports || [];
                } else {
                    console.log(`[Reference API] [7b] Buscando como Membro...`);
                    
                    let allowedChurchIds = [];
                    try {
                        const perms = typeof profile?.permissions === 'string' ? JSON.parse(profile.permissions) : (profile?.permissions || {});
                        if (Array.isArray(perms.congregationIds)) {
                            allowedChurchIds = perms.congregationIds.map(id => String(id));
                        } else if (profile?.congregation) {
                            allowedChurchIds = [String(profile.congregation)];
                        }
                    } catch (e) {}

                    let query = supabase
                        .from('saved_reports')
                        .select('id, user_id, church_id, name, created_at, record_count, data') // ✅ CORREÇÃO AQUI
                        .eq('user_id', ownerId)
                        .order('created_at', { ascending: false });

                    if (allowedChurchIds.length > 0) {
                        const filterStr = `church_id.in.(${allowedChurchIds.join(',')}),church_id.is.null,name.eq.[SESSÃO_ATIVA]`;
                        query = query.or(filterStr);
                    } else {
                        query = query.or(`church_id.is.null,name.eq.[SESSÃO_ATIVA]`);
                    }

                    const { data: filteredReports } = await query;
                    reports = filteredReports || [];
                }
            } catch (reportsErr) {
                console.error("[Reference API] [!] Erro Crítico Reports:", reportsErr);
            }

            console.log(`[Reference API] [12] Finalizado: ${banks?.length || 0} bancos, ${churches?.length || 0} igrejas e ${reports.length} relatórios.`);

            res.json({ 
                banks: banks || [], 
                churches: churches || [],
                reports: reports
            });
        } catch (error) {
            console.error("[Reference API] Erro:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};