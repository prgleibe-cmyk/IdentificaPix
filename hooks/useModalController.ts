
import { useState, useCallback } from 'react';
import { MatchResult, DeletingItem } from '../types';

export const useModalController = () => {
    // --- States ---
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isUpdateFilesModalOpen, setIsUpdateFilesModalOpen] = useState(false);
    const [smartEditTarget, setSmartEditTarget] = useState<MatchResult | null>(null);
    const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
    const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);

    // --- Actions ---
    const openPaymentModal = useCallback(() => setIsPaymentModalOpen(true), []);
    const closePaymentModal = useCallback(() => setIsPaymentModalOpen(false), []);
    
    const openUpdateFilesModal = useCallback(() => setIsUpdateFilesModalOpen(true), []);
    const closeUpdateFilesModal = useCallback(() => setIsUpdateFilesModalOpen(false), []);

    const openSmartEdit = useCallback((target: MatchResult) => setSmartEditTarget(target), []);
    const closeSmartEdit = useCallback(() => setSmartEditTarget(null), []);

    const openDeleteConfirmation = useCallback((item: DeletingItem) => setDeletingItem(item), []);
    const closeDeleteConfirmation = useCallback(() => setDeletingItem(null), []);

    const openSearchFilters = useCallback(() => setIsSearchFiltersOpen(true), []);
    const closeSearchFilters = useCallback(() => setIsSearchFiltersOpen(false), []);

    return {
        isPaymentModalOpen,
        openPaymentModal,
        closePaymentModal,
        isUpdateFilesModalOpen,
        openUpdateFilesModal,
        closeUpdateFilesModal,
        smartEditTarget,
        openSmartEdit,
        closeSmartEdit,
        deletingItem,
        openDeleteConfirmation,
        closeDeleteConfirmation,
        isSearchFiltersOpen,
        openSearchFilters,
        closeSearchFilters
    };
};
