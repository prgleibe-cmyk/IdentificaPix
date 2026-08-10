import { 
  runMonitoringCheckWithLock, 
  MONITORING_ADVISORY_LOCK_ID 
} from '../services/monitoring.service.js';

class MockPgPoolForMonitoringLockTest {
  private lockState = false;

  async connect(): Promise<any> {
    const self = this;
    return {
      query: async (sql: string, params?: any[]) => {
        if (sql.includes('pg_try_advisory_lock')) {
          const lockId = params![0];
          if (lockId !== MONITORING_ADVISORY_LOCK_ID) {
            throw new Error(`Unexpected lock ID: ${lockId}`);
          }
          if (self.lockState) {
            return { rows: [{ acquired: false }] };
          } else {
            self.lockState = true;
            return { rows: [{ acquired: true }] };
          }
        }

        if (sql.includes('pg_advisory_unlock')) {
          const lockId = params![0];
          if (lockId !== MONITORING_ADVISORY_LOCK_ID) {
            throw new Error(`Unexpected unlock ID: ${lockId}`);
          }
          self.lockState = false;
          return { rows: [{ unlocked: true }] };
        }

        return { rows: [] };
      },
      release: () => {}
    };
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (sql.includes('COUNT(*)')) {
      return { rows: [{ count: '0' }] };
    }
    if (sql.includes('PG_STAT_ACTIVITY') || sql.includes('pg_stat_activity')) {
      return { rows: [{ count: '1' }] };
    }
    return { rows: [] };
  }
}

async function runHaMonitoringLockTest() {
  console.log('--- TESTANDO MIGRACAO DO MONITORAMENTO COM PG_TRY_ADVISORY_LOCK (HA-06) ---');

  const mockPool = new MockPgPoolForMonitoringLockTest() as any;

  // Test 1: Simular duas instâncias tentando executar o ciclo de monitoramento simultaneamente
  console.log('\n[TEST 1] Instância 1 tenta adquirir a lock e inicia verificação de monitoramento...');

  let p1Done = false;
  const p1 = runMonitoringCheckWithLock(mockPool).then(res => {
    p1Done = true;
    return res;
  });

  // Instância 2 tenta adquirir a lock enquanto Instância 1 ainda está executando o ciclo
  const res2 = await runMonitoringCheckWithLock(mockPool);
  console.log('[TEST 1] Instância 2 resultado (esperado ignorar ciclo por lock ocupada):', res2);

  const res1 = await p1;
  console.log('[TEST 1] Instância 1 resultado (esperado executado com sucesso):', res1);

  if (res2.executed === false && res1.executed === true) {
    console.log('>>> SUCESSO NO TESTE 1: Apenas 1 instância executou o ciclo. A segunda ignorou por causa do advisory lock! <<<');
  } else {
    console.error('>>> FALHA NO TESTE 1! <<<', { res1, res2 });
    process.exit(1);
  }

  // Test 2: Após a finalização da Instância 1, a lock deve ter sido liberada e o próximo ciclo deve funcionar
  console.log('\n[TEST 2] Verificando se a lock de monitoramento foi liberada após o término da Instância 1...');
  const res3 = await runMonitoringCheckWithLock(mockPool);
  console.log('[TEST 2] Instância 3 resultado (esperado executado após liberação da lock):', res3);

  if (res3.executed === true) {
    console.log('>>> SUCESSO NO TESTE 2: Lock de monitoramento foi liberada corretamente no bloco finally! <<<');
  } else {
    console.error('>>> FALHA NO TESTE 2! Lock de monitoramento não foi liberada. <<<', res3);
    process.exit(1);
  }

  console.log('\n>>> TODOS OS TESTES DE ADVISORY LOCK DO MONITORAMENTO (HA-06) PASSARAM! <<<');
}

runHaMonitoringLockTest().catch(err => {
  console.error('Erro no teste de monitoring advisory lock:', err);
  process.exit(1);
});
