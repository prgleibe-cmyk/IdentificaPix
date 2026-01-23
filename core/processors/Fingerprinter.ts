
import { CanonicalDocumentNormalizer } from './CanonicalDocumentNormalizer';

/**
 * SERVIÇO DE DOMÍNIO: FINGERPRINTER (V6 - DNA BLINDADO)
 * --------------------------------------------------------------------------
 * Gera a identidade estrutural definitiva. Uma vez salvo, este DNA é a lei.
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
        const candidates = [';', ',', '\t', '|'];
        const counts = candidates.map(char => ({ 
            char, 
            count: line.split(char).length - 1 
        }));
        counts.sort((a, b) => b.count - a.count);
        return counts[0].count > 0 ? counts[0].char : ';';
    },

    /**
     * Gera o DNA estrutural blindado. 
     * Remove ruídos agressivamente para garantir que "Layout igual" = "Hash igual".
     */
    generate: (content: string): StructuralFingerprint | null => {
        if (!content || typeof content !== 'string') return null;
        
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return null;

        const firstLine = lines[0];
        const delimiter = Fingerprinter.detectDelimiter(firstLine);
        const cells = firstLine.split(delimiter);
        
        // 🛡️ NORMALIZAÇÃO CIRÚRGICA: 
        // Remove tudo que não for Alfanumérico puro. 
        // Isso impede que variações de delimitadores ou espaços quebrem o reconhecimento.
        const cleanHeader = firstLine
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') 
            .replace(/[^A-Z0-9]/gi, '') 
            .toUpperCase();

        let hash = 5381;
        for (let i = 0; i < cleanHeader.length; i++) {
            hash = ((hash << 5) + hash) + cleanHeader.charCodeAt(i);
        }
        const headerHash = Math.abs(hash).toString(36);

        const structuralPattern = CanonicalDocumentNormalizer.generateStructuralPattern(lines);

        return { 
            columnCount: cells.length, 
            delimiter, 
            headerHash, 
            dataTopology: 'FIXED_CONTRACT', // Força a topologia ao contrato salvo
            structuralPattern
        };
    }
};
