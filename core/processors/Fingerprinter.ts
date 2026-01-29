import { CanonicalDocumentNormalizer } from './CanonicalDocumentNormalizer';

/**
 * SERVIÇO DE DOMÍNIO: FINGERPRINTER (V9 - ESTABILIZAÇÃO EXCEL)
 * --------------------------------------------------------------------------
 * Gera a identidade baseada no conteúdo, mas normaliza o header para evitar
 * falhas por colunas "fantasma" do Excel.
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
     * Gera o DNA estabilizado.
     * Remove colunas vazias à direita e normaliza espaços para garantir que
     * o mesmo arquivo Excel sempre gere o mesmo Hash.
     */
    generate: (content: string): StructuralFingerprint | null => {
        if (!content || typeof content !== 'string') return null;
        
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return null;

        const firstLine = lines[0];
        const delimiter = Fingerprinter.detectDelimiter(firstLine);
        
        // 🛡️ NORMALIZAÇÃO DE HEADER (ESSENCIAL PARA EXCEL):
        // Trim em cada célula e remove colunas vazias à direita que o Excel costuma injetar.
        const cells = firstLine.split(delimiter).map(c => c.trim());
        while (cells.length > 0 && cells[cells.length - 1] === "") {
            cells.pop();
        }
        
        const canonicalHeader = cells.join(delimiter).toUpperCase();
        
        // Gera o Hash baseado no header limpo e em caixa alta
        let hash = 5381;
        for (let i = 0; i < canonicalHeader.length; i++) {
            hash = ((hash << 5) + hash) + canonicalHeader.charCodeAt(i);
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