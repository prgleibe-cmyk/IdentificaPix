import { 
  executeBackupWithLock, 
  BACKUP_ADVISORY_LOCK_ID 
} from '../services/backup.service.js';

class MockPgPoolForLockTest {
  private lockState = false;

  async connect(): Promise<any> {
    const self = this;
    return {
      query: async (sql: string, params?: any[]) => {
        if (sql.includes('pg_try_advisory_lock')) {
          const lockId = params![0];
          if (lockId !== BACKUP_ADVISORY_LOCK_ID) {
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
          if (lockId !== BACKUP_ADVISORY_LOCK_ID) {
            throw new Error(`Unexpected unlock ID: ${lockId}`);
          }
          self.lockState = false;
          return { rows: [{ unlocked: true }] };
        }

        if (sql.includes('pg_dump') || sql.includes('information_schema') || sql.includes('tablename')) {
          return { rows: [{ tablename: 'app_users' }] };
        }

        return { rows: [] };
      },
      release: () => {}
    };
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (sql.includes('information_schema') || sql.includes('tablename')) {
      return { rows: [{ tablename: 'app_users' }] };
    }
    return { rows: [] };
  }
}

async function runHaBackupLockTest() {
  console.log('--- TESTANDO MIGRACAO DO BACKUP COM PG_TRY_ADVISORY_LOCK (HA-05) ---');

  const mockPool = new MockPgPoolForLockTest() as any;

  // Test 1: Simular duas instâncias tentando executar backup simultaneamente
  console.log('\n[TEST 1] Instância 1 tenta adquirir a lock e inicia backup...');
  
  let instance1Done = false;
  let instance2Result: any = null;

  // Instância 1 adquire a lock
  const p1 = executeBackupWithLock(mockPool).then(res => {
    instance1Done = true;
    return res;
  });

  // Instância 2 tenta adquirir a lock enquanto Instância 1 ainda está em execução
  const res2 = await executeBackupWithLock(mockPool);
  console.log('[TEST 1] Instância 2 resultado (esperado falha por lock ocupada):', res2);

  const res1 = await p1;
  console.log('[TEST 1] Instância 1 resultado (esperado sucesso):', res1.success);

  if (res2.success === false && (res2.error || '').includes('outra instância') && res1.success === true) {
    console.log('>>> SUCESSO NO TESTE 1: Apenas 1 instância executou o backup. A segunda foi bloqueada pela advisory lock! <<<');
  } else {
    console.error('>>> FALHA NO TESTE 1! <<<', { res1, res2 });
    process.exit(1);
  }

  // Test 2: Após a finalização da Instância 1, a lock deve ter sido liberada e a próxima execução deve funcionar
  console.log('\n[TEST 2] Verificando se a lock foi liberada após o término da Instância 1...');
  const res3 = await executeBackupWithLock(mockPool);
  console.log('[TEST 2] Instância 3 resultado (esperado sucesso após liberação da lock):', res3.success);

  if (res3.success === true) {
    console.log('>>> SUCESSO NO TESTE 2: Lock foi liberada corretamente no bloco finally! <<<');
  } else {
    console.error('>>> FALHA NO TESTE 2! Lock não foi liberada. <<<', res3);
    process.exit(1);
  }

  console.log('\n>>> TODOS OS TESTES DE ADVISORY LOCK DO BACKUP (HA-05) PASSARAM! <<<');
}

runHaBackupLockTest().catch(err => {
  console.error('Erro no teste de backup advisory lock:', err);
  process.exit(1);
});
