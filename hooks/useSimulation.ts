
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

/**
 * @frozen-block: SIMULATION_INTEGRITY_LIMITER_V2
 * BLOCO PROTEGIDO CONTRA REGRESSÃO.
 * Este hook gerencia a simulação no Laboratório garantindo que o fatiamento 
 * e a aplicação de contrato respeitem o limite de 50 registros e usem campos estruturados.
 */
export const useSimulation = ({ gridData, activeMapping, cleaningKeywords, rawBase64 }: UseSimulationProps) => {
    const [processedTransactions, setProcessedTransactions] = useState<SafeTransaction[]>([]);
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editingRowData, setEditingRowData] = useState<SafeTransaction | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);
    
    const lastDataHashRef = useRef<string>('');
    const lastMappingRef = useRef<string>('');
    const lastContractRef = useRef<string | undefined>(undefined);
    const initialReadDone = useRef<string | null>(null);
    const isRunningRef = useRef(false);
    
    const semanticBlocksRef = useRef<string[]>([]);

    const runSimulation = useCallback(async () => {
        if (!gridData || gridData.length === 0 || isRunningRef.current) {
            if (!gridData || gridData.length === 0) setProcessedTransactions([]);
            return;
        }

        const mapping = activeMapping || { extractionMode: 'COLUMNS' };
        const isBlockMode = mapping.extractionMode === 'BLOCK';
        isRunningRef.current = true;

        // 🧱 MODO BLOCO (EXTRAÇÃO POR FATIAMENTO SEMÂNTICO IA)
        if (isBlockMode) {
            const isVisualDoc = gridData[0]?.[0] && (gridData[0][0] === '[DOCUMENTO_VISUAL]' || gridData[0][0] === '[DOCUMENTO_PDF_VISUAL]');
            
            // FASE 1: Geração de Blocos Semânticos (Visualização Bruta apenas para Grid)
            if (isVisualDoc && !mapping.blockContract) {
                const fileIdentifier = rawBase64 ? rawBase64.substring(0, 100) : 'empty';
                if (rawBase64 && initialReadDone.current !== fileIdentifier) {
                    setIsSimulating(true);
                    try {
                        console.log("[Simulation] 🧠 INICIANDO FATIAMENTO SEMÂNTICO...");
                        const rawLines = await getRawStructuralDump(rawBase64);
                        semanticBlocksRef.current = rawLines;
                        
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
                        setProcessedTransactions(mapped.slice(0, 50));
                        initialReadDone.current = fileIdentifier;
                        lastContractRef.current = undefined;
                    } catch (e) {
                        console.error("[Simulation] Falha no fatiamento semântico:", e);
                    } finally {
                        setIsSimulating(false);
                        isRunningRef.current = false;
                    }
                } else {
                    isRunningRef.current = false;
                }
                return;
            }

            // FASE 2: Aplicação do Padrão (Obediência ao Contrato Blindado)
            if (mapping.blockContract) {
                const contractChanged = mapping.blockContract !== lastContractRef.current;
                const fileIdentifier = rawBase64 ? rawBase64.substring(0, 100) : 'snippet-only';
                const fileChanged = initialReadDone.current !== fileIdentifier;

                if (contractChanged || fileChanged) {
                    setIsSimulating(true);
                    try {
                        console.log("[Simulation] 🎯 EXECUTANDO CONTRATO RÍGIDO (LIMITE 50 REGISTROS)...");
                        
                        const rawText = gridData.map(r => r.join(';')).join('\n');
                        
                        // PARIDADE V54: Removido semanticBlocksRef para evitar mistura de texto bruto
                        const aiResults = await extractTransactionsWithModel(
                            rawText, 
                            mapping.blockContract, 
                            rawBase64, 
                            50 
                        );
                        
                        const rows = Array.isArray(aiResults) ? aiResults : (aiResults?.rows || []);

                        if (rows && rows.length > 0) {
                            const mapped = rows.map((tx: any, i: number) => ({
                                id: `ai-extracted-${i}-${Date.now()}`,
                                date: tx.date || "---",
                                description: tx.description || "---",
                                rawDescription: tx.description || "",
                                amount: tx.amount || 0,
                                originalAmount: String(tx.amount || "0"),
                                paymentMethod: tx.forma || tx.paymentMethod || 'OUTROS',
                                contributionType: tx.tipo || 'AUTO',
                                isValid: true,
                                status: 'valid' as const,
                                sourceIndex: 0
                            }));
                            setProcessedTransactions(mapped);
                            initialReadDone.current = fileIdentifier;
                            lastContractRef.current = mapping.blockContract;
                        } else {
                            console.warn("[Simulation] IA não retornou resultados válidos para o contrato.");
                        }
                    } catch (e) {
                        console.error("[Simulation] Falha na execução do contrato:", e);
                    } finally {
                        setIsSimulating(false);
                        isRunningRef.current = false;
                    }
                } else {
                    isRunningRef.current = false;
                }
                return;
            }
        }

        // 🚀 MODO COLUNAS (DETERMINÍSTICO)
        const isManualMappingComplete = mapping.dateColumnIndex >= 0 && mapping.amountColumnIndex >= 0;

        if (!isManualMappingComplete) {
            if (!isBlockMode) {
                const initialPreview = gridData.slice(0, 50).map((row, i) => ({
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
            }
            isRunningRef.current = false;
            return;
        }

        setIsSimulating(true);
        try {
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
            setProcessedTransactions(newTransactions.slice(0, 50));
            lastMappingRef.current = JSON.stringify(activeMapping);
        } finally {
            setIsSimulating(false);
            isRunningRef.current = false;
        }
    }, [gridData, activeMapping, cleaningKeywords, rawBase64]);

    useEffect(() => {
        const dataHash = gridData.length > 0 
            ? `${gridData.length}-${gridData[0].join('|').substring(0, 50)}` 
            : 'empty';
            
        const mappingKey = JSON.stringify(activeMapping);
        
        if (dataHash !== lastDataHashRef.current || mappingKey !== lastMappingRef.current) {
            lastDataHashRef.current = dataHash;
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
