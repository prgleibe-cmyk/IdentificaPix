import './index.css';
import React from 'react';

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

// --- Views (Lazy Loaded for performance) ---
const DashboardView = React.lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const UploadView = React.lazy(() => import('./views/UploadView').then(m => ({ default: m.UploadView })));
const RegisterView = React.lazy(() => import('./views/RegisterView').then(m => ({ default: m.RegisterView })));
const ReportsView = React.lazy(() => import('./views/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = React.lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const SavedReportsView = React.lazy(() => import('./views/SavedReportsView').then(m => ({ default: m.SavedReportsView })));
const SearchView = React.lazy(() => import('./views/SearchView').then(m => ({ default: m.SearchView })));
import { AuthView } from './views/AuthView';

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
    } = React.useContext(AppContext);

    const renderContent = () => {
        switch (activeView) {
            case 'dashboard': return <DashboardView />;
            case 'upload': return <UploadView />;
            case 'cadastro': return <RegisterView />;
            case 'reports': return <ReportsView />;
            case 'savedReports': return <SavedReportsView />;
            case 'settings': return <SettingsView />;
            case 'search': return <SearchView />;
            default: return <div className="text-center p-12">View not implemented.</div>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 font-sans">
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
                <React.Suspense fallback={<LoadingSpinner />}>
                    {isLoading ? <LoadingSpinner /> : renderContent()}
                </React.Suspense>
            </main>

            {toast && <Toast message={toast.message} type={toast.type} />}
            {editingBank && <EditBankModal />}
            {editingChurch && <EditChurchModal />}
            {manualIdentificationTx && <ManualIdModal />}
            {deletingItem && <ConfirmDeleteModal />}
            {manualMatchState && <ManualMatchModal />}
            {savingReportState && <SaveReportModal />}
            {isSearchFiltersOpen && <SearchFiltersModal />}
        </div>
    );
}

// --- App Controller ---
const AppController: React.FC = () => {
    const { session, loading } = useAuth();

    if (loading) {
        return <LoadingSpinner />;
    }

    if (!session) {
        return <AuthView />;
    }

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
