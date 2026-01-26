
/**
 * 🎯 FONTE ÚNICA DE VERDADE: INTELIGÊNCIA NOMINAL (V5 - LIMPEZA DINÂMICA)
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
   * LIMPEZA DETERMINÍSTICA: Remove termos de ruído aprendidos ou globais.
   */
  static clean(rawName: string, modelKeywords: string[] = [], globalKeywords: string[] = []): string {
    if (!rawName) return '';
    
    let cleaned = rawName.toUpperCase();
    
    // Une as palavras-chave do modelo (aprendidas no Lab) com as globais (Configurações)
    const allKeywords = Array.from(new Set([...modelKeywords, ...globalKeywords]));

    // Remove cada termo de ruído
    allKeywords.forEach(kw => {
        if (!kw) return;
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        cleaned = cleaned.replace(regex, '');
    });

    // Limpeza de caracteres residuais comuns em extratos
    cleaned = cleaned
        .replace(/[\-\:]/g, ' ') // Remove traços e dois pontos
        .replace(/\s+/g, ' ')    // Remove espaços duplos
        .trim();

    return cleaned;
  }

  /**
   * FORMATAÇÃO VISUAL (MÁSCARA): Usada apenas na exibição final.
   */
  static formatDisplayName(name: string): string {
    if (!name) return '';
    
    return name
      .replace(/\d{8,}/g, '')
      .replace(/\*+[\d.Xx-]*\*+/g, '')
      .replace(/\s[-.]\s/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /**
   * NORMALIZAÇÃO: Usada apenas para MATCHING interno.
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
