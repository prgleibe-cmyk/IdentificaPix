

import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: {
    text: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action }) => {
  return (
    <div className="relative overflow-hidden text-center p-10 md:p-14 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 max-w-xl mx-auto group transition-all duration-500 bg-white dark:bg-slate-800/50 backdrop-blur-xl">
      
      {/* Decorative Gradients */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-50"></div>
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-50"></div>
      
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-700"></div>
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-indigo-500/10 transition-colors duration-700"></div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Highlighted Icon Container */}
        <div className="relative flex items-center justify-center h-28 w-28 rounded-[2rem] bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600 mb-8 group-hover:scale-105 transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) shadow-xl shadow-slate-200/50 dark:shadow-none">
          <div className="absolute inset-0 rounded-[2rem] bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          {/* Inner Glow */}
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-white/80 to-transparent opacity-50"></div>
          
          <div className="text-[#0057D9] dark:text-blue-400 relative z-10 drop-shadow-sm transform group-hover:-translate-y-1 transition-transform duration-500">
             {React.cloneElement(icon as React.ReactElement<any>, { className: "w-12 h-12 stroke-[1.5]" })}
          </div>
        </div>
        
        <h3 className="text-3xl font-black text-brand-graphite dark:text-white mb-4 tracking-tight leading-tight">
            {title}
        </h3>
        
        <p className="text-base text-slate-500 dark:text-slate-400 mb-10 max-w-sm mx-auto leading-relaxed font-medium">
            {message}
        </p>
        
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="relative inline-flex items-center justify-center px-10 py-4 text-xs md:text-sm font-bold uppercase tracking-widest text-white transition-all duration-300 bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] rounded-full shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1 active:scale-[0.98] overflow-hidden group/btn border-t border-white/20"
          >
            <span className="relative z-10 flex items-center gap-3">
                {action.text}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out"></div>
          </button>
        )}
      </div>
    </div>
  );
};