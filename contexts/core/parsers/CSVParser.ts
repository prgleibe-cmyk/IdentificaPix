
import { BaseParser } from './BaseParser';
import { RawDocument, TransactionDraft } from '../types/core-engine';
import { DateResolver } from '../processors/DateResolver';
import { NameResolver } from '../processors/NameResolver';
import { AmountResolver } from '../processors/AmountResolver';
import { RowValidator } from '../processors/RowValidator';

export class CSVParser extends BaseParser<string[][]> {
  
  parse(doc: RawDocument<string[][]>): TransactionDraft[] {
    const rows = doc.content;
    if (rows.length === 0) return [];

    // 1. Fase de Descoberta Topológica (Inteligência de Coluna)
    const anchorYear = DateResolver.discoverAnchorYear(doc.content);
    const dateIdx = DateResolver.identifyDateColumn(rows);
    const amountIdx = AmountResolver.identifyAmountColumn(rows, [dateIdx]);
    const nameIdx = NameResolver.identifyNameColumn(rows, [dateIdx, amountIdx]);
    
    const drafts: TransactionDraft[] = [];

    // 2. Fase de Extração com Validação de Integridade
    rows.forEach((row, index) => {
      const rawDate = row[dateIdx] || '';
      const rawName = row[nameIdx] || '';
      const rawAmount = row[amountIdx] || '';

      // Normalizações prévias para validação
      const isoDate = DateResolver.resolveToISO(rawDate, anchorYear);
      const standardizedAmount = AmountResolver.clean(rawAmount);

      // Validação Final: Protege contra linhas de saldo, totais ou dados corrompidos
      if (RowValidator.isValid(isoDate, rawName, standardizedAmount)) {
        const cleanedName = NameResolver.clean(rawName);
        
        drafts.push({
          rawDate: isoDate,
          rawDescription: cleanedName,
          rawAmount: standardizedAmount,
          sourceRowIndex: index,
          metadata: { 
            originalName: rawName,
            originalDate: rawDate,
            originalAmount: rawAmount,
            isExpense: parseFloat(standardizedAmount) < 0,
            parsingConfidence: 'HIGH'
          }
        });
      }
    });

    return drafts;
  }
}
