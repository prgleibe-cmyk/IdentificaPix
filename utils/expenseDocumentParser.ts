import * as pdfjsLib from 'pdfjs-dist';
import { parseInvoiceXml, isXmlContent } from './nfeXmlParser';
export { parseInvoiceXml, isXmlContent } from './nfeXmlParser';
import {
    extractValidCnpjCpf,
    extractBoletoLine,
    extractDueDateFromText,
    extractDocumentNumberFromText,
    extractConcessionariaOrRecipient
} from './brazilianDocUtils';
export * from './brazilianDocUtils';

// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configuração do worker do pdfjs-dist
if (typeof window !== 'undefined') {
    try {
        if (pdfWorkerUrl) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        } else {
            const version = pdfjsLib.version || '6.2.108';
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
        }
    } catch (e) {
        console.warn('[PDF.js] Worker configuration fallback:', e);
    }
}

export type DocumentType = 
    | 'comprovante_pix'
    | 'comprovante_pagamento'
    | 'boleto'
    | 'nota_fiscal'
    | 'fatura'
    | 'recibo'
    | 'outro';

export type ValidationStatus = 'validated' | 'divergent' | 'pending_attachment' | 'manual_review';
export type ExpenseValidationStatus = ValidationStatus;
export type DocumentRole = 'nota_fiscal' | 'fatura' | 'comprovante' | 'recibo' | 'outro';

export interface ExtractedDocItem {
    name: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ExtractedExpenseDoc {
    documentType: DocumentType;
    documentTypeLabel: string;
    extractedAmount: number | null;
    allDetectedAmounts: number[];
    extractedDate: string | null;
    extractedDueDate?: string | null;
    extractedRecipient: string | null;
    extractedRecipientCnpjCpf?: string | null;
    extractedPayer: string | null;
    extractedPayerCnpjCpf?: string | null;
    documentNumber?: string | null;
    accessKey?: string | null;
    barcodeOrAuth: string | null;
    items?: ExtractedDocItem[];
    suggestedCategory?: string | null;
    confidenceLevel?: ConfidenceLevel;
    rawText: string;
    confidenceScore: number;
}

export interface ExpenseAttachment {
    id: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadedAt: string;
    dataUrl?: string;
    extractedData?: ExtractedExpenseDoc;
    validationStatus: ValidationStatus;
    validationNotes?: string;
    documentRole?: DocumentRole;
}

/**
 * Infere se o documento é uma Nota Fiscal (compra), Fatura/Boleto (cobrança),
 * um Comprovante de Pagamento (quitação bancária) ou Outro.
 */
export function inferDocumentRole(docType: DocumentType, fileName?: string): DocumentRole {
    if (docType === 'nota_fiscal') {
        return 'nota_fiscal';
    }
    if (docType === 'fatura' || docType === 'boleto') {
        return 'fatura';
    }
    if (docType === 'comprovante_pix' || docType === 'comprovante_pagamento' || docType === 'recibo') {
        return 'comprovante';
    }
    if (fileName) {
        const lower = fileName.toLowerCase();
        if (lower.includes('danfe') || lower.includes('nota fiscal') || lower.includes('nfe') || lower.includes('nf-e') || lower.includes('cupom') || lower.includes('sat') || lower.endsWith('.xml')) {
            return 'nota_fiscal';
        }
        if (lower.includes('fatura') || lower.includes('boleto') || lower.includes('cobranca') || lower.includes('conta')) {
            return 'fatura';
        }
        if (lower.includes('comprovante') || lower.includes('pix') || lower.includes('pagamento') || lower.includes('recibo') || lower.includes('ted') || lower.includes('quitad') || lower.includes('pago')) {
            return 'comprovante';
        }
    }
    return 'outro';
}

/**
 * Redimensiona e comprime imagens fotográficas (comprovantes ou faturas fotografadas no celular)
 * para evitar sobrecarga de memória e lentidão de upload, mantendo excelente nitidez para leitura.
 */
export async function compressImageIfNeeded(
    file: File, 
    maxDimension = 1600, 
    quality = 0.82
): Promise<{ dataUrl: string; size: number }> {
    return new Promise((resolve) => {
        // Se não for imagem comum, fallback direto via FileReader
        if (!file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => resolve({ dataUrl: reader.result as string, size: file.size });
            reader.onerror = () => resolve({ dataUrl: '', size: file.size });
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const initialDataUrl = e.target?.result as string;
            if (!initialDataUrl) {
                resolve({ dataUrl: '', size: file.size });
                return;
            }

            // Se o arquivo for menor que 600KB, não necessita de re-compressão
            if (file.size < 600 * 1024) {
                resolve({ dataUrl: initialDataUrl, size: file.size });
                return;
            }

            try {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        } else {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve({ dataUrl: initialDataUrl, size: file.size });
                        return;
                    }

                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    const approxSize = Math.round((compressedDataUrl.length - 22) * 3 / 4);
                    resolve({ 
                        dataUrl: compressedDataUrl, 
                        size: approxSize > 0 ? approxSize : file.size 
                    });
                };
                img.onerror = () => {
                    resolve({ dataUrl: initialDataUrl, size: file.size });
                };
                img.src = initialDataUrl;
            } catch (err) {
                console.warn('[ImageCompressor] Fallback para original:', err);
                resolve({ dataUrl: initialDataUrl, size: file.size });
            }
        };
        reader.onerror = () => resolve({ dataUrl: '', size: file.size });
        reader.readAsDataURL(file);
    });
}

/**
 * Converte string de valor brasileiro (ex: 'R$ 1.234,56' ou '1234,56') para number
 */
export function parseBRLNumber(valStr: string): number | null {
    if (!valStr) return null;
    try {
        // Remove símbolos de moeda e espaços extras
        let clean = valStr.replace(/[R$\s]/g, '').trim();
        // Trata pontos como milhar e vírgula como decimal
        if (clean.includes(',') && clean.includes('.')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else if (clean.includes(',')) {
            clean = clean.replace(',', '.');
        }
        const num = parseFloat(clean);
        return isNaN(num) ? null : Math.round(num * 100) / 100;
    } catch {
        return null;
    }
}

/**
 * Extrai texto completo de um arquivo PDF via pdfjs-dist com fallback seguro
 */
export async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
    const parseWithLib = async (lib: any): Promise<string> => {
        const loadingTask = lib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            let lastY: number | null = null;
            const pageLines: string[] = [];
            let currentLine = '';

            for (const item of (textContent.items as any[])) {
                if (item && typeof item.str === 'string') {
                    const itemY = Array.isArray(item.transform) ? item.transform[5] : null;
                    if (lastY !== null && itemY !== null && Math.abs(itemY - lastY) > 4) {
                        if (currentLine.trim()) {
                            pageLines.push(currentLine.trim());
                        }
                        currentLine = item.str;
                    } else {
                        currentLine += (currentLine ? ' ' : '') + item.str;
                    }
                    if (itemY !== null) {
                        lastY = itemY;
                    }
                }
            }
            if (currentLine.trim()) {
                pageLines.push(currentLine.trim());
            }

            fullText += pageLines.join('\n') + '\n';
        }

        return fullText;
    };

    // 1. Tenta com pdfjs-dist local/empacotado
    try {
        const text = await parseWithLib(pdfjsLib);
        if (text && text.trim().length > 0) {
            return text;
        }
    } catch (err) {
        console.warn('[PDF Parser] Tentativa com pdfjs-dist empacotado falhou, tentando fallback cdnjs:', err);
    }

    // 2. Fallback de alta confiabilidade via cdnjs (mesma infraestrutura do PDFRenderer e FileUploader)
    if (typeof window !== 'undefined') {
        try {
            const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            const WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            if (!(window as any).pdfjsLib) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = PDFJS_URL;
                    script.onload = () => resolve();
                    script.onerror = (err) => reject(new Error('Failed to load fallback PDF.js'));
                    document.head.appendChild(script);
                });
            }

            const winPdf = (window as any).pdfjsLib;
            if (winPdf) {
                winPdf.GlobalWorkerOptions.workerSrc = WORKER_URL;
                return await parseWithLib(winPdf);
            }
        } catch (fallbackErr) {
            console.error('[PDF Parser] Fallback cdnjs também falhou:', fallbackErr);
        }
    }

    return '';
}

/**
 * Detecta o tipo de documento baseado no vocabulário e padrões textuais
 */
export function detectDocumentType(text: string): { type: DocumentType; label: string } {
    const lower = text.toLowerCase();

    if (lower.includes('comprovante de pix') || lower.includes('pix transfer') || lower.includes('chave pix') || lower.includes('pagamento pix') || lower.includes('envio de pix')) {
        return { type: 'comprovante_pix', label: 'Comprovante PIX' };
    }
    if (lower.includes('comprovante de pagamento') || lower.includes('comprovante de transferencia') || lower.includes('ted') || lower.includes('transferencia entre contas') || lower.includes('autenticacao bancaria') || lower.includes('autenticacao mecanica')) {
        return { type: 'comprovante_pagamento', label: 'Comprovante de Pagamento' };
    }
    if (lower.includes('linha digitavel') || lower.includes('codigo de barras') || lower.includes('cedente') || lower.includes('sacado') || lower.includes('boleto de cobranca') || lower.includes('pagavel em qualquer banco')) {
        return { type: 'boleto', label: 'Boleto Bancário' };
    }
    if (lower.includes('danfe') || lower.includes('nota fiscal') || lower.includes('nfs-e') || lower.includes('nf-e') || lower.includes('documento auxiliar') || lower.includes('cnpj prestador') || lower.includes('discriminacao dos servicos')) {
        return { type: 'nota_fiscal', label: 'Nota Fiscal / DANFE' };
    }
    if (lower.includes('fatura') || lower.includes('demonstrativo de despesas') || lower.includes('total da fatura') || lower.includes('historico de consumo') || lower.includes('vencimento da fatura')) {
        return { type: 'fatura', label: 'Fatura de Serviço' };
    }
    if (lower.includes('recibo de pagamento') || lower.includes('recibo') || lower.includes('recebemos de')) {
        return { type: 'recibo', label: 'Recibo' };
    }

    return { type: 'outro', label: 'Documento Financeiro' };
}

/**
 * Extrai valores monetários relevantes do texto de documentos brasileiros
 */
export function extractAmountsFromText(text: string): { primaryAmount: number | null; allAmounts: number[] } {
    const allAmounts: number[] = [];

    // Padrões de alta prioridade (frases com palavras-chave de valor final ou total)
    const priorityPatterns = [
        /(?:valor\s*(?:pago|total|l[ií]quido|do\s*documento|principal|da\s*nota|recebido|cobrado|a\s*pagar|a\s*cobrar|d[eé]bito|da\s*transa[cç][aã]o|transferido|da\s*fatura|do\s*boleto|final)|total\s*a\s*pagar|valor\s*a\s*pagar|total\s*geral|total\s*nota|valor\s*da\s*opera[cç][aã]o|valor)\s*[:=]?\s*(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*\,[0-9]{2}|[0-9]{1,9}\,[0-9]{2})/gi,
        /(?:R\$\s*)([0-9]{1,3}(?:\.[0-9]{3})*\,[0-9]{2}|[0-9]{1,9}\,[0-9]{2})/gi
    ];

    let primaryAmount: number | null = null;

    // 1. Tentar padrões de alta prioridade
    for (const pattern of priorityPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const parsed = parseBRLNumber(match[1]);
            if (parsed !== null && parsed > 0) {
                if (primaryAmount === null) {
                    primaryAmount = parsed;
                }
                if (!allAmounts.includes(parsed)) {
                    allAmounts.push(parsed);
                }
            }
        }
    }

    // 2. Se ainda não encontrou com prefixos, buscar qualquer formato monetário isolado
    if (allAmounts.length === 0) {
        const generalAmountPattern = /\b([0-9]{1,3}(?:\.[0-9]{3})*\,[0-9]{2})\b|\b([0-9]{1,9}\,[0-9]{2})\b/g;
        let match;
        while ((match = generalAmountPattern.exec(text)) !== null) {
            const matchedStr = match[1] || match[2];
            const parsed = parseBRLNumber(matchedStr);
            if (parsed !== null && parsed > 0 && !allAmounts.includes(parsed)) {
                allAmounts.push(parsed);
            }
        }
        if (allAmounts.length > 0) {
            // Em caso de múltiplos, o maior ou o primeiro após contexto de pagamento é candidato
            primaryAmount = allAmounts[0];
        }
    }

    return { primaryAmount, allAmounts };
}

/**
 * Extrai beneficiário / favorecido / emitente / razão social do texto
 */
export function extractRecipientFromText(text: string): string | null {
    const patterns = [
        /(?:emitente|raz[aã]o\s*social|nome\s*empresarial|nome\s*fantasia|cedente|benefici[aá]rio(?:\s*final)?|prestador\s*(?:de\s*servi[cç]os?)?|prestador|fornecedor|favorecido|nome\s*do\s*favorecido|recebedor|nome\s*do\s*recebedor|destinat[aá]rio|credor|dados\s*do\s*emitente)\s*[:=]?\s*([A-Za-zÀ-ÿ0-9\s\.\-]{3,60})/i,
        /(?:para\s*:?|pago\s*a\s*:?|nome\s*do\s*benefici[aá]rio)\s*[:=]?\s*([A-Za-zÀ-ÿ0-9\s\.\-]{3,50})/i,
        /(?:emitente|prestador\s*(?:de\s*servi[cç]os?)?|benefici[aá]rio|cedente)\s*[\r\n]+\s*([A-Za-zÀ-ÿ0-9\s\.\-]{3,60})/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            let cleaned = match[1].replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
            // Remove sufixos como CNPJ se capturados juntos
            cleaned = cleaned.replace(/\s+(?:cnpj|cpf|inscri[cç][aã]o|telefone|endere[cç]o).*$/i, '').trim();
            // Evita capturar linhas muito genéricas ou puramente numéricas
            if (cleaned.length >= 3 && !/^\d+$/.test(cleaned) && !cleaned.toLowerCase().includes('cpf') && !cleaned.toLowerCase().includes('cnpj')) {
                return cleaned;
            }
        }
    }

    return null;
}

/**
 * Extrai data presente no documento (apenas para exibição/referência do documento)
 */
export function extractDateFromText(text: string): string | null {
    const dateMatch = text.match(/\b([0-3]?[0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.](20[2-3][0-9])\b/);
    if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        return `${year}-${month}-${day}`;
    }
    return null;
}

/**
 * Analisa o texto extraído de um documento de despesa e gera metadados estruturados
 */
export function analyzeExpenseDocumentText(rawText: string): ExtractedExpenseDoc {
    // Se for XML estruturado de nota fiscal (NF-e, NFC-e ou NFS-e), realiza extração direta
    if (isXmlContent(rawText)) {
        const xmlDoc = parseInvoiceXml(rawText);
        if (xmlDoc) {
            return xmlDoc;
        }
    }

    const docType = detectDocumentType(rawText);
    const { primaryAmount, allAmounts } = extractAmountsFromText(rawText);
    const date = extractDateFromText(rawText);
    const recipient = extractRecipientFromText(rawText);

    // Extração estruturada brasileira (CNPJ/CPF, Boleto, Vencimento, Número do Documento)
    const cnpjData = extractValidCnpjCpf(rawText);
    const boletoData = extractBoletoLine(rawText);
    const docNumData = extractDocumentNumberFromText(rawText);
    const dueDate = extractDueDateFromText(rawText) || boletoData.boletoDueDate;
    const knownEntity = extractConcessionariaOrRecipient(rawText);

    // Se identificou linha de boleto válida e docType for genérico ou fatura, categoriza como boleto
    let finalDocType = docType.type;
    let finalDocLabel = docType.label;
    if (boletoData.barcodeOrLine && (finalDocType === 'outro' || finalDocType === 'fatura')) {
        finalDocType = 'boleto';
        finalDocLabel = boletoData.boletoType === 'concessionaria' ? 'Conta de Consumo / Concessionária' : 'Boleto Bancário';
    }

    // Se a linha digitável possui valor embutido com exatidão, utiliza-o para validar ou complementar
    let finalAmount = primaryAmount;
    if (boletoData.boletoAmount && boletoData.boletoAmount > 0) {
        if (!finalAmount || allAmounts.some(a => Math.abs(a - boletoData.boletoAmount!) < 0.05)) {
            finalAmount = boletoData.boletoAmount;
            if (!allAmounts.includes(finalAmount)) {
                allAmounts.unshift(finalAmount);
            }
        }
    }

    // Favorecido: se detectou concessionária conhecida (ex: Enel, Sabesp, CPFL), prioriza; senão usa o recipient textual
    const finalRecipient = knownEntity || recipient;

    // Código de autenticação ou barras se houver
    let barcodeOrAuth: string | null = boletoData.barcodeOrLine;
    if (!barcodeOrAuth) {
        const authMatch = rawText.match(/(?:autenticacao|controle|id\s*da\s*transacao|codigo\s*de\s*autenticacao)\s*[:=]?\s*([A-Za-z0-9\.\-\_]{8,40})/i);
        if (authMatch) {
            barcodeOrAuth = authMatch[1].trim();
        }
    }

    // Cálculo determinístico do nível de confiança
    let confidence = 0;
    if (finalDocType !== 'outro') confidence += 20;
    if (finalAmount !== null) confidence += 35;
    if (finalRecipient) confidence += 15;
    if (date || dueDate) confidence += 15;
    if (cnpjData.recipientCnpjCpf) confidence += 10;
    if (boletoData.barcodeOrLine) confidence += 15;

    confidence = Math.min(confidence, 95);

    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (boletoData.barcodeOrLine && finalAmount !== null) {
        confidenceLevel = 'high';
    } else if (finalAmount !== null && (cnpjData.recipientCnpjCpf || finalRecipient) && (date || dueDate)) {
        confidenceLevel = 'medium';
    }

    return {
        documentType: finalDocType,
        documentTypeLabel: finalDocLabel,
        extractedAmount: finalAmount,
        allDetectedAmounts: allAmounts,
        extractedDate: date,
        extractedDueDate: dueDate,
        extractedRecipient: finalRecipient,
        extractedPayer: null,
        extractedRecipientCnpjCpf: cnpjData.recipientCnpjCpf,
        extractedPayerCnpjCpf: cnpjData.payerCnpjCpf,
        documentNumber: docNumData.documentNumber,
        accessKey: docNumData.accessKey,
        barcodeOrAuth,
        rawText: rawText.slice(0, 3000), // Armazena trecho para conferência
        confidenceScore: confidence,
        confidenceLevel
    };
}

/**
 * Valida o valor lançado pelo tesoureiro contra os dados do documento anexado.
 * IMPORTANTE: NÃO valida data (não força compatibilidade de data para não travar parcelamentos ou adiantamentos).
 */
export function validateExpenseAgainstDocument(
    launchAmount: number,
    extractedDoc?: ExtractedExpenseDoc | null
): { status: ValidationStatus; message: string; diff: number } {
    if (!extractedDoc) {
        return {
            status: 'pending_attachment',
            message: 'Nenhum documento/comprovante anexado.',
            diff: 0
        };
    }

    const docAmount = extractedDoc.extractedAmount;

    // Se nenhum valor numérico foi extraído com clareza
    if (docAmount === null || docAmount === undefined) {
        return {
            status: 'manual_review',
            message: 'Documento anexado, mas o valor não pôde ser detectado automaticamente. Verificação visual recomendada.',
            diff: 0
        };
    }

    const diff = Math.round(Math.abs(launchAmount - docAmount) * 100) / 100;

    // Se valor bate exatamente ou tolerância de centavos
    if (diff < 0.01) {
        return {
            status: 'validated',
            message: `Valor do lançamento confere com o ${extractedDoc.documentTypeLabel} (R$ ${docAmount.toFixed(2)}).`,
            diff: 0
        };
    }

    // Se o valor lançado coincide com algum dos outros valores encontrados no documento
    if (extractedDoc.allDetectedAmounts.some(amt => Math.abs(amt - launchAmount) < 0.01)) {
        return {
            status: 'validated',
            message: `Valor de R$ ${launchAmount.toFixed(2)} validado com item/total do documento.`,
            diff: 0
        };
    }

    // Divergência de valor
    return {
        status: 'divergent',
        message: `Divergência: Lançamento é R$ ${launchAmount.toFixed(2)}, mas o documento indica R$ ${docAmount.toFixed(2)} (Diferença de R$ ${diff.toFixed(2)}).`,
        diff
    };
}
