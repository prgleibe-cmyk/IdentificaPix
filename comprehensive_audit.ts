
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function comprehensiveAudit() {
    console.log("🚀 INICIANDO AUDITORIA COMPREENSIVA DE DADOS\n");

    // 1. Buscar todos os perfis
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
    if (pError) { console.error("Erro ao buscar perfis:", pError); return; }
    
    const profileMap = new Map();
    profiles?.forEach(p => profileMap.set(p.id, p));
    
    const owners = profiles?.filter(p => p.role === 'owner') || [];
    const members = profiles?.filter(p => p.role !== 'owner') || [];
    
    console.log(`📊 ESTATÍSTICAS DE PERFIS:`);
    console.log(`- Total de Perfis: ${profiles?.length}`);
    console.log(`- Owners: ${owners.length}`);
    console.log(`- Membros (Admins/Principais/Secundários): ${members.length}`);

    // 2. Auditoria de Profiles (owner_id inconsistente)
    console.log("\n🔍 AUDITANDO TABELA 'PROFILES':");
    const profileAnomalies = [];
    profiles?.forEach(p => {
        if (p.role === 'owner' && p.owner_id !== null && p.owner_id !== p.id) {
            profileAnomalies.push({ id: p.id, email: p.email, role: p.role, owner_id: p.owner_id, issue: "Owner com owner_id preenchido incorretamente" });
        }
        if (p.role !== 'owner' && !p.owner_id) {
            profileAnomalies.push({ id: p.id, email: p.email, role: p.role, owner_id: p.owner_id, issue: "Membro sem owner_id" });
        } else if (p.role !== 'owner' && p.owner_id) {
            const owner = profileMap.get(p.owner_id);
            if (!owner || owner.role !== 'owner') {
                profileAnomalies.push({ id: p.id, email: p.email, role: p.role, owner_id: p.owner_id, issue: "owner_id aponta para perfil inexistente ou não-owner" });
            }
        }
    });
    if (profileAnomalies.length > 0) {
        console.table(profileAnomalies);
    } else {
        console.log("✅ Tabela 'profiles' consistente.");
    }

    // 3. Auditoria de Bancos, Igrejas e Relatórios (user_id inconsistente)
    const tables = ['banks', 'churches', 'saved_reports'];
    
    for (const tableName of tables) {
        console.log(`\n🔍 AUDITANDO TABELA '${tableName}':`);
        const { data: records, error } = await supabase.from(tableName).select('*');
        if (error) { console.error(`Erro ao buscar ${tableName}:`, error); continue; }
        
        const anomalies = [];
        records?.forEach(r => {
            const ownerProfile = profileMap.get(r.user_id);
            if (!ownerProfile) {
                anomalies.push({ id: r.id, name: r.name || r.id, user_id: r.user_id, issue: "user_id órfão (perfil não encontrado)" });
            } else if (ownerProfile.role !== 'owner') {
                anomalies.push({ id: r.id, name: r.name || r.id, user_id: r.user_id, issue: `user_id aponta para um ${ownerProfile.role} (deveria ser owner)` });
            }
        });

        if (anomalies.length > 0) {
            console.log(`❌ Inconsistências em '${tableName}': ${anomalies.length}`);
            console.table(anomalies);
        } else {
            console.log(`✅ Tabela '${tableName}' consistente. Todos os registros pertencem a um Owner válido.`);
        }
    }

    // 4. Verificação de Equipe (Compartilhamento)
    console.log("\n🤝 VERIFICANDO COMPARTILHAMENTO DE EQUIPE:");
    const teams = new Map();
    profiles?.forEach(p => {
        const teamId = p.owner_id || p.id;
        if (!teams.has(teamId)) teams.set(teamId, []);
        teams.get(teamId).push(p);
    });

    console.log(`Total de Equipes Identificadas: ${teams.size}`);
    let sharingIssues = 0;
    teams.forEach((members, teamId) => {
        const owner = profileMap.get(teamId);
        if (!owner || owner.role !== 'owner') {
            console.warn(`⚠️ Equipe ${teamId} não possui um Owner válido como cabeça.`);
            sharingIssues++;
        }
    });

    if (sharingIssues === 0) {
        console.log("✅ Estrutura de equipes e compartilhamento parece correta.");
    }

    console.log("\n--- FIM DA AUDITORIA ---");
}

comprehensiveAudit();
