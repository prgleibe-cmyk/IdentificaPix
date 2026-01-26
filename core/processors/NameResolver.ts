
/**
 * 🎯 FONTE ÚNICA DE VERDADE: INTELIGÊNCIA NOMINAL (V4 - ULTRA CLEAN)
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
   * LIMPEZA (DESATIVADA): Retorna o texto original conforme solicitado.
   */
  static clean(rawName: string, userKeywords: string[] = []): string {
    if (!rawName) return '';
    return rawName.trim();
  }

  /**
   * FORMATAÇÃO VISUAL (MÁSCARA): Usada apenas na exibição dos relatórios.
   * Remove sequências numéricas longas (IDs/CPF) e máscaras de asteriscos.
   */
  static formatDisplayName(name: string): string {
    if (!name) return '';
    
    return name
      // 1. Remove apenas sequências de números longas (8 ou mais dígitos) - IDs de transação e CPFs sem pontos
      .replace(/\d{8,}/g, '')
      // 2. Remove asteriscos e caracteres de máscara (ex: ***.456.*** ou ***123***)
      .replace(/\*+[\d.Xx-]*\*+/g, '')
      // 3. Remove traços ou pontos isolados que sobraram entre espaços
      .replace(/\s[-.]\s/g, ' ')
      // 4. Limpeza final de espaços múltiplos e trims
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /**
   * NORMALIZAÇÃO: Usada apenas para MATCHING interno (Remoção de acentos).
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
