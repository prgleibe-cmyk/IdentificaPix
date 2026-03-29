import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://uflheoknbopcgmzyjbft.supabase.co';
const hardcodedAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';

let supabaseClient = null;

const getSupabase = () => {
    if (supabaseClient) return supabaseClient;

    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.SUPABASE_ANON_KEY || 
                        process.env.VITE_SUPABASE_ANON_KEY || 
                        hardcodedAnon;

    try {
        supabaseClient = createClient(supabaseUrl, supabaseKey);
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

        // Adiciona o usuário à requisição para uso posterior se necessário
        req.user = user;
        next();
    } catch (err) {
        console.error('[Auth Middleware] Erro de validação:', err.message);
        return res.status(401).json({ error: 'Falha na autenticação.' });
    }
};
