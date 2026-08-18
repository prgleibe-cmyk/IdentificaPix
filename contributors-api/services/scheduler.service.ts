import pg from 'pg';
import { executeBackupWithLock, getBackupDirectory, listBackups } from './backup.service.js';
import { getMonitoringStatus } from './monitoring.service.js';
import { logAudit } from './audit.service.js';

export interface SchedulerJobStatus {
  name: string;
  description: string;
  interval: string;
  lastRunAt: string | null;
  lastRunSuccess: boolean | null;
  lastRunDurationMs: number | null;
  lastRunMessage: string | null;
  nextRunAt: string | null;
  isRunning: boolean;
}

export interface SchedulerStatus {
  enabled: boolean;
  startedAt: string;
  jobs: {
    dailyBackup: SchedulerJobStatus;
    weeklyVacuum: SchedulerJobStatus;
    hourlyHealthCheck: SchedulerJobStatus;
  };
}

const schedulerState: SchedulerStatus = {
  enabled: false,
  startedAt: new Date().toISOString(),
  jobs: {
    dailyBackup: {
      name: 'Backup Diário Automático',
      description: 'Gera dump PostgreSQL, compacta com Gzip, criptografa em AES-256-GCM e envia para S3/Offsite',
      interval: 'A cada 24 horas (03:00)',
      lastRunAt: null,
      lastRunSuccess: null,
      lastRunDurationMs: null,
      lastRunMessage: null,
      nextRunAt: null,
      isRunning: false
    },
    weeklyVacuum: {
      name: 'Otimização Semanal (VACUUM ANALYZE)',
      description: 'Limpeza de dead tuples, desfragmentação de índices e atualização de estatísticas do planejador',
      interval: 'A cada 7 dias (Domingos às 04:00)',
      lastRunAt: null,
      lastRunSuccess: null,
      lastRunDurationMs: null,
      lastRunMessage: null,
      nextRunAt: null,
      isRunning: false
    },
    hourlyHealthCheck: {
      name: 'Monitoramento & Verificação de Saúde Contínua',
      description: 'Verifica saúde do banco de dados, integridade de conexões, espaço em disco e emite alertas',
      interval: 'A cada 1 hora',
      lastRunAt: null,
      lastRunSuccess: null,
      lastRunDurationMs: null,
      lastRunMessage: null,
      nextRunAt: null,
      isRunning: false
    }
  }
};

let schedulerIntervals: NodeJS.Timeout[] = [];

/**
 * Executa a rotina de backup diário
 */
export async function runAutomatedDailyBackup(pool: pg.Pool): Promise<void> {
  const job = schedulerState.jobs.dailyBackup;
  if (job.isRunning) {
    console.log('[SchedulerService] Backup diário já está em andamento. Ignorando chamada concorrente.');
    return;
  }

  job.isRunning = true;
  const start = Date.now();
  console.log('[SchedulerService] 🚀 Iniciando rotina de backup diário automatizado...');

  try {
    const result = await executeBackupWithLock(pool);
    const durationMs = Date.now() - start;

    job.lastRunAt = new Date().toISOString();
    job.lastRunDurationMs = durationMs;
    job.lastRunSuccess = result.success;

    if (result.success) {
      job.lastRunMessage = `Backup criado com sucesso: ${result.filename} (${((result.sizeBytes || 0) / 1024).toFixed(1)} KB)`;
      console.log(`[SchedulerService] ✅ ${job.lastRunMessage} em ${durationMs}ms`);

      await logAudit(pool, {
        action: 'AUTOMATED_BACKUP_SUCCESS',
        entity: 'system_scheduler',
        entityId: result.filename,
        newValues: {
          filename: result.filename,
          sizeBytes: result.sizeBytes,
          durationMs,
          offsiteUploaded: result.offsiteUploaded
        }
      }).catch(() => {});
    } else {
      job.lastRunMessage = `Falha no backup: ${result.error || 'Erro desconhecido'}`;
      console.error(`[SchedulerService] ❌ ${job.lastRunMessage}`);

      await logAudit(pool, {
        action: 'AUTOMATED_BACKUP_FAILURE',
        entity: 'system_scheduler',
        entityId: 'backup_error',
        newValues: { error: result.error, durationMs }
      }).catch(() => {});
    }
  } catch (err: any) {
    const durationMs = Date.now() - start;
    job.lastRunAt = new Date().toISOString();
    job.lastRunDurationMs = durationMs;
    job.lastRunSuccess = false;
    job.lastRunMessage = `Erro inesperado: ${err?.message || err}`;
    console.error(`[SchedulerService] ❌ Erro inesperado no backup diário:`, err);
  } finally {
    job.isRunning = false;
    // Define próxima execução para 24h a partir de agora
    job.nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
}

/**
 * Executa a rotina de otimização semanal (VACUUM ANALYZE)
 */
export async function runAutomatedVacuum(pool: pg.Pool): Promise<void> {
  const job = schedulerState.jobs.weeklyVacuum;
  if (job.isRunning) return;

  job.isRunning = true;
  const start = Date.now();
  console.log('[SchedulerService] 🧹 Iniciando rotina de otimização semanal (VACUUM ANALYZE)...');

  try {
    const client = await pool.connect();
    try {
      await client.query('VACUUM ANALYZE;');
    } finally {
      client.release();
    }

    const durationMs = Date.now() - start;
    job.lastRunAt = new Date().toISOString();
    job.lastRunDurationMs = durationMs;
    job.lastRunSuccess = true;
    job.lastRunMessage = `Otimização do banco concluída com sucesso em ${durationMs}ms`;
    console.log(`[SchedulerService] ✅ ${job.lastRunMessage}`);

    await logAudit(pool, {
      action: 'AUTOMATED_VACUUM_SUCCESS',
      entity: 'system_scheduler',
      entityId: 'vacuum_analyze',
      newValues: { durationMs }
    }).catch(() => {});
  } catch (err: any) {
    const durationMs = Date.now() - start;
    job.lastRunAt = new Date().toISOString();
    job.lastRunDurationMs = durationMs;
    job.lastRunSuccess = false;
    job.lastRunMessage = `Falha no VACUUM: ${err?.message || err}`;
    console.error(`[SchedulerService] ❌ Erro na otimização semanal:`, err);
  } finally {
    job.isRunning = false;
    job.nextRunAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

/**
 * Executa verificação horária de integridade e saúde
 */
export async function runAutomatedHealthCheck(pool: pg.Pool): Promise<void> {
  const job = schedulerState.jobs.hourlyHealthCheck;
  job.isRunning = true;
  const start = Date.now();

  try {
    const report = await getMonitoringStatus(pool);
    const durationMs = Date.now() - start;

    job.lastRunAt = new Date().toISOString();
    job.lastRunDurationMs = durationMs;
    job.lastRunSuccess = report.status !== 'critical';
    job.lastRunMessage = `Status geral: ${report.status.toUpperCase()} (${report.alerts.length} alertas ativos)`;

    if (report.alerts.length > 0) {
      console.warn(`[SchedulerService] ⚠️ Alertas detectados na checagem horária:`, report.alerts);
    }
  } catch (err: any) {
    job.lastRunAt = new Date().toISOString();
    job.lastRunSuccess = false;
    job.lastRunMessage = `Erro no health check: ${err?.message || err}`;
  } finally {
    job.isRunning = false;
    job.nextRunAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
}

/**
 * Inicializa o agendador automático em background
 */
export function startBackgroundScheduler(pool: pg.Pool): void {
  if (schedulerState.enabled) {
    console.log('[SchedulerService] Scheduler já está ativo.');
    return;
  }

  schedulerState.enabled = true;
  schedulerState.startedAt = new Date().toISOString();
  console.log('[SchedulerService] 🛡️ Agendador Automático de Manutenção & Monitoramento ATIVADO!');

  // Define próximas execuções estimadas
  schedulerState.jobs.dailyBackup.nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  schedulerState.jobs.weeklyVacuum.nextRunAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  schedulerState.jobs.hourlyHealthCheck.nextRunAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // 1. Verificação inicial na inicialização (Startup Check):
  // Se não houver backup ou o mais recente tiver mais de 24 horas, agenda um backup em 30 segundos
  setTimeout(async () => {
    try {
      const backupList = await listBackups();
      const hasBackups = backupList.files && backupList.files.length > 0;

      if (!hasBackups) {
        console.log('[SchedulerService] Nenhum backup recente encontrado. Executando backup inicial de segurança...');
        await runAutomatedDailyBackup(pool);
      } else {
        console.log(`[SchedulerService] Backups existentes verificados (${backupList.totalBackups} arquivos). Próximo agendado em 24h.`);
      }
    } catch (err) {
      console.warn('[SchedulerService] Erro ao verificar backups no startup:', err);
    }
  }, 30000); // 30s após boot

  // 2. Intervalo de Backup Diário: a cada 24 horas (86.400.000 ms)
  const dailyBackupTimer = setInterval(() => {
    runAutomatedDailyBackup(pool).catch(err => {
      console.error('[SchedulerService] Erro no timer de backup diário:', err);
    });
  }, 24 * 60 * 60 * 1000);
  schedulerIntervals.push(dailyBackupTimer);

  // 3. Intervalo de VACUUM Semanal: a cada 7 dias (604.800.000 ms)
  const weeklyVacuumTimer = setInterval(() => {
    runAutomatedVacuum(pool).catch(err => {
      console.error('[SchedulerService] Erro no timer de VACUUM semanal:', err);
    });
  }, 7 * 24 * 60 * 60 * 1000);
  schedulerIntervals.push(weeklyVacuumTimer);

  // 4. Intervalo de Health Check Horário: a cada 1 hora (3.600.000 ms)
  const hourlyHealthCheckTimer = setInterval(() => {
    runAutomatedHealthCheck(pool).catch(err => {
      console.error('[SchedulerService] Erro no timer de health check:', err);
    });
  }, 60 * 60 * 1000);
  schedulerIntervals.push(hourlyHealthCheckTimer);
}

/**
 * Retorna o status atual de todas as rotinas automatizadas
 */
export function getSchedulerStatus(): SchedulerStatus {
  return schedulerState;
}
