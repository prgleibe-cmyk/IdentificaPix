
/**
 * ESPECIALISTA EM INTELIGÊNCIA MONETÁRIA (Core Engine v3)
 * Identifica a coluna correta por magnitude e limpa ruídos alfanuméricos com fidelidade absoluta.
 */
export class AmountResolver {
  /**
   * Identifica a coluna de valor correta entre múltiplas candidatas.
   * Regra Universal: Transações individuais costumam ter magnitude menor que saldos acumulados.
   */
  static identifyAmountColumn(rows: string[][], excludedIndices: number[] = []): number {
    const sample = rows.slice(0, 100);
    const candidateScores = new Map<number, { count: number, totalMagnitude: number }>();

    sample.forEach(row => {
      row.forEach((cell, index) => {
        if (excludedIndices.includes(index)) return;

        const val = this.simpleParse(cell);
        if (val !== null && val !== 0) {
          const stats = candidateScores.get(index) || { count: 0, totalMagnitude: 0 };
          stats.count++;
          stats.totalMagnitude += Math.abs(val);
          candidateScores.set(index, stats);
        }
      });
    });

    // Filtra apenas colunas que aparecem como valor em pelo menos 15% da amostra
    const validCandidates = Array.from(candidateScores.entries())
      .filter(([_, stats]) => stats.count > (sample.length * 0.15));

    if (validCandidates.length === 0) return -1;

    // Se houver mais de uma coluna numérica, a de MENOR magnitude média é a transação.
    // Saldos bancários são tipicamente ordens de magnitude maiores que as movimentações diárias.
    validCandidates.sort((a, b) => {
      const avgA = a[1].totalMagnitude / a[1].count;
      const avgB = b[1].totalMagnitude / b[1].count;
      return avgA - avgB;
    });

    return validCandidates[0][0];
  }

  /**
   * Limpa letras e símbolos, padronizando para string numérica pura (ponto decimal).
   * Suporta: "R$ 1.250,50", "-1.250,50", "(1.250,50)", "1250.50-", "VALOR: 100,00"
   */
  static clean(rawAmount: string): string {
    if (!rawAmount) return "0.00";

    const trimmed = rawAmount.trim();
    
    // 1. Detecta sinal negativo em qualquer posição ou entre parênteses
    const isNegative = 
        trimmed.includes('-') || 
        (trimmed.includes('(') && trimmed.includes(')')) ||
        trimmed.endsWith('-');
    
    // 2. Remove tudo que não seja dígito, vírgula ou ponto
    let cleaned = trimmed.replace(/[^-0-9.,]/g, '');

    // 3. Normalização de Separadores (Padrão Inteligente)
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma > lastDot) {
      // Padrão BR: 1.234,56 ou 1234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma && lastComma !== -1) {
      // Padrão US: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    } else if (lastDot !== -1 && cleaned.split('.').length > 2) {
      // Caso 1.234.567 (Múltiplos pontos sem vírgula - assume milhar)
      cleaned = cleaned.replace(/\./g, '');
    }

    const numericValue = parseFloat(cleaned);
    if (isNaN(numericValue)) return "0.00";

    // Garante o sinal correto
    const finalValue = isNegative ? -Math.abs(numericValue) : numericValue;
    return finalValue.toFixed(2);
  }

  /**
   * Versão ultra-leve para detecção de coluna (sem cleaning pesado).
   */
  private static simpleParse(val: any): number | null {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (s.length < 1) return null;
    const clean = s.replace(/[R$\s.]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
  }
}
