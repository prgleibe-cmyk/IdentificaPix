
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
      const name = this.getTagValue(tx, 'NAME');
      const memo = this.getTagValue(tx, 'MEMO');
      const payee = this.getTagValue(tx, 'PAYEE');

      let rawDescription = '';

      if (payee) {
        rawDescription = payee;
        if (name && name.toUpperCase() !== payee.toUpperCase()) rawDescription += ` - ${name}`;
        if (memo && memo.toUpperCase() !== payee.toUpperCase() && memo.toUpperCase() !== name.toUpperCase()) rawDescription += ` - ${memo}`;
      } else if (name && memo) {
        if (name.toUpperCase().trim() === memo.toUpperCase().trim()) {
          rawDescription = name;
        } else {
          const isGeneric = (str: string) => {
            const u = str.toUpperCase().trim();
            return (
              u.includes('PIX RECEBIDO') ||
              u.includes('PIX RECEB') ||
              u.includes('PIX EMIT') ||
              u.includes('PIX ENVIADO') ||
              u.includes('PAGAMENTO PIX') ||
              u.includes('RECEBIMENTO PIX') ||
              u.includes('PIX_CRED') ||
              u.includes('PIX_DEB') ||
              u.includes('CR COMPRAS') ||
              u.includes('COMPRAS MASTERCARD') ||
              u.includes('COMPRAS VISA') ||
              u === 'PIX' ||
              u === 'SEM DESCRICAO' ||
              u === 'OUTRA IF'
            );
          };

          const nameGeneric = isGeneric(name);
          const memoGeneric = isGeneric(memo);

          if (!nameGeneric && memoGeneric) {
            rawDescription = name;
          } else if (nameGeneric && !memoGeneric) {
            rawDescription = memo;
          } else {
            rawDescription = `${name} - ${memo}`;
          }
        }
      } else {
        rawDescription = name || memo || 'Sem descrição';
      }

      if (date && amount) {
        drafts.push({
          rawDate: date,
          rawDescription: rawDescription.trim(),
          rawAmount: amount,
          sourceRowIndex: index,
          metadata: { type: this.getTagValue(tx, 'TRNTYPE') }
        });
      }
    });

    return drafts;
  }

  private getTagValue(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
    const match = xml.match(regex);
    if (!match) return '';
    let val = match[1];
    const closeIndex = val.toLowerCase().indexOf(`</${tag.toLowerCase()}>`);
    if (closeIndex !== -1) {
      val = val.substring(0, closeIndex);
    }
    return val.trim();
  }
}
