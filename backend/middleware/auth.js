import { getSupabaseAdmin } from '../lib/supabase.js';

let supabaseClient = null;

const getSupabase = () => {
    if (supabaseClient) return supabaseClient;
    try {
        supabaseClient = getSupabaseAdmin();
        return supabaseClient;
    } catch (e) {
        console.error('[Auth Middleware] Erro ao inicializar Supabase:', e.message);
        return null;
    }
};

export const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido ou inválido.' });
    }

    const token = authHeader.split(' ')[1];
    const supabase = getSupabase();

    if (!supabase) {
        return res.status(500).json({ error: 'Erro interno: Serviço de autenticação não disponível.' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
        }

        // Buscar perfil para obter role e owner_id
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, owner_id')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('[Auth Middleware] Erro ao buscar perfil:', profileError.message);
            // Mesmo sem perfil, mantemos o user do auth, mas sem as roles customizadas
            req.user = user;
        } else {
            // Mescla os dados do perfil no objeto user
            req.user = {
                ...user,
                role: profile.role,
                owner_id: profile.owner_id
            };
        }

        next();
    } catch (err) {
        console.error('[Auth Middleware] Erro de validação:', err.message);
        return res.status(401).json({ error: 'Falha na autenticação.' });
    }
};
