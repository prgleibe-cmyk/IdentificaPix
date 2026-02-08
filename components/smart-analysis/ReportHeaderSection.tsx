
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
    <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-4">
        <div className="flex items-center gap-4 w-full">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-brand-blue group relative overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors flex-shrink-0" onClick={onLogoClick}>
                {logo ? <img src={logo} alt="Logo" className="w-full h-full object-contain" /> : <PhotoIcon className="w-8 h-8 text-slate-300 group-hover:text-brand-blue transition-colors" />}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </div>
            <div className="flex-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 ml-1">TÍTULO DO RELATÓRIO</label>
                <input type="text" value={title} onChange={(e) => onTitleChange(e.target.value)} className="text-lg md:text-xl font-black text-slate-800 dark:text-white bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-300 w-full outline-none leading-tight" placeholder="DIGITE UM TÍTULO" />
            </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
            <button onClick={onAddColumn} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 hover:from-slate-500 hover:via-slate-600 hover:to-slate-700 border border-slate-500 text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-slate-500/20 transition-all hover:shadow-xl active:scale-95"><ArrowsRightLeftIcon className="w-3.5 h-3.5" /> <span>Nova Coluna</span></button>
            <button onClick={onAddRow} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0F4C75] to-[#3282B8] hover:from-[#165D8C] hover:to-[#4FA2D6] border border-[#0F4C75] text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-cyan-900/20 transition-all hover:shadow-xl active:scale-95"><PlusCircleIcon className="w-4 h-4" /> <span>Adicionar Linha</span></button>
        </div>
    </div>
);
