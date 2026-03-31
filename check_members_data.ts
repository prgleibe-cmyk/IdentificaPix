
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkMembers() {
    console.log("--- Checking Banks by Members ---");
    const { data: members } = await supabase.from('profiles').select('id').eq('role', 'member');
    const memberIds = members.map(m => m.id);
    
    const { data: banks } = await supabase.from('banks').select('id, name, user_id').in('user_id', memberIds);
    console.log("Banks created by members:", banks);

    console.log("\n--- Checking Churches by Members ---");
    const { data: churches } = await supabase.from('churches').select('id, name, user_id').in('user_id', memberIds);
    console.log("Churches created by members:", churches);
}

checkMembers();
