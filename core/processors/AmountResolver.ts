
/**
 * ESPECIALISTA EM INTELIGÊNCIA MONETÁRIA (Core Engine v3)
 * Identifica a coluna correta por magnitude e limpa ruídos alfanuméricos com fidelidade absoluta.
 * 
 * ATUALIZAÇÃO (BR STRICT MODE):
 * Prioriza formatação brasileira para evitar perdas de magnitude.
 * Regra de Ouro:
 * 1. Remove separadores de milhar (.)
 * 2. Converte decimal (,) para ponto
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
   * PADRÃO BRASILEIRO ESTRITO (1.000,00 -> 1000.00).
   * HARDENED: Aceita tipos inesperados (number, null, undefined) para evitar crashes.
   */
  static clean(rawAmount: any): string {
    // 1. Hardening: Proteção contra nulos/undefined
    if (rawAmount === null || rawAmount === undefined) return "0.00";

    // 2. Hardening: Conversão de tipos não-string
    let strAmount = String(rawAmount);
    if (!strAmount || strAmount.trim() === '') return "0.00";

    // 3. Normalização Inicial
    let cleaned = strAmount.trim().replace(/[R$\s]/g, '');

    // Proteção contra horários (Ex: 10:30)
    if (/\d{1,2}:\d{2}/.test(cleaned)) return "0.00";

    // Detecta sinal negativo (antes ou depois, ou parênteses, ou 'D' de Débito)
    const isNegative = 
        cleaned.includes('-') || 
        cleaned.includes('(') || 
        cleaned.toUpperCase().endsWith('D'); 

    // Remove tudo que não é número, ponto ou vírgula
    cleaned = cleaned.replace(/[^0-9.,]/g, '');

    // 4. LÓGICA DE NORMALIZAÇÃO BRASILEIRA (STRICT MODE)
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
        // Híbrido: Assume padrão BR (1.000,00)
        // Regra: Remove pontos (milhar) e troca vírgula por ponto (decimal)
        cleaned = cleaned.replace(/\./g, ''); 
        cleaned = cleaned.replace(',', '.');  
    } 
    else if (hasComma) {
        // Apenas vírgula: Assume decimal BR (100,00) ou sem milhar (1000,00)
        cleaned = cleaned.replace(',', '.');
    } 
    else if (hasDot) {
        // Apenas ponto: Ambiguidade (1.000 BR vs 10.50 US/Prog)
        const parts = cleaned.split('.');
        
        // Se houver múltiplos pontos (1.234.567), é milhar BR com certeza
        if (parts.length > 2) {
            cleaned = cleaned.replace(/\./g, '');
        } 
        else if (parts.length === 2) {
            const decimalPart = parts[1];
            // HEURÍSTICA DE CONTEXTO: 
            // Se exatamente 3 dígitos após o ponto (ex: 1.000), assume milhar BR -> 1000
            if (decimalPart.length === 3) {
                cleaned = cleaned.replace(/\./g, '');
            }
            // Caso contrário (10.5, 10.50), assume decimal US/Prog e mantém o ponto
        }
    }

    const val = parseFloat(cleaned);
    if (isNaN(val)) return "0.00";

    // Garante o sinal correto e fixação de casas decimais
    return (isNegative ? -Math.abs(val) : Math.abs(val)).toFixed(2);
  }

  /**
   * Versão ultra-leve para detecção de coluna (com mesma lógica BR).
   */
  private static simpleParse(val: any): number | null {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (s.length < 1) return null;
    if (s.includes(':')) return null;

    // Normalização rápida usando a mesma lógica do clean
    let c = s.replace(/[R$\s]/g, '');
    
    if (c.includes(',') && c.includes('.')) {
        c = c.replace(/\./g, '').replace(',', '.');
    } else if (c.includes(',')) {
        c = c.replace(',', '.');
    } else if (c.includes('.')) {
        const parts = c.split('.');
        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
            c = c.replace(/\./g, '');
        }
    }

    const parsed = parseFloat(c);
    return isNaN(parsed) ? null : parsed;
  }
}
