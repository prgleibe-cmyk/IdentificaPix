import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { listBackups, getBackupDirectory } from '../services/backup.service.js';

async function runHaBackupListTest() {
  console.log('--- TESTANDO CORREÇÃO CIRÚRGICA DA LISTAGEM DE BACKUPS (HA-07) ---');

  // Test 1: Fallback para diretório local quando S3 não está configurado
  console.log('\n[TEST 1] Verificando listagem local (S3 não configurado)...');
  const backupDir = getBackupDirectory();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dummyLocalFile1 = path.join(backupDir, 'backup-2026-08-09T10-00-00.sql.gz.enc');
  const dummyLocalFile2 = path.join(backupDir, 'backup-2026-08-09T11-00-00.sql.gz.enc');
  
  fs.writeFileSync(dummyLocalFile1, 'dummy-content-1');
  fs.writeFileSync(dummyLocalFile2, 'dummy-content-2');

  try {
    const localResult = await listBackups();
    console.log('[TEST 1] Resultado da listagem local:', localResult);

    const hasFile1 = localResult.files.includes('backup-2026-08-09T10-00-00.sql.gz.enc');
    const hasFile2 = localResult.files.includes('backup-2026-08-09T11-00-00.sql.gz.enc');
    const idx1 = localResult.files.indexOf('backup-2026-08-09T10-00-00.sql.gz.enc');
    const idx2 = localResult.files.indexOf('backup-2026-08-09T11-00-00.sql.gz.enc');
    const isSorted = idx2 < idx1; // 11:00 comes before 10:00 in reverse sort

    if (localResult.source === 'local' && hasFile1 && hasFile2 && isSorted) {
      console.log('>>> SUCESSO NO TESTE 1: Fallback local funcionou perfeitamente e ordenou os arquivos por data! <<<');
    } else {
      console.error('>>> FALHA NO TESTE 1! <<<', localResult);
      process.exit(1);
    }
  } finally {
    // Limpeza dos arquivos locais de teste
    if (fs.existsSync(dummyLocalFile1)) fs.unlinkSync(dummyLocalFile1);
    if (fs.existsSync(dummyLocalFile2)) fs.unlinkSync(dummyLocalFile2);
  }

  // Test 2: Testar rotas Express GET /api/v1/admin/backups e GET /api/v1/admin/backup/status
  console.log('\n[TEST 2] Verificando rotas de API HTTP Express para listagem de backups...');
  const app = express();

  app.get('/api/v1/admin/backups', async (req: Request, res: Response) => {
    try {
      const listResult = await listBackups();
      res.json({
        source: listResult.source,
        backupDir: listResult.backupDir,
        totalBackups: listResult.totalBackups,
        latestBackup: listResult.latestBackup,
        backups: listResult.files
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  app.get('/api/v1/admin/backup/status', async (req: Request, res: Response) => {
    try {
      const listResult = await listBackups();
      res.json({
        source: listResult.source,
        backupDir: listResult.backupDir,
        totalBackups: listResult.totalBackups,
        latestBackup: listResult.latestBackup,
        backups: listResult.files.slice(0, 10)
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const resBackups = await fetch(`http://127.0.0.1:${port}/api/v1/admin/backups`);
    const bodyBackups: any = await resBackups.json();
    console.log('[TEST 2] Resposta GET /api/v1/admin/backups status:', resBackups.status, 'Body:', bodyBackups);

    const resStatus = await fetch(`http://127.0.0.1:${port}/api/v1/admin/backup/status`);
    const bodyStatus: any = await resStatus.json();
    console.log('[TEST 2] Resposta GET /api/v1/admin/backup/status status:', resStatus.status, 'Body:', bodyStatus);

    if (
      resBackups.status === 200 &&
      resStatus.status === 200 &&
      bodyBackups.source !== undefined &&
      Array.isArray(bodyBackups.backups) &&
      Array.isArray(bodyStatus.backups)
    ) {
      console.log('>>> SUCESSO NO TESTE 2: Endpoints de listagem responderam com formato compatível! <<<');
    } else {
      console.error('>>> FALHA NO TESTE 2! <<<', { bodyBackups, bodyStatus });
      process.exit(1);
    }
  } finally {
    server.close();
  }

  console.log('\n>>> TODOS OS TESTES DE LISTAGEM DE BACKUPS (HA-07) PASSARAM! <<<');
}

runHaBackupListTest().catch(err => {
  console.error('Erro no teste de listagem de backups:', err);
  process.exit(1);
});
