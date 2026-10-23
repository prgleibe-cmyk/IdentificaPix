/**
 * pdfCompiler.ts
 * 
 * Compilador multi-página de documentos escaneados para PDF padronizado.
 * Utiliza o jsPDF nativo já instalado no projeto.
 * 
 * Cada página é encaixada proporcionalmente em formato A4 com margens limpas,
 * compressão ativa de stream e geração instantânea de dataUrl / Blob.
 */

import { jsPDF } from 'jspdf';

export interface ScannedPageItem {
    id: string;
    dataUrl: string; // JPEG otimizado (80KB - 140KB)
    width: number;
    height: number;
}

export interface CompiledPdfResult {
    dataUrl: string;
    blob: Blob;
    size: number;
    pageCount: number;
    fileName: string;
}

export interface CompilePdfOptions {
    fileName?: string;
    documentTitle?: string;
    marginMm?: number;
    quality?: number;
}

/**
 * Formata um timestamp para nome de arquivo contábil amigável
 */
function getDefaultScannedFileName(prefix = 'Documento_Digitalizado'): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${prefix}_${year}${month}${day}_${hours}${minutes}.pdf`;
}

/**
 * Compila uma lista de páginas escaneadas em um único arquivo PDF padrão A4
 */
export async function compilePagesToPdf(
    pages: ScannedPageItem[],
    options: CompilePdfOptions = {}
): Promise<CompiledPdfResult> {
    if (!pages || pages.length === 0) {
        throw new Error('Nenhuma página fornecida para geração de PDF');
    }

    const margin = options.marginMm ?? 8; // Margem de 8mm para impressão limpa
    const fileName = options.fileName || getDefaultScannedFileName();

    // Cria documento jsPDF inicial com compressão interna
    const firstPage = pages[0];
    const isFirstLandscape = firstPage.width > firstPage.height;
    const initialOrientation = isFirstLandscape ? 'landscape' : 'portrait';

    const doc = new jsPDF({
        orientation: initialOrientation,
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    pages.forEach((page, index) => {
        const isLandscape = page.width > page.height;
        const orientation = isLandscape ? 'landscape' : 'portrait';

        const pageWidth = isLandscape ? 297 : 210;
        const pageHeight = isLandscape ? 210 : 297;

        if (index > 0) {
            doc.addPage([pageWidth, pageHeight], orientation);
        }

        const maxAvailableW = pageWidth - 2 * margin;
        const maxAvailableH = pageHeight - 2 * margin;

        const imgAspect = page.width / (page.height || 1);
        const pageAspect = maxAvailableW / maxAvailableH;

        let renderW = maxAvailableW;
        let renderH = maxAvailableH;

        if (imgAspect > pageAspect) {
            // Imagem é mais larga proporcionalmente: trava na largura
            renderW = maxAvailableW;
            renderH = maxAvailableW / imgAspect;
        } else {
            // Imagem é mais alta proporcionalmente: trava na altura
            renderH = maxAvailableH;
            renderW = maxAvailableH * imgAspect;
        }

        // Centraliza na página
        const posX = margin + (maxAvailableW - renderW) / 2;
        const posY = margin + (maxAvailableH - renderH) / 2;

        try {
            doc.addImage(
                page.dataUrl,
                'JPEG',
                posX,
                posY,
                renderW,
                renderH,
                undefined,
                'FAST'
            );
        } catch (addImgErr) {
            console.error(`[pdfCompiler] Erro ao adicionar página ${index + 1} no PDF:`, addImgErr);
        }
    });

    const blob = doc.output('blob');
    const dataUrl = doc.output('datauristring');
    const size = blob.size;

    return {
        dataUrl,
        blob,
        size,
        pageCount: pages.length,
        fileName
    };
}
