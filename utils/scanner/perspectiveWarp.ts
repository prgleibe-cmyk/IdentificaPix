/**
 * perspectiveWarp.ts
 * 
 * Motor de correção de perspectiva planar para documentos fotografados.
 * Mapeia os 4 cantos selecionados pelo usuário para um retângulo plano alinhado,
 * eliminando distorções de ângulo, inclinação e corte.
 * 
 * Zero dependências externas - opera 100% em Canvas e TypedArrays nativos.
 */

export interface Point {
    x: number;
    y: number;
}

export interface DocumentCorners {
    topLeft: Point;
    topRight: Point;
    bottomRight: Point;
    bottomLeft: Point;
}

/**
 * Calcula a distância euclidiana entre dois pontos
 */
export function distance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Estima cantos iniciais padrão com uma margem de segurança caso não haja detecção
 */
export function getDefaultCorners(width: number, height: number): DocumentCorners {
    const padX = width * 0.05;
    const padY = height * 0.05;
    return {
        topLeft: { x: padX, y: padY },
        topRight: { x: width - padX, y: padY },
        bottomRight: { x: width - padX, y: height - padY },
        bottomLeft: { x: padX, y: height - padY }
    };
}

/**
 * Resolve o sistema linear 8x8 para obter a matriz de homografia inversa (3x3).
 * Mapeia do espaço de destino retangular (x, y) de volta para o espaço original (u, v).
 */
function getInverseHomographyMatrix(corners: DocumentCorners, dstWidth: number, dstHeight: number): number[] {
    const { topLeft: p0, topRight: p1, bottomRight: p2, bottomLeft: p3 } = corners;

    // Correspondências: (0,0) -> p0; (dstWidth,0) -> p1; (dstWidth,dstHeight) -> p2; (0,dstHeight) -> p3
    const x0 = 0, y0 = 0;
    const x1 = dstWidth, y1 = 0;
    const x2 = dstWidth, y2 = dstHeight;
    const x3 = 0, y3 = dstHeight;

    const u0 = p0.x, v0 = p0.y;
    const u1 = p1.x, v1 = p1.y;
    const u2 = p2.x, v2 = p2.y;
    const u3 = p3.x, v3 = p3.y;

    const A: number[][] = [
        [x0, y0, 1, 0, 0, 0, -x0 * u0, -y0 * u0],
        [0, 0, 0, x0, y0, 1, -x0 * v0, -y0 * v0],
        [x1, y1, 1, 0, 0, 0, -x1 * u1, -y1 * u1],
        [0, 0, 0, x1, y1, 1, -x1 * v1, -y1 * v1],
        [x2, y2, 1, 0, 0, 0, -x2 * u2, -y2 * u2],
        [0, 0, 0, x2, y2, 1, -x2 * v2, -y2 * v2],
        [x3, y3, 1, 0, 0, 0, -x3 * u3, -y3 * u3],
        [0, 0, 0, x3, y3, 1, -x3 * v3, -y3 * v3],
    ];

    const B: number[] = [u0, v0, u1, v1, u2, v2, u3, v3];

    // Eliminação Gaussiana com pivoteamento parcial
    const n = 8;
    for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
                maxRow = k;
            }
        }

        const tmpA = A[i];
        A[i] = A[maxRow];
        A[maxRow] = tmpA;

        const tmpB = B[i];
        B[i] = B[maxRow];
        B[maxRow] = tmpB;

        const pivot = A[i][i];
        if (Math.abs(pivot) < 1e-10) continue;

        for (let k = i + 1; k < n; k++) {
            const factor = A[k][i] / pivot;
            for (let j = i; j < n; j++) {
                A[k][j] -= factor * A[i][j];
            }
            B[k] -= factor * B[i];
        }
    }

    const X: number[] = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = B[i];
        for (let j = i + 1; j < n; j++) {
            sum -= A[i][j] * X[j];
        }
        X[i] = sum / A[i][i];
    }

    return [
        X[0], X[1], X[2],
        X[3], X[4], X[5],
        X[6], X[7], 1.0
    ];
}

/**
 * Executa a retificação de perspectiva da imagem de origem com base nos 4 cantos.
 * @param sourceCanvas Canvas ou ImageBitmap de origem
 * @param corners 4 cantos selecionados
 * @param targetMaxWidth Largura máxima do destino (padrão 1400px para preservar memória)
 */
export function warpDocumentPerspective(
    sourceCanvas: HTMLCanvasElement,
    corners: DocumentCorners,
    targetMaxWidth = 1400
): HTMLCanvasElement {
    const { topLeft, topRight, bottomRight, bottomLeft } = corners;

    // Calcula dimensões naturais do documento a partir das arestas
    const topWidth = distance(topLeft, topRight);
    const bottomWidth = distance(bottomLeft, bottomRight);
    const avgWidth = Math.max(topWidth, bottomWidth);

    const leftHeight = distance(topLeft, bottomLeft);
    const rightHeight = distance(topRight, bottomRight);
    const avgHeight = Math.max(leftHeight, rightHeight);

    // Limita à resolução ideal para manter a memória extremamente baixa (Anti-OOM)
    let dstWidth = Math.round(avgWidth);
    let dstHeight = Math.round(avgHeight);

    if (dstWidth > targetMaxWidth) {
        dstHeight = Math.round((dstHeight * targetMaxWidth) / dstWidth);
        dstWidth = targetMaxWidth;
    }

    // Garante dimensões mínimas para evitar divisão por zero
    dstWidth = Math.max(dstWidth, 200);
    dstHeight = Math.max(dstHeight, 200);

    const srcWidth = sourceCanvas.width;
    const srcHeight = sourceCanvas.height;

    const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!srcCtx) throw new Error('Não foi possível obter contexto 2D de origem');

    const srcImgData = srcCtx.getImageData(0, 0, srcWidth, srcHeight);
    const srcData32 = new Uint32Array(srcImgData.data.buffer);

    // Canvas de saída
    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = dstWidth;
    dstCanvas.height = dstHeight;
    const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
    if (!dstCtx) throw new Error('Não foi possível obter contexto 2D de destino');

    const dstImgData = dstCtx.createImageData(dstWidth, dstHeight);
    const dstData32 = new Uint32Array(dstImgData.data.buffer);

    const H = getInverseHomographyMatrix(corners, dstWidth, dstHeight);
    const h0 = H[0], h1 = H[1], h2 = H[2];
    const h3 = H[3], h4 = H[4], h5 = H[5];
    const h6 = H[6], h7 = H[7], h8 = H[8];

    // Amostragem com interpolação bilinear ultra-rápida em inteiros/ponto flutuante
    let dstIndex = 0;
    for (let y = 0; y < dstHeight; y++) {
        for (let x = 0; x < dstWidth; x++) {
            const w = h6 * x + h7 * y + h8;
            if (Math.abs(w) < 1e-10) {
                dstData32[dstIndex++] = 0xFFFFFFFF;
                continue;
            }

            const invW = 1.0 / w;
            const u = (h0 * x + h1 * y + h2) * invW;
            const v = (h3 * x + h4 * y + h5) * invW;

            if (u < 0 || u >= srcWidth - 1 || v < 0 || v >= srcHeight - 1) {
                dstData32[dstIndex++] = 0xFFFFFFFF; // Borda branca fora do documento
                continue;
            }

            const u0 = u | 0;
            const v0 = v | 0;
            const u1 = u0 + 1;
            const v1 = v0 + 1;

            const fu = u - u0;
            const fv = v - v0;

            const c00 = srcData32[v0 * srcWidth + u0];
            const c10 = srcData32[v0 * srcWidth + u1];
            const c01 = srcData32[v1 * srcWidth + u0];
            const c11 = srcData32[v1 * srcWidth + u1];

            // Canais em little-endian: R, G, B, A
            const r00 = c00 & 0xFF, g00 = (c00 >> 8) & 0xFF, b00 = (c00 >> 16) & 0xFF;
            const r10 = c10 & 0xFF, g10 = (c10 >> 8) & 0xFF, b10 = (c10 >> 16) & 0xFF;
            const r01 = c01 & 0xFF, g01 = (c01 >> 8) & 0xFF, b01 = (c01 >> 16) & 0xFF;
            const r11 = c11 & 0xFF, g11 = (c11 >> 8) & 0xFF, b11 = (c11 >> 16) & 0xFF;

            const rTop = r00 + fu * (r10 - r00);
            const rBot = r01 + fu * (r11 - r01);
            const r = (rTop + fv * (rBot - rTop)) | 0;

            const gTop = g00 + fu * (g10 - g00);
            const gBot = g01 + fu * (g11 - g01);
            const g = (gTop + fv * (gBot - gTop)) | 0;

            const bTop = b00 + fu * (b10 - b00);
            const bBot = b01 + fu * (b11 - b01);
            const b = (bTop + fv * (bBot - bTop)) | 0;

            dstData32[dstIndex++] = (0xFF << 24) | (b << 16) | (g << 8) | r;
        }
    }

    dstCtx.putImageData(dstImgData, 0, 0);
    return dstCanvas;
}
