
import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

export const Toast: React.FC<ToastProps> = ({ message, type }) => {
  // Z-Index aumentado para 50000 para superar o FilePreprocessorModal (z-9999) e outros overlays
  const baseClasses = "fixed top-6 right-6 z-[50000] px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-4 animate-toast-fade-in-out backdrop-blur-md transition-all transform hover:scale-[1.02]";
  const typeClasses = type === 'success' 
    ? 'bg-white/90 border-green-200 text-slate-800 dark:bg-slate-800/90 dark:border-green-800 dark:text-white' 
    : 'bg-white/90 border-red-200 text-slate-800 dark:bg-slate-800/90 dark:border-red-800 dark:text-white';

  const iconBg = type === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400';

  const icon = type === 'success' ? (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
  ) : (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
  );

  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      <div className={`p-2 rounded-full ${iconBg}`}>{icon}</div>
      <span className="font-semibold text-sm tracking-wide">{message}</span>
    </div>
  );
};
