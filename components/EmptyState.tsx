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
    <div className="relative overflow-hidden text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl p-12 rounded-[2.5rem] shadow-2xl shadow-indigo-500/10 border border-white/60 dark:border-slate-700 max-w-2xl mx-auto mt-8 group transition-all duration-500 hover:shadow-indigo-500/20">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-100/50 dark:bg-indigo-900/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

      <div className="relative z-10">
        <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-750 shadow-inner mb-8 transform group-hover:scale-110 transition-transform duration-500 ease-out border border-indigo-100/50 dark:border-slate-700">
          <div className="text-indigo-600 dark:text-indigo-400 drop-shadow-md">
             {/* Clone element to add specific classes if needed, or just render */}
             {React.cloneElement(icon as React.ReactElement<any>, { className: "w-10 h-10" })}
          </div>
        </div>
        
        <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
            {title}
        </h3>
        
        <p className="text-lg text-slate-500 dark:text-slate-400 mb-10 max-w-md mx-auto leading-relaxed">
            {message}
        </p>
        
        {action && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white transition-all duration-300 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 active:scale-[0.98]"
            >
              {action.text}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};