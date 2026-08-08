import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { 
  getBackupEncryptionKey, 
  encryptAndCompress, 
  decryptAndDecompress, 
  verifyBackupFile, 
  cleanOldBackups, 
  getBackupDirectory 
} from '../services/backup.service.js';

async function runEtapa2Tests() {
  console.log('--- EXECUTANDO BATERIA DE TESTES DA ETAPA 2 ---');

  const key = getBackupEncryptionKey();
  const backupDir = getBackupDirectory();

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // -------------------------------------------------------------
  // TESTE 1 & 2: Executar backup manual, verificar arquivo compactado e criptografado
  // -------------------------------------------------------------
  const mockSqlDump = `-- IgGestor PostgreSQL Backup\n-- Generated At: ${new Date().toISOString()}\nTRUNCATE TABLE "contributors" CASCADE;\nINSERT INTO "contributors" ("id", "name") VALUES ('123', 'João Silva');\n`;
  
  const testFilename = `backup-2026-08-08-120000.sql.gz.enc`;
  const testFilepath = path.join(backupDir, testFilename);

  const encryptedBuffer = encryptAndCompress(mockSqlDump, key);
  fs.writeFileSync(testFilepath, encryptedBuffer);

  console.log('[TESTE 1] Arquivo criado com sucesso:', fs.existsSync(testFilepath));
  console.log('[TESTE 1] Tamanho do arquivo criado (bytes):', fs.statSync(testFilepath).size);

  const rawBytes = fs.readFileSync(testFilepath);
  const headerMagic = rawBytes.subarray(0, 8).toString('utf8');
  console.log('[TESTE 2] Header Magic Bytes:', headerMagic);
  console.log('[TESTE 2] O arquivo é binário criptografado:', headerMagic === 'IGBCKPv1');

  // -------------------------------------------------------------
  // TESTE 3: Confirmar que não é possível ler o dump sem a chave correta
  // -------------------------------------------------------------
  const wrongKey = crypto.scryptSync('chave-incorreta-123456', 'salt', 32);
  let unreadableWithoutKey = false;
  try {
    decryptAndDecompress(rawBytes, wrongKey);
  } catch (err: any) {
    unreadableWithoutKey = true;
    console.log('[TESTE 3] Decodificação com chave errada bloqueada com sucesso:', err.message);
  }

  // Decodificação com chave correta
  const decryptedText = decryptAndDecompress(rawBytes, key);
  const correctDecryption = decryptedText.includes('João Silva');
  console.log('[TESTE 3] Conteúdo decodificado com a chave correta com sucesso:', correctDecryption);

  // -------------------------------------------------------------
  // TESTE 4: Testar política de retenção
  // -------------------------------------------------------------
  // Criar 5 arquivos antigos mockados
  const now = Date.now();
  const oldFiles: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const filename = `backup-2025-01-0${i}-000000.sql.gz.enc`;
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, encryptedBuffer);
    // Alterar timestamp do arquivo para 10 dias no passado
    const tenDaysAgo = new Date(now - (10 * 24 * 60 * 60 * 1000) - (i * 1000));
    fs.utimesSync(filepath, tenDaysAgo, tenDaysAgo);
    oldFiles.push(filepath);
  }

  console.log('[TESTE 4] Criados 5 arquivos antigos com idade de 10 dias.');
  const removedCount = cleanOldBackups(backupDir, 7, 10); // retenção de 7 dias
  console.log('[TESTE 4] Limpeza de retenção executada. Arquivos removidos:', removedCount);

  const remainingOldFiles = oldFiles.filter(f => fs.existsSync(f)).length;
  console.log('[TESTE 4] Quantidade de arquivos antigos restantes (deve ser 0):', remainingOldFiles);

  // Limpeza final do arquivo de teste
  if (fs.existsSync(testFilepath)) {
    fs.unlinkSync(testFilepath);
  }

  const allTestsPassed = 
    fs.existsSync(backupDir) && 
    headerMagic === 'IGBCKPv1' && 
    unreadableWithoutKey && 
    correctDecryption && 
    removedCount === 5 && 
    remainingOldFiles === 0;

  if (allTestsPassed) {
    console.log('\n>>> TODOS OS TESTES DA ETAPA 2 PASSARAM COM SUCESSO! <<<');
  } else {
    console.error('\n>>> FALHA EM UM DOS TESTES DA ETAPA 2 <<<');
    process.exit(1);
  }
}

runEtapa2Tests().catch(err => {
  console.error('Erro ao executar bateria de testes:', err);
  process.exit(1);
});
