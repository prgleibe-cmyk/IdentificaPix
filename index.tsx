console.log('🧭 Início do index.tsx');

try {
  const test = require('./contexts/AppContext');
  console.log('✅ AppContext foi encontrado e importado:', test);
} catch (err) {
  console.error('❌ Erro ao importar AppContext:', err);
}

import './estilos/base.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppContext'; // ✅ caminho correto (sem src)

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </React.StrictMode>
  );
} else {
  console.error('❌ Falha ao encontrar o elemento root');
}
