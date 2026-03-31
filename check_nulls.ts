
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkNulls() {
    console.log("--- CHECKING BANKS FOR NULL USER_ID ---");
    const { data: banks } = await supabase.from('banks').select('id, name, user_id');
    const bankNulls = banks?.filter(b => !b.user_id) || [];
    console.log(`Total banks: ${banks?.length}`);
    console.log(`Banks with null user_id: ${bankNulls.length}`);
    if (bankNulls.length > 0) {
        console.log("Sample nulls:", bankNulls.slice(0, 5));
    }

    console.log("\n--- CHECKING CHURCHES FOR NULL USER_ID ---");
    const { data: churches } = await supabase.from('churches').select('id, name, user_id');
    const churchNulls = churches?.filter(c => !c.user_id) || [];
    console.log(`Total churches: ${churches?.length}`);
    console.log(`Churches with null user_id: ${churchNulls.length}`);
    if (churchNulls.length > 0) {
        console.log("Sample nulls:", churchNulls.slice(0, 5));
    }
}

checkNulls();
