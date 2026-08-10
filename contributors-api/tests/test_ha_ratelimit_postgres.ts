import express, { Request, Response } from 'express';
import { authRateLimiter, resetRateLimitStore } from '../auth/middlewares/auth.middleware.js';

class MockPgPool {
  public rowsMap = new Map<string, { key: string; count: number; reset_time: number }>();

  async query(sql: string, params?: any[]): Promise<any> {
    const trimmed = sql.trim();

    if (trimmed.includes('CREATE TABLE')) {
      return { rows: [] };
    }

    if (trimmed.includes('TRUNCATE TABLE') || trimmed.includes('DELETE FROM rate_limits')) {
      this.rowsMap.clear();
      return { rows: [] };
    }

    if (trimmed.includes('INSERT INTO rate_limits')) {
      const key = params![0];
      const resetTime = params![1];
      const now = params![2];

      let record = this.rowsMap.get(key);
      if (!record || record.reset_time <= now) {
        record = { key, count: 1, reset_time: resetTime };
      } else {
        record.count++;
      }
      this.rowsMap.set(key, record);

      return {
        rows: [{ count: record.count, reset_time: record.reset_time }]
      };
    }

    return { rows: [] };
  }
}

async function runHaRateLimitTest() {
  console.log('--- TESTANDO MIGRAÇÃO DO RATE LIMITER PARA POSTGRESQL MULTI-INSTÂNCIA (HA-04) ---');

  const sharedMockDb = new MockPgPool();

  // Instância 1 de IgGestor
  const limiterInstance1 = authRateLimiter({
    keyPrefix: 'login',
    windowMs: 15 * 60 * 1000,
    maxRequests: 3,
    message: 'Muitas tentativas de login. Por favor, aguarde alguns minutos e tente novamente.',
    pool: sharedMockDb
  });

  // Instância 2 de IgGestor
  const limiterInstance2 = authRateLimiter({
    keyPrefix: 'login',
    windowMs: 15 * 60 * 1000,
    maxRequests: 3,
    message: 'Muitas tentativas de login. Por favor, aguarde alguns minutos e tente novamente.',
    pool: sharedMockDb
  });

  const app1 = express();
  app1.post('/login', limiterInstance1, (req: Request, res: Response) => {
    res.status(200).json({ success: true });
  });

  const app2 = express();
  app2.post('/login', limiterInstance2, (req: Request, res: Response) => {
    res.status(200).json({ success: true });
  });

  const server1 = app1.listen(0);
  const server2 = app2.listen(0);

  const port1 = (server1.address() as any).port;
  const port2 = (server2.address() as any).port;

  try {
    const clientIp = '203.0.113.100';

    // Requisição 1 na Instância 1
    const r1 = await fetch(`http://127.0.0.1:${port1}/login`, {
      method: 'POST',
      headers: { 'x-forwarded-for': clientIp }
    });
    console.log('Req 1 (Instância 1) - Status:', r1.status, 'X-RateLimit-Remaining:', r1.headers.get('x-ratelimit-remaining'));

    // Requisição 2 na Instância 2
    const r2 = await fetch(`http://127.0.0.1:${port2}/login`, {
      method: 'POST',
      headers: { 'x-forwarded-for': clientIp }
    });
    console.log('Req 2 (Instância 2) - Status:', r2.status, 'X-RateLimit-Remaining:', r2.headers.get('x-ratelimit-remaining'));

    // Requisição 3 na Instância 1
    const r3 = await fetch(`http://127.0.0.1:${port1}/login`, {
      method: 'POST',
      headers: { 'x-forwarded-for': clientIp }
    });
    console.log('Req 3 (Instância 1) - Status:', r3.status, 'X-RateLimit-Remaining:', r3.headers.get('x-ratelimit-remaining'));

    // Requisição 4 na Instância 2 (Deve ser bloqueada com 429)
    const r4 = await fetch(`http://127.0.0.1:${port2}/login`, {
      method: 'POST',
      headers: { 'x-forwarded-for': clientIp }
    });
    const body4: any = await r4.json();
    console.log('Req 4 (Instância 2 - Bloqueio) - Status:', r4.status, 'Erro:', body4.error);

    const testPassed =
      r1.status === 200 && r1.headers.get('x-ratelimit-remaining') === '2' &&
      r2.status === 200 && r2.headers.get('x-ratelimit-remaining') === '1' &&
      r3.status === 200 && r3.headers.get('x-ratelimit-remaining') === '0' &&
      r4.status === 429 && body4.success === false;

    if (testPassed) {
      console.log('\n>>> SUCESSO: Duas instâncias compartilham a mesma contagem centralizada no PostgreSQL! <<<');
    } else {
      console.error('\n>>> FALHA: As instâncias não compartilharam a contagem do rate limiter! <<<');
      process.exit(1);
    }
  } finally {
    server1.close();
    server2.close();
  }
}

runHaRateLimitTest().catch(err => {
  console.error('Erro no teste de rate limit compartilhado:', err);
  process.exit(1);
});
