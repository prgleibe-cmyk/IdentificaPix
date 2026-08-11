
import { Transaction, FileModel } from '../types';
import { StrategyEngine, StrategyResult } from '../core/strategies';
import { Fingerprinter } from '../core/processors/Fingerprinter';
import { OFXParser } from '../core/parsers/OFXParser';
import { SicoobParser } from '../core/parsers/SicoobParser';
import { NameResolver } from '../core/processors/NameResolver';
import { resolveBankKey } from '../utils/bankHelper';

export * from './utils/parsingUtils';
export * from './logic/matchingLogic';
export * from './logic/filteringLogic';

export const generateFingerprint = Fingerprinter.generate;

export function cleanBankDescription(rawDescription: string): string {
    if (!rawDescription) return 'Lançamento Bancário';

    let cleaned = NameResolver.clean(rawDescription);

    // List of generic operational prefixes and terms to strip out
    const genericPatterns = [
        /RECEBIMENTO PIX-PIX_CRED/gi,
        /PAGAMENTO PIX-PIX_DEB/gi,
        /PIX RECEBIDO - OUTRA IF/gi,
        /PIX RECEBIDO OUTRA IF/gi,
        /PIX RECEB\.OUTRA IF/gi,
        /PIX EMIT\.OUTRA IF/gi,
        /PIX ENVIADO - OUTRA IF/gi,
        /PIX ENVIADO OUTRA IF/gi,
        /RECEBIMENTO PIX -/gi,
        /RECEBIMENTO PIX/gi,
        /RECEBIMENTO DE PIX/gi,
        /PAGAMENTO PIX -/gi,
        /PAGAMENTO PIX/gi,
        /PAGAMENTO DE PIX/gi,
        /PIX RECEBIDO -/gi,
        /PIX RECEBIDO/gi,
        /PIX ENVIADO -/gi,
        /PIX ENVIADO/gi,
        /CREDITO DE PIX/gi,
        /CRÉDITO DE PIX/gi,
        /DEBITO DE PIX/gi,
        /DÉBITO DE PIX/gi,
        /PIX_CRED/gi,
        /PIX_DEB/gi,
        /TRANSFERENCIA RECEBIDA/gi,
        /TRANSFERÊNCIA RECEBIDA/gi,
        /TRANSFERENCIA ENVIADA/gi,
        /TRANSFERÊNCIA ENVIADA/gi,
        /CR COMPRAS CRE OUTRAS BANDEIRAS/gi,
        /CR COMPRAS MASTERCARD/gi,
        /CR COMPRAS VISA/gi,
        /CR COMPRAS ELO/gi,
        /CR COMPRAS/gi,
        /COMPRAS CRE OUTRAS BANDEIRAS/gi,
        /COMPRAS MASTERCARD/gi,
        /COMPRAS VISA/gi,
        /COMPRAS ELO/gi,
        /DÉB\.TIT\.COMPE\.EFETI/gi,
        /DEB\.TIT\.COMPE\.EFETI/gi,
        /TAR MANUTENCAO/gi,
        /TARIFA EXTRATO/gi,
        /TARIFA BANCARIA/gi,
        /TAR BANCARIA/gi,
        /RSHOP-/gi,
        /SAQUE BANCO 24HORAS/gi,
        /SAQUE SICOOB/gi,
        /INT TRANSF/gi,
        /TRANSF TEF/gi,
        /DOC ELETRONICO/gi,
        /TED ELETRONICA/gi
    ];

    let tempDesc = cleaned;
    for (const pattern of genericPatterns) {
        tempDesc = tempDesc.replace(pattern, '');
    }

    // Clean up residual dashes, colons, spaces
    tempDesc = tempDesc.replace(/^[\s\-:]+/, '').replace(/[\s\-:]+$/, '').trim();

    // If there is still a meaningful description left (e.g., person's name or establishment), return it!
    if (tempDesc.length >= 2) {
        return tempDesc;
    }

    // Otherwise, if the original text was pure generic bank noise, map it to a clean human-readable title
    const upperRaw = cleaned.toUpperCase();

    if (upperRaw.includes('MASTERCARD')) return 'Compra Cartão Mastercard';
    if (upperRaw.includes('VISA')) return 'Compra Cartão Visa';
    if (upperRaw.includes('OUTRAS BANDEIRAS') || upperRaw.includes('CR COMPRAS') || upperRaw.includes('COMPRAS')) return 'Compra Cartão de Crédito';
    if (upperRaw.includes('PIX') && (upperRaw.includes('RECEB') || upperRaw.includes('CRED'))) return 'PIX Recebido';
    if (upperRaw.includes('PIX') && (upperRaw.includes('ENV') || upperRaw.includes('EMIT') || upperRaw.includes('PAG') || upperRaw.includes('DEB'))) return 'PIX Enviado';
    if (upperRaw.includes('PIX')) return 'Transferência PIX';
    if (upperRaw.includes('TARIFA') || upperRaw.includes('TAR ')) return 'Tarifa Bancária';
    if (upperRaw.includes('TRANSFER') || upperRaw.includes('TED') || upperRaw.includes('DOC')) return 'Transferência Bancária';

    return 'Lançamento Bancário';
}

/**
 * Normaliza o conteúdo original preservando-o conforme o Rigor V19.
 */
export function normalizeRawContent(content: string): string {
    if (!content) return "";
    
    // RIGOR V19: Proibido alterar o input bruto. 
    // O conteúdo deve chegar ao StrategyEngine exatamente como foi lido do arquivo.
    if (content === '[DOCUMENTO_PDF_VISUAL]') {
        console.log(`[PDF:PHASE:3:NORMALIZATION] ${content} -> ${content} (Preservação Literal)`);
    }
    return content;
}

/**
 * 🛠️ ADAPTER ESTRUTURAL (V4 - ABSOLUTE TRUTH)
 */
function normalizeIngestionInput(input: any) {
    if (Array.isArray(input)) return input;
    if (typeof input === 'string') {
        return {
            __rawText: input,
            __source: 'file'
        };
    }
    return input;
}

export const findMatchingModel = (content: string, models: FileModel[], fileName: string = ''): { model: FileModel, score: number } | null => {
    if (!models || models.length === 0) return null;
    const fileFp = Fingerprinter.generate(content);
    if (!fileFp) return null;
    
    // Identifica se é um placeholder de PDF
    const isPdfPlaceholder = content.includes('[DOCUMENTO_PDF_VISUAL]');
    
    if (isPdfPlaceholder) {
        // Busca todos os modelos que batem com o DNA de PDF
        const candidates = models.filter(m => m.is_active && m.fingerprint.headerHash === fileFp.headerHash);
        
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return { model: candidates[0], score: 100 };

        // DESEMPATE INTELIGENTE: Se houver mais de um modelo de PDF, 
        // verifica qual nome de modelo está contido no nome do arquivo enviado.
        const fileKey = fileName.toLowerCase();
        const bestMatch = candidates.find(m => {
            const modelKey = m.name.toLowerCase().replace('.pdf', '').split('.')[0];
            return fileKey.includes(modelKey);
        }) || candidates[0];

        console.log(`[PDF:MATCHER] Ambiguidade resolvida para ${fileName} -> Aplicando: ${bestMatch.name}`);
        return { model: bestMatch, score: 100 };
    }
    
    // RIGOR ABSOLUTO para outros formatos (CSV/XLSX)
    const bestMatch = models.find(m => m.is_active && m.fingerprint.headerHash === fileFp.headerHash);
    return bestMatch ? { model: bestMatch, score: 100 } : null;
};

/**
 * PROCESSADOR DE PIPELINE (V17 - ABSOLUTE TRUTH ENFORCED)
 */
export const processFileContent = async (
    content: string, 
    fileName: string, 
    models: FileModel[] = [], 
    base64?: string,
    bank?: any
): Promise<StrategyResult & { appliedModel?: any }> => {
    
    const rawContent = normalizeRawContent(content);

    // Exclusividade de arquivo .OFX
    const isOfxFile = fileName.toLowerCase().endsWith('.ofx') || content.includes('<OFX') || content.includes('<STMTTRN>');
    
    if (!isOfxFile) {
        throw new Error("O IdentificaPix aceita exclusivamente extratos bancários no formato OFX (.ofx). Por gentileza, exporte e envie o extrato no formato OFX do seu banco.");
    }

    const parser = new OFXParser();
    const doc = {
        sourceName: fileName,
        fileType: 'OFX' as any,
        content: rawContent,
        timestamp: new Date().toISOString(),
        metadata: {
            size: rawContent.length,
            encoding: 'utf-8'
        }
    };
    const drafts = parser.parse(doc);
    
    const isSicredi = bank && resolveBankKey(bank) === 'SICREDI';
    const isSicoob = bank && resolveBankKey(bank) === 'SICOOB';
    
    // Conversor/Adaptador de TransactionDraft[] em Transaction[]
    const transactions: Transaction[] = drafts.map((draft, index) => {
        const rawAmt = draft.rawAmount || '0';
        const numAmount = parseFloat(rawAmt.replace(',', '.'));
        
        // Format OFX date (YYYYMMDD to YYYY-MM-DD) if format is standard
        let finalDate = draft.rawDate;
        if (finalDate && finalDate.length >= 8 && /^\d+$/.test(finalDate.substring(0, 8))) {
            const yyyy = finalDate.substring(0, 4);
            const mm = finalDate.substring(4, 6);
            const dd = finalDate.substring(6, 8);
            finalDate = `${yyyy}-${mm}-${dd}`;
        }
        
        let cleanedDesc = cleanBankDescription(draft.rawDescription);
        
        let inferredMethod = 'OUTROS';
        const upperRaw = (draft.rawDescription || '').toUpperCase();
        if (upperRaw.includes('PIX')) {
            inferredMethod = 'PIX';
        } else if (upperRaw.includes('MASTERCARD') || upperRaw.includes('VISA') || upperRaw.includes('CARTAO') || upperRaw.includes('CARTÃO') || upperRaw.includes('COMPRAS')) {
            inferredMethod = 'CARTÃO';
        } else if (upperRaw.includes('TED')) {
            inferredMethod = 'TED';
        } else if (upperRaw.includes('DOC')) {
            inferredMethod = 'DOC';
        } else if (upperRaw.includes('BOLETO')) {
            inferredMethod = 'BOLETO';
        } else if (upperRaw.includes('TRANSFER')) {
            inferredMethod = 'TRANSFERÊNCIA';
        }
        
        return {
            id: `ofx-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`,
            date: finalDate,
            description: cleanedDesc,
            rawDescription: draft.rawDescription,
            amount: numAmount,
            originalAmount: rawAmt,
            cleanedDescription: cleanedDesc,
            contributionType: numAmount >= 0 ? 'ENTRADA' : 'SAÍDA',
            paymentMethod: inferredMethod
        };
    });

    console.log(`[OFX:AUDIT] Parsed transactions count: ${transactions.length} (${fileName})`);

    return {
        transactions,
        strategyName: 'OFX Parser Direto',
        appliedModel: undefined
    };
};

export const parseContributors = (content: string, typeKeywords: string[] = []): any[] => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const delimiter = Fingerprinter.detectDelimiter(lines[0]);
    const rows = lines.map(l => l.split(delimiter));
    
    const isPureNumeric = (val: string) => {
        if (!val) return true;
        const cleaned = val.trim().replace(/^R\$\s*/i, '').replace(/\./g, '').replace(',', '.');
        return !isNaN(parseFloat(cleaned)) && /^[\d.,R$\s\-()]+$/.test(val.trim());
    };

    const contributors = rows.slice(1).map(row => {
        const rawName = (row[0] || '').trim();
        return {
            name: isPureNumeric(rawName) ? 'Desconhecido' : rawName,
            amount: parseFloat(String(row[1] || '0').replace(/[R$\s]/g, '').replace(',', '.')) || 0,
            date: row[2] || ''
        };
    }).filter(c => c.name && c.name !== 'Desconhecido');

    return contributors;
};
