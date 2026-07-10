import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: contribs, error: err1 } = await supabase.from('contributors').select('*').limit(1);
    if (err1) {
        console.error("Contributors Error:", err1);
    } else {
        console.log("Contributors Columns:", Object.keys(contribs[0] || {}));
        console.log("Contributors Sample row:", contribs[0]);
    }

    const { data: learned, error: err2 } = await supabase.from('learned_associations').select('*').limit(1);
    if (err2) {
        console.error("Learned Error:", err2);
    } else {
        console.log("Learned Columns:", Object.keys(learned[0] || {}));
        console.log("Learned Sample row:", learned[0]);
    }
}
test();
