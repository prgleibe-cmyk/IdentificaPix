
import { NameResolver } from './NameResolver';

/**
 * NORMALIZADOR CANÔNICO DE DOCUMENTOS (Core v3)
 * 
 * Responsável por transformar conteúdo bruto de qualquer fonte (PDF, Excel, Imagem)
 * em uma representação estrutural unificada: O CanonicalDocumentShape (CDS).
 * 
 * OBJETIVO: Garantir que o mesmo documento gere a mesma assinatura, independente do formato
 * (OCR, Texto ou Células) e independente de quebras de linha visuais.
 */
export class CanonicalDocumentNormalizer {

    /**
     * Gera a Assinatura Estrutural Canônica (Hash de Conteúdo).
     * Combina o cabeçalho normalizado com a topologia dos dados.
     */
    static generateSignature(lines: string[]): string {
        if (!lines || lines.length === 0) return '';

        // 1. Normaliza o Cabeçalho (Linha 0)
        const canonicalHeader = this.normalizeLine(lines[0], true);

        // 2. Extrai Topologia de Dados (Linhas 1-10 para garantir amostra)
        const dataSample = lines.slice(1, 11);
        const topologySignature = dataSample.map(line => this.getTopologyPattern(line)).join('|');

        // 3. Hash Final
        const rawSignature = `${canonicalHeader}||${topologySignature}`;
        return this.simpleHash(rawSignature);
    }

    /**
     * GERA O PADRÃO ESTRUTURAL (Canonical Document Shape - CDS)
     * 
     * Retorna uma string que define a "Forma Lógica" do documento (ex: "DT-TX-NM").
     * 
     * ALGORITMO CDS:
     * 1. Ignora delimitadores físicos (abas, vírgulas).
     * 2. Identifica entidades fortes (DATA, VALOR).
     * 3. Trata todo o resto como TEXTO.
     * 4. Colapsa TEXTO consecutivo (Ex: "DOC" "TED" "123" -> "TX").
     * 5. Ignora linhas que não contenham pelo menos uma DATA e um VALOR (ruído).
     * 
     * Isso permite que um PDF (tabulado) e um OCR (quebrado por espaços) do mesmo documento
     * gerem exatamente a mesma assinatura "DT-TX-NM".
     */
    static generateStructuralPattern(lines: string[]): string {
        if (lines.length < 2) return 'UNKNOWN';

        // Amostra maior para ignorar cabeçalhos longos e ruídos de rodapé
        const sampleRows = lines.slice(0, 20); 
        const patterns: string[] = [];

        for (const line of sampleRows) {
            // Tokenização Agnóstica: Quebra por qualquer espaço ou delimitador
            const tokens = line.trim().split(/[\s;,\t|]+/);
            
            const rowEntities: string[] = [];
            
            for (const token of tokens) {
                const type = this.getCellType(token.trim());
                
                // Filtro de Ruído: Ignora tokens muito curtos que não sejam números
                if (type === 'XX') continue; 

                // Lógica de Colapso de Texto (Canonical Shape)
                // Se o anterior foi Texto e o atual é Texto, ignora (agrupa)
                const lastType = rowEntities[rowEntities.length - 1];
                if (type === 'ST' && lastType === 'ST') {
                    continue; 
                }

                rowEntities.push(type);
            }

            // Regra de Validade do Registro:
            // Uma linha só contribui para o padrão se tiver pelo menos DATA e VALOR (Entidades Fortes)
            // Isso filtra cabeçalhos, rodapés e linhas de quebra de OCR automaticamente.
            const hasDate = rowEntities.includes('DT');
            const hasAmount = rowEntities.includes('NM');

            if (hasDate && hasAmount) {
                patterns.push(rowEntities.join('-'));
            }
        }

        if (patterns.length === 0) return 'UNKNOWN';

        // Retorna a MODA (O padrão mais frequente)
        return this.getMode(patterns);
    }

    /**
     * Determina o tipo da célula com heurística robusta para OCR.
     */
    private static getCellType(token: string): string {
        if (!token) return 'XX';

        // 1. Check Date (Formatos DD/MM, YYYY-MM-DD, DD/MM/YYYY)
        // Aceita OCR sujo (ex: 10/01/2024.)
        if (/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?/.test(token) || /\d{4}-\d{2}-\d{2}/.test(token)) return 'DT';
        
        // 2. Check Money/Number
        // Aceita formatos: 1000 | 1.000,00 | 1,000.00 | R$ 100 | -100 | 100D | 100,00C
        // Regex ajustado para pegar números com sufixos bancários comuns
        if (/^([R$]*\s*)?-?[\d.,]+[CD]?\*?$/.test(token) && /\d/.test(token)) return 'NM';
        
        // 3. Check Empty/Noise (tokens muito curtos ou apenas símbolos)
        // Ignora tokens de 1 letra que não sejam números
        if (token.length < 2 && !/\d/.test(token)) return 'XX';
        
        // Default String (Descrição, Tipo, Documento)
        return 'ST';
    }

    /**
     * Encontra o elemento mais frequente em um array.
     */
    private static getMode(array: string[]): string {
        if (array.length === 0) return 'UNKNOWN';
        const modeMap: Record<string, number> = {};
        let maxEl = array[0], maxCount = 1;
        
        for (let i = 0; i < array.length; i++) {
            const el = array[i];
            if (modeMap[el] == null) modeMap[el] = 1;
            else modeMap[el]++;  
            
            if (modeMap[el] > maxCount) {
                maxEl = el;
                maxCount = modeMap[el];
            }
        }
        return maxEl;
    }

    /**
     * Normaliza uma linha de texto removendo artefatos de formatação.
     */
    static normalizeLine(line: string, isHeader: boolean = false): string {
        if (!line) return '';

        let normalized = line.toUpperCase();
        normalized = NameResolver.normalize(normalized);
        normalized = normalized.replace(/[;,\t|]/g, ' ');
        normalized = normalized.replace(/[^A-Z0-9\s]/g, '');
        normalized = normalized.replace(/\s+/g, ' ').trim();

        if (isHeader) return normalized;

        // Generalização para hash de conteúdo
        normalized = normalized.replace(/\d+/g, '#NUM');
        return normalized;
    }

    /**
     * Versão legada para topologia de linha única (Hash)
     */
    private static getTopologyPattern(line: string): string {
        const tokens = line.trim().split(/[\s;,\t|]+/);
        return tokens.map(token => {
            const type = this.getCellType(token);
            return type === 'XX' ? 'ST' : type; // Fallback para hash seguro
        }).join('.');
    }

    private static simpleHash(str: string): string {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return (hash >>> 0).toString(36).toUpperCase();
    }
}
