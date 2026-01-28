/**
 * 🎯 FONTE ÚNICA DE VERDADE: INTELIGÊNCIA NOMINAL (V10 - RE-ATIVADA)
 * Esta classe é responsável por garantir a paridade absoluta entre a Simulação e a Lista Viva.
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
   * LIMPEZA DETERMINÍSTICA:
   * Remove as palavras-chave aprendidas do modelo e as globais do sistema.
   * Única fonte da 'Verdade' para a descrição secundária na Lista Viva.
   */
  static clean(rawName: string, modelKeywords: string[] = [], globalKeywords: string[] = []): string {
    if (!rawName) return '';
    
    let cleaned = rawName.toUpperCase();

    // 1. Sanitização física
    cleaned = cleaned
        .replace(/[\t\r\n]/g, ' ') 
        .replace(/\s+/g, ' ')      
        .trim();

    // 2. Remoção de Palavras Ignoradas (O "Aprendizado")
    // Combina keywords do modelo e globais, removendo duplicatas
    const allKeywords = Array.from(new Set([
        ...modelKeywords.map(k => k.toUpperCase()),
        ...globalKeywords.map(k => k.toUpperCase())
    ])).filter(k => k.length > 0);

    // Ordena por tamanho descendente para remover termos mais específicos primeiro
    allKeywords.sort((a, b) => b.length - a.length);

    allKeywords.forEach(keyword => {
        if (!keyword) return;
        // Escapa caracteres especiais para Regex e garante match de palavra inteira ou prefixo
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b|${escapedKeyword}\\s+`, 'g');
        cleaned = cleaned.replace(regex, ' ');
    });

    // 3. Limpeza final de espaços
    return cleaned.replace(/\s+/g, ' ').trim() || rawName.toUpperCase().trim();
  }

  static formatDisplayName(name: string): string {
    return name || '';
  }

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