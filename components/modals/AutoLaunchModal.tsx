
import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { 
    XMarkIcon, 
    BoltIcon, 
    BrainIcon, 
    PlayCircleIcon, 
    ShieldCheckIcon, 
    CheckBadgeIcon, 
    ArrowPathIcon,
    ArrowsRightLeftIcon,
    CheckCircleIcon
} from '../Icons';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const AutoLaunchModal: React.FC = () => {
    const { autoLaunchTarget, closeAutoLaunch, markAsLaunched, automationMacros, fetchMacros } = useContext(AppContext);
    const { language } = useTranslation();
    const [step, setStep] = useState<'choice' | 'teaching' | 'executing'>('choice');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Estados para funcionalidade de arrastar
    const [position, setPosition] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{x: number, y: number}>({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    if (!autoLaunchTarget || autoLaunchTarget.length === 0) return null;

    const currentItem = autoLaunchTarget[currentIndex];
    const isFinished = currentIndex >= autoLaunchTarget.length;
    const activeMacro = automationMacros && automationMacros.length > 0 ? automationMacros[0] : null;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchMacros();
        setIsRefreshing(false);
    };

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
            payload: { 
                bankName: "Sistema Alvo",
                sampleItem: sample 
            } 
        }, "*");
        setStep('teaching');
    };

    const stopTrainingAndSave = () => {
        window.postMessage({ source: "IdentificaPixIA", type: "STOP_TRAINING" }, "*");
        setStep('choice');
        setCurrentIndex(0);
        setTimeout(handleRefresh, 2000);
    };

    const startExecution = () => {
        if (!activeMacro) return;
        setStep('executing');
        sendCurrentToExtension();
    };

    const handleManualLaunchAll = () => {
        // Itera sobre todos os itens do lote e marca como lançado
        autoLaunchTarget.forEach(item => {
            markAsLaunched(item.transaction.id);
        });
        closeAutoLaunch();
    };

    const sendCurrentToExtension = () => {
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
    };

    useEffect(() => {
        const handleExtensionMessage = (event: MessageEvent) => {
            if (event.data?.source !== "IdentificaPixExt") return;
            if (event.data?.type === "ITEM_DONE" || event.data?.type === "AUTO_SUCCESS") {
                if (step === 'executing') confirmCurrentLaunch();
            }
        };
        window.addEventListener("message", handleExtensionMessage);
        return () => window.removeEventListener("message", handleExtensionMessage);
    }, [currentIndex, step, currentItem]);

    const confirmCurrentLaunch = () => {
        const id = currentItem.transaction.id;
        markAsLaunched(id);
        if (currentIndex < autoLaunchTarget.length - 1) {
            setCurrentIndex(prev => prev + 1);
            if (step === 'executing') setTimeout(sendCurrentToExtension, 1500);
        } else {
            setCurrentIndex(autoLaunchTarget.length);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex justify-end items-start pointer-events-none p-4">
            <div 
                ref={modalRef}
                style={{ 
                    position: position ? 'fixed' : 'relative', 
                    left: position ? position.x : 'auto', 
                    top: position ? position.y : 'auto', 
                    margin: 0,
                    transform: position ? 'none' : undefined,
                    pointerEvents: 'auto'
                }}
                className="bg-white/95 dark:bg-slate-900/95 w-[320px] flex flex-col rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 backdrop-blur-2xl animate-scale-in overflow-hidden"
            >
                {/* HEADER - IDENTICO AO SMART EDIT */}
                <div 
                    onMouseDown={handleMouseDown}
                    className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-move select-none group bg-slate-50/50 dark:bg-slate-800/50"
                >
                    <h3 className="text-xs font-black text-slate-700 dark:text-white tracking-tight flex items-center gap-2 uppercase">
                        <ArrowsRightLeftIcon className="w-3 h-3 text-slate-400 group-hover:text-brand-blue rotate-45 transition-colors" />
                        Lançamento em Lote
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[7px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-700 px-1 rounded">Esc</span>
                        <button 
                            onClick={closeAutoLaunch} 
                            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors" 
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* INFO AREA - IDENTICA AO SMART EDIT */}
                {!isFinished && currentItem && (
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700 shrink-0">
                        <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Transação (Banco)</p>
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight uppercase" title={currentItem.contributor?.name || currentItem.transaction.description}>
                                    {currentItem.contributor?.name || currentItem.transaction.description}
                                </p>
                                <p className="text-[9px] text-slate-500 font-mono mt-0.5">{formatDate(currentItem.transaction.date)}</p>
                            </div>
                            <p className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tight whitespace-nowrap">
                                {formatCurrency(currentItem.transaction.amount, language)}
                            </p>
                        </div>
                    </div>
                )}

                <div className="p-3 flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 space-y-3">
                    {step === 'choice' && (
                        <div className="flex flex-col gap-2.5">
                            {/* OPÇÃO 1: MANUAL (NOVA) */}
                            <button 
                                onClick={handleManualLaunchAll}
                                className="flex items-center gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-xl hover:border-emerald-500 hover:shadow-sm transition-all text-left group"
                            >
                                <div className="p-2 bg-emerald-500 text-white rounded-lg group-hover:scale-110 transition-transform shadow-sm">
                                    <CheckCircleIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-black text-emerald-800 dark:text-emerald-400 uppercase text-[10px]">1. Lançamento Manual</h4>
                                    <p className="text-[8px] text-slate-500 leading-tight">Confirmar todos os itens sem usar automação.</p>
                                </div>
                            </button>

                            {/* OPÇÃO 2: ENSINAR */}
                            <button 
                                onClick={startTeaching}
                                className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-brand-blue hover:shadow-sm transition-all text-left group"
                            >
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 group-hover:scale-110 transition-transform">
                                    <BrainIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 dark:text-white uppercase text-[10px]">2. Ensinar Novo</h4>
                                    <p className="text-[8px] text-slate-500 leading-tight">Grave as ações manuais para a IA aprender.</p>
                                </div>
                            </button>

                            {/* OPÇÃO 3: EXECUTAR IA */}
                            <div className="relative group">
                                <button 
                                    onClick={startExecution}
                                    disabled={!activeMacro}
                                    className={`w-full flex items-center gap-3 p-3 border rounded-xl transition-all text-left ${!activeMacro ? 'opacity-40 grayscale cursor-not-allowed bg-slate-50 border-slate-100' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:border-amber-500 hover:shadow-sm'}`}
                                >
                                    <div className={`p-2 rounded-lg transition-colors ${!activeMacro ? 'bg-slate-200 text-slate-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                                        <PlayCircleIcon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-slate-800 dark:text-white uppercase text-[10px]">
                                            {activeMacro ? `3. Iniciar Lançamento IA` : '3. Sem Percurso'}
                                        </h4>
                                        <p className="text-[8px] text-slate-500 leading-tight">
                                            {activeMacro ? `Lançar todos os itens via IA.` : 'Ensine a IA antes de poder executar.'}
                                        </p>
                                    </div>
                                </button>
                                {!activeMacro && (
                                    <button 
                                        onClick={handleRefresh}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-brand-blue hover:text-white transition-all border border-slate-200 dark:border-slate-600"
                                    >
                                        Atu.
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'teaching' && (
                        <div className="text-center py-2 space-y-4">
                            <div className="relative w-12 h-12 mx-auto">
                                <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-ping"></div>
                                <div className="relative bg-purple-600 text-white p-3 rounded-full shadow-xl">
                                    <BrainIcon className="w-6 h-6" />
                                </div>
                            </div>
                            <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">Gravando Percurso...</h4>

                            {!isFinished && (
                                <button onClick={stopTrainingAndSave} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
                                    <ShieldCheckIcon className="w-3.5 h-3.5" /> Salvar Aprendizado
                                </button>
                            )}
                        </div>
                    )}

                    {step === 'executing' && (
                        <div className="space-y-4">
                            {!isFinished ? (
                                <div className="flex flex-col gap-3 animate-fade-in">
                                    <div className="bg-slate-900 p-4 rounded-xl text-white shadow-xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-blue/10 rounded-full blur-3xl"></div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">IA em Operação</span>
                                            </div>
                                            <h4 className="text-[11px] font-black tracking-tight mb-1 truncate uppercase">
                                                {currentItem.contributor?.name || currentItem.transaction.description}
                                            </h4>
                                            <p className="text-lg font-black text-emerald-400 font-mono tracking-tighter leading-none">
                                                {formatCurrency(currentItem.transaction.amount, language)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-2 py-1">
                                        <div className="flex items-center gap-1.5 text-brand-blue font-black text-[9px] uppercase tracking-widest animate-pulse">
                                            <PlayCircleIcon className="w-3.5 h-3.5" /> IA processando...
                                        </div>
                                        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-blue animate-progress"></div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4 animate-scale-in">
                                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-800">
                                        <CheckBadgeIcon className="w-7 h-7 text-emerald-500" />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Lote Concluído</h3>
                                    <button 
                                        onClick={closeAutoLaunch}
                                        className="mt-6 w-full py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                                    >
                                        Fechar Janela
                                    </button>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[7px] font-black uppercase text-slate-400 tracking-widest">
                                    <span>Progresso do Lote</span>
                                    <span>{Math.round((currentIndex / autoLaunchTarget.length) * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-full transition-all duration-500"
                                        style={{ width: `${(currentIndex / autoLaunchTarget.length) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
