
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function performAudit() {
    console.log("--- 1. Checking column presence via simple query ---");
    const { data: transactions, error: fetchError } = await supabase
        .from('consolidated_transactions')
        .select('*')
        .eq('user_id', '2df49a21-9522-4c27-bf83-61bcdda9f0c3')
        .limit(1);

    if (fetchError) {
        console.error("Error fetching transactions:", fetchError.message);
    } else if (transactions && transactions.length > 0) {
        const columns = Object.keys(transactions[0]);
        console.log("Found columns:", columns);
        if (columns.includes('payment_method')) {
            console.log("✅ Column 'payment_method' exists in 'consolidated_transactions'.");
        } else {
            console.error("❌ Column 'payment_method' MISSING in 'consolidated_transactions'.");
        }
    } else {
        console.log("No records found to check columns.");
    }

    console.log("\n--- 2. Testing manual update for persistence check ---");
    if (transactions && transactions.length > 0) {
        const testId = transactions[0].id;
        console.log(`Testing update on transaction ID: ${testId}`);
        const { data: updateData, error: updateError } = await supabase
            .from('consolidated_transactions')
            .update({ payment_method: 'audit_test_' + new Date().getTime() })
            .eq('id', testId)
            .select();

        if (updateError) {
            console.error("❌ Update failed:", updateError.message);
            if (updateError.message.includes("column")) {
                console.error("Diagnosis: The column likely does not exist.");
            } else if (updateError.message.includes("permission") || updateError.code === '42501') {
                console.error("Diagnosis: RLS policy is blocking the update.");
            }
        } else {
            console.log("✅ Update successful. Data returned:", updateData);
            if (updateData && updateData[0].payment_method) {
                console.log("✅ Persistence confirmed.");
            } else {
                console.error("❌ Update returned success but field is still null/missing.");
            }
        }
    }

    console.log("\n--- 3. Checking RLS (Limited with anon key) ---");
    // We can't query pg_policies with anon key usually.
    console.log("Note: Detailed RLS auditing (pg_policies) requires service_role key.");
}

performAudit();
