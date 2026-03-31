import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 
                           process.env.SUPABASE_SERVICE_ROLE_KEY || 
                           process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Supabase Lib] Erro: SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados no ambiente.');
}

/**
 * Instância centralizada do Supabase Admin (Service Role)
 * Ignora RLS e permite operações administrativas no backend.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
