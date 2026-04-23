
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/* 
// Registro do Service Worker desativado para evitar problemas de CORS/Fetch
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Adicionado v=9 para garantir que o Chrome/Windows detecte a nova versão do Service Worker e atualize ícones
    navigator.serviceWorker.register('/sw.js?v=9').catch(err => {
      console.log('Service Worker registration failed: ', err);
    });
  });
}
*/

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