import { createClient } from '@supabase/supabase-js';

let supabaseAdmin = null;

export const getSupabaseAdmin = () => {
    if (supabaseAdmin) return supabaseAdmin;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                           process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                           process.env.SERVICE_ROLE_KEY ||
                           process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL não definida.');
    }

    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY não definida.');
    }

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    return supabaseAdmin;
};