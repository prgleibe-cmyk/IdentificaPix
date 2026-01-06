
/**
 * ESPECIALISTA EM INTELIGÊNCIA NOMINAL (Core Engine v3)
 * Implementa a Regra Global de Limpeza e Identificação para todos os tipos de arquivo.
 */
export class NameResolver {
  private static BANK_NOISE = [
    /\bPIX\b/gi, /\bTED\b/gi, /\bDOC\b/gi, /\bTRANSF\b/gi, /\bTRANSFERENCIA\b/gi,
    /\bRECEBIDO\b/gi, /\bENVIADO\b/gi, /\bPAGTO\b/gi, /\bPAGAMENTO\b/gi,
    /\bCONTA\b/gi, /\bCORRENTE\b/gi, /\bPOUPANCA\b/gi, /\bBANCO\b/gi,
    /\bCOMPROVANTE\b/gi, /\bAUTENTICACAO\b/gi, /\bSTR\b/gi, /\bPGTO\b/gi,
    /\bCREDITO\b/gi, /\bDEBITO\b/gi, /\bEXTRATO\b/gi, /\bFAVORECIDO\b/gi,
    /\bLIQUIDACAO\b/gi, /\bESTORNO\b/gi, /\bLANCTO\b/gi,
    /\bRECEB\.?\s*OUTRA\s*IF\b/gi // Novo: Sicoob "RECEB.OUTRA IF"
  ];

  private static CONTROL_KEYWORDS = [
    'SALDO', 'TOTAL', 'SOMATORIO', 'RESUMO', 'FECHAMENTO', 
    'ACUMULADO', 'DISPONIVEL', 'APLICACAO', 'RESGATE', 'SALDO ANTERIOR', 'SUBTOTAL',
    'RENDIMENTO', 'TARIFAS', 'IOF', 'JUROS', 'IRRF', 'SDO'
  ];

  // Proteção de nomes próprios e termos com significado
  private static ROMAN_NUMERALS = /\b(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/g;
  private static SEMANTIC_TERMS = /\b(\d+\s*(HORAS|ESTRELAS|SEDE|LOJA|FILIAL|KM|AV|RUA|QD|LT|BL))\b/gi;

  // Padrões de máscaras e IDs técnicos
  private static TECHNICAL_GARBAGE = [
    /\*+[\d.]+\*+/g,               // ***981201**
    /\d{3}\.\d{3}\.\d{3}-\d{2}/g,  // CPF
    /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, // CNPJ
    /\b[A-Z0-9]{15,}\b/g,          // UUIDs ou hashes longos
    /[0-9]{5,}/g                   // Números isolados longos (IDs de transação)
  ];

  /**
   * Identifica a coluna que provavelmente contém os nomes/descrições nominais.
   * Analisa a predominância de texto (letras > números) e complexidade (espaços).
   */
  static identifyNameColumn(rows: string[][], excludedIndices: number[]): number {
    const sample = rows.slice(0, 50);
    if (sample.length === 0) return -1;
    
    const scores = new Array(rows[0]?.length || 0).fill(0);

    sample.forEach(row => {
      row.forEach((cell, index) => {
        if (excludedIndices.includes(index)) return;
        
        const text = String(cell || '').trim();
        if (text.length < 3) return;

        // Regra 1: Predominância de Letras (Nomes Próprios)
        const letters = text.replace(/[^a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/g, '').length;
        const digits = text.replace(/[^0-9]/g, '').length;
        
        if (letters > digits) {
          scores[index] += 5; // Peso alto para texto nominal
        }

        // Regra 2: Estrutura de Nome (Espaços)
        const wordCount = text.split(/\s+/).length;
        if (wordCount >= 2 && letters > 10) {
          scores[index] += 3;
        }

        // Penalidade: Se parecer uma coluna de data ou valor puramente técnica
        if (/^\d{2}[/-]\d{2}/.test(text) || /^[\d,.]+$/.test(text)) {
          scores[index] -= 10;
        }
      });
    });

    const maxScore = Math.max(...scores);
    return maxScore > 0 ? scores.indexOf(maxScore) : -1;
  }

  /**
   * Determina se uma linha é de controle (Saldo, Total, etc)
   */
  static isControlRow(text: string): boolean {
    if (!text) return false;
    const upper = this.normalize(text);
    return this.CONTROL_KEYWORDS.some(keyword => upper.includes(keyword));
  }

  /**
   * LIMPEZA UNIVERSAL: Remove apenas o ruído técnico e bancário.
   * Preserva a integridade de nomes de pessoas e empresas.
   */
  static clean(rawName: string, userKeywords: string[] = []): string {
    if (!rawName) return '';

    let cleaned = rawName;

    // 1. Proteção temporária de termos semânticos (ex: "Posto 7", "Joao II")
    const protectedTokens: string[] = [];
    const protect = (regex: RegExp, prefix: string) => {
      cleaned = cleaned.replace(regex, (match) => {
        const placeholder = `__${prefix}_${protectedTokens.length}__`;
        protectedTokens.push(match);
        return placeholder;
      });
    };

    protect(this.SEMANTIC_TERMS, 'SEM');
    protect(this.ROMAN_NUMERALS, 'ROM');

    // 2. Remoção de Ruído Bancário Explícito
    this.BANK_NOISE.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    // 3. Remoção de Palavras-chave do Usuário (Ordenadas por tamanho para matching correto de frases)
    // Ex: Se remover "PIX" antes de "PIX RECEBIDO", sobraria "RECEBIDO". Removendo o maior primeiro resolve.
    const sortedKeywords = [...userKeywords].sort((a, b) => b.length - a.length);

    sortedKeywords.forEach(k => {
      if (k && k.trim()) {
        // Divide a frase em tokens (ex: "RECEB OUTRA IF" -> ["RECEB", "OUTRA", "IF"])
        const tokens = k.trim().split(/\s+/);
        
        // Escapa caracteres especiais de regex em cada token
        const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        
        // Cria um padrão que aceita espaços, pontos, traços ou underscores entre os tokens
        // Isso resolve o problema de extratos como "RECEB.OUTRA.IF" vs config "RECEB OUTRA IF"
        const patternStr = escapedTokens.join('[\\s._-]+');
        
        // \b garante que só remove se for palavra inteira ou frase delimitada
        cleaned = cleaned.replace(new RegExp(`\\b${patternStr}\\b`, 'gi'), ' ');
      }
    });

    // 4. Remoção de Lixo Técnico (CPF, CNPJ, Hashes, IDs)
    this.TECHNICAL_GARBAGE.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    // 5. Limpeza de Pontuação (Mantendo Acentos)
    // Transforma caracteres de controle e símbolos em espaços
    cleaned = cleaned.replace(/[*\-_.;:/\\|()<>]/g, ' ');

    // 6. Tokenização e Filtro de Números Isolados Restantes
    cleaned = cleaned.split(/\s+/).filter(token => {
        if (!token) return false;
        // Remove apenas o que for puramente numérico e não protegido
        if (/^\d+$/.test(token) && !token.includes('__')) return false;
        return true;
    }).join(' ');

    // 7. Restauração de Tokens Protegidos
    protectedTokens.forEach((val, i) => {
      cleaned = cleaned.replace(new RegExp(`__(SEM|ROM)_${i}__`, 'g'), val);
    });

    // 8. Normalização Final de Espaços
    const result = cleaned.replace(/\s+/g, ' ').trim();

    // SEGURANÇA: Se a limpeza for agressiva demais, mantém o original para não sumir dados
    if (result.length < 2 && rawName.trim().length >= 2) {
        return rawName.trim();
    }

    return result;
  }

  /**
   * Normalização para Comparação: Maiúsculas, Sem Acentos, Sem Especiais.
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
}
