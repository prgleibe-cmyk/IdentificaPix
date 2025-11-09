import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuração padrão do Vite para apps React + TypeScript na raiz
export default defineConfig({
  plugins: [react()],
  root: '.', // garante que ele leia o index.html da raiz
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    open: true,
  },
})
