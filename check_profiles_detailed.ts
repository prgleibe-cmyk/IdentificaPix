
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, role, owner_id');

    if (error) {
        console.error("Error fetching profiles:", error);
        return;
    }

    console.log("Profiles:");
    console.table(profiles);
}

checkProfiles();
