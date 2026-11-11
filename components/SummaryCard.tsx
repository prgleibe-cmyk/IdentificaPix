

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
  
  const isEmerald = accentColor.includes('emerald') || accentColor.includes('teal');
  const iconBgClass = isEmerald 
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40' 
    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40';

  return (
    <div 
        className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-xs hover:shadow-soft transition-all duration-200 border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between animate-fade-in-up fill-mode-backwards"
        style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start mb-1.5">
        <div className={`p-1.5 rounded-lg ${iconBgClass}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: "w-3.5 h-3.5 stroke-[2]" })}
        </div>
        <div className="text-right">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{title}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">{count}</p>
        </div>
      </div>
      
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-normal">{t('common.totalValue')}</span>
        <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
          {formatCurrency(value, language)}
        </span>
      </div>
    </div>
  );
});