
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

        const mapping = activeMapping || { extractionMode: 'BLOCK' };
        const isManualMappingComplete = mapping.dateColumnIndex >= 0 && mapping.amountColumnIndex >= 0;

        // MODO BLOCO INICIAL (INSTANTÂNEO): Apenas mostra as linhas como estão
        if (mapping.extractionMode === 'BLOCK' && !isManualMappingComplete) {
            // Desativamos qualquer sinal de "IA pensando" aqui para ser imediato
            const initialPreview = gridData.slice(0, 100).map((row, i) => ({
                id: `raw-${i}-${Date.now()}`,
                date: "---",
                description: row.join(' ').substring(0, 150),
                rawDescription: row.join(';'),
                amount: 0,
                originalAmount: "0.00",
                isValid: false,
                status: 'pending' as const,
                sourceIndex: i
            }));
            setProcessedTransactions(initialPreview);
            setIsSimulating(false);
        } 
        // MODO ESTRUTURADO (DETERMINÍSTICO): Aplica regras de colunas
        else {
            setIsSimulating(true);
            const { dateColumnIndex, descriptionColumnIndex, amountColumnIndex, paymentMethodColumnIndex, skipRowsStart } = mapping;
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
                const finalDesc = rawDesc.trim();

                newTransactions.push({ 
                    id: `sim-${index}-${Date.now()}`,
                    date: isoDate || rawDate || "---", 
                    description: finalDesc, 
                    rawDescription: rawDesc || "---", 
                    paymentMethod: (paymentMethodColumnIndex !== undefined && paymentMethodColumnIndex >= 0 && cols[paymentMethodColumnIndex]) ? cols[paymentMethodColumnIndex] : TypeResolver.resolveFromDescription(rawDesc),
                    amount: isNaN(amountValue) ? 0 : amountValue, 
                    originalAmount: rawAmount, 
                    cleanedDescription: finalDesc, 
                    contributionType: 'AUTO', 
                    sourceIndex: index, 
                    isValid: !!isoDate && !isNaN(amountValue), 
                    status: isSkipped ? 'ignored' : 'valid'
                });
            });
            setProcessedTransactions(newTransactions);
            setIsSimulating(false);
        }
    }, [gridData, activeMapping]);

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
                
                if (onLearned) {
                    const rawLines = (updatedTx as any).sourceRawSnippet || 
                                     (updatedTx.sourceIndex !== undefined ? gridData[updatedTx.sourceIndex] : []);
                    onLearned(rawLines, updatedTx);
                }

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
