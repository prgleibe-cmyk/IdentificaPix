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
  accentColor: string; // Expecting gradient classes like "from-blue-500 to-indigo-500"
}

export const SummaryCard: React.FC<SummaryCardProps> = memo(({ title, count, value, icon, language, accentColor }) => {
  const { t } = useTranslation();
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all duration-300">
        
        {/* Subtle top accent line */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${accentColor} opacity-80`}></div>

        <div className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-black text-slate-800 dark:text-white font-mono tracking-tight">{count}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{t('common.quantity').toLowerCase()}</span>
                    </div>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${accentColor} shadow-md text-white`}>
                    {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-6 h-6" })}
                </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50 mt-2">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t('common.totalValue')}</span>
                    <span className="text-lg font-bold text-slate-700 dark:text-slate-200 font-mono tracking-tight">{formatCurrency(value, language)}</span>
                </div>
                
                {/* Mini Trend Indicator (Static for visual polish) */}
                <div className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/30">
                    <svg className="w-2.5 h-2.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    Ativo
                </div>
            </div>
        </div>
    </div>
  );
});