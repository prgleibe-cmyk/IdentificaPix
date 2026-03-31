
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const userId = 'a90f4896-34e1-4b43-aa67-a959106e781c';
    
    const { data: banks, error: bError } = await supabase
        .from('banks')
        .select('*')
        .eq('user_id', userId);

    const { data: churches, error: cError } = await supabase
        .from('churches')
        .select('*')
        .eq('user_id', userId);

    console.log(`Data for user ${userId}:`);
    console.log("Banks:", banks);
    console.log("Churches:", churches);
}

checkData();
