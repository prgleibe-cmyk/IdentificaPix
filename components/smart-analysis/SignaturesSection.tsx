
import React from 'react';
import { XMarkIcon, PlusCircleIcon } from '../Icons';

interface SignaturesSectionProps {
    signatures: string[];
    onUpdateSignature: (idx: number, val: string) => void;
    onDeleteSignature: (idx: number) => void;
    onAddSignature: () => void;
}

export const SignaturesSection: React.FC<SignaturesSectionProps> = ({
    signatures, onUpdateSignature, onDeleteSignature, onAddSignature
}) => {
    const autoResizeTextarea = (element: HTMLTextAreaElement) => {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
    };

    return (
        <div className="mt-auto pt-4 border-t border-slate-200/80 dark:border-slate-800 flex-shrink-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Assinaturas (Rodapé)</p>
            <div className="flex flex-wrap items-end gap-8">
                {signatures.map((sig, idx) => (
                    <div key={idx} className="flex-1 min-w-[200px] max-w-xs group relative flex flex-col justify-end">
                        <div className="w-full border-t border-slate-800 dark:border-slate-400 mb-3"></div>
                        <textarea 
                            value={sig} 
                            onChange={(e) => onUpdateSignature(idx, e.target.value)} 
                            onInput={(e) => autoResizeTextarea(e.currentTarget)} 
                            rows={1} 
                            className="w-full text-center font-semibold text-xs text-slate-600 dark:text-slate-300 bg-transparent focus:outline-none uppercase resize-none overflow-hidden" 
                            placeholder={`CARGO / NOME`} 
                            style={{ minHeight: '24px' }} 
                        />
                        <button onClick={() => onDeleteSignature(idx)} className="absolute -top-6 right-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1 cursor-pointer"><XMarkIcon className="w-3 h-3" /></button>
                    </div>
                ))}
                <button onClick={onAddSignature} className="h-9 px-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-orange-600 hover:border-orange-500 hover:bg-orange-50/70 dark:hover:bg-orange-950/30 transition-colors flex items-center gap-1.5 mb-1 cursor-pointer"><PlusCircleIcon className="w-3.5 h-3.5" /> <span>Adicionar</span></button>
            </div>
        </div>
    );
};
