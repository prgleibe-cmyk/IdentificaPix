/**
 * Motor de Leitura Óptica (OCR) e Decodificação de Código de Barras / QR Code no Navegador.
 * Executa estritamente no cliente/navegador em Web Worker, sem IA generativa e sem envio para APIs externas.
 */

import { BrowserMultiFormatReader } from '@zxing/library';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Singleton para leitor de códigos de barras (ZXing)
let barcodeReaderInstance: BrowserMultiFormatReader | null = null;
function getBarcodeReader(): BrowserMultiFormatReader {
    if (!barcodeReaderInstance) {
        barcodeReaderInstance = new BrowserMultiFormatReader();
    }
    return barcodeReaderInstance;
}

// Singleton / Cache para worker do Tesseract.js
let tesseractWorkerPromise: Promise<any> | null = null;
let tesseractWorkerInstance: any = null;

export async function getTesseractWorker(onProgress?: (progress: number) => void): Promise<any> {
    if (tesseractWorkerInstance) {
        return tesseractWorkerInstance;
    }
    if (tesseractWorkerPromise) {
        return tesseractWorkerPromise;
    }

    tesseractWorkerPromise = (async () => {
        try {
            const worker = await createWorker('por', 1, {
                logger: (m: any) => {
                    if (m && m.status === 'recognizing text' && typeof m.progress === 'number' && onProgress) {
                        onProgress(Math.round(m.progress * 100));
                    }
                }
            });
            tesseractWorkerInstance = worker;
            return worker;
        } catch (err) {
            console.warn('[OCR] Falha ao carregar dicionário em português, tentando fallback inglês:', err);
            try {
                const fallbackWorker = await createWorker('eng', 1, {
                    logger: (m: any) => {
                        if (m && m.status === 'recognizing text' && typeof m.progress === 'number' && onProgress) {
                            onProgress(Math.round(m.progress * 100));
                        }
                    }
                });
                tesseractWorkerInstance = fallbackWorker;
                return fallbackWorker;
            } catch (fallbackErr) {
                console.error('[OCR] Falha crítica ao inicializar motor Tesseract:', fallbackErr);
                throw fallbackErr;
            }
        } finally {
            tesseractWorkerPromise = null;
        }
    })();

    return tesseractWorkerPromise;
}

/**
 * Lê códigos de barras (Boleto) ou QR Code (PIX / NFC-e) instantaneamente (< 50ms)
 */
export async function readBarcodeOrQrFromImage(imageDataUrl: string): Promise<string | null> {
    if (typeof window === 'undefined' || !imageDataUrl) return null;
    try {
        const reader = getBarcodeReader();
        const result = await reader.decodeFromImageUrl(imageDataUrl);
        if (result && result.getText()) {
            return result.getText().trim();
        }
    } catch (_) {
        // Normal: a grande maioria das imagens não tem barcode legível ou o ângulo requer OCR
    }
    return null;
}

/**
 * Decodifica padrão BR Code PIX (EMVCo) caso o QR code contenha dados estruturados de pagamento
 */
export function parsePixEmvQrCode(qrText: string): { amount: number | null; recipient: string | null; key: string | null; txId: string | null } | null {
    if (!qrText || (!qrText.startsWith('000201') && !qrText.includes('br.gov.bcb.pix'))) return null;
    try {
        let i = 0;
        let amount: number | null = null;
        let recipient: string | null = null;
        let key: string | null = null;
        let txId: string | null = null;

        while (i < qrText.length - 4) {
            const tag = qrText.slice(i, i + 2);
            const len = parseInt(qrText.slice(i + 2, i + 4), 10);
            if (isNaN(len) || len <= 0 || i + 4 + len > qrText.length) break;
            const val = qrText.slice(i + 4, i + 4 + len);
            i += 4 + len;

            if (tag === '54') {
                const parsed = parseFloat(val);
                if (!isNaN(parsed) && parsed > 0) amount = parsed;
            } else if (tag === '59') {
                recipient = val.trim();
            } else if (tag === '26') {
                // Sub-tags dentro do bloco 26 (Merchant Account Info - PIX)
                let j = 0;
                while (j < val.length - 4) {
                    const subTag = val.slice(j, j + 2);
                    const subLen = parseInt(val.slice(j + 2, j + 4), 10);
                    if (isNaN(subLen) || subLen <= 0 || j + 4 + subLen > val.length) break;
                    const subVal = val.slice(j + 4, j + 4 + subLen);
                    j += 4 + subLen;
                    if (subTag === '01') {
                        key = subVal.trim();
                    }
                }
            } else if (tag === '62') {
                // Sub-tags dentro do bloco 62 (Additional Data Field)
                let j = 0;
                while (j < val.length - 4) {
                    const subTag = val.slice(j, j + 2);
                    const subLen = parseInt(val.slice(j + 2, j + 4), 10);
                    if (isNaN(subLen) || subLen <= 0 || j + 4 + subLen > val.length) break;
                    const subVal = val.slice(j + 4, j + 4 + subLen);
                    j += 4 + subLen;
                    if (subTag === '05') {
                        txId = subVal.trim();
                    }
                }
            }
        }

        return { amount, recipient, key, txId };
    } catch (_) {
        return null;
    }
}

/**
 * Executa o OCR completo sobre uma imagem via Tesseract.js em Web Worker
 */
export async function extractTextFromImageOcr(
    imageDataUrl: string, 
    onProgress?: (progress: number) => void
): Promise<string> {
    if (typeof window === 'undefined' || !imageDataUrl) return '';

    try {
        const worker = await getTesseractWorker(onProgress);
        const { data } = await worker.recognize(imageDataUrl);
        return data?.text || '';
    } catch (err) {
        console.warn('[OCR] Falha na extração de texto via Tesseract:', err);
        return '';
    }
}

/**
 * Converte a primeira página de um PDF escaneado (sem texto digital) em imagem para passar no OCR
 */
export async function renderPdfFirstPageToImage(arrayBuffer: ArrayBuffer): Promise<string | null> {
    if (typeof window === 'undefined' || !arrayBuffer) return null;
    try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        if (pdf.numPages < 1) return null;

        const page = await pdf.getPage(1);
        // Escala 1.8x para manter alta densidade de pixels (equivalente a ~300 DPI) para máxima precisão no OCR
        const viewport = page.getViewport({ scale: 1.8 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        await (page as any).render({ canvas, canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
        console.warn('[OCR] Falha ao renderizar página do PDF em canvas:', err);
        return null;
    }
}

/**
 * Pipeline Integrado: Executa Barcode/QR Code ultrarrápido + OCR Tesseract em imagem ou foto
 */
export async function processImageAndExtractText(
    imageDataUrl: string,
    fileName?: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    let combinedText = '';

    // 1. Linha rápida (< 50ms): Decodificação de Código de Barras e QR Code (Boleto / PIX / NFC-e)
    try {
        const barcodeText = await readBarcodeOrQrFromImage(imageDataUrl);
        if (barcodeText) {
            combinedText += `CODIGO_DETECTADO: ${barcodeText}\n`;
            
            // Se for QR Code do Pix, adiciona metadados diretos
            const pixData = parsePixEmvQrCode(barcodeText);
            if (pixData) {
                if (pixData.amount) combinedText += `VALOR PIX: R$ ${pixData.amount.toFixed(2).replace('.', ',')}\n`;
                if (pixData.recipient) combinedText += `FAVORECIDO PIX: ${pixData.recipient}\n`;
                if (pixData.key) combinedText += `CHAVE PIX: ${pixData.key}\n`;
            }
        }
    } catch (err) {
        console.warn('[Barcode/QR] Erro na verificação rápida:', err);
    }

    // 2. Reconhecimento Óptico de Caracteres (Tesseract.js)
    try {
        const ocrText = await extractTextFromImageOcr(imageDataUrl, onProgress);
        if (ocrText && ocrText.trim().length > 0) {
            combinedText += `\n${ocrText}`;
        }
    } catch (err) {
        console.warn('[OCR Engine] Erro no processamento de texto da imagem:', err);
    }

    if (fileName && !combinedText.includes(fileName)) {
        combinedText = `ARQUIVO: ${fileName}\n` + combinedText;
    }

    return combinedText;
}
