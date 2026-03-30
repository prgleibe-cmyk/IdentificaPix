
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
            
            // Debug: Contagem total na tabela para verificar conectividade e RLS bypass
            const { data: sampleData, count: totalCount, error: countError } = await supabase
                .from('saved_reports')
                .select('id, user_id, church_id, name', { count: 'exact' })
                .limit(5);
            
            console.log(`[Reference API] [2] Debug Tabela: Total=${totalCount}, Erro=${countError?.message || 'Nenhum'}`);
            if (sampleData && sampleData.length > 0) {
                console.log(`[Reference API] [3] Amostra IDs:`, sampleData.map(s => s.user_id));
            }

            console.log(`[Reference API] [4] Buscando perfil...`);
            // Validação: O usuário logado deve ser o ownerId ou ter owner_id igual ao ownerId
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

            // Buscar bancos
            const { data: banks, error: banksError } = await supabase
                .from('banks')
                .select('*')
                .eq('user_id', ownerId);
            
            if (banksError) console.error(`[Reference API] [!] Erro Banks:`, banksError.message);

            // Buscar igrejas
            const { data: churches, error: churchesError } = await supabase
                .from('churches')
                .select('*')
                .eq('user_id', ownerId);

            if (churchesError) console.error(`[Reference API] [!] Erro Churches:`, churchesError.message);

            // --- BUSCA DE RELATÓRIOS (Lógica Robusta e Segura) ---
            let reports = [];
            
            try {
                const isActualOwner = req.user.id === ownerId;
                console.log(`[Reference API] [6] isActualOwner: ${isActualOwner}`);

                if (isActualOwner) {
                    console.log(`[Reference API] [7a] Buscando como Owner...`);
                    const { data: ownerReports, error: ownerReportsError } = await (supabase.from('saved_reports') as any)
                        .select('id, user_id, church_id, name, created_at, record_count')
                        .eq('user_id', ownerId)
                        .order('created_at', { ascending: false });
                    
                    if (ownerReportsError) console.error(`[Reference API] [!] Erro OwnerReports:`, ownerReportsError.message);
                    reports = ownerReports || [];
                    console.log(`[Reference API] [8] Bruto (Owner): ${reports.length}`);
                } else {
                    console.log(`[Reference API] [7b] Buscando como Membro...`);
                    const { data: ownerReports, error: ownerReportsError } = await (supabase.from('saved_reports') as any)
                        .select('id, user_id, church_id, name, created_at, record_count')
                        .eq('user_id', ownerId)
                        .order('created_at', { ascending: false });
                    
                    const { data: memberReports, error: memberReportsError } = await (supabase.from('saved_reports') as any)
                        .select('id, user_id, church_id, name, created_at, record_count')
                        .eq('user_id', req.user.id)
                        .order('created_at', { ascending: false });
                    
                    if (ownerReportsError) console.error(`[Reference API] [!] Erro OwnerReports:`, ownerReportsError.message);
                    if (memberReportsError) console.error(`[Reference API] [!] Erro MemberReports:`, memberReportsError.message);
                    
                    const rawReports = [...(ownerReports || []), ...(memberReports || [])];
                    
                    // Une os resultados sem duplicatas
                    const uniqueReports = [];
                    const seenIds = new Set();
                    for (const r of rawReports) {
                        if (!seenIds.has(r.id)) {
                            seenIds.add(r.id);
                            uniqueReports.push(r);
                        }
                    }
                    reports = uniqueReports;
                    console.log(`[Reference API] [8] Bruto (Membro): ${reports.length}`);

                    // Filtro de Segurança por Igreja
                    let allowedChurchIds = [];
                    try {
                        const perms = typeof profile?.permissions === 'string' ? JSON.parse(profile.permissions) : (profile?.permissions || {});
                        if (Array.isArray(perms.congregationIds)) {
                            allowedChurchIds = perms.congregationIds.map(id => String(id));
                        } else if (profile?.congregation) {
                            allowedChurchIds = [String(profile.congregation)];
                        }
                    } catch (e) {
                        console.error("[Reference API] [!] Erro Permissões:", e.message);
                    }

                    console.log(`[Reference API] [9] allowedChurchIds:`, allowedChurchIds);

                    if (allowedChurchIds.length > 0) {
                        const beforeFilterCount = reports.length;
                        const filteredOut = [];
                        reports = reports.filter(r => {
                            const isSessaoAtiva = r.name === '[SESSÃO_ATIVA]';
                            const hasNoChurch = !r.church_id;
                            const rChurchId = String(r.church_id || '');
                            const isAllowed = allowedChurchIds.includes(rChurchId);
                            
                            if (!isSessaoAtiva && !hasNoChurch && !isAllowed) {
                                filteredOut.push({ id: r.id, name: r.name, church_id: r.church_id });
                            }
                            
                            return isSessaoAtiva || hasNoChurch || isAllowed;
                        });
                        console.log(`[Reference API] [10] Filtro Igreja: ${beforeFilterCount} -> ${reports.length}`);
                        if (reports.length > 0) {
                            console.log(`[Reference API] [11a] Relatórios permitidos:`, reports.map(r => ({ id: r.id, name: r.name, church_id: r.church_id })));
                        }
                        if (filteredOut.length > 0) {
                            console.log(`[Reference API] [11b] Relatórios filtrados (sem permissão):`, filteredOut);
                        }
                    }
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

    router.post('/report/sync', async (req, res) => {
        const { reportId, name, data, recordCount, churchId, ownerId } = req.body;
        const supabase = getSupabaseAdmin();

        if (!supabase) {
            return res.status(500).json({ error: "Erro de configuração." });
        }

        try {
            // Validação IDOR: O usuário deve pertencer ao ownerId informado
            const { data: profile } = await supabase
                .from('profiles')
                .select('owner_id')
                .eq('id', req.user.id)
                .single();

            const effectiveOwnerId = profile?.owner_id || req.user.id;

            if (effectiveOwnerId !== ownerId) {
                return res.status(403).json({ error: "Acesso negado: Owner ID incompatível." });
            }

            // Upsert do relatório usando Service Role (ignora RLS)
            // Usamos o ownerId como user_id do relatório para que seja compartilhado
            const { data: result, error } = await supabase
                .from('saved_reports')
                .upsert({
                    id: reportId,
                    name: name,
                    data: data,
                    record_count: recordCount,
                    user_id: ownerId, // Salva sempre com o ID do Owner para ser compartilhado
                    church_id: churchId
                }, { onConflict: 'id' })
                .select()
                .single();

            if (error) throw error;
            res.json(result);
        } catch (error) {
            console.error("[Reference API] Erro ao sincronizar relatório:", error);
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

            const { data, error } = await supabase
                .from('saved_reports')
                .select('data, name')
                .eq('id', reportId)
                .eq('user_id', ownerId)
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
