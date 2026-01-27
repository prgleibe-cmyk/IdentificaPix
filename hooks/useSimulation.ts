
import { useState, useCallback, useEffect, useRef } from 'react';
import { Transaction } from '../types';
import { DateResolver } from '../core/processors/DateResolver';
import { AmountResolver } from '../core/processors/AmountResolver';
import { TypeResolver } from '../core/processors/TypeResolver';
import { NameResolver } from '../core/processors/NameResolver';

interface SafeTransaction extends Transaction {
    sourceIndex?: number;
    isValid?: boolean;
    status?: 'valid' | 'error' | 'edited' | 'ignored' | 'pending';
    sourceRawSnippet?: string[];
}

interface UseSimulationProps {
    gridData: string[][];
    activeMapping: any;
    cleaningKeywords: string[];
}

export const useSimulation = ({ gridData, activeMapping, cleaningKeywords }: UseSimulationProps) => {
    const [processedTransactions, setProcessedTransactions] = useState<SafeTransaction[]>([]);
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editingRowData, setEditingRowData] = useState<SafeTransaction | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);
    
    const lastDataRef = useRef<string>('');
    const lastMappingRef = useRef<string>('');

    const runSimulation = useCallback(() => {
        if (!gridData || gridData.length === 0) {
            setProcessedTransactions([]);
            return;
        }

        const mapping = activeMapping || { extractionMode: 'COLUMNS' };
        const isBlockMode = mapping.extractionMode === 'BLOCK';

        // MODO BLOCO (SIMULAÇÃO POR JANELA DE CONTEXTO)
        if (isBlockMode) {
            setIsSimulating(true);
            // Na simulação, cada linha é um ponto de entrada, mas carrega as próximas 12 linhas como contexto
            const blockPreview = gridData.map((row, i) => {
                const text = row.join(' ').trim();
                // Captura a linha atual + 11 linhas seguintes para o "Teacher" ver o bloco todo
                const contextWindow = gridData.slice(i, i + 12).map(r => r.join(' '));
                
                return {
                    id: `sim-block-${i}-${Date.now()}`,
                    date: "---", 
                    description: text, 
                    rawDescription: text,
                    amount: 0,
                    originalAmount: "---",
                    isValid: true,
                    status: 'pending' as const,
                    sourceIndex: i,
                    sourceRawSnippet: contextWindow
                };
            }).filter(b => b.description.length > 2).slice(0, 100);

            setProcessedTransactions(blockPreview);
            setIsSimulating(false);
            return;
        }

        // MODO COLUNAS (DETERMINÍSTICO)
        const isManualMappingComplete = mapping.dateColumnIndex >= 0 && mapping.amountColumnIndex >= 0;

        if (!isManualMappingComplete) {
            const initialPreview = gridData.slice(0, 100).map((row, i) => ({
                id: `raw-${i}-${Date.now()}`,
                date: "---",
                description: row.join(' ').substring(0, 150),
                rawDescription: row.join(';'),
                amount: 0,
                originalAmount: "0.00",
                isValid: false,
                status: 'pending' as const,
                sourceIndex: i,
                sourceRawSnippet: row
            }));
            setProcessedTransactions(initialPreview);
            return;
        }

        setIsSimulating(true);
        const { dateColumnIndex, descriptionColumnIndex, amountColumnIndex, paymentMethodColumnIndex, skipRowsStart, ignoredKeywords } = mapping;
        const newTransactions: SafeTransaction[] = [];
        const yearAnchor = DateResolver.discoverAnchorYear(gridData);

        gridData.forEach((cols, index) => {
            const isSkipped = index < (skipRowsStart || 0);
            const rawDate = dateColumnIndex >= 0 ? (cols[dateColumnIndex] || '') : '';
            const rawDesc = descriptionColumnIndex >= 0 ? (cols[descriptionColumnIndex] || '') : '';
            const rawAmount = amountColumnIndex >= 0 ? (cols[amountColumnIndex] || '') : '';

            if (!rawDate && !rawDesc && !rawAmount) return;

            const isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);
            const amountStr = AmountResolver.clean(rawAmount);
            const amountValue = parseFloat(amountStr);
            const cleanedName = NameResolver.clean(rawDesc, ignoredKeywords || [], cleaningKeywords);

            newTransactions.push({ 
                id: `sim-${index}-${Date.now()}`,
                date: isoDate || rawDate || "---", 
                description: cleanedName, 
                rawDescription: rawDesc || "---", 
                paymentMethod: (paymentMethodColumnIndex !== undefined && paymentMethodColumnIndex >= 0 && cols[paymentMethodColumnIndex]) ? cols[paymentMethodColumnIndex] : TypeResolver.resolveFromDescription(rawDesc),
                amount: isNaN(amountValue) ? 0 : amountValue, 
                originalAmount: rawAmount, 
                cleanedDescription: cleanedName, 
                contributionType: 'AUTO', 
                sourceIndex: index, 
                sourceRawSnippet: cols,
                isValid: !!isoDate && !isNaN(amountValue), 
                status: isSkipped ? 'ignored' : 'valid'
            });
        });
        setProcessedTransactions(newTransactions);
        setIsSimulating(false);
    }, [gridData, activeMapping, cleaningKeywords]);

    useEffect(() => {
        const dataHash = gridData.length > 0 ? `${gridData.length}-${gridData[0].join('|').substring(0, 50)}` : 'empty';
        const mappingKey = JSON.stringify(activeMapping);
        if (dataHash !== lastDataRef.current || mappingKey !== lastMappingRef.current) {
            lastDataRef.current = dataHash;
            lastMappingRef.current = mappingKey;
            runSimulation();
        }
    }, [gridData, activeMapping, runSimulation]);

    return {
        processedTransactions,
        isSimulating,
        runSimulation,
        editingRowIndex,
        editingRowData,
        setEditingRowData,
        startEdit: (tx: any, idx: number) => { 
            setEditingRowIndex(idx); 
            setEditingRowData({ ...tx }); 
        },
        saveRow: (onLearned?: (raw: string[], corrected: any) => void) => {
            if (editingRowIndex !== null && editingRowData) {
                const updatedTx = { ...editingRowData, status: 'edited' as const, isValid: true };
                if (onLearned) onLearned(updatedTx.sourceRawSnippet || [], updatedTx);
                setProcessedTransactions(prev => { 
                    const n = [...prev]; 
                    n[editingRowIndex] = updatedTx; 
                    return n; 
                });
                setEditingRowIndex(null);
            }
        },
        cancelEdit: () => setEditingRowIndex(null)
    };
};
