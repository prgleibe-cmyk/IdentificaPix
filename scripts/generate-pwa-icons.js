import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tenta encontrar a logo em vários lugares possíveis
const projectRoot = path.join(__dirname, '..');
const possibleSources = [
    path.join(projectRoot, 'public/logo.png'),
    path.join(projectRoot, 'logo.png'),
    path.join(projectRoot, 'public/icon.png'),
];

let sourceLogo = possibleSources.find(p => fs.existsSync(p));
const targetDir = path.join(projectRoot, 'public/pwa');

console.log("[PWA-Generator] Iniciando materialização de ativos...");

if (!sourceLogo) {
    console.warn("[PWA-Generator] ⚠️ Nenhuma logo base (logo.png) encontrada. Pulando geração de ícones PWA.");
    process.exit(0); // Sai sem erro para não travar o build do Coolify
}

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const icons = [
    'icon-192.png',
    'icon-512.png',
    'maskable-icon-512.png'
];

try {
    icons.forEach(filename => {
        fs.copyFileSync(sourceLogo, path.join(targetDir, filename));
        console.log(`[PWA-Generator] ✅ Gerado: ${filename}`);
    });
} catch (e) {
    console.error("[PWA-Generator] ❌ Erro ao copiar ícones:", e.message);
}

console.log("[PWA-Generator] Processo concluído.");