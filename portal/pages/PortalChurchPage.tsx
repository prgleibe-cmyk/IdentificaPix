import React from 'react';
import { PortalContainer } from '../components/PortalContainer';
import { PortalCard } from '../components/PortalCard';
import { PortalButton } from '../components/PortalButton';
import { PortalChurch } from '../types/portal';

interface PortalChurchPageProps {
    church?: PortalChurch | null;
    onNavigate: (route: string, params?: Record<string, string>) => void;
}

export const PortalChurchPage: React.FC<PortalChurchPageProps> = ({ church, onNavigate }) => {
    return (
        <PortalContainer maxWidth="lg">
            <PortalCard
                title={church?.name || 'Página da Igreja'}
                subtitle={church?.description || 'Ambiente Oficial de Contribuição'}
            >
                <div className="space-y-4 py-2">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Status do Módulo
                        </span>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            Estrutura Pública Preparada
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <PortalButton
                            variant="primary"
                            size="md"
                            className="flex-1"
                            onClick={() => onNavigate('identify')}
                        >
                            Identificar-se
                        </PortalButton>
                        <PortalButton
                            variant="outline"
                            size="md"
                            className="flex-1"
                            onClick={() => onNavigate('coming_soon')}
                        >
                            Oferta Rápida
                        </PortalButton>
                    </div>
                </div>
            </PortalCard>
        </PortalContainer>
    );
};
