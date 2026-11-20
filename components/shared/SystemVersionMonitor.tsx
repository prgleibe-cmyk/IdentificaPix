import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, WifiOff, CheckCircle2, X } from 'lucide-react';

export const SystemVersionMonitor: React.FC = () => {
    const [initialServerTime, setInitialServerTime] = useState<string | null>(null);
    const [hasUpdate, setHasUpdate] = useState<boolean>(false);
    const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
    const [reconnectedRecently, setReconnectedRecently] = useState<boolean>(false);
    const [isDismissed, setIsDismissed] = useState<boolean>(false);
    const [isReloading, setIsReloading] = useState<boolean>(false);

    const consecutiveFailuresRef = useRef<number>(0);
    const reconnectedTimerRef = useRef<NodeJS.Timeout | null>(null);

    const checkSystemStatus = async () => {
        try {
            // Se o app estiver em background (celular bloqueado ou aba oculta), não executa polling
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                return;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const res = await fetch('/api/version', {
                signal: controller.signal,
                headers: { 'Cache-Control': 'no-cache' }
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                const currentServerTime = data.serverStartTime;

                if (!initialServerTime) {
                    setInitialServerTime(currentServerTime);
                } else if (currentServerTime && currentServerTime !== initialServerTime) {
                    console.log('[SystemVersionMonitor] Nova versão do servidor detectada:', currentServerTime);
                    setHasUpdate(true);
                }

                if (consecutiveFailuresRef.current > 0) {
                    console.log('[SystemVersionMonitor] Conexão com o servidor restabelecida.');
                    setIsReconnecting(false);
                    setReconnectedRecently(true);

                    if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
                    reconnectedTimerRef.current = setTimeout(() => {
                        setReconnectedRecently(false);
                    }, 4000);
                }

                consecutiveFailuresRef.current = 0;
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (err) {
            consecutiveFailuresRef.current += 1;
            // Só exibe status de reconexão se falhar 3 vezes seguidas com a tela visível para evitar alarme falso em micro instabilidades de rede móvel
            if (consecutiveFailuresRef.current >= 3 && typeof document !== 'undefined' && document.visibilityState === 'visible') {
                setIsReconnecting(true);
            }
        }
    };

    useEffect(() => {
        checkSystemStatus();

        // Checar a cada 45 segundos quando ativo
        const interval = setInterval(checkSystemStatus, 45000);

        const handleOnline = () => {
            checkSystemStatus();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkSystemStatus();
            }
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
        };
    }, [initialServerTime]);

    const handleReload = () => {
        setIsReloading(true);
        window.location.reload();
    };

    return (
        <>
            {/* BANNER SUPERIOR DE NOVA VERSÃO DISPONÍVEL */}
            {hasUpdate && !isDismissed && (
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-slate-900 dark:bg-slate-950 text-white px-4 py-2.5 shadow-elevated border-b border-slate-800 flex items-center justify-between animate-slide-down">
                    <div className="flex items-center gap-3 max-w-7xl mx-auto w-full justify-between">
                        <div className="flex items-center gap-2.5 text-xs md:text-sm font-medium">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 shrink-0">
                                <Sparkles className="w-4 h-4" />
                            </span>
                            <span>
                                <strong className="font-semibold text-white">Nova atualização disponível.</strong> O sistema foi atualizado com novas melhorias.
                            </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleReload}
                                disabled={isReloading}
                                className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-xs active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
                                <span>{isReloading ? 'Atualizando...' : 'Atualizar Agora'}</span>
                            </button>
                            <button
                                onClick={() => setIsDismissed(true)}
                                title="Lembrar mais tarde"
                                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BADGE FLUTUANTE DE RECONEXÃO / STATUS DE REDE (CANTO INFERIOR DIREITO) */}
            {(isReconnecting || reconnectedRecently) && (
                <div className="fixed bottom-5 right-5 z-[9999] animate-bounce-in">
                    {isReconnecting && (
                        <div className="flex items-center gap-2.5 px-3.5 py-2 bg-white/95 dark:bg-slate-900/95 text-amber-700 dark:text-amber-300 border border-amber-200/90 dark:border-amber-800/60 rounded-xl shadow-elevated backdrop-blur-md text-xs font-semibold">
                            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Sincronizando com o servidor...</span>
                        </div>
                    )}

                    {!isReconnecting && reconnectedRecently && (
                        <div className="flex items-center gap-2 px-3.5 py-2 bg-white/95 dark:bg-slate-900/95 text-emerald-700 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800/60 rounded-xl shadow-elevated backdrop-blur-md text-xs font-semibold animate-fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Servidor reconectado com sucesso.</span>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
