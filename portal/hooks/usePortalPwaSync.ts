import { useEffect } from 'react';
import { PortalChurch } from '../types/portal';

export const usePortalPwaSync = (church?: PortalChurch | null) => {
    useEffect(() => {
        const name = church?.name ? church.name : 'Portal do Contribuinte';
        const logo = church?.logoUrl ? church.logoUrl : `${window.location.origin}/pwa/icon-512.png?v=15`;
        const churchId = church?.id || '';

        // 1. Update Document Title
        document.title = church?.name 
            ? `${church.name} - Portal do Contribuinte` 
            : 'Portal do Contribuinte';

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

        // 4. Set Dynamic Church PWA Manifest
        // Usar manifest dinâmico por igreja para isolar o ID e SCOPE (/portal), permitindo que o usuário tenha o App Principal e o App do Portal instalados simultaneamente
        const manifestUrl = churchId 
            ? `/api/portal/manifest.json?church_id=${encodeURIComponent(churchId)}`
            : `/api/portal/manifest.json`;

        try {
            let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
            if (manifestLink) {
                manifestLink.href = manifestUrl;
            } else {
                manifestLink = document.createElement('link');
                manifestLink.rel = 'manifest';
                manifestLink.href = manifestUrl;
                document.head.appendChild(manifestLink);
            }
        } catch (err) {
            console.error('[usePortalPwaSync] Erro ao sincronizar manifest do portal:', err);
        }

        // Cleanup ao desmontar (se o usuário voltar para o sistema principal)
        return () => {
            try {
                const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
                if (manifestLink) {
                    manifestLink.href = '/manifest.json?v=15';
                }
                const appleTouch = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
                if (appleTouch) {
                    appleTouch.href = '/pwa/icon-512.png?v=15';
                }
                const fav = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
                if (fav) {
                    fav.href = '/pwa/icon-192.png?v=15';
                }
                document.title = 'IgGestor - Gestão Financeira para Igrejas';
            } catch (_) {}
        };
    }, [church?.id, church?.name, church?.logoUrl]);
};
