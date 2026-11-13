
import React, { useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { 
    TrashIcon, 
    PlusCircleIcon, 
    ArrowPathIcon, 
    DocumentDuplicateIcon, 
    XMarkIcon
} from '../Icons';

interface BankManagerMenuProps {
    menuRef?: React.RefObject<HTMLDivElement | null>;
    menuPos?: { x: number, y: number } | null;
    onMouseDown?: (e: React.MouseEvent) => void;
    onClose: () => void;
    onTriggerUpload: (mode: 'replace' | 'append') => void;
    bankFiles: any[];
    onRemoveSpecific: (file: any) => void;
    onRemoveAll: () => void;
}

export const BankManagerMenu: React.FC<BankManagerMenuProps> = ({
    menuRef,
    onClose,
    onTriggerUpload,
    bankFiles,
    onRemoveSpecific,
    onRemoveAll
}) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                ref={menuRef}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden animate-scale-in flex flex-col max-h-[90dvh]"
            >
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <FolderOpen className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Gerenciar Extratos</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Adicione, substitua ou remova arquivos</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        aria-label="Fechar"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="p-2 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                    <button 
                        onClick={() => onTriggerUpload('append')} 
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 w-full text-left transition-colors"
                    >
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <PlusCircleIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="block text-slate-900 dark:text-white">Adicionar arquivo</span>
                            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">Somar à lista atual</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => onTriggerUpload('replace')} 
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 w-full text-left transition-colors"
                    >
                        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <ArrowPathIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="block text-slate-900 dark:text-white">Substituir tudo</span>
                            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">Começar do zero</span>
                        </div>
                    </button>
                    
                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2"></div>
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Arquivos ativos ({bankFiles.length})
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 px-1">
                        {bankFiles.map((file, idx) => (
                            <div key={`${idx}-${file.fileName}`} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 group/file">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <DocumentDuplicateIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{file.fileName}</span>
                                </div>
                                <button 
                                    onClick={() => onRemoveSpecific(file)} 
                                    title="Remover arquivo"
                                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-100 sm:opacity-0 sm:group-hover/file:opacity-100 focus:opacity-100 transition-all shrink-0"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
                    <button 
                        onClick={onRemoveAll} 
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200/70 dark:hover:border-red-900/50 transition-all"
                    >
                        <TrashIcon className="w-4 h-4" />
                        <span>Excluir Tudo</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
