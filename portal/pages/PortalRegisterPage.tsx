import React from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalContributorStep } from './PortalContributorStep';
import { usePortalWizard } from '../hooks/usePortalWizard';

interface PortalRegisterPageProps {
    onNavigate: (route: string, params?: Record<string, string>) => void;
}

export const PortalRegisterPage: React.FC<PortalRegisterPageProps> = ({ onNavigate }) => {
    const {
        wizardState,
        updateContributor
    } = usePortalWizard();

    return (
        <PortalContainer maxWidth="7xl">
            <PortalContributorStep
                contributor={wizardState.contributor}
                mockSearchFound={false}
                onUpdateContributor={updateContributor}
                onBack={() => onNavigate('home')}
                onContinue={() => onNavigate('home')}
            />
        </PortalContainer>
    );
};
