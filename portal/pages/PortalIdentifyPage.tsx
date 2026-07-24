import React from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalIdentifyStep } from './PortalIdentifyStep';
import { usePortalWizard } from '../hooks/usePortalWizard';

interface PortalIdentifyPageProps {
    onNavigate: (route: string, params?: Record<string, string>) => void;
}

export const PortalIdentifyPage: React.FC<PortalIdentifyPageProps> = ({ onNavigate }) => {
    const {
        wizardState,
        isSearching,
        isSaving,
        apiError,
        setIdentificationType,
        setIdentificationValue,
        performSearchContributor,
        updateContributor,
        saveContributor,
        setMockSearchFound
    } = usePortalWizard();

    return (
        <PortalContainer maxWidth="7xl">
            <PortalIdentifyStep
                identificationType={wizardState.identificationType}
                identificationValue={wizardState.identificationValue}
                contributor={wizardState.contributor}
                mockSearchFound={wizardState.mockSearchFound}
                isSearching={isSearching}
                isSaving={isSaving}
                apiError={apiError}
                onTypeChange={setIdentificationType}
                onValueChange={setIdentificationValue}
                onPerformSearch={() => performSearchContributor()}
                onUpdateContributor={updateContributor}
                onSaveContributor={() => saveContributor()}
                onMockSearchToggle={setMockSearchFound}
                onContinue={() => onNavigate('home')}
            />
        </PortalContainer>
    );
};
