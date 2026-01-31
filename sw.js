
// Service Worker básico para permitir a instalação (PWA)
const CACHE_NAME = 'identificapix-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Apenas repassa as requisições (modo pass-through)
  event.respondWith(fetch(event.request));
});
