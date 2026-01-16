
import { useState, useCallback, useEffect } from 'react';
import { Transaction } from '../types';
import { DateResolver } from '../core/processors/DateResolver';
import { AmountResolver } from '../core/processors/AmountResolver';
import { NameResolver } from '../core/processors/NameResolver';
import { TypeResolver } from '../core/processors/TypeResolver';
import { RowValidator } from '../core/processors/RowValidator';

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

    const runSimulation = useCallback(() => {
        if (!gridData.length) return;

        const { dateColumnIndex, descriptionColumnIndex, amountColumnIndex, typeColumnIndex, skipRowsStart } = activeMapping || {
            dateColumnIndex: -1, descriptionColumnIndex: -1, amountColumnIndex: -1, skipRowsStart: 0
        };

        const newTransactions: SafeTransaction[] = [];
        const yearAnchor = new Date().getFullYear();
        
        gridData.forEach((cols, index) => {
            if (!RowValidator.isPotentialRow(cols)) return;
            
            const isSkipped = index < (skipRowsStart || 0);
            const rawDate = cols[dateColumnIndex] || '';
            const rawDesc = cols[descriptionColumnIndex] || '';
            const rawAmount = cols[amountColumnIndex] || '';
            const rawType = typeColumnIndex !== undefined ? cols[typeColumnIndex] : '';
            
            let isoDate = '', amount = 0, cleanedDesc = rawDesc, finalType = rawType, isValid = false, status: SafeTransaction['status'] = 'pending';
            
            if (isSkipped) { 
                status = 'ignored'; 
            } else if (activeMapping) {
                isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);
                amount = parseFloat(AmountResolver.clean(rawAmount));
                
                if (!!isoDate && isoDate.length >= 10 && !isNaN(amount) && rawDesc.trim().length > 0) {
                    cleanedDesc = NameResolver.clean(rawDesc, cleaningKeywords);
                    finalType = rawType ? rawType.trim().toUpperCase() : TypeResolver.resolveFromDescription(rawDesc);
                    isValid = true; 
                    status = 'valid';
                } else if (!isNaN(amount) || rawDesc.trim().length > 0) { 
                    status = 'pending'; 
                    cleanedDesc = NameResolver.clean(rawDesc, cleaningKeywords); 
                }
            } else { 
                cleanedDesc = cols.join(' | '); 
            }
            
            newTransactions.push({ 
                id: `sim-${index}`, 
                date: isValid ? isoDate : rawDate, 
                description: rawDesc, 
                rawDescription: rawDesc, 
                amount, 
                originalAmount: rawAmount, 
                cleanedDescription: cleanedDesc, 
                contributionType: finalType, 
                sourceIndex: index, 
                isValid, 
                status 
            });
        });

        setProcessedTransactions(newTransactions);
    }, [gridData, activeMapping, cleaningKeywords]);

    // Roda simulação sempre que os dados ou mapeamento mudarem
    useEffect(() => {
        if (gridData.length > 0) runSimulation();
    }, [activeMapping, gridData, runSimulation]);

    const startEdit = (tx: SafeTransaction, idx: number) => {
        setEditingRowIndex(idx);
        setEditingRowData({ ...tx });
    };

    const saveRow = (onLearned?: (original: string[], corrected: SafeTransaction) => void) => {
        if (editingRowIndex !== null && editingRowData) {
            setProcessedTransactions(prev => {
                const n = [...prev];
                n[editingRowIndex] = { ...editingRowData, status: 'edited', isValid: true };
                return n;
            });
            
            if (onLearned) {
                onLearned(gridData[editingRowData.sourceIndex!], editingRowData);
            }
            setEditingRowIndex(null);
        }
    };

    const cancelEdit = () => setEditingRowIndex(null);

    return {
        processedTransactions,
        setProcessedTransactions,
        runSimulation,
        editingRowIndex,
        editingRowData,
        setEditingRowData,
        startEdit,
        saveRow,
        cancelEdit
    };
};
