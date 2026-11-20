
import React from 'react';
import { PhotoIcon, ArrowsRightLeftIcon, PlusCircleIcon } from '../Icons';

interface ReportHeaderSectionProps {
    logo: string | null;
    title: string;
    onLogoClick: () => void;
    onTitleChange: (val: string) => void;
    onAddColumn: () => void;
    onAddRow: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ReportHeaderSection: React.FC<ReportHeaderSectionProps> = ({ 
    logo, title, onLogoClick, onTitleChange, onAddColumn, onAddRow, fileInputRef, handleLogoUpload 
}) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 flex-shrink-0 gap-4">
        <div className="flex items-center gap-3.5 w-full">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-orange-500 group relative overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors flex-shrink-0" onClick={onLogoClick}>
                {logo ? <img src={logo} alt="Logo" className="w-full h-full object-contain" /> : <PhotoIcon className="w-7 h-7 text-slate-300 group-hover:text-orange-500 transition-colors" />}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </div>
            <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Título do Relatório</label>
                <input type="text" value={title} onChange={(e) => onTitleChange(e.target.value)} className="text-base md:text-lg font-bold text-slate-900 dark:text-white bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-300 w-full outline-none leading-tight" placeholder="DIGITE UM TÍTULO" />
            </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
            <button onClick={onAddColumn} className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"><ArrowsRightLeftIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> <span>Nova Coluna</span></button>
            <button onClick={onAddRow} className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 border border-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"><PlusCircleIcon className="w-3.5 h-3.5" /> <span>Adicionar Linha</span></button>
        </div>
    </div>
);
