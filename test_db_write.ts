
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log("--- Testing INSERT with payment_method ---");
    const dummyData = {
        transaction_date: new Date().toISOString().split('T')[0],
        amount: 0.01,
        description: 'AUDIT_TEST_INSERT',
        type: 'income',
        status: 'pending',
        user_id: '2df49a21-9522-4c27-bf83-61bcdda9f0c3', // Using the owner ID from profiles
        payment_method: 'AUDIT_TEST'
    };

    const { data, error } = await supabase
        .from('consolidated_transactions')
        .insert([dummyData])
        .select();

    if (error) {
        console.error("❌ Insert failed:", error.message);
        if (error.message.includes("payment_method")) {
            console.error("Diagnosis: The column 'payment_method' definitely DOES NOT exist in the database.");
        }
    } else {
        console.log("✅ Insert successful! Data:", data);
        console.log("Diagnosis: The column 'payment_method' EXISTS and is writable.");
        
        // Clean up
        if (data && data[0].id) {
            await supabase.from('consolidated_transactions').delete().eq('id', data[0].id);
            console.log("Cleaned up test record.");
        }
    }
}

testInsert();
