import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Configuração limpa e compatível com projeto sem pasta src
export default defineConfig({
  plugins: [react()],
  root: ".", // raiz do projeto
  publicDir: "public", // se tiver assets públicos
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
