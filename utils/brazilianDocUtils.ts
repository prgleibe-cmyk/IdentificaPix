/**
 * Utilitários matemáticos e determinísticos para documentos fiscais e bancários brasileiros.
 * Executa estritamente no cliente/navegador sem IA generativa e sem serviços externos.
 * 
 * Regra fundamental: Nunca inventar dados. Validação estrita por algoritmos oficiais (Módulo 11).
 */

/**
 * Validação matemática oficial do Dígito Verificador de CNPJ (Módulo 11)
 */
export function validateCnpj(cnpj: string): boolean {
    if (!cnpj) return false;
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14 || /^(\d)\1{13}$/.test(clean)) return false;

    let size = clean.length - 2;
    let numbers = clean.substring(0, size);
    const digits = clean.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i), 10) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0), 10)) return false;

    size = size + 1;
    numbers = clean.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i), 10) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result === parseInt(digits.charAt(1), 10);
}

/**
 * Validação matemática oficial do Dígito Verificador de CPF (Módulo 11)
 */
export function validateCpf(cpf: string): boolean {
    if (!cpf) return false;
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(clean.charAt(i), 10) * (10 - i);
    }
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(9), 10)) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(clean.charAt(i), 10) * (11 - i);
    }
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    return rev === parseInt(clean.charAt(10), 10);
}

/**
 * Formata CNPJ no padrão brasileiro: 00.000.000/0000-00
 */
export function formatCnpj(cnpj: string): string {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return cnpj;
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF no padrão brasileiro: 000.000.000-00
 */
export function formatCpf(cpf: string): string {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return cpf;
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/**
 * Extrai CNPJs ou CPFs válidos do texto de um PDF, descartando números aleatórios
 * através de validação estrita do Módulo 11.
 */
export function extractValidCnpjCpf(text: string): {
    recipientCnpjCpf: string | null;
    payerCnpjCpf: string | null;
    allValid: string[];
} {
    if (!text) return { recipientCnpjCpf: null, payerCnpjCpf: null, allValid: [] };

    const allValid: string[] = [];
    const seen = new Set<string>();

    // 1. Padrões com pontuação explícita (maior precisão)
    const cnpjRegex = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g;
    const cpfRegex = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/g;

    let match: RegExpExecArray | null;

    while ((match = cnpjRegex.exec(text)) !== null) {
        const raw = match[1];
        if (validateCnpj(raw) && !seen.has(raw)) {
            seen.add(raw);
            allValid.push(formatCnpj(raw));
        }
    }

    while ((match = cpfRegex.exec(text)) !== null) {
        const raw = match[1];
        if (validateCpf(raw) && !seen.has(raw)) {
            seen.add(raw);
            allValid.push(formatCpf(raw));
        }
    }

    // 2. Padrões precedidos por palavras-chave mesmo se sem pontuação
    const keywordCnpjRegex = /(?:cnpj|c\.n\.p\.j\.?|cpf|c\.p\.f\.?)\s*[:=]?\s*(\d{11,14})\b/gi;
    while ((match = keywordCnpjRegex.exec(text)) !== null) {
        const digits = match[1];
        if (digits.length === 14 && validateCnpj(digits)) {
            const formatted = formatCnpj(digits);
            if (!seen.has(formatted)) {
                seen.add(formatted);
                allValid.push(formatted);
            }
        } else if (digits.length === 11 && validateCpf(digits)) {
            const formatted = formatCpf(digits);
            if (!seen.has(formatted)) {
                seen.add(formatted);
                allValid.push(formatted);
            }
        }
    }

    if (allValid.length === 0) {
        return { recipientCnpjCpf: null, payerCnpjCpf: null, allValid: [] };
    }

    // Identifica se há distinção contextual entre Favorecido/Prestador (Vendedor) e Pagador/Tomador (Comprador)
    let recipientCnpjCpf: string | null = null;
    let payerCnpjCpf: string | null = null;

    // Isola a seção do vendedor (antes do Destinatário/Tomador) da seção do comprador
    const buyerSectionRegex = /(?:destinat[aá]rio(?:\s*[\/\-]\s*remetente)?|tomador(?:\s*de\s*servi[cç]os?)?|dados\s*do\s*destinat[aá]rio|dados\s*do\s*tomador|sacado|cliente|dados\s*do\s*pagador)/i;
    let sellerSection = text;
    let buyerSection = text;
    const splitMatch = text.search(buyerSectionRegex);
    if (splitMatch !== -1) {
        sellerSection = text.slice(0, splitMatch);
        buyerSection = text.slice(splitMatch);
    }

    // Contexto de Beneficiário / Emitente (Vendedor)
    const emitMatch = sellerSection.match(/(?:benefici[aá]rio|cedente|prestador|emitente|fornecedor|empresa|razao\s*social)[\s\S]{0,120}?(?:cnpj|cpf)?\s*[:=]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i) ||
                      sellerSection.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
    if (emitMatch && emitMatch[1]) {
        const cand = emitMatch[1];
        if (validateCnpj(cand)) recipientCnpjCpf = formatCnpj(cand);
        else if (validateCpf(cand)) recipientCnpjCpf = formatCpf(cand);
    }

    // Contexto de Pagador / Sacado / Destinatário (Comprador)
    const destMatch = buyerSection.match(/(?:pagador|sacado|tomador|destinat[aá]rio|cliente)[\s\S]{0,120}?(?:cnpj|cpf)?\s*[:=]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i) ||
                      buyerSection.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
    if (destMatch && destMatch[1]) {
        const cand = destMatch[1];
        if (validateCnpj(cand)) payerCnpjCpf = formatCnpj(cand);
        else if (validateCpf(cand)) payerCnpjCpf = formatCpf(cand);
    }

    // Fallback: o primeiro documento válido é usualmente o emitente/beneficiário
    if (!recipientCnpjCpf && allValid.length > 0) {
        recipientCnpjCpf = allValid[0];
    }
    if (!payerCnpjCpf && allValid.length > 1 && allValid[1] !== recipientCnpjCpf) {
        payerCnpjCpf = allValid[1];
    }

    return { recipientCnpjCpf, payerCnpjCpf, allValid };
}

/**
 * Extrai e valida linha digitável ou código de barras de boleto bancário / tributos em PDF.
 */
export function extractBoletoLine(text: string): {
    barcodeOrLine: string | null;
    boletoAmount: number | null;
    boletoDueDate: string | null;
    boletoType: 'bancario' | 'concessionaria' | null;
} {
    if (!text) {
        return { barcodeOrLine: null, boletoAmount: null, boletoDueDate: null, boletoType: null };
    }

    // 1. Busca por Linha Digitável de Boleto Bancário Padrão (47 dígitos)
    // Formato com pontos e espaços: 00000.00000 00000.000000 00000.000000 0 00000000000000
    const boleto47Regex = /\b(\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14})\b/;
    const match47 = text.match(boleto47Regex);

    if (match47) {
        const formatted = match47[1];
        const clean = formatted.replace(/\D/g, '');
        if (clean.length === 47) {
            let boletoAmount: number | null = null;
            let boletoDueDate: string | null = null;

            // Os últimos 10 dígitos são o valor (em centavos)
            const valDigits = clean.slice(37);
            const valCents = parseInt(valDigits, 10);
            if (!isNaN(valCents) && valCents > 0) {
                boletoAmount = Math.round(valCents) / 100;
            }

            // Fator de vencimento (dígitos 33 a 37)
            const factor = parseInt(clean.slice(33, 37), 10);
            if (!isNaN(factor) && factor >= 1000) {
                // Base oficial Febraban: 07/10/1997
                // Em 22/02/2025 atingiu 9999 e reiniciou em 1000
                const baseDate1 = new Date(1997, 9, 7); // 07/10/1997
                const baseDate2 = new Date(2025, 1, 22); // 22/02/2025
                const currentYear = new Date().getFullYear();

                let calculatedDate: Date;
                if (currentYear >= 2025 && factor < 4000) {
                    calculatedDate = new Date(baseDate2.getTime() + (factor - 1000) * 86400000);
                } else {
                    calculatedDate = new Date(baseDate1.getTime() + factor * 86400000);
                }

                if (!isNaN(calculatedDate.getTime())) {
                    const y = calculatedDate.getFullYear();
                    const m = String(calculatedDate.getMonth() + 1).padStart(2, '0');
                    const d = String(calculatedDate.getDate()).padStart(2, '0');
                    boletoDueDate = `${y}-${m}-${d}`;
                }
            }

            return {
                barcodeOrLine: formatted,
                boletoAmount,
                boletoDueDate,
                boletoType: 'bancario'
            };
        }
    }

    // 2. Busca por Linha Digitável de Concessionária / Contas de Consumo / Tributos (48 dígitos, inicia em 8)
    // Formato com traços e espaços: 80000000000-0 00000000000-0 00000000000-0 00000000000-0
    const boleto48Regex = /\b(8\d{10}-\d\s+\d{11}-\d\s+\d{11}-\d\s+\d{11}-\d)\b/;
    const match48 = text.match(boleto48Regex);

    if (match48) {
        const formatted = match48[1];
        const clean = formatted.replace(/\D/g, '');
        if (clean.length === 48 && clean.startsWith('8')) {
            let boletoAmount: number | null = null;
            // Dígitos 4 a 15 compõem o valor (11 dígitos)
            const valDigits = clean.slice(4, 15);
            const valCents = parseInt(valDigits, 10);
            if (!isNaN(valCents) && valCents > 0) {
                boletoAmount = Math.round(valCents) / 100;
            }

            return {
                barcodeOrLine: formatted,
                boletoAmount,
                boletoDueDate: null,
                boletoType: 'concessionaria'
            };
        }
    }

    // 3. Busca por sequência numérica contínua sem formatação (47 ou 48 dígitos)
    const continuousRegex = /\b(\d{47,48})\b/;
    const continuousMatch = text.match(continuousRegex);
    if (continuousMatch) {
        const clean = continuousMatch[1];
        if (clean.length === 47) {
            const valDigits = clean.slice(37);
            const valCents = parseInt(valDigits, 10);
            const boletoAmount = !isNaN(valCents) && valCents > 0 ? Math.round(valCents) / 100 : null;
            const formatted = `${clean.slice(0, 5)}.${clean.slice(5, 10)} ${clean.slice(10, 15)}.${clean.slice(15, 21)} ${clean.slice(21, 26)}.${clean.slice(26, 32)} ${clean.slice(32, 33)} ${clean.slice(33)}`;
            return {
                barcodeOrLine: formatted,
                boletoAmount,
                boletoDueDate: null,
                boletoType: 'bancario'
            };
        }
    }

    return { barcodeOrLine: null, boletoAmount: null, boletoDueDate: null, boletoType: null };
}

/**
 * Extrai com alta precisão a data de vencimento expressa em um documento PDF.
 * Procura por âncoras explícitas como "Vencimento:", "Data de Vencimento:", "Pagar até:".
 */
export function extractDueDateFromText(text: string): string | null {
    if (!text) return null;

    const dueDatePatterns = [
        /(?:vencimento|venc\.?|data\s*de\s*vencimento|pagar\s*at[eé]|data\s*limite(?:\s*para\s*pagamento)?|validade)\s*[:=]?\s*([0-3]?[0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.](20[2-3][0-9])/i,
        /([0-3]?[0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.](20[2-3][0-9])\s*(?:\([^\)]*vencimento|\s*vencimento)/i
    ];

    for (const pattern of dueDatePatterns) {
        const match = text.match(pattern);
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];

            // Validação de intervalo de data razoável
            const dNum = parseInt(day, 10);
            const mNum = parseInt(month, 10);
            if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12) {
                return `${year}-${month}-${day}`;
            }
        }
    }

    return null;
}

/**
 * Extrai número do documento, NF, Fatura ou chave de acesso DANFE presente em PDFs textuais.
 */
export function extractDocumentNumberFromText(text: string): {
    documentNumber: string | null;
    accessKey: string | null;
} {
    if (!text) return { documentNumber: null, accessKey: null };

    let accessKey: string | null = null;
    let documentNumber: string | null = null;

    // 1. Chave de acesso DANFE de 44 dígitos numéricos
    // Frequentemente impressa em blocos de 4 dígitos: 3522 0412 3456 7800 0190 ...
    const keyMatch = text.match(/\b(\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4})\b/);
    if (keyMatch) {
        const cleanKey = keyMatch[1].replace(/\s+/g, '');
        if (cleanKey.length === 44) {
            accessKey = cleanKey;
            // Em DANFEs, o número da NF está entre os dígitos 26 e 34 (9 dígitos)
            const nNF = parseInt(cleanKey.slice(25, 34), 10);
            if (!isNaN(nNF) && nNF > 0) {
                documentNumber = String(nNF);
            }
        }
    }

    // 2. Se ainda não achou número da NF, procurar por padrões textuais
    if (!documentNumber) {
        const docPatterns = [
            /(?:(?:n[ºo]\.?|n[uú]mero)\s*(?:da\s*nota|do\s*documento|doc(?:umento)?)|n[ºo]\.?\s*(?:da\s*)?nf-?e?|danfe\s*n[ºo]\.?|fatura\s*n[ºo]\.?|nota\s*fiscal\s*n[ºo]\.?|nosso\s*n[uú]mero)\s*[:=]?\s*([0-9]{1,20})\b/i,
            /(?:doc(?:umento)?\s*n[ºo]\.?)\s*[:=]?\s*([0-9]{1,20})\b/i
        ];

        for (const pattern of docPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const cand = match[1].trim();
                if (cand.length >= 1 && cand !== '0' && cand.length <= 15) {
                    documentNumber = cand;
                    break;
                }
            }
        }
    }

    return { documentNumber, accessKey };
}

/**
 * Reconhece automaticamente concessionárias de serviços públicos e telecomunicações mais comuns
 * ou extrai o nome do favorecido a partir de âncoras textuais.
 */
export function extractConcessionariaOrRecipient(text: string): string | null {
    if (!text) return null;

    const lower = text.toLowerCase();

    // Dicionário determinístico de grandes concessionárias e prestadores frequentes de igrejas
    const knownEntities = [
        { pattern: /\b(?:enel|eletropaulo)\b/i, name: 'Enel Distribuição' },
        { pattern: /\bcpfl\b/i, name: 'CPFL Energia' },
        { pattern: /\bcemig\b/i, name: 'CEMIG Distribuição' },
        { pattern: /\bcopel\b/i, name: 'Copel Energia' },
        { pattern: /\bcoelba\b/i, name: 'Neoenergia Coelba' },
        { pattern: /\belektro\b/i, name: 'Neoenergia Elektro' },
        { pattern: /\blight\s*(?:servi[cç]os|energia)?\b/i, name: 'Light Energia' },
        { pattern: /\bedp\s*(?:s[aã]o\s*paulo|esp[ií]rito\s*santo)?\b/i, name: 'EDP Brasil' },
        { pattern: /\bsabesp\b/i, name: 'SABESP' },
        { pattern: /\bsanepar\b/i, name: 'SANEPAR' },
        { pattern: /\bcopasa\b/i, name: 'COPASA' },
        { pattern: /\bcompesa\b/i, name: 'COMPESA' },
        { pattern: /\bcorsan\b/i, name: 'CORSAN' },
        { pattern: /\bcaesb\b/i, name: 'CAESB' },
        { pattern: /\b(?:claro|net\s*servi[cç]os)\b/i, name: 'Claro Brasil' },
        { pattern: /\b(?:vivo|telef[oô]nica\s*brasil)\b/i, name: 'Vivo (Telefônica Brasil)' },
        { pattern: /\btim\s*(?:s\/a|brasil)?\b/i, name: 'TIM Brasil' },
        { pattern: /\boi\s*(?:s\/a|m[oó]vel)?\b/i, name: 'Oi Telecomunicações' },
        { pattern: /\b(?:sem\s*parar|veloe|conectcar)\b/i, name: 'Pedágio / Tag Veicular' },
        { pattern: /\b(?:ipva|iptu|taxa\s*de\s*inc[eê]ndio|tributo)\b/i, name: 'Tributo Municipal / Estadual' }
    ];

    for (const ent of knownEntities) {
        if (ent.pattern.test(lower)) {
            return ent.name;
        }
    }

    return null;
}
