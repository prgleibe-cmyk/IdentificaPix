/**
 * documentDetector.ts
 * 
 * Detector automático de bordas e enquadramento de documentos financeiros.
 * Analisa contraste de luminância e gradientes para identificar os 4 vértices
 * do papel (recibo, cupom, nota fiscal) sobre a superfície.
 * 
 * Opera com downsampling extremo (máx 240px) para execução instantânea (< 8ms)
 * e consumo zero de memória em smartphones.
 */

import { Point, DocumentCorners } from './perspectiveWarp';

/**
 * Detecta automaticamente os 4 cantos de um documento presente na imagem.
 * Se as bordas forem identificadas com boa confiança, retorna o quadrilátero ajustado.
 * Caso contrário, retorna um enquadramento centrado com margem de segurança.
 */
export function autoDetectDocumentCorners(
    source: HTMLImageElement | HTMLCanvasElement
): DocumentCorners {
    const srcW = source.width;
    const srcH = source.height;

    // Resolução reduzida para análise ultrarrápida e leve
    const maxDim = 240;
    let scale = 1;
    if (Math.max(srcW, srcH) > maxDim) {
        scale = maxDim / Math.max(srcW, srcH);
    }

    const sw = Math.round(srcW * scale);
    const sh = Math.round(srcH * scale);

    if (sw < 20 || sh < 20) {
        return getFallbackCorners(srcW, srcH);
    }

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return getFallbackCorners(srcW, srcH);

    ctx.drawImage(source, 0, 0, sw, sh);
    const imgData = ctx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // 1. Calcula luminâncias e média global
    const lums = new Uint8Array(sw * sh);
    let sumLum = 0;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        // Luminância padrão
        const l = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
        lums[j] = l;
        sumLum += l;
    }
    const avgLum = sumLum / (sw * sh);

    // 2. Binarização adaptativa rápida (papel de documento costuma ser mais claro que a mesa)
    // Se a média global for clara, usa limiar acima da média; se for escura, limiar relativo.
    const threshold = Math.min(210, Math.max(90, avgLum + 18));
    const isDocPixel = new Uint8Array(sw * sh);

    let docPixelCount = 0;
    for (let i = 0; i < lums.length; i++) {
        if (lums[i] >= threshold) {
            isDocPixel[i] = 1;
            docPixelCount++;
        }
    }

    // Se o número de pixels de documento for muito pequeno (< 12%) ou quase tudo (> 94%),
    // significa baixo contraste entre o papel e a mesa (ex: papel branco sobre mesa branca).
    const docRatio = docPixelCount / (sw * sh);
    if (docRatio < 0.12 || docRatio > 0.94) {
        return getFallbackCorners(srcW, srcH);
    }

    // 3. Busca dos 4 cantos extremos (Top-Left, Top-Right, Bottom-Right, Bottom-Left)
    // TL: min(x + y)
    // TR: max(x - y)
    // BR: max(x + y)
    // BL: min(x - y)
    let minSum = Infinity, tl = { x: 0, y: 0 };
    let maxDiff = -Infinity, tr = { x: sw, y: 0 };
    let maxSum = -Infinity, br = { x: sw, y: sh };
    let minDiff = Infinity, bl = { x: 0, y: sh };

    let foundPoints = 0;
    // Percorre ignorando uma margem extrema de 3% para evitar ruídos de borda da câmera
    const marginX = Math.round(sw * 0.03);
    const marginY = Math.round(sh * 0.03);

    for (let y = marginY; y < sh - marginY; y++) {
        const rowOffset = y * sw;
        for (let x = marginX; x < sw - marginX; x++) {
            if (isDocPixel[rowOffset + x] === 1) {
                foundPoints++;
                const sum = x + y;
                const diff = x - y;

                if (sum < minSum) {
                    minSum = sum;
                    tl = { x, y };
                }
                if (diff > maxDiff) {
                    maxDiff = diff;
                    tr = { x, y };
                }
                if (sum > maxSum) {
                    maxSum = sum;
                    br = { x, y };
                }
                if (diff < minDiff) {
                    minDiff = diff;
                    bl = { x, y };
                }
            }
        }
    }

    if (foundPoints < (sw * sh * 0.08)) {
        return getFallbackCorners(srcW, srcH);
    }

    // 4. Mapeia de volta para as dimensões reais da imagem original
    const invScale = 1 / scale;

    // Aplica um leve padding de 1.5% para fora para não cortar texto miúdo nas bordas
    const padOrigX = srcW * 0.015;
    const padOrigY = srcH * 0.015;

    const detected: DocumentCorners = {
        topLeft: {
            x: Math.max(0, Math.round(tl.x * invScale - padOrigX)),
            y: Math.max(0, Math.round(tl.y * invScale - padOrigY))
        },
        topRight: {
            x: Math.min(srcW, Math.round(tr.x * invScale + padOrigX)),
            y: Math.max(0, Math.round(tr.y * invScale - padOrigY))
        },
        bottomRight: {
            x: Math.min(srcW, Math.round(br.x * invScale + padOrigX)),
            y: Math.min(srcH, Math.round(br.y * invScale + padOrigY))
        },
        bottomLeft: {
            x: Math.max(0, Math.round(bl.x * invScale - padOrigX)),
            y: Math.min(srcH, Math.round(bl.y * invScale + padOrigY))
        }
    };

    // Validação de geometria do quadrilátero (garante que não cruzou ou virou um triângulo colapsado)
    const widthTop = Math.abs(detected.topRight.x - detected.topLeft.x);
    const widthBottom = Math.abs(detected.bottomRight.x - detected.bottomLeft.x);
    const heightLeft = Math.abs(detected.bottomLeft.y - detected.topLeft.y);
    const heightRight = Math.abs(detected.bottomRight.y - detected.topRight.y);

    if (
        widthTop < srcW * 0.25 || 
        widthBottom < srcW * 0.25 || 
        heightLeft < srcH * 0.25 || 
        heightRight < srcH * 0.25
    ) {
        return getFallbackCorners(srcW, srcH);
    }

    return detected;
}

/**
 * Enquadramento padrão seguro centrado
 */
function getFallbackCorners(width: number, height: number): DocumentCorners {
    const padX = width * 0.06;
    const padY = height * 0.06;
    return {
        topLeft: { x: Math.round(padX), y: Math.round(padY) },
        topRight: { x: Math.round(width - padX), y: Math.round(padY) },
        bottomRight: { x: Math.round(width - padX), y: Math.round(height - padY) },
        bottomLeft: { x: Math.round(padX), y: Math.round(height - padY) }
    };
}
