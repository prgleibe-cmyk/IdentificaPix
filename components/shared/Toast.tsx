
import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

export const Toast: React.FC<ToastProps> = ({ message, type }) => {
  // Z-Index aumentado para 50000 para superar o FilePreprocessorModal (z-9999) e outros overlays
  const baseClasses = "fixed top-5 right-5 z-[50000] px-4 py-3 rounded-xl shadow-elevated border flex items-center gap-3 animate-toast-fade-in-out backdrop-blur-md transition-all max-w-md";
  const typeClasses = type === 'success' 
    ? 'bg-white/95 border-emerald-200/90 text-slate-900 dark:bg-slate-900/95 dark:border-emerald-800/70 dark:text-slate-100' 
    : 'bg-white/95 border-rose-200/90 text-slate-900 dark:bg-slate-900/95 dark:border-rose-800/70 dark:text-slate-100';

  const iconBg = type === 'success'
    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/50'
    : 'bg-rose-50 text-rose-600 border border-rose-200/60 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/50';

  const icon = type === 'success' ? (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" d="M5 13l4 4L19 7" /></svg>
  ) : (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" d="M6 18L18 6M6 6l12 12" /></svg>
  );

  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      <span className="font-medium text-xs sm:text-sm leading-snug">{message}</span>
    </div>
  );
};
