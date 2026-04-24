
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // We can't easily list tables with the anon key via Supabase client,
    // but we can try to access tables we suspect exist.
    
    const tablesToCheck = ['transactions', 'consolidated_transactions', 'profiles', 'banks', 'churches'];
    
    for (const table of tablesToCheck) {
        console.log(`Checking table: ${table}`);
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`  ❌ Error or not found: ${error.message}`);
        } else {
            console.log(`  ✅ Exists! Found ${data.length} records. Columns: ${data.length > 0 ? Object.keys(data[0]) : 'unknown'}`);
        }
    }
}

listTables();
