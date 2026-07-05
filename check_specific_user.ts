
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSpecificUser() {
    const userIds = ['a90f4896-34e1-4b43-aa67-a959106e781c', '2df49a21-9522-4c27-bf83-61bcdda9f0c3'];
    for (const userId of userIds) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        console.log(`Profile for user ${userId}:`, profile);
    }
}

checkSpecificUser();
