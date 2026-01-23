import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AppContext } from '../../../contexts/AppContext';

export type AutoLaunchStep = 'choice' | 'teaching' | 'executing';

export const useAutoLaunchController = () => {
    const { 
        autoLaunchTarget, 
        closeAutoLaunch, 
        markAsLaunched, 
        automationMacros, 
        fetchMacros 
    } = useContext(AppContext);

    const [step, setStep] = useState<AutoLaunchStep>('choice');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Draggable State
    const [position, setPosition] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{x: number, y: number}>({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    const currentItem = autoLaunchTarget ? autoLaunchTarget[currentIndex] : null;
    const isFinished = autoLaunchTarget ? currentIndex >= autoLaunchTarget.length : true;
    const activeMacro = automationMacros && automationMacros.length > 0 ? automationMacros[0] : null;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchMacros();
        setIsRefreshing(false);
    };

    // Fix: Added React to imports and typed event as React.MouseEvent
    const handleMouseDown = (e: React.MouseEvent) => {
        if (modalRef.current) {
            setIsDragging(true);
            const rect = modalRef.current.getBoundingClientRect();
            dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const newX = e.clientX - dragStart.current.x;
                const newY = e.clientY - dragStart.current.y;
                setPosition({ x: newX, y: newY });
            }
        };
        const handleMouseUp = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const startTeaching = () => {
        if (!currentItem) return;
        const sample = {
            id: currentItem.transaction.id,
            name: currentItem.contributor?.name || currentItem.transaction.description,
            amount: currentItem.transaction.amount,
            date: currentItem.transaction.date,
            church: currentItem.church?.name
        };

        window.postMessage({ 
            source: "IdentificaPixIA", 
            type: "START_TRAINING", 
            payload: { bankName: "Sistema Alvo", sampleItem: sample } 
        }, "*");
        setStep('teaching');
    };

    const stopTrainingAndSave = () => {
        window.postMessage({ source: "IdentificaPixIA", type: "STOP_TRAINING" }, "*");
        setStep('choice');
        setCurrentIndex(0);
        setTimeout(handleRefresh, 2000);
    };

    const sendCurrentToExtension = useCallback(() => {
        if (!currentItem || !activeMacro) return;
        window.postMessage({ 
            source: "IdentificaPixIA", 
            type: "EXECUTE_ITEM", 
            payload: { 
                macro: activeMacro,
                data: { 
                    id: currentItem.transaction.id,
                    date: currentItem.transaction.date,
                    name: currentItem.contributor?.name || currentItem.transaction.description,
                    amount: currentItem.transaction.amount,
                    church: currentItem.church?.name
                } 
            } 
        }, "*");
    }, [currentItem, activeMacro]);

    const confirmCurrentLaunch = useCallback(() => {
        if (!currentItem || !autoLaunchTarget) return;
        const id = currentItem.transaction.id;
        markAsLaunched(id);
        if (currentIndex < autoLaunchTarget.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setCurrentIndex(autoLaunchTarget.length);
        }
    }, [currentItem, autoLaunchTarget, currentIndex, markAsLaunched]);

    const startExecution = () => {
        if (!activeMacro) return;
        setStep('executing');
        sendCurrentToExtension();
    };

    const handleManualLaunchAll = () => {
        if (!autoLaunchTarget) return;
        autoLaunchTarget.forEach(item => markAsLaunched(item.transaction.id));
        closeAutoLaunch();
    };

    useEffect(() => {
        if (step === 'executing' && !isFinished) {
            const timer = setTimeout(sendCurrentToExtension, 1500);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, step, isFinished, sendCurrentToExtension]);

    useEffect(() => {
        const handleExtensionMessage = (event: MessageEvent) => {
            if (event.data?.source !== "IdentificaPixExt") return;
            if (event.data?.type === "ITEM_DONE" || event.data?.type === "AUTO_SUCCESS") {
                if (step === 'executing') confirmCurrentLaunch();
            }
        };
        window.addEventListener("message", handleExtensionMessage);
        return () => window.removeEventListener("message", handleExtensionMessage);
    }, [step, confirmCurrentLaunch]);

    return {
        autoLaunchTarget, closeAutoLaunch, step, setStep, currentIndex, setCurrentIndex,
        isRefreshing, handleRefresh, position, handleMouseDown, modalRef,
        currentItem, isFinished, activeMacro, startTeaching, stopTrainingAndSave,
        startExecution, handleManualLaunchAll
    };
};