import { createClient } from '@supabase/supabase-js';

let supabaseAdmin = null;

export const getSupabaseAdmin = () => {
    if (supabaseAdmin) return supabaseAdmin;

    const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY não definida.');
    }

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    return supabaseAdmin;
};