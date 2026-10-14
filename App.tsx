
import React from 'react';

// --- Assets ---
const logoImg = '/logo.png?v=15';

// --- Contexts & Controllers ---
import { RootProvider, SessionProvider } from './contexts/AppProviders';
import { useSessionController, useContentController } from './hooks/useAppController';
import { UIProvider } from './contexts/UIContext';
import { AppContext } from './contexts/AppContext';

// --- Views & Router ---
import { AppRouter, ModalsRenderer } from './views/AppRouter';
import { AuthView } from './views/AuthView';
import { PortalRouter } from './portal/PortalRouter';

// --- Layout & Components ---
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/shared/Toast';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { ManualIdModal } from './components/modals/ManualIdModal';
import { ExpiredBlockOverlay } from './components/shared/ExpiredBlockOverlay';
import { SystemVersionMonitor } from './components/shared/SystemVersionMonitor';
import { GlobalAnnouncementBanner } from './components/shared/GlobalAnnouncementBanner';
import { usePinchZoom } from './hooks/usePinchZoom';
import { useGlobalDragScroll } from './hooks/useGlobalDragScroll';
import { PinchZoomControl } from './components/layout/PinchZoomControl';
import { ExclamationTriangleIcon } from './components/Icons';

// --- Main Application Layout ---
const MainLayout: React.FC = () => {
    const { isLoading, initialDataLoaded, toast, connectionError, retryInitialLoad, isConnectionSlow } = useContentController();
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const pinchState = usePinchZoom(scrollContainerRef);

    const context = React.useContext(AppContext);
    const bulkIdentificationTxs = context?.bulkIdentificationTxs;
    const isManualLaunch = bulkIdentificationTxs?.some((tx: any) => tx.id.startsWith('ghost-manual-'));

    if (!initialDataLoaded) {
        return (
            <div className="h-[100dvh] w-screen flex items-center justify-center bg-brand-deep px-4">
                <div className="flex flex-col items-center max-w-sm text-center">
                    <img src={logoImg} className="h-44 w-auto mb-6 object-contain animate-fade-in" alt="IgGestor" />
                    
                    {connectionError ? (
                        <div className="bg-white/10 dark:bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl border border-amber-500/30 text-center w-full animate-fade-in">
                            <div className="mx-auto w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mb-3">
                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-400" />
                            </div>
                            <h3 className="text-white font-semibold text-base mb-1">Conexão Instável</h3>
                            <p className="text-white/70 text-xs mb-4">
                                A sincronização inicial demorou mais que o esperado devido à lentidão da internet. Seus dados estão preservados.
                            </p>
                            <button
                                onClick={() => retryInitialLoad?.()}
                                className="w-full py-2.5 px-4 bg-brand-blue hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-lg shadow-blue-500/20"
                            >
                                Tentar Novamente
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-blue border-t-transparent mb-4"></div>
                            <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.3em]">Iniciando Sistema</p>
                            {isConnectionSlow && (
                                <p className="text-amber-400/80 text-xs font-medium animate-pulse mt-3">
                                    Conexão lenta detectada. Sincronizando dados com o servidor...
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] bg-[#F1F5F9] dark:bg-brand-deep bg-noise font-sans overflow-hidden relative">
            <Sidebar />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative pt-16 md:pt-0">
                <GlobalAnnouncementBanner />
                <div 
                    ref={scrollContainerRef}
                    id="main-scroll-container" 
                    className="flex-1 overflow-auto p-2 md:p-3 z-10 custom-scrollbar relative"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom', overscrollBehavior: 'contain' }}
                >
                    <div 
                        className="max-w-[1920px] mx-auto min-h-full flex flex-col relative z-10 pb-8 md:pb-4 transition-[zoom] duration-150 origin-top-left"
                        style={{ zoom: pinchState.zoom }}
                    >
                        <div className={`min-h-full flex-1 flex flex-col transition-opacity duration-150 ${isLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                            <AppRouter />
                        </div>

                        <ExpiredBlockOverlay />

                        {isLoading && (
                            <div className="absolute inset-0 z-[100] flex items-center justify-center backdrop-blur-[1px]">
                                <div className="bg-white/80 dark:bg-slate-900/80 p-8 rounded-[2.5rem] shadow-2xl border border-white/20">
                                    <LoadingSpinner />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <ModalsRenderer />
                <PinchZoomControl pinchState={pinchState} />
            </main>

            {toast && <Toast message={toast.message} type={toast.type} />}
            <SystemVersionMonitor />
        </div>
    );
};

// --- App Controller & Session Guard ---
const isPortalRoute = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return (
        path.startsWith('/portal') || 
        hash.startsWith('#/portal') ||
        path.startsWith('/cadastro') || 
        hash.startsWith('#/cadastro') ||
        path.startsWith('/cadastrar') || 
        hash.startsWith('#/cadastrar') ||
        path.startsWith('/register') || 
        hash.startsWith('#/register')
    );
};

const AppContent: React.FC = () => {
    useGlobalDragScroll();
    const [isPortal, setIsPortal] = React.useState(isPortalRoute());

    React.useEffect(() => {
        const checkRoute = () => setIsPortal(isPortalRoute());
        window.addEventListener('popstate', checkRoute);
        window.addEventListener('hashchange', checkRoute);
        return () => {
            window.removeEventListener('popstate', checkRoute);
            window.removeEventListener('hashchange', checkRoute);
        };
    }, []);

    if (isPortal) {
        return <PortalRouter />;
    }

    const { session, loading } = useSessionController();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-deep">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-blue border-t-transparent"></div>
            </div>
        );
    }

    if (!session) {
        return <AuthView />;
    }

    return (
        <SessionProvider>
            <MainLayout />
        </SessionProvider>
    );
};

// --- Root Component ---
export default function App() {
    return (
        <RootProvider>
            <UIProvider>
                <AppContent />
            </UIProvider>
        </RootProvider>
    );
}
