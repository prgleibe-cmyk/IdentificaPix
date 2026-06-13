import { Transaction } from '../../types';

export class SicoobParser {
  /**
   * Wrapper padrão para chamar o parser determinístico do Sicoob
   */
  static parse(content: string, bankId?: string): Transaction[] {
    return this.parseSicoobStatement(content, bankId);
  }

  /**
   * Converte o texto bruto extraído de um extrato do Sicoob em objetos Transaction
   */
  static parseSicoobStatement(rawText: string, bankId?: string): Transaction[] {
    if (!rawText) return [];

    // 1. Dividir em linhas e remover espaços extras
    const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    // 2. Descobrir o ano de referência (âncora) a partir do cabeçalho do período
    let anchorYear = new Date().getFullYear();
    for (const line of lines) {
      const periodMatch = line.match(/PERÍODO:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
      if (periodMatch) {
         anchorYear = parseInt(periodMatch[3], 10);
         break;
      }
    }

    const transactions: Transaction[] = [];

    // O formato padrão de início de transação é "DD/MM DESCRICAO VALOR_INDICADOR"
    // Exemplo: "01/06 PIX RECEB.OUTRA IF 145,00C" ou "03/06 TARIFA EXTRATO 5,00D"
    const txStartRegex = /^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.,]+)([CDcd])$/;

    interface SicoobBlock {
      headerLine: string;
      day: string;
      month: string;
      descPart: string;
      amountPart: string;
      indicator: string;
      details: string[];
    }

    const blocks: SicoobBlock[] = [];
    let currentBlock: SicoobBlock | null = null;

    // 3. Segmentação em blocos de transação
    for (const line of lines) {
      const match = line.match(txStartRegex);
      if (match) {
        const day = match[1];
        const month = match[2];
        const descPart = match[3].trim();
        const amountPart = match[4].trim();
        const indicator = match[5].toUpperCase();

        // Ignorar linhas puramente administrativas/sistema
        const descUpper = descPart.toUpperCase();
        const isSystemLine = [
          "SALDO", "SD.", "RESUMO", "ENCARGOS", "LIMITE", "BLOQUEIO", "CONTATOS", 
          "SAC", "OUVIDORIA", "TELEFONE", "ATENDIMENTO", "CONTA", "EXTRATO", "PERÍODO", "SICOOB"
        ].some(keyword => descUpper.includes(keyword));

        if (!isSystemLine) {
          currentBlock = {
            headerLine: line,
            day,
            month,
            descPart,
            amountPart,
            indicator,
            details: []
          };
          blocks.push(currentBlock);
          continue;
        }
      }

      // Se temos um bloco ativo, adicionamos as linhas subsequentes como detalhes
      if (currentBlock) {
        const lineUpper = line.toUpperCase();
        const stopBlockKeys = [
          "SALDO ANTERIOR", "SALDO DO DIA", "SALDO ATUAL", "RESUMO DA CONTA", 
          "DEMONSTRATIVO", "SAC:", "OUVIDORIA:"
        ];
        const containsStopKey = stopBlockKeys.some(k => lineUpper.includes(k));
        if (containsStopKey) {
          currentBlock = null; // encerra a acumulação
        } else {
          currentBlock.details.push(line);
        }
      }
    }

    // 4. Mapeamento dos blocos em objetos Transaction
    blocks.forEach((block, index) => {
      // Conversão do valor financeiro: "145,00" -> 145.00 | "50,00D" -> -50.00
      let cleanAmountStr = block.amountPart.replace(/\./g, '').replace(',', '.');
      let amount = parseFloat(cleanAmountStr);
      if (block.indicator === 'D') {
        amount = -amount;
      }

      // Montagem da data ISO: YYYY-MM-DD
      const isoDate = `${anchorYear}-${block.month}-${block.day}`;

      let contributorName = '';
      const details = block.details;

      // Regex para detectar CPF ou CNPJ formatado ou mascarado
      const taxIdRegex = /[\d*]{3}\.[\d*]{3}\.[\d*]{3}-[\d*]{2}|[\d*]{2}\.[\d*]{3}\.[\d*]{3}\/[\d*]{4}-[\d*]{2}/;
      let taxIdIndex = -1;
      for (let i = 0; i < details.length; i++) {
        if (taxIdRegex.test(details[i])) {
          taxIdIndex = i;
          break;
        }
      }

      // Se achamos uma linha de CPF, o nome do contribuinte é a linha diretamente anterior a ela
      if (taxIdIndex > 0) {
        const potentialName = details[taxIdIndex - 1].trim();
        // Evita usar strings curtas ou cabeçalhos de sistema conhecidos
        if (potentialName.length > 2 && !potentialName.toUpperCase().includes('RECEBIMENTO')) {
          contributorName = potentialName;
        }
      }

      // Se não achamos CPF, tentamos extrair o nome pelas linhas que não contêm identificadores padrão
      if (!contributorName) {
        const candidateLines = details.filter(line => {
          const lower = line.toLowerCase();
          return !lower.includes('recebimento') && !lower.includes('doc.:') && !lower.includes('tarifa') && line.length > 2;
        });
        if (candidateLines.length > 0) {
          contributorName = candidateLines[0].trim();
        }
      }

      // Fallback para a descrição básica se o nome não for detectado
      if (!contributorName) {
        contributorName = details.length > 0 ? details[0] : block.descPart;
      }

      const finalDescription = contributorName;
      const finalCleanedDescription = contributorName;

      // Detecção inteligente da forma de pagamento
      let paymentMethod = 'OUTROS';
      const rawBlockFull = [block.headerLine, ...block.details].join('\n');
      const rawBlockFullUpper = rawBlockFull.toUpperCase();
      if (rawBlockFullUpper.includes('PIX')) {
        paymentMethod = 'PIX';
      } else if (rawBlockFullUpper.includes('TED') || rawBlockFullUpper.includes('DOC')) {
        paymentMethod = 'TRANSFERENCIA';
      } else if (rawBlockFullUpper.includes('BOLETO')) {
        paymentMethod = 'BOLETO';
      } else if (rawBlockFullUpper.includes('DINHEIRO') || rawBlockFullUpper.includes('DEPÓSITO') || rawBlockFullUpper.includes('DEPOSITO')) {
        paymentMethod = 'DINHEIRO';
      }

      // Geração de ID seguro
      const uniqueId = `sicoob-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`;

      const transaction: Transaction = {
        id: uniqueId,
        date: isoDate,
        description: finalDescription,
        rawDescription: rawBlockFull,
        amount: amount,
        originalAmount: block.amountPart + block.indicator,
        cleanedDescription: finalCleanedDescription,
        contributionType: amount >= 0 ? 'ENTRADA' : 'SAÍDA',
        paymentMethod: paymentMethod,
        bank_id: bankId,
        isConfirmed: false
      };

      transactions.push(transaction);
    });

    return transactions;
  }
}
