import React from 'react';

// --- Contexts & Controllers ---
import { RootProvider, SessionProvider } from './contexts/AppProviders';
import { useSessionController, useContentController } from './hooks/useAppController';
import { UIProvider } from './contexts/UIContext';

// --- Views & Router ---
import { AppRouter, ModalsRenderer } from './views/AppRouter';
import { AuthView } from './views/AuthView';

// --- Layout & Components ---
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/shared/Toast';
import { LoadingSpinner } from './components/shared/LoadingSpinner';

// --- Main Application Layout ---
const MainLayout: React.FC = () => {
    const { isLoading, initialDataLoaded, toast } = useContentController();

    if (!initialDataLoaded) {
        return (
            <div className="h-[100dvh] w-screen flex items-center justify-center bg-[#051024]">
                <div className="flex flex-col items-center">
                    <img src="/pwa/icon-512.png" className="h-36 w-auto mb-8 object-contain animate-fade-in" alt="IdentificaPix" />
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
                    <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.3em]">Iniciando Sistema</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] bg-[#F1F5F9] dark:bg-[#0B1120] bg-noise font-sans overflow-hidden relative">
            <Sidebar />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <div className="flex-1 overflow-y-auto p-2 md:p-3 scroll-smooth z-10 custom-scrollbar relative">
                    <div className="max-w-[1920px] mx-auto h-full flex flex-col relative z-10">
                        {/* 
                            MODIFICAÇÃO CRÍTICA: O AppRouter permanece montado mesmo em isLoading.
                            Isso evita interrupção de processos e loops de remounting.
                        */}
                        <div className={`h-full transition-opacity duration-300 ${isLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                            <AppRouter />
                        </div>

                        {/* Spinner como Overlay centralizado */}
                        {isLoading && (
                            <div className="absolute inset-0 z-[100] flex items-center justify-center backdrop-blur-[1px]">
                                <div className="bg-white/80 dark:bg-slate-900/80 p-8 rounded-[2.5rem] shadow-2xl border border-white/20">
                                    <LoadingSpinner />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {toast && <Toast message={toast.message} type={toast.type} />}
            <ModalsRenderer />
        </div>
    );
};

// --- App Controller & Session Guard ---
const AppContent: React.FC = () => {
    const { session, loading } = useSessionController();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#051024]">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-400 border-t-transparent"></div>
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