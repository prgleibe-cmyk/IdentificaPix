
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Capture PWA install prompt globally
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  (window as any).deferredPwaPrompt = e;
  console.log('[PWA] Captured beforeinstallprompt globally');
});

// Registro do Service Worker com versionamento para forçar atualização de ícones no PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Adicionado v=18 para garantir que o Chrome/Windows/iOS/Android detecte a nova versão do Service Worker
    navigator.serviceWorker.register('/sw.js?v=18').catch(err => {
      console.log('Service Worker registration failed: ', err);
    });
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
    console.error('Failed to find the root element');
}