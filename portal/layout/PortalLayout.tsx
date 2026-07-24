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
        <div className="h-[100dvh] w-screen flex flex-col bg-gradient-to-b from-[#E6EFEA] via-[#D8E8DF] to-[#CADFD4] dark:from-[#0B1411] dark:to-[#050D0A] text-slate-900 dark:text-slate-100 font-sans antialiased overflow-y-auto custom-scrollbar relative">
            {/* Ambient Background Globs */}
            <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-[#EA580C]/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-[#10B981]/5 rounded-full blur-[120px] pointer-events-none"></div>

            <PortalHeader church={church} onNavigate={onNavigate} />
            <main className="flex-1 w-full flex flex-col z-10 relative">
                {children}
            </main>
            <PortalFooter />
        </div>
    );
};
