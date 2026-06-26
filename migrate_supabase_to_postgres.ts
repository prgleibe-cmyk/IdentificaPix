import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SERVICE_ROLE_KEY ||
                       process.env.SUPABASE_SERVICE_KEY;

if (!serviceRoleKey) {
  console.error("❌ Erro: SUPABASE_SERVICE_ROLE_KEY não foi encontrada.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const rawConnectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING;
const isValidConnectionString = typeof rawConnectionString === 'string' && 
  (rawConnectionString.startsWith('postgres://') || rawConnectionString.startsWith('postgresql://'));

const connectionString = isValidConnectionString ? rawConnectionString : null;

let pool: pg.Pool;

if (connectionString) {
  console.log('🔌 Conectando ao Postgres usando DATABASE_URL...');
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase') || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
} else {
  console.log('🔌 Conectando ao Postgres usando parâmetros individuais...');
  pool = new Pool({
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    database: process.env.PGDATABASE || process.env.DB_DATABASE || 'contributors',
  });
}

// Helper to fetch all rows paginated from Supabase
async function fetchAllFromSupabase(table: string) {
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    console.log(`📥 Buscando ${table} do Supabase (intervalo: ${from} a ${from + pageSize - 1})...`);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);
      
    if (error) {
      throw new Error(`Erro ao buscar de ${table}: ${error.message}`);
    }
    
    if (!data || data.length === 0) break;
    allData = [...allData, ...data];
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  console.log(`✅ Total recuperado de ${table} no Supabase: ${allData.length} registros.`);
  return allData;
}

async function runMigration() {
  const pgClient = await pool.connect();
  try {
    console.log('🚀 Iniciando migração de dados do Supabase para o VPS Postgres...');

    // 1. Bancos (banks)
    const banks = await fetchAllFromSupabase('banks');
    if (banks.length > 0) {
      console.log(`📤 Inserindo ${banks.length} bancos no Postgres...`);
      for (const bank of banks) {
        await pgClient.query(`
          INSERT INTO banks (id, name, user_id, bank_key, account_name, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            user_id = EXCLUDED.user_id,
            bank_key = EXCLUDED.bank_key,
            account_name = EXCLUDED.account_name,
            created_at = EXCLUDED.created_at;
        `, [
          bank.id,
          bank.name,
          bank.user_id,
          bank.bank_key || null,
          bank.account_name || bank.name,
          bank.created_at || new Date()
        ]);
      }
      console.log('✅ Bancos migrados com sucesso!');
    }

    // 2. Igrejas (churches)
    const churches = await fetchAllFromSupabase('churches');
    if (churches.length > 0) {
      console.log(`📤 Inserindo ${churches.length} igrejas no Postgres...`);
      for (const church of churches) {
        await pgClient.query(`
          INSERT INTO churches (id, name, address, "logoUrl", pastor, user_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            address = EXCLUDED.address,
            "logoUrl" = EXCLUDED."logoUrl",
            pastor = EXCLUDED.pastor,
            user_id = EXCLUDED.user_id,
            created_at = EXCLUDED.created_at;
        `, [
          church.id,
          church.name,
          church.address || '',
          church.logoUrl || '',
          church.pastor || '',
          church.user_id,
          church.created_at || new Date()
        ]);
      }
      console.log('✅ Igrejas migradas com sucesso!');
    }

    // 3. Associações (learned_associations)
    const associations = await fetchAllFromSupabase('learned_associations');
    if (associations.length > 0) {
      console.log(`📤 Inserindo ${associations.length} associações no Postgres...`);
      for (const assoc of associations) {
        await pgClient.query(`
          INSERT INTO learned_associations (id, user_id, normalized_description, contributor_normalized_name, church_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            normalized_description = EXCLUDED.normalized_description,
            contributor_normalized_name = EXCLUDED.contributor_normalized_name,
            church_id = EXCLUDED.church_id,
            created_at = EXCLUDED.created_at;
        `, [
          assoc.id,
          assoc.user_id,
          assoc.normalized_description,
          assoc.contributor_normalized_name,
          assoc.church_id,
          assoc.created_at || new Date()
        ]);
      }
      console.log('✅ Associações migradas com sucesso!');
    }

    // 4. Relatórios Salvos (saved_reports)
    const savedReports = await fetchAllFromSupabase('saved_reports');
    if (savedReports.length > 0) {
      console.log(`📤 Inserindo ${savedReports.length} relatórios salvos no Postgres...`);
      for (const report of savedReports) {
        await pgClient.query(`
          INSERT INTO saved_reports (id, name, record_count, user_id, data, church_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            record_count = EXCLUDED.record_count,
            user_id = EXCLUDED.user_id,
            data = EXCLUDED.data,
            church_id = EXCLUDED.church_id,
            created_at = EXCLUDED.created_at;
        `, [
          report.id,
          report.name,
          report.record_count || 0,
          report.user_id,
          typeof report.data === 'string' ? report.data : JSON.stringify(report.data),
          report.church_id || null,
          report.created_at || new Date()
        ]);
      }
      console.log('✅ Relatórios salvos migrados com sucesso!');
    }

    // 5. Transações Consolidadas (consolidated_transactions)
    const transactions = await fetchAllFromSupabase('consolidated_transactions');
    if (transactions.length > 0) {
      console.log(`📤 Inserindo ${transactions.length} transações consolidadas no Postgres...`);
      
      // Let's do it in chunks or individual queries. Since this is a one-time migration, individual inserts with ON CONFLICT is safest.
      let count = 0;
      for (const tx of transactions) {
        await pgClient.query(`
          INSERT INTO consolidated_transactions (
            id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            amount = EXCLUDED.amount,
            description = EXCLUDED.description,
            type = EXCLUDED.type,
            pix_key = EXCLUDED.pix_key,
            source = EXCLUDED.source,
            user_id = EXCLUDED.user_id,
            status = EXCLUDED.status,
            bank_id = EXCLUDED.bank_id,
            row_hash = EXCLUDED.row_hash,
            is_confirmed = EXCLUDED.is_confirmed,
            transaction_date = EXCLUDED.transaction_date,
            created_at = EXCLUDED.created_at;
        `, [
          tx.id,
          tx.amount,
          tx.description,
          tx.type,
          tx.pix_key || null,
          tx.source || 'file',
          tx.user_id,
          tx.status || 'pending',
          tx.bank_id || null,
          tx.row_hash || null,
          tx.is_confirmed !== undefined ? tx.is_confirmed : false,
          tx.transaction_date,
          tx.created_at || new Date()
        ]);
        count++;
        if (count % 500 === 0) {
          console.log(`   Processed ${count}/${transactions.length}...`);
        }
      }
      console.log('✅ Transações consolidadas migradas com sucesso!');
    }

    console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO! Todos os dados históricos foram importados do Supabase para o VPS Postgres.');

  } catch (err) {
    console.error('❌ Erro crítico durante a migração:', err);
  } finally {
    pgClient.release();
    await pool.end();
  }
}

runMigration();
