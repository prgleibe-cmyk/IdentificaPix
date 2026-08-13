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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

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
            // Só exibe status de reconexão se falhar 2 vezes seguidas para evitar alarme falso em micro instabilidades
            if (consecutiveFailuresRef.current >= 2) {
                setIsReconnecting(true);
            }
        }
    };

    useEffect(() => {
        checkSystemStatus();

        // Checar a cada 30 segundos
        const interval = setInterval(checkSystemStatus, 30000);

        const handleOnline = () => {
            checkSystemStatus();
        };

        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
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
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 text-white px-4 py-2.5 shadow-xl border-b border-white/20 flex items-center justify-between animate-slide-down">
                    <div className="flex items-center gap-3 max-w-7xl mx-auto w-full justify-between">
                        <div className="flex items-center gap-2.5 text-xs md:text-sm font-medium">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-inner shrink-0">
                                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                            </span>
                            <span>
                                🚀 <strong className="font-bold">Nova atualização disponível!</strong> O sistema foi atualizado com novas melhorias.
                            </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleReload}
                                disabled={isReloading}
                                className="px-3.5 py-1.5 bg-white text-emerald-800 rounded-xl font-bold text-xs hover:bg-emerald-50 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
                                <span>{isReloading ? 'Atualizando...' : 'Atualizar Agora'}</span>
                            </button>
                            <button
                                onClick={() => setIsDismissed(true)}
                                title="Lembrar mais tarde"
                                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white/80 hover:text-white"
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
                        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-900/90 dark:bg-black/90 text-amber-400 border border-amber-500/40 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-semibold">
                            <WifiOff className="w-4 h-4 animate-pulse text-amber-400 shrink-0" />
                            <span>Sincronizando com o servidor...</span>
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping ml-1"></div>
                        </div>
                    )}

                    {!isReconnecting && reconnectedRecently && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-semibold animate-fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Servidor reconectado com sucesso!</span>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
