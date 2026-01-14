
/**
 * ESPECIALISTA EM INTELIGÊNCIA MONETÁRIA (Core Engine v3)
 * Identifica a coluna correta por magnitude e limpa ruídos alfanuméricos com fidelidade absoluta.
 * 
 * ATUALIZAÇÃO (BR STRICT MODE + US SUPPORT):
 * Detecta automaticamente o formato (BR vs US) baseado na presença e ordem dos separadores.
 * Corrige bug onde 1,340 (milhar US) era lido como 1,34 (decimal BR).
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
   * Suporta formatos BR (1.000,00) e US (1,000.00) inteligentemente.
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

    // 4. LÓGICA DE NORMALIZAÇÃO INTELIGENTE (BR/US HÍBRIDO)
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');

        // Se o Ponto vem ANTES da Vírgula -> Padrão BR (1.000,00)
        if (lastDot < lastComma) {
            cleaned = cleaned.replace(/\./g, ''); 
            cleaned = cleaned.replace(',', '.');  
        } 
        // Se a Vírgula vem ANTES do Ponto -> Padrão US (1,000.00)
        else {
            cleaned = cleaned.replace(/,/g, ''); 
            // O ponto já é decimal, mantém
        }
    } 
    else if (hasComma) {
        const parts = cleaned.split(',');
        
        // Se houver múltiplas vírgulas (1,234,567), é milhar US
        if (parts.length > 2) {
            cleaned = cleaned.replace(/,/g, '');
        } 
        else if (parts.length === 2) {
            const decimalPart = parts[1];
            // HEURÍSTICA DE CONTEXTO: 
            // Se exatamente 3 dígitos após a vírgula (ex: 1,340), assume milhar US -> 1340
            // Isso corrige o bug de valores > 1000 vindos de CSV/Excel mal formatados
            if (decimalPart.length === 3) {
                cleaned = cleaned.replace(/,/g, '');
            } else {
                // Caso contrário (10,5 ou 10,50), assume decimal BR -> 10.5
                cleaned = cleaned.replace(',', '.');
            }
        }
    } 
    else if (hasDot) {
        const parts = cleaned.split('.');
        
        // Se houver múltiplos pontos (1.234.567), é milhar BR
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
            // Caso contrário (10.50), assume decimal US/Prog e mantém o ponto
        }
    }

    const val = parseFloat(cleaned);
    if (isNaN(val)) return "0.00";

    // Garante o sinal correto e fixação de casas decimais
    return (isNegative ? -Math.abs(val) : Math.abs(val)).toFixed(2);
  }

  /**
   * Versão ultra-leve para detecção de coluna (Usa a mesma lógica principal).
   */
  private static simpleParse(val: any): number | null {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (s.length < 1) return null;
    if (s.includes(':')) return null;

    // Reutiliza a lógica robusta do clean, mas retorna float direto
    const cleanedStr = this.clean(s);
    const parsed = parseFloat(cleanedStr);
    
    return isNaN(parsed) ? null : parsed;
  }
}
