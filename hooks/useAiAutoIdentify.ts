
import { useCallback } from 'react';
import { ReconciliationStatus, MatchMethod, MatchResult } from '../types';
import { strictNormalize, groupResultsByChurch } from '../services/processingService';

interface UseAiAutoIdentifyProps {
    reconciliation: any;
    referenceData: any;
    effectiveIgnoreKeywords: string[];
    setIsLoading: (loading: boolean) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    onAfterIdentification?: (results: MatchResult[]) => void;
}

const getSimilarityScore = (s1: string, s2: string): number => {
    if (s1 === s2) return 100;
    const set1 = new Set();
    for (let i = 0; i < s1.length - 1; i++) set1.add(s1.substring(i, i + 2));
    const set2 = new Set();
    for (let i = 0; i < s2.length - 1; i++) set2.add(s2.substring(i, i + 2));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    return (2.0 * intersection.size) / (set1.size + set2.size) * 100;
};

export const useAiAutoIdentify = ({
    reconciliation,
    referenceData,
    setIsLoading,
    showToast,
    onAfterIdentification
}: UseAiAutoIdentifyProps) => {
    
    const runAiAutoIdentification = useCallback(() => {
        const { matchResults, setMatchResults, setReportPreviewData } = reconciliation;
        const { learnedAssociations, churches } = referenceData;

        if (!matchResults || matchResults.length === 0) return;
        
        setIsLoading(true);
        let identifiedCount = 0;
        
        console.log(`[AI-RECON] Iniciando busca em ${matchResults.length} linhas. Associações aprendidas: ${learnedAssociations.length}`);

        const nextResults = matchResults.map((res: MatchResult) => {
            if (res.status === ReconciliationStatus.UNIDENTIFIED) {
                const currentTxDna = strictNormalize(res.transaction.description);
                
                // 1. TENTA MATCH EXATO
                let learned = learnedAssociations.find((la: any) => 
                    la.normalizedDescription === currentTxDna
                );

                // 2. TENTA MATCH DE ALTA CONFIANÇA (95%+)
                if (!learned) {
                    learned = learnedAssociations.find((la: any) => {
                        const score = getSimilarityScore(la.normalizedDescription, currentTxDna);
                        return score >= 95; 
                    });
                }
                
                if (learned) {
                    const church = churches.find((c: any) => c.id === learned.churchId);
                    if (church) {
                        identifiedCount++;
                        return {
                            ...res,
                            status: ReconciliationStatus.IDENTIFIED,
                            church: church,
                            matchMethod: MatchMethod.LEARNED,
                            similarity: 100,
                            contributor: { 
                                name: learned.contributorNormalizedName, 
                                amount: res.transaction.amount,
                                cleanedName: learned.contributorNormalizedName 
                            },
                            contributorAmount: res.transaction.amount,
                            suggestion: undefined
                        };
                    }
                }
            }
            return res;
        });

        if (identifiedCount > 0) {
            setMatchResults(nextResults);
            
            const incomeResults = nextResults.filter((r: MatchResult) => {
                const val = r.status === ReconciliationStatus.PENDING ? (r.contributorAmount || 0) : r.transaction.amount;
                return val >= 0;
            });
            const expenseResults = nextResults.filter((r: MatchResult) => {
                const val = r.status === ReconciliationStatus.PENDING ? (r.contributorAmount || 0) : r.transaction.amount;
                return val < 0;
            });

            setReportPreviewData({
                income: groupResultsByChurch(incomeResults),
                expenses: { 'all_expenses_group': expenseResults }
            });

            showToast(`${identifiedCount} linhas identificadas por aprendizado.`, "success");
            if (onAfterIdentification) onAfterIdentification(nextResults);
        } else {
            showToast("IA: Nenhuma linha pendente coincide com o que aprendi.", "error");
            console.warn("[AI-RECON] Falha: Nenhuma correspondência encontrada para as descrições pendentes.");
        }
        
        setIsLoading(false);
    }, [reconciliation, referenceData, setIsLoading, showToast, onAfterIdentification]);

    return { runAiAutoIdentification };
};
