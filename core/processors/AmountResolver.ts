
/**
 * ESPECIALISTA EM INTELIGÊNCIA MONETÁRIA (Core Engine v3.1)
 */
export class AmountResolver {
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

    const validCandidates = Array.from(candidateScores.entries())
      .filter(([_, stats]) => stats.count > (sample.length * 0.15));

    if (validCandidates.length === 0) return -1;

    validCandidates.sort((a, b) => {
      const avgA = a[1].totalMagnitude / a[1].count;
      const avgB = b[1].totalMagnitude / b[1].count;
      return avgA - avgB;
    });

    return validCandidates[0][0];
  }

  static clean(rawAmount: any): string {
    if (rawAmount === null || rawAmount === undefined) return "0.00";
    let strAmount = String(rawAmount).trim();
    if (!strAmount || strAmount === '') return "0.00";

    // PROTEÇÃO V11.1: Detecta sinal negativo em extratos PDF complexos
    const isNegative = 
        strAmount.includes('-') || 
        strAmount.includes('(') || 
        strAmount.toUpperCase().endsWith('D') ||
        strAmount.toUpperCase().startsWith('D');

    // Remove tudo exceto números, pontos e vírgulas
    let cleaned = strAmount.replace(/[^0-9.,]/g, '');

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        if (lastDot < lastComma) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');  
        } else {
            cleaned = cleaned.replace(/,/g, ''); 
        }
    } 
    else if (hasComma) {
        const parts = cleaned.split(',');
        if (parts.length > 2) {
            cleaned = cleaned.replace(/,/g, '');
        } 
        else {
            const decimalPart = parts[1] || "";
            if (decimalPart.length === 3) {
                cleaned = cleaned.replace(/,/g, '');
            } else {
                cleaned = cleaned.replace(',', '.');
            }
        }
    } 
    else if (hasDot) {
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            cleaned = cleaned.replace(/\./g, '');
        } 
        else {
            const decimalPart = parts[1] || "";
            if (decimalPart.length === 3) {
                cleaned = cleaned.replace(/\./g, '');
            }
        }
    }

    const val = parseFloat(cleaned);
    if (isNaN(val)) return "0.00";

    // Retorna string formatada preservando o sinal
    return (isNegative ? -Math.abs(val) : Math.abs(val)).toFixed(2);
  }

  private static simpleParse(val: any): number | null {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (s.length < 1 || s.includes(':')) return null;
    const cleanedStr = this.clean(s);
    const parsed = parseFloat(cleanedStr);
    return isNaN(parsed) ? null : parsed;
  }
}
