
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
    /\bLIQUIDACAO\b/gi, /\bESTORNO\b/gi, /\bLANCTO\b/gi,
    /\bRECEB\.?\s*OUTRA\s*IF\b/gi
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
            
            // Um nome costuma ter mais de 4 caracteres e não ser puramente numérico
            if (val.length > 4 && !/^[\d.,R$\s\-()]+$/.test(val)) {
                scores[index] += 1;
                // Bônus para nomes com múltiplos espaços (característica de nomes/descrições)
                if (val.split(' ').length > 1) scores[index] += 0.5;
            }
        });
    });

    const maxScore = Math.max(...scores);
    return maxScore > 0 ? scores.indexOf(maxScore) : -1;
  }

  /**
   * LIMPEZA UNIVERSAL: A regra de ouro do sistema.
   * Aplica todas as limpezas bancárias e customizadas em um único pipeline.
   */
  static clean(rawName: string, userKeywords: string[] = []): string {
    if (!rawName) return '';
    
    let cleaned = rawName;

    // 1. Ruído Bancário Padrão
    this.BANK_NOISE.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    // 2. Palavras-chave Customizadas (do mais longo para o mais curto)
    const sortedKeywords = [...userKeywords].sort((a, b) => b.length - a.length);
    sortedKeywords.forEach(k => {
      if (k && k.trim()) {
        const escaped = k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
      }
    });

    // 3. Lixo Técnico e Pontuação
    cleaned = cleaned.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, ' '); // CPF
    cleaned = cleaned.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, ' '); // CNPJ
    cleaned = cleaned.replace(/[*\-_.;:/\\|()<>]/g, ' '); // Símbolos

    // 4. Normalização de Espaços
    const result = cleaned.replace(/\s+/g, ' ').trim();

    // 🛡️ BLINDAGEM: Se a limpeza deletou quase tudo (nome muito curto), 
    // retorna o original para garantir que o usuário veja algo.
    return result.length < 2 ? rawName.trim() : result;
  }

  /**
   * Normalização para comparison em memória (Sem acentos, Uppercase).
   */
  static normalize(text: string): string {
    if (!text) return '';
    return text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') 
      .replace(/[^\w\s]/gi, '')       
      .replace(/\s+/g, ' ')           
      .trim();
  }

  static isControlRow(text: string): boolean {
    if (!text) return false;
    const norm = this.normalize(text);
    return this.CONTROL_KEYWORDS.some(k => norm.includes(k));
  }
}
