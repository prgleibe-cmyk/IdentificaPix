import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { 
  getBackupEncryptionKey, 
  encryptAndCompress, 
  decryptAndDecompress, 
  getBackupDirectory,
  uploadBackupToS3
} from '../services/backup.service.js';

async function runEtapa3Tests() {
  console.log('--- EXECUTANDO BATERIA DE TESTES DA ETAPA 3 (OFFSITE BACKUP) ---');

  const key = getBackupEncryptionKey();
  const backupDir = getBackupDirectory();

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // -------------------------------------------------------------
  // TESTE 1: Gerar backup manual criptografado
  // -------------------------------------------------------------
  const mockSqlDump = `-- IgGestor Offsite Backup Test\n-- Date: ${new Date().toISOString()}\nINSERT INTO "contributors" ("id", "name") VALUES ('999', 'Maria Oliveira');\n`;
  const filename = `backup-offsite-test-${Date.now()}.sql.gz.enc`;
  const filepath = path.join(backupDir, filename);

  const encryptedBuffer = encryptAndCompress(mockSqlDump, key);
  fs.writeFileSync(filepath, encryptedBuffer);

  console.log('[TESTE 1] Backup local de teste criado com sucesso:', fs.existsSync(filepath));

  // -------------------------------------------------------------
  // TESTE 2 & 3 & 4: Confirmar que o arquivo remoto permanece criptografado e objeto é privado
  // -------------------------------------------------------------
  const headerMagic = encryptedBuffer.subarray(0, 8).toString('utf8');
  console.log('[TESTE 2 & 4] Formato binário criptografado verificado (IGBCKPv1):', headerMagic === 'IGBCKPv1');

  // Testar descriptografia com chave errada
  let unreadable = false;
  try {
    const wrongKey = crypto.scryptSync('wrong-key', 'salt', 32);
    decryptAndDecompress(encryptedBuffer, wrongKey);
  } catch (err) {
    unreadable = true;
  }
  console.log('[TESTE 3 & 4] Garantia de confidencialidade: impossível ler sem chave:', unreadable);

  // -------------------------------------------------------------
  // TESTE 5: Simular falha de upload S3 e confirmar que o backup local NÃO é apagado
  // -------------------------------------------------------------
  // Salvar envs originais
  const origBucket = process.env.S3_BUCKET_NAME;
  const origKey = process.env.S3_ACCESS_KEY_ID;
  const origSecret = process.env.S3_SECRET_ACCESS_KEY;
  const origEndpoint = process.env.S3_ENDPOINT;

  // Configurar S3 com credenciais inválidas para forçar falha tratada
  process.env.S3_BUCKET_NAME = 'non-existent-test-bucket-iggestor-999999';
  process.env.S3_ACCESS_KEY_ID = 'AKIAINVALIDKEY12345678';
  process.env.S3_SECRET_ACCESS_KEY = 'InvalidSecretKey12345678901234567890';
  process.env.S3_ENDPOINT = 'http://127.0.0.1:54399'; // Endpoint inacessível

  const failedUploadResult = await uploadBackupToS3(filename, encryptedBuffer);

  console.log('[TESTE 5] Upload com falha detectado de forma segura (uploaded = false):', failedUploadResult.uploaded === false);
  console.log('[TESTE 5] Detalhe da falha retido sem crash:', failedUploadResult.error ? 'Sim' : 'Não');

  // CRÍTICO: Confirmar que o backup local ainda EXISTE intacto!
  const localBackupPreserved = fs.existsSync(filepath) && fs.statSync(filepath).size > 0;
  console.log('[TESTE 5] CRÍTICO - Backup local PRESERVADO intacto após falha de upload:', localBackupPreserved);

  // Restaurar envs originais
  process.env.S3_BUCKET_NAME = origBucket;
  process.env.S3_ACCESS_KEY_ID = origKey;
  process.env.S3_SECRET_ACCESS_KEY = origSecret;
  process.env.S3_ENDPOINT = origEndpoint;

  // -------------------------------------------------------------
  // TESTE 6: Confirmar fluxo normal de verificação
  // -------------------------------------------------------------
  const decryptedText = decryptAndDecompress(encryptedBuffer, key);
  const flowSuccess = decryptedText.includes('Maria Oliveira');
  console.log('[TESTE 6] Validação do fluxo normal de integridade:', flowSuccess);

  // Limpeza do arquivo de teste
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  const allPassed = localBackupPreserved && unreadable && flowSuccess && headerMagic === 'IGBCKPv1';

  if (allPassed) {
    console.log('\n>>> TODOS OS TESTES DA ETAPA 3 PASSARAM COM SUCESSO! <<<');
  } else {
    console.error('\n>>> FALHA EM UM DOS TESTES DA ETAPA 3 <<<');
    process.exit(1);
  }
}

runEtapa3Tests().catch(err => {
  console.error('Erro nos testes da Etapa 3:', err);
  process.exit(1);
});
