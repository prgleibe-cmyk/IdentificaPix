/**
 * documentEnhancer.ts
 * 
 * Filtros de processamento de imagem para documentos financeiros escaneados.
 * Aumenta a legibilidade de textos miúdos, CNPJs, valores em reais e códigos de barras,
 * clareando o fundo do papel e removendo sombras.
 * 
 * Modos:
 * - 'color': Documento Nítido (fundo branco limpo, cores de carimbos/logos preservadas).
 * - 'grayscale': Alto Contraste P&B (ideal para cupons fiscais térmicos desbotados).
 * - 'original': Foto original apenas desentortada.
 */

export type DocumentFilterMode = 'color' | 'grayscale' | 'original';

/**
 * Aplica o filtro de legibilidade ao canvas de documento retificado
 */
export function enhanceDocumentCanvas(
    canvas: HTMLCanvasElement,
    mode: DocumentFilterMode
): HTMLCanvasElement {
    if (mode === 'original') {
        return canvas;
    }

    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const totalPixels = width * height;

    // 1. Constrói mapa 2D de fundo local (grid 16x16) para eliminar sombras desiguais
    const gridCols = 16;
    const gridRows = 16;
    const cellW = Math.max(1, Math.floor(width / gridCols));
    const cellH = Math.max(1, Math.floor(height / gridRows));
    const bgGrid = new Float32Array(gridCols * gridRows);

    // Amostra a luminância do fundo em cada bloco (usa percentil alto 85%-95%)
    for (let gy = 0; gy < gridRows; gy++) {
        const startY = gy * cellH;
        const endY = gy === gridRows - 1 ? height : (gy + 1) * cellH;

        for (let gx = 0; gx < gridCols; gx++) {
            const startX = gx * cellW;
            const endX = gx === gridCols - 1 ? width : (gx + 1) * cellW;

            let maxL = 120;
            let sumHighL = 0;
            let highCount = 0;

            // Amostragem com salto para velocidade instantânea
            for (let y = startY; y < endY; y += 2) {
                const rowOffset = y * width * 4;
                for (let x = startX; x < endX; x += 2) {
                    const idx = rowOffset + x * 4;
                    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                    if (lum > maxL) maxL = lum;
                    if (lum > 140) {
                        sumHighL += lum;
                        highCount++;
                    }
                }
            }

            const cellBg = highCount > 5 ? (sumHighL / highCount) : maxL;
            bgGrid[gy * gridCols + gx] = Math.max(140, Math.min(255, cellBg));
        }
    }

    // Função de interpolação bilinear do fundo local para qualquer coordenada (x, y)
    const getLocalBg = (x: number, y: number): number => {
        const gx = Math.min(gridCols - 1, Math.max(0, x / cellW));
        const gy = Math.min(gridRows - 1, Math.max(0, y / cellH));
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const x1 = Math.min(gridCols - 1, x0 + 1);
        const y1 = Math.min(gridRows - 1, y0 + 1);
        const fx = gx - x0;
        const fy = gy - y0;

        const b00 = bgGrid[y0 * gridCols + x0];
        const b10 = bgGrid[y0 * gridCols + x1];
        const b01 = bgGrid[y1 * gridCols + x0];
        const b11 = bgGrid[y1 * gridCols + x1];

        const top = b00 + fx * (b10 - b00);
        const bot = b01 + fx * (b11 - b01);
        return top + fy * (bot - top);
    };

    if (mode === 'grayscale') {
        // Modo P&B / Alto Contraste com Remoção Total de Sombras
        for (let y = 0; y < height; y++) {
            const rowOffset = y * width * 4;
            for (let x = 0; x < width; x++) {
                const i = rowOffset + x * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Luminância real do pixel
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const localBg = getLocalBg(x, y);

                // Relação luminância / fundo local
                const ratio = lum / localBg;

                let enhanced: number;
                if (ratio >= 0.82) {
                    // Fundo de papel vira branco puro (#FFFFFF)
                    enhanced = 255;
                } else if (ratio <= 0.52) {
                    // Texto / código de barras vira preto nítido (#000000)
                    enhanced = 0;
                } else {
                    // Transição nítida e linear
                    enhanced = Math.round(((ratio - 0.52) / 0.30) * 255);
                }

                data[i] = enhanced;
                data[i + 1] = enhanced;
                data[i + 2] = enhanced;
            }
        }
    } else if (mode === 'color') {
        // Modo Documento Colorido Nítido (fundo branco puro + logos e carimbos vivos)
        for (let y = 0; y < height; y++) {
            const rowOffset = y * width * 4;
            for (let x = 0; x < width; x++) {
                const i = rowOffset + x * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const localBg = getLocalBg(x, y);
                const ratio = lum / localBg;

                if (ratio >= 0.88) {
                    // Fundo clareado para branco
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                } else {
                    // Realça saturação e contraste do texto/carimbo colorido
                    const scale = Math.min(1.45, Math.max(1.0, 255 / localBg));
                    data[i] = Math.min(255, Math.max(0, Math.round(r * scale)));
                    data[i + 1] = Math.min(255, Math.max(0, Math.round(g * scale)));
                    data[i + 2] = Math.min(255, Math.max(0, Math.round(b * scale)));
                }
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

/**
 * Converte o canvas para Blob JPEG otimizado (80KB - 140KB) para blindagem de memória
 */
export function canvasToOptimizedBlob(
    canvas: HTMLCanvasElement,
    quality = 0.78
): Promise<{ blob: Blob; dataUrl: string; size: number }> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                return reject(new Error('Falha ao gerar blob do canvas'));
            }
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                resolve({
                    blob,
                    dataUrl,
                    size: blob.size
                });
            };
            reader.onerror = () => reject(new Error('Falha ao ler blob como dataUrl'));
            reader.readAsDataURL(blob);
        }, 'image/jpeg', quality);
    });
}
