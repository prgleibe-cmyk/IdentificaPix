import { useEffect } from 'react';
import { PortalChurch } from '../types/portal';

export const usePortalPwaSync = (church?: PortalChurch | null) => {
    useEffect(() => {
        const name = church?.name ? church.name : 'Portal do Contribuinte';
        const logo = church?.logoUrl ? church.logoUrl : `${window.location.origin}/pwa/icon-512.png?v=15`;
        const churchId = church?.id || '';
        const churchSlug = (church?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        // 1. Update Document Title & Meta Application Names
        document.title = church?.name 
            ? `${church.name} - Portal do Contribuinte` 
            : 'Portal do Contribuinte';

        const metaAppTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (metaAppTitle) {
            metaAppTitle.setAttribute('content', name);
        }

        const metaAppName = document.querySelector('meta[name="application-name"]');
        if (metaAppName) {
            metaAppName.setAttribute('content', name);
        }

        // 2. Build Dynamic Icon & Manifest URLs with Church ID and Slug
        const queryParams = churchId
            ? `church_id=${encodeURIComponent(churchId)}&church_slug=${encodeURIComponent(churchSlug)}`
            : '';

        const safeIconUrl = queryParams
            ? `/api/portal/church-icon?${queryParams}&size=512`
            : logo;

        const safeIcon192Url = queryParams
            ? `/api/portal/church-icon?${queryParams}&size=192`
            : logo;

        // 3. Force-Update Favicons and Apple Touch Icons (re-inserting DOM nodes so mobile OS registers new logo)
        try {
            // Favicons
            document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(el => el.remove());
            const newFavicon = document.createElement('link');
            newFavicon.rel = 'icon';
            newFavicon.type = 'image/png';
            newFavicon.href = safeIcon192Url;
            document.head.appendChild(newFavicon);

            // Apple Touch Icon & Precomposed
            document.querySelectorAll('link[rel*="apple-touch-icon"]').forEach(el => el.remove());
            const newAppleTouch = document.createElement('link');
            newAppleTouch.rel = 'apple-touch-icon';
            newAppleTouch.sizes = '512x512';
            newAppleTouch.href = safeIconUrl;
            document.head.appendChild(newAppleTouch);

            const newApplePrecomposed = document.createElement('link');
            newApplePrecomposed.rel = 'apple-touch-icon-precomposed';
            newApplePrecomposed.href = safeIconUrl;
            document.head.appendChild(newApplePrecomposed);
        } catch (e) {
            console.warn('[usePortalPwaSync] Erro ao sincronizar ícones no DOM:', e);
        }

        // 4. Force-Update Dynamic Church PWA Manifest
        // Remover e recriar a tag link[rel="manifest"] para forçar o Chrome / Safari a recarregar o manifest da congregação específica
        const manifestUrl = queryParams
            ? `/api/portal/manifest.json?${queryParams}`
            : `/api/portal/manifest.json`;

        try {
            document.querySelectorAll('link[rel="manifest"]').forEach(el => el.remove());
            const newManifestLink = document.createElement('link');
            newManifestLink.id = 'pwa-portal-manifest';
            newManifestLink.rel = 'manifest';
            newManifestLink.href = manifestUrl;
            document.head.appendChild(newManifestLink);
        } catch (err) {
            console.error('[usePortalPwaSync] Erro ao sincronizar manifest do portal:', err);
        }

        // Cleanup ao desmontar (se o usuário voltar para o sistema principal)
        return () => {
            try {
                document.querySelectorAll('link[rel="manifest"]').forEach(el => el.remove());
                const defaultManifest = document.createElement('link');
                defaultManifest.rel = 'manifest';
                defaultManifest.href = '/manifest.json?v=15';
                document.head.appendChild(defaultManifest);

                document.querySelectorAll('link[rel*="apple-touch-icon"]').forEach(el => el.remove());
                const defaultApple = document.createElement('link');
                defaultApple.rel = 'apple-touch-icon';
                defaultApple.href = '/pwa/icon-512.png?v=15';
                document.head.appendChild(defaultApple);

                document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(el => el.remove());
                const defaultFav = document.createElement('link');
                defaultFav.rel = 'icon';
                defaultFav.type = 'image/png';
                defaultFav.href = '/pwa/icon-192.png?v=15';
                document.head.appendChild(defaultFav);

                document.title = 'IgGestor - Gestão Financeira para Igrejas';
            } catch (_) {}
        };
    }, [church?.id, church?.name, church?.logoUrl]);
};
