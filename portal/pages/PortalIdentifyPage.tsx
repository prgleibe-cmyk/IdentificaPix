import React from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalIdentifyStep } from './PortalIdentifyStep';
import { usePortalWizard } from '../hooks/usePortalWizard';
import { PortalChurch } from '../types/portal';

interface PortalIdentifyPageProps {
    church?: PortalChurch | null;
    onNavigate: (route: string, params?: Record<string, string>) => void;
}

export const PortalIdentifyPage: React.FC<PortalIdentifyPageProps> = ({ church, onNavigate }) => {
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
    } = usePortalWizard(church?.id, church?.name);

    return (
        <PortalContainer maxWidth="7xl">
            <PortalIdentifyStep
                church={church}
                identificationType={wizardState.identificationType}
                identificationValue={wizardState.identificationValue}
                contributor={wizardState.contributor}
                mockSearchFound={wizardState.mockSearchFound}
                isSearching={isSearching}
                isSaving={isSaving}
                apiError={apiError}
                onTypeChange={setIdentificationType}
                onValueChange={setIdentificationValue}
                onPerformSearch={() => performSearchContributor(church?.id)}
                onUpdateContributor={updateContributor}
                onSaveContributor={() => saveContributor(church?.id)}
                onMockSearchToggle={setMockSearchFound}
                onContinue={() => onNavigate('home')}
            />
        </PortalContainer>
    );
};
