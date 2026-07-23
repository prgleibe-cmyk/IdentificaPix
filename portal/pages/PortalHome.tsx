import React from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalStepper } from '../components/PortalStepper';
import { usePortalWizard } from '../hooks/usePortalWizard';
import { PortalIdentifyStep } from './PortalIdentifyStep';
import { PortalContributorStep } from './PortalContributorStep';
import { PortalContributionsStep } from './PortalContributionsStep';
import { PortalSummaryStep } from './PortalSummaryStep';
import { PortalPaymentStep } from './PortalPaymentStep';
import { PortalSuccessStep } from './PortalSuccessStep';
import { PortalChurch } from '../types/portal';

interface PortalHomeProps {
    church?: PortalChurch | null;
    onNavigate?: (route: string, params?: Record<string, string>) => void;
}

export const PortalHome: React.FC<PortalHomeProps> = ({ church }) => {
    const {
        wizardState,
        isSearching,
        isSaving,
        apiError,
        setStep,
        nextStep,
        prevStep,
        setIdentificationType,
        setIdentificationValue,
        performSearchContributor,
        saveContributor,
        createContributionRequest,
        setMockSearchFound,
        updateContributor,
        toggleItemSelection,
        setItemAmount,
        getTotalAmount,
        resetWizard
    } = usePortalWizard(church?.id);

    const renderStepContent = () => {
        switch (wizardState.step) {
            case 1:
                return (
                    <PortalIdentifyStep
                        identificationType={wizardState.identificationType}
                        identificationValue={wizardState.identificationValue}
                        mockSearchFound={wizardState.mockSearchFound}
                        isSearching={isSearching}
                        apiError={apiError}
                        onTypeChange={setIdentificationType}
                        onValueChange={setIdentificationValue}
                        onPerformSearch={() => performSearchContributor(church?.id)}
                        onMockSearchToggle={setMockSearchFound}
                        onContinue={nextStep}
                    />
                );
            case 2:
                return (
                    <PortalContributorStep
                        contributor={wizardState.contributor}
                        mockSearchFound={wizardState.mockSearchFound}
                        isSaving={isSaving}
                        apiError={apiError}
                        onUpdateContributor={updateContributor}
                        onSaveContributor={() => saveContributor(church?.id)}
                        onBack={prevStep}
                        onContinue={nextStep}
                    />
                );
            case 3:
                return (
                    <PortalContributionsStep
                        items={wizardState.contributionItems}
                        onToggleItem={toggleItemSelection}
                        onSetAmount={setItemAmount}
                        totalAmount={getTotalAmount()}
                        onBack={prevStep}
                        onContinue={nextStep}
                    />
                );
            case 4:
                return (
                    <PortalSummaryStep
                        contributor={wizardState.contributor}
                        items={wizardState.contributionItems}
                        totalAmount={getTotalAmount()}
                        referenceNumber={wizardState.referenceNumber}
                        isSaving={isSaving}
                        apiError={apiError}
                        onBack={prevStep}
                        onContinue={async () => {
                            const ok = await createContributionRequest(church?.id);
                            if (ok) {
                                nextStep();
                            }
                        }}
                    />
                );
            case 5:
                return (
                    <PortalPaymentStep
                        churchId={church?.id}
                        requestId={wizardState.contributionRequestId}
                        totalAmount={getTotalAmount()}
                        referenceNumber={wizardState.referenceNumber}
                        items={wizardState.contributionItems}
                        onBack={prevStep}
                        onFinish={nextStep}
                    />
                );
            case 6:
                return (
                    <PortalSuccessStep
                        churchId={church?.id}
                        requestId={wizardState.contributionRequestId}
                        contributor={wizardState.contributor}
                        items={wizardState.contributionItems}
                        totalAmount={getTotalAmount()}
                        referenceNumber={wizardState.referenceNumber}
                        onReset={resetWizard}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <PortalContainer maxWidth="lg">
            {/* Header / Intro banner */}
            <div className="text-center mb-6 sm:mb-8">
                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-brand-blue dark:text-blue-400 rounded-full inline-block mb-2">
                    {church?.name || 'Igreja Local'} &bull; Portal do Contribuinte
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                    Intenção de Contribuição Online
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                    Plataforma Oficial de Contribuição e Ofertas IgGestor
                </p>
            </div>

            {/* Stepper progress indicator */}
            <PortalStepper currentStep={wizardState.step} onStepClick={(step) => setStep(step)} />

            {/* Active Step Page Render */}
            <div className="transition-all duration-300">
                {renderStepContent()}
            </div>
        </PortalContainer>
    );
};
