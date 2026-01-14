
import { NameResolver } from './NameResolver';

/**
 * NORMALIZADOR CANÔNICO DE DOCUMENTOS (Core v3)
 * 
 * Responsável por transformar conteúdo bruto de qualquer fonte (PDF, Excel, Imagem)
 * em uma representação estrutural unificada.
 * 
 * OBJETIVO: Garantir que o mesmo documento gere a mesma assinatura, independente do formato.
 */
export class CanonicalDocumentNormalizer {

    /**
     * Gera a Assinatura Estrutural Canônica.
     * Combina o cabeçalho normalizado com a topologia dos dados.
     */
    static generateSignature(lines: string[]): string {
        if (!lines || lines.length === 0) return '';

        // 1. Normaliza o Cabeçalho (Linha 0)
        // Remove espaços extras, pontuação e converte para uppercase
        const canonicalHeader = this.normalizeLine(lines[0], true);

        // 2. Extrai Topologia de Dados (Linhas 1-5)
        // Analisa o tipo de dado (DATA, NUMERO, TEXTO) para criar um padrão
        const dataSample = lines.slice(1, 6);
        const topologySignature = dataSample.map(line => this.getTopologyPattern(line)).join('|');

        // 3. Hash Final
        const rawSignature = `${canonicalHeader}||${topologySignature}`;
        return this.simpleHash(rawSignature);
    }

    /**
     * Normaliza uma linha de texto removendo artefatos de formatação.
     * @param isHeader Se true, preserva texto mas remove delimitadores.
     */
    static normalizeLine(line: string, isHeader: boolean = false): string {
        if (!line) return '';

        let normalized = line.toUpperCase();

        // 1. Remove acentos e caracteres especiais
        normalized = NameResolver.normalize(normalized);

        // 2. Remove delimitadores comuns de CSV/Excel (;,|,\t) e substitui por espaço
        normalized = normalized.replace(/[;,\t|]/g, ' ');

        // 3. Remove pontuações que podem variar no OCR (.,-_:)
        // Mantém apenas letras e números
        normalized = normalized.replace(/[^A-Z0-9\s]/g, '');

        // 4. Colapso de espaços (múltiplos espaços viram um só)
        normalized = normalized.replace(/\s+/g, ' ').trim();

        if (isHeader) {
            return normalized;
        }

        // Se não for header, aplica generalização de dados
        // Substitui números por token genérico para evitar ruído de OCR
        // Ex: "1000" vs "1.000" vs "1000.00" -> "#NUM"
        normalized = normalized.replace(/\d+/g, '#NUM');

        return normalized;
    }

    /**
     * Detecta o padrão de tipos de uma linha (Ex: "DATE STRING NUM")
     * Ignora o delimitador original e tenta inferir pela posição visual/lógica.
     */
    private static getTopologyPattern(line: string): string {
        // Divide por espaços (assumindo que já foi pré-processado ou que espaços separam colunas visuais)
        // Para maior precisão, usamos uma regex que captura "ilhas" de conteúdo
        const tokens = line.trim().split(/[\s;,\t|]+/);
        
        return tokens.map(token => {
            // Check Date
            if (/\d{1,2}[/-]\d{1,2}/.test(token) || /\d{4}-\d{2}-\d{2}/.test(token)) return 'DT';
            // Check Money/Number (com suporte a R$, pontos e vírgulas)
            if (/^([R$]*\s*)?-?[\d.,]+[CD]?$/.test(token) && /\d/.test(token)) return 'NM';
            // Check Empty/Trash
            if (token.length < 2) return 'XX';
            // Default String
            return 'ST';
        }).join('.');
    }

    /**
     * Hash simples (DJB2 variant) para gerar string curta
     */
    private static simpleHash(str: string): string {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
        }
        return (hash >>> 0).toString(36).toUpperCase();
    }
}
