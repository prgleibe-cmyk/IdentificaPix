import express, { Request, Response } from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

// Configure PostgreSQL connection
const rawConnectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING;
const isValidConnectionString = typeof rawConnectionString === 'string' && 
  (rawConnectionString.startsWith('postgres://') || rawConnectionString.startsWith('postgresql://'));

const connectionString = isValidConnectionString ? rawConnectionString : null;

let pool: pg.Pool;

if (connectionString) {
  console.log('[Contributors API] Using connection string for PostgreSQL database.');
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase') || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
} else {
  if (rawConnectionString && !isValidConnectionString) {
    console.warn(`[Contributors API] WARNING: DATABASE_URL is not a valid connection URI ("${rawConnectionString.substring(0, 50)}..."). Using individual parameters instead.`);
  } else {
    console.log('[Contributors API] No connection string provided. Using individual parameters for PostgreSQL database connection.');
  }
  pool = new Pool({
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    database: process.env.PGDATABASE || process.env.DB_DATABASE || 'contributors',
  });
}

// Database tables initialization
async function initializeDatabase() {
  let client;
  try {
    client = await pool.connect();
    console.log('[Contributors API] Connected to PostgreSQL environment successfully!');
    
    // Enable extensions for UUID generation if possible
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    } catch (extErr) {
      console.warn('[Contributors API] Warning: could not enable uuid/pgcrypto extensions:', (extErr as Error).message);
    }

    // Create table contributors
    await client.query(`
      CREATE TABLE IF NOT EXISTS contributors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        church_id UUID NOT NULL,
        canonical_name VARCHAR(255) NOT NULL,
        cpf VARCHAR(11),
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Ensure all columns exist (in case the table already existed under an older schema)
    await client.query('ALTER TABLE contributors ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);');
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();");

    console.log('[Contributors API] Table "contributors" verified or successfully created.');
  } catch (err) {
    console.error('[Contributors API] Database initialization could not be completed:', (err as Error).message);
  } finally {
    if (client) client.release();
  }
}

// Ensure database table setup executes upon initialization
initializeDatabase();

// GET /
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'contributors-api',
    status: 'running'
  });
});

// GET /health
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'contributors-api',
    version: '1.0.0'
  });
});

// POST /api/v1/contributors
app.post('/api/v1/contributors', async (req: Request, res: Response) => {
  try {
    const { church_id, canonical_name, cpf } = req.body;

    // UUID Pattern validation
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    if (!church_id || typeof church_id !== 'string' || !uuidRegex.test(church_id)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    if (!canonical_name || typeof canonical_name !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    // Sanitize canonical_name (trim, remove double spaces, upper case)
    const sanitizedName = canonical_name.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!sanitizedName) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    // CPF is optional
    let sanitizedCpf: string | null = null;
    if (cpf !== undefined && cpf !== null && cpf !== '') {
      if (typeof cpf !== 'string' && typeof cpf !== 'number') {
        return res.status(400).json({ error: 'VALIDATION_ERROR' });
      }
      sanitizedCpf = String(cpf).replace(/\D/g, '');
    }

    // If CPF was informed, check if there's already an active contributor under the same church_id with that CPF
    if (sanitizedCpf) {
      if (sanitizedCpf.length === 0) {
        return res.status(400).json({ error: 'VALIDATION_ERROR' });
      }
      
      const duplicateCheck = await pool.query(
        'SELECT id FROM contributors WHERE status = $1 AND cpf = $2 AND church_id = $3 LIMIT 1',
        ['active', sanitizedCpf, church_id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({ error: 'CPF_ALREADY_EXISTS' });
      }
    }

    // Insert contributor record, born as status 'active'
    const insertResult = await pool.query(
      'INSERT INTO contributors (church_id, canonical_name, cpf, status) VALUES ($1, $2, $3, $4) RETURNING id, canonical_name, cpf, status',
      [church_id, sanitizedName, sanitizedCpf, 'active']
    );

    const newContributor = insertResult.rows[0];

    return res.status(201).json({
      id: newContributor.id,
      canonical_name: newContributor.canonical_name,
      cpf: newContributor.cpf,
      status: newContributor.status
    });

  } catch (err) {
    console.error('[Contributors API] Error processing post contributors request:', err);
    const pgErr = err as any;
    // Postgres specific errors: e.g. syntax, invalid types, constraint violations
    if (pgErr.code === '22P02' || pgErr.code === '23502') {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[Contributors API] Server running on port ${PORT}`);
});
