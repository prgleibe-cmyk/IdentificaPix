import React from 'react';

interface PortalStepperProps {
    currentStep: number;
    onStepClick?: (step: number) => void;
}

const STEPS = [
    { number: 1, label: 'Identificação' },
    { number: 2, label: 'Contribuinte' },
    { number: 3, label: 'Contribuição' },
    { number: 4, label: 'Resumo' },
    { number: 5, label: 'Pagamento' },
    { number: 6, label: 'Conclusão' }
];

export const PortalStepper: React.FC<PortalStepperProps> = ({ currentStep, onStepClick }) => {
    return (
        <div className="w-full mb-6 sm:mb-8">
            <div className="flex items-center justify-between relative max-w-2xl mx-auto">
                {/* Connecting progress line */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-slate-200 dark:bg-slate-800 w-full z-0 rounded-full" />
                <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand-blue dark:bg-blue-500 z-0 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                />

                {STEPS.map((step) => {
                    const isCompleted = step.number < currentStep;
                    const isCurrent = step.number === currentStep;

                    return (
                        <div key={step.number} className="relative z-10 flex flex-col items-center group">
                            <button
                                type="button"
                                disabled={step.number > currentStep}
                                onClick={() => onStepClick && onStepClick(step.number)}
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                                    isCompleted 
                                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                                        : isCurrent 
                                            ? 'bg-brand-blue text-white ring-4 ring-blue-500/20 dark:ring-blue-500/40 shadow-lg scale-110' 
                                            : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700'
                                }`}
                            >
                                {isCompleted ? '✓' : step.number}
                            </button>

                            <span className={`text-[10px] sm:text-xs font-bold mt-1.5 hidden md:block transition-colors ${
                                isCurrent 
                                    ? 'text-brand-blue dark:text-blue-400' 
                                    : isCompleted 
                                        ? 'text-slate-700 dark:text-slate-300' 
                                        : 'text-slate-400 dark:text-slate-600'
                            }`}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
