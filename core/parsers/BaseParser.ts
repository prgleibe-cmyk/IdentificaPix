
import { RawDocument, TransactionDraft } from '../types/core-engine';

export abstract class BaseParser<T> {
  /**
   * Converte o conteúdo RAW em uma lista de rascunhos de transação.
   */
  abstract parse(doc: RawDocument<T>): TransactionDraft[];

  /**
   * Helper para validar se uma string tem potencial de ser um valor financeiro.
   */
  protected isLikelyAmount(val: string): boolean {
    if (!val) return false;
    const clean = val.replace(/[R$\s.]/g, '').replace(',', '.');
    return !isNaN(parseFloat(clean)) && /\d/.test(clean);
  }

  /**
   * Helper para validar se uma string tem potencial de ser uma data.
   */
  protected isLikelyDate(val: string): boolean {
    if (!val || val.length < 5) return false;
    return /(\d{2}[/-]\d{2}[/-]\d{2,4})|(\d{4}-\d{2}-\d{2})/.test(val);
  }
}
