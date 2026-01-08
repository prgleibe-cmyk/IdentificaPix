
import { ManualRow, MatchResult, Church, ColumnDef } from '../types';

export interface SortConfig {
    key: string;
    direction: 'asc' | 'desc';
}

export const analysisProcessor = {
    formatBRLInput: (value: number | undefined): string => {
        if (value === undefined || value === null) return '0,00';
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    parseBRLInput: (value: string): number => {
        const digits = value.replace(/\D/g, '');
        return parseInt(digits || '0') / 100;
    },

    sortRows: (rows: ManualRow[], sortConfig: SortConfig | null): ManualRow[] => {
        if (!sortConfig) return rows;
        
        const sorted = [...rows];
        sorted.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            
            if (sortConfig.key === 'balance') {
                valA = a.income - a.expense;
                valB = b.income - b.expense;
            }
            
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        return sorted;
    },

    calculateSummary: (rows: ManualRow[]) => {
        return rows.reduce((acc, row) => ({
            income: acc.income + (Number(row.income) || 0),
            expense: acc.expense + (Number(row.expense) || 0),
            qty: acc.qty + (Number(row.qty) || 0)
        }), { income: 0, expense: 0, qty: 0 });
    },

    /**
     * Processa e recupera os objetos de Igreja completos a partir de dados brutos ou parciais (IDs).
     * Essencial para quando o relatório vem do banco de dados (JSON) ou de estado incompleto.
     */
    hydrateMatchResults: (results: any[], churches: Church[]): MatchResult[] => {
        if (!Array.isArray(results)) return [];
        
        return results.map((r: any) => {
            // Tenta localizar ID da igreja em várias propriedades possíveis (legado vs novo)
            const savedChurchId = r.church?.id || r._churchId || (r.contributor && r.contributor._churchId);
            let completeChurch = r.church;
            
            // Se tiver um ID, tenta buscar o objeto atualizado na lista de igrejas do contexto
            if (savedChurchId) {
                const foundChurch = churches.find(c => c.id === savedChurchId);
                if (foundChurch) {
                    completeChurch = foundChurch;
                } else if (!completeChurch && (r._churchName || r.church?.name)) {
                    // Fallback: Reconstrói objeto igreja mínimo se tiver nome mas não estiver na lista
                    completeChurch = { id: savedChurchId, name: r._churchName || r.church.name, address: '', pastor: '', logoUrl: '' };
                }
            }
            
            // Garante que contributors também tenham referência correta se possível
            let contributor = r.contributor;
            if (contributor && completeChurch) {
                contributor = { ...contributor, church: completeChurch };
            }

            return { 
                ...r, 
                church: completeChurch || r.church || { id: 'unk', name: 'Desconhecida' }, 
                contributor: contributor,
                _injectedId: savedChurchId 
            };
        });
    },

    createEmptyRow: (columns: ColumnDef[]): ManualRow => {
        return {
            id: `row-${Date.now()}`,
            description: '',
            income: 0,
            expense: 0,
            qty: 0,
            ...columns.reduce((acc, col) => { if (col.removable) acc[col.id] = ''; return acc; }, {} as any)
        };
    },

    createDefaultColumns: (): ColumnDef[] => [
        { id: 'index', label: 'Item', type: 'index', editable: false, removable: false, visible: true },
        { id: 'description', label: 'Descrição', type: 'text', editable: true, removable: false, visible: true },
        { id: 'income', label: 'Entradas', type: 'currency', editable: true, removable: false, visible: true },
        { id: 'expense', label: 'Saídas', type: 'currency', editable: true, removable: false, visible: true },
        { id: 'balance', label: 'Saldo', type: 'computed', editable: false, removable: false, visible: true },
        { id: 'qty', label: 'Qtd', type: 'number', editable: true, removable: false, visible: true },
    ]
};
