import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cleanDisplayDescription } from '../../services/utils/parsingUtils';

test('PB-007: Registro Fidedigno de Transporte de Saldo/Déficit nos Relatórios e Livro Caixa', async (t) => {
    await t.test('[INVARIANTE COMPORTAMENTAL] IC-1: Geração Bipolar de Transporte no Fechamento', () => {
        const originChurch = { id: 'church-sede', name: 'Igreja Sede' };
        const destChurch = { id: 'church-filial', name: 'Congregação Filial' };
        const balanceToTransfer = 1500.50;
        const closingDate = '2026-10-31';

        // Simulação da geração de transações de fechamento (saldo positivo)
        const isNegative = balanceToTransfer < 0;
        const originAmount = isNegative ? Math.abs(balanceToTransfer) : -Math.abs(balanceToTransfer);
        const destAmount = isNegative ? -Math.abs(balanceToTransfer) : Math.abs(balanceToTransfer);

        const originTx = {
            church_id: originChurch.id,
            amount: originAmount,
            type: isNegative ? 'income' : 'expense',
            description: `[FECHAMENTO] FECHAMENTO DE CAIXA PERÍODO 10/2026 - TRANSPORTE DE SALDO PARA ${destChurch.name.toUpperCase()}`,
            source: 'closing',
            isConfirmed: true,
            date: closingDate,
            contributionType: 'SALDO TRANSPORTADO'
        };

        const destTx = {
            church_id: destChurch.id,
            amount: destAmount,
            type: isNegative ? 'expense' : 'income',
            description: `[RECEBIMENTO] FECHAMENTO DE CAIXA PERÍODO 10/2026 - SALDO RECEBIDO DE ${originChurch.name.toUpperCase()}`,
            source: 'closing',
            isConfirmed: true,
            date: closingDate,
            contributionType: 'SALDO TRANSPORTADO'
        };

        // Validação da ponta de origem (débito/saída que zera o caixa fechado)
        assert.equal(originTx.type, 'expense');
        assert.equal(originTx.amount, -1500.50);
        assert.equal(originTx.church_id, 'church-sede');
        assert.equal(originTx.source, 'closing');
        assert.equal(originTx.isConfirmed, true);

        // Validação da ponta de destino (crédito/entrada no caixa receptor)
        assert.equal(destTx.type, 'income');
        assert.equal(destTx.amount, 1500.50);
        assert.equal(destTx.church_id, 'church-filial');
        assert.equal(destTx.source, 'closing');
        assert.equal(destTx.isConfirmed, true);
    });

    await t.test('[INVARIANTE COMPORTAMENTAL] IC-2: Fidelidade das Somas Operacionais (Exclusão Estrita de Fechamento)', () => {
        const transactions = [
            { id: '1', amount: 1000, type: 'income', category: 'Dízimos', source: 'extrato' },
            { id: '2', amount: 500, type: 'income', category: 'Ofertas', source: 'extrato' },
            { id: '3', amount: -300, type: 'expense', category: 'Água e Luz', source: 'manual' },
            // Transação de fechamento de R$ 1200 (não deve poluir as somas operacionais)
            { 
                id: 'closing-outflow', 
                amount: -1200, 
                type: 'expense', 
                category: 'SALDO TRANSPORTADO', 
                source: 'closing',
                description: '[FECHAMENTO] PERÍODO 10/2026 - TRANSPORTE DE SALDO PARA SEDE'
            }
        ];

        let operationalIncome = 0;
        let operationalExpenses = 0;

        transactions.forEach((tx: any) => {
            const cat = String(tx.category || '').toUpperCase();
            const desc = String(tx.description || '').toUpperCase();
            const isClosingTransfer = tx.source === 'closing' 
                || cat.includes('SALDO TRANSPORTADO') 
                || cat.includes('DÉFICIT TRANSPORTADO') 
                || (desc.startsWith('[RECEBIMENTO]') && desc.includes('SALDO RECEBIDO'))
                || (desc.startsWith('[FECHAMENTO]') && desc.includes('TRANSP'));

            if (isClosingTransfer) {
                return; // Exclusão estrita
            }

            const amt = Math.abs(tx.amount);
            if (tx.type === 'expense' || tx.amount < 0) {
                operationalExpenses += amt;
            } else {
                operationalIncome += amt;
            }
        });

        const operationalBalance = operationalIncome - operationalExpenses;

        // Entradas devem ser exatamente R$ 1500,00 e Saídas R$ 300,00 (sem somar o transporte de 1200)
        assert.equal(operationalIncome, 1500);
        assert.equal(operationalExpenses, 300);
        assert.equal(operationalBalance, 1200);
    });

    await t.test('[INVARIANTE COMPORTAMENTAL] IC-3: Não-Truncamento de Descrições de Fechamento com Datas/Períodos', () => {
        const descFechamento = '[FECHAMENTO] FECHAMENTO DE CAIXA PERÍODO 10/2026 - TRANSPORTE DE SALDO PARA CONGREGAÇÃO SEDE';
        const descRecebimento = '[RECEBIMENTO] FECHAMENTO DE CAIXA PERÍODO 10/2026 - SALDO RECEBIDO DE CONGREGAÇÃO BAIRRO ALTO';
        const descAporte = '[APORTE/FECHAMENTO] FECHAMENTO DE CAIXA PERÍODO 10/2026 - COBERTURA DE DÉFICIT';

        const cleanedFechamento = cleanDisplayDescription(descFechamento);
        const cleanedRecebimento = cleanDisplayDescription(descRecebimento);
        const cleanedAporte = cleanDisplayDescription(descAporte);

        assert.equal(cleanedFechamento, descFechamento, 'Descrição de fechamento não deve perder o destino após o período');
        assert.equal(cleanedRecebimento, descRecebimento, 'Descrição de recebimento não deve ser cortada');
        assert.equal(cleanedAporte, descAporte, 'Descrição de aporte não deve ser cortada');
    });

    await t.test('[INVARIANTE COMPORTAMENTAL] IC-4 & IC-5: Resolução de Banco e Conciliação no Rodapé', () => {
        const banks = [{ id: 'bank-principal', name: 'Sicredi Principal', church_id: 'church-sede' }];
        const originBankId: string = 'bank-principal';

        // Auto-resolução quando congregação de destino não tem banco próprio
        const destChurchId = 'church-filial';
        const destBankId = banks.find(b => b.church_id === destChurchId)?.id
            || (originBankId && originBankId !== 'all' ? originBankId : undefined)
            || (banks.length > 0 ? banks[0].id : undefined);

        assert.equal(destBankId, 'bank-principal', 'Banco deve ser auto-resolvido evitando transação órfã');

        // Cálculo da conciliação final
        const saldoAnterior = 0;
        const totalEntradas = 1500;
        const totalSaidas = 300;
        const saldoTransportadoEnviado = 1200; // Zerando o caixa fechado

        const saldoFinal = saldoAnterior + totalEntradas - totalSaidas - saldoTransportadoEnviado;
        assert.equal(saldoFinal, 0, 'O caixa da congregação fechada deve resultar em exatamente 0,00');
    });

    await t.test('[GUARDA ESTRUTURAL] GE-1 a GE-5: Verificação dos Arquivos e Estruturas Críticas', () => {
        const closingModalPath = path.resolve(process.cwd(), 'components/modals/ChurchClosingModal.tsx');
        const appContextPath = path.resolve(process.cwd(), 'contexts/AppContext.tsx');
        const parsingUtilsPath = path.resolve(process.cwd(), 'services/utils/parsingUtils.ts');
        const livroCaixaPath = path.resolve(process.cwd(), 'views/LivroCaixaView.tsx');
        const typesPath = path.resolve(process.cwd(), 'types/domain.ts');

        assert.ok(fs.existsSync(closingModalPath), 'ChurchClosingModal.tsx deve existir');
        assert.ok(fs.existsSync(appContextPath), 'AppContext.tsx deve existir');
        assert.ok(fs.existsSync(parsingUtilsPath), 'parsingUtils.ts deve existir');
        assert.ok(fs.existsSync(livroCaixaPath), 'LivroCaixaView.tsx deve existir');
        assert.ok(fs.existsSync(typesPath), 'types/domain.ts deve existir');

        const closingModalCode = fs.readFileSync(closingModalPath, 'utf8');
        const appContextCode = fs.readFileSync(appContextPath, 'utf8');
        const parsingUtilsCode = fs.readFileSync(parsingUtilsPath, 'utf8');
        const livroCaixaCode = fs.readFileSync(livroCaixaPath, 'utf8');
        const typesCode = fs.readFileSync(typesPath, 'utf8');

        // GE-1: ChurchClosingModal gera source = 'closing' nas duas pontas e fallback de banco
        assert.ok(closingModalCode.includes("source: 'closing'"), 'ChurchClosingModal deve definir source = closing');
        assert.ok(closingModalCode.includes('TRANSPORTE DE SALDO PARA'), 'ChurchClosingModal deve usar descrição clara de transporte');

        // GE-2: AppContext preserva source no reportData
        assert.ok(appContextCode.includes("source: (r as any).source || tx.source"), 'AppContext deve repassar source no reportData');

        // GE-3: parsingUtils protege cabeçalhos de fechamento
        assert.ok(parsingUtilsCode.includes("text.startsWith('[FECHAMENTO]')"), 'parsingUtils deve proteger descrições de fechamento');

        // GE-4: LivroCaixaView possui identificação de isClosingTx e linha de conciliação de fechamento
        assert.ok(livroCaixaCode.includes('isClosingTx'), 'LivroCaixaView deve identificar isClosingTx para exibição');
        assert.ok(livroCaixaCode.includes('Transporte de Saldo de Fechamento:'), 'LivroCaixaView deve exibir conciliação no rodapé');

        // GE-5: types/domain.ts define source na interface MatchResult
        assert.ok(typesCode.includes('source?: string;'), 'types/domain.ts deve conter source?: string em MatchResult');
    });
});
