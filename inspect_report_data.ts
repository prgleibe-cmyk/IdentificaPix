
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReportData() {
    const { data, error } = await supabase
        .from('saved_reports')
        .select('id, name, data')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching reports:", error);
        return;
    }

    console.log("Found", data.length, "reports");
    data.forEach(r => {
        console.log(`Report ID: ${r.id}, Name: ${r.name}`);
        console.log(`Data keys: ${r.data ? Object.keys(r.data) : 'null'}`);
        if (r.data && r.data.spreadsheet) {
            console.log(`Spreadsheet data found! Title: ${r.data.spreadsheet.title}`);
        } else {
            console.log("Spreadsheet data MISSING in 'data' column.");
        }
        console.log("-------------------");
    });
}

checkReportData();
