import React, { useState, useEffect } from 'react';
import { PortalLayout } from './layout/PortalLayout';
import { PortalHome } from './pages/PortalHome';
import { PortalChurchPage } from './pages/PortalChurchPage';
import { PortalIdentifyPage } from './pages/PortalIdentifyPage';
import { PortalRegisterPage } from './pages/PortalRegisterPage';
import { PortalReportsPage } from './pages/PortalReportsPage';
import { PortalComingSoonPage } from './pages/PortalComingSoonPage';
import { PortalNotFoundPage } from './pages/PortalNotFoundPage';
import { usePortalChurchResolver } from './hooks/usePortalChurchResolver';
import { PortalRoute } from './types/portal';

export const PortalRouter: React.FC = () => {
    const [currentRoute, setCurrentRoute] = useState<PortalRoute>('home');
    const [churchSlug, setChurchSlug] = useState<string | undefined>(undefined);

    // Sync route from URL path or hash
    useEffect(() => {
        const parseLocation = () => {
            const path = window.location.pathname.toLowerCase();
            const hash = window.location.hash.toLowerCase();
            const fullTarget = hash.startsWith('#/portal') 
                ? hash.replace('#/portal', '') 
                : path.replace('/portal', '');

            const parts = fullTarget.split('/').filter(Boolean);

            if (parts.length === 0) {
                setCurrentRoute('home');
                setChurchSlug(undefined);
            } else if (parts[0] === 'identify') {
                setCurrentRoute('identify');
            } else if (parts[0] === 'register') {
                setCurrentRoute('register');
            } else if (parts[0] === 'reports') {
                setCurrentRoute('reports');
            } else if (parts[0] === 'coming_soon') {
                setCurrentRoute('coming_soon');
            } else if (parts[0] === 'church' && parts[1]) {
                setCurrentRoute('church');
                setChurchSlug(parts[1]);
            } else if (parts[0]) {
                // If it's a direct slug like /portal/igreja-central
                setCurrentRoute('church');
                setChurchSlug(parts[0]);
            } else {
                setCurrentRoute('not_found');
            }
        };

        parseLocation();
        window.addEventListener('popstate', parseLocation);
        window.addEventListener('hashchange', parseLocation);

        return () => {
            window.removeEventListener('popstate', parseLocation);
            window.removeEventListener('hashchange', parseLocation);
        };
    }, []);

    const { church } = usePortalChurchResolver(churchSlug);

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
                return <PortalIdentifyPage onNavigate={handleNavigate} />;
            case 'register':
                return <PortalRegisterPage onNavigate={handleNavigate} />;
            case 'reports':
                return <PortalReportsPage church={church} onNavigate={handleNavigate} />;
            case 'coming_soon':
                return <PortalComingSoonPage onNavigate={handleNavigate} />;
            case 'not_found':
                return <PortalNotFoundPage onNavigate={handleNavigate} />;
            default:
                return <PortalHome church={church} onNavigate={handleNavigate} />;
        }
    };

    return (
        <PortalLayout church={church} onNavigate={handleNavigate}>
            {renderPage()}
        </PortalLayout>
    );
};
