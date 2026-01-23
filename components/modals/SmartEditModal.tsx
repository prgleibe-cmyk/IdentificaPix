
import React, { useMemo } from 'react';
import { useSmartEditController } from './smart-edit/useSmartEditController';
import { SmartEditHeader } from './smart-edit/SmartEditHeader';
import { SmartEditInfo } from './smart-edit/SmartEditInfo';
import { SmartEditForm } from './smart-edit/SmartEditForm';
import { SmartEditSuggestions } from './smart-edit/SmartEditSuggestions';

export const SmartEditModal: React.FC = () => {
    const ctrl = useSmartEditController();

    const allContributors = useMemo(() => {
        return ctrl.contributorFiles.flatMap(file => {
            const church = ctrl.churches.find((c: any) => c.id === file.churchId);
            return file.contributors?.map(c => ({
                ...c, _churchName: church?.name || 'Desconhecida', _churchId: church?.id
            })) || [];
        });
    }, [ctrl.contributorFiles, ctrl.churches]);

    const availableBankTransactions = useMemo(() => {
        return ctrl.matchResults.filter((r: any) => r.status === 'NÃO IDENTIFICADO');
    }, [ctrl.matchResults]);

    if (!ctrl.smartEditTarget) return null;

    return (
        <div className="glass-overlay animate-fade-in">
            <div 
                ref={ctrl.modalRef} 
                style={{ 
                    position: ctrl.position ? 'fixed' : 'relative', 
                    left: ctrl.position ? ctrl.position.x : 'auto', 
                    top: ctrl.position ? ctrl.position.y : 'auto', 
                    zIndex: 100, 
                    transform: ctrl.position ? 'none' : undefined 
                }} 
                className="glass-modal w-[320px] flex flex-col max-h-[550px] animate-scale-in rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95"
            >
                <SmartEditHeader 
                    isReverseMode={ctrl.isReverseMode} 
                    onMouseDown={ctrl.handleMouseDown} 
                    onClose={ctrl.closeSmartEdit} 
                />
                
                <SmartEditInfo 
                    target={ctrl.smartEditTarget} 
                    isReverseMode={ctrl.isReverseMode} 
                    language={ctrl.language} 
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 bg-white dark:bg-slate-900">
                    <SmartEditForm 
                        isReverseMode={ctrl.isReverseMode}
                        isAiProposed={ctrl.isAiProposed}
                        manualChurchId={ctrl.manualChurchId}
                        setManualChurchId={ctrl.setManualChurchId}
                        manualType={ctrl.manualType}
                        setManualType={ctrl.setManualType}
                        manualPaymentMethod={ctrl.manualPaymentMethod}
                        setManualPaymentMethod={ctrl.setManualPaymentMethod}
                        churches={ctrl.churches}
                        contributionKeywords={ctrl.contributionKeywords}
                        paymentMethods={ctrl.paymentMethods}
                        onSave={ctrl.handleSaveManual}
                    />

                    <SmartEditSuggestions 
                        searchQuery={ctrl.searchQuery}
                        setSearchQuery={ctrl.setSearchQuery}
                        suggestions={ctrl.suggestions}
                        setSuggestions={ctrl.setSuggestions}
                        loadingAiId={ctrl.loadingAiId}
                        isReverseMode={ctrl.isReverseMode}
                        manualChurchId={ctrl.manualChurchId}
                        onSelect={ctrl.handleSelect}
                        target={ctrl.smartEditTarget}
                        allContributors={allContributors}
                        availableBankTransactions={availableBankTransactions}
                        effectiveIgnoreKeywords={ctrl.effectiveIgnoreKeywords}
                        churches={ctrl.churches}
                        language={ctrl.language}
                    />
                </div>
            </div>
        </div>
    );
};
