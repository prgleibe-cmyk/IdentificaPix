
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
import { UsersManagementPage } from './UsersManagementPage';
import { LaunchedView } from './LaunchedView';
import { ConnectorsView } from './ConnectorsView';
import { FinancialView } from './FinancialView';
import { PledgesView } from './PledgesView';
import { PatrimonyView } from './PatrimonyView';

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

export const AppRouter: React.FC = () => {
    const { activeView } = useUI();
    const { user, subscription } = useAuth();
    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';
    const isOwner = subscription.role === 'owner';
    
    const isSecondaryUser = (subscription.ownerId && subscription.ownerId !== user?.id) &&
        subscription.role !== 'owner' &&
        subscription.role !== 'admin' &&
        subscription.role !== 'principal';

    const perms = (subscription.permissions || {}) as Record<string, any>;
    const canManageAccounts = !isSecondaryUser || (perms.gestao_contas !== false && perms.manageAccounts !== false);
    const canManagePledges = !isSecondaryUser || (perms.carnes_propositos !== false && perms.managePledges !== false);
    const canManagePatrimony = !isSecondaryUser || (perms.patrimonio !== false && perms.managePatrimony !== false);

    switch (activeView) {
        case 'dashboard': return <DashboardView />;
        case 'upload': return <UploadView />;
        case 'cadastro': return isOwner ? <RegisterView /> : <DashboardView />;
        case 'reports': return <ReportsView />;
        case 'search': return <SearchView />;
        case 'savedReports': return <SavedReportsView />;
        case 'settings': return <SettingsView />;
        case 'smart_analysis': return <SmartAnalysisView />;
        case 'launched': return <LaunchedView />;
        case 'connectors': return <ConnectorsView />;
        case 'financial': return canManageAccounts ? <FinancialView /> : <DashboardView />;
        case 'pledges': return canManagePledges ? <PledgesView /> : <DashboardView />;
        case 'patrimonio': return canManagePatrimony ? <PatrimonyView /> : <DashboardView />;
        case 'novo_lancamento': return <ManualIdModal />;
        case 'users': return isOwner ? <UsersManagementPage /> : <DashboardView />;
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
        bulkIdentificationTxs,
        deletingItem, 
        manualMatchState, 
        savingReportState, 
        isSearchFiltersOpen, 
        divergenceConfirmation,
        isPaymentModalOpen
    } = context;

    return (
        <>
            {editingBank && <EditBankModal />}
            {editingChurch && <EditChurchModal />}
            {bulkIdentificationTxs && bulkIdentificationTxs.length > 0 && !bulkIdentificationTxs.some(tx => tx.id.startsWith('ghost-manual-')) && <ManualIdModal />}
            {deletingItem && <ConfirmDeleteModal />}
            {manualMatchState && <ManualMatchModal />}
            {savingReportState && <SaveReportModal />}
            {isSearchFiltersOpen && <SearchFiltersModal />}
            {divergenceConfirmation && <DivergenceConfirmationModal />}
            {isPaymentModalOpen && <PaymentModal />}
        </>
    );
};
