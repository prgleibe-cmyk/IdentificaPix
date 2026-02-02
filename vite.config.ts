
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Arquivo de configuração Vite para IdentificaPix
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    // Define o diretório de arquivos estáticos (padrão)
    publicDir: 'public',
    
    // Define variáveis globais para compatibilidade
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY)
    },
    
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3000', 
          changeOrigin: true,
          secure: false,
        }
      }
    },
    
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Garante explicitamente que a pasta public (incluindo /pwa) seja copiada para dist
      copyPublicDir: true,
      sourcemap: false,
      // Usamos o padrão (esbuild) para evitar erros de dependência opcional no CI/CD
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            utils: ['xlsx', 'jspdf', 'jspdf-autotable']
          }
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
