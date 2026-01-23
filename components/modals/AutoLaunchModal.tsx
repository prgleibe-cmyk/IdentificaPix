import React from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { useAutoLaunchController } from './auto-launch/useAutoLaunchController';
import { AutoLaunchHeader } from './auto-launch/AutoLaunchHeader';
import { AutoLaunchInfo } from './auto-launch/AutoLaunchInfo';
import { ChoiceStep } from './auto-launch/ChoiceStep';
import { TeachingStep } from './auto-launch/TeachingStep';
import { ExecutingStep } from './auto-launch/ExecutingStep';

/**
 * AUTO LAUNCH MODAL (V2 - REFACTORED)
 * Orchestrates bulk transaction launching with AI and manual fallbacks.
 * Modularized for improved maintainability.
 */
export const AutoLaunchModal: React.FC = () => {
    const ctrl = useAutoLaunchController();
    const { language } = useTranslation();

    if (!ctrl.autoLaunchTarget || ctrl.autoLaunchTarget.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex justify-end items-start pointer-events-none p-4">
            <div 
                ref={ctrl.modalRef}
                style={{ 
                    position: ctrl.position ? 'fixed' : 'relative', 
                    left: ctrl.position ? ctrl.position.x : 'auto', 
                    top: ctrl.position ? ctrl.position.y : 'auto', 
                    margin: 0,
                    transform: ctrl.position ? 'none' : undefined,
                    pointerEvents: 'auto'
                }}
                className="bg-white/95 dark:bg-slate-900/95 w-[320px] flex flex-col rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 backdrop-blur-2xl animate-scale-in overflow-hidden"
            >
                <AutoLaunchHeader 
                    onMouseDown={ctrl.handleMouseDown} 
                    onClose={ctrl.closeAutoLaunch} 
                />

                {!ctrl.isFinished && ctrl.currentItem && (
                    <AutoLaunchInfo 
                        item={ctrl.currentItem} 
                        language={language} 
                    />
                )}

                <div className="p-3 flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 space-y-3">
                    {ctrl.step === 'choice' && (
                        <ChoiceStep 
                            onManual={ctrl.handleManualLaunchAll}
                            onTeach={ctrl.startTeaching}
                            onExecute={ctrl.startExecution}
                            onRefresh={ctrl.handleRefresh}
                            activeMacro={ctrl.activeMacro}
                        />
                    )}

                    {ctrl.step === 'teaching' && (
                        <TeachingStep onStop={ctrl.stopTrainingAndSave} />
                    )}

                    {ctrl.step === 'executing' && (
                        <ExecutingStep 
                            isFinished={ctrl.isFinished}
                            currentItem={ctrl.currentItem}
                            currentIndex={ctrl.currentIndex}
                            total={ctrl.autoLaunchTarget.length}
                            onClose={ctrl.closeAutoLaunch}
                            language={language}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};