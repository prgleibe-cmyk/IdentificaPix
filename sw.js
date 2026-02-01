// Service Worker IdentificaPix - Versão 6
const CACHE_NAME = 'identificapix-v6';

// Ativos que devem ser buscados SEMPRE na rede para garantir atualização de ícones no Windows
const BYPASS_CACHE = [
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'maskable-icon-512.png'
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
  if (BYPASS_CACHE.some(path => url.pathname.endsWith(path))) {
    return event.respondWith(fetch(event.request));
  }

  // Para os demais arquivos, mantém o modo pass-through (rede)
  event.respondWith(fetch(event.request));
});