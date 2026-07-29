import { useEffect } from 'react';
import { PortalChurch } from '../types/portal';

export const usePortalPwaSync = (church?: PortalChurch | null) => {
    useEffect(() => {
        const name = church?.name ? church.name : 'IgGestor';
        const logo = church?.logoUrl ? church.logoUrl : `${window.location.origin}/pwa/icon-512.png?v=15`;

        // 1. Update Document Title
        document.title = church?.name 
            ? `${church.name} - Portal do Contribuinte` 
            : 'IgGestor - Portal do Contribuinte';

        // 2. Update Apple Mobile Web App Title
        const metaAppTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (metaAppTitle) {
            metaAppTitle.setAttribute('content', name);
        }

        // 3. Update Favicon & Apple Touch Icons
        let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (faviconLink) {
            faviconLink.href = logo;
        }

        let appleTouchLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
        if (appleTouchLink) {
            appleTouchLink.href = logo;
        }

        // 4. Ensure standard valid manifest.json link is set
        try {
            let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
            if (manifestLink) {
                manifestLink.href = "/manifest.json?v=15";
            } else {
                manifestLink = document.createElement('link');
                manifestLink.rel = 'manifest';
                manifestLink.href = '/manifest.json?v=15';
                document.head.appendChild(manifestLink);
            }
        } catch (err) {
            console.error('[usePortalPwaSync] Erro ao sincronizar manifest:', err);
        }
    }, [church?.id, church?.name, church?.logoUrl]);
};
