import pg from 'pg';

const rawConnectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING;
const isValidConnectionString = typeof rawConnectionString === 'string' && 
  (rawConnectionString.startsWith('postgres://') || rawConnectionString.startsWith('postgresql://'));

const connectionString = isValidConnectionString ? rawConnectionString : null;

let pool: pg.Pool;

if (connectionString) {
  console.log('Using connection string:', connectionString.split('@')[1] || connectionString);
  pool = new pg.Pool({
    connectionString,
    ssl: connectionString.includes('supabase') || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
} else {
  console.log('Using individual parameters...');
  pool = new pg.Pool({
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    database: process.env.PGDATABASE || process.env.DB_DATABASE || 'contributors',
  });
}

async function run() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to Postgres!');
    
    // Check tables
    const resTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables found:', resTables.rows.map(r => r.table_name));

    for (const row of resTables.rows) {
      const tableName = row.table_name;
      const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
      console.log(`Table "${tableName}" has ${countRes.rows[0].count} rows.`);
      
      if (tableName === 'saved_reports') {
         const sampleRes = await client.query(`SELECT id, name, user_id, church_id, created_at, record_count FROM saved_reports LIMIT 5`);
         console.log('Saved reports sample:', sampleRes.rows);
      }
    }
    
    client.release();
  } catch (err) {
    console.error('Error connecting or running queries:', err);
  } finally {
    await pool.end();
  }
}

run();
