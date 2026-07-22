import React from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';

interface PortalComingSoonPageProps {
    onNavigate: (route: string, params?: Record<string, string>) => void;
}

export const PortalComingSoonPage: React.FC<PortalComingSoonPageProps> = ({ onNavigate }) => {
    return (
        <PortalContainer maxWidth="md">
            <PortalCard
                title="Em Breve"
                subtitle="Esta funcionalidade estará disponível em breve."
            >
                <div className="text-center py-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 text-brand-blue flex items-center justify-center font-bold text-2xl">
                        ⏳
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
                        O Portal do Contribuinte está sendo expandido para oferecer novos recursos de contribuição rápida e recibos.
                    </p>
                    <PortalButton
                        variant="primary"
                        size="md"
                        onClick={() => onNavigate('home')}
                    >
                        Voltar para a Página Inicial
                    </PortalButton>
                </div>
            </PortalCard>
        </PortalContainer>
    );
};
