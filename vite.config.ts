
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Arquivo corretíssimo para Vite + TypeScript
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    // Define variáveis globais para compatibilidade com o SDK do Google
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY)
    },
    server: {
      port: 5173, // Vite dev server port
      host: '0.0.0.0',
      // Configuração de Proxy apenas para APIs locais, não para o Supabase
      proxy: {
        '/api': {
          target: 'http://localhost:3000', 
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
