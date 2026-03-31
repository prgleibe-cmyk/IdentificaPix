
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testBackendLogic(ownerId: string) {
    console.log(`Testing backend logic for ownerId: ${ownerId}`);
    
    // 1. Get team IDs
    const { data: teamProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('owner_id', ownerId);

    const teamIds = [ownerId, ...(teamProfiles?.map(p => p.id) || [])];
    console.log(`Team IDs: ${teamIds.join(', ')}`);

    // 2. Fetch banks using .in('user_id', teamIds)
    const { data: banks } = await supabase
        .from('banks')
        .select('id, name, user_id')
        .in('user_id', teamIds);
    
    console.log(`Banks found: ${banks?.length || 0}`);
    banks?.forEach(b => console.log(` - ${b.name} (user_id: ${b.user_id})`));

    // 3. Fetch churches using .in('user_id', teamIds)
    const { data: churches } = await supabase
        .from('churches')
        .select('id, name, user_id')
        .in('user_id', teamIds);

    console.log(`Churches found: ${churches?.length || 0}`);
    churches?.forEach(c => console.log(` - ${c.name} (user_id: ${c.user_id})`));
}

// Test with the owner ID we found
testBackendLogic('a90f4896-34e1-4b43-aa67-a959106e781c');
