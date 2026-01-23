import { useMemo } from 'react';
import { MatchResult } from '../types';
import { groupResultsByChurch } from '../services/processingService';

export const useSummaryData = (reconciliation: any, reportManager: any) => {
    return useMemo(() => {
        const results = reconciliation.matchResults;
        const hasSession = reconciliation.hasActiveSession;
        
        let identifiedCount = 0;
        let unidentifiedCount = 0;
        let totalValue = 0;
        let valuePerChurch: [string, number][] = [];
        let methodBreakdown: Record<string, number> = { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
        
        let autoVal = 0, manualVal = 0, pendingVal = 0;

        if (hasSession && results.length > 0) {
            identifiedCount = results.filter((r: any) => r.status === 'IDENTIFICADO').length;
            unidentifiedCount = results.filter((r: any) => r.status === 'NÃO IDENTIFICADO' || r.status === 'PENDENTE').length;
            
            results.forEach((r: any) => {
                if (r.status === 'IDENTIFICADO') {
                    const val = r.transaction.amount;
                    totalValue += val;
                    if (r.matchMethod === 'MANUAL' || r.matchMethod === 'AI') manualVal += val;
                    else autoVal += val;
                    
                    const method = r.matchMethod || 'AUTOMATIC';
                    methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
                } else {
                    pendingVal += (r.contributorAmount || r.transaction.amount);
                }
            });

            const grouped = groupResultsByChurch(results.filter((r: any) => r.status === 'IDENTIFICADO'));
            valuePerChurch = Object.values(grouped).map((group: any) => {
                const churchName = group[0]?.church?.name || 'Desconhecida';
                const total = (group as any[]).reduce((acc: number, curr: any) => acc + curr.transaction.amount, 0);
                return [churchName, total] as [string, number];
            }).sort((a, b) => b[1] - a[1]);

        } else if (reportManager.savedReports.length > 0) {
            reportManager.savedReports.forEach((rep: any) => {
                if (rep.data && rep.data.results) {
                    const repResults = rep.data.results as MatchResult[];
                    identifiedCount += repResults.filter(r => r.status === 'IDENTIFICADO').length;
                    
                    repResults.forEach(r => {
                        if (r.status === 'IDENTIFICADO') {
                            const method = r.matchMethod || 'AUTOMATIC';
                            methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
                        }
                    });
                }
            });
        }

        return {
            identifiedCount,
            unidentifiedCount,
            totalValue,
            autoConfirmed: { value: autoVal },
            manualConfirmed: { value: manualVal },
            pending: { value: pendingVal },
            valuePerChurch,
            methodBreakdown,
            isHistorical: !hasSession && reportManager.savedReports.length > 0
        };
    }, [reconciliation.matchResults, reconciliation.hasActiveSession, reportManager.savedReports]);
};