import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Registro do Service Worker com versionamento para forçar atualização de ícones no PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Adicionado v=7 para garantir que o Chrome/Windows detecte a nova versão do Service Worker
    navigator.serviceWorker.register('/sw.js?v=7').catch(err => {
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