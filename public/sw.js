
// Service Worker IdentificaPix - Versão 8
const CACHE_NAME = 'identificapix-v8';

// Ativos que devem ser buscados SEMPRE na rede para garantir atualização de ícones no Windows
const BYPASS_CACHE = [
  'manifest.json',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/maskable-icon-512.png'
];

self.addEventListener('install', (event) => {
  // Força o Service Worker atual a assumir o controle imediatamente
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpeza de caches antigos para evitar que o Windows use ícones ou manifests obsoletos
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Regra de Ouro: Manifest e Ícones devem vir sempre da rede (Network Only)
  // para que o Chrome detecte a mudança e atualize o ícone na Taskbar do Windows.
  if (BYPASS_CACHE.some(path => url.pathname.includes(path))) {
    return event.respondWith(fetch(event.request));
  }

  // Para os demais arquivos, mantém o modo pass-through (rede)
  event.respondWith(fetch(event.request));
});