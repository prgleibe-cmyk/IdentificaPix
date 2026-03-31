
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fullAudit() {
    console.log("--- FULL AUDIT ---");

    // 1. Fetch all profiles
    const { data: profiles } = await supabase.from('profiles').select('id, email, role, owner_id');
    const profileMap = new Map();
    profiles?.forEach(p => profileMap.set(p.id, p));
    console.log(`Total profiles: ${profiles?.length}`);

    // 2. Audit Banks
    console.log("\n--- AUDITING BANKS ---");
    const { data: banks } = await supabase.from('banks').select('*');
    console.log(`Total banks: ${banks?.length}`);
    
    const bankAudit = banks?.map(b => {
        const profile = profileMap.get(b.user_id);
        return {
            id: b.id,
            name: b.name,
            user_id: b.user_id,
            user_email: profile?.email || 'NOT FOUND',
            user_role: profile?.role || 'N/A',
            user_owner_id: profile?.owner_id || 'N/A'
        };
    });
    console.table(bankAudit);

    // 3. Audit Churches
    console.log("\n--- AUDITING CHURCHES ---");
    const { data: churches } = await supabase.from('churches').select('*');
    console.log(`Total churches: ${churches?.length}`);
    
    const churchAudit = churches?.map(c => {
        const profile = profileMap.get(c.user_id);
        return {
            id: c.id,
            name: c.name,
            user_id: c.user_id,
            user_email: profile?.email || 'NOT FOUND',
            user_role: profile?.role || 'N/A',
            user_owner_id: profile?.owner_id || 'N/A'
        };
    });
    console.table(churchAudit);

    // 4. Check for any user_id that is NOT an owner
    const nonOwnerBanks = bankAudit?.filter(b => b.user_role !== 'owner');
    const nonOwnerChurches = churchAudit?.filter(c => c.user_role !== 'owner');

    console.log("\n--- ANOMALIES ---");
    console.log("Banks owned by non-owners:", nonOwnerBanks?.length);
    console.log("Churches owned by non-owners:", nonOwnerChurches?.length);

    if (nonOwnerBanks?.length > 0) console.table(nonOwnerBanks);
    if (nonOwnerChurches?.length > 0) console.table(nonOwnerChurches);
}

fullAudit();
