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
  accentColor: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = memo(({ title, count, value, icon, language, accentColor }) => {
  const { t } = useTranslation();
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 border-l-4 ${accentColor}`}>
        <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                    {icon}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
            </div>
            <div className="flex items-baseline justify-between">
                <div className="flex flex-col">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('common.quantity')}</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{count}</span>
                </div>
                 <div className="flex flex-col text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('common.totalValue')}</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(value, language)}</span>
                </div>
            </div>
        </div>
    </div>
  );
});