import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Ponto de entrada do React
const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      {/* Suspense para futuras otimizações de lazy loading */}
      <Suspense fallback={<div>Carregando...</div>}>
        <App />
      </Suspense>
    </React.StrictMode>
  );
} else {
  console.error('Failed to find the root element');
}
