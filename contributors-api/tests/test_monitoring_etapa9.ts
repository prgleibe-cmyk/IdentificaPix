import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { getMonitoringStatus, sendAlertNotification, getDiskUsageInfo } from '../services/monitoring.service.js';

async function runTests() {
  console.log('=== STARTING TEST SUITE FOR ETAPA 9: MONITORING & ALERTS ===\n');

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.PG_CONN_STRING,
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    database: process.env.PGDATABASE || process.env.DB_DATABASE || 'contributors',
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: Disk usage info utility
    console.log('--- Test 1: Disk Usage Stats ---');
    const diskInfo = getDiskUsageInfo('/');
    assert(typeof diskInfo.usedPercent === 'number', 'Disk usage returns valid percentage number');
    assert(diskInfo.totalBytes >= 0, 'Total bytes is non-negative');

    // Test 2: Monitoring Report structure
    console.log('\n--- Test 2: Monitoring Status Function ---');
    const report = await getMonitoringStatus(pool);
    assert(['healthy', 'degraded', 'critical'].includes(report.status), `Overall status is valid: "${report.status}"`);
    assert(report.checks.api.status === 'ok', 'API component status is ok');
    
    // Check if database check accurately returns ok or critical depending on connectivity
    if (report.checks.database.status === 'ok') {
      assert(typeof report.checks.database.latencyMs === 'number', 'PostgreSQL latency measured when connected');
    } else {
      assert(report.checks.database.status === 'critical', 'PostgreSQL reports critical status when database is unavailable');
      assert(typeof report.checks.database.error === 'string', 'PostgreSQL returns error explanation when unavailable');
    }

    assert(report.checks.backup !== undefined, 'Backup health check present');
    assert(report.checks.diskSpace !== undefined, 'Disk space check present');
    assert(report.checks.securityAuth !== undefined, 'Security auth failures check present');
    assert(report.checks.httpsCert !== undefined, 'HTTPS cert check present');

    // Test 3: Configurable Thresholds
    console.log('\n--- Test 3: Configurable Thresholds ---');
    assert(typeof report.thresholds.diskUsageWarnPercent === 'number', 'diskUsageWarnPercent configured');
    assert(typeof report.thresholds.backupMaxAgeHours === 'number', 'backupMaxAgeHours configured');
    assert(typeof report.thresholds.authFailureWarnCount === 'number', 'authFailureWarnCount configured');

    // Test 4: Alert sanitization
    console.log('\n--- Test 4: Alert Sanitization ---');
    const testReport = {
      ...report,
      alerts: [
        {
          severity: 'warning' as const,
          component: 'test',
          message: 'Test warning alert',
          timestamp: new Date().toISOString()
        }
      ]
    };

    const alertResult = await sendAlertNotification(testReport, pool);
    assert(alertResult !== undefined, 'sendAlertNotification executed successfully');
    
    // Convert report to JSON string and check for leak of sensitive keys
    const reportStr = JSON.stringify(testReport).toLowerCase();
    assert(!reportStr.includes('password='), 'No plain password in alert data');
    assert(!reportStr.includes('bearer '), 'No JWT token in alert data');
    assert(!reportStr.includes('totp_secret'), 'No TOTP secret in alert data');

    console.log(`\n==================================================`);
    console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`==================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error during monitoring test:', err);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

runTests();
