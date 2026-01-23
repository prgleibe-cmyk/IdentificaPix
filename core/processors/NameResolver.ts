
/**
 * 🎯 FONTE ÚNICA DE VERDADE: INTELIGÊNCIA NOMINAL
 * Centraliza toda a lógica de sanitização de nomes e descrições.
 */
export class NameResolver {
  
  private static CONTROL_KEYWORDS = [
    'SALDO', 'TOTAL', 'SOMATORIO', 'RESUMO', 'FECHAMENTO', 
    'ACUMULADO', 'DISPONIVEL', 'APLICACAO', 'RESGATE', 'SALDO ANTERIOR', 'SUBTOTAL',
    'RENDIMENTO', 'TARIFAS', 'IOF', 'JUROS', 'IRRF', 'SDO'
  ];

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
   * LIMPEZA: No modo modelo, userKeywords virá vazio, 
   * resultando em retorno direto do texto original.
   */
  static clean(rawName: string, userKeywords: string[] = []): string {
    if (!rawName) return '';
    if (userKeywords.length === 0) return rawName.trim();

    let cleaned = rawName;
    const sortedKeywords = [...userKeywords].sort((a, b) => b.length - a.length);
    sortedKeywords.forEach(k => {
      if (k && k.trim()) {
          const escaped = k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
      }
    });

    return cleaned.replace(/\s+/g, ' ').trim() || rawName.trim();
  }

  static cleanGenericNoise(text: string): string {
    const noise = /\b(PIX|TED|DOC|TRANSF|TRANSFERENCIA|RECEBIDO|ENVIADO|PAGTO|PAGAMENTO|AUTENTICACAO)\b/gi;
    return text.replace(noise, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * NORMALIZAÇÃO: Usada apenas para MATCHING (comparar nomes).
   * Não deve ser usada para salvar ou exibir o dado.
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

  static isControlRow(text: string): boolean {
    if (!text) return false;
    const norm = this.normalize(text);
    return this.CONTROL_KEYWORDS.some(k => norm.includes(k));
  }
}
