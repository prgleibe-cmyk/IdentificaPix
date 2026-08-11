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
    // Exemplo: "01/06 PIX RECEB.OUTRA IF 145,00C" ou "03/06 TARIFA EXTRATO 5,00D" ou "06/07 PIX EMIT.OUTRA IF 3.000,00 D"
    const txStartRegex = /^(\d{2})\/(\d{2})(?:\/\d{2,4})?\s+(.+?)\s+(-?(?:R\$\s*)?[\d.,]+)\s*([CDcd\-\+])?$/;
    const dateOnlyRegex = /^(\d{2})\/(\d{2})(?:\/\d{2,4})?$/;

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

    // 3. Segmentação em blocos de transação (com suporte a fusão de linha de data isolada)
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Tenta fusão com linha posterior se esta linha tiver apenas a data DD/MM
      const dateOnlyMatch = line.match(dateOnlyRegex);
      if (dateOnlyMatch && i + 1 < lines.length) {
        const candidateCombined = `${line} ${lines[i + 1]}`;
        if (txStartRegex.test(candidateCombined)) {
          line = candidateCombined;
          i++; // avança índice pois consumiu a linha seguinte
        }
      }

      const match = line.match(txStartRegex);
      if (match) {
        const day = match[1];
        const month = match[2];
        const descPart = match[3].trim();
        const amountPart = match[4].trim();
        const indicator = (match[5] || '').toUpperCase();

        // Ignorar apenas cabeçalhos puramente administrativos/saldos de rodapé
        const descUpper = descPart.toUpperCase();
        const numericOrCurrencyRegex = /^[\sR$\-+]?[\d.,]+[CDcd]?$/;
        const isSystemLine = 
          numericOrCurrencyRegex.test(descPart) ||
          descUpper.includes("SALDO ANTERIOR") ||
          descUpper.includes("SALDO DO DIA") ||
          descUpper.includes("SALDO ATUAL") ||
          descUpper.includes("SALDO DISPONIVEL") ||
          descUpper.includes("SALDO DISPONÍVEL") ||
          descUpper.includes("RESUMO DA CONTA") ||
          descUpper.startsWith("SD.") ||
          descUpper.startsWith("SD ") ||
          descUpper === "SICOOB" ||
          descUpper.includes("SAC SICOOB") ||
          descUpper.includes("OUVIDORIA SICOOB") ||
          descUpper.includes("TELEFONE SICOOB") ||
          descUpper.includes("ATENDIMENTO SICOOB") ||
          descUpper.includes("PERÍODO:") ||
          descUpper.includes("PERIODO:") ||
          descUpper === "DEMONSTRATIVO";

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
      let cleanAmountStr = block.amountPart.replace(/[^0-9,-]/g, '').replace(/\./g, '').replace(',', '.');
      let amount = parseFloat(cleanAmountStr);

      let effectiveIndicator = block.indicator;

      // 1. Procura por indicador 'D' ou 'C' nas linhas de detalhe do bloco caso não tenha vindo no cabeçalho
      if (!effectiveIndicator) {
        for (const detailLine of block.details) {
          const trimmedDetail = detailLine.trim().toUpperCase();
          if (trimmedDetail === 'D' || trimmedDetail === 'C') {
            effectiveIndicator = trimmedDetail;
            break;
          }
          if (/\bD\b/.test(trimmedDetail) || /\bD$/.test(trimmedDetail)) {
            effectiveIndicator = 'D';
            break;
          }
          if (/\bC\b/.test(trimmedDetail) || /\bC$/.test(trimmedDetail)) {
            effectiveIndicator = 'C';
            break;
          }
        }
      }

      // 2. Regra semântica bancária determinística para definir indicador se ainda estiver ausente
      const fullTextUpper = [block.descPart, ...block.details].join(' ').toUpperCase();
      if (!effectiveIndicator) {
        if (
          fullTextUpper.includes('PIX EMIT') || 
          fullTextUpper.includes('PAG') || 
          fullTextUpper.includes('PAGAMENTO') || 
          fullTextUpper.includes('DÉB') || 
          fullTextUpper.includes('DEB.') || 
          fullTextUpper.includes('DÉBITO') || 
          fullTextUpper.includes('DEBITO') || 
          fullTextUpper.includes('TARIFA') || 
          fullTextUpper.includes('SAIDA') ||
          fullTextUpper.includes('SAÍDA') ||
          fullTextUpper.includes('RETIRADA') ||
          fullTextUpper.includes('TIT.COMPE')
        ) {
          effectiveIndicator = 'D';
        } else if (
          fullTextUpper.includes('PIX RECEB') || 
          fullTextUpper.includes('RECEB') || 
          fullTextUpper.includes('CRÉDITO') || 
          fullTextUpper.includes('CREDITO') || 
          fullTextUpper.includes('DEPÓSITO') || 
          fullTextUpper.includes('DEPOSITO')
        ) {
          effectiveIndicator = 'C';
        }
      }

      if (effectiveIndicator === 'D') {
        amount = -Math.abs(amount);
      } else if (effectiveIndicator === 'C') {
        amount = Math.abs(amount);
      }

      // Montagem da data ISO: YYYY-MM-DD
      const isoDate = `${anchorYear}-${block.month.padStart(2, '0')}-${block.day.padStart(2, '0')}`;

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

      // Helper para verificar se a linha é um texto genérico de sistema/operação
      const isGenericSystemLine = (str: string) => {
        const u = str.trim().toUpperCase();
        return (
          u === 'PAGAMENTO PIX' ||
          u === 'RECEBIMENTO PIX' ||
          u === 'PAGAMENTO' ||
          u === 'RECEBIMENTO' ||
          u === 'PIX' ||
          u.startsWith('DOC.:') ||
          u.startsWith('SICOOB') ||
          u.startsWith('TARIFA')
        );
      };

      // Se achamos uma linha de CPF/CNPJ, procuramos o nome do pagador/recebedor
      if (taxIdIndex >= 0) {
        // Tenta linha anterior se válida
        if (taxIdIndex > 0) {
          const potentialName = details[taxIdIndex - 1].trim();
          if (potentialName.length > 2 && !isGenericSystemLine(potentialName)) {
            contributorName = potentialName;
          }
        }
        // Se a linha anterior for genérica (ex: "Pagamento Pix"), tenta a linha seguinte ao CPF
        if (!contributorName && taxIdIndex + 1 < details.length) {
          const potentialNameAfter = details[taxIdIndex + 1].trim();
          if (potentialNameAfter.length > 2 && !isGenericSystemLine(potentialNameAfter)) {
            contributorName = potentialNameAfter;
          }
        }
      }

      // Se não achamos CPF ou nome via CPF, filtramos todas as linhas de detalhe por candidatos a nome
      if (!contributorName) {
        const numericOrCurrencyRegex = /^[\sR$\-+]?[\d.,]+[CDcd]?$/;
        const candidateLines = details.filter(line => {
          const trimmed = line.trim();
          const isNumeric = numericOrCurrencyRegex.test(trimmed);
          return !isNumeric && !isGenericSystemLine(trimmed) && trimmed.length > 2;
        });
        if (candidateLines.length > 0) {
          contributorName = candidateLines[0].trim();
        }
      }

      // Fallback para a descrição básica se o nome não for detectado
      if (!contributorName) {
        contributorName = block.descPart;
      }

      let finalDescription = contributorName;
      if (taxIdIndex >= 0) {
        const taxId = details[taxIdIndex].trim();
        if (taxId) {
          finalDescription = `${contributorName} - ${taxId}`;
        }
      }
      const finalCleanedDescription = finalDescription;

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
