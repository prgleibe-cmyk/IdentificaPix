import React, { useState, useEffect } from 'react';
import { PortalLayout } from './layout/PortalLayout';
import { PortalHome } from './pages/PortalHome';
import { PortalChurchPage } from './pages/PortalChurchPage';
import { PortalIdentifyPage } from './pages/PortalIdentifyPage';
import { PortalRegisterPage } from './pages/PortalRegisterPage';
import { PortalReportsPage } from './pages/PortalReportsPage';
import { PortalPledgesPage } from './pages/PortalPledgesPage';
import { PortalComingSoonPage } from './pages/PortalComingSoonPage';
import { PortalNotFoundPage } from './pages/PortalNotFoundPage';
import { PortalLoading } from './components/PortalLoading';
import { usePortalChurchResolver } from './hooks/usePortalChurchResolver';
import { PortalRoute } from './types/portal';

export const parsePortalLocation = (): { route: PortalRoute; slug?: string } => {
    if (typeof window === 'undefined') return { route: 'home', slug: undefined };
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    // Normalize path & hash
    let clean = hash.startsWith('#') ? hash.slice(1) : path;
    clean = clean.split('?')[0]; // strip query parameters
    if (clean.startsWith('/portal')) {
        clean = clean.replace(/^\/portal/, '');
    }

    const parts = clean.split('/').filter(Boolean);

    // Query params fallback
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('church') || urlParams.get('igreja') || urlParams.get('c') || undefined;

    if (parts.length === 0) {
        return { route: 'home', slug: querySlug };
    } else if (parts[0] === 'cadastro' || parts[0] === 'cadastrar' || parts[0] === 'register') {
        return { route: 'register', slug: parts[1] || querySlug };
    } else if (parts[0] === 'identify' || parts[0] === 'identificar') {
        return { route: 'identify', slug: querySlug };
    } else if (parts[0] === 'reports' || parts[0] === 'relatorios') {
        return { route: 'reports', slug: querySlug };
    } else if (parts[0] === 'pledges' || parts[0] === 'carnes') {
        return { route: 'pledges', slug: querySlug };
    } else if (parts[0] === 'coming_soon') {
        return { route: 'coming_soon', slug: querySlug };
    } else if (parts[0] === 'church' && parts[1]) {
        if (parts[2] === 'cadastro' || parts[2] === 'cadastrar' || parts[2] === 'register') {
            return { route: 'register', slug: parts[1] };
        } else {
            return { route: 'church', slug: parts[1] };
        }
    } else if (parts[0]) {
        if (parts[1] === 'cadastro' || parts[1] === 'cadastrar' || parts[1] === 'register') {
            return { route: 'register', slug: parts[0] };
        } else {
            return { route: 'church', slug: parts[0] };
        }
    } else {
        return { route: 'not_found', slug: querySlug };
    }
};

export const PortalRouter: React.FC = () => {
    const [currentRoute, setCurrentRoute] = useState<PortalRoute>(() => parsePortalLocation().route);
    const [churchSlug, setChurchSlug] = useState<string | undefined>(() => parsePortalLocation().slug);

    // Sync route from URL path or hash
    useEffect(() => {
        const syncLocation = () => {
            const loc = parsePortalLocation();
            setCurrentRoute(loc.route);
            setChurchSlug(loc.slug);
        };

        syncLocation();
        window.addEventListener('popstate', syncLocation);
        window.addEventListener('hashchange', syncLocation);

        return () => {
            window.removeEventListener('popstate', syncLocation);
            window.removeEventListener('hashchange', syncLocation);
        };
    }, []);

    const { church, churchesList, isLoading } = usePortalChurchResolver(churchSlug);

    const handleNavigate = (route: string, params?: Record<string, string>) => {
        const routeKey = route as PortalRoute;
        setCurrentRoute(routeKey);

        if (params?.churchSlug) {
            setChurchSlug(params.churchSlug);
            window.history.pushState({}, '', `/portal/church/${params.churchSlug}`);
        } else if (routeKey === 'home') {
            window.history.pushState({}, '', '/portal');
        } else {
            window.history.pushState({}, '', `/portal/${routeKey}`);
        }
    };

    const renderPage = () => {
        switch (currentRoute) {
            case 'home':
            case 'church':
                return <PortalHome church={church} onNavigate={handleNavigate} />;
            case 'identify':
                return <PortalIdentifyPage church={church} onNavigate={handleNavigate} />;
            case 'register':
                return <PortalRegisterPage church={church} churchesList={churchesList} onNavigate={handleNavigate} />;
            case 'reports':
                return <PortalReportsPage church={church} onNavigate={handleNavigate} />;
            case 'pledges':
                return <PortalPledgesPage church={church} onNavigate={handleNavigate} />;
            case 'coming_soon':
                return <PortalComingSoonPage onNavigate={handleNavigate} />;
            case 'not_found':
                return <PortalNotFoundPage onNavigate={handleNavigate} />;
            default:
                return <PortalHome church={church} onNavigate={handleNavigate} />;
        }
    };

    if (isLoading && !church) {
        return (
            <PortalLayout church={null} onNavigate={handleNavigate}>
                <div className="flex-1 flex items-center justify-center p-8 min-h-[50vh]">
                    <PortalLoading message="Carregando portal da congregação..." />
                </div>
            </PortalLayout>
        );
    }

    return (
        <PortalLayout church={church} onNavigate={handleNavigate}>
            {renderPage()}
        </PortalLayout>
    );
};
