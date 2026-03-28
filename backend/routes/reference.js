
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

            // Buscar relatórios salvos
            const { data: reports, error: reportsError } = await supabase
                .from('saved_reports')
                .select('*')
                .eq('user_id', ownerId)
                .order('created_at', { ascending: false });

            if (reportsError) {
                console.error(`[Reference API] Erro ao buscar relatórios para owner ${ownerId}:`, reportsError.message);
            }

            // Buscar aprendizados (learned_associations)
            const { data: associations, error: associationsError } = await supabase
                .from('learned_associations')
                .select('*')
                .eq('user_id', ownerId);

            if (associationsError) {
                console.error(`[Reference API] Erro ao buscar aprendizados para owner ${ownerId}:`, associationsError.message);
            }

            console.log(`[Reference API] Retornando ${banks?.length || 0} bancos, ${churches?.length || 0} igrejas, ${reports?.length || 0} relatórios e ${associations?.length || 0} aprendizados.`);

            res.json({ 
                banks: banks || [], 
                churches: churches || [],
                reports: reports || [],
                associations: associations || []
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

    // Rota para salvar relatório (permite que membros salvem na conta do owner)
    router.post('/report/save', async (req, res) => {
        const { name, data, record_count, ownerId } = req.body;
        const supabase = getSupabaseAdmin();

        if (!supabase) {
            return res.status(500).json({ error: "Erro de configuração." });
        }

        if (!name || !data || !ownerId) {
            return res.status(400).json({ error: "Dados incompletos para salvar relatório." });
        }

        try {
            // Validação IDOR: O usuário logado deve ser o ownerId ou ter owner_id igual ao ownerId
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('owner_id')
                .eq('id', req.user.id)
                .single();

            if (profileError) {
                console.error(`[Reference API] Erro ao buscar perfil para salvar relatório:`, profileError.message);
                return res.status(500).json({ error: 'Erro ao validar permissões.' });
            }

            const effectiveOwnerId = profile?.owner_id || req.user.id;

            if (effectiveOwnerId !== ownerId) {
                console.warn(`[Reference API] Tentativa de salvamento não autorizada: Usuário ${req.user.id} tentou salvar para owner ${ownerId}, mas seu owner_id é ${effectiveOwnerId}`);
                return res.status(403).json({ error: "Acesso negado." });
            }

            console.log(`[Reference API] Salvando relatório "${name}" para owner ${ownerId} (requisitado por ${req.user.id})`);

            const { data: savedReport, error: saveError } = await supabase
                .from('saved_reports')
                .insert({
                    name,
                    data,
                    record_count: record_count || 0,
                    user_id: ownerId, // Sempre salva com o ID do owner
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (saveError) {
                console.error(`[Reference API] Erro ao inserir relatório:`, saveError.message);
                throw saveError;
            }

            res.json(savedReport);
        } catch (error) {
            console.error("[Reference API] Erro ao salvar relatório:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Rota para atualizar relatório (permite que membros atualizem na conta do owner)
    router.post('/report/update/:reportId', async (req, res) => {
        const { reportId } = req.params;
        const { name, data, record_count, ownerId } = req.body;
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

            console.log(`[Reference API] Atualizando relatório ${reportId} para owner ${ownerId}`);

            const updateData = {};
            if (name) updateData.name = name;
            if (data) updateData.data = data;
            if (record_count !== undefined) updateData.record_count = record_count;

            const { data: updatedReport, error: updateError } = await supabase
                .from('saved_reports')
                .update(updateData)
                .eq('id', reportId)
                .eq('user_id', ownerId)
                .select()
                .single();

            if (updateError) throw updateError;

            res.json(updatedReport);
        } catch (error) {
            console.error("[Reference API] Erro ao atualizar relatório:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Rota para salvar/aprender associação
    router.post('/association/save', async (req, res) => {
        const { normalized_description, contributor_normalized_name, church_id, ownerId } = req.body;
        const supabase = getSupabaseAdmin();

        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            // Validação IDOR
            const { data: profile } = await supabase
                .from('profiles')
                .select('owner_id')
                .eq('id', req.user.id)
                .single();

            const effectiveOwnerId = profile?.owner_id || req.user.id;
            if (effectiveOwnerId !== ownerId) return res.status(403).json({ error: "Acesso negado." });

            console.log(`[Reference API] Aprendendo associação para owner ${ownerId}: ${normalized_description}`);

            // Verificar se já existe
            const { data: existing } = await supabase
                .from('learned_associations')
                .select('id')
                .eq('normalized_description', normalized_description)
                .eq('user_id', ownerId)
                .maybeSingle();

            if (existing) {
                const { data: updated, error: updateError } = await supabase
                    .from('learned_associations')
                    .update({ 
                        contributor_normalized_name, 
                        church_id
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (updateError) throw updateError;
                res.json(updated);
            } else {
                const { data: inserted, error: insertError } = await supabase
                    .from('learned_associations')
                    .insert({ 
                        user_id: ownerId, 
                        normalized_description, 
                        contributor_normalized_name, 
                        church_id
                    })
                    .select()
                    .single();
                if (insertError) throw insertError;
                res.json(inserted);
            }
        } catch (error) {
            console.error("[Reference API] Erro ao salvar associação:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Rota para gerenciar bancos (add/update)
    router.post('/bank/save', async (req, res) => {
        const { id, name, ownerId } = req.body;
        const supabase = getSupabaseAdmin();
        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            const { data: profile } = await supabase.from('profiles').select('owner_id').eq('id', req.user.id).single();
            if ((profile?.owner_id || req.user.id) !== ownerId) return res.status(403).json({ error: "Acesso negado." });

            if (id) {
                const { data, error } = await supabase.from('banks').update({ name }).eq('id', id).eq('user_id', ownerId).select().single();
                if (error) throw error;
                res.json(data);
            } else {
                const { data, error } = await supabase.from('banks').insert({ name, user_id: ownerId }).select().single();
                if (error) throw error;
                res.json(data);
            }
        } catch (error) {
            console.error("[Reference API] Erro ao salvar banco:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Rota para gerenciar igrejas (add/update)
    router.post('/church/save', async (req, res) => {
        const { id, formData, ownerId } = req.body;
        const supabase = getSupabaseAdmin();
        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            const { data: profile } = await supabase.from('profiles').select('owner_id').eq('id', req.user.id).single();
            if ((profile?.owner_id || req.user.id) !== ownerId) return res.status(403).json({ error: "Acesso negado." });

            if (id) {
                const { data, error } = await supabase.from('churches').update(formData).eq('id', id).eq('user_id', ownerId).select().single();
                if (error) throw error;
                res.json(data);
            } else {
                const { data, error } = await supabase.from('churches').insert({ ...formData, user_id: ownerId }).select().single();
                if (error) throw error;
                res.json(data);
            }
        } catch (error) {
            console.error("[Reference API] Erro ao salvar igreja:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Rota para buscar configuração administrativa
    router.get('/config/:key', async (req, res) => {
        const { key } = req.params;
        const supabase = getSupabaseAdmin();
        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            const { data, error } = await supabase
                .from('admin_config')
                .select('value')
                .eq('key', key)
                .maybeSingle();

            if (error) throw error;
            res.json(data?.value || null);
        } catch (error) {
            console.error("[Reference API] Erro ao buscar config:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Rota para salvar configuração administrativa
    router.post('/config/save', async (req, res) => {
        const { key, value } = req.body;
        const supabase = getSupabaseAdmin();
        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            const { data, error } = await supabase
                .from('admin_config')
                .upsert({ 
                    key, 
                    value, 
                    updated_at: new Date().toISOString() 
                }, { onConflict: 'key' })
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            console.error("[Reference API] Erro ao salvar config:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Rota para buscar todas as configurações administrativas
    router.get('/config/list/all', async (req, res) => {
        const supabase = getSupabaseAdmin();
        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            const { data, error } = await supabase
                .from('admin_config')
                .select('key, value');

            if (error) throw error;

            const config = {};
            data?.forEach(row => {
                config[row.key] = row.value;
            });
            res.json(config);
        } catch (error) {
            console.error("[Reference API] Erro ao listar configs:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Rota para deletar dados (banco, igreja, relatório, associação)
    router.delete('/delete/:type/:id', async (req, res) => {
        const { type, id } = req.params;
        const ownerId = req.user.id; // Simplificado: assume que o usuário é o dono ou tem permissão
        const supabase = getSupabaseAdmin();
        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            let table = '';
            if (type === 'bank') table = 'banks';
            else if (type === 'church') table = 'churches';
            else if (type === 'report') table = 'saved_reports';
            else if (type === 'association') table = 'learned_associations';
            else return res.status(400).json({ error: "Tipo inválido." });

            const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', id); // Para associações, o ID pode ser diferente, mas vamos ajustar no hook

            if (error) throw error;
            res.json({ success: true });
        } catch (error) {
            console.error(`[Reference API] Erro ao deletar ${type}:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    // Rota para gerenciar modelos de arquivo
    router.get('/models/:ownerId', async (req, res) => {
        const { ownerId } = req.params;
        const supabase = getSupabaseAdmin();
        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            const { data, error } = await supabase
                .from('file_models')
                .select('*')
                .eq('user_id', ownerId);

            if (error) throw error;
            res.json(data || []);
        } catch (error) {
            console.error("[Reference API] Erro ao buscar modelos:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/models/save', async (req, res) => {
        const { model } = req.body;
        const supabase = getSupabaseAdmin();
        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            const { data, error } = await supabase
                .from('file_models')
                .upsert(model, { onConflict: 'id' })
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            console.error("[Reference API] Erro ao salvar modelo:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/models/:id', async (req, res) => {
        const { id } = req.params;
        const supabase = getSupabaseAdmin();
        if (!supabase) return res.status(500).json({ error: "Erro de configuração." });

        try {
            const { error } = await supabase
                .from('file_models')
                .delete()
                .eq('id', id);

            if (error) throw error;
            res.json({ success: true });
        } catch (error) {
            console.error("[Reference API] Erro ao deletar modelo:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
