
/**
 * ESPECIALISTA EM CLASSIFICAÇÃO (Core Engine v3)
 * Identifica o TIPO da transação baseado em palavras-chave bancárias ou colunas explícitas.
 */
export class TypeResolver {
    
    // Palavras-chave para identificar se uma coluna é de "Tipo" em listas de contribuintes pelo HEADER
    private static TYPE_COLUMN_KEYWORDS = [
        'TIPO', 'CLASSIFICACAO', 'CATEGORIA', 'NATUREZA', 'HISTORICO', 'OPERAÇÃO', 'MOVIMENTO', 'MOTIVO'
    ];

    // Termos Eclesiásticos (Peso Alto - Definem Listas de Igreja)
    private static CHURCH_PATTERNS = [
        'DÍZIMO', 'DIZIMO', 'OFERTA', 'MISSÃO', 'MISSAO', 'MISSÕES', 'MISSOES', 
        'VOTO', 'CAMPANHA', 'PRIMÍCIA', 'PRIMICIA', 'DOAÇÃO', 'DOACAO', 'BENEFICENTE'
    ];

    // Mapeamento de descrições bancárias para Tipos Padronizados (Peso Médio/Baixo)
    private static BANK_PATTERNS: Record<string, string> = {
        'PIX': 'PIX',
        'TED': 'TED',
        'DOC': 'DOC',
        'TEV': 'TRANSF.',
        'TRANSFERENCIA': 'TRANSF.',
        'TRANSF': 'TRANSF.',
        'DEPOSITO': 'DEPÓSITO',
        'DEP ': 'DEPÓSITO',
        'BOLETO': 'BOLETO',
        'COBRANCA': 'BOLETO',
        'TARIFA': 'TARIFA',
        'TAXA': 'TARIFA',
        'CESTA': 'TARIFA',
        'RESGATE': 'RESGATE',
        'APLICACAO': 'APLIC.',
        'PAGAMENTO': 'PAGTO',
        'PAGTO': 'PAGTO',
        'SAQUE': 'SAQUE',
        'CARTAO': 'CARTÃO',
        'DB VIS': 'CARTÃO',
        'ELO': 'CARTÃO',
        'MASTERCARD': 'CARTÃO',
        'VISA': 'CARTÃO',
        'CHEQUE': 'CHEQUE'
    };

    /**
     * Extrai o TIPO de uma descrição bancária bruta.
     * Ex: "PIX RECEBIDO JOAO" -> Retorna "PIX"
     */
    static resolveFromDescription(description: string): string {
        if (!description) return 'OUTROS';
        const upper = description.toUpperCase();

        // 1. Prioridade: Termos de Igreja (Se estiverem na descrição)
        for (const churchTerm of this.CHURCH_PATTERNS) {
            if (upper.includes(churchTerm)) return churchTerm;
        }

        // 2. Termos Bancários
        for (const [key, label] of Object.entries(this.BANK_PATTERNS)) {
            if (upper.includes(key)) {
                return label;
            }
        }
        
        // Se for saída e não identificou
        if (description.includes('PG') || description.includes('PAG')) return 'PAGTO';

        return 'OUTROS';
    }

    /**
     * Identifica qual coluna é provavelmente a de "Tipo" em uma lista de contribuintes.
     */
    static identifyTypeColumn(rows: string[][], excludedIndices: number[]): number {
        const sample = rows.slice(0, 100); // Aumentado sample para 100
        if (sample.length === 0) return -1;

        const scores = new Array(rows[0]?.length || 0).fill(0);

        // 1. Verifica Header (se houver)
        const header = rows[0];
        header.forEach((cell, index) => {
            if (excludedIndices.includes(index)) return;
            const val = String(cell || '').toUpperCase();
            if (this.TYPE_COLUMN_KEYWORDS.some(k => val.includes(k))) {
                scores[index] += 15; // Peso aumentado para Headers explícitos
            }
        });

        // 2. Verifica Conteúdo
        sample.forEach(row => {
            row.forEach((cell, index) => {
                if (excludedIndices.includes(index)) return;
                const val = String(cell || '').toUpperCase().trim();
                
                if (val.length < 2) return;

                // REGRA DE OURO: Termos de Igreja valem MUITO mais
                // Permite match parcial ("Dízimo de Janeiro")
                if (this.CHURCH_PATTERNS.some(k => val.includes(k))) {
                    scores[index] += 5; // Boost alto para Dízimos/Ofertas
                }
                
                // Termos bancários valem menos e exigem match mais estrito para não confundir com descrição
                // Ex: Se a célula for apenas "PIX", ganha ponto. Se for "PIX DO JOAO", ganha menos ou nada aqui.
                else if (Object.keys(this.BANK_PATTERNS).some(k => val === k || val === k + 'S')) {
                    scores[index] += 2;
                }
            });
        });

        // Penalidade: Se a coluna parece ter datas ou valores numéricos, perde pontos
        // Isso evita que a coluna de Valor seja confundida se tiver algo escrito
        sample.forEach(row => {
            row.forEach((cell, index) => {
                if (excludedIndices.includes(index)) return;
                const val = String(cell || '');
                if (/^\d{2}[/-]\d{2}/.test(val)) scores[index] -= 5; // Parece data
                if (/^[\d.,R$\s]+$/.test(val)) scores[index] -= 5; // Parece valor numérico puro
            });
        });

        const maxScore = Math.max(...scores);
        // Limiar ajustado. Precisa de evidência forte.
        return maxScore > 10 ? scores.indexOf(maxScore) : -1;
    }
}
