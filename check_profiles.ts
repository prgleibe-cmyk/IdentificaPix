
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkProfiles() {
    console.log("--- Checking Profiles ---");
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, owner_id, role')
        .limit(10);
    
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Profiles:", profiles);
    }
}

checkProfiles();
