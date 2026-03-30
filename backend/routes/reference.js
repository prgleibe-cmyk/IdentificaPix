
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
                .select('owner_id, role, congregation, permissions')
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

            // Buscar relatórios salvos (Membros veem do Owner se tiverem permissão)
            let reportsQuery = supabase
                .from('saved_reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (profile?.role === 'owner') {
                reportsQuery = reportsQuery.eq('user_id', ownerId);
            } else {
                // Para membros: 
                // 1. Ver seus próprios relatórios salvos
                // 2. VER a Sessão Ativa do Owner (compartilhada)
                // Usamos aspas duplas no nome para evitar problemas com os colchetes [ ]
                const sessionName = '"[SESSÃO_ATIVA]"';
                reportsQuery = reportsQuery.or(`user_id.eq.${req.user.id},and(user_id.eq.${ownerId},name.eq.${sessionName})`);
                
                // Tenta extrair IDs de igrejas permitidas do perfil
                let allowedChurchIds = [];
                try {
                    const perms = typeof profile?.permissions === 'string' ? JSON.parse(profile.permissions) : (profile?.permissions || {});
                    if (Array.isArray(perms.congregationIds)) {
                        allowedChurchIds = perms.congregationIds;
                    } else if (profile?.congregation) {
                        const cong = profile.congregation;
                        allowedChurchIds = Array.isArray(cong) ? cong : (typeof cong === 'string' ? cong.split(',').map(s => s.trim()) : [cong]);
                    }
                } catch (e) {
                    console.error("[Reference API] Erro ao processar permissões:", e);
                }

                if (allowedChurchIds.length > 0) {
                    // Filtra por igreja mas SEMPRE permite a sessão ativa
                    reportsQuery = reportsQuery.or(`church_id.in.(${allowedChurchIds.join(',')}),name.eq.${sessionName}`);
                }
            }

            const { data: reports, error: reportsError } = await reportsQuery;

            if (reportsError) {
                console.error(`[Reference API] Erro ao buscar relatórios para usuário ${req.user.id}:`, reportsError.message);
            }

            console.log(`[Reference API] Retornando ${banks?.length || 0} bancos, ${churches?.length || 0} igrejas e ${reports?.length || 0} relatórios.`);

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
