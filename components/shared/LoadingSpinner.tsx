
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
    <div className="flex flex-col items-center justify-center py-6 px-5 max-w-xs mx-auto text-center">
      <div className="relative mb-4">
        <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r="24"
            stroke="currentColor"
            strokeWidth="3.5"
            fill="transparent"
            className="text-slate-200 dark:text-slate-800"
          />
          <circle
            cx="28"
            cy="28"
            r="24"
            stroke="currentColor"
            strokeWidth="3.5"
            fill="transparent"
            strokeDasharray={150.8}
            strokeDashoffset={150.8 - (150.8 * (progressPercent || 28)) / 100}
            strokeLinecap="round"
            className={`${parsingProgress ? 'text-emerald-600 dark:text-emerald-500' : 'text-orange-600 dark:text-orange-500'} transition-all duration-300 ease-out origin-center ${!parsingProgress ? 'animate-[spin_1.4s_linear_infinite]' : ''}`}
          />
        </svg>
        {parsingProgress && (
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
               {progressPercent}%
             </span>
          </div>
        )}
      </div>

      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
        {parsingProgress ? 'Processando Arquivo' : t('common.processing')}
      </h3>
      
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {parsingProgress ? parsingProgress.label : 'Aguarde um momento enquanto organizamos tudo.'}
      </p>

      {parsingProgress && (
          <div className="mt-4 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
          </div>
      )}
    </div>
  );
};
