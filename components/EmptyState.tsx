
import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: {
    text: string;
    onClick: () => void;
  };
  flat?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action, flat }) => {
  return (
    <div className={flat 
      ? "relative text-center py-6 w-full flex flex-col items-center transition-colors"
      : "relative overflow-hidden text-center p-8 md:p-10 rounded-xl shadow-card border border-slate-200/90 dark:border-slate-800 max-w-lg mx-auto transition-colors bg-white dark:bg-slate-900"
    }>
      <div className="relative z-10 flex flex-col items-center">
        {/* Highlighted Icon Container */}
        <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 mb-4">
          {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6 stroke-[1.75]" })}
        </div>
        
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 tracking-tight leading-snug">
            {title}
        </h3>
        
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 max-w-sm mx-auto leading-relaxed">
            {message}
        </p>
        
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white transition-all bg-orange-600 hover:bg-orange-700 active:bg-orange-800 rounded-lg shadow-xs active:scale-95 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          >
            <span>{action.text}</span>
          </button>
        )}
      </div>
    </div>
  );
};
