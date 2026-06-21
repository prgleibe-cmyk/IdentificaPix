
import { createClient } from '@supabase/supabase-js';
import { ReportService } from './backend/services/ReportService.js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmbGhlb2tuYm9wY2dtenlqYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODEzNjgsImV4cCI6MjA3NjY1NzM2OH0.6VIcQnx9GQ8WGr7E8SMvqF4Aiyz2FSPNxmXqwgbGRGA';

async function checkData() {
    const userId = 'a90f4896-34e1-4b43-aa67-a959106e781c';
    
    console.log("Testing optimized ReportService.listReports for user:", userId);
    
    const start = Date.now();
    try {
        const reports = await ReportService.listReports(null, userId);
        const duration = Date.now() - start;
        console.log(`\n🎉 Query Success! ReportService.listReports took ${duration}ms!`);
        console.log(`Fetched ${reports ? reports.length : 0} reports.`);
        if (reports && reports.length > 0) {
            reports.forEach((r, idx) => {
                const dataFieldExist = r.data !== null && r.data !== undefined;
                const dataStr = dataFieldExist ? JSON.stringify(r.data) : 'EXCLUDED (metadata-only)';
                const dataLength = dataFieldExist ? dataStr.length : 0;
                console.log(` - Report ${idx + 1}: ID=${r.id}, Name="${r.name}", dataExist=${dataFieldExist} (len=${dataLength} chars), created_at=${r.created_at}`);
            });
        }
    } catch (error) {
        console.error("❌ Erro ao listar relatórios:", error);
    }
}

checkData();
