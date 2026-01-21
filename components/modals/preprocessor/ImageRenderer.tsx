
import React, { useState, useEffect, useRef } from 'react';
import { PhotoIcon, PlusCircleIcon, MinusIcon, ArrowPathIcon } from '../../Icons';

export const ImageRenderer: React.FC<{ file: File }> = ({ file }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
    const handleReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) handleZoomIn();
            else handleZoomOut();
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale <= 1 && position.x === 0 && position.y === 0) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const newX = e.clientX - dragStart.current.x;
        const newY = e.clientY - dragStart.current.y;
        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (!previewUrl) return null;

    return (
        <div 
            ref={containerRef}
            className="absolute inset-0 flex flex-col bg-slate-200 dark:bg-slate-950 overflow-hidden select-none"
            onWheel={handleWheel}
        >
            {/* Toolbar de Controle de Imagem */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl border border-white/20">
                <button 
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                    title="Diminuir Zoom"
                >
                    <MinusIcon className="w-5 h-5" />
                </button>
                <div className="px-3 min-w-[60px] text-center">
                    <span className="text-xs font-black text-slate-700 dark:text-white font-mono">
                        {Math.round(scale * 100)}%
                    </span>
                </div>
                <button 
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                    title="Aumentar Zoom"
                >
                    <PlusCircleIcon className="w-5 h-5" />
                </button>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                <button 
                    onClick={handleReset}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                    title="Resetar Visualização"
                >
                    <ArrowPathIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Área da Imagem com Pan e Zoom */}
            <div 
                className={`flex-1 relative cursor-${isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div 
                    className="absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out"
                    style={{ 
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: 'center center'
                    }}
                >
                    <img 
                        src={previewUrl} 
                        alt="Documento Original" 
                        className="max-w-[95%] max-h-[95%] object-contain shadow-2xl pointer-events-none"
                        draggable={false}
                    />
                </div>
            </div>

            {/* Footer Informativo */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3 z-10 pointer-events-none opacity-80">
                <PhotoIcon className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                    {scale > 1 ? 'Arraste para mover • Ctrl+Scroll para Zoom' : 'Conferência de Imagem'}
                </span>
            </div>
        </div>
    );
};
