
/**
 * 🎯 FONTE ÚNICA DE VERDADE: INTELIGÊNCIA NOMINAL (V6 - RIGOR ABSOLUTO)
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
   * LIMPEZA DETERMINÍSTICA: Remove termos de ruído aprendidos ou globais.
   * Não adivinha, apenas remove o que foi explicitamente solicitado.
   */
  static clean(rawName: string, modelKeywords: string[] = [], globalKeywords: string[] = []): string {
    if (!rawName) return '';
    
    // Converte para uppercase para comparação case-insensitive
    let cleaned = rawName.toUpperCase();
    
    // Une termos aprendidos no Laboratório com termos globais
    const allKeywords = Array.from(new Set([
        ...modelKeywords.map(k => k.trim().toUpperCase()), 
        ...globalKeywords.map(k => k.trim().toUpperCase())
    ])).filter(k => k.length > 0);

    // Ordena por tamanho descendente para evitar que remover "PIX" quebre "PIX RECEBIDO"
    allKeywords.sort((a, b) => b.length - a.length);

    // Remoção Literal de Termos
    allKeywords.forEach(kw => {
        if (!kw) return;
        // Escapa caracteres especiais de regex
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Tenta remover como palavra inteira primeiro (\b)
        const wordRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
        cleaned = cleaned.replace(wordRegex, '');

        // Se a palavra ainda estiver lá (emendada em números/símbolos comuns em extratos),
        // remove de forma literal para garantir o padrão ensinado
        if (cleaned.includes(kw)) {
           cleaned = cleaned.split(kw).join('');
        }
    });

    // Sanitização de caracteres residuais e espaços duplos
    cleaned = cleaned
        .replace(/[\-\:\.]/g, ' ') // Remove traços, dois pontos e pontos residuais
        .replace(/\s+/g, ' ')      // Normaliza espaços
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
