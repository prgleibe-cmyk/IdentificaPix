
import React from 'react';

// --- Contexts & Controllers ---
import { RootProvider, SessionProvider } from './contexts/AppProviders';
import { useSessionController, useContentController } from './hooks/useAppController';

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
            <div className="h-[100dvh] w-screen flex items-center justify-center bg-brand-deep">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] bg-[#F1F5F9] dark:bg-[#0B1120] bg-noise font-sans overflow-hidden">
            {/* Sidebar is fixed height, main content scrolls */}
            <Sidebar />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                
                {/* Alterado padding de p-6/p-8 para p-2/p-3 para maximizar espaço */}
                <div className="flex-1 overflow-y-auto p-2 md:p-3 scroll-smooth z-10 custom-scrollbar relative">
                    <div className="max-w-[1920px] mx-auto h-full flex flex-col relative z-10">
                        {isLoading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <LoadingSpinner />
                            </div>
                        ) : (
                            <div className="animate-fade-in h-full">
                                <AppRouter />
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
                <LoadingSpinner />
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
            <AppContent />
        </RootProvider>
    );
}
