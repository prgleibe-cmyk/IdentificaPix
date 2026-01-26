
import { CanonicalDocumentNormalizer } from './CanonicalDocumentNormalizer';

/**
 * SERVIÇO DE DOMÍNIO: FINGERPRINTER (V8 - FIDELIDADE TOTAL)
 * --------------------------------------------------------------------------
 * Gera a identidade baseada no conteúdo BRUTO. Sem normalização.
 */

export interface StructuralFingerprint {
    columnCount: number;
    delimiter: string;
    headerHash: string | null;
    dataTopology: string;
    canonicalSignature?: string;
    structuralPattern?: string;
}

export const Fingerprinter = {
    detectDelimiter: (line: string): string => {
        if (!line) return ';';
        if (line.includes(';')) return ';';
        if (line.includes('\t')) return '\t';
        if (line.includes(',')) return ',';
        if (line.includes('|')) return '|';
        return ';';
    },

    /**
     * Gera o DNA sem limpar o texto. 
     * O Hash deve ser idêntico ao que foi capturado no momento do treinamento.
     */
    generate: (content: string): StructuralFingerprint | null => {
        if (!content || typeof content !== 'string') return null;
        
        const lines = content.split(/\r?\n/).filter(l => l.length > 0);
        if (lines.length === 0) return null;

        const rawHeader = lines[0];
        const delimiter = Fingerprinter.detectDelimiter(rawHeader);
        const cells = rawHeader.split(delimiter);
        
        // 🛡️ HASH PURO (SEM LIMPEZA):
        // Usa a linha exatamente como ela é.
        let hash = 5381;
        for (let i = 0; i < rawHeader.length; i++) {
            hash = ((hash << 5) + hash) + rawHeader.charCodeAt(i);
        }
        const headerHash = Math.abs(hash).toString(36);

        const structuralPattern = CanonicalDocumentNormalizer.generateStructuralPattern(lines);

        return { 
            columnCount: cells.length, 
            delimiter, 
            headerHash, 
            dataTopology: 'FIXED_CONTRACT',
            structuralPattern
        };
    }
};
