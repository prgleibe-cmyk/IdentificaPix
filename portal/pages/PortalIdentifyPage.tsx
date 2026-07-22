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
        setIdentificationType,
        setIdentificationValue,
        setMockSearchFound
    } = usePortalWizard();

    return (
        <PortalContainer maxWidth="md">
            <PortalIdentifyStep
                identificationType={wizardState.identificationType}
                identificationValue={wizardState.identificationValue}
                mockSearchFound={wizardState.mockSearchFound}
                onTypeChange={setIdentificationType}
                onValueChange={setIdentificationValue}
                onMockSearchToggle={setMockSearchFound}
                onContinue={() => onNavigate('home')}
            />
        </PortalContainer>
    );
};
