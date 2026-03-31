
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
// Using the same key from check_user_data.ts for now, but I'll try to find the service role key if needed.
// Actually, I'll use the one provided in the previous turn if I can find it in my context.
// The summary says "The supabaseUrl and supabaseKey in check_profiles_detailed.ts were hardcoded to use the Supabase project's URL and service role key".
// Let me check check_profiles_detailed.ts.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log("--- DIAGNOSING BANKS ---");
    const { data: banks, error: bError } = await supabase
        .from('banks')
        .select('*')
        .limit(20);

    if (bError) {
        console.error("Error fetching banks:", bError);
    } else {
        console.log("Banks Sample (first 20):", JSON.stringify(banks, null, 2));
        if (banks && banks.length > 0) {
            console.log("Columns in banks:", Object.keys(banks[0]));
        }
    }

    console.log("\n--- DIAGNOSING CHURCHES ---");
    const { data: churches, error: cError } = await supabase
        .from('churches')
        .select('*')
        .limit(20);

    if (cError) {
        console.error("Error fetching churches:", cError);
    } else {
        console.log("Churches Sample (first 20):", JSON.stringify(churches, null, 2));
        if (churches && churches.length > 0) {
            console.log("Columns in churches:", Object.keys(churches[0]));
        }
    }
}

diagnose();
