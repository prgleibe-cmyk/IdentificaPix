import React, { useState, useEffect, useCallback } from 'react';
import { useUI } from '../../contexts/UIContext';
import { 
  ShieldCheck, 
  Database, 
  HardDrive, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Lock, 
  FileCheck, 
  Activity, 
  BellRing, 
  ShieldAlert, 
  Server,
  KeyRound,
  FileText
} from 'lucide-react';

export const AdminSecurityTab: React.FC = () => {
  const { showToast } = useUI();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [testingAlert, setTestingAlert] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSecurityStatus = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/admin/security-status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Falha ao obter dados do painel de segurança`);
      }
      const json = await response.json();
      setData(json);
      if (isManualRefresh) {
        showToast('Painel de segurança atualizado!', 'success');
      }
    } catch (err: any) {
      console.error('[AdminSecurityTab] Fetch error:', err);
      setError(err?.message || 'Erro ao carregar dados reais de segurança');
      showToast('Erro ao carregar painel de segurança', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSecurityStatus();
  }, [fetchSecurityStatus]);

  const handleTestAlert = async () => {
    setTestingAlert(true);
    try {
      const res = await fetch('/api/v1/monitoring/test-alert', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      showToast('Alerta de teste enviado com sucesso!', 'success');
      // Refresh status to display test alert
      await fetchSecurityStatus(true);
    } catch (err: any) {
      showToast('Erro ao enviar alerta de teste: ' + (err?.message || err), 'error');
    } finally {
      setTestingAlert(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Operacional':
      case 'Verificação OK':
      case 'Ativo':
      case 'Configurado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            {status}
          </span>
        );
      case 'Atenção':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            {status}
          </span>
        );
      case 'Crítico':
      case 'Falha':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">
            <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
            {status}
          </span>
        );
      case 'Não configurado':
      case 'Não disponível':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm animate-fade-in">
        <RefreshCw className="w-8 h-8 text-brand-blue animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Coletando estado real dos mecanismos de segurança...</p>
        <p className="text-[10px] text-slate-400 mt-1">Consultando PostgreSQL, Backups, Criptografia, Audit Trail e Disco</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Falha ao obter status do painel de segurança</h4>
        <p className="text-xs text-red-600 dark:text-red-400">{error || 'Serviço temporariamente indisponível'}</p>
        <button
          onClick={() => fetchSecurityStatus(false)}
          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const { indicators, overallStatus, timestamp } = data;

  return (
    <div className="space-y-4 animate-fade-in pb-6">
      {/* Overview Header Card */}
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-purple-50/80 dark:from-slate-800 dark:via-slate-800/90 dark:to-indigo-950/80 text-slate-800 dark:text-white p-5 rounded-[1.5rem] shadow-card border border-blue-100/80 dark:border-slate-700 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 text-brand-blue/10 dark:text-white/5 pointer-events-none">
          <ShieldCheck className="w-48 h-48" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-2xl border border-brand-blue/20 dark:border-brand-blue/40 text-brand-blue backdrop-blur-md">
              <ShieldCheck className="w-7 h-7 text-brand-blue dark:text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">Painel de Segurança IgGestor</h3>
                {renderStatusBadge(overallStatus)}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Estado real e verificação contínua da infraestrutura de proteção (Etapas 1–9)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSecurityStatus(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 backdrop-blur-md transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              onClick={handleTestAlert}
              disabled={testingAlert}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-sm hover:bg-amber-100/80 backdrop-blur-md transition-all active:scale-95 disabled:opacity-50"
            >
              <BellRing className={`w-3.5 h-3.5 ${testingAlert ? 'animate-bounce' : ''}`} />
              <span>Testar Alerta</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
          <span>Última Verificação: {new Date(timestamp).toLocaleString('pt-BR')}</span>
          <span>Ambiente Protegido & Isolado (Multi-tenant Restrito)</span>
        </div>
      </div>

      {/* Security Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        
        {/* 1. Status do PostgreSQL */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-brand-blue" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.postgres.label}</h4>
              </div>
              {renderStatusBadge(indicators.postgres.status)}
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{indicators.postgres.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.postgres.details}</p>
          </div>
          {indicators.postgres.serverTime && (
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[9px] text-slate-400 font-mono">
              Server Time: {new Date(indicators.postgres.serverTime).toLocaleTimeString('pt-BR')}
            </div>
          )}
        </div>

        {/* 2. Último Backup */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.lastBackup.label}</h4>
              </div>
              {renderStatusBadge(indicators.lastBackup.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate" title={indicators.lastBackup.value}>
              {indicators.lastBackup.value}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastBackup.details}</p>
          </div>
          {indicators.lastBackup.createdAt && (
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[9px] text-slate-400">
              Gerado em: {new Date(indicators.lastBackup.createdAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* 3. Idade do Último Backup */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.lastBackupAge.label}</h4>
              </div>
              {renderStatusBadge(indicators.lastBackupAge.status)}
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{indicators.lastBackupAge.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastBackupAge.details}</p>
          </div>
        </div>

        {/* 4. Status do Backup Externo */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {indicators.offsiteBackup.status === 'Configurado' ? (
                  <Cloud className="w-4 h-4 text-cyan-500" />
                ) : (
                  <CloudOff className="w-4 h-4 text-slate-400" />
                )}
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.offsiteBackup.label}</h4>
              </div>
              {renderStatusBadge(indicators.offsiteBackup.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.offsiteBackup.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.offsiteBackup.details}</p>
          </div>
        </div>

        {/* 5. Última Cópia Offsite */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-teal-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.lastOffsiteCopy.label}</h4>
              </div>
              {renderStatusBadge(indicators.lastOffsiteCopy.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.lastOffsiteCopy.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastOffsiteCopy.details}</p>
          </div>
        </div>

        {/* 6. Resultado do Último Teste de Restauração */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.lastRestoreTest.label}</h4>
              </div>
              {renderStatusBadge(indicators.lastRestoreTest.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.lastRestoreTest.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastRestoreTest.details}</p>
          </div>
          {indicators.lastRestoreTest.lastTestedAt && (
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[9px] text-slate-400">
              Testado em: {new Date(indicators.lastRestoreTest.lastTestedAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* 7. Status do Audit Trail */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.auditTrail.label}</h4>
              </div>
              {renderStatusBadge(indicators.auditTrail.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.auditTrail.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.auditTrail.details}</p>
          </div>
          {indicators.auditTrail.lastLogAt && (
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[9px] text-slate-400">
              Último log: {new Date(indicators.auditTrail.lastLogAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* 8. Status do Rate Limiting */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.rateLimiting.label}</h4>
              </div>
              {renderStatusBadge(indicators.rateLimiting.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.rateLimiting.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.rateLimiting.details}</p>
          </div>
        </div>

        {/* 9. Status do 2FA Administrativo */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.admin2FA.label}</h4>
              </div>
              {renderStatusBadge(indicators.admin2FA.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.admin2FA.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.admin2FA.details}</p>
          </div>
        </div>

        {/* 10. Status do Monitoramento */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.monitoring.label}</h4>
              </div>
              {renderStatusBadge(indicators.monitoring.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.monitoring.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.monitoring.details}</p>
          </div>
        </div>

        {/* 11. Alertas Ativos */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between md:col-span-2 xl:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-orange-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.activeAlerts.label}</h4>
              </div>
              {renderStatusBadge(indicators.activeAlerts.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.activeAlerts.value}</p>
            
            {indicators.activeAlerts.count > 0 ? (
              <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                {indicators.activeAlerts.items.map((alert: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[10px]">
                    <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-300">
                      <span>[{alert.component.toUpperCase()}]</span>
                      <span className="text-[9px] text-amber-600">{new Date(alert.timestamp).toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <p className="text-amber-700 dark:text-amber-400 mt-0.5">{alert.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.activeAlerts.details}</p>
            )}
          </div>
        </div>

        {/* 12. Espaço em Disco */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.diskSpace.label}</h4>
              </div>
              {renderStatusBadge(indicators.diskSpace.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.diskSpace.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.diskSpace.details}</p>

            {indicators.diskSpace.totalMB > 0 && (
              <div className="mt-3">
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      indicators.diskSpace.usedPercent >= 85 ? 'bg-red-500' : 'bg-brand-blue'
                    }`} 
                    style={{ width: `${Math.min(100, indicators.diskSpace.usedPercent)}%` }} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 13. Última Verificação de Saúde */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.lastHealthCheck.label}</h4>
              </div>
              {renderStatusBadge(indicators.lastHealthCheck.status)}
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{indicators.lastHealthCheck.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastHealthCheck.details}</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[9px] text-slate-400">
            Timestamp: {new Date(indicators.lastHealthCheck.timestamp).toISOString()}
          </div>
        </div>

      </div>
    </div>
  );
};
