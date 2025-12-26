

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
        className="bg-white rounded-3xl p-6 shadow-card hover:shadow-soft transition-all duration-300 transform hover:-translate-y-1 border border-transparent hover:border-slate-100 animate-fade-in-up fill-mode-backwards"
        style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${iconBgClass}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
        </div>
        <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">{title}</p>
            <p className="text-3xl font-display font-bold text-brand-graphite tracking-tight">{count}</p>
        </div>
      </div>
      
      <div className="pt-4 border-t border-slate-50 flex items-end justify-between">
        <div>
            <p className="text-xs text-slate-400 font-medium mb-0.5">{t('common.totalValue')}</p>
            <p className="text-lg font-semibold text-brand-graphite">{formatCurrency(value, language)}</p>
        </div>
        {/* Decorative visual */}
        <div className="h-1 w-12 rounded-full bg-gradient-to-r from-brand-blue to-brand-teal opacity-50"></div>
      </div>
    </div>
  );
});