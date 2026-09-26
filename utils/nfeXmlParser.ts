import { ExtractedExpenseDoc, ExtractedDocItem } from './expenseDocumentParser';

/**
 * Utilitário determinístico para extração estruturada de dados de
 * Notas Fiscais Eletrônicas (NF-e, NFC-e modelo 55/65 e NFS-e de Serviços)
 * via XML nativo (DOMParser standard), sem uso de IA ou bibliotecas externas.
 */

/**
 * Formata CNPJ (14 dígitos) ou CPF (11 dígitos) com pontuação brasileira padrão
 */
export function formatCnpjCpf(value: string | null | undefined): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 14) {
        return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (digits.length === 11) {
        return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return digits || null;
}

/**
 * Converte data ISO/SEFAZ (ex: '2024-05-15T14:30:00-03:00' ou '2024-05-15') para 'YYYY-MM-DD'
 */
export function normalizeXmlDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const clean = dateStr.trim();
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    const brMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
        return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
    return null;
}

/**
 * Converte string numérica do XML (ex: '150.00' ou '1234.56') para number
 */
export function parseXmlNumber(valStr: string | null | undefined): number | null {
    if (!valStr) return null;
    const clean = valStr.trim().replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? null : Math.round(num * 100) / 100;
}

/**
 * Busca o texto da primeira tag encontrada dentro de um elemento ou documento XML.
 * Suporta busca direta por nome de tag e com namespace.
 */
function getTagText(parent: Element | Document | null, tagName: string): string | null {
    if (!parent) return null;

    // 1. getElementsByTagName simples
    try {
        const elements = parent.getElementsByTagName(tagName);
        if (elements && elements.length > 0 && elements[0].textContent) {
            const text = elements[0].textContent.trim();
            if (text) return text;
        }
    } catch (_) {}

    // 2. getElementsByTagNameNS com wildcard '*'
    try {
        if (typeof (parent as any).getElementsByTagNameNS === 'function') {
            const nsElements = (parent as any).getElementsByTagNameNS('*', tagName);
            if (nsElements && nsElements.length > 0 && nsElements[0].textContent) {
                const text = nsElements[0].textContent.trim();
                if (text) return text;
            }
        }
    } catch (_) {}

    return null;
}

/**
 * Busca uma lista de elementos filhos por nome de tag (com e sem namespace)
 */
function getTagElements(parent: Element | Document | null, tagName: string): Element[] {
    if (!parent) return [];
    try {
        const list = parent.getElementsByTagName(tagName);
        if (list && list.length > 0) {
            return Array.from(list);
        }
    } catch (_) {}

    try {
        if (typeof (parent as any).getElementsByTagNameNS === 'function') {
            const nsList = (parent as any).getElementsByTagNameNS('*', tagName);
            if (nsList && nsList.length > 0) {
                return Array.from(nsList);
            }
        }
    } catch (_) {}

    return [];
}

/**
 * Identifica se a string bruta parece conter conteúdo XML
 */
export function isXmlContent(content: string): boolean {
    if (!content) return false;
    const trimmed = content.trim();
    return (
        trimmed.startsWith('<?xml') ||
        (trimmed.startsWith('<') && (
            trimmed.includes('<nfeProc') ||
            trimmed.includes('<NFe') ||
            trimmed.includes('<infNFe') ||
            trimmed.includes('<CompNfse') ||
            trimmed.includes('<Nfse') ||
            trimmed.includes('<Rps') ||
            trimmed.includes('<ConsultarNfseResposta') ||
            trimmed.includes('<enviNFe')
        ))
    );
}

/**
 * Parser determinístico para NF-e / NFC-e (Mercadorias - Padrão Nacional SEFAZ)
 */
function parseSefazNfe(xmlDoc: Document, rawText: string): ExtractedExpenseDoc | null {
    // Verifica se possui tag infNFe
    const infNFeElements = getTagElements(xmlDoc, 'infNFe');
    if (infNFeElements.length === 0) {
        return null;
    }

    const infNFe = infNFeElements[0];

    // Chave de Acesso (44 dígitos)
    let accessKey = getTagText(xmlDoc, 'chNFe');
    if (!accessKey) {
        const idAttr = infNFe.getAttribute('Id');
        if (idAttr) {
            accessKey = idAttr.replace(/^NFe/i, '').trim();
        }
    }

    // Identificação (<ide>)
    const ideList = getTagElements(infNFe, 'ide');
    const ide = ideList.length > 0 ? ideList[0] : infNFe;
    const documentNumber = getTagText(ide, 'nNF');
    const serie = getTagText(ide, 'serie');
    const rawEmissionDate = getTagText(ide, 'dhEmi') || getTagText(ide, 'dEmi');
    const extractedDate = normalizeXmlDate(rawEmissionDate);

    // Emitente / Fornecedor (<emit>)
    const emitList = getTagElements(infNFe, 'emit');
    const emit = emitList.length > 0 ? emitList[0] : null;
    const recipientName = emit ? (getTagText(emit, 'xNome') || getTagText(emit, 'xFant')) : null;
    const rawRecipientCnpj = emit ? (getTagText(emit, 'CNPJ') || getTagText(emit, 'CPF')) : null;
    const extractedRecipientCnpjCpf = formatCnpjCpf(rawRecipientCnpj);

    // Destinatário / Tomador (<dest>)
    const destList = getTagElements(infNFe, 'dest');
    const dest = destList.length > 0 ? destList[0] : null;
    const payerName = dest ? getTagText(dest, 'xNome') : null;
    const rawPayerCnpj = dest ? (getTagText(dest, 'CNPJ') || getTagText(dest, 'CPF')) : null;
    const extractedPayerCnpjCpf = formatCnpjCpf(rawPayerCnpj);

    // Totais (<total><ICMSTot>)
    let primaryAmount: number | null = null;
    const totalList = getTagElements(infNFe, 'total');
    if (totalList.length > 0) {
        const icmsTotList = getTagElements(totalList[0], 'ICMSTot');
        const targetTot = icmsTotList.length > 0 ? icmsTotList[0] : totalList[0];
        primaryAmount = parseXmlNumber(getTagText(targetTot, 'vNF'));
    }
    if (primaryAmount === null) {
        primaryAmount = parseXmlNumber(getTagText(infNFe, 'vNF'));
    }

    // Cobrança / Vencimento (<cobr><dup>)
    let extractedDueDate: string | null = null;
    const cobrList = getTagElements(infNFe, 'cobr');
    if (cobrList.length > 0) {
        const dupList = getTagElements(cobrList[0], 'dup');
        if (dupList.length > 0) {
            const rawVenc = getTagText(dupList[0], 'dVenc');
            extractedDueDate = normalizeXmlDate(rawVenc);
        }
    }

    // Itens / Produtos (<det>)
    const detList = getTagElements(infNFe, 'det');
    const items: ExtractedDocItem[] = [];
    for (const det of detList) {
        const prodList = getTagElements(det, 'prod');
        const prod = prodList.length > 0 ? prodList[0] : det;
        const name = getTagText(prod, 'xProd');
        if (name) {
            const quantity = parseXmlNumber(getTagText(prod, 'qCom')) ?? undefined;
            const unitPrice = parseXmlNumber(getTagText(prod, 'vUnCom')) ?? undefined;
            const totalPrice = parseXmlNumber(getTagText(prod, 'vProd')) ?? undefined;
            items.push({
                name,
                quantity,
                unitPrice,
                totalPrice
            });
        }
    }

    // Resumo dos valores detectados
    const allDetectedAmounts: number[] = [];
    if (primaryAmount !== null && primaryAmount > 0) {
        allDetectedAmounts.push(primaryAmount);
    }
    for (const item of items) {
        if (item.totalPrice && !allDetectedAmounts.includes(item.totalPrice)) {
            allDetectedAmounts.push(item.totalPrice);
        }
    }

    const docTypeLabel = serie ? `Nota Fiscal Eletrônica (Série ${serie})` : 'Nota Fiscal Eletrônica';

    return {
        documentType: 'nota_fiscal',
        documentTypeLabel: docTypeLabel,
        extractedAmount: primaryAmount,
        allDetectedAmounts,
        extractedDate,
        extractedDueDate,
        extractedRecipient: recipientName,
        extractedRecipientCnpjCpf,
        extractedPayer: payerName,
        extractedPayerCnpjCpf,
        documentNumber: documentNumber || null,
        accessKey: accessKey || null,
        barcodeOrAuth: accessKey || null,
        items,
        rawText: rawText.slice(0, 3000),
        confidenceScore: 98,
        confidenceLevel: 'high'
    };
}

/**
 * Parser determinístico para NFS-e (Nota Fiscal de Serviços - Padrões ABRASF / Paulistana / Nacional)
 */
function parseNfseXml(xmlDoc: Document, rawText: string): ExtractedExpenseDoc | null {
    // Verifica se possui indicativos de NFS-e
    const isNfse = 
        getTagElements(xmlDoc, 'CompNfse').length > 0 ||
        getTagElements(xmlDoc, 'Nfse').length > 0 ||
        getTagElements(xmlDoc, 'InfNfse').length > 0 ||
        getTagElements(xmlDoc, 'tcCompNfse').length > 0 ||
        getTagElements(xmlDoc, 'ConsultarNfseResposta').length > 0;

    if (!isNfse) {
        return null;
    }

    // Número da NFS-e
    const documentNumber = getTagText(xmlDoc, 'Numero') || getTagText(xmlDoc, 'nNFSe') || getTagText(xmlDoc, 'nNFS');
    const authCode = getTagText(xmlDoc, 'CodigoVerificacao') || getTagText(xmlDoc, 'CodVerificacao');
    const rawDate = getTagText(xmlDoc, 'DataEmissao') || getTagText(xmlDoc, 'dhEmi') || getTagText(xmlDoc, 'Competencia');
    const extractedDate = normalizeXmlDate(rawDate);

    // Prestador / Fornecedor
    const prestadorList = 
        getTagElements(xmlDoc, 'PrestadorServico').length > 0 
            ? getTagElements(xmlDoc, 'PrestadorServico')
            : getTagElements(xmlDoc, 'Prestador');
    const prestador = prestadorList.length > 0 ? prestadorList[0] : xmlDoc;

    const recipientName = 
        getTagText(prestador, 'RazaoSocial') || 
        getTagText(prestador, 'NomeFantasia') || 
        getTagText(prestador, 'xNome');

    const rawRecipientCnpj = 
        getTagText(prestador, 'Cnpj') || 
        getTagText(prestador, 'CNPJ') || 
        getTagText(prestador, 'Cpf') || 
        getTagText(prestador, 'CPF');
    const extractedRecipientCnpjCpf = formatCnpjCpf(rawRecipientCnpj);

    // Tomador
    const tomadorList = 
        getTagElements(xmlDoc, 'TomadorServico').length > 0 
            ? getTagElements(xmlDoc, 'TomadorServico')
            : getTagElements(xmlDoc, 'Tomador');
    const tomador = tomadorList.length > 0 ? tomadorList[0] : null;

    const payerName = tomador ? (getTagText(tomador, 'RazaoSocial') || getTagText(tomador, 'xNome')) : null;
    const rawPayerCnpj = tomador ? (getTagText(tomador, 'Cnpj') || getTagText(tomador, 'CNPJ') || getTagText(tomador, 'Cpf')) : null;
    const extractedPayerCnpjCpf = formatCnpjCpf(rawPayerCnpj);

    // Valores
    const primaryAmount = 
        parseXmlNumber(getTagText(xmlDoc, 'ValorServicos')) ||
        parseXmlNumber(getTagText(xmlDoc, 'ValorLiquidoNfse')) ||
        parseXmlNumber(getTagText(xmlDoc, 'vServ')) ||
        parseXmlNumber(getTagText(xmlDoc, 'vNF'));

    // Discriminação dos Serviços (Item)
    const items: ExtractedDocItem[] = [];
    const discriminacao = 
        getTagText(xmlDoc, 'Discriminacao') || 
        getTagText(xmlDoc, 'DiscriminacaoServicos') || 
        getTagText(xmlDoc, 'xServ');

    if (discriminacao) {
        items.push({
            name: discriminacao.slice(0, 300).replace(/\s+/g, ' ').trim(),
            totalPrice: primaryAmount ?? undefined
        });
    }

    const allDetectedAmounts: number[] = [];
    if (primaryAmount !== null && primaryAmount > 0) {
        allDetectedAmounts.push(primaryAmount);
    }

    return {
        documentType: 'nota_fiscal',
        documentTypeLabel: 'Nota Fiscal de Serviço (NFS-e)',
        extractedAmount: primaryAmount,
        allDetectedAmounts,
        extractedDate,
        extractedDueDate: null,
        extractedRecipient: recipientName,
        extractedRecipientCnpjCpf,
        extractedPayer: payerName,
        extractedPayerCnpjCpf,
        documentNumber: documentNumber || null,
        accessKey: null,
        barcodeOrAuth: authCode || null,
        items,
        rawText: rawText.slice(0, 3000),
        confidenceScore: 98,
        confidenceLevel: 'high'
    };
}

/**
 * Analisador principal de XML: interpreta NF-e/NFC-e ou NFS-e via DOMParser nativo.
 * Se o conteúdo não for XML válido de nota fiscal, retorna null para fallback seguro.
 */
export function parseInvoiceXml(xmlString: string): ExtractedExpenseDoc | null {
    if (!xmlString || typeof xmlString !== 'string') return null;
    if (!isXmlContent(xmlString)) return null;

    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
        return null;
    }

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        // Verifica erro de parse nativo do DOMParser
        const parseErrors = xmlDoc.getElementsByTagName('parsererror');
        if (parseErrors && parseErrors.length > 0) {
            console.warn('[nfeXmlParser] XML com erro de sintaxe estrutural.');
            return null;
        }

        // 1. Tentar parser de NF-e / NFC-e (SEFAZ Mercadorias)
        const sefazDoc = parseSefazNfe(xmlDoc, xmlString);
        if (sefazDoc) {
            return sefazDoc;
        }

        // 2. Tentar parser de NFS-e (Serviços ABRASF / Municipal)
        const nfseDoc = parseNfseXml(xmlDoc, xmlString);
        if (nfseDoc) {
            return nfseDoc;
        }

        return null;
    } catch (err) {
        console.error('[nfeXmlParser] Falha inesperada ao processar XML de nota fiscal:', err);
        return null;
    }
}
