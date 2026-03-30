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

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('owner_id, role, congregation, permissions')
                .eq('id', req.user.id)
                .single();
            
            if (profileError) {
                console.error(`[Reference API] [!] Erro Perfil:`, profileError.message);
                return res.status(500).json({ error: 'Erro ao validar permissões.' });
            }

            const effectiveOwnerId = profile?.owner_id || req.user.id;

            if (effectiveOwnerId !== ownerId) {
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

                if (isActualOwner) {
                    const { data: ownerReports } = await supabase
                        .from('saved_reports')
                        .select('id, user_id, church_id, name, created_at, record_count, data')
                        .eq('user_id', ownerId)
                        .order('created_at', { ascending: false });

                    reports = (ownerReports || []).map(r => {
                        let parsedData = r.data;
                        try {
                            parsedData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                        } catch {
                            parsedData = null;
                        }
                        return { ...r, data: parsedData };
                    });

                } else {
                    let allowedChurchIds = [];
                    try {
                        const perms = typeof profile?.permissions === 'string' ? JSON.parse(profile.permissions) : (profile?.permissions || {});
                        if (Array.isArray(perms.congregationIds)) {
                            allowedChurchIds = perms.congregationIds.map(id => String(id));
                        } else if (profile?.congregation) {
                            allowedChurchIds = [String(profile.congregation)];
                        }
                    } catch {}

                    let query = supabase
                        .from('saved_reports')
                        .select('id, user_id, church_id, name, created_at, record_count, data')
                        .eq('user_id', ownerId)
                        .not('data', 'is', null) // ✅ CORREÇÃO
                        .order('created_at', { ascending: false });

                    if (allowedChurchIds.length > 0) {
                        const filterStr = `church_id.in.(${allowedChurchIds.join(',')}),church_id.is.null,name.eq.[SESSÃO_ATIVA]`;
                        query = query.or(filterStr);
                    } else {
                        query = query.or(`church_id.is.null,name.eq.[SESSÃO_ATIVA]`);
                    }

                    const { data: filteredReports } = await query;

                    reports = (filteredReports || []).map(r => {
                        let parsedData = r.data;
                        try {
                            parsedData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                        } catch {
                            parsedData = null;
                        }
                        return { ...r, data: parsedData };
                    });
                }

            } catch (reportsErr) {
                console.error("[Reference API] [!] Erro Crítico Reports:", reportsErr);
            }

            console.log(`[Reference API] [FINAL] Reports com data:`, reports.map(r => ({
                id: r.id,
                hasData: !!r.data,
                results: r.data?.results?.length
            })));

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
            const { data: profile } = await supabase
                .from('profiles')
                .select('owner_id')
                .eq('id', req.user.id)
                .single();

            const effectiveOwnerId = profile?.owner_id || req.user.id;

            if (effectiveOwnerId !== ownerId) {
                return res.status(403).json({ error: "Acesso negado: Owner ID incompatível." });
            }

            const { data: result, error } = await supabase
                .from('saved_reports')
                .upsert({
                    id: reportId,
                    name: name,
                    data: data,
                    record_count: recordCount,
                    user_id: ownerId,
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

            let parsedData = data.data;
            try {
                parsedData = typeof parsedData === 'string' ? JSON.parse(parsedData) : parsedData;
            } catch {
                parsedData = null;
            }

            res.json({
                name: data.name,
                data: parsedData
            });

        } catch (error) {
            console.error("[Reference API] Erro ao buscar relatório:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};