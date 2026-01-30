
import React, { useContext } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppContext } from '../contexts/AppContext';

// --- Views ---
import { DashboardView } from './DashboardView';
import { UploadView } from './UploadView';
import { RegisterView } from './RegisterView';
import { ReportsView } from './ReportsView';
import { SettingsView } from './SettingsView';
import { SearchView } from './SearchView';
import { SavedReportsView } from './SavedReportsView';
import { AdminView } from './AdminView';
import { SmartAnalysisView } from './SmartAnalysisView';
import { LaunchedView } from './LaunchedView';

// --- Modals ---
import { EditBankModal } from '../components/modals/EditBankModal';
import { EditChurchModal } from '../components/modals/EditChurchModal';
import { ManualIdModal } from '../components/modals/ManualIdModal';
import { ConfirmDeleteModal } from '../components/modals/ConfirmDeleteModal';
import { ManualMatchModal } from '../components/modals/ManualMatchModal';
import { SaveReportModal } from '../components/modals/SaveReportModal';
import { SearchFiltersModal } from '../components/modals/SearchFiltersModal';
import { DivergenceConfirmationModal } from '../components/modals/DivergenceConfirmationModal';
import { PaymentModal } from '../components/modals/PaymentModal';
import { FilePreprocessorModal } from '../components/modals/FilePreprocessorModal';
import { SmartEditModal } from '../components/modals/SmartEditModal';
import { ModelRequiredModal } from '../components/modals/ModelRequiredModal';

export const AppRouter: React.FC = () => {
    const { activeView } = useUI();
    const { user } = useAuth();
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
        case 'launched': return <LaunchedView />;
        case 'admin': return isAdmin ? <AdminView /> : <DashboardView />;
        default: return <DashboardView />;
    }
};

export const ModalsRenderer: React.FC = () => {
    const context = useContext(AppContext);
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
        isPaymentModalOpen,
        pendingTraining,
        setPendingTraining,
        handleTrainingSuccess,
        smartEditTarget,
        modelRequiredData
    } = context;

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
            {pendingTraining && (
                <FilePreprocessorModal 
                    onClose={() => setPendingTraining(null)}
                    initialFile={pendingTraining}
                    onSuccess={handleTrainingSuccess}
                />
            )}
            {smartEditTarget && <SmartEditModal />}
            {modelRequiredData && <ModelRequiredModal />}
        </>
    );
};
