
import { describe, it, expect } from '../utils/testRunner';
import { DateResolver } from '../core/processors/DateResolver';
import { NameResolver } from '../core/processors/NameResolver';
import { AmountResolver } from '../core/processors/AmountResolver';

describe('Core Engine: Regras Universais de Valor (Magnitude)', () => {
    it('Deve distinguir entre coluna de Transação e Saldo por magnitude (Menor magnitude vence)', () => {
        const rows = [
            ['Data', 'Desc', 'Valor', 'Saldo'],
            ['10/01', 'TX 1', '150,00', '5.000,00'],
            ['11/01', 'TX 2', '10,00', '5.010,00'],
            ['12/01', 'TX 3', '200,00', '5.210,00']
        ];
        const amountIdx = AmountResolver.identifyAmountColumn(rows, [0, 1]);
        expect(amountIdx).toBe(2); 
    });

    it('Deve tratar sinais negativos em diferentes posições e formatos', () => {
        expect(AmountResolver.clean('150,00-')).toBe('-150.00');
        expect(AmountResolver.clean('(50,00)')).toBe('-50.00');
        expect(AmountResolver.clean('-25.00')).toBe('-25.00');
    });

    it('Deve limpar símbolos monetários, letras e espaços com fidelidade absoluta', () => {
        expect(AmountResolver.clean('VALOR R$ 1.250,55')).toBe('1250.55');
        expect(AmountResolver.clean('PAGTO 10,00')).toBe('10.00');
    });

    it('Deve garantir integridade de magnitude no padrão BR (Bugfix 1.000)', () => {
        expect(AmountResolver.clean('1.000,00')).toBe('1000.00'); // BR Clássico (Híbrido)
        expect(AmountResolver.clean('1.234,56')).toBe('1234.56'); // BR Composto
        expect(AmountResolver.clean('10.000,00')).toBe('10000.00'); // Magnitude Alta
    });

    it('Deve tratar casos ambíguos com a heurística de 3 dígitos', () => {
        expect(AmountResolver.clean('1.000')).toBe('1000.00'); // Assume 1 mil (BR)
        expect(AmountResolver.clean('1.500')).toBe('1500.00'); // Assume 1.5 mil (BR)
        expect(AmountResolver.clean('10.50')).toBe('10.50'); // Assume decimal (US/Prog)
    });
});

describe('Core Engine: Isolamento de Nome (Saldos/Controle)', () => {
    it('Deve identificar linhas de saldo como controle para flagging', () => {
        expect(NameResolver.isControlRow('SALDO ANTERIOR')).toBeTruthy();
        expect(NameResolver.isControlRow('TOTAL DA CONTA')).toBeTruthy();
        expect(NameResolver.isControlRow('RESUMO DO MES')).toBeTruthy();
    });
});

describe('Core Engine: Regras Universais de Data', () => {
    it('Deve detectar coluna de data por conteúdo', () => {
        const rows = [
            ['15/07', 'DESC 1', '100.00'],
            ['16/07', 'DESC 2', '200.00']
        ];
        const dateIdx = DateResolver.identifyDateColumn(rows);
        expect(dateIdx).toBe(0);
    });

    it('Deve completar data parcial (DD/MM) com ano âncora', () => {
        const iso = DateResolver.resolveToISO('15/07', 2024);
        expect(iso).toBe('2024-07-15');
    });
});
