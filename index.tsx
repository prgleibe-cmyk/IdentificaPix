import './estilos/base.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppContext'; // ✅ Corrigido para estrutura sem "src"

const rootElement = document.getElementById('root');

console.log('✅ index.tsx carregado com sucesso'); // <-- Teste de verificação

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
