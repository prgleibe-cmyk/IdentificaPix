
import { useState, useCallback, useEffect, useRef } from 'react';
import { Transaction } from '../types';
import { DateResolver } from '../core/processors/DateResolver';
import { AmountResolver } from '../core/processors/AmountResolver';
import { TypeResolver } from '../core/processors/TypeResolver';
import { NameResolver } from '../core/processors/NameResolver';
import { extractTransactionsWithModel, getRawStructuralDump } from '../services/geminiService';

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
    rawBase64?: string;
}

export const useSimulation = ({ gridData, activeMapping, cleaningKeywords, rawBase64 }: UseSimulationProps) => {
    const [processedTransactions, setProcessedTransactions] = useState<SafeTransaction[]>([]);
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editingRowData, setEditingRowData] = useState<SafeTransaction | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);
    
    const lastDataRef = useRef<string>('');
    const lastMappingRef = useRef<string>('');
    const initialReadDone = useRef<string | null>(null);

    const runSimulation = useCallback(async () => {
        if (!gridData || gridData.length === 0) {
            setProcessedTransactions([]);
            return;
        }

        const mapping = activeMapping || { extractionMode: 'COLUMNS' };
        const isBlockMode = mapping.extractionMode === 'BLOCK';

        // 🧱 MODO BLOCO (EXECUÇÃO IA)
        if (isBlockMode) {
            const isVisualDoc = gridData[0]?.[0] === '[DOCUMENTO_VISUAL]' || gridData[0]?.[0] === '[DOCUMENTO_PDF_VISUAL]';
            
            // FASE 1: Dump Bruto (Aguardando Ensino)
            if (isVisualDoc && !mapping.blockContract) {
                if (rawBase64 && initialReadDone.current !== rawBase64.substring(0, 100)) {
                    setIsSimulating(true);
                    try {
                        const rawLines = await getRawStructuralDump(rawBase64);
                        const mapped = rawLines.map((line: string, i: number) => ({
                            id: `raw-dump-${i}-${Date.now()}`,
                            date: "---",
                            description: line, 
                            rawDescription: line,
                            amount: 0,
                            originalAmount: "0.00",
                            isValid: false,
                            status: 'pending' as const,
                            sourceIndex: i,
                            sourceRawSnippet: [line]
                        }));
                        setProcessedTransactions(mapped);
                        initialReadDone.current = rawBase64.substring(0, 100);
                    } catch (e) {
                        console.error("[Simulation] Falha no dump bruto:", e);
                    } finally {
                        setIsSimulating(false);
                    }
                }
                return;
            }

            // FASE 2: Execução Real do Padrão Aprendido
            if (isVisualDoc && mapping.blockContract) {
                setIsSimulating(true);
                setProcessedTransactions([]); // Limpa preview para forçar refresh visual
                try {
                    console.log("[Simulation] EXECUÇÃO IMEDIATA DO PADRÃO...");
                    const aiResults = await extractTransactionsWithModel("", mapping.blockContract, rawBase64);
                    
                    const mapped = (aiResults || []).map((tx: any, i: number) => ({
                        id: `ai-extracted-${i}-${Date.now()}`,
                        date: tx.date || "---",
                        description: tx.description || "---",
                        rawDescription: tx.description || "",
                        amount: tx.amount || 0,
                        originalAmount: String(tx.amount || "0"),
                        isValid: true,
                        status: 'valid' as const,
                        sourceIndex: 0
                    }));

                    setProcessedTransactions(mapped);
                } catch (e) {
                    console.error("[Simulation] Falha na extração ensinada:", e);
                } finally {
                    setIsSimulating(false);
                }
                return;
            }
        }

        // 🚀 MODO COLUNAS (DETERMINÍSTICO)
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
    }, [gridData, activeMapping, cleaningKeywords, rawBase64]);

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
        processedTransactions, isSimulating, runSimulation, editingRowIndex, editingRowData, setEditingRowData,
        startEdit: (tx: any, idx: number) => { setEditingRowIndex(idx); setEditingRowData({ ...tx }); },
        saveRow: (onLearned?: (raw: string[], corrected: any) => void) => {
            if (editingRowIndex !== null && editingRowData) {
                const updatedTx = { ...editingRowData, status: 'edited' as const, isValid: true };
                if (onLearned) onLearned(updatedTx.sourceRawSnippet || [], updatedTx);
                setProcessedTransactions(prev => { const n = [...prev]; n[editingRowIndex] = updatedTx; return n; });
                setEditingRowIndex(null);
            }
        },
        cancelEdit: () => setEditingRowIndex(null)
    };
};
