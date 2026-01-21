
import React from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';

export const LoadingSpinner: React.FC = () => {
  const { t } = useTranslation();
  let uiContext;
  
  try {
    uiContext = useUI();
  } catch (e) {
    uiContext = { parsingProgress: null };
  }

  const { parsingProgress } = uiContext;

  const progressPercent = parsingProgress && parsingProgress.total > 0 
    ? Math.round((parsingProgress.current / parsingProgress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 max-w-sm mx-auto text-center">
      <div className="relative mb-6">
        <svg className="w-20 h-20 transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-slate-200 dark:text-slate-700"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={226.2}
            strokeDashoffset={226.2 - (226.2 * (progressPercent || 25)) / 100}
            strokeLinecap="round"
            className={`${parsingProgress ? 'text-emerald-500' : 'text-blue-600'} transition-all duration-500 ease-out ${!parsingProgress ? 'animate-[spin_2s_linear_infinite]' : ''}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
           <span className="text-xs font-black text-slate-800 dark:text-white tabular-nums">
             {parsingProgress ? `${progressPercent}%` : ''}
           </span>
        </div>
      </div>

      <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-widest mb-1">
        {parsingProgress ? 'Processando Arquivo' : t('common.processing')}
      </h3>
      
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {parsingProgress ? parsingProgress.label : 'Aguarde um momento enquanto organizamos tudo.'}
      </p>

      {parsingProgress && (
          <div className="mt-4 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                style={{ width: `${progressPercent}%` }}
              ></div>
          </div>
      )}
    </div>
  );
};
