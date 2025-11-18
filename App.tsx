import React, { Suspense } from 'react';

// --- Contexts ---
import { AppProvider, AppContext } from './contexts/AppContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';

// --- Layout & Shared Components ---
import { Header } from './components/layout/Header';
import { Toast } from './components/shared/Toast';
import { LoadingSpinner } from './components/shared/LoadingSpinner';

// --- Modals ---
import { EditBankModal } from './components/modals/EditBankModal';
import { EditChurchModal } from './components/modals/EditChurchModal';
import { ManualIdModal } from './components/modals/ManualIdModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { ManualMatchModal } from './components/modals/ManualMatchModal';
import { SaveReportModal } from './components/modals/SaveReportModal';
import { SearchFiltersModal } from './components/modals/SearchFiltersModal';
import { DivergenceConfirmationModal } from './components/modals/DivergenceConfirmationModal';

// --- Views (Lazy Loaded for performance) ---
const DashboardView = React.lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const UploadView = React.lazy(() => import('./views/UploadView').then(m => ({ default: m.UploadView })));
const RegisterView = React.lazy(() => import('./views/RegisterView').then(m => ({ default: m.RegisterView })));
const ReportsView = React.lazy(() => import('./views/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = React.lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const SearchView = React.lazy(() => import('./views/SearchView').then(m => ({ default: m.SearchView })));
const SavedReportsView = React.lazy(() => import('./views/SavedReportsView').then(m => ({ default: m.SavedReportsView })));
import { AuthView } from './views/AuthView';

// --- Background Component (optimized) ---
const Background: React.FC = () => (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <style>{`
            .bg-light-mode { display: block; }
            .bg-dark-mode { display: none; }
            html.dark .bg-light-mode { display: none; }
            html.dark .bg-dark-mode { display: block; }
        `}</style>
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            <defs>
                {/* Light Mode */}
                <radialGradient id="light-grad" cx="50%" cy="30%" r="80%" fx="50%" fy="30%">
                    <stop offset="0%" stopColor="#dbeafe" />
                    <stop offset="100%" stopColor="#e2e8f0" />
                </radialGradient>
                <linearGradient id="grid-lines-light" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(56, 189, 248, 0.15)" />
                    <stop offset="100%" stopColor="rgba(99, 102, 241, 0.15)" />
                </linearGradient>

                {/* Dark Mode */}
                <radialGradient id="dark-grad" cx="50%" cy="30%" r="80%" fx="50%" fy="30%">
                    <stop offset="0%" stopColor="#172554" />
                    <stop offset="100%" stopColor="#020617" />
                </radialGradient>
                <linearGradient id="grid-lines-dark" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(59, 130, 246, 0.2)" />
                    <stop offset="100%" stopColor="rgba(129, 140, 248, 0.2)" />
                </linearGradient>

                <filter id="glow">
                    <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Light Mode */}
            <g className="bg-light-mode">
                <rect width="100%" height="100%" fill="url(#light-grad)" />
                <g opacity="0.7">
                    {[...Array(25)].map((_, i) => (
                        <line key={`lh-${i}`} x1={`${i * 4}%`} y1="0" x2={`${i * 4}%`} y2="100%" stroke="url(#grid-lines-light)" strokeWidth="0.5" />
                    ))}
                    {[...Array(25)].map((_, i) => (
                        <line key={`lv-${i}`} x1="0" y1={`${i * 4}%`} x2="100%" y2={`${i * 4}%`} stroke="url(#grid-lines-light)" strokeWidth="0.5" />
                    ))}
                </g>
            </g>

            {/* Dark Mode */}
            <g className="bg-dark-mode">
                <rect width="100%" height="100%" fill="url(#dark-grad)" />
                <g filter="url(#glow)" opacity="0.6">
                    {[...Array(25)].map((_, i) => (
                        <line key={`dh-${i}`} x1={`${i * 4}%`} y1="0" x2={`${i * 4}%`} y2="100%" stroke="url(#grid-lines-dark)" strokeWidth="1" />
                    ))}
                    {[...Array(25)].map((_, i) => (
                        <line key={`dv-${i}`} x1="0" y1={`${i * 4}%`} x2="100%" y2={`${i * 4}%`} stroke="url(#grid-lines-dark)" strokeWidth="1" />
                    ))}
                </g>
            </g>
        </svg>
    </div>
);

// --- Main Application Component ---
function MainApp() {
    const { 
        activeView, 
        isLoading, 
        toast,
        editingBank, 
        editingChurch, 
        manualIdentificationTx,
        deletingItem,
        aiSuggestion,
        manualMatchState,
        savingReportState,
        isSearchFiltersOpen,
        divergenceConfirmation,
    } = React.useContext(AppContext);

    const renderContent = () => {
        switch (activeView) {
            case 'dashboard': return <DashboardView />;
            case 'upload': return <UploadView />;
            case 'cadastro': return <RegisterView />;
            case 'reports': return <ReportsView />;
            case 'search': return <SearchView />;
            case 'savedReports': return <SavedReportsView />;
            case 'settings': return <SettingsView />;
            default: return <div className="text-center p-12">View not implemented.</div>;
        }
    };

    return (
        <div className="min-h-screen font-sans relative isolate">
            <Background />

            <style>{`
                @keyframes toast-fade-in-out {
                  0% { opacity: 0; transform: translateY(-20px); }
                  10% { opacity: 1; transform: translateY(0); }
                  90% { opacity: 1; transform: translateY(0); }
                  100% { opacity: 0; transform: translateY(-20px); }
                }
                .animate-toast-fade-in-out {
                  animation: toast-fade-in-out 3s ease-in-out forwards;
                }
                @keyframes simple-fade-in {
                  from { opacity: 0; transform: scale(0.95); }
                  to { opacity: 1; transform: scale(1); }
                }
                .animate-simple-fade-in {
                  animation: simple-fade-in 0.2s ease-out forwards;
                }
            `}</style>

            <Header />

            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0">
                {aiSuggestion && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-4 mb-6 rounded-r-md shadow-sm dark:bg-sky-900/40 dark:border-sky-500 dark:text-sky-200" role="alert">
                        <p className="font-bold">Sugestão da IA para Transação ID {aiSuggestion.id.split('-').pop()}:</p>
                        <p>{aiSuggestion.name}</p>
                    </div>
                )}
                <Suspense fallback={<LoadingSpinner />}>
                    {isLoading ? <LoadingSpinner /> : renderContent()}
                </Suspense>
            </main>

            {toast && <Toast message={toast.message} type={toast.type} />}
            {editingBank && <EditBankModal />}
            {editingChurch && <EditChurchModal />}
            {manualIdentificationTx && <ManualIdModal />}
            {deletingItem && <ConfirmDeleteModal />}
            {manualMatchState && <ManualMatchModal />}
            {savingReportState && <SaveReportModal />}
            {isSearchFiltersOpen && <SearchFiltersModal />}
            {divergenceConfirmation && <DivergenceConfirmationModal />}
        </div>
    );
}

// --- App Controller ---
const AppController: React.FC = () => {
    const { session, loading } = useAuth();

    if (loading) return <LoadingSpinner />;
    if (!session) return <AuthView />;

    return (
        <AppProvider>
            <MainApp />
        </AppProvider>
    );
}

// --- Root Component ---
export default function App() {
    return (
        <I18nProvider>
            <AuthProvider>
                <AppController />
            </AuthProvider>
        </I18nProvider>
    );
}
