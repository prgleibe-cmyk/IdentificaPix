
import React, { useContext, Suspense, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppContext } from '../contexts/AppContext';

// --- Lazy-Loaded Views for Fast Navigation and Code-Splitting ---
const DashboardView = React.lazy(() => import('./DashboardView').then(m => ({ default: m.DashboardView })));
const UploadView = React.lazy(() => import('./UploadView').then(m => ({ default: m.UploadView })));
const RegisterView = React.lazy(() => import('./RegisterView').then(m => ({ default: m.RegisterView })));
const RelatoriosView = React.lazy(() => import('./RelatoriosView').then(m => ({ default: m.RelatoriosView })));
const LivroCaixaView = React.lazy(() => import('./LivroCaixaView').then(m => ({ default: m.LivroCaixaView })));
const SettingsView = React.lazy(() => import('./SettingsView').then(m => ({ default: m.SettingsView })));
const SearchView = React.lazy(() => import('./SearchView').then(m => ({ default: m.SearchView })));
const SavedReportsView = React.lazy(() => import('./SavedReportsView').then(m => ({ default: m.SavedReportsView })));
const AdminView = React.lazy(() => import('./AdminView').then(m => ({ default: m.AdminView })));
const SmartAnalysisView = React.lazy(() => import('./SmartAnalysisView').then(m => ({ default: m.SmartAnalysisView })));
const UsersManagementPage = React.lazy(() => import('./UsersManagementPage').then(m => ({ default: m.UsersManagementPage })));
const LaunchedView = React.lazy(() => import('./LaunchedView').then(m => ({ default: m.LaunchedView })));
const ConnectorsView = React.lazy(() => import('./ConnectorsView').then(m => ({ default: m.ConnectorsView })));
const FinancialView = React.lazy(() => import('./FinancialView').then(m => ({ default: m.FinancialView })));
const PledgesView = React.lazy(() => import('./PledgesView').then(m => ({ default: m.PledgesView })));
const PatrimonyView = React.lazy(() => import('./PatrimonyView').then(m => ({ default: m.PatrimonyView })));

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
import { WhatsAppReceiptModal } from '../components/modals/WhatsAppReceiptModal';

const ViewFallback: React.FC = () => (
    <div className="w-full h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-7 w-7 border-3 border-orange-500 border-t-transparent"></div>
    </div>
);

export const AppRouter: React.FC = memo(() => {
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

    const renderView = () => {
        switch (activeView) {
            case 'dashboard': return <DashboardView />;
            case 'upload': return <UploadView />;
            case 'cadastro': return isOwner ? <RegisterView /> : <DashboardView />;
            case 'reports': return <RelatoriosView />;
            case 'relatorios': return <RelatoriosView />;
            case 'livro_caixa': return <LivroCaixaView />;
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

    return (
        <Suspense fallback={<ViewFallback />}>
            {renderView()}
        </Suspense>
    );
});

export const ModalsRenderer: React.FC = memo(() => {
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
        isPaymentModalOpen,
        isWhatsAppReceiptModalOpen,
        whatsAppReceiptData,
        closeWhatsAppReceiptModal
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
            {isWhatsAppReceiptModalOpen && whatsAppReceiptData && (
                <WhatsAppReceiptModal
                    isOpen={isWhatsAppReceiptModalOpen}
                    onClose={closeWhatsAppReceiptModal}
                    data={whatsAppReceiptData}
                />
            )}
        </>
    );
});
