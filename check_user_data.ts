
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const userId = 'a90f4896-34e1-4b43-aa67-a959106e781c';
    console.log(`\n=== DEEP AUDIT FOR USER: ${userId} ===`);

    // 1. Count total pending in database vs is_confirmed
    console.log("\n1. Querying counts in consolidated_transactions...");
    const { count: pendingCount, error: pErr } = await supabase
        .from('consolidated_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .eq('is_confirmed', false);

    const { count: totalCount, error: tErr } = await supabase
        .from('consolidated_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    console.log(` - Total transactions for user: ${totalCount} (Error: ${tErr?.message || 'none'})`);
    console.log(` - Pending (unconfirmed) transactions: ${pendingCount} (Error: ${pErr?.message || 'none'})`);

    // 2. Group transactions by 'source'
    console.log("\n2. Grouping transactions by 'source'...");
    const { data: sources, error: sErr } = await supabase
        .from('consolidated_transactions')
        .select('source')
        .eq('user_id', userId);

    if (sErr) {
        console.error(" - Error grouping sources:", sErr.message);
    } else {
        const counts = {};
        (sources || []).forEach(s => {
            const src = s.source || 'undefined';
            counts[src] = (counts[src] || 0) + 1;
        });
        console.log("Sources breakdown:", JSON.stringify(counts, null, 2));
    }

    // 3. Test insert an inbox transaction
    console.log("\n3. Simulating database insert of an 'inbox' transaction...");
    const testRowHash = `sms_${userId}_4aef5ccb-d937-4044-9c60-344d34ec699e_2026-06-21_180.50_TESTAUDIT`;
    
    // First let's clean any existing test insert if any
    await supabase
        .from('consolidated_transactions')
        .delete()
        .eq('row_hash', testRowHash);
        
    const { data: insertResult, error: insertError } = await supabase
        .from('consolidated_transactions')
        .insert({
            user_id: userId,
            bank_id: '4aef5ccb-d937-4044-9c60-344d34ec699e', // SICREDI - Igreja
            transaction_date: '2026-06-21',
            description: 'TEST WEBHOOK AUDIT SMS',
            amount: 180.50,
            type: 'income',
            source: 'file', // Changed from 'inbox' to respect the check constraint
            status: 'pending',
            pix_key: 'AUTO_SMS',
            row_hash: testRowHash
        })
        .select();

    if (insertError) {
        console.error("❌ INSERT SIMULATION FOR PIX/SMS WEBHOOK FAILED!");
        console.error("Error code:", insertError.code);
        console.error("Error Message:", insertError.message);
        console.error("Details:", insertError.details);
        console.error("Hint:", insertError.hint);
    } else {
        console.log("✅ INSERT SIMULATION SUCCEEDED!");
        console.log("Resulting row:", JSON.stringify(insertResult, null, 2));
        
        // Clean up immediately so we don't pollute the production bank list
        await supabase
            .from('consolidated_transactions')
            .delete()
            .eq('row_hash', testRowHash);
        console.log("🧹 Test row cleaned up successfully.");
    }
}

checkData();

