import React from 'react';
import { PortalHeader } from '../components/PortalHeader';
import { PortalFooter } from '../components/PortalFooter';
import { PortalChurch } from '../types/portal';

interface PortalLayoutProps {
    children: React.ReactNode;
    church?: PortalChurch | null;
    onNavigate?: (route: string) => void;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
    children,
    church,
    onNavigate
}) => {
    return (
        <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 font-sans antialiased">
            <PortalHeader church={church} onNavigate={onNavigate} />
            <main className="flex-1 flex flex-col">
                {children}
            </main>
            <PortalFooter />
        </div>
    );
};
