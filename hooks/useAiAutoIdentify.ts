
import { useCallback } from 'react';
import { ReconciliationStatus, MatchMethod, MatchResult } from '../types';
import { normalizeString, groupResultsByChurch } from '../services/processingService';

interface UseAiAutoIdentifyProps {
    reconciliation: any;
    referenceData: any;
    effectiveIgnoreKeywords: string[];
    setIsLoading: (loading: boolean) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    onAfterIdentification?: (results: MatchResult[]) => void;
}

export const useAiAutoIdentify = ({
    reconciliation,
    referenceData,
    effectiveIgnoreKeywords,
    setIsLoading,
    showToast,
    onAfterIdentification
}: UseAiAutoIdentifyProps) => {
    
    const runAiAutoIdentification = useCallback(() => {
        if (reconciliation.matchResults.length === 0) return;
        
        setIsLoading(true);
        let identifiedCount = 0;
        
        const currentResults = [...reconciliation.matchResults];
        const nextResults = currentResults.map(res => {
            if (res.status === ReconciliationStatus.UNIDENTIFIED) {
                const txDescNorm = normalizeString(res.transaction.description, effectiveIgnoreKeywords);
                const learned = referenceData.learnedAssociations.find((la: any) => la.normalizedDescription === txDescNorm);
                
                if (learned) {
                    const church = referenceData.churches.find((c: any) => c.id === learned.churchId);
                    if (church) {
                        identifiedCount++;
                        return {
                            ...res,
                            status: ReconciliationStatus.IDENTIFIED,
                            church: church,
                            matchMethod: MatchMethod.LEARNED,
                            similarity: 100,
                            contributor: res.suggestion || { name: learned.contributorNormalizedName, amount: res.transaction.amount },
                            contributorAmount: res.transaction.amount,
                            suggestion: undefined
                        };
                    }
                }

                if (res.suggestion && (res.similarity || 0) >= 90) {
                    const churchId = (res.suggestion as any)._churchId || (res.suggestion as any).church?.id;
                    const church = referenceData.churches.find((c: any) => c.id === churchId);
                    
                    if (church) {
                        identifiedCount++;
                        return {
                            ...res,
                            status: ReconciliationStatus.IDENTIFIED,
                            contributor: res.suggestion,
                            church: church,
                            matchMethod: MatchMethod.AI,
                            similarity: res.similarity,
                            contributorAmount: res.suggestion.amount,
                            suggestion: undefined
                        };
                    }
                }
            }
            return res;
        });

        if (identifiedCount > 0) {
            reconciliation.setMatchResults(nextResults);
            
            // SEPARAÇÃO RÍGIDA POR MONTANTE EFETIVO
            const incomeResults = nextResults.filter(r => {
                const val = r.status === ReconciliationStatus.PENDING ? (r.contributorAmount || 0) : r.transaction.amount;
                return val >= 0;
            });
            
            const expenseResults = nextResults.filter(r => {
                const val = r.status === ReconciliationStatus.PENDING ? (r.contributorAmount || 0) : r.transaction.amount;
                return val < 0;
            });

            reconciliation.setReportPreviewData({
                income: groupResultsByChurch(incomeResults),
                expenses: { 'all_expenses_group': expenseResults }
            });

            showToast(`${identifiedCount} transações identificadas automaticamente.`, "success");

            // Persistência Imediata após IA
            if (onAfterIdentification) onAfterIdentification(nextResults);
        } else {
            showToast("Nenhuma sugestão de alta confiança encontrada.", "success");
        }
        
        setIsLoading(false);
    }, [reconciliation, referenceData, effectiveIgnoreKeywords, setIsLoading, showToast, onAfterIdentification]);

    return { runAiAutoIdentification };
};
