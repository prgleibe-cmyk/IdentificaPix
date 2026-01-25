
/**
 * 🎯 FONTE ÚNICA DE VERDADE: INTELIGÊNCIA NOMINAL
 * Centraliza toda a lógica de sanitização de nomes e descrições.
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
   * LIMPEZA (DESATIVADA): Retorna o texto original conforme solicitado pelo usuário.
   * Não remove mais códigos, caracteres ou símbolos automaticamente.
   */
  static clean(rawName: string, userKeywords: string[] = []): string {
    if (!rawName) return '';
    // Retorna o conteúdo íntegro, removendo apenas espaços excedentes nas pontas
    return rawName.trim();
  }

  /**
   * NORMALIZAÇÃO: Usada apenas para MATCHING (comparar nomes internamente).
   * Mantém o padrão de uppercase e remoção de acentos para busca, mas não altera o dado final.
   */
  static normalize(text: string): string {
    if (!text) return '';
    return text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') 
      .replace(/\s+/g, ' ')           
      .trim();
  }
}
