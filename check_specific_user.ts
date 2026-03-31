
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSpecificUser() {
    const userId = '0d7941a5-33e8-4b55-b937-e4e80704fa08';
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    console.log("Profile for inconsistent user:", profile);
}

checkSpecificUser();
