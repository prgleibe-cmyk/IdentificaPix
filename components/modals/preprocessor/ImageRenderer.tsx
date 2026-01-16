
import React, { useState, useEffect } from 'react';
import { PhotoIcon } from '../../Icons';

export const ImageRenderer: React.FC<{ file: File }> = ({ file }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    if (!previewUrl) return null;

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950/50 p-4 overflow-hidden">
            <div className="flex-1 w-full h-full relative">
                <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="absolute inset-0 w-full h-full object-contain" 
                />
            </div>
            <div className="mt-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-2 px-4 rounded-full shadow-lg border border-amber-100 dark:border-amber-900/30 text-center z-10 shrink-0">
                <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                    <PhotoIcon className="w-4 h-4" />
                    <span className="font-bold text-[10px] uppercase tracking-wide">Arquivo de Imagem</span>
                </div>
            </div>
        </div>
    );
};
