
import React from 'react';

// --- Contexts ---
import { AppProvider, AppContext } from './contexts/AppContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { UIProvider, useUI } from './contexts/UIContext';

// --- Layout & Shared Components ---
import { Header } from './components/layout/Header';
import { Toast } from './components/shared/Toast';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { LockClosedIcon, ExclamationTriangleIcon } from './components/Icons';

// --- Modals ---
import { EditBankModal } from './components/modals/EditBankModal';
import { EditChurchModal } from './components/modals/EditChurchModal';
import { ManualIdModal } from './components/modals/ManualIdModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { ManualMatchModal } from './components/modals/ManualMatchModal';
import { SaveReportModal } from './components/modals/SaveReportModal';
import { SearchFiltersModal } from './components/modals/SearchFiltersModal';
import { DivergenceConfirmationModal } from './components/modals/DivergenceConfirmationModal';
import { PaymentModal } from './components/modals/PaymentModal';


// --- Views (Lazy Loaded for performance) ---
const DashboardView = React.lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const UploadView = React.lazy(() => import('./views/UploadView').then(m => ({ default: m.UploadView })));
const RegisterView = React.lazy(() => import('./views/RegisterView').then(m => ({ default: m.RegisterView })));
const ReportsView = React.lazy(() => import('./views/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = React.lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const SearchView = React.lazy(() => import('./views/SearchView').then(m => ({ default: m.SearchView })));
const SavedReportsView = React.lazy(() => import('./views/SavedReportsView').then(m => ({ default: m.SavedReportsView })));
const AdminView = React.lazy(() => import('./views/AdminView').then(m => ({ default: m.AdminView })));
import { AuthView } from './views/AuthView';

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
                <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">Algo deu errado</h2>
                <p className="text-slate-500 mb-6">Ocorreu um erro inesperado na aplicação. Tente recarregar a página.</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Recarregar</button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Blocked View Component ---
const BlockedView = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 text-center border border-red-100 dark:border-red-900/30">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <LockClosedIcon className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Acesso Suspenso</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                Sua conta foi temporariamente bloqueada pela administração. Entre em contato com o suporte para regularizar sua situação.
            </p>
            <button 
                onClick={() => window.location.href = 'mailto:suporte@identificapix.com'}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl transition-all hover:scale-[1.02]"
            >
                Contatar Suporte
            </button>
        </div>
    </div>
);

// --- Main Application Component ---
function MainApp() {
    const { 
        activeView, 
        isLoading, 
        toast,
    } = useUI();
    
    const {
        editingBank, 
        editingChurch, 
        manualIdentificationTx,
        deletingItem,
        aiSuggestion,
        manualMatchState,
        savingReportState,
        isSearchFiltersOpen,
        divergenceConfirmation,
        isPaymentModalOpen,
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
            case 'admin': return <AdminView />;
            default: return <div className="text-center p-12 text-slate-500">View not implemented.</div>;
        }
    };

    return (
        <div className="min-h-screen font-sans flex flex-col bg-slate-50 dark:bg-[#0f172a] transition-colors duration-300 relative overflow-x-hidden selection:bg-indigo-500 selection:text-white">
            
            {/* Premium Background System - Light Tonality with Dispersed Elements */}
            <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
                {/* Noise Texture for consistency */}
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
                
                {/* Lighter Gradient Blobs for the 'Dispersed Elements' look */}
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-100/50 dark:bg-indigo-900/20 blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-100/50 dark:bg-blue-900/20 blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-[30%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-purple-100/40 dark:bg-violet-900/10 blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
            </div>

            <Header />

            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-4 relative z-10 h-full flex flex-col">
                {aiSuggestion && (
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-indigo-100 dark:border-indigo-800 shadow-xl shadow-indigo-500/10 rounded-2xl px-6 py-4 mb-4 flex items-start gap-4 animate-fade-in-down ring-1 ring-white/50 dark:ring-white/5 flex-shrink-0">
                        <div className="flex-shrink-0 mt-0.5 p-2.5 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl text-white shadow-md">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <p className="font-bold text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">Sugestão Inteligente</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                Transação #{aiSuggestion.id.split('-').pop()}: <span className="font-bold text-slate-900 dark:text-white">{aiSuggestion.name}</span>
                            </p>
                        </div>
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
            {divergenceConfirmation && <DivergenceConfirmationModal />}
            {isPaymentModalOpen && <PaymentModal />}
        </div>
    );
}

// --- App Controller ---
const AppController: React.FC = () => {
    const { session, loading, subscription } = useAuth();

    if (loading) {
        return <LoadingSpinner />;
    }

    if (!session) {
        return <AuthView />;
    }

    // Security Check: Block access if user is marked as blocked
    if (subscription.isBlocked) {
        return <BlockedView />;
    }

    return (
        <UIProvider>
            <AppProvider>
                <ErrorBoundary>
                    <MainApp />
                </ErrorBoundary>
            </AppProvider>
        </UIProvider>
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
