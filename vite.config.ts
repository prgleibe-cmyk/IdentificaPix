
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Arquivo corretíssimo para Vite + TypeScript
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 5173, // Vite dev server port
      host: '0.0.0.0',
      // Configuração de Proxy para Redirecionar chamadas /api para o Backend (server.js)
      // Em produção (Coolify), isso não é usado, pois o server.js serve os arquivos estáticos.
      proxy: {
        '/api': {
          target: 'http://localhost:3000', // Alinhado com o padrão do server.js
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
  };
});
