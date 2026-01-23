
import { useState, useCallback, useEffect, useRef } from 'react';
import { Transaction } from '../types';
import { DateResolver } from '../core/processors/DateResolver';
import { AmountResolver } from '../core/processors/AmountResolver';
import { TypeResolver } from '../core/processors/TypeResolver';
import { extractTransactionsFromComplexBlock } from '../services/geminiService';

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

    const runSimulation = useCallback(async () => {
        if (!gridData || gridData.length === 0) {
            setProcessedTransactions([]);
            return;
        }

        const mapping = activeMapping || { extractionMode: 'COLUMNS', dateColumnIndex: -1, descriptionColumnIndex: -1, amountColumnIndex: -1, skipRowsStart: 0 };
        setIsSimulating(true);

        try {
            if (mapping.extractionMode === 'BLOCK') {
                const textForAi = gridData.slice(0, 1000).map(row => row.join(' ')).join('\n');
                const aiResult = await extractTransactionsFromComplexBlock(textForAi);
                
                if (aiResult && aiResult.length > 0) {
                    setProcessedTransactions(aiResult.map((tx, i) => ({
                        ...tx,
                        id: `block-sim-${i}-${Date.now()}`,
                        rawDescription: tx.description,
                        cleanedDescription: tx.description,
                        originalAmount: String(tx.amount),
                        contributionType: tx.type || '',
                        paymentMethod: tx.paymentMethod || '',
                        isValid: true,
                        status: 'valid'
                    })));
                } else {
                    setProcessedTransactions([]);
                }
            } else {
                const { dateColumnIndex, descriptionColumnIndex, amountColumnIndex, paymentMethodColumnIndex, skipRowsStart } = mapping;
                const newTransactions: SafeTransaction[] = [];
                const yearAnchor = DateResolver.discoverAnchorYear(gridData);
                
                gridData.forEach((cols, index) => {
                    const isSkipped = index < (skipRowsStart || 0);
                    
                    if (dateColumnIndex === -1 && descriptionColumnIndex === -1 && amountColumnIndex === -1) {
                        newTransactions.push({ 
                            id: `sim-raw-${index}`, 
                            date: "---", 
                            description: cols.join(' | ').substring(0, 80), 
                            rawDescription: cols.join('|'), 
                            amount: 0, 
                            originalAmount: "0.00", 
                            cleanedDescription: cols.join(' | '), 
                            contributionType: "", 
                            paymentMethod: "", 
                            sourceIndex: index, 
                            isValid: false, 
                            status: 'pending' 
                        });
                        return;
                    }

                    const rawDate = (dateColumnIndex !== -1 && cols[dateColumnIndex] !== undefined) ? (cols[dateColumnIndex] || '').trim() : '';
                    const rawDesc = (descriptionColumnIndex !== -1 && cols[descriptionColumnIndex] !== undefined) ? (cols[descriptionColumnIndex] || '').trim() : '';
                    const rawAmount = (amountColumnIndex !== -1 && cols[amountColumnIndex] !== undefined) ? (cols[amountColumnIndex] || '').trim() : '';

                    if (!rawDate && !rawDesc && !rawAmount) return;

                    const isoDate = DateResolver.resolveToISO(rawDate, yearAnchor) || rawDate;
                    const amountStr = AmountResolver.clean(rawAmount);
                    const amountValue = parseFloat(amountStr);
                    
                    newTransactions.push({ 
                        id: `sim-${index}-${Date.now()}`,
                        date: isoDate || rawDate || "---", 
                        description: rawDesc || "---", 
                        rawDescription: rawDesc || "---", 
                        paymentMethod: (paymentMethodColumnIndex !== undefined && cols[paymentMethodColumnIndex]) ? cols[paymentMethodColumnIndex] : TypeResolver.resolveFromDescription(rawDesc),
                        amount: isNaN(amountValue) ? 0 : amountValue, 
                        originalAmount: rawAmount, 
                        cleanedDescription: rawDesc, 
                        contributionType: 'AUTO', 
                        sourceIndex: index, 
                        isValid: true, 
                        status: isSkipped ? 'ignored' : 'valid'
                    });
                });
                setProcessedTransactions(newTransactions);
            }
        } catch (e) {
            console.error("Simulation error:", e);
        } finally {
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
            setEditingRowData({ 
                ...tx,
                contributionType: tx.contributionType || '',
                paymentMethod: tx.paymentMethod || ''
            }); 
        },
        saveRow: (onLearned?: any) => {
            if (editingRowIndex !== null && editingRowData) {
                const updatedTx = { ...editingRowData, status: 'edited' as const, isValid: true };
                setProcessedTransactions(prev => { const n = [...prev]; n[editingRowIndex] = updatedTx; return n; });
                if (onLearned && editingRowData.sourceIndex !== undefined) onLearned(gridData[editingRowData.sourceIndex], updatedTx);
                setEditingRowIndex(null);
            }
        },
        cancelEdit: () => setEditingRowIndex(null)
    };
};
