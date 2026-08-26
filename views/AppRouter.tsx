
import React, { useContext, Suspense, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppContext } from '../contexts/AppContext';

// --- Safe Lazy Wrapper for Code-Splitting & Chunk Auto-Recovery ---
const viewImports: Record<string, () => Promise<any>> = {
    dashboard: () => import('./DashboardView'),
    upload: () => import('./UploadView'),
    cadastro: () => import('./RegisterView'),
    reports: () => import('./ReportsView'),
    relatorios: () => import('./RelatoriosView'),
    livro_caixa: () => import('./LivroCaixaView'),
    settings: () => import('./SettingsView'),
    search: () => import('./SearchView'),
    savedReports: () => import('./SavedReportsView'),
    admin: () => import('./AdminView'),
    smart_analysis: () => import('./SmartAnalysisView'),
    users: () => import('./UsersManagementPage'),
    launched: () => import('./LaunchedView'),
    connectors: () => import('./ConnectorsView'),
    financial: () => import('./FinancialView'),
    pledges: () => import('./PledgesView'),
    patrimonio: () => import('./PatrimonyView'),
};

export const preloadView = (viewKey: string) => {
    try {
        const loader = viewImports[viewKey];
        if (loader) loader().catch(() => {});
    } catch (_) {}
};

export const preloadAllViews = () => {
    try {
        if (typeof window === 'undefined') return;
        const idleCallback = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 100));
        idleCallback(() => {
            Object.values(viewImports).forEach(fn => fn().catch(() => {}));
        });
    } catch (_) {}
};

const safeLazy = (importFn: () => Promise<any>) => {
    return React.lazy(async () => {
        try {
            return await importFn();
        } catch (error: any) {
            console.error('[AppRouter] Dynamic chunk load error:', error);
            const errorMsg = String(error?.message || error || '');
            const isChunkError = errorMsg.includes('Failed to fetch dynamically imported module') ||
                                 errorMsg.includes('Loading chunk') ||
                                 errorMsg.includes('import');
            
            if (isChunkError) {
                const reloadKey = 'identificapix_chunk_load_retry';
                if (!sessionStorage.getItem(reloadKey)) {
                    sessionStorage.setItem(reloadKey, 'true');
                    if ('caches' in window) {
                        try {
                            const keys = await caches.keys();
                            await Promise.all(keys.map(k => caches.delete(k)));
                        } catch (e) {}
                    }
                    if ('serviceWorker' in navigator) {
                        try {
                            const regs = await navigator.serviceWorker.getRegistrations();
                            for (const r of regs) await r.update();
                        } catch (e) {}
                    }
                    window.location.reload();
                    return new Promise(() => {});
                }
                sessionStorage.removeItem(reloadKey);
            }
            throw error;
        }
    });
};

// --- Lazy-Loaded Views for Fast Navigation and Code-Splitting ---
const DashboardView = safeLazy(() => viewImports.dashboard().then(m => ({ default: m.DashboardView })));
const UploadView = safeLazy(() => viewImports.upload().then(m => ({ default: m.UploadView })));
const RegisterView = safeLazy(() => viewImports.cadastro().then(m => ({ default: m.RegisterView })));
const ReportsView = safeLazy(() => viewImports.reports().then(m => ({ default: m.ReportsView })));
const RelatoriosView = safeLazy(() => viewImports.relatorios().then(m => ({ default: m.RelatoriosView })));
const LivroCaixaView = safeLazy(() => viewImports.livro_caixa().then(m => ({ default: m.LivroCaixaView })));
const SettingsView = safeLazy(() => viewImports.settings().then(m => ({ default: m.SettingsView })));
const SearchView = safeLazy(() => viewImports.search().then(m => ({ default: m.SearchView })));
const SavedReportsView = safeLazy(() => viewImports.savedReports().then(m => ({ default: m.SavedReportsView })));
const AdminView = safeLazy(() => viewImports.admin().then(m => ({ default: m.AdminView })));
const SmartAnalysisView = safeLazy(() => viewImports.smart_analysis().then(m => ({ default: m.SmartAnalysisView })));
const UsersManagementPage = safeLazy(() => viewImports.users().then(m => ({ default: m.UsersManagementPage })));
const LaunchedView = safeLazy(() => viewImports.launched().then(m => ({ default: m.LaunchedView })));
const ConnectorsView = safeLazy(() => viewImports.connectors().then(m => ({ default: m.ConnectorsView })));
const FinancialView = safeLazy(() => viewImports.financial().then(m => ({ default: m.FinancialView })));
const PledgesView = safeLazy(() => viewImports.pledges().then(m => ({ default: m.PledgesView })));
const PatrimonyView = safeLazy(() => viewImports.patrimonio().then(m => ({ default: m.PatrimonyView })));

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
    const { user, subscription, isSecondaryUser } = useAuth();

    // Preload views on-demand instead of aggressively loading all 17 heavy views concurrently on startup
    React.useEffect(() => {
        // Only preload the most likely next views if browser has idle time, avoiding memory exhaustion on mobile
        try {
            if (typeof window !== 'undefined' && (window as any).requestIdleCallback) {
                (window as any).requestIdleCallback(() => {
                    preloadView('upload');
                    preloadView('reports');
                }, { timeout: 2000 });
            }
        } catch (_) {}
    }, []);

    const isAdmin = user?.email?.toLowerCase().trim() === 'identificapix@gmail.com';
    const isOwner = subscription?.role === 'owner';

    const perms = (subscription?.permissions || {}) as Record<string, any>;
    const canManageAccounts = !isSecondaryUser || (perms.gestao_contas !== false && perms.manageAccounts !== false);
    const canManagePledges = !isSecondaryUser || (perms.carnes_propositos !== false && perms.managePledges !== false);
    const canManagePatrimony = !isSecondaryUser || (perms.patrimonio !== false && perms.managePatrimony !== false);

    const renderView = () => {
        switch (activeView) {
            case 'dashboard': return <DashboardView />;
            case 'upload': return !isSecondaryUser ? <UploadView /> : <DashboardView />;
            case 'cadastro': return <RegisterView />;
            case 'reports': return <ReportsView />;
            case 'relatorios': return !isSecondaryUser ? <RelatoriosView /> : <DashboardView />;
            case 'livro_caixa': return <LivroCaixaView />;
            case 'search': return <SearchView />;
            case 'savedReports': return !isSecondaryUser ? <SavedReportsView /> : <DashboardView />;
            case 'settings': return !isSecondaryUser ? <SettingsView /> : <DashboardView />;
            case 'smart_analysis': return !isSecondaryUser ? <SmartAnalysisView /> : <DashboardView />;
            case 'launched': return <LaunchedView />;
            case 'connectors': return <ConnectorsView />;
            case 'financial': return canManageAccounts ? <FinancialView /> : <DashboardView />;
            case 'pledges': return canManagePledges ? <PledgesView /> : <DashboardView />;
            case 'patrimonio': return (!isSecondaryUser && canManagePatrimony) ? <PatrimonyView /> : <DashboardView />;
            case 'novo_lancamento': return <ManualIdModal />;
            case 'users': return (isOwner && !isSecondaryUser) ? <UsersManagementPage /> : <DashboardView />;
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
