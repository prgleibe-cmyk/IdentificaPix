
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
   * PRIORIDADE ABSOLUTA: PADRÃO BRASILEIRO (1.000,00 -> 1000.00), COM SUPORTE A HÍBRIDOS.
   */
  static clean(rawAmount: string): string {
    if (!rawAmount) return "0.00";

    // 1. Normalização Inicial
    let cleaned = rawAmount.trim().replace(/[R$\s]/g, '');

    // Proteção contra horários (Ex: 10:30)
    if (/\d{1,2}:\d{2}/.test(cleaned)) return "0.00";

    // Detecta sinal negativo (antes ou depois, ou parênteses, ou 'D')
    const isNegative = 
        cleaned.includes('-') || 
        cleaned.includes('(') || 
        cleaned.toUpperCase().endsWith('D'); 

    // Remove tudo que não é número, ponto ou vírgula
    cleaned = cleaned.replace(/[^0-9.,]/g, '');

    // LÓGICA DE DESAMBIGUAÇÃO DE FORMATO (BR vs US)
    
    // CASO 0: Híbrido (Tem ponto E vírgula) -> Resolve ambiguidade pela posição do último separador
    if (cleaned.includes(',') && cleaned.includes('.')) {
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        
        if (lastComma > lastDot) {
            // Padrão BR (1.000,00) -> Vírgula é decimal (está no fim), Ponto é milhar
            cleaned = cleaned.replace(/\./g, ''); // Remove milhar
            cleaned = cleaned.replace(',', '.');  // Normaliza decimal
        } else {
            // Padrão US (1,000.00) -> Ponto é decimal (está no fim), Vírgula é milhar
            cleaned = cleaned.replace(/,/g, ''); // Remove milhar (vírgulas)
            // Ponto já é decimal, mantém.
        }
    }
    // CASO 1: Apenas Vírgula (Pode ser 100,00 Decimal BR ou 1,000 Milhar US)
    else if (cleaned.includes(',')) {
        // Se houver múltiplas vírgulas (ex: 1,234,567), é com certeza separador de milhar US.
        if ((cleaned.match(/,/g) || []).length > 1) {
            cleaned = cleaned.replace(/,/g, '');
        } else {
            // Uma única vírgula. 
            // Contexto Brasil: Assumimos Decimal (100,50)
            cleaned = cleaned.replace(',', '.');
        }
    } 
    // CASO 2: Apenas Ponto (Pode ser 1.000 Milhar BR ou 10.50 Decimal US)
    else {
        const parts = cleaned.split('.');
        
        // Múltiplos pontos (1.234.567) -> Com certeza Milhar BR
        if (parts.length > 2) {
            cleaned = cleaned.replace(/\./g, '');
        }
        // Um ponto (Ambiguidade: 1.000 vs 10.50)
        else if (parts.length === 2) {
            const decimalPart = parts[1];
            
            // HEURÍSTICA DE PRECISÃO:
            // Se tem exatamente 3 dígitos (ex: 1.000), assumimos padrão BR (Milhar). Remove o ponto.
            if (decimalPart.length === 3) {
                cleaned = cleaned.replace(/\./g, '');
            }
            // Se tem 1, 2 ou 4+ dígitos (ex: 10.5, 10.50, 0.1234), assumimos padrão US (Decimal). Mantém o ponto.
            else {
                // Mantém o ponto como está (já é um float válido em JS)
            }
        }
        // Se não tiver ponto, já é um inteiro puro.
    }

    const val = parseFloat(cleaned);
    if (isNaN(val)) return "0.00";

    // Garante o sinal correto e fixação de casas decimais
    return (isNegative ? -Math.abs(val) : Math.abs(val)).toFixed(2);
  }

  /**
   * Versão ultra-leve para detecção de coluna (sem cleaning pesado).
   */
  private static simpleParse(val: any): number | null {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (s.length < 1) return null;
    
    // Ignora timestamps na detecção de colunas também
    if (s.includes(':')) return null;

    // Tenta parse simples assumindo vírgula como decimal (BR)
    const cleanBR = s.replace(/[R$\s.]/g, '').replace(',', '.');
    const parsed = parseFloat(cleanBR);
    
    return isNaN(parsed) ? null : parsed;
  }
}
