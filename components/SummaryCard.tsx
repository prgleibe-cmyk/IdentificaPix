

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
        className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-card hover:shadow-soft transition-all duration-200 border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between animate-fade-in-up fill-mode-backwards"
        style={{ animationDelay: `${delay}ms` }}
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 ${iconBgClass}`}>
                {React.cloneElement(icon as React.ReactElement<any>, { className: "w-4 h-4 stroke-[2]" })}
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{title}</p>
          </div>
          <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums shrink-0">
            {count}
          </span>
        </div>
      </div>
      
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between mt-2">
        <span className="text-xs text-slate-400 font-normal">{t('common.totalValue')}</span>
        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
          {formatCurrency(value, language)}
        </span>
      </div>
    </div>
  );
});