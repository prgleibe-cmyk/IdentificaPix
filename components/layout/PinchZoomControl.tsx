import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Search } from 'lucide-react';
import { UsePinchZoomReturn } from '../../hooks/usePinchZoom';

interface PinchZoomControlProps {
    pinchState: UsePinchZoomReturn;
}

export const PinchZoomControl: React.FC<PinchZoomControlProps> = ({ pinchState }) => {
    const { zoom, zoomIn, zoomOut, resetZoom, showControl, setShowControl, isPinching } = pinchState;
    const [isHovered, setIsHovered] = useState(false);

    // If zoom is 100% and user is not interacting, keep it hidden or subtle
    const isDefaultZoom = Math.abs(zoom - 1.0) < 0.01;
    const isVisible = showControl || isHovered || isPinching || !isDefaultZoom;

    if (!isVisible) {
        return (
            <button
                type="button"
                onClick={() => setShowControl(true)}
                className="fixed bottom-4 right-4 z-40 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-full shadow-md hover:bg-orange-500 hover:text-white transition-all cursor-pointer opacity-40 hover:opacity-100 hidden sm:flex items-center justify-center"
                title="Ajustar Zoom da Tela"
            >
                <Search className="w-4 h-4" />
            </button>
        );
    }

    const percentage = Math.round(zoom * 100);

    return (
        <aside
            aria-label="Controle de Zoom da Tela"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 p-1.5 bg-slate-900/90 dark:bg-slate-950/95 text-white backdrop-blur-md rounded-2xl shadow-xl border border-white/10 text-xs animate-fade-in select-none"
        >
            <button
                type="button"
                onClick={zoomOut}
                disabled={zoom <= 0.75}
                className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Diminuir Zoom"
            >
                <ZoomOut className="w-4 h-4" />
            </button>

            <button
                type="button"
                onClick={resetZoom}
                className="px-2 py-1 font-mono font-black text-[11px] hover:bg-white/10 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                title="Clique para restaurar 100%"
            >
                <span>{percentage}%</span>
                {!isDefaultZoom && (
                    <RotateCcw className="w-3 h-3 text-orange-400" />
                )}
            </button>

            <button
                type="button"
                onClick={zoomIn}
                disabled={zoom >= 2.0}
                className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Aumentar Zoom"
            >
                <ZoomIn className="w-4 h-4" />
            </button>
        </aside>
    );
};
