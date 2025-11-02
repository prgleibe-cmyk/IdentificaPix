import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppProvider'; // ✅ Importar o provider

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider> {/* ✅ Envolver toda a aplicação */}
      <App />
    </AppProvider>
  </React.StrictMode>
);
