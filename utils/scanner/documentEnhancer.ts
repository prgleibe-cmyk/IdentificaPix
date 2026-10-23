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

    if (mode === 'grayscale') {
        // Modo P&B / Alto Contraste
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Luminância padrão Rec. 709
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            // Curva de contraste sigmoidal com corte de fundo
            let enhanced: number;
            if (lum > 175) {
                // Papel claro vira branco puro
                enhanced = 255;
            } else if (lum < 70) {
                // Tinta escura vira preto profundo
                enhanced = 0;
            } else {
                // Transição contrastada
                enhanced = Math.round(((lum - 70) / 105) * 255);
            }

            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
        }
    } else if (mode === 'color') {
        // Modo Documento Nítido (Colorido com fundo branco)
        // Amostra percentil de brilho para normalização de fundo de papel
        let maxBrightness = 200;
        const step = Math.max(1, Math.floor(totalPixels / 1000));
        let sampleCount = 0;
        let sumHighLum = 0;

        for (let i = 0; i < data.length; i += 4 * step) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (lum > 140) {
                sumHighLum += lum;
                sampleCount++;
            }
        }

        if (sampleCount > 0) {
            maxBrightness = Math.min(255, Math.max(180, (sumHighLum / sampleCount) * 1.05));
        }

        const scale = 255 / maxBrightness;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            if (lum > maxBrightness * 0.92) {
                // Fundo esbranquiçado
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
            } else {
                // Aumenta contraste mantendo a proporção de cor
                const factor = Math.min(1.4, Math.max(0.7, scale));
                data[i] = Math.min(255, Math.max(0, Math.round(r * factor)));
                data[i + 1] = Math.min(255, Math.max(0, Math.round(g * factor)));
                data[i + 2] = Math.min(255, Math.max(0, Math.round(b * factor)));
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
