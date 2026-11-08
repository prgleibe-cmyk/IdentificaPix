
import { BaseParser } from './BaseParser';
import { RawDocument, TransactionDraft } from '../types/core-engine';

export class OFXParser extends BaseParser<string> {
  
  parse(doc: RawDocument<string>): TransactionDraft[] {
    if (!doc || typeof doc.content !== 'string' || doc.content.length === 0) {
      return [];
    }

    const drafts: TransactionDraft[] = [];
    const transactions = doc.content.split(/<STMTTRN\b[^>]*>/i);
    
    // Remove o header (primeiro elemento antes do primeiro <STMTTRN>)
    transactions.shift();

    transactions.forEach((tx, index) => {
      const rawDateTag = this.getTagValue(tx, 'DTPOSTED') || this.getTagValue(tx, 'DTUSER') || this.getTagValue(tx, 'DTSERVER');
      const rawAmountTag = this.getTagValue(tx, 'TRNAMT');
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

      const date = this.sanitizeDate(rawDateTag);
      const amount = this.sanitizeAmount(rawAmountTag);

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

  /**
   * Decodifica entidades SGML/XML comumente presentes em extratos OFX bancários
   */
  private decodeEntities(str: string): string {
    if (!str) return '';
    return str
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#39;/gi, "'")
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Normaliza datas no padrão ISO YYYY-MM-DD, lidando com timestamps de fuso horário
   * Ex: "20261015120000[-03:EST]" -> "2026-10-15"
   */
  private sanitizeDate(val: string): string {
    if (!val) return '';
    const trimmed = val.trim();
    // Compacto com ou sem hora/fuso: YYYYMMDD...
    const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
    if (compactMatch) {
      return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    }
    // Formato ISO direto: YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return isoMatch[0];
    }
    // Formato brasileiro: DD/MM/YYYY
    const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
    return trimmed;
  }

  /**
   * Higieniza valores monetários com múltiplos sinais, espaços ou formatações europeias/brasileiras
   * Ex: "+ 1.250,50" -> "1250.50" | "- 350.00" -> "-350.00"
   */
  private sanitizeAmount(val: string): string {
    if (!val) return '';
    let clean = val.replace(/\s+/g, '').replace(/^\+/, '');
    
    // Se tiver vírgula e não tiver ponto: "150,50" -> "150.50"
    if (clean.includes(',') && !clean.includes('.')) {
      clean = clean.replace(',', '.');
    } else if (clean.includes(',') && clean.includes('.')) {
      // Ex: "1.250,50" -> "1250.50"
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        // Ex: "1,250.50" -> "1250.50"
        clean = clean.replace(/,/g, '');
      }
    }
    return clean;
  }

  private getTagValue(xml: string, tag: string): string {
    // 1. Tenta formato com tag de fechamento: <TAG>conteúdo</TAG> (permitindo quebras de linha e espaços)
    const closedRegex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const closedMatch = xml.match(closedRegex);
    if (closedMatch) {
      return this.decodeEntities(closedMatch[1].trim());
    }

    // 2. Formato SGML padrão OFX (sem tag de fechamento, termina na próxima tag '<' ou quebra de linha)
    const openRegex = new RegExp(`<${tag}\\b[^>]*>\\s*([^<\\r\\n]+)`, 'i');
    const openMatch = xml.match(openRegex);
    if (openMatch) {
      return this.decodeEntities(openMatch[1].trim());
    }

    return '';
  }
}
