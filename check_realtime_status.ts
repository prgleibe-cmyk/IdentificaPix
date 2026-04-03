
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;

if (!serviceRoleKey) {
    console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrada nas variáveis de ambiente.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkRealtime() {
    console.log("--- AUDITORIA DE REALTIME SUPABASE ---");
    
    // Infelizmente o cliente JS não tem uma forma direta de listar publicações
    // Mas podemos tentar inferir ou dar a instrução SQL correta.
    
    console.log("\nPara garantir que a sincronia funcione, execute este SQL no Editor de SQL do Supabase:");
    console.log(`
-- 1. Habilitar Realtime para as tabelas principais
alter publication supabase_realtime add table consolidated_transactions;
alter publication supabase_realtime add table saved_reports;
alter publication supabase_realtime add table learned_associations;
alter publication supabase_realtime add table banks;
alter publication supabase_realtime add table churches;

-- 2. Garantir que o Realtime envie o payload completo (opcional mas recomendado)
alter table consolidated_transactions replica identity full;
alter table saved_reports replica identity full;
    `);

    console.log("\nVerificando se as tabelas existem...");
    const tables = ['consolidated_transactions', 'saved_reports', 'learned_associations', 'banks', 'churches'];
    
    for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error) {
            console.log(`❌ Tabela ${table}: Erro ou não existe (${error.message})`);
        } else {
            console.log(`✅ Tabela ${table}: Acessível.`);
        }
    }
}

checkRealtime();
