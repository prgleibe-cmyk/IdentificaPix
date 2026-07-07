import express, { Request, Response } from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

export const app = express();
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
        email VARCHAR(255),
        phone VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Ensure all columns exist (in case the table already existed under an older schema)
    await client.query('ALTER TABLE contributors ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);');
    await client.query('ALTER TABLE contributors ADD COLUMN IF NOT EXISTS email VARCHAR(255);');
    await client.query('ALTER TABLE contributors ADD COLUMN IF NOT EXISTS phone VARCHAR(50);');
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();");
    await client.query("ALTER TABLE contributors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();");
    console.log('[Contributors API] Table "contributors" verified or successfully created.');

    // Create table banks
    await client.query(`
      CREATE TABLE IF NOT EXISTS banks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        user_id UUID,
        bank_key VARCHAR(255),
        account_name VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS bank_key VARCHAR(255);');
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);');
    await client.query('ALTER TABLE banks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "banks" verified or successfully created.');

    // Create table churches
    await client.query(`
      CREATE TABLE IF NOT EXISTS churches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        "logoUrl" TEXT NOT NULL,
        pastor VARCHAR(255) NOT NULL,
        user_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS address TEXT;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS pastor VARCHAR(255);');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE churches ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "churches" verified or successfully created.');

    // Create table consolidated_transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS consolidated_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        amount NUMERIC(12, 2) NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        pix_key VARCHAR(255),
        source VARCHAR(50) NOT NULL DEFAULT 'file',
        user_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        bank_id UUID,
        row_hash VARCHAR(255),
        is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        transaction_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS description TEXT;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(50);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255);');
    await client.query("ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'file';");
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query("ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';");
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS bank_id UUID;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS row_hash VARCHAR(255);');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT FALSE;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS contributor_id UUID;');
    await client.query('ALTER TABLE consolidated_transactions ADD COLUMN IF NOT EXISTS report_id VARCHAR(255);');
    console.log('[Contributors API] Table "consolidated_transactions" verified or successfully created.');

    // Create table learned_associations
    await client.query(`
      CREATE TABLE IF NOT EXISTS learned_associations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        normalized_description TEXT NOT NULL,
        contributor_normalized_name VARCHAR(255) NOT NULL,
        church_id UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS normalized_description TEXT;');
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS contributor_normalized_name VARCHAR(255);');
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE learned_associations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "learned_associations" verified or successfully created.');

    // Create table saved_reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_reports (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        name VARCHAR(255) NOT NULL,
        record_count INT NOT NULL DEFAULT 0,
        user_id UUID NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    try {
      // Remover valor padrão para permitir alteração de UUID para VARCHAR
      await client.query('ALTER TABLE saved_reports ALTER COLUMN id DROP DEFAULT;');
      await client.query('ALTER TABLE saved_reports ALTER COLUMN id TYPE VARCHAR(255) USING id::varchar;');
      await client.query('ALTER TABLE saved_reports ALTER COLUMN id SET DEFAULT gen_random_uuid()::varchar;');
      console.log('[Contributors API] Altered saved_reports.id to VARCHAR(255) successfully.');
    } catch (alterErr) {
      console.warn('[Contributors API] Warning: could not alter saved_reports.id to VARCHAR, attempting fallback default update:', (alterErr as any).message);
      try {
        await client.query('ALTER TABLE saved_reports ALTER COLUMN id SET DEFAULT gen_random_uuid()::varchar;');
      } catch (fallbackErr) {
        // Ignora erro no fallback de default
      }
    }
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS record_count INT DEFAULT 0;');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS data JSONB;');
    await client.query('ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "saved_reports" verified or successfully created.');

    // Create table financial_records
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        church_id UUID,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        amount NUMERIC(12, 2) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        recipient_name VARCHAR(255),
        recipient_type VARCHAR(50),
        due_date TIMESTAMP,
        payment_date TIMESTAMP,
        recurrence VARCHAR(50) DEFAULT 'none',
        parent_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS user_id UUID;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS church_id UUID;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS title VARCHAR(255);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS description TEXT;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS type VARCHAR(50);');
    await client.query("ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';");
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;');
    await client.query("ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS recurrence VARCHAR(50) DEFAULT 'none';");
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS parent_id UUID;');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS bank_transaction_id VARCHAR(255);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS bank_transaction_desc VARCHAR(255);');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();');
    await client.query('ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();');
    console.log('[Contributors API] Table "financial_records" verified or successfully created.');

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

// GET /api/v1/contributors
app.get('/api/v1/contributors', async (req: Request, res: Response) => {
  try {
    const { church_id, status } = req.query;
    let query = 'SELECT id, church_id, canonical_name, cpf, email, phone, status, created_at, updated_at FROM contributors WHERE 1=1';
    const params: any[] = [];
    let paramCounter = 1;

    if (church_id && typeof church_id === 'string') {
      query += ` AND church_id = $${paramCounter}`;
      params.push(church_id);
      paramCounter++;
    }

    if (status && typeof status === 'string') {
      query += ` AND status = $${paramCounter}`;
      params.push(status);
      paramCounter++;
    }

    query += ' ORDER BY canonical_name ASC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error processing get contributors request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/contributors
app.post('/api/v1/contributors', async (req: Request, res: Response) => {
  try {
    const { church_id, canonical_name, cpf, email, phone, status } = req.body;

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

    // Email, phone and status normalization
    const sanitizedEmail = email && typeof email === 'string' ? email.trim() : null;
    const sanitizedPhone = phone && typeof phone === 'string' ? phone.trim() : null;
    const sanitizedStatus = status === 'inactive' ? 'inactive' : 'active';

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

    // Insert contributor record
    const insertResult = await pool.query(
      'INSERT INTO contributors (church_id, canonical_name, cpf, email, phone, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, canonical_name, cpf, email, phone, status',
      [church_id, sanitizedName, sanitizedCpf, sanitizedEmail, sanitizedPhone, sanitizedStatus]
    );

    const newContributor = insertResult.rows[0];

    return res.status(201).json({
      id: newContributor.id,
      canonical_name: newContributor.canonical_name,
      cpf: newContributor.cpf,
      email: newContributor.email,
      phone: newContributor.phone,
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

// PUT /api/v1/contributors/:id
app.put('/api/v1/contributors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { church_id, canonical_name, cpf, email, phone, status } = req.body;

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    const updates: string[] = [];
    const params: any[] = [id];
    let counter = 2;

    if (church_id !== undefined) {
      if (!uuidRegex.test(church_id)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR' });
      }
      updates.push(`church_id = $${counter}`);
      params.push(church_id);
      counter++;
    }

    if (canonical_name !== undefined) {
      if (typeof canonical_name !== 'string' || !canonical_name.trim()) {
        return res.status(400).json({ error: 'VALIDATION_ERROR' });
      }
      const sanitizedName = canonical_name.trim().replace(/\s+/g, ' ').toUpperCase();
      updates.push(`canonical_name = $${counter}`);
      params.push(sanitizedName);
      counter++;
    }

    if (cpf !== undefined) {
      const sanitizedCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
      updates.push(`cpf = $${counter}`);
      params.push(sanitizedCpf);
      counter++;
    }

    if (email !== undefined) {
      const sanitizedEmail = email && typeof email === 'string' ? email.trim() : null;
      updates.push(`email = $${counter}`);
      params.push(sanitizedEmail);
      counter++;
    }

    if (phone !== undefined) {
      const sanitizedPhone = phone && typeof phone === 'string' ? phone.trim() : null;
      updates.push(`phone = $${counter}`);
      params.push(sanitizedPhone);
      counter++;
    }

    if (status !== undefined) {
      const sanitizedStatus = status === 'inactive' ? 'inactive' : 'active';
      updates.push(`status = $${counter}`);
      params.push(sanitizedStatus);
      counter++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'NO_UPDATES_PROVIDED' });
    }

    updates.push(`updated_at = NOW()`);

    const query = `UPDATE contributors SET ${updates.join(', ')} WHERE id = $1 RETURNING id, church_id, canonical_name, cpf, email, phone, status`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error processing put contributor request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/contributors/:id
app.delete('/api/v1/contributors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hardDelete = req.query.hard === 'true';
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    let result;
    if (hardDelete) {
      // 1. Unlink in consolidated_transactions inside PostgreSQL VPS
      await pool.query(
        "UPDATE consolidated_transactions SET contributor_id = NULL WHERE contributor_id = $1",
        [id]
      );

      // 2. Clear from learned_associations inside PostgreSQL VPS by matching contributor's normalized name
      const nameResult = await pool.query("SELECT name FROM contributors WHERE id = $1", [id]);
      if (nameResult.rows.length > 0) {
        const contributorName = nameResult.rows[0].name;
        await pool.query(
          "DELETE FROM learned_associations WHERE LOWER(contributor_normalized_name) = LOWER($1)",
          [contributorName]
        );
      }

      // 3. Delete from contributors table on VPS
      result = await pool.query(
        "DELETE FROM contributors WHERE id = $1 RETURNING id",
        [id]
      );
    } else {
      // Instead of hard deleting, we soft delete by updating status to 'inactive'
      result = await pool.query(
        "UPDATE contributors SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING id",
        [id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    return res.json({ success: true, id: id, hard: hardDelete });
  } catch (err) {
    console.error('[Contributors API] Error processing delete contributor request:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// BANKS ENDPOINTS
// ==========================================

// GET /api/v1/banks
app.get('/api/v1/banks', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    let query = 'SELECT id, name, user_id, bank_key, account_name, created_at FROM banks WHERE 1=1';
    const params: any[] = [];
    if (user_id) {
      query += ' AND user_id = $1';
      params.push(user_id);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET banks:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/banks
app.post('/api/v1/banks', async (req: Request, res: Response) => {
  try {
    const { name, user_id, bank_key, account_name } = req.body;
    if (!name || !user_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const result = await pool.query(
      'INSERT INTO banks (name, user_id, bank_key, account_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, user_id, bank_key || null, account_name || name]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST bank:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/banks/:id
app.put('/api/v1/banks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, bank_key, account_name } = req.body;
    const result = await pool.query(
      'UPDATE banks SET name = COALESCE($1, name), bank_key = COALESCE($2, bank_key), account_name = COALESCE($3, account_name) WHERE id = $4 RETURNING *',
      [name, bank_key || null, account_name || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error PUT bank:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/banks/:id
app.delete('/api/v1/banks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM banks WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE bank:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// CHURCHES ENDPOINTS
// ==========================================

// GET /api/v1/churches
app.get('/api/v1/churches', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    let query = 'SELECT id, name, address, "logoUrl", pastor, user_id, created_at FROM churches WHERE 1=1';
    const params: any[] = [];
    if (user_id) {
      query += ' AND user_id = $1';
      params.push(user_id);
    }
    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET churches:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/churches
app.post('/api/v1/churches', async (req: Request, res: Response) => {
  try {
    const { name, address, logoUrl, pastor, user_id } = req.body;
    if (!name || !user_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const result = await pool.query(
      'INSERT INTO churches (name, address, "logoUrl", pastor, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, address || '', logoUrl || '', pastor || '', user_id]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST church:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/churches/:id
app.put('/api/v1/churches/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, logoUrl, pastor } = req.body;
    const result = await pool.query(
      'UPDATE churches SET name = COALESCE($1, name), address = COALESCE($2, address), "logoUrl" = COALESCE($3, "logoUrl"), pastor = COALESCE($4, pastor) WHERE id = $5 RETURNING *',
      [name, address, logoUrl, pastor, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error PUT church:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/churches/:id
app.delete('/api/v1/churches/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM churches WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE church:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// LEARNED ASSOCIATIONS ENDPOINTS
// ==========================================

// GET /api/v1/learned_associations
app.get('/api/v1/learned_associations', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    let query = 'SELECT id, user_id, normalized_description, contributor_normalized_name, church_id, created_at FROM learned_associations WHERE 1=1';
    const params: any[] = [];
    if (user_id) {
      query += ' AND user_id = $1';
      params.push(user_id);
    }
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET learned associations:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/learned_associations
app.post('/api/v1/learned_associations', async (req: Request, res: Response) => {
  try {
    const { user_id, normalized_description, contributor_normalized_name, church_id } = req.body;
    if (!user_id || !normalized_description || !contributor_normalized_name || !church_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    // Check if duplicate
    const checkResult = await pool.query(
      'SELECT id FROM learned_associations WHERE user_id = $1 AND normalized_description = $2 LIMIT 1',
      [user_id, normalized_description]
    );

    let result;
    if (checkResult.rows.length > 0) {
      // Update
      result = await pool.query(
        'UPDATE learned_associations SET contributor_normalized_name = $1, church_id = $2 WHERE id = $3 RETURNING *',
        [contributor_normalized_name, church_id, checkResult.rows[0].id]
      );
    } else {
      // Insert
      result = await pool.query(
        'INSERT INTO learned_associations (user_id, normalized_description, contributor_normalized_name, church_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [user_id, normalized_description, contributor_normalized_name, church_id]
      );
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST learned associations:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/learned_associations/:id
app.delete('/api/v1/learned_associations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM learned_associations WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE learned association:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/learned_associations/by-user/:user_id
app.delete('/api/v1/learned_associations/by-user/:user_id', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query('DELETE FROM learned_associations WHERE user_id = $1 RETURNING id', [user_id]);
    return res.json({ success: true, count: result.rows.length });
  } catch (err) {
    console.error('[Contributors API] Error DELETE learned associations by user:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// SAVED REPORTS ENDPOINTS
// ==========================================

// GET /api/v1/saved_reports
app.get('/api/v1/saved_reports', async (req: Request, res: Response) => {
  try {
    const { user_id, exclude_data } = req.query;
    let selectFields = 'id, name, record_count, user_id, church_id, created_at';
    if (exclude_data !== 'true') {
      selectFields += ', data';
    }
    let query = `SELECT ${selectFields} FROM saved_reports WHERE 1=1`;
    const params: any[] = [];
    if (user_id) {
      query += ' AND user_id = $1';
      params.push(user_id);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET saved reports:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/saved_reports
app.post('/api/v1/saved_reports', async (req: Request, res: Response) => {
  try {
    const { id, name, record_count, user_id, data, church_id } = req.body;
    if (!name || !user_id || !data) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }
    const finalId = id || undefined;
    const finalData = typeof data === 'string' ? data : JSON.stringify(data);
    let result;
    if (finalId) {
      result = await pool.query(
        `INSERT INTO saved_reports (id, name, record_count, user_id, data, church_id) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           record_count = EXCLUDED.record_count,
           data = EXCLUDED.data,
           church_id = EXCLUDED.church_id
         RETURNING *`,
         [finalId, name, record_count || 0, user_id, finalData, church_id || null]
      );
    } else {
      result = await pool.query(
        'INSERT INTO saved_reports (name, record_count, user_id, data, church_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, record_count || 0, user_id, finalData, church_id || null]
      );
    }
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST saved reports:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// PUT /api/v1/saved_reports/:id
app.put('/api/v1/saved_reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, data, record_count, church_id } = req.body;
    let query = 'UPDATE saved_reports SET ';
    const params: any[] = [];
    let counter = 1;

    const fields = [];
    if (name !== undefined) {
      fields.push(`name = $${counter}`);
      params.push(name);
      counter++;
    }
    if (data !== undefined) {
      fields.push(`data = $${counter}`);
      params.push(typeof data === 'string' ? data : JSON.stringify(data));
      counter++;
    }
    if (record_count !== undefined) {
      fields.push(`record_count = $${counter}`);
      params.push(Number(record_count));
      counter++;
    }
    if (church_id !== undefined) {
      fields.push(`church_id = $${counter}`);
      params.push(church_id);
      counter++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' });
    }

    query += fields.join(', ');
    query += ` WHERE id = $${counter} RETURNING *`;
    params.push(id);

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error PUT saved report:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/saved_reports/:id
app.delete('/api/v1/saved_reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM saved_reports WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE saved report:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// ==========================================
// CONSOLIDATED TRANSACTIONS ENDPOINTS
// ==========================================

// GET /api/v1/consolidated_transactions
app.get('/api/v1/consolidated_transactions', async (req: Request, res: Response) => {
  try {
    const { user_id, status, type, start_date, end_date, limit, offset, row_hash, ids } = req.query;
    let query = 'SELECT id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, created_at, church_id, contributor_id, report_id FROM consolidated_transactions WHERE 1=1';
    const params: any[] = [];
    let counter = 1;

    if (ids) {
      const idsArray = (ids as string).split(',');
      query += ` AND id = ANY($${counter})`;
      params.push(idsArray);
      counter++;
    }

    if (user_id) {
      query += ` AND user_id = $${counter}`;
      params.push(user_id);
      counter++;
    }

    if (status) {
      query += ` AND status = $${counter}`;
      params.push(status);
      counter++;
    }

    if (type) {
      query += ` AND type = $${counter}`;
      params.push(type);
      counter++;
    }

    if (row_hash) {
      query += ` AND row_hash = $${counter}`;
      params.push(row_hash);
      counter++;
    }

    if (start_date) {
      query += ` AND transaction_date >= $${counter}`;
      params.push(start_date);
      counter++;
    }

    if (end_date) {
      query += ` AND transaction_date <= $${counter}`;
      params.push(end_date);
      counter++;
    }

    query += ' ORDER BY transaction_date DESC';

    if (limit) {
      query += ` LIMIT $${counter}`;
      params.push(Number(limit));
      counter++;
    }

    if (offset) {
      query += ` OFFSET $${counter}`;
      params.push(Number(offset));
      counter++;
    }

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[Contributors API] Error GET consolidated_transactions:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/consolidated_transactions
app.post('/api/v1/consolidated_transactions', async (req: Request, res: Response) => {
  try {
    const { id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id } = req.body;
    if (amount === undefined || amount === null || !description || !type || !user_id || !transaction_date) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    // Check row_hash duplicate if row_hash is provided
    if (row_hash) {
      const dupCheck = await pool.query('SELECT id FROM consolidated_transactions WHERE user_id = $1 AND row_hash = $2 LIMIT 1', [user_id, row_hash]);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'ROW_HASH_ALREADY_EXISTS', id: dupCheck.rows[0].id });
      }
    }

    const finalId = id || undefined;
    let query = '';
    let params: any[] = [];
    if (finalId) {
      query = `INSERT INTO consolidated_transactions 
        (id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
        ON CONFLICT (id) DO UPDATE SET 
          amount = EXCLUDED.amount, 
          description = EXCLUDED.description, 
          status = EXCLUDED.status, 
          is_confirmed = EXCLUDED.is_confirmed,
          bank_id = EXCLUDED.bank_id,
          church_id = EXCLUDED.church_id,
          contributor_id = EXCLUDED.contributor_id,
          report_id = EXCLUDED.report_id
        RETURNING *`;
      params = [finalId, amount, description, type, pix_key || null, source || 'file', user_id, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, church_id || null, contributor_id || null, report_id || null];
    } else {
      query = `INSERT INTO consolidated_transactions 
        (amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`;
      params = [amount, description, type, pix_key || null, source || 'file', user_id, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, church_id || null, contributor_id || null, report_id || null];
    }

    const result = await pool.query(query, params);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error POST consolidated_transaction:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/consolidated_transactions/bulk
app.post('/api/v1/consolidated_transactions/bulk', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: Transactions array is required' });
    }

    await client.query('BEGIN');
    const inserted: any[] = [];

    for (const tx of transactions) {
      const { id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id } = tx;
      
      const finalId = id || undefined;
      let query = '';
      let params: any[] = [];
      if (finalId) {
        query = `INSERT INTO consolidated_transactions 
          (id, amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
          ON CONFLICT (id) DO UPDATE SET 
            amount = EXCLUDED.amount, 
            description = EXCLUDED.description, 
            status = EXCLUDED.status, 
            is_confirmed = EXCLUDED.is_confirmed,
            bank_id = EXCLUDED.bank_id,
            church_id = EXCLUDED.church_id,
            contributor_id = EXCLUDED.contributor_id,
            report_id = EXCLUDED.report_id
          RETURNING *`;
        params = [finalId, amount, description, type, pix_key || null, source || 'file', user_id, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, church_id || null, contributor_id || null, report_id || null];
      } else {
        query = `INSERT INTO consolidated_transactions 
          (amount, description, type, pix_key, source, user_id, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`;
        params = [amount, description, type, pix_key || null, source || 'file', user_id, status || 'pending', bank_id || null, row_hash || null, is_confirmed || false, transaction_date, church_id || null, contributor_id || null, report_id || null];
      }

      const result = await client.query(query, params);
      inserted.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return res.status(201).json(inserted);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Contributors API] Error POST bulk consolidated_transactions:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// PUT /api/v1/consolidated_transactions/:id
app.put('/api/v1/consolidated_transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, description, type, pix_key, source, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id } = req.body;
    
    const result = await pool.query(
      `UPDATE consolidated_transactions SET 
        amount = COALESCE($1, amount), 
        description = COALESCE($2, description), 
        type = COALESCE($3, type), 
        pix_key = COALESCE($4, pix_key), 
        source = COALESCE($5, source), 
        status = COALESCE($6, status), 
        bank_id = COALESCE($7, bank_id), 
        row_hash = COALESCE($8, row_hash), 
        is_confirmed = COALESCE($9, is_confirmed), 
        transaction_date = COALESCE($10, transaction_date),
        church_id = COALESCE($11, church_id),
        contributor_id = COALESCE($12, contributor_id),
        report_id = COALESCE($13, report_id)
      WHERE id = $14 RETURNING *`,
      [amount, description, type, pix_key, source, status, bank_id, row_hash, is_confirmed, transaction_date, church_id, contributor_id, report_id, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Contributors API] Error PUT consolidated_transaction:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// DELETE /api/v1/consolidated_transactions/:id
app.delete('/api/v1/consolidated_transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM consolidated_transactions WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('[Contributors API] Error DELETE consolidated_transaction:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// POST /api/v1/consolidated_transactions/bulk-delete
app.post('/api/v1/consolidated_transactions/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: ids array is required' });
    }
    const result = await pool.query('DELETE FROM consolidated_transactions WHERE id = ANY($1) RETURNING id', [ids]);
    return res.json({ success: true, count: result.rows.length });
  } catch (err) {
    console.error('[Contributors API] Error POST bulk-delete consolidated_transactions:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

// GET /api/v1/financial_records
app.get('/api/v1/financial_records', async (req: Request, res: Response) => {
  try {
    const { user_id, church_id, type, status } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id is required' });
    }

    let query = 'SELECT * FROM financial_records WHERE user_id = $1';
    const params: any[] = [user_id];
    let count = 2;

    if (church_id) {
      query += ` AND church_id = $${count}`;
      params.push(church_id);
      count++;
    }
    if (type) {
      query += ` AND type = $${count}`;
      params.push(type);
      count++;
    }
    if (status) {
      query += ` AND status = $${count}`;
      params.push(status);
      count++;
    }

    query += ' ORDER BY due_date ASC, created_at DESC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('[Contributors API] Error GET financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// POST /api/v1/financial_records
app.post('/api/v1/financial_records', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      church_id,
      title,
      description,
      amount,
      type,
      status,
      recipient_name,
      recipient_type,
      due_date,
      payment_date,
      recurrence,
      parent_id,
      bank_transaction_id,
      bank_transaction_desc
    } = req.body;

    if (!user_id || !title || amount === undefined || !type) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: user_id, title, amount, and type are required' });
    }

    const result = await pool.query(
      `INSERT INTO financial_records (
        user_id, church_id, title, description, amount, type, status, 
        recipient_name, recipient_type, due_date, payment_date, recurrence, parent_id,
        bank_transaction_id, bank_transaction_desc
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        user_id,
        church_id || null,
        title,
        description || '',
        amount,
        type,
        status || 'pending',
        recipient_name || '',
        recipient_type || 'supplier',
        due_date || null,
        payment_date || null,
        recurrence || 'none',
        parent_id || null,
        bank_transaction_id || null,
        bank_transaction_desc || null
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error POST financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// PUT /api/v1/financial_records/:id
app.put('/api/v1/financial_records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      church_id,
      title,
      description,
      amount,
      type,
      status,
      recipient_name,
      recipient_type,
      due_date,
      payment_date,
      recurrence,
      parent_id,
      bank_transaction_id,
      bank_transaction_desc
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let placeholderIndex = 1;

    const fields = [
      { name: 'church_id', value: church_id },
      { name: 'title', value: title },
      { name: 'description', value: description },
      { name: 'amount', value: amount },
      { name: 'type', value: type },
      { name: 'status', value: status },
      { name: 'recipient_name', value: recipient_name },
      { name: 'recipient_type', value: recipient_type },
      { name: 'due_date', value: due_date },
      { name: 'payment_date', value: payment_date },
      { name: 'recurrence', value: recurrence },
      { name: 'parent_id', value: parent_id },
      { name: 'bank_transaction_id', value: bank_transaction_id },
      { name: 'bank_transaction_desc', value: bank_transaction_desc }
    ];

    fields.forEach(f => {
      if (f.value !== undefined) {
        updates.push(`${f.name} = $${placeholderIndex}`);
        values.push(f.value);
        placeholderIndex++;
      }
    });

    if (updates.length === 0) {
      updates.push('updated_at = NOW()');
    } else {
      updates.push('updated_at = NOW()');
    }

    values.push(id);
    const query = `UPDATE financial_records SET ${updates.join(', ')} WHERE id = $${placeholderIndex} RETURNING *`;
    
    const result = await pool.query(query, values);

    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[Contributors API] Error PUT financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// DELETE /api/v1/financial_records/:id
app.delete('/api/v1/financial_records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM financial_records WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error('[Contributors API] Error DELETE financial_records:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// GET /api/v1/admin/migrate-supabase-to-postgres
app.get('/api/v1/admin/migrate-supabase-to-postgres', async (req: Request, res: Response) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.SERVICE_ROLE_KEY ||
                     process.env.SUPABASE_SERVICE_KEY;

  if (!serviceKey) {
    return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured in environment" });
  }

  const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
  const stats = {
    banks: 0,
    churches: 0,
    learned_associations: 0,
    saved_reports: 0,
    consolidated_transactions: 0
  };

  let pgClient;
  try {
    pgClient = await pool.connect();

    // Helper to fetch all rows paginated from Supabase REST API
    const fetchAll = async (table: string) => {
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const url = `${supabaseUrl}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${from}`;
        const response = await fetch(url, {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          }
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Failed to fetch ${table} from Supabase: ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allData;
    };

    // 1. Banks
    const banks = await fetchAll('banks');
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
      stats.banks++;
    }

    // 2. Churches
    const churches = await fetchAll('churches');
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
      stats.churches++;
    }

    // 3. Learned Associations
    const associations = await fetchAll('learned_associations');
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
      stats.learned_associations++;
    }

    // 4. Saved Reports
    const savedReports = await fetchAll('saved_reports');
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
      stats.saved_reports++;
    }

    // 5. Consolidated Transactions
    const transactions = await fetchAll('consolidated_transactions');
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
      stats.consolidated_transactions++;
    }

    return res.json({ success: true, message: "Migração executada com sucesso no Postgres do VPS", stats });
  } catch (err: any) {
    console.error('[Contributors API] Error running migration:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  } finally {
    if (pgClient) pgClient.release();
  }
});

if (process.env.INTEGRATED_MODE !== 'true') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Contributors API] Server running on port ${PORT}`);
  });
} else {
  console.log(`[Contributors API] Modo integrado ativo. O servidor Express principal lidará com as requisições.`);
}
