import React from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalContributorStep } from './PortalContributorStep';
import { usePortalWizard } from '../hooks/usePortalWizard';
import { PortalChurch } from '../types/portal';

interface PortalRegisterPageProps {
    church?: PortalChurch | null;
    onNavigate: (route: string, params?: Record<string, string>) => void;
}

export const PortalRegisterPage: React.FC<PortalRegisterPageProps> = ({ church, onNavigate }) => {
    const {
        wizardState,
        updateContributor
    } = usePortalWizard(church?.id, church?.name);

    return (
        <PortalContainer maxWidth="7xl">
            <PortalContributorStep
                church={church}
                contributor={wizardState.contributor}
                mockSearchFound={false}
                onUpdateContributor={updateContributor}
                onBack={() => onNavigate('home')}
                onContinue={() => onNavigate('home')}
            />
        </PortalContainer>
    );
};
