
import React from 'react';
import { 
    TrashIcon, 
    PlusCircleIcon, 
    ArrowPathIcon, 
    DocumentDuplicateIcon, 
    ArrowsRightLeftIcon, 
    XMarkIcon 
} from '../Icons';

interface BankManagerMenuProps {
    menuRef: React.RefObject<HTMLDivElement | null>;
    menuPos: { x: number, y: number } | null;
    onMouseDown: (e: React.MouseEvent) => void;
    onClose: () => void;
    onTriggerUpload: (mode: 'replace' | 'append') => void;
    bankFiles: any[];
    onRemoveSpecific: (file: any) => void;
    onRemoveAll: () => void;
}

export const BankManagerMenu: React.FC<BankManagerMenuProps> = ({
    menuRef,
    menuPos,
    onMouseDown,
    onClose,
    onTriggerUpload,
    bankFiles,
    onRemoveSpecific,
    onRemoveAll
}) => {
    return (
        <div 
            ref={menuRef} 
            style={{ 
                position: 'fixed', 
                left: menuPos ? menuPos.x : '50%', 
                top: menuPos ? menuPos.y : '50%', 
                transform: menuPos ? 'none' : 'translate(-50%, -50%)', 
                zIndex: 9999, 
                width: '280px' 
            }} 
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-scale-in"
        >
            <div onMouseDown={onMouseDown} className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between cursor-move select-none">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <ArrowsRightLeftIcon className="w-3 h-3 rotate-45" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Gerenciar Extratos</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-4 h-4" /></button>
            </div>
            
            <div className="flex flex-col py-1">
                <button onClick={() => onTriggerUpload('append')} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors">
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500"><PlusCircleIcon className="w-4 h-4" /></div>
                    <div><span className="block">Adicionar arquivo</span><span className="text-[9px] font-normal text-slate-400">Somar à lista atual</span></div>
                </button>
                <button onClick={() => onTriggerUpload('replace')} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full text-left transition-colors">
                    <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-500"><ArrowPathIcon className="w-4 h-4" /></div>
                    <div><span className="block">Substituir tudo</span><span className="text-[9px] font-normal text-slate-400">Começar do zero</span></div>
                </button>
                
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-4"></div>
                <div className="px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Arquivos Ativos ({bankFiles.length}):</div>
                
                <div className="max-h-32 overflow-y-auto custom-scrollbar">
                    {bankFiles.map((file, idx) => (
                        <div key={`${idx}-${file.fileName}`} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 group/file">
                            <div className="flex items-center gap-2 min-w-0">
                                <DocumentDuplicateIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[140px]">{file.fileName}</span>
                            </div>
                            <button onClick={() => onRemoveSpecific(file)} className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover/file:opacity-100 transition-opacity"><TrashIcon className="w-3 h-3" /></button>
                        </div>
                    ))}
                </div>
                
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-4"></div>
                <button onClick={onRemoveAll} className="flex items-center gap-3 px-4 py-3 text-xs font-bold w-full text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500"><TrashIcon className="w-3.5 h-3.5" /></div>
                    <span>Excluir Tudo</span>
                </button>
            </div>
        </div>
    );
};
