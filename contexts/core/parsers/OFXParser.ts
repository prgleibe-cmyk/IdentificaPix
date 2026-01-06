
import { BaseParser } from './BaseParser';
import { RawDocument, TransactionDraft } from '../types/core-engine';

export class OFXParser extends BaseParser<string> {
  
  parse(doc: RawDocument<string>): TransactionDraft[] {
    const drafts: TransactionDraft[] = [];
    const transactions = doc.content.split('<STMTTRN>');
    
    // Remove o header (primeiro elemento antes do primeiro <STMTTRN>)
    transactions.shift();

    transactions.forEach((tx, index) => {
      const date = this.getTagValue(tx, 'DTPOSTED');
      const amount = this.getTagValue(tx, 'TRNAMT');
      const memo = this.getTagValue(tx, 'MEMO') || this.getTagValue(tx, 'NAME');

      if (date && amount) {
        drafts.push({
          rawDate: date,
          rawDescription: memo || 'Sem descrição',
          rawAmount: amount,
          sourceRowIndex: index,
          metadata: { type: this.getTagValue(tx, 'TRNTYPE') }
        });
      }
    });

    return drafts;
  }

  private getTagValue(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}>([^<]+)`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }
}
