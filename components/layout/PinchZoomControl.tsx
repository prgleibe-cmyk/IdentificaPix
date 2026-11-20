import React, { useState, useContext, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Search, GripVertical } from 'lucide-react';
import { UsePinchZoomReturn } from '../../hooks/usePinchZoom';
import { AppContext } from '../../contexts/AppContext';

interface PinchZoomControlProps {
    pinchState: UsePinchZoomReturn;
}

export const PinchZoomControl: React.FC<PinchZoomControlProps> = ({ pinchState }) => {
    const { zoom, zoomIn, zoomOut, resetZoom, showControl, setShowControl, isPinching } = pinchState;
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    
    const dragRef = useRef<{
        isPointerDown: boolean;
        startX: number;
        startY: number;
        initialPosX: number;
        initialPosY: number;
        hasMoved: boolean;
    }>({
        isPointerDown: false,
        startX: 0,
        startY: 0,
        initialPosX: 0,
        initialPosY: 0,
        hasMoved: false
    });

    const context = useContext(AppContext);

    // Hide zoom controls entirely when any modal / dialog is active
    const hasActiveModal = Boolean(
        context?.deletingItem ||
        context?.editingBank ||
        context?.editingChurch ||
        context?.manualMatchState ||
        context?.savingReportState ||
        context?.isSearchFiltersOpen ||
        context?.divergenceConfirmation ||
        context?.isPaymentModalOpen ||
        context?.isWhatsAppReceiptModalOpen ||
        (context?.bulkIdentificationTxs && context.bulkIdentificationTxs.length > 0)
    );

    // Reposition safely on window resize if custom position is set
    useEffect(() => {
        const handleResize = () => {
            if (!position || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width - 8;
            const maxY = window.innerHeight - rect.height - 8;
            setPosition(prev => {
                if (!prev) return null;
                return {
                    x: Math.max(8, Math.min(maxX, prev.x)),
                    y: Math.max(8, Math.min(maxY, prev.y))
                };
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [position]);

    if (hasActiveModal) return null;

    // If zoom is 100% and user is not interacting, keep it hidden or subtle
    const isDefaultZoom = Math.abs(zoom - 1.0) < 0.01;
    const isVisible = showControl || isHovered || isPinching || !isDefaultZoom;

    if (!isVisible) {
        return (
            <button
                type="button"
                onClick={() => setShowControl(true)}
                className="fixed bottom-4 right-4 z-30 p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl shadow-card hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:hover:bg-orange-950/40 dark:hover:text-orange-400 transition-all cursor-pointer opacity-60 hover:opacity-100 hidden sm:flex items-center justify-center"
                title="Ajustar Zoom da Tela"
            >
                <Search className="w-4 h-4" />
            </button>
        );
    }

    const percentage = Math.round(zoom * 100);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        
        const elem = containerRef.current;
        if (!elem) return;

        const rect = elem.getBoundingClientRect();
        
        dragRef.current = {
            isPointerDown: true,
            startX: e.clientX,
            startY: e.clientY,
            initialPosX: rect.left,
            initialPosY: rect.top,
            hasMoved: false
        };

        try {
            elem.setPointerCapture(e.pointerId);
        } catch {
            // Fallback safe
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current.isPointerDown) return;

        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (dist > 4) {
            dragRef.current.hasMoved = true;
            setIsDragging(true);
        }

        if (dragRef.current.hasMoved && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const elemWidth = rect.width || 180;
            const elemHeight = rect.height || 44;

            const nextX = dragRef.current.initialPosX + deltaX;
            const nextY = dragRef.current.initialPosY + deltaY;

            const clampedX = Math.max(8, Math.min(window.innerWidth - elemWidth - 8, nextX));
            const clampedY = Math.max(8, Math.min(window.innerHeight - elemHeight - 8, nextY));

            setPosition({ x: clampedX, y: clampedY });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragRef.current.isPointerDown) return;
        
        try {
            containerRef.current?.releasePointerCapture(e.pointerId);
        } catch {
            // Fallback safe
        }

        dragRef.current.isPointerDown = false;
        setTimeout(() => {
            setIsDragging(false);
            dragRef.current.hasMoved = false;
        }, 50);
    };

    const handleActionClick = (action: () => void) => (e: React.MouseEvent) => {
        if (dragRef.current.hasMoved || isDragging) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        action();
    };

    return (
        <aside
            ref={containerRef}
            aria-label="Controle de Zoom da Tela"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={
                position
                    ? {
                          left: `${position.x}px`,
                          top: `${position.y}px`,
                          bottom: 'auto',
                          right: 'auto',
                          touchAction: 'none'
                      }
                    : {
                          touchAction: 'none'
                      }
            }
            className={`fixed ${!position ? 'bottom-4 right-4' : ''} z-40 flex items-center gap-1 p-1.5 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 backdrop-blur-md rounded-xl shadow-elevated border border-slate-200/90 dark:border-slate-700 text-xs animate-fade-in select-none cursor-grab active:cursor-grabbing transition-shadow ${
                isDragging ? 'ring-2 ring-orange-500/40 scale-[1.02]' : ''
            }`}
            title="Arraste para mover para qualquer lugar da tela"
        >
            {/* Grip handle indicator */}
            <div 
                className="pl-1 pr-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex items-center justify-center cursor-grab active:cursor-grabbing"
                title="Arraste para reposicionar"
            >
                <GripVertical className="w-3.5 h-3.5" />
            </div>

            <button
                type="button"
                onClick={handleActionClick(zoomOut)}
                disabled={zoom <= 0.75}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-600 dark:text-slate-300"
                title="Diminuir Zoom"
            >
                <ZoomOut className="w-4 h-4" />
            </button>

            <button
                type="button"
                onClick={handleActionClick(resetZoom)}
                className="px-2 py-1 tabular-nums font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-slate-900 dark:text-white"
                title="Clique para restaurar 100%"
            >
                <span>{percentage}%</span>
                {!isDefaultZoom && (
                    <RotateCcw className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                )}
            </button>

            <button
                type="button"
                onClick={handleActionClick(zoomIn)}
                disabled={zoom >= 2.0}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-600 dark:text-slate-300"
                title="Aumentar Zoom"
            >
                <ZoomIn className="w-4 h-4" />
            </button>
        </aside>
    );
};
