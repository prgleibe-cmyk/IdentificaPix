
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
      ? "relative text-center py-4 w-full flex flex-col items-center group transition-all duration-500"
      : "relative overflow-hidden text-center p-8 md:p-12 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 max-w-xl mx-auto group transition-all duration-500 bg-white dark:bg-slate-900/80 backdrop-blur-md"
    }>
      
      {/* Decorative Gradients */}
      {!flat && (
        <>
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/10 to-transparent opacity-50"></div>
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/10 to-transparent opacity-50"></div>
          
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-orange-500/10 transition-colors duration-700"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-700"></div>
        </>
      )}

      <div className="relative z-10 flex flex-col items-center">
        {/* Highlighted Icon Container */}
        <div className="relative flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-white/5 mb-6 group-hover:scale-105 transition-transform duration-500 shadow-sm">
          <div className="absolute inset-0 rounded-2xl bg-orange-500/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          {/* Inner Glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/40 to-transparent opacity-30"></div>
          
          <div className="text-orange-500 dark:text-orange-400 relative z-10 drop-shadow-sm transform group-hover:-translate-y-0.5 transition-transform duration-500">
             {React.cloneElement(icon as React.ReactElement<any>, { className: "w-8 h-8 stroke-[1.5]" })}
          </div>
        </div>
        
        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 tracking-tight leading-tight">
            {title}
        </h3>
        
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed font-semibold">
            {message}
        </p>
        
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="relative inline-flex items-center justify-center px-8 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all duration-300 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl shadow-md shadow-orange-500/10 hover:-translate-y-0.5 active:scale-95 border border-white/10 cursor-pointer"
          >
            <span className="relative z-10 flex items-center gap-2">
                {action.text}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
