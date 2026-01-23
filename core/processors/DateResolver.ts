
/**
 * ESPECIALISTA EM INTELIGÊNCIA CRONOLÓGICA (Core Engine v3.1)
 * Implementa regras universais para identificação e normalização de datas.
 */
export class DateResolver {
  private static DATE_PATTERNS = [
    /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/, // 15/07/2024 ou 1/7/24
    /(\d{4})-(\d{1,2})-(\d{1,2})/,       // 2024-07-15 ou 2024-7-1
    /(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/, // 15/07/24
    /\b(\d{1,2})[/-](\d{1,2})\b/,        // 15/07 ou 1-7
    /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/
  ];

  /**
   * Identifica a coluna de data analisando o conteúdo das células.
   */
  static identifyDateColumn(rows: string[][]): number {
    const sample = rows.slice(0, 100);
    const scores = new Array(rows[0]?.length || 0).fill(0);

    sample.forEach(row => {
      row.forEach((cell, index) => {
        const val = String(cell || '').trim();
        if (this.isValidDatePattern(val)) {
          scores[index] += 1;
          if (val.includes('/') || val.includes('-')) scores[index] += 0.5;
        }
      });
    });

    const maxScore = Math.max(...scores);
    // Threshold reduzido para 20% para aceitar extratos com muitos headers (Sicoob/Inter)
    return maxScore > (sample.length * 0.20) ? scores.indexOf(maxScore) : -1;
  }

  /**
   * Varre o conteúdo em busca de um ano (YYYY) que sirva de âncora para datas parciais.
   */
  static discoverAnchorYear(content: any): number {
    const textToScan = typeof content === 'string' 
      ? content.substring(0, 8000) 
      : JSON.stringify(content).substring(0, 8000);

    const contextMatch = textToScan.match(/(ANO|EXERCICIO|DATA|EMISSAO|PERIODO|EXTRATO).*?\b(20\d{2})\b/i);
    if (contextMatch && contextMatch[2]) return parseInt(contextMatch[2]);

    const fullDateMatch = textToScan.match(/\b\d{1,2}[/-]\d{1,2}[/-](20\d{2})\b/);
    if (fullDateMatch && fullDateMatch[1]) return parseInt(fullDateMatch[1]);

    return new Date().getFullYear();
  }

  /**
   * Normalização Universal para ISO YYYY-MM-DD.
   */
  static resolveToISO(rawDate: string, anchorYear: number): string {
    if (!rawDate) return '';
    
    const dateMatch = rawDate.match(/(\d{1,4})[/-](\d{1,2})([/-](\d{1,4}))?/);
    if (!dateMatch) return '';

    let part1 = dateMatch[1];
    let part2 = dateMatch[2];
    let part3 = dateMatch[4];

    let day: string, month: string, year: string;

    if (part1.length === 4) {
      year = part1;
      month = part2;
      day = part3 || '01';
    } else {
      day = part1.padStart(2, '0');
      month = part2.padStart(2, '0');
      
      if (!part3) {
        year = anchorYear.toString();
      } else if (part3.length === 2) {
        year = '20' + part3;
      } else {
        year = part3;
      }
    }

    const d = parseInt(day);
    const m = parseInt(month);
    const y = parseInt(year);

    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return '';

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  private static isValidDatePattern(val: string): boolean {
    const clean = val.trim();
    if (clean.length < 3) return false;
    return this.DATE_PATTERNS.some(regex => regex.test(clean));
  }
}
