import React from 'react';
import { PortalHeader } from '../components/PortalHeader';
import { PortalFooter } from '../components/PortalFooter';
import { PortalChurch } from '../types/portal';
import { usePortalPwaSync } from '../hooks/usePortalPwaSync';

interface PortalLayoutProps {
    children: React.ReactNode;
    church?: PortalChurch | null;
    currentRoute?: string;
    onNavigate?: (route: string) => void;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
    children,
    church,
    currentRoute,
    onNavigate
}) => {
    // Dynamically sync Title, Favicon, Meta Tags, and PWA Manifest with the Church's Name & Logo
    usePortalPwaSync(church);

    return (
        <div
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom' }}
            className="h-[100dvh] w-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-y-auto custom-scrollbar relative"
        >
            <PortalHeader church={church} currentRoute={currentRoute} onNavigate={onNavigate} />
            <main className="flex-1 w-full flex flex-col z-10 relative">
                {children}
            </main>
            <PortalFooter />
        </div>
    );
};
