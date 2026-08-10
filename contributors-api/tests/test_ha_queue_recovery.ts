import { recoverAbandonedProcessingQueueItems } from '../server.js';

class MockPgClientForRecovery {
  public db: any[];
  public inTransaction = false;

  constructor(db: any[]) {
    this.db = db;
  }

  async query(sql: string, params?: any[]): Promise<any> {
    const trimmed = sql.trim();

    if (trimmed === 'BEGIN') {
      this.inTransaction = true;
      return { rows: [] };
    }
    if (trimmed === 'COMMIT') {
      this.inTransaction = false;
      return { rows: [] };
    }
    if (trimmed === 'ROLLBACK') {
      this.inTransaction = false;
      return { rows: [] };
    }

    if (trimmed.includes('SELECT id, attempts, max_attempts')) {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      // Filter rows that match: status === 'PROCESSING', updated_at < 5 minutes ago, and not locked
      const matching = this.db.filter(row => 
        row.status === 'PROCESSING' && 
        row.updated_at.getTime() < fiveMinutesAgo &&
        !row._locked
      );

      // Mark matching rows as locked (simulating FOR UPDATE SKIP LOCKED)
      matching.forEach(row => { row._locked = true; });

      return { rows: matching.map(r => ({ id: r.id, attempts: r.attempts, max_attempts: r.max_attempts })) };
    }

    if (trimmed.includes("UPDATE communication_queue") && trimmed.includes("SET status = 'FAILED'")) {
      const id = params![0];
      const row = this.db.find(r => r.id === id);
      if (row) {
        row.status = 'FAILED';
        row.error_message = 'Timeout de processamento (registro abandonado em PROCESSING)';
        row.updated_at = new Date();
        row._locked = false;
      }
      return { rows: [] };
    }

    if (trimmed.includes("UPDATE communication_queue") && trimmed.includes("SET status = 'READY_FOR_SEND'")) {
      const id = params![0];
      const row = this.db.find(r => r.id === id);
      if (row) {
        row.status = 'READY_FOR_SEND';
        row.error_message = 'Recuperado de timeout de processamento (abandonado em PROCESSING)';
        row.updated_at = new Date();
        row._locked = false;
      }
      return { rows: [] };
    }

    return { rows: [] };
  }

  release() {}
}

class MockPgPoolForRecovery {
  public db: any[];

  constructor(db: any[]) {
    this.db = db;
  }

  async connect(): Promise<any> {
    return new MockPgClientForRecovery(this.db);
  }
}

async function runHaQueueRecoveryTest() {
  console.log('--- TESTANDO RECUPERAÇÃO DE MENSAGENS PRESAS EM PROCESSING (HA-08) ---');

  const now = Date.now();
  const sixMinutesAgo = new Date(now - 6 * 60 * 1000);
  const oneMinuteAgo = new Date(now - 1 * 60 * 1000);

  const sharedDb = [
    {
      id: 'rec-1',
      status: 'PROCESSING',
      attempts: 1,
      max_attempts: 3,
      updated_at: sixMinutesAgo,
      _locked: false
    },
    {
      id: 'rec-2',
      status: 'PROCESSING',
      attempts: 3,
      max_attempts: 3,
      updated_at: sixMinutesAgo,
      _locked: false
    },
    {
      id: 'rec-3',
      status: 'PROCESSING',
      attempts: 1,
      max_attempts: 3,
      updated_at: oneMinuteAgo,
      _locked: false
    },
    {
      id: 'rec-4',
      status: 'FAILED',
      attempts: 3,
      max_attempts: 3,
      updated_at: sixMinutesAgo,
      _locked: false
    }
  ];

  const mockPool = new MockPgPoolForRecovery(sharedDb) as any;

  console.log('\n[TEST 1] Executando recuperação em lote...');
  const result1 = await recoverAbandonedProcessingQueueItems(mockPool);
  console.log('[TEST 1] Resultado da recuperação:', result1);

  const rec1 = sharedDb.find(r => r.id === 'rec-1');
  const rec2 = sharedDb.find(r => r.id === 'rec-2');
  const rec3 = sharedDb.find(r => r.id === 'rec-3');
  const rec4 = sharedDb.find(r => r.id === 'rec-4');

  // Assertions
  const t1_rec1_pass = rec1?.status === 'READY_FOR_SEND' && rec1.attempts === 1;
  const t1_rec2_pass = rec2?.status === 'FAILED' && rec2.attempts === 3;
  const t1_rec3_pass = rec3?.status === 'PROCESSING'; // Ignored because updated_at < 5 min
  const t1_rec4_pass = rec4?.status === 'FAILED';     // Ignored because status != PROCESSING

  if (t1_rec1_pass && t1_rec2_pass && t1_rec3_pass && t1_rec4_pass && result1.recovered === 1 && result1.failed === 1) {
    console.log('>>> SUCESSO NO TESTE 1: As mensagens antigas foram recuperadas/falhadas corretamente preservando attempts! <<<');
  } else {
    console.error('>>> FALHA NO TESTE 1! <<<', { rec1, rec2, rec3, rec4, result1 });
    process.exit(1);
  }

  // Test 2: Concorrência entre duas instâncias executando simultaneamente
  console.log('\n[TEST 2] Verificando concorrência (duas VPSs buscando recuperar ao mesmo tempo)...');
  
  // Adiciona um novo item abandonado
  const rec5 = {
    id: 'rec-5',
    status: 'PROCESSING',
    attempts: 2,
    max_attempts: 3,
    updated_at: sixMinutesAgo,
    _locked: false
  };
  sharedDb.push(rec5);

  const p1 = recoverAbandonedProcessingQueueItems(mockPool);
  const p2 = recoverAbandonedProcessingQueueItems(mockPool);

  const [resVPS1, resVPS2] = await Promise.all([p1, p2]);
  console.log('[TEST 2] VPS 1 Resultado:', resVPS1);
  console.log('[TEST 2] VPS 2 Resultado:', resVPS2);

  const totalRecovered = resVPS1.recovered + resVPS2.recovered;
  if (totalRecovered === 1 && (resVPS1.recovered === 0 || resVPS2.recovered === 0)) {
    console.log('>>> SUCESSO NO TESTE 2: Apenas 1 das instâncias recuperou a mensagem rec-5 (FOR UPDATE SKIP LOCKED)! <<<');
  } else {
    console.error('>>> FALHA NO TESTE 2! <<<', { resVPS1, resVPS2 });
    process.exit(1);
  }

  console.log('\n>>> TODOS OS TESTES DE RECOVERY DA COMMUNICATION QUEUE (HA-08) PASSARAM! <<<');
}

runHaQueueRecoveryTest().catch(err => {
  console.error('Erro no teste de queue recovery:', err);
  process.exit(1);
});
