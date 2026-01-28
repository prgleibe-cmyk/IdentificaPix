/**
 * 🎯 FONTE ÚNICA DE VERDADE: INTELIGÊNCIA NOMINAL (V9 - NEUTRALIZADA)
 * Feature de "Palavras Ignoradas" removida para garantir integridade total da Descrição.
 */
export class NameResolver {
  
  static identifyNameColumn(rows: string[][], excludedIndices: number[] = []): number {
    const sample = rows.slice(0, 50);
    if (sample.length === 0) return -1;
    const scores = new Array(rows[0]?.length || 0).fill(0);
    sample.forEach(row => {
        row.forEach((cell, index) => {
            if (excludedIndices.includes(index)) return;
            const val = String(cell || '').trim();
            // Pontua colunas que não parecem números puros e têm tamanho razoável
            if (val.length > 4 && !/^[\d.,R$\s\-()]+$/.test(val)) {
                scores[index] += 1;
                if (val.split(' ').length > 1) scores[index] += 0.5;
            }
        });
    });
    const maxScore = Math.max(...scores);
    return maxScore > 0 ? scores.indexOf(maxScore) : -1;
  }

  /**
   * LIMPEZA DETERMINÍSTICA (NEUTRALIZADA V9):
   * Não remove mais nenhum termo baseado em palavras-chave aprendidas ou globais.
   * Garante que a Descrição permaneça fiel ao extrato original.
   */
  static clean(rawName: string, _modelKeywords: string[] = [], _globalKeywords: string[] = []): string {
    if (!rawName) return '';
    
    // Converte para uppercase apenas para padronização visual e de matching,
    // mas não altera o conteúdo léxico (não remove palavras).
    let cleaned = rawName.toUpperCase();

    // Sanitização física mínima para preservar layout e remover caracteres de controle
    cleaned = cleaned
        .replace(/[\t\r\n]/g, ' ') // Remove tabs e quebras de linha
        .replace(/\s+/g, ' ')      // Normaliza espaços duplos
        .trim();

    return cleaned;
  }

  /**
   * FORMATAÇÃO VISUAL (MÁSCARA): DESATIVADA (V7)
   * Agora retorna o nome exatamente como processado pelo modelo, sem modificações adicionais.
   */
  static formatDisplayName(name: string): string {
    return name || '';
  }

  /**
   * NORMALIZAÇÃO: Usada apenas para algoritmos de MATCHING interno.
   */
  static normalize(text: string): string {
    if (!text) return '';
    return text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+/g, ' ')           // Normaliza espaços
      .trim();
  }
}