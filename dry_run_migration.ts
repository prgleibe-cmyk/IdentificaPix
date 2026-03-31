
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function dryRun() {
    console.log("--- Dry Run: Mapping Banks to Owners ---");
    
    const { data: profiles } = await supabase.from('profiles').select('id, owner_id');
    const ownerMap = new Map();
    profiles.forEach(p => {
        ownerMap.set(p.id, p.owner_id || p.id);
    });

    const { data: banks } = await supabase.from('banks').select('id, name, user_id');
    
    let updateCount = 0;
    banks.forEach(b => {
        const targetOwnerId = ownerMap.get(b.user_id);
        if (targetOwnerId && targetOwnerId !== b.user_id) {
            console.log(`Bank "${b.name}" (id: ${b.id}) currently has user_id: ${b.user_id}. Should be updated to owner_id: ${targetOwnerId}`);
            updateCount++;
        }
    });
    console.log(`Total banks to update: ${updateCount}`);

    console.log("\n--- Dry Run: Mapping Churches to Owners ---");
    const { data: churches } = await supabase.from('churches').select('id, name, user_id');
    
    let churchUpdateCount = 0;
    churches.forEach(c => {
        const targetOwnerId = ownerMap.get(c.user_id);
        if (targetOwnerId && targetOwnerId !== c.user_id) {
            console.log(`Church "${c.name}" (id: ${c.id}) currently has user_id: ${c.user_id}. Should be updated to owner_id: ${targetOwnerId}`);
            churchUpdateCount++;
        }
    });
    console.log(`Total churches to update: ${churchUpdateCount}`);
}

dryRun();
