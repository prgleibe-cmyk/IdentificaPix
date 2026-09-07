
import { MatchResult, Church, ManualRow, ColumnDef, Bank } from '../types';
import { analysisProcessor } from './analysisProcessor';

export interface RankingOptions {
    selectedChurchIds?: string[];
    selectedBankIds?: string[];
    banks?: Bank[];
}

export const rankingService = {
    generateRanking: (
        rawData: MatchResult[], 
        churches: Church[], 
        reportName: string,
        options?: RankingOptions
    ): { rows: ManualRow[], columns: ColumnDef[], title: string } => {
        // 1. HIDRATAÇÃO OBRIGATÓRIA: Garante que os dados tenham referências de Igreja corretas
        // Isso resolve o problema de relatórios salvos que vêm sem os objetos completos.
        const data = analysisProcessor.hydrateMatchResults(rawData, churches);
        
        const selectedChurchIds = options?.selectedChurchIds && options.selectedChurchIds.length > 0
            ? options.selectedChurchIds
            : null;

        const selectedBankIds = options?.selectedBankIds && options.selectedBankIds.length > 0
            ? options.selectedBankIds
            : null;

        const stats = new Map<string, { id: string, name: string, income: number, expense: number, count: number }>();

        // Se houver congregações especificamente selecionadas, inicializamos para que constem no ranking mesmo com 0 movimentações
        if (selectedChurchIds) {
            for (const cId of selectedChurchIds) {
                const found = churches.find(c => c.id === cId);
                if (found) {
                    stats.set(found.id, { id: found.id, name: found.name, income: 0, expense: 0, count: 0 });
                }
            }
        }
            
        for (const row of data) {
            // Verifica divisões (splits) primeiro para detectar congregações vinculadas
            const splits = (Array.isArray(row.splits) && row.splits.length > 0)
                ? row.splits
                : (Array.isArray((row as any).raw?.splits) && (row as any).raw.splits.length > 0)
                    ? (row as any).raw.splits
                    : (Array.isArray((row as any).transaction?.splits) && (row as any).transaction.splits.length > 0)
                        ? (row as any).transaction.splits
                        : null;

            // Filtro de status permissivo (não descarta transações por caixa de texto)
            const statusUpper = String(row.status || '').toUpperCase();
            if (statusUpper === 'REJEITADO' || statusUpper === 'CANCELADO' || statusUpper === 'EXCLUIDO') continue;

            const hasValidChurch = Boolean(
                (row.church && row.church.id && row.church.id !== 'unidentified' && row.church.id !== 'unk') ||
                (row as any)._churchId ||
                (row as any).churchId ||
                (row.transaction as any)?.church_id ||
                (splits && splits.length > 0)
            );

            if (!hasValidChurch && statusUpper !== 'IDENTIFICADO' && statusUpper !== 'PENDENTE' && statusUpper !== 'CONFIRMADO') {
                continue;
            }

            // Filtro de Caixas / Bancos
            if (selectedBankIds) {
                const tx = (row.transaction || {}) as any;
                const rowBankId = tx.bank_id || tx.bankId || (row as any).bank_id || (row as any).bankId || (row as any)._bankId || (row as any).bank?.id || '';
                const rowBankName = (row as any).bankName || (row as any).bank?.name || (row as any).bank?.account_name || tx.bankName || tx.bank_name || '';
                const isCash = !rowBankId || tx.paymentMethod === 'DINHEIRO' || tx.payment_method === 'DINHEIRO' || tx.forma === 'DINHEIRO' || (row as any).paymentMethod === 'DINHEIRO' || (row as any).forma === 'DINHEIRO';

                const matchesBank = selectedBankIds.some(bId => {
                    if (bId === 'sem_banco' || bId === 'caixa_fisico' || bId === 'none') {
                        return isCash;
                    }
                    if (rowBankId && String(rowBankId).toLowerCase() === String(bId).toLowerCase()) return true;
                    if (options?.banks) {
                        const bObj = options.banks.find((b: any) => b.id === bId);
                        if (bObj) {
                            const bName = (bObj.account_name || bObj.name || '').toLowerCase();
                            if (rowBankName && rowBankName.toLowerCase() === bName) return true;
                            if (bObj.bank_key && tx.description && String(tx.description).toLowerCase().includes(bObj.bank_key.toLowerCase())) return true;
                        }
                    }
                    return false;
                });

                if (!matchesBank) continue;
            }

            // Tratamento de divisões (splits / rateio) se existirem
            if (splits && splits.length > 0) {
                for (const split of splits) {
                    const splitChurchId = split.churchId || split.church_id || row.church?.id || (row as any)._churchId || (row as any).churchId;
                    if (!splitChurchId || splitChurchId === 'unidentified' || splitChurchId === 'placeholder' || splitChurchId === 'unk') continue;

                    // Filtro de Igreja nas divisões
                    if (selectedChurchIds && !selectedChurchIds.includes(splitChurchId)) continue;

                    const splitChurchName = split.churchName || split.church_name || churches.find(c => c.id === splitChurchId)?.name || 'Igreja Desconhecida';

                    if (!stats.has(splitChurchId)) {
                        stats.set(splitChurchId, { id: splitChurchId, name: splitChurchName, income: 0, expense: 0, count: 0 });
                    }

                    const entry = stats.get(splitChurchId)!;
                    entry.count++;
                    const splitAmount = Number(split.amount) || 0;
                    const isBaseExpense = (row as any).type === 'expense' ||
                        Number((row.transaction || {}).amount) < 0 ||
                        splitAmount < 0 ||
                        String(split.contributionType || '').toLowerCase().includes('saida') ||
                        String(split.contributionType || '').toLowerCase().includes('saída');

                    const absVal = Math.abs(splitAmount);
                    if (isBaseExpense) {
                        entry.expense += absVal;
                    } else {
                        entry.income += absVal;
                    }
                }
                continue;
            }

            // Linha regular sem divisões
            const church = row.church;
            let cId = church?.id || (row as any)._churchId || (row as any).churchId || (row.transaction as any)?.church_id;
            let cName = church?.name || (row as any)._churchName || (row as any).churchName;

            if (!cId || cId === 'unidentified' || cId === 'placeholder' || cId === 'unk') continue;

            // Filtro de Igreja
            if (selectedChurchIds && !selectedChurchIds.includes(cId)) continue;

            if (!cName) {
                const found = churches.find(c => c.id === cId);
                cName = found?.name || 'Igreja Desconhecida';
            }

            if (!stats.has(cId)) {
                stats.set(cId, { id: cId, name: cName, income: 0, expense: 0, count: 0 });
            }
            
            const entry = stats.get(cId)!;
            entry.count++;
            
            let amount = 0;
            // Prioridade de valor: Transação Real > Valor Esperado (Contribuinte) > val / amount
            if (row.transaction && Math.abs(Number(row.transaction.amount)) > 0) {
                amount = Number(row.transaction.amount);
            } else if (row.contributorAmount) {
                amount = Number(row.contributorAmount);
            } else if (row.contributor && row.contributor.amount) {
                amount = Number(row.contributor.amount);
            } else if ((row as any).val || (row as any).amount) {
                amount = Number((row as any).val || (row as any).amount);
            }
            
            const safeAmount = Number(amount) || 0;
            const isRowExpense = (row as any).type === 'expense' ||
                safeAmount < 0 ||
                String((row.transaction || {}).type || '').toLowerCase() === 'expense' ||
                String((row.transaction || {}).type || '').toLowerCase() === 'saida' ||
                String((row as any).category || (row as any).contributionType || '').toLowerCase().includes('saida') ||
                String((row as any).category || (row as any).contributionType || '').toLowerCase().includes('saída');

            const absVal = Math.abs(safeAmount);
            if (isRowExpense) {
                entry.expense += absVal;
            } else {
                entry.income += absVal;
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

        let title = reportName ? `Ranking: ${reportName}` : 'Ranking Geral (Sessão Atual)';
        const filterParts: string[] = [];

        if (selectedChurchIds) {
            if (selectedChurchIds.length === 1) {
                const cName = churches.find(c => c.id === selectedChurchIds[0])?.name || '1 Igreja';
                filterParts.push(cName);
            } else if (selectedChurchIds.length < churches.length) {
                filterParts.push(`${selectedChurchIds.length} Igrejas`);
            }
        }

        if (selectedBankIds) {
            if (selectedBankIds.length === 1) {
                const bId = selectedBankIds[0];
                const bName = (bId === 'sem_banco' || bId === 'caixa_fisico')
                    ? 'Caixa Físico'
                    : (options?.banks?.find(b => b.id === bId)?.account_name || options?.banks?.find(b => b.id === bId)?.name || '1 Caixa');
                filterParts.push(bName);
            } else if (options?.banks && selectedBankIds.length < options.banks.length) {
                filterParts.push(`${selectedBankIds.length} Caixas`);
            }
        }

        if (filterParts.length > 0) {
            title += ` (${filterParts.join(' • ')})`;
        }

        return { rows, columns, title };
    }
};
