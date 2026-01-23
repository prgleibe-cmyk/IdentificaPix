
import { useState, useCallback } from 'react';
import { extractStructuredDataByExample } from '../services/geminiService';
import { FileModel, Transaction } from '../types';

export interface LearningPackage {
    model: Partial<FileModel>;
    sampleTransactions: Transaction[];
    confidence: number;
}

interface UseAIPatternTeacherProps {
    gridData: string[][];
    setGridData: (data: string[][]) => void;
    setActiveMapping: (mapping: any) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

export const useAIPatternTeacher = ({
    gridData,
    setGridData,
    setActiveMapping,
    showToast
}: UseAIPatternTeacherProps) => {
    const [isInferringMapping, setIsInferringMapping] = useState(false);
    const [learnedPatternSource, setLearnedPatternSource] = useState<{ originalRaw: string[], corrected: any } | null>(null);

    /**
     * APLICAR PADRÃO (V16):
     * Refinado para aprender REGRAS DE TRANSFORMAÇÃO (Sanitização de descrição).
     */
    const handleApplyCorrectionPattern = useCallback(async (): Promise<LearningPackage | null> => {
        if (!learnedPatternSource || gridData.length === 0) return null;
        
        console.log("[Learn:AI] Iniciando aprendizado de transformação...");
        setIsInferringMapping(true);

        try {
            const { originalRaw, corrected } = learnedPatternSource;
            
            // Contexto amplo para detectar vizinhança e padrões repetitivos
            const rawSnippet = gridData.slice(0, 350).map(row => row.join(';')).join('\n');
            
            const userExample = `O usuário definiu um PADRÃO DE REFINAMENTO MANUAL.
               
               REGRA DE OURO (EXEMPLO DO USUÁRIO):
               1. LINHA BRUTA ORIGINAL DO EXTRATO: [${originalRaw.join(' | ')}]
               2. RESULTADO DESEJADO (DESCRIÇÃO LIMPA): "${corrected.cleanedDescription}"
               
               DEDUZA A REGRA:
               - Observe que o usuário removeu ruídos como prefixos bancários, códigos ou palavras repetitivas.
               - O objetivo é extrair APENAS o nome limpo do pagador/contribuinte.
               - Aplique esta mesma lógica de 'LIMPEZA CIRÚRGICA' em todas as outras transações do documento.
               - Se houver blocos multi-linha, agrupe-os e extraia o nome conforme o exemplo acima.
               - Retorne o mapeamento e a nova grade de dados.`;
            
            const result = await extractStructuredDataByExample(rawSnippet, userExample);
            
            if (result && result.rows && result.rows.length > 0) {
                console.log(`[Learn:AI] Padrão aprendido! ${result.rows.length} linhas refinadas.`);

                // 1. Atualiza a grade com a limpeza aplicada pela IA
                const reStructuredGrid = result.rows.map((r: any) => [
                    String(r.date || ''), 
                    String(r.description || ''), 
                    String(r.amount || '0'),
                    String(r.type || 'AUTO'),
                    String(r.paymentMethod || 'OUTROS')
                ]);

                setGridData(reStructuredGrid);
                
                // 2. Trava o mapeamento para formato fixo pós-IA
                const mapping = { 
                    dateColumnIndex: 0, 
                    descriptionColumnIndex: 1, 
                    amountColumnIndex: 2, 
                    typeColumnIndex: 3,
                    paymentMethodColumnIndex: 4,
                    extractionMode: 'COLUMNS' as const,
                    skipRowsStart: 0,
                    skipRowsEnd: 0,
                    decimalSeparator: '.' as const,
                    thousandsSeparator: '' as const
                };

                setActiveMapping(mapping);
                showToast("Inteligência de refinamento aplicada com sucesso!", "success");
                setLearnedPatternSource(null); 

                return {
                    model: { mapping },
                    sampleTransactions: [], 
                    confidence: 1.0
                };
            }
            
            showToast("Não foi possível generalizar o refinamento. Verifique se o exemplo está claro.", "error");
            return null;

        } catch (e: any) { 
            console.error("[Learn:FAIL]", e);
            showToast("Erro técnico ao processar refinamento.", "error"); 
            return null;
        } finally { 
            setIsInferringMapping(false); 
        }
    }, [learnedPatternSource, gridData, setGridData, setActiveMapping, showToast]);

    return {
        isInferringMapping,
        learnedPatternSource,
        setLearnedPatternSource,
        handleApplyCorrectionPattern
    };
};
