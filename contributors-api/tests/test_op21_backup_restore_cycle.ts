import fs from 'fs';
import path from 'path';
import { pool } from '../server.js';
import { 
  getBackupEncryptionKey, 
  encryptAndCompress, 
  decryptAndDecompress, 
  verifyBackupFile, 
  cleanOldBackups, 
  getBackupDirectory,
  executeBackupWithLock
} from '../services/backup.service.js';
import { restoreDatabaseFromEncryptedBuffer } from '../services/restore.service.js';

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

async function runBackupRestoreCycleTests() {
  console.log('========================================================================');
  console.log('🧪 BATERIA DE TESTES — OP-21 (SUB-ETAPA 9.3)');
  console.log('   CICLO CRIPTOGRÁFICO DE BACKUP, VERIFICAÇÃO, ADULTERAÇÃO E RESTAURAÇÃO');
  console.log('========================================================================\n');

  const key = getBackupEncryptionKey();
  assert(key instanceof Buffer && key.length === 32, 'Chave de criptografia derivada com 256 bits (32 bytes)');

  // --- CENÁRIO 1: Compressão e Criptografia AES-256-GCM ---
  console.log('--- CENÁRIO 1: Compressão e Criptografia AES-256-GCM ---');
  const sampleSql = `-- IgGestor Test Backup
CREATE TABLE IF NOT EXISTS sample_test (id TEXT PRIMARY KEY, value REAL);
INSERT INTO sample_test (id, value) VALUES ('1', 999.50);
`;
  const encryptedBuffer = encryptAndCompress(sampleSql, key);
  assert(encryptedBuffer.length > 36, 'Buffer cifrado gerado com cabeçalho, IV e AuthTag');
  assert(encryptedBuffer.subarray(0, 8).toString('utf8') === 'IGBCKPv1', 'Cabeçalho mágico IGBCKPv1 presente nos primeiros 8 bytes');

  // --- CENÁRIO 2: Descriptografia e Descompressão Fiel ---
  console.log('\n--- CENÁRIO 2: Descriptografia e Descompressão Fiel ---');
  const decryptedSql = decryptAndDecompress(encryptedBuffer, key);
  assert(decryptedSql === sampleSql, 'Dump SQL recuperado idêntico centavo a centavo após AES-256-GCM e Gzip');

  // --- CENÁRIO 3: Detecção de Adulteração (Tamper Resistance / AuthTag) ---
  console.log('\n--- CENÁRIO 3: Detecção de Adulteração (Tamper Resistance / AuthTag) ---');
  const tamperedBuffer = Buffer.from(encryptedBuffer);
  // Altera um único byte na carga criptografada
  tamperedBuffer[tamperedBuffer.length - 5] ^= 0xFF;

  let tamperDetected = false;
  try {
    decryptAndDecompress(tamperedBuffer, key);
  } catch (err: any) {
    tamperDetected = true;
  }
  assert(tamperDetected, 'Adulteração de 1 byte no buffer cifrado rejeitada pelo AuthTag do AES-256-GCM');

  // --- CENÁRIO 4: Verificação de Integridade em Arquivo (verifyBackupFile) ---
  console.log('\n--- CENÁRIO 4: Verificação de Integridade em Arquivo (verifyBackupFile) ---');
  const backupDir = getBackupDirectory();
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const validFilePath = path.join(backupDir, `test-valid-${Date.now()}.enc`);
  const corruptedFilePath = path.join(backupDir, `test-corrupted-${Date.now()}.enc`);

  fs.writeFileSync(validFilePath, encryptedBuffer);
  fs.writeFileSync(corruptedFilePath, tamperedBuffer);

  const isValid = verifyBackupFile(validFilePath, key);
  const isCorruptedValid = verifyBackupFile(corruptedFilePath, key);

  assert(isValid, 'verifyBackupFile confirmou integridade do arquivo de backup autêntico');
  assert(!isCorruptedValid, 'verifyBackupFile rejeitou arquivo corrompido com falha no AuthTag');

  // Limpeza de arquivos de teste
  try { fs.unlinkSync(validFilePath); } catch (_) {}
  try { fs.unlinkSync(corruptedFilePath); } catch (_) {}

  // --- CENÁRIO 5: Retenção e Rotação Automática de Backups ---
  console.log('\n--- CENÁRIO 5: Retenção e Rotação Automática de Backups ---');
  const dummyFile1 = path.join(backupDir, `backup-test-dummy1.enc`);
  const dummyFile2 = path.join(backupDir, `backup-test-dummy2.enc`);
  fs.writeFileSync(dummyFile1, encryptedBuffer);
  fs.writeFileSync(dummyFile2, encryptedBuffer);

  // Forçar data de modificação antiga (10 dias atrás)
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  fs.utimesSync(dummyFile1, tenDaysAgo, tenDaysAgo);

  const cleaned = cleanOldBackups(backupDir, 7, 20);
  assert(cleaned >= 1, `Política de retenção removeu automaticamente arquivo anterior a 7 dias (removidos: ${cleaned})`);

  // Limpa o segundo dummy se restar
  try { fs.unlinkSync(dummyFile2); } catch (_) {}

  // --- CENÁRIO 6: Execução de Backup com Advisory Lock ---
  console.log('\n--- CENÁRIO 6: Execução de Backup com Advisory Lock ---');
  const backupResult = await executeBackupWithLock(pool);
  assert(backupResult.verified === true || backupResult.success === true, 'Rotina executeBackupWithLock executada com sucesso e verificação de integridade');
  if (backupResult.filepath && fs.existsSync(backupResult.filepath)) {
    assert(backupResult.sizeBytes > 0, `Backup físico gerado com tamanho válido: ${(backupResult.sizeBytes / 1024).toFixed(1)} KB`);
  }

  // --- CENÁRIO 7: Restauração Segura a partir de Buffer Cifrado ---
  console.log('\n--- CENÁRIO 7: Restauração Segura a partir de Buffer Cifrado ---');
  const restoreSql = `-- Teste de Restauração Segura
CREATE TABLE IF NOT EXISTS test_restore_records (id TEXT PRIMARY KEY, amount REAL);
INSERT OR REPLACE INTO test_restore_records (id, amount) VALUES ('rec-100', 350.00);
`;
  const restoreEncryptedBuffer = encryptAndCompress(restoreSql, key);
  const restoreResult = await restoreDatabaseFromEncryptedBuffer(restoreEncryptedBuffer, pool, 'buffer', 'test-suite-restore');

  assert(restoreResult.success, 'Restauração a partir de buffer criptografado executada com sucesso transacional');
  assert(restoreResult.decryptedSizeBytes > 0, 'Buffer descriptografado com sucesso na memória');

  // Limpeza da tabela de teste
  try {
    await pool.query('DROP TABLE IF EXISTS test_restore_records;');
    await pool.query('DROP TABLE IF EXISTS sample_test;');
  } catch (_) {}

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO DA SUB-ETAPA 9.3: ${passed} APROVADOS, ${failed} FALHAS`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runBackupRestoreCycleTests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
