
import { describe, it, expect } from '../utils/testRunner';
import { GroupingEngine, GroupingRules } from '../core/engines/GroupingEngine';

const DEFAULT_RULES: GroupingRules = {
    // Regex simples para DD/MM ou YYYY-MM-DD
    dateRegex: /(\d{2}\/\d{2})|(\d{4}-\d{2}-\d{2})/,
    // Regex simples para valores monetários (com ponto ou vírgula)
    amountRegex: /[\d.,]{2,}/,
    allowMultiLineDescription: true
};

describe('GroupingEngine: Deterministic Logic', () => {

    it('Deve agrupar registro simples de uma linha', () => {
        const input = [
            "15/05/2023 PIX RECEBIDO 100,00",
            "16/05/2023 PAGAMENTO BOLETO 50,00"
        ];
        
        const records = GroupingEngine.process(input, DEFAULT_RULES);
        
        expect(records.length).toBe(2);
        expect(records[0].lines.length).toBe(1);
        expect(records[0].trigger).toBe('DATE');
        expect(records[1].trigger).toBe('DATE');
    });

    it('Deve agrupar registros multi-linha iniciados por data', () => {
        const input = [
            "15/05/2023 TRANSFERENCIA", // Linha 1 (Início)
            "DOC: 123456",             // Linha 2 (Continuação)
            "FAVORECIDO: JOAO",        // Linha 3 (Continuação)
            "100,00 (D)",              // Linha 4 (Continuação com valor)
            "16/05/2023 NOVA TRANSACAO" // Nova Data -> Novo Registro
        ];

        const records = GroupingEngine.process(input, DEFAULT_RULES);

        expect(records.length).toBe(2);
        
        // Primeiro registro deve ter 4 linhas
        expect(records[0].lines.length).toBe(4);
        expect(records[0].rawText).toBe("15/05/2023 TRANSFERENCIA DOC: 123456 FAVORECIDO: JOAO 100,00 (D)");
        
        // Segundo registro começa na linha correta
        expect(records[1].startIndex).toBe(4);
        expect(records[1].rawText).toBe("16/05/2023 NOVA TRANSACAO");
    });

    it('Não deve descartar cabeçalho (Header) antes da primeira data', () => {
        const input = [
            "BANCO DO BRASIL",
            "EXTRATO DE CONTA CORRENTE",
            "CLIENTE: MARIA",
            "10/01/2024 SALDO INICIAL"
        ];

        const records = GroupingEngine.process(input, DEFAULT_RULES);

        expect(records.length).toBe(2);
        
        // O primeiro registro é o Header (linhas antes da data)
        expect(records[0].trigger).toBe('HEADER');
        expect(records[0].lines.length).toBe(3);
        
        // O segundo registro é a transação
        expect(records[1].trigger).toBe('DATE');
        expect(records[1].rawText).toBe("10/01/2024 SALDO INICIAL");
    });

    it('Deve respeitar a flag allowMultiLineDescription=false', () => {
        // Cenário: Arquivo CSV onde cada linha é um registro, mesmo sem data
        const rules: GroupingRules = { ...DEFAULT_RULES, allowMultiLineDescription: false };
        const input = [
            "100,00 COMPRA PADARIA",
            "200,00 COMPRA MERCADO"
        ];

        const records = GroupingEngine.process(input, rules);

        expect(records.length).toBe(2);
        expect(records[0].trigger).toBe('AMOUNT');
        expect(records[1].trigger).toBe('AMOUNT');
    });
});
