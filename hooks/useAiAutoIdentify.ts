
import { useCallback } from 'react';
import { ReconciliationStatus, MatchMethod, MatchResult } from '../types';
import { strictNormalize, groupResultsByChurch, isInvalidOrNumericName } from '../services/processingService';
import { consolidationService } from '../services/ConsolidationService';
import { batchState } from './reconciliation/useCloudSync';
import { extractNameAndCpf, isCpfCompatible } from '../utils/contributorHelper';

interface UseAiAutoIdentifyProps {
    reconciliation: any;
    referenceData: any;
    setIsLoading: (loading: boolean) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    onAfterIdentification?: (results: MatchResult[]) => void;
}

export const useAiAutoIdentify = ({
    reconciliation,
    referenceData,
    setIsLoading,
    showToast,
    onAfterIdentification
}: UseAiAutoIdentifyProps) => {
    
    const runAiAutoIdentification = useCallback(async () => {
        const { matchResults, setMatchResults, setReportPreviewData } = reconciliation;
        const { learnedAssociations, churches, contributorFiles, learnAssociation } = referenceData;

        if (!matchResults || matchResults.length === 0) {
            showToast("Nenhuma transação carregada para identificar.", "error");
            return;
        }
        
        setIsLoading(true);
        let identifiedCount = 0;
        
        const allContributorsFlat = (contributorFiles || []).flatMap((f: any) => 
            (f.contributors || []).map((c: any) => ({ ...c, _churchId: c._churchId || c.church_id || f.church?.id }))
        );

        const nextResults = [];

        for (const res of matchResults) {
            if (res.status === ReconciliationStatus.UNIDENTIFIED) {
                const currentTxDna = strictNormalize(res.transaction.description || '');
                const rawTxDna = res.transaction.rawDescription ? strictNormalize(res.transaction.rawDescription) : '';
                
                // 1. Checar Associações Aprendidas (Aprendizado prévio)
                const learned = learnedAssociations.find((la: any) => {
                    const learnedDna = la.normalizedDescription;
                    return learnedDna && (learnedDna === currentTxDna || (rawTxDna && learnedDna === rawTxDna));
                });

                if (learned) {
                    const church = churches.find((c: any) => c.id === learned.churchId);
                    if (church) {
                        identifiedCount++;
                        
                        if (!res.transaction.id.includes('ghost') && !res.transaction.id.includes('sim')) {
                            const itemType = (res.transaction.amount >= 0) ? 'income' : 'expense';
                            await consolidationService.updateTransactionStatus(
                                res.transaction.id, 
                                'identified', 
                                church.id, 
                                res.transaction.bank_id,
                                undefined,
                                false,
                                itemType
                            );
                        }

                        const validContribName = (learned.contributorNormalizedName && !isInvalidOrNumericName(learned.contributorNormalizedName, res.transaction.description)) 
                            ? learned.contributorNormalizedName 
                            : null;

                        const updatedResult: MatchResult = {
                            ...res,
                            status: ReconciliationStatus.IDENTIFIED,
                            church: church,
                            _churchId: church.id,
                            matchMethod: MatchMethod.LEARNED,
                            similarity: 100,
                            contributor: validContribName ? { 
                                name: validContribName, 
                                amount: res.transaction.amount,
                                cleanedName: validContribName 
                            } : null,
                            contributorAmount: res.transaction.amount,
                            suggestion: undefined,
                            updatedAt: new Date().toISOString()
                        };

                        nextResults.push(updatedResult);
                        continue;
                    }
                }

                // 2. Checar Correspondência por CPF/CNPJ (Extrato x Cadastros)
                const { cpf: extractedCpf1 } = extractNameAndCpf(res.transaction.description || '');
                const { cpf: extractedCpf2 } = extractNameAndCpf(res.transaction.rawDescription || '');
                const targetCpf = extractedCpf1 || extractedCpf2;

                if (targetCpf && allContributorsFlat.length > 0) {
                    const cpfMatch = allContributorsFlat.find((contrib: any) => 
                        isCpfCompatible(targetCpf, contrib.cpf || contrib.document || contrib.cnpj || contrib.code)
                    );

                    if (cpfMatch) {
                        const church = churches.find((c: any) => c.id === cpfMatch._churchId);
                        if (church) {
                            identifiedCount++;
                            const contribName = cpfMatch.name || cpfMatch.cleanedName || cpfMatch.canonical_name;

                            if (!res.transaction.id.includes('ghost') && !res.transaction.id.includes('sim')) {
                                const itemType = (res.transaction.amount >= 0) ? 'income' : 'expense';
                                await consolidationService.updateTransactionStatus(
                                    res.transaction.id, 
                                    'identified', 
                                    church.id, 
                                    res.transaction.bank_id,
                                    cpfMatch.id,
                                    false,
                                    itemType
                                );
                            }

                            const updatedResult: MatchResult = {
                                ...res,
                                status: ReconciliationStatus.IDENTIFIED,
                                church: church,
                                _churchId: church.id,
                                matchMethod: MatchMethod.CPF,
                                similarity: 100,
                                contributor: {
                                    id: cpfMatch.id,
                                    name: contribName,
                                    cleanedName: contribName,
                                    amount: res.transaction.amount
                                },
                                contributorAmount: res.transaction.amount,
                                suggestion: undefined,
                                updatedAt: new Date().toISOString()
                            };

                            if (learnAssociation) {
                                learnAssociation(updatedResult);
                            }

                            nextResults.push(updatedResult);
                            continue;
                        }
                    }
                }
            }
            nextResults.push(res);
        }

        if (identifiedCount > 0) {
            batchState.isAtomicUpdate = true;
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

            showToast(`Sucesso: ${identifiedCount} itens identificados automaticamente!`, "success");
            if (onAfterIdentification) onAfterIdentification(nextResults);
        } else {
            showToast("Vínculos: Nenhuma linha coincide com o aprendizado salvo ou CPF/CNPJ.", "error");
        }
        
        setIsLoading(false);
    }, [reconciliation, referenceData, setIsLoading, showToast, onAfterIdentification]);

    return { runAiAutoIdentification };
};
