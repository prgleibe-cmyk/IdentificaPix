import express, { Request, Response } from 'express';
import { authRateLimiter, resetRateLimitStore } from '../auth/middlewares/auth.middleware.js';

async function runEtapa6Tests() {
  console.log('--- EXECUTANDO BATERIA DE TESTES DA ETAPA 6 — RATE LIMITING E PROTEÇÃO DE BORDA ---');

  // Reset any store state before starting
  resetRateLimitStore();

  // Set test environment rate limit configuration
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = '1000'; // 1 second window for quick test expiration
  process.env.RATE_LIMIT_LOGIN_MAX = '3'; // Limit to 3 login attempts
  process.env.RATE_LIMIT_SIGNUP_MAX = '2'; // Limit to 2 signup attempts

  // Create test express app
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  const loginLimiter = authRateLimiter({ keyPrefix: 'login', windowMs: 1000, maxRequests: 3, message: 'Muitas tentativas de login. Aguarde.' });
  const signupLimiter = authRateLimiter({ keyPrefix: 'signup', windowMs: 1000, maxRequests: 2, message: 'Muitas tentativas de criação de conta.' });

  app.post('/api/v1/auth/login', loginLimiter, (req: Request, res: Response) => {
    res.status(401).json({ success: false, error: 'E-mail ou senha incorretos.' });
  });

  app.post('/api/v1/auth/signup', signupLimiter, (req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'Usuário registrado com sucesso.' });
  });

  app.get('/api/v1/contributors', (req: Request, res: Response) => {
    res.status(200).json({ success: true, data: [] });
  });

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // -------------------------------------------------------------
    // TESTE 1: Requisições dentro do limite
    // -------------------------------------------------------------
    console.log('\n[TESTE 1] Testando requisições legítimas dentro do limite (Max: 3)');
    const res1 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
      body: JSON.stringify({ email: 'user@test.com', password: 'wrongpassword' })
    });

    const hasLimitHeader = res1.headers.has('x-ratelimit-limit');
    const hasRemainingHeader = res1.headers.has('x-ratelimit-remaining');
    console.log('[TESTE 1] Status da primeira tentativa:', res1.status);
    console.log('[TESTE 1] Headers X-RateLimit presentes:', hasLimitHeader && hasRemainingHeader);

    const test1Passed = res1.status === 401 && hasLimitHeader && hasRemainingHeader;
    console.log('[TESTE 1] Passou:', test1Passed);

    // -------------------------------------------------------------
    // TESTE 2: Disparo de HTTP 429 após exceder o limite de login
    // -------------------------------------------------------------
    console.log('\n[TESTE 2] Testando bloqueio por brute force (Excedendo o limite de 3 tentativas)');
    
    // Attempt 2
    await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50' }
    });

    // Attempt 3
    await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50' }
    });

    // Attempt 4 (Exceeds limit)
    const res4 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50' }
    });

    const body4: any = await res4.json();
    const hasRetryAfterHeader = res4.headers.has('retry-after');

    console.log('[TESTE 2] Status após exceder o limite (Esperado 429):', res4.status);
    console.log('[TESTE 2] Mensagem de erro retornada:', body4.error);
    console.log('[TESTE 2] Header Retry-After presente:', hasRetryAfterHeader);

    const test2Passed = res4.status === 429 && body4.success === false && hasRetryAfterHeader;
    console.log('[TESTE 2] Passou:', test2Passed);

    // -------------------------------------------------------------
    // TESTE 3: Identificação de IP via Reverse Proxy (X-Forwarded-For)
    // -------------------------------------------------------------
    console.log('\n[TESTE 3] Testando isolamento de IP do cliente via X-Forwarded-For');
    // IP 203.0.113.50 está bloqueado (429), mas IP 198.51.100.99 deve ter acesso normal
    const resIp2 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.99' },
      body: JSON.stringify({ email: 'other@test.com', password: 'password123' })
    });

    console.log('[TESTE 3] Status para IP 198.51.100.99 diferente (Esperado 401, NÃO 429):', resIp2.status);
    const test3Passed = resIp2.status === 401;
    console.log('[TESTE 3] Passou:', test3Passed);

    // -------------------------------------------------------------
    // TESTE 4: Isolamento de Rotas (Login vs Signup)
    // -------------------------------------------------------------
    console.log('\n[TESTE 4] Testando isolamento entre rotas (Login 429 não bloqueia Signup)');
    const resSignup = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50' }
    });

    console.log('[TESTE 4] Status para rota /signup do mesmo IP (Esperado 200, NÃO 429):', resSignup.status);
    const test4Passed = resSignup.status === 200;
    console.log('[TESTE 4] Passou:', test4Passed);

    // -------------------------------------------------------------
    // TESTE 5: Recuperação após expiração da janela de tempo
    // -------------------------------------------------------------
    console.log('\n[TESTE 5] Testando liberação do IP após expiração do tempo da janela (1s)');
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const resRecovered = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
      body: JSON.stringify({ email: 'user@test.com', password: 'wrongpassword' })
    });

    console.log('[TESTE 5] Status do login após janela expirada (Esperado 401):', resRecovered.status);
    const test5Passed = resRecovered.status === 401;
    console.log('[TESTE 5] Passou:', test5Passed);

    // -------------------------------------------------------------
    // TESTE 6: Endpoints normais não afetados
    // -------------------------------------------------------------
    console.log('\n[TESTE 6] Testando funcionamento normal de endpoints não sensíveis');
    const resNormal = await fetch(`${baseUrl}/api/v1/contributors`, {
      method: 'GET'
    });

    console.log('[TESTE 6] Status do endpoint normal /contributors:', resNormal.status);
    const test6Passed = resNormal.status === 200;
    console.log('[TESTE 6] Passou:', test6Passed);

    const allPassed = test1Passed && test2Passed && test3Passed && test4Passed && test5Passed && test6Passed;

    if (allPassed) {
      console.log('\n>>> TODOS OS TESTES DA ETAPA 6 PASSARAM COM SUCESSO! <<<');
    } else {
      console.error('\n>>> FALHA EM UM DOS TESTES DA ETAPA 6 <<<');
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runEtapa6Tests().catch((err) => {
  console.error('Erro ao executar testes da Etapa 6:', err);
  process.exit(1);
});
