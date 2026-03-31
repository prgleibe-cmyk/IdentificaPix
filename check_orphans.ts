
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkOrphans() {
    // Get all profiles to identify members and their owners
    const { data: profiles } = await supabase.from('profiles').select('id, owner_id, role');
    const memberIds = profiles?.filter(p => p.role === 'member').map(p => p.id) || [];
    const ownerIds = profiles?.filter(p => p.role === 'owner').map(p => p.id) || [];

    console.log("--- CHECKING BANKS ---");
    const { data: banks } = await supabase.from('banks').select('id, user_id, name');
    console.log(`Total banks: ${banks?.length}`);
    console.log("Bank user_ids:", [...new Set(banks?.map(b => b.user_id))]);

    console.log("\n--- CHECKING CHURCHES ---");
    const { data: churches } = await supabase.from('churches').select('id, user_id, name');
    console.log(`Total churches: ${churches?.length}`);
    console.log("Church user_ids:", [...new Set(churches?.map(c => c.user_id))]);
}

checkOrphans();
