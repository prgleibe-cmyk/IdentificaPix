import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * IDENTIFICAPIX - PWA ASSET GENERATOR (SAFE VERSION)
 * Copia a logo real para os ícones do PWA sem sobrescrever indevidamente.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.join(__dirname, '../public/pwa');
const sourceLogo = path.join(__dirname, '../public/logo.png');

console.log("[PWA-Generator] Iniciando materialização de ativos...");

if (!fs.existsSync(sourceLogo)) {
    console.error(`[PWA-Generator] ❌ Logo base não encontrada em: ${sourceLogo}`);
    process.exit(1);
}

if (!fs.existsSync(targetDir)) {
    console.log(`[PWA-Generator] Criando diretório: ${targetDir}`);
    fs.mkdirSync(targetDir, { recursive: true });
}

const icons = [
    'icon-192.png',
    'icon-512.png',
    'maskable-icon-512.png'
];

icons.forEach(filename => {
    const filePath = path.join(targetDir, filename);

    fs.copyFileSync(sourceLogo, filePath);

    console.log(`[PWA-Generator] Gerado: ${filename}`);
});

console.log("[PWA-Generator] Concluído com sucesso.");
