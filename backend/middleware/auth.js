import { getSupabaseAdmin } from '../lib/supabase.js';

let supabaseClient = null;

const getSupabase = () => {
    if (supabaseClient) return supabaseClient;

    try {
        supabaseClient = getSupabaseAdmin();

        if (!supabaseClient) {
            throw new Error('getSupabaseAdmin retornou null');
        }

        return supabaseClient;
    } catch (e) {
        console.error('[Auth Middleware] Erro ao inicializar Supabase:', e.message);
        throw e; // 🔥 NÃO esconder erro
    }
};

export const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido ou inválido.' });
    }

    const token = authHeader.split(' ')[1];

    let supabase;
    try {
        supabase = getSupabase();
    } catch (e) {
        return res.status(500).json({ error: 'Erro interno: Supabase não inicializado corretamente.' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, owner_id')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('[Auth Middleware] Erro ao buscar perfil:', profileError.message);
            req.user = user;
        } else {
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