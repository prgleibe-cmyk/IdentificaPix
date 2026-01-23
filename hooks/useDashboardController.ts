
import { useContext, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useUI } from '../contexts/UIContext';
import { useTranslation } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';

export const useDashboardController = () => {
    const { summary, matchResults, hasActiveSession, savedReports } = useContext(AppContext);
    const { user } = useAuth();
    const { setActiveView } = useUI();
    const { t, language } = useTranslation();

    const identificationRate = useMemo(() => {
        const total = (summary.identifiedCount || 0) + (summary.unidentifiedCount || 0);
        return total > 0 ? (summary.identifiedCount / total) * 100 : 0;
    }, [summary]);
    
    const pieChartData = useMemo(() => {
        const breakdown = summary.methodBreakdown || { 'AUTOMATIC': 0, 'MANUAL': 0, 'LEARNED': 0, 'AI': 0 };
        return [
            { name: t('dashboard.matchMethod.automatic'), value: breakdown.AUTOMATIC, color: '#3B82F6' },
            { name: t('dashboard.matchMethod.manual'), value: breakdown.MANUAL, color: '#6366F1' },
            { name: t('dashboard.matchMethod.learned'), value: breakdown.LEARNED, color: '#8B5CF6' },
            { name: t('dashboard.matchMethod.ai'), value: breakdown.AI, color: '#14B8A6' },
        ].filter(d => d.value > 0);
    }, [summary.methodBreakdown, t]);

    const maxValuePerChurch = useMemo(() => {
        if (!summary.valuePerChurch || summary.valuePerChurch.length === 0) return 0;
        return Math.max(...summary.valuePerChurch.map(([, value]: [string, number]) => value));
    }, [summary.valuePerChurch]);

    const hasData = useMemo(() => {
        return matchResults.length > 0 || 
               savedReports.length > 0 || 
               (summary.totalValue || 0) > 0 || 
               (summary.identifiedCount || 0) > 0;
    }, [matchResults, savedReports, summary]);

    const getGreeting = () => {
        const hours = new Date().getHours();
        if (hours < 12) return 'Bom dia';
        if (hours < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    return {
        summary,
        user,
        setActiveView,
        t,
        language,
        identificationRate,
        pieChartData,
        maxValuePerChurch,
        hasData,
        getGreeting,
        hasActiveSession
    };
};
