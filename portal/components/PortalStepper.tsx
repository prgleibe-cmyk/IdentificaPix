import React from 'react';
import { Check } from 'lucide-react';

interface PortalStepperProps {
    currentStep: number;
    onStepClick?: (step: number) => void;
}

const STEPS = [
    { number: 1, label: 'Identificação' },
    { number: 2, label: 'Contribuição' },
    { number: 3, label: 'Resumo' },
    { number: 4, label: 'Pagamento' },
    { number: 5, label: 'Conclusão' }
];

export const PortalStepper: React.FC<PortalStepperProps> = ({ currentStep, onStepClick }) => {
    return (
        <div className="w-full mb-6 sm:mb-8">
            <div className="flex items-start justify-between relative max-w-3xl mx-auto px-2">
                {/* Connecting progress line aligned to step circle centers */}
                <div className="absolute left-6 right-6 top-4 sm:top-[18px] h-0.5 bg-slate-200 dark:bg-slate-800 z-0 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-orange-600 dark:bg-orange-500 rounded-full transition-all duration-300"
                        style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                    />
                </div>

                {STEPS.map((step) => {
                    const isCompleted = step.number < currentStep;
                    const isCurrent = step.number === currentStep;

                    return (
                        <div key={step.number} className="relative z-10 flex flex-col items-center group">
                            <button
                                type="button"
                                disabled={step.number > currentStep}
                                onClick={() => onStepClick && onStepClick(step.number)}
                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm tabular-nums transition-colors duration-200 ${
                                    step.number <= currentStep ? 'cursor-pointer' : 'cursor-default'
                                } ${
                                    isCompleted 
                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                        : isCurrent 
                                            ? 'bg-orange-600 text-white ring-4 ring-orange-500/15 dark:ring-orange-500/30 shadow-sm' 
                                            : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-300 dark:border-slate-700'
                                }`}
                            >
                                {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : step.number}
                            </button>

                            <span className={`text-[11px] font-semibold mt-1.5 hidden md:block whitespace-nowrap transition-colors ${
                                isCurrent 
                                    ? 'text-orange-600 dark:text-orange-400' 
                                    : isCompleted 
                                        ? 'text-slate-700 dark:text-slate-300' 
                                        : 'text-slate-400 dark:text-slate-500'
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
