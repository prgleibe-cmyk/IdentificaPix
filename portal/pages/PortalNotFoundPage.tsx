import React from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalEmptyState } from '../components/PortalEmptyState';

interface PortalNotFoundPageProps {
    onNavigate: (route: string) => void;
}

export const PortalNotFoundPage: React.FC<PortalNotFoundPageProps> = ({ onNavigate }) => {
    return (
        <PortalContainer maxWidth="md">
            <PortalEmptyState
                title="Página Não Encontrada"
                description="O endereço acessado não existe ou não está disponível no Portal do Contribuinte."
                icon={<span className="text-2xl font-black">404</span>}
                actionLabel="Voltar ao Início"
                onAction={() => onNavigate('home')}
            />
        </PortalContainer>
    );
};
