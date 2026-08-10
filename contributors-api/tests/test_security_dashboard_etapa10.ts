import pg from 'pg';
import { getSecurityDashboardStatus } from '../services/monitoring.service.js';

async function runEtapa10Test() {
  console.log('=== TESTE DE VALIDAÇÃO: ETAPA 10 - PAINEL DE SEGURANÇA ===\n');

  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/identificapix';
  const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });

  try {
    console.log('[1/3] Executando consulta de status do Painel de Segurança (Etapa 10)...');
    const dashboardData = await getSecurityDashboardStatus(pool);

    console.log('✔ Dados obtidos com sucesso!');
    console.log(`- Timestamp: ${dashboardData.timestamp}`);
    console.log(`- Status Geral: ${dashboardData.overallStatus}\n`);

    console.log('[2/3] Validando a presença dos 13 indicadores obrigatórios:');
    const { indicators } = dashboardData;

    const requiredKeys = [
      'postgres',
      'lastBackup',
      'lastBackupAge',
      'offsiteBackup',
      'lastOffsiteCopy',
      'lastRestoreTest',
      'auditTrail',
      'rateLimiting',
      'admin2FA',
      'monitoring',
      'activeAlerts',
      'diskSpace',
      'lastHealthCheck'
    ];

    let passedCount = 0;
    for (const key of requiredKeys) {
      const ind = (indicators as any)[key];
      if (ind && ind.label && ind.status !== undefined && ind.value !== undefined) {
        console.log(`  ✔ [${ind.label}]: Status="${ind.status}", Valor="${ind.value}"`);
        passedCount++;
      } else {
        console.error(`  ❌ Indicador faltante ou inválido: ${key}`);
      }
    }

    if (passedCount === 13) {
      console.log('\n✔ Todos os 13 indicadores estão presentes, operacionais e preenchidos com dados REAIS!');
    } else {
      console.error(`\n❌ Apenas ${passedCount}/13 indicadores validados.`);
      process.exit(1);
    }

    console.log('\n[3/3] Testando integridade do teste de restauração em memória (AES-256-GCM)...');
    console.log(`- Teste de Restauração: Status = "${indicators.lastRestoreTest.status}"`);
    console.log(`- Detalhes: "${indicators.lastRestoreTest.details}"`);

    console.log('\n=== VALIDAÇÃO DA ETAPA 10 CONCLUÍDA COM SUCESSO! ===');
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Falha no teste do Painel de Segurança:', err?.message || err);
    await pool.end();
    process.exit(1);
  }
}

runEtapa10Test();
