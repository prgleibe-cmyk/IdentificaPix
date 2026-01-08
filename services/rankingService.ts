
import { MatchResult, Church, ManualRow, ColumnDef } from '../types';
import { analysisProcessor } from './analysisProcessor';

export const rankingService = {
    generateRanking: (rawData: MatchResult[], churches: Church[], reportName: string): { rows: ManualRow[], columns: ColumnDef[], title: string } => {
        // 1. HIDRATAÇÃO OBRIGATÓRIA: Garante que os dados tenham referências de Igreja corretas
        // Isso resolve o problema de relatórios salvos que vêm sem os objetos completos.
        const data = analysisProcessor.hydrateMatchResults(rawData, churches);
        
        const stats = new Map<string, { id: string, name: string, income: number, expense: number, count: number }>();
            
        for (const row of data) {
            // Filtra apenas identificados ou pendentes (que têm vínculo com igreja)
            if (row.status !== 'IDENTIFICADO' && row.status !== 'PENDENTE') continue;

            // A hidratação acima garante que row.church esteja populado se possível
            const church = row.church;
            let cId = church?.id;
            let cName = church?.name;

            if (!cId || cId === 'unidentified' || cId === 'placeholder' || cId === 'unk') continue;

            cName = cName || 'Igreja Desconhecida';

            if(!stats.has(cId)) {
                stats.set(cId, { id: cId, name: cName, income: 0, expense: 0, count: 0 });
            }
            
            const entry = stats.get(cId)!;
            entry.count++;
            
            let amount = 0;
            // Prioridade de valor: Transação Real > Valor Esperado (Contribuinte)
            if (row.transaction && Math.abs(row.transaction.amount) > 0) {
                amount = row.transaction.amount;
            } else if (row.contributorAmount) {
                amount = row.contributorAmount;
            } else if (row.contributor && row.contributor.amount) {
                amount = row.contributor.amount;
            }
            
            const safeAmount = Number(amount) || 0;

            if (safeAmount > 0) {
                entry.income += safeAmount;
            } else {
                entry.expense += Math.abs(safeAmount);
            }
        }
        
        const result = Array.from(stats.values())
            .map(item => ({...item, balance: item.income - item.expense}))
            .sort((a,b) => b.balance - a.balance); // Ordena por saldo maior
            
        const columns: ColumnDef[] = [
            { id: 'index', label: 'Pos', type: 'index', editable: false, removable: false, visible: true },
            { id: 'description', label: 'Igreja / Congregação', type: 'text', editable: true, removable: false, visible: true },
            { id: 'income', label: 'Entradas', type: 'currency', editable: true, removable: false, visible: true },
            { id: 'expense', label: 'Saídas', type: 'currency', editable: true, removable: false, visible: true },
            { id: 'balance', label: 'Saldo', type: 'computed', editable: false, removable: false, visible: true },
            { id: 'qty', label: 'Qtd', type: 'number', editable: true, removable: false, visible: true },
        ];

        const rows: ManualRow[] = result.map(r => ({
            id: r.id,
            description: r.name,
            income: r.income,
            expense: r.expense,
            qty: r.count
        }));

        const title = reportName ? `Ranking: ${reportName}` : 'Ranking Geral (Sessão Atual)';

        return { rows, columns, title };
    }
};
