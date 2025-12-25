
import { NameResolver } from './NameResolver';

/**
 * Árbitro de integridade do Core Engine.
 */
export class RowValidator {
  
  /**
   * Valida se uma transação possui os requisitos MÍNIMOS para existir.
   * Não exclui automaticamente saldos/totais, apenas garante que os dados são estruturalmente válidos.
   */
  static isValid(isoDate: string, rawDescription: string, standardizedAmount: string): boolean {
    // 1. Requisito: Data mínima (não precisa ser completa se for parcial, mas deve ter sido resolvida)
    if (!isoDate || isoDate.length < 5) {
      return false;
    }

    // 2. Requisito: Descrição mínima
    if (!rawDescription || rawDescription.trim().length < 2) {
      return false;
    }
    
    // 3. Requisito: Valor numérico processável
    const numericValue = parseFloat(standardizedAmount);
    if (isNaN(numericValue)) {
      return false;
    }

    // Nota: Linhas de controle (Saldos/Totais) SÃO VÁLIDAS estruturalmente, 
    // mas serão marcadas na UI para o usuário confirmar a exclusão.
    return true;
  }

  /**
   * Verifica se a linha é suspeita de ser saldo ou total (lógica delegada).
   */
  static isControlRow(description: string): boolean {
    return NameResolver.isControlRow(description);
  }
}
