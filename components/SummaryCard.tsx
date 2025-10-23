import React, { memo } from 'react';
import { useTranslation } from '../contexts/I18nContext';
import { formatCurrency } from '../utils/formatters';
import { Language } from '../types';

interface SummaryCardProps {
  title: string;
  count: number;
  value: number;
  icon: React.ReactNode;
  language: Language;
}

export const SummaryCard: React.FC<SummaryCardProps> = memo(({ title, count, value, icon, language }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm flex items-start space-x-4 border border-slate-200 dark:border-slate-700">
      <div className="flex-shrink-0 pt-1">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
        <div className="mt-2 space-y-1">
             <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-600 dark:text-slate-300">{t('common.quantity')}:</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{count}</span>
             </div>
             <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-600 dark:text-slate-300">{t('common.totalValue')}:</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(value, language)}</span>
             </div>
        </div>
      </div>
    </div>
  );
});