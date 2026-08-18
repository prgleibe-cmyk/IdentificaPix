import React, { useState, useEffect, useCallback } from 'react';
import { useUI } from '../../contexts/UIContext';
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

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/scheduler/status');
      if (res.ok) {
        const json = await res.json();
        setSchedulerData(json);
      }
    } catch (err) {
      console.warn('[AdminSecurityTab] Could not load scheduler status:', err);
    }
  }, []);

  const fetchBackupsList = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch('/api/v1/admin/backups');
      if (res.ok) {
        const json = await res.json();
        setBackupsData(json);
      }
    } catch (err) {
      console.warn('[AdminSecurityTab] Could not load backups list:', err);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurityStatus();
    fetchBackupsList();
    fetchSchedulerStatus();
  }, [fetchSecurityStatus, fetchBackupsList, fetchSchedulerStatus]);

  const handleTestAlert = async () => {
    setTestingAlert(true);
    try {
      const res = await fetch('/api/v1/monitoring/test-alert', { method: 'POST' });
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
      const response = await fetch('/api/v1/admin/backup/download');
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
      const res = await fetch('/api/v1/admin/backup/run', { method: 'POST' });
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
      const res = await fetch('/api/v1/admin/database/optimize', { method: 'POST' });
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
                <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">Painel de Segurança & Manutenção IgGestor</h3>
                {renderStatusBadge(overallStatus)}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Monitoramento contínuo, controle de backups e otimização do PostgreSQL
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

      {/* AUTOMATED BACKGROUND SCHEDULER MONITOR */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] shadow-card border border-emerald-100 dark:border-emerald-900/40 relative overflow-hidden">
        <div className="flex items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 border border-emerald-200 dark:border-emerald-800">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Automações e Rotinas em Execução (24/7)
                </h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                  <Check className="w-2.5 h-2.5" />
                  100% Automatizado
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Rotinas em background ativas no servidor sem necessidade de intervenção manual.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Job 1: Backup Diário */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-800 dark:text-white text-xs">Backup Diário Automático</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[9px] font-extrabold uppercase">Ativo</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                Dump PostgreSQL compactado em Gzip, criptografado em AES-256 e sincronizado.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[10px] text-slate-600 dark:text-slate-400 font-semibold space-y-0.5">
              <div className="flex justify-between">
                <span>Frequência:</span>
                <span className="text-brand-blue font-bold">A cada 24 horas</span>
              </div>
              <div className="flex justify-between">
                <span>Retenção:</span>
                <span className="text-slate-700 dark:text-slate-300">30 dias (auto-purge)</span>
              </div>
            </div>
          </div>

          {/* Job 2: VACUUM Semanal */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-800 dark:text-white text-xs">Otimização Semanal (VACUUM)</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[9px] font-extrabold uppercase">Ativo</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                Limpeza de registros obsoletos, desfragmentação de índices e atualização de estatísticas.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[10px] text-slate-600 dark:text-slate-400 font-semibold space-y-0.5">
              <div className="flex justify-between">
                <span>Frequência:</span>
                <span className="text-brand-blue font-bold">A cada 7 dias</span>
              </div>
              <div className="flex justify-between">
                <span>Execução:</span>
                <span className="text-slate-700 dark:text-slate-300">Automática (Madrugada)</span>
              </div>
            </div>
          </div>

          {/* Job 3: Monitoramento Contínuo */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-800 dark:text-white text-xs">Saúde & Alertas 24/7</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[9px] font-extrabold uppercase">Ativo</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                Verificação de ping no PostgreSQL, uso de memória RAM, disco (&gt;85%) e envio de alertas.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[10px] text-slate-600 dark:text-slate-400 font-semibold space-y-0.5">
              <div className="flex justify-between">
                <span>Frequência:</span>
                <span className="text-brand-blue font-bold">A cada 1 hora</span>
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
      <div className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700/60">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-brand-blue" />
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
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
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Gera e baixa um arquivo .sql.gz contendo o dump completo do PostgreSQL"
            >
              {isDownloadingBackup ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isDownloadingBackup ? 'Gerando Dump...' : 'Baixar Backup (.sql.gz)'}</span>
            </button>

            {/* 2. Create Snapshot Backup */}
            <button
              onClick={handleRunBackup}
              disabled={isRunningBackup}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Executa e armazena um snapshot criptografado no servidor/S3"
            >
              {isRunningBackup ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>{isRunningBackup ? 'Processando...' : 'Criar Snapshot Servidor'}</span>
            </button>

            {/* 3. Optimize Database (VACUUM ANALYZE) */}
            <button
              onClick={handleOptimizeDatabase}
              disabled={isOptimizingDb}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Executa VACUUM ANALYZE em todas as tabelas, reorganizando índices e coletando estatísticas atualizadas"
            >
              {isOptimizingDb ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>{isOptimizingDb ? 'Otimizando...' : 'Otimizar Banco (VACUUM)'}</span>
            </button>

            {/* Backups List Toggle */}
            <button
              onClick={() => setShowBackupsList(!showBackupsList)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-all"
            >
              <FileCheck className="w-4 h-4 text-indigo-500" />
              <span>Snapshots ({backupsData?.totalBackups || 0})</span>
              {showBackupsList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Optimization Results */}
        {showOptimizeDetails && optimizeResult && (
          <div className="mt-4 p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-black text-purple-900 dark:text-purple-300">
                  Resultado da Otimização (VACUUM ANALYZE)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">
                  Duração: {optimizeResult.durationMs}ms
                </span>
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">
                  Tamanho Banco: {optimizeResult.totalDbSize}
                </span>
                <button
                  onClick={() => setShowOptimizeDetails(false)}
                  className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 font-bold ml-2"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Table Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px]">
              {(optimizeResult.tables || []).slice(0, 12).map((t: any, idx: number) => (
                <div key={idx} className="p-2 bg-white dark:bg-slate-800/90 rounded-lg border border-purple-100 dark:border-purple-900/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span className="truncate">{t.table_name}</span>
                    <span className="text-purple-600 dark:text-purple-400 text-[10px]">{t.total_size}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
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
          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-brand-blue" />
                <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Snapshots Criptografados Disponíveis ({backupsData?.source === 's3' ? 'Nuvem S3/R2' : 'Local VPS'})
                </span>
              </div>
              <button
                onClick={fetchBackupsList}
                disabled={loadingBackups}
                className="text-xs text-brand-blue font-bold flex items-center gap-1 hover:underline"
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
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {backupsData.files.map((file: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 text-xs font-mono text-slate-700 dark:text-slate-300"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Lock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                    <span className="text-[10px] font-sans font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded">
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

        {/* 4. Status do Backup Externo (Exibido apenas se configurado) */}
        {indicators.offsiteBackup?.status === 'Configurado' && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-card border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-cyan-500" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">{indicators.offsiteBackup.label}</h4>
                </div>
                {renderStatusBadge(indicators.offsiteBackup.status)}
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">{indicators.offsiteBackup.value}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{indicators.offsiteBackup.details}</p>
            </div>
          </div>
        )}

        {/* 5. Última Cópia Offsite (Exibido apenas se configurado) */}
        {indicators.lastOffsiteCopy?.status === 'Configurado' && (
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
        )}

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
