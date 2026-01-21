
/**
 * 🎯 FONTE ÚNICA DE VERDADE: INTELIGÊNCIA NOMINAL
 * Centraliza toda a lógica de sanitização de nomes e descrições do IdentificaPix.
 */
export class NameResolver {
  private static BANK_NOISE = [
    /\bPIX\b/gi, /\bTED\b/gi, /\bDOC\b/gi, /\bTRANSF\b/gi, /\bTRANSFERENCIA\b/gi,
    /\bRECEBIDO\b/gi, /\bENVIADO\b/gi, /\bPAGTO\b/gi, /\bPAGAMENTO\b/gi,
    /\bCONTA\b/gi, /\bCORRENTE\b/gi, /\bPOUPANCA\b/gi, /\bBANCO\b/gi,
    /\bCOMPROVANTE\b/gi, /\bAUTENTICACAO\b/gi, /\bSTR\b/gi, /\bPGTO\b/gi,
    /\bCREDITO\b/gi, /\bDEBITO\b/gi, /\bEXTRATO\b/gi, /\bFAVORECIDO\b/gi,
    /\bLIQUIDACAO\b/gi, /\bESTORNO\b/gi, /\bLANCTO\b/gi
  ];

  private static CONTROL_KEYWORDS = [
    'SALDO', 'TOTAL', 'SOMATORIO', 'RESUMO', 'FECHAMENTO', 
    'ACUMULADO', 'DISPONIVEL', 'APLICACAO', 'RESGATE', 'SALDO ANTERIOR', 'SUBTOTAL',
    'RENDIMENTO', 'TARIFAS', 'IOF', 'JUROS', 'IRRF', 'SDO'
  ];

  /**
   * Identifica a coluna de nome/descrição analisando a variedade linguística.
   */
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
   * LIMPEZA UNIVERSAL: Preserva documentos e remove ruído bancário.
   * MODIFICAÇÃO: Não remove mais sequências numéricas longas para preservar CPFs/CNPJs.
   */
  static clean(rawName: string, userKeywords: string[] = []): string {
    if (!rawName) return '';
    
    let cleaned = rawName;

    // 1. Ruído Bancário Padrão
    this.BANK_NOISE.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    // 2. Palavras-chave Customizadas
    const sortedKeywords = [...userKeywords].sort((a, b) => b.length - a.length);
    sortedKeywords.forEach(k => {
      if (k && k.trim()) {
          const escaped = k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
      }
    });

    // 3. Normalização de Espaços
    // NOTA: Mantemos números e caracteres especiais (.,-*) para preservar a identidade do documento.
    const result = cleaned.replace(/\s+/g, ' ').trim();

    return result.length < 2 ? rawName.trim() : result;
  }

  /**
   * NORMALIZAÇÃO DE SEGURANÇA
   */
  static normalize(text: string): string {
    if (!text) return '';
    return text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') 
      .replace(/[^A-Z0-9\s*.\-/]/gi, '') 
      .replace(/\s+/g, ' ')           
      .trim();
  }

  static isControlRow(text: string): boolean {
    if (!text) return false;
    const norm = this.normalize(text);
    return this.CONTROL_KEYWORDS.some(k => norm.includes(k));
  }
}
