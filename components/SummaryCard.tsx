

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
  delay?: number;
}

export const SummaryCard: React.FC<SummaryCardProps> = memo(({ title, count, value, icon, language, accentColor, delay = 0 }) => {
  const { t } = useTranslation();
  
  // Dynamic styling based on accent color
  let iconBgClass = 'bg-blue-50 text-brand-blue';
  
  if (accentColor.includes('emerald') || accentColor.includes('teal')) {
      iconBgClass = 'bg-teal-50 text-brand-teal';
  } else if (accentColor.includes('amber') || accentColor.includes('orange')) {
      iconBgClass = 'bg-orange-50 text-orange-500';
  }

  return (
    <div 
        className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-card hover:shadow-soft transition-all duration-200 border border-slate-200/90 dark:border-slate-700 animate-fade-in-up fill-mode-backwards"
        style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-lg ${iconBgClass}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5" })}
        </div>
        <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">{count}</p>
        </div>
      </div>
      
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-end justify-between">
        <div>
            <p className="text-[11px] text-slate-400 font-medium">{t('common.totalValue')}</p>
            <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">{formatCurrency(value, language)}</p>
        </div>
        <div className="h-1 w-8 rounded-full bg-orange-500/30"></div>
      </div>
    </div>
  );
});