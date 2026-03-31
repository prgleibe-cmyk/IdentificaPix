
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkColumns() {
    console.log("--- Checking Banks Columns ---");
    const { data: banks, error: banksError } = await supabase
        .from('banks')
        .select('id, user_id')
        .limit(1);
    
    if (banksError) {
        console.error("Error fetching banks:", banksError.message);
    } else {
        console.log("Banks sample:", banks);
    }

    console.log("\n--- Checking Churches Columns ---");
    const { data: churches, error: churchesError } = await supabase
        .from('churches')
        .select('id, user_id')
        .limit(1);
    
    if (churchesError) {
        console.error("Error fetching churches:", churchesError.message);
    } else {
        console.log("Churches sample:", churches);
    }
}

checkColumns();
