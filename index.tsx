
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Importação CRÍTICA para os estilos funcionarem

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <App />
  );
} else {
    console.error('Failed to find the root element');
}