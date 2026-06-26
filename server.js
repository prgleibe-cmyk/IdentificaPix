import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                   process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                   process.env.SERVICE_ROLE_KEY ||
                   process.env.SUPABASE_SERVICE_KEY;

console.log(`[Server] Verificando variáveis de ambiente...`);
console.log(`[Server] Supabase Service Key: ${serviceKey ? 'Detectada (tamanho: ' + serviceKey.length + ')' : 'NÃO ENCONTRADA'}`);
console.log(`[Server] API_KEY: ${process.env.API_KEY ? 'Detectada' : 'NÃO ENCONTRADA'}`);
console.log(`[Server] ASAAS_API_KEY: ${process.env.ASAAS_API_KEY ? 'Detectada' : 'NÃO ENCONTRADA'}`);
console.log(`[Server] ASAAS_API_KEY_B64: ${process.env.ASAAS_API_KEY_B64 ? 'Detectada' : 'NÃO ENCONTRADA'}`);
console.log(`[Server] ASAAS_URL: ${process.env.ASAAS_URL || process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3'}`);

import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';

// Importação das rotas
import gmailRoutes from './backend/routes/gmail.js';
import paymentRoutes from './backend/routes/payments.js';
import aiRoutes from './backend/routes/ai.js';
import inboxRoutes from './backend/routes/inbox.js';
import usersRoutes from './backend/routes/users.js';
import referenceRoutes from './backend/routes/reference.js';
import { authMiddleware } from './backend/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Iniciando Contributors API em segundo plano
console.log(`[IdentificaPix] Iniciando Contributors API em segundo plano...`);
const childEnv = { ...process.env, PORT: '3010' };
if (childEnv.DATABASE_URL && !childEnv.DATABASE_URL.startsWith('postgres://') && !childEnv.DATABASE_URL.startsWith('postgresql://')) {
    console.warn(`[IdentificaPix] ATENÇÃO: DATABASE_URL inválido detectado ("${childEnv.DATABASE_URL.substring(0, 40)}..."). Removendo-o para segurança.`);
    delete childEnv.DATABASE_URL;
}
if (childEnv.DATABASE_PRIVATE_URL && !childEnv.DATABASE_PRIVATE_URL.startsWith('postgres://') && !childEnv.DATABASE_PRIVATE_URL.startsWith('postgresql://')) {
    delete childEnv.DATABASE_PRIVATE_URL;
}

const contributorsApi = spawn('npx', ['tsx', 'server.ts'], {
    cwd: path.join(__dirname, 'contributors-api'),
    stdio: 'inherit',
    env: childEnv
});

contributorsApi.on('error', (err) => {
    console.error('[IdentificaPix] Erro ao iniciar Contributors API:', err.message);
});

contributorsApi.on('exit', (code) => {
    console.log(`[IdentificaPix] Contributors API finalizado com código ${code}`);
});

const app = express();

// --- DIAGNÓSTICOS DE IMAGEM ---
const distPath = path.join(__dirname, 'dist');
const pwaPath = path.join(distPath, 'pwa');

console.log(`[IdentificaPix] Iniciando servidor...`);

if (fs.existsSync(distPath)) {
    const logoExists = fs.existsSync(path.join(distPath, 'logo.png'));
    const pwaExists = fs.existsSync(pwaPath);
    console.log(`[Server] logo.png em dist: ${logoExists ? '✅' : '❌'}`);
    console.log(`[Server] pasta pwa em dist: ${pwaExists ? '✅' : '❌'}`);
    if (pwaExists) {
        console.log(`[Server] Arquivos PWA: ${fs.readdirSync(pwaPath).join(', ')}`);
    }
}

// Middlewares
app.use(cors());

// Condicional para aplicar express.json exceto em rotas /api/inbox (que possuem um parser resiliente próprio para evitar erros do MacroDroid)
app.use((req, res, next) => {
    if (req.path.startsWith('/api/inbox')) {
        return next();
    }
    express.json({ limit: '50mb' })(req, res, next);
});

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Inicialização da IA Gemini
let ai = null;
const geminiKey = process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;

if (geminiKey) {
    try {
        ai = new GoogleGenAI({ apiKey: geminiKey });
        console.log("[IdentificaPix] Gemini AI Initialized.");
    } catch (e) {
        console.error("[IdentificaPix] AI Init Error:", e.message);
    }
}

// Registro de Rotas
try {
    // Rotas públicas ou de webhook (devem vir ANTES do authMiddleware)
    app.use('/api/payment', paymentRoutes);
    app.use('/api/inbox', inboxRoutes(ai));
    app.use('/api/ai', aiRoutes(ai));

    // Endpoint de migração administrativa do Supabase para o Postgres do VPS
    app.get('/api/admin/migrate-supabase-to-postgres', async (req, res) => {
        const { Pool } = pg;
        const supabaseUrl = 'https://uflheoknbopcgmzyjbft.supabase.co';
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.SERVICE_ROLE_KEY ||
                               process.env.SUPABASE_SERVICE_KEY;

        if (!serviceRoleKey) {
            return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" });
        }

        const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

        const rawConnectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING;
        const isValidConnectionString = typeof rawConnectionString === 'string' && 
          (rawConnectionString.startsWith('postgres://') || rawConnectionString.startsWith('postgresql://'));

        const connectionString = isValidConnectionString ? rawConnectionString : null;

        let pgPool;

        if (connectionString) {
          pgPool = new Pool({
            connectionString,
            ssl: connectionString.includes('supabase') || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
          });
        } else {
          pgPool = new Pool({
            host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
            port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
            user: process.env.PGUSER || process.env.DB_USER || 'postgres',
            password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
            database: process.env.PGDATABASE || process.env.DB_DATABASE || 'contributors',
          });
        }

        const stats = {
            banks: 0,
            churches: 0,
            learned_associations: 0,
            saved_reports: 0,
            consolidated_transactions: 0
        };

        let pgClient;
        try {
            pgClient = await pgPool.connect();

            // Helper to fetch all rows paginated from Supabase
            const fetchAll = async (table) => {
              let allData = [];
              let from = 0;
              const pageSize = 1000;
              while (true) {
                const { data, error } = await supabaseClient.from(table).select('*').range(from, from + pageSize - 1);
                if (error) throw error;
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
              `, [bank.id, bank.name, bank.user_id, bank.bank_key || null, bank.account_name || bank.name, bank.created_at || new Date()]);
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
              `, [church.id, church.name, church.address || '', church.logoUrl || '', church.pastor || '', church.user_id, church.created_at || new Date()]);
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
              `, [assoc.id, assoc.user_id, assoc.normalized_description, assoc.contributor_normalized_name, assoc.church_id, assoc.created_at || new Date()]);
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
              `, [report.id, report.name, report.record_count || 0, report.user_id, typeof report.data === 'string' ? report.data : JSON.stringify(report.data), report.church_id || null, report.created_at || new Date()]);
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
              `, [tx.id, tx.amount, tx.description, tx.type, tx.pix_key || null, tx.source || 'file', tx.user_id, tx.status || 'pending', tx.bank_id || null, tx.row_hash || null, tx.is_confirmed !== undefined ? tx.is_confirmed : false, tx.transaction_date, tx.created_at || new Date()]);
              stats.consolidated_transactions++;
            }

            return res.json({ success: true, message: "Migração executada com sucesso", stats });
        } catch (err) {
            console.error("Erro na migração:", err);
            return res.status(500).json({ success: false, error: err.message });
        } finally {
            if (pgClient) pgClient.release();
            await pgPool.end();
        }
    });

    // Proxy para o Contributors API (PG + VPS)
    app.all('/api/v1/*', async (req, res) => {
        try {
            const baseUrl = process.env.CONTRIBUTORS_API_URL || 'http://127.0.0.1:3010';
            const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            const targetUrl = `${cleanBaseUrl}${req.originalUrl}`;
            
            console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} to ${targetUrl}`);
            
            // Extrair o hostname correto de destino para evitar rejeição de cabeçalhos
            const urlObj = new URL(targetUrl);
            const targetHost = urlObj.host;

            // Limpar e sanitizar cabeçalhos para evitar erros no fetch (como incompatibilidade de content-length ou host)
            const cleanHeaders = {};
            const excludedHeaders = ['content-length', 'connection', 'host', 'keep-alive', 'transfer-encoding', 'accept-encoding'];
            for (const [key, value] of Object.entries(req.headers)) {
                if (!excludedHeaders.includes(key.toLowerCase())) {
                    cleanHeaders[key] = value;
                }
            }
            cleanHeaders['host'] = targetHost;

            const fetchOptions = {
                method: req.method,
                headers: cleanHeaders
            };

            if (req.method !== 'GET' && req.method !== 'HEAD') {
                fetchOptions.body = JSON.stringify(req.body);
                cleanHeaders['content-type'] = 'application/json';
            }

            let response;
            try {
                // Adiciona timeout rápido (1500ms) para evitar que a requisição fique travada 
                // caso o domínio do microserviço na VPS esteja inacessível no ambiente local.
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500);

                response = await fetch(targetUrl, {
                    ...fetchOptions,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
            } catch (fetchErr) {
                console.warn(`[Proxy Warning] Direct forward to ${targetUrl} failed or timed out: ${fetchErr.message}. Trying local fallback on http://127.0.0.1:3010...`);
                // Fallback para o processo local em segundo plano
                const localUrl = `http://127.0.0.1:3010${req.originalUrl}`;
                response = await fetch(localUrl, fetchOptions);
            }

            const data = await response.json().catch(() => null);

            res.status(response.status).json(data || { error: 'Invalid Response from contributors-api' });
        } catch (error) {
            console.error(`[Proxy Error] Fail to forward to contributors-api:`, error.message);
            res.status(500).json({ error: 'CONTRIBUTORS_API_UNAVAILABLE' });
        }
    });

    // Middleware de Autenticação para as demais rotas
    app.use('/api', authMiddleware);
    
    // Rotas protegidas
    app.use('/api/gmail', gmailRoutes(ai));
    app.use('/api/users', usersRoutes());
    app.use('/api/reference', referenceRoutes());
} catch (error) {
    console.error("[IdentificaPix] Route Registration Error:", error.message);
}

// Pasta de arquivos estáticos
app.use(express.static(distPath));

// SPA Fallback
app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'Not Found' });
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(200).send("IdentificaPix Server Active.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IdentificaPix] Rodando em http://0.0.0.0:${PORT}`);
});