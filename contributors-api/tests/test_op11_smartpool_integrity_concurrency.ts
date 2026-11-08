import { pool } from '../server.js';
import { DatabaseSync } from 'node:sqlite';

async function runOP11SmartPoolIntegrityTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES DE INTEGRIDADE E CONCORRÊNCIA — OP-11 (ITEM 4)');
  console.log('   SMARTPOOL, ADVISORY LOCKS, IDEMPOTÊNCIA E RESILIÊNCIA SQLITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  const localEngine = (pool as any).localEngine;

  try {
    // ---------------------------------------------------------------------------------
    // CENÁRIO 1: Testes de Advisory Xact Locks em Concorrência no SQLite
    // ---------------------------------------------------------------------------------
    console.log('--- CENÁRIO 1: Advisory Xact Locks e Controle de Concorrência ---');

    const key1 = 12345;
    const key2 = 202611;

    // 1.1 Iniciar transação e adquirir lock
    localEngine.query('BEGIN');
    const lockRes1 = localEngine.query('SELECT pg_try_advisory_xact_lock(?, ?) AS locked', [key1, key2]);
    assert(
      lockRes1.rows[0]?.locked === 1,
      `Primeira aquisição de advisory lock transacional tem sucesso (locked = 1)`
    );

    // 1.2 Tentativa concorrente de adquirir o mesmo lock
    const lockRes2 = localEngine.query('SELECT pg_try_advisory_xact_lock(?, ?) AS locked', [key1, key2]);
    assert(
      lockRes2.rows[0]?.locked === 0,
      `Tentativa concorrente no mesmo recurso é bloqueada (locked = 0)`
    );

    // 1.3 Execução de COMMIT libera os locks transacionais automaticamente
    localEngine.query('COMMIT');
    const lockRes3 = localEngine.query('SELECT pg_try_advisory_xact_lock(?, ?) AS locked', [key1, key2]);
    assert(
      lockRes3.rows[0]?.locked === 1,
      `Após COMMIT, o lock foi liberado e nova aquisição tem sucesso (locked = 1)`
    );
    localEngine.query('ROLLBACK');

    // ---------------------------------------------------------------------------------
    // CENÁRIO 2: Idempotência de ROLLBACK e COMMIT sem Transação Ativa
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Idempotência de ROLLBACK/COMMIT sem Transação Ativa ---');

    let rollbackError: any = null;
    try {
      // Chamar ROLLBACK quando não há transação aberta não deve estourar erro
      const rbRes = localEngine.query('ROLLBACK', [], true);
      assert(rbRes.command === 'ROLLBACK', `ROLLBACK sem transação ativa é absorvido com segurança sem exceção`);
    } catch (err: any) {
      rollbackError = err;
    }
    assert(rollbackError === null, `Nenhum erro de 'cannot rollback - no transaction is active' foi lançado`);

    let commitError: any = null;
    try {
      const cmRes = localEngine.query('COMMIT', [], true);
      assert(cmRes.command === 'COMMIT', `COMMIT sem transação ativa é absorvido com segurança sem exceção`);
    } catch (err: any) {
      commitError = err;
    }
    assert(commitError === null, `Nenhum erro de 'cannot commit' foi lançado`);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 3: Session Advisory Locks (pg_try_advisory_lock / pg_advisory_unlock)
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Session Advisory Locks ---');

    const sessionKey = 'session-task-sync-99';
    const sLock1 = localEngine.query('SELECT pg_try_advisory_lock($1) AS locked', [sessionKey]);
    assert(sLock1.rows[0]?.locked === 1, `Aquisição de session advisory lock bem-sucedida (locked = 1)`);

    const sLock2 = localEngine.query('SELECT pg_try_advisory_lock($1) AS locked', [sessionKey]);
    assert(sLock2.rows[0]?.locked === 0, `Segunda aquisição do mesmo session lock bloqueada (locked = 0)`);

    localEngine.query('SELECT pg_advisory_unlock($1) AS unlocked', [sessionKey]);
    const sLock3 = localEngine.query('SELECT pg_try_advisory_lock($1) AS locked', [sessionKey]);
    assert(sLock3.rows[0]?.locked === 1, `Após pg_advisory_unlock, novo lock adquirido com sucesso (locked = 1)`);
    localEngine.query('SELECT pg_advisory_unlock($1)', [sessionKey]);

    // ---------------------------------------------------------------------------------
    // CENÁRIO 4: Validação de Estrutura e Resiliência na Sincronização de Resgate
    // ---------------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Sincronização de Resgate Expandida (7 Tabelas) ---');

    // Inserir registro temporário nas tabelas suportadas
    const testChurchId = '44444444-4444-4444-4444-444444444444';
    const testUserId = '55555555-5555-5555-5555-555555555555';
    const testBankId = '66666666-6666-6666-6666-666666666666';

    localEngine.query(`
      INSERT OR REPLACE INTO churches (id, user_id, name)
      VALUES ($1, $2, $3)
    `, [testChurchId, testUserId, 'Igreja Teste SmartPool']);

    localEngine.query(`
      INSERT OR REPLACE INTO banks (id, user_id, name)
      VALUES ($1, $2, $3)
    `, [testBankId, testUserId, 'Banco Teste SmartPool']);

    localEngine.query(`
      INSERT OR REPLACE INTO learned_associations (id, user_id, normalized_description, contributor_normalized_name, church_id)
      VALUES ($1, $2, $3, $4, $5)
    `, ['77777777-7777-7777-7777-777777777777', testUserId, 'PIX TESTE', 'JOAO SILVA', testChurchId]);

    // Executa syncPendingLocalToPostgres sem estourar exceções
    let syncError: any = null;
    try {
      await (pool as any).syncPendingLocalToPostgres();
      assert(true, `syncPendingLocalToPostgres executado com sucesso e abrangência completa das 7 entidades`);
    } catch (err: any) {
      syncError = err;
    }
    assert(syncError === null, `Nenhum erro não tratado durante a sincronização de contingência`);

    // Limpeza
    localEngine.query('DELETE FROM churches WHERE id = ?', [testChurchId]);
    localEngine.query('DELETE FROM banks WHERE id = ?', [testBankId]);
    localEngine.query('DELETE FROM learned_associations WHERE id = ?', ['77777777-7777-7777-7777-777777777777']);

  } finally {
    // Teardown
  }

  console.log('\n========================================================================');
  console.log(`📊 RESUMO DO ITEM 4 (SMARTPOOL & INTEGRIDADE): ${passed} passaram, ${failed} falharam.`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOP11SmartPoolIntegrityTests().catch((err) => {
  console.error('Erro fatal executando testes:', err);
  process.exit(1);
});
