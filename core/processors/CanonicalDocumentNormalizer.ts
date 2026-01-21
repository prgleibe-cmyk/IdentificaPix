
import { NameResolver } from './NameResolver';

/**
 * NORMALIZADOR CANÔNICO DE DOCUMENTOS (Core v3)
 * Responsável por transformar conteúdo bruto em uma representação estrutural unificada.
 */
export class CanonicalDocumentNormalizer {

    static generateSignature(lines: string[]): string {
        if (!lines || lines.length === 0) return '';
        const canonicalHeader = this.normalizeLine(lines[0], true);
        const dataSample = lines.slice(1, 11);
        const topologySignature = dataSample.map(line => this.getTopologyPattern(line)).join('|');
        const rawSignature = `${canonicalHeader}||${topologySignature}`;
        return this.simpleHash(rawSignature);
    }

    static generateStructuralPattern(lines: string[]): string {
        if (lines.length < 2) return 'UNKNOWN';
        const sampleRows = lines.slice(0, 30); 
        const patterns: string[] = [];

        for (const line of sampleRows) {
            const delimiter = line.includes(';') ? ';' : (line.includes('\t') ? '\t' : ',');
            const cells = line.split(delimiter);
            const rowEntities: string[] = [];
            
            for (const cell of cells) {
                const type = this.getCellType(cell.trim());
                if (type === 'XX') continue; 
                rowEntities.push(type);
            }

            // Uma linha de dados válida deve ter pelo menos uma data ou um valor.
            if (rowEntities.includes('DT') || rowEntities.includes('NM')) {
                patterns.push(rowEntities.join('-'));
            }
        }

        if (patterns.length === 0) return 'UNKNOWN';
        return this.getMode(patterns);
    }

    private static getCellType(token: string): string {
        if (!token) return 'XX';
        if (/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?/.test(token) || /\d{4}-\d{2}-\d{2}/.test(token)) return 'DT';
        const cleanNum = token.replace(/[R$\s]/g, '').replace(',', '.');
        if (!isNaN(parseFloat(cleanNum)) && /\d/.test(cleanNum)) return 'NM';
        if (token.length < 2 && !/\d/.test(token)) return 'XX';
        return 'ST';
    }

    private static getMode(array: string[]): string {
        if (array.length === 0) return 'UNKNOWN';
        const modeMap: Record<string, number> = {};
        let maxEl = array[0], maxCount = 1;
        for (const el of array) {
            modeMap[el] = (modeMap[el] || 0) + 1;
            if (modeMap[el] > maxCount) {
                maxEl = el;
                maxCount = modeMap[el];
            }
        }
        return maxEl;
    }

    static normalizeLine(line: string, isHeader: boolean = false): string {
        if (!line) return '';
        let normalized = line.toUpperCase();
        normalized = NameResolver.normalize(normalized);
        normalized = normalized.replace(/[;,\t|]/g, ' ');
        normalized = normalized.replace(/[^A-Z0-9\s]/g, '');
        normalized = normalized.replace(/\s+/g, ' ').trim();
        if (isHeader) return normalized;
        return normalized.replace(/\d+/g, '#NUM');
    }

    private static getTopologyPattern(line: string): string {
        const delimiter = line.includes(';') ? ';' : (line.includes('\t') ? '\t' : ',');
        const cells = line.split(delimiter);
        return cells.map(c => this.getCellType(c.trim())).join('.');
    }

    private static simpleHash(str: string): string {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return (hash >>> 0).toString(36).toUpperCase();
    }
}
