import React, { useState, useEffect, useCallback } from 'react';
import { useUI } from '../../contexts/UIContext';
import { getAuthToken } from '../../services/auth/authAdapter';
import { 
  ShieldCheck, 
  Database, 
  HardDrive, 
  Cloud, 
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
  FileText,
  Download,
  Sparkles,
  Zap,
  Play,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  Check
} from 'lucide-react';

export const AdminSecurityTab: React.FC = () => {
  const { showToast } = useUI();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [testingAlert, setTestingAlert] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Maintenance Tools States
  const [isDownloadingBackup, setIsDownloadingBackup] = useState<boolean>(false);
  const [isRunningBackup, setIsRunningBackup] = useState<boolean>(false);
  const [isOptimizingDb, setIsOptimizingDb] = useState<boolean>(false);
  const [optimizeResult, setOptimizeResult] = useState<any | null>(null);
  const [showOptimizeDetails, setShowOptimizeDetails] = useState<boolean>(false);
  const [backupsData, setBackupsData] = useState<any | null>(null);
  const [loadingBackups, setLoadingBackups] = useState<boolean>(false);
  const [showBackupsList, setShowBackupsList] = useState<boolean>(false);
  const [schedulerData, setSchedulerData] = useState<any | null>(null);

  const getAuthHeaders = useCallback(async () => {
    const token = await getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  const fetchSecurityStatus = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/admin/security-status', { headers });
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
  }, [getAuthHeaders, showToast]);

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/admin/scheduler/status', { headers });
      if (res.ok) {
        const json = await res.json();
        setSchedulerData(json);
      }
    } catch (err) {
      console.warn('[AdminSecurityTab] Could not load scheduler status:', err);
    }
  }, [getAuthHeaders]);

  const fetchBackupsList = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/admin/backups', { headers });
      if (res.ok) {
        const json = await res.json();
        setBackupsData(json);
      }
    } catch (err) {
      console.warn('[AdminSecurityTab] Could not load backups list:', err);
    } finally {
      setLoadingBackups(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchSecurityStatus();
    fetchBackupsList();
    fetchSchedulerStatus();
  }, [fetchSecurityStatus, fetchBackupsList, fetchSchedulerStatus]);

  const handleTestAlert = async () => {
    setTestingAlert(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/monitoring/test-alert', { method: 'POST', headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json();
      showToast('Alerta de teste enviado com sucesso!', 'success');
      await fetchSecurityStatus(true);
    } catch (err: any) {
      showToast('Erro ao enviar alerta de teste: ' + (err?.message || err), 'error');
    } finally {
      setTestingAlert(false);
    }
  };

  // Download Backup (.sql.gz) direct stream
  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/v1/admin/backup/download', { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Falha ao gerar backup`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'identificapix-backup.sql.gz';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('Download do backup PostgreSQL concluído com sucesso!', 'success');
      await fetchSecurityStatus(false);
    } catch (err: any) {
      console.error('[AdminSecurityTab] Download backup error:', err);
      showToast('Erro ao baixar backup: ' + (err?.message || err), 'error');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  // Run server snapshot backup
  const handleRunBackup = async () => {
    setIsRunningBackup(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/admin/backup/run', { method: 'POST', headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      showToast(`Snapshot criado: ${result.filename} (${((result.sizeBytes || 0) / 1024).toFixed(1)} KB)`, 'success');
      await fetchSecurityStatus(true);
      await fetchBackupsList();
    } catch (err: any) {
      console.error('[AdminSecurityTab] Run backup error:', err);
      showToast('Erro ao executar snapshot: ' + (err?.message || err), 'error');
    } finally {
      setIsRunningBackup(false);
    }
  };

  // Optimize Database (VACUUM ANALYZE)
  const handleOptimizeDatabase = async () => {
    setIsOptimizingDb(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/admin/database/optimize', { method: 'POST', headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setOptimizeResult(result);
      setShowOptimizeDetails(true);
      showToast(`Banco otimizado em ${result.durationMs}ms! Tamanho total: ${result.totalDbSize}`, 'success');
      await fetchSecurityStatus(true);
    } catch (err: any) {
      console.error('[AdminSecurityTab] Optimize DB error:', err);
      showToast('Erro ao otimizar banco de dados: ' + (err?.message || err), 'error');
    } finally {
      setIsOptimizingDb(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Operacional':
      case 'Verificação OK':
      case 'Ativo':
      case 'Configurado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            {status}
          </span>
        );
      case 'Atenção':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/70 dark:border-amber-900/40">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            {status}
          </span>
        );
      case 'Crítico':
      case 'Falha':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/70 dark:border-rose-900/40">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            {status}
          </span>
        );
      case 'Não configurado':
      case 'Não disponível':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs animate-fade-in">
        <RefreshCw className="w-7 h-7 text-orange-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Coletando estado real dos mecanismos de segurança...</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Consultando PostgreSQL, Backups, Criptografia, Audit Trail e Disco</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200/80 dark:border-rose-900/40 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
        <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">Falha ao obter status do painel de segurança</h4>
        <p className="text-xs text-rose-600 dark:text-rose-400">{error || 'Serviço temporariamente indisponível'}</p>
        <button
          onClick={() => fetchSecurityStatus(false)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/40 rounded-lg border border-orange-200/60 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Painel de Segurança & Manutenção IgGestor</h3>
                {renderStatusBadge(overallStatus)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoramento contínuo, controle de backups e otimização do PostgreSQL
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSecurityStatus(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              onClick={handleTestAlert}
              disabled={testingAlert}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-900/40 shadow-2xs hover:bg-amber-100/80 dark:hover:bg-amber-950/60 transition-colors cursor-pointer disabled:opacity-50"
            >
              <BellRing className={`w-3.5 h-3.5 ${testingAlert ? 'animate-bounce' : ''}`} />
              <span>Testar Alerta</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
          <span className="tabular-nums">Última Verificação: {new Date(timestamp).toLocaleString('pt-BR')}</span>
          <span>Ambiente Protegido & Isolado (Multi-tenant Restrito)</span>
        </div>
      </div>

      {/* AUTOMATED BACKGROUND SCHEDULER MONITOR */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 relative overflow-hidden">
        <div className="flex items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Automações e Rotinas em Execução (24/7)
                </h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-900/40">
                  <Check className="w-3 h-3" />
                  100% Automatizado
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Rotinas em background ativas no servidor sem necessidade de intervenção manual.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Job 1: Backup Diário */}
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-900 dark:text-white text-xs">Backup Diário Automático</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40 text-[10px] font-semibold">Ativo</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                Dump PostgreSQL compactado em Gzip, criptografado em AES-256 e sincronizado.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 font-medium space-y-0.5 tabular-nums">
              <div className="flex justify-between">
                <span>Frequência:</span>
                <span className="text-orange-600 dark:text-orange-400 font-semibold">A cada 24 horas</span>
              </div>
              <div className="flex justify-between">
                <span>Retenção:</span>
                <span className="text-slate-700 dark:text-slate-300">30 dias (auto-purge)</span>
              </div>
            </div>
          </div>

          {/* Job 2: VACUUM Semanal */}
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-900 dark:text-white text-xs">Otimização Semanal (VACUUM)</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40 text-[10px] font-semibold">Ativo</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                Limpeza de registros obsoletos, desfragmentação de índices e atualização de estatísticas.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 font-medium space-y-0.5 tabular-nums">
              <div className="flex justify-between">
                <span>Frequência:</span>
                <span className="text-orange-600 dark:text-orange-400 font-semibold">A cada 7 dias</span>
              </div>
              <div className="flex justify-between">
                <span>Execução:</span>
                <span className="text-slate-700 dark:text-slate-300">Automática (Madrugada)</span>
              </div>
            </div>
          </div>

          {/* Job 3: Monitoramento Contínuo */}
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-900 dark:text-white text-xs">Saúde & Alertas 24/7</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40 text-[10px] font-semibold">Ativo</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                Verificação de ping no PostgreSQL, uso de memória RAM, disco (&gt;85%) e envio de alertas.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 font-medium space-y-0.5 tabular-nums">
              <div className="flex justify-between">
                <span>Frequência:</span>
                <span className="text-orange-600 dark:text-orange-400 font-semibold">A cada 1 hora</span>
              </div>
              <div className="flex justify-between">
                <span>Notificações:</span>
                <span className="text-slate-700 dark:text-slate-300">Webhooks / Alertas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STAGE 2: Maintenance Tools Action Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Ferramentas de Manutenção do PostgreSQL
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Operações de backup sob demanda e otimização de banco diretamente pelo painel administrativo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Download Backup (.sql.gz) */}
            <button
              onClick={handleDownloadBackup}
              disabled={isDownloadingBackup}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Gera e baixa um arquivo .sql.gz contendo o dump completo do PostgreSQL"
            >
              {isDownloadingBackup ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloadingBackup ? 'Gerando Dump...' : 'Baixar Backup (.sql.gz)'}</span>
            </button>

            {/* 2. Create Snapshot Backup */}
            <button
              onClick={handleRunBackup}
              disabled={isRunningBackup}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Executa e armazena um snapshot criptografado no servidor/S3"
            >
              {isRunningBackup ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{isRunningBackup ? 'Processando...' : 'Criar Snapshot Servidor'}</span>
            </button>

            {/* 3. Optimize Database (VACUUM ANALYZE) */}
            <button
              onClick={handleOptimizeDatabase}
              disabled={isOptimizingDb}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Executa VACUUM ANALYZE em todas as tabelas, reorganizando índices e coletando estatísticas atualizadas"
            >
              {isOptimizingDb ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>{isOptimizingDb ? 'Otimizando...' : 'Otimizar Banco (VACUUM)'}</span>
            </button>

            {/* Backups List Toggle */}
            <button
              onClick={() => setShowBackupsList(!showBackupsList)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer tabular-nums"
            >
              <FileCheck className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>Snapshots ({backupsData?.totalBackups || 0})</span>
              {showBackupsList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Optimization Results */}
        {showOptimizeDetails && optimizeResult && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Resultado da Otimização (VACUUM ANALYZE)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 px-2 py-0.5 rounded-md tabular-nums">
                  Duração: {optimizeResult.durationMs}ms
                </span>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md tabular-nums">
                  Tamanho Banco: {optimizeResult.totalDbSize}
                </span>
                <button
                  onClick={() => setShowOptimizeDetails(false)}
                  className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 font-semibold ml-2 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Table Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px]">
              {(optimizeResult.tables || []).slice(0, 12).map((t: any, idx: number) => (
                <div key={idx} className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                    <span className="truncate">{t.table_name}</span>
                    <span className="text-orange-600 dark:text-orange-400 text-[11px] tabular-nums">{t.total_size}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 tabular-nums">
                    <span>{t.live_tuples} registros</span>
                    <span>{t.dead_tuples} dead</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Backups List */}
        {showBackupsList && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Snapshots Criptografados Disponíveis ({backupsData?.source === 's3' ? 'Nuvem S3/R2' : 'Local VPS'})
                </span>
              </div>
              <button
                onClick={fetchBackupsList}
                disabled={loadingBackups}
                className="text-xs text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingBackups ? 'animate-spin' : ''}`} />
                Atualizar Lista
              </button>
            </div>

            {loadingBackups ? (
              <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Carregando lista de snapshots...
              </div>
            ) : !backupsData?.files || backupsData.files.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Nenhum snapshot gravado encontrado ainda.</p>
            ) : (
              <div
                className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              >
                {backupsData.files.map((file: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Lock className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                    <span className="text-[11px] font-sans font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40 rounded-md">
                      AES-256-GCM
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Security Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        
        {/* 1. Status do PostgreSQL */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.postgres.label}</h4>
              </div>
              {renderStatusBadge(indicators.postgres.status)}
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{indicators.postgres.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.postgres.details}</p>
          </div>
          {indicators.postgres.serverTime && (
            <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-400 font-mono tabular-nums">
              Server Time: {new Date(indicators.postgres.serverTime).toLocaleTimeString('pt-BR')}
            </div>
          )}
        </div>

        {/* 2. Último Backup */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.lastBackup.label}</h4>
              </div>
              {renderStatusBadge(indicators.lastBackup.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate tabular-nums" title={indicators.lastBackup.value}>
              {indicators.lastBackup.value}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastBackup.details}</p>
          </div>
          {indicators.lastBackup.createdAt && (
            <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-400 tabular-nums">
              Gerado em: {new Date(indicators.lastBackup.createdAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* 3. Idade do Último Backup */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.lastBackupAge.label}</h4>
              </div>
              {renderStatusBadge(indicators.lastBackupAge.status)}
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{indicators.lastBackupAge.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastBackupAge.details}</p>
          </div>
        </div>

        {/* 4. Status do Backup Externo (Exibido apenas se configurado) */}
        {indicators.offsiteBackup?.status === 'Configurado' && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-sky-500" />
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.offsiteBackup.label}</h4>
                </div>
                {renderStatusBadge(indicators.offsiteBackup.status)}
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.offsiteBackup.value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.offsiteBackup.details}</p>
            </div>
          </div>
        )}

        {/* 5. Última Cópia Offsite (Exibido apenas se configurado) */}
        {indicators.lastOffsiteCopy?.status === 'Configurado' && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.lastOffsiteCopy.label}</h4>
                </div>
                {renderStatusBadge(indicators.lastOffsiteCopy.status)}
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{indicators.lastOffsiteCopy.value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastOffsiteCopy.details}</p>
            </div>
          </div>
        )}

        {/* 6. Resultado do Último Teste de Restauração */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.lastRestoreTest.label}</h4>
              </div>
              {renderStatusBadge(indicators.lastRestoreTest.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.lastRestoreTest.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastRestoreTest.details}</p>
          </div>
          {indicators.lastRestoreTest.lastTestedAt && (
            <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-400 tabular-nums">
              Testado em: {new Date(indicators.lastRestoreTest.lastTestedAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* 7. Status do Audit Trail */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.auditTrail.label}</h4>
              </div>
              {renderStatusBadge(indicators.auditTrail.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{indicators.auditTrail.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.auditTrail.details}</p>
          </div>
          {indicators.auditTrail.lastLogAt && (
            <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-400 tabular-nums">
              Último log: {new Date(indicators.auditTrail.lastLogAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* 8. Status do Rate Limiting */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.rateLimiting.label}</h4>
              </div>
              {renderStatusBadge(indicators.rateLimiting.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.rateLimiting.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.rateLimiting.details}</p>
          </div>
        </div>

        {/* 9. Status do 2FA Administrativo */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.admin2FA.label}</h4>
              </div>
              {renderStatusBadge(indicators.admin2FA.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.admin2FA.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.admin2FA.details}</p>
          </div>
        </div>

        {/* 10. Status do Monitoramento */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-500" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.monitoring.label}</h4>
              </div>
              {renderStatusBadge(indicators.monitoring.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.monitoring.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.monitoring.details}</p>
          </div>
        </div>

        {/* 11. Alertas Ativos */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between md:col-span-2 xl:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-orange-500" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.activeAlerts.label}</h4>
              </div>
              {renderStatusBadge(indicators.activeAlerts.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{indicators.activeAlerts.value}</p>
            
            {indicators.activeAlerts.count > 0 ? (
              <div
                className="mt-2 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              >
                {indicators.activeAlerts.items.map((alert: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-[11px]">
                    <div className="flex items-center justify-between font-semibold text-amber-800 dark:text-amber-300">
                      <span>[{alert.component.toUpperCase()}]</span>
                      <span className="text-[10px] text-amber-600 tabular-nums">{new Date(alert.timestamp).toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <p className="text-amber-700 dark:text-amber-400 mt-0.5">{alert.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.activeAlerts.details}</p>
            )}
          </div>
        </div>

        {/* 12. Espaço em Disco */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.diskSpace.label}</h4>
              </div>
              {renderStatusBadge(indicators.diskSpace.status)}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{indicators.diskSpace.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.diskSpace.details}</p>

            {indicators.diskSpace.totalMB > 0 && (
              <div className="mt-3">
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      indicators.diskSpace.usedPercent >= 85 ? 'bg-rose-500' : 'bg-orange-600'
                    }`} 
                    style={{ width: `${Math.min(100, indicators.diskSpace.usedPercent)}%` }} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 13. Última Verificação de Saúde */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{indicators.lastHealthCheck.label}</h4>
              </div>
              {renderStatusBadge(indicators.lastHealthCheck.status)}
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{indicators.lastHealthCheck.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.lastHealthCheck.details}</p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-400 tabular-nums">
            Timestamp: {new Date(indicators.lastHealthCheck.timestamp).toISOString()}
          </div>
        </div>

      </div>
    </div>
  );
};
