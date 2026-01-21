
import { CanonicalDocumentNormalizer } from './CanonicalDocumentNormalizer';

/**
 * SERVIÇO DE DOMÍNIO: FINGERPRINTER (V5 - ESTABILIDADE DE DNA)
 * --------------------------------------------------------------------------
 * Gera a identidade estrutural (DNA) de qualquer conteúdo tabular.
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
    /**
     * Detecta o delimitador de forma estatística.
     */
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
     * Gera o DNA estrutural para reconhecimento independente de formato.
     */
    generate: (content: string): StructuralFingerprint | null => {
        if (!content || typeof content !== 'string') return null;
        
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return null;

        const firstLine = lines[0];
        const delimiter = Fingerprinter.detectDelimiter(firstLine);
        const cells = firstLine.split(delimiter);
        
        // 🚀 DNA ESTÁVEL (V5): 
        // Removemos TODOS os espaços e caracteres especiais para gerar o Hash.
        // Isso garante que "NOME   VALOR" e "NOME;VALOR" gerem o mesmo DNA de Identidade.
        const cleanHeader = firstLine
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') 
            .replace(/[^A-Z0-9]/gi, '') // Remove espaços, pontos, vírgulas e delimitadores do Hash
            .toUpperCase();

        // Gerador de hash simples e estável
        let hash = 0;
        for (let i = 0; i < cleanHeader.length; i++) {
            const char = cleanHeader.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const headerHash = Math.abs(hash).toString(36);

        // 2. ASSINATURA CANÔNICA
        const canonicalSignature = CanonicalDocumentNormalizer.generateSignature(lines);
        const structuralPattern = CanonicalDocumentNormalizer.generateStructuralPattern(lines);

        // 3. TOPOLOGIA DE DADOS (DNA de Tipos)
        const dataRows = lines.slice(1, 10);
        const representativeRow = dataRows.find(r => r.split(delimiter).length >= 2) || firstLine;

        const topologyString = representativeRow.split(delimiter).map(c => {
            const val = c.trim().replace(/[R$\s]/g, '').replace(',', '.');
            if (/^\d{1,4}[/-]\d{1,2}/.test(val)) return 'D'; 
            if (!isNaN(parseFloat(val)) && /\d/.test(val)) return 'N';
            if (val.length === 0) return 'E';
            return 'S';
        }).join('');

        return { 
            columnCount: cells.length, 
            delimiter, 
            headerHash, 
            dataTopology: topologyString,
            canonicalSignature,
            structuralPattern
        };
    }
};
