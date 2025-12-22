
import React, { ReactNode } from 'react';

// --- Contexts ---
import { AppProvider, AppContext } from './contexts/AppContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { UIProvider, useUI } from './contexts/UIContext';

// --- Layout & Shared Components ---
import { Sidebar } from './components/layout/Sidebar';
// Header removed as per request
import { Toast } from './components/shared/Toast';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { ExclamationTriangleIcon } from './components/Icons';

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

// --- Views ---
import { AuthView } from './views/AuthView';
import { DashboardView } from './views/DashboardView';
import { UploadView } from './views/UploadView';
import { RegisterView } from './views/RegisterView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { SearchView } from './views/SearchView';
import { SavedReportsView } from './views/SavedReportsView';
import { AdminView } from './views/AdminView';
import { SmartAnalysisView } from './views/SmartAnalysisView';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4">
            <div className="bg-white p-8 rounded-2xl shadow-card text-center max-w-md border border-red-100">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-xl font-display font-bold text-brand-graphite mb-2">Algo deu errado</h2>
                <p className="text-slate-500 mb-6">Ocorreu um erro inesperado. Tente recarregar a página.</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-brand-blue text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">Recarregar</button>
            </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Modals Renderer Helper ---
const ModalsRenderer = () => {
    const context = React.useContext(AppContext);
    if (!context) return null;

    const {
        editingBank, 
        editingChurch, 
        manualIdentificationTx, 
        bulkIdentificationTxs,
        deletingItem, 
        manualMatchState, 
        savingReportState, 
        isSearchFiltersOpen, 
        divergenceConfirmation,
        isPaymentModalOpen
    } = context;

    if (
        !editingBank && 
        !editingChurch && 
        !manualIdentificationTx && 
        !bulkIdentificationTxs && 
        !deletingItem && 
        !manualMatchState && 
        !savingReportState && 
        !isSearchFiltersOpen && 
        !divergenceConfirmation && 
        !isPaymentModalOpen
    ) {
        return null;
    }

    return (
        <>
            {editingBank && <EditBankModal />}
            {editingChurch && <EditChurchModal />}
            {(manualIdentificationTx || bulkIdentificationTxs) && <ManualIdModal />}
            {deletingItem && <ConfirmDeleteModal />}
            {manualMatchState && <ManualMatchModal />}
            {savingReportState && <SaveReportModal />}
            {isSearchFiltersOpen && <SearchFiltersModal />}
            {divergenceConfirmation && <DivergenceConfirmationModal />}
            {isPaymentModalOpen && <PaymentModal />}
        </>
    );
};

// --- View Router ---
const ViewRouter = () => {
    const { activeView } = useUI();
    const { user } = useAuth();

    // Robust check: Lowercase comparison to ensure access matches regardless of casing
    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';
    
    switch (activeView) {
        case 'dashboard': return <DashboardView />;
        case 'upload': return <UploadView />;
        case 'cadastro': return <RegisterView />;
        case 'reports': return <ReportsView />;
        case 'search': return <SearchView />;
        case 'savedReports': return <SavedReportsView />;
        case 'settings': return <SettingsView />;
        case 'smart_analysis': return <SmartAnalysisView />;
        case 'admin': return isAdmin ? <AdminView /> : <DashboardView />;
        default: return <DashboardView />;
    }
};

// --- Main Application Layout ---
const MainAppContent = () => {
    const { isLoading, toast } = useUI();
    const context = React.useContext(AppContext);
    
    if (!context) return <LoadingSpinner />;

    const { initialDataLoaded } = context;

    if (!initialDataLoaded) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-brand-deep">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#0B1120] font-sans overflow-hidden">
            {/* Sidebar is fixed height, main content scrolls */}
            <Sidebar />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Header Removed for cleaner look */}
                
                <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth z-10 custom-scrollbar relative">
                    {/* Header Gradient Decoration - Subtle ambient light */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-brand-blue/5 to-transparent pointer-events-none z-0"></div>
                    
                    <div className="max-w-[1600px] mx-auto h-full flex flex-col relative z-10">
                        {isLoading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <LoadingSpinner />
                            </div>
                        ) : (
                            <div className="animate-fade-in h-full">
                                <ViewRouter />
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

// --- App Controller ---
const AppController: React.FC = () => {
    const { session, loading } = useAuth();

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
        <ErrorBoundary>
            <UIProvider>
                <AppProvider>
                    <MainAppContent />
                </AppProvider>
            </UIProvider>
        </ErrorBoundary>
    );
}

export default function App() {
    return (
        <I18nProvider>
            <AuthProvider>
                <AppController />
            </AuthProvider>
        </I18nProvider>
    );
}
