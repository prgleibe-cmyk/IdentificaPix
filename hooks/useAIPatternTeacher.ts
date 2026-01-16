
import { useState, useCallback } from 'react';
import { extractStructuredDataByExample } from '../services/geminiService';

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

    const handleApplyCorrectionPattern = useCallback(async () => {
        if (!learnedPatternSource) return;
        setIsInferringMapping(true);
        try {
            const { originalRaw, corrected } = learnedPatternSource;
            const rawSnippet = gridData.slice(0, 500).map(row => row.join(';')).join('\n');
            const userExample = `RAW: [${originalRaw.join('|')}] -> DATA: ${corrected.date}, DESC: ${corrected.cleanedDescription}, VAL: ${corrected.amount}`;
            
            const result = await extractStructuredDataByExample(rawSnippet, userExample);
            
            if (result?.rows?.length > 0) {
                setGridData(result.rows.map((r: any) => [
                    r.date || '', 
                    r.description || '', 
                    r.amount ? String(r.amount) : '', 
                    r.reference || ''
                ]));
                setActiveMapping({ 
                    dateColumnIndex: 0, 
                    descriptionColumnIndex: 1, 
                    amountColumnIndex: 2, 
                    typeColumnIndex: 3, 
                    skipRowsStart: 0 
                });
                setLearnedPatternSource(null); 
                showToast("Inteligência artificial aprendeu o novo padrão!", "success");
            }
        } catch (e: any) { 
            showToast("Falha ao processar padrão: " + e.message, "error"); 
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
