
import { TransactionDraft, NormalizedTransaction } from '../types/core-engine';

/**
 * CONTRATO FINAL DO CORE ENGINE.
 * Transforma rascunhos no padrão único: [DATA, NOME, VALOR].
 */
export class Normalizer {
  
  /**
   * Consolida rascunhos na estrutura final e imutável.
   */
  static normalize(drafts: TransactionDraft[]): NormalizedTransaction[] {
    return drafts
      .map(draft => this.toNormalized(draft))
      .filter((tx): tx is NormalizedTransaction => tx !== null);
  }

  /**
   * Mapeia um rascunho individual para o padrão de 3 colunas.
   */
  private static toNormalized(draft: TransactionDraft): NormalizedTransaction | null {
    try {
      // 1. Valor: Float64 puro (Sinal preservado)
      const valorNumerico = parseFloat(draft.rawAmount);
      if (isNaN(valorNumerico)) return null;

      // 2. Data: YYYY-MM-DD rigoroso
      if (!draft.rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(draft.rawDate)) return null;

      // 3. Nome: String sanitizada (comparável)
      const nomeSanitizado = draft.rawDescription.trim();
      if (nomeSanitizado.length < 2) return null;

      return {
        data: draft.rawDate,      // COLUNA 1
        nome: nomeSanitizado,     // COLUNA 2
        valor: valorNumerico      // COLUNA 3
      };
    } catch (e) {
      return null;
    }
  }
}
