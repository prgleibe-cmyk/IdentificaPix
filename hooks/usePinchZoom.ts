import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.0;
const STEP = 0.1;
const STORAGE_KEY = 'iggestor_user_zoom_level';

export interface UsePinchZoomReturn {
    zoom: number;
    isPinching: boolean;
    showControl: boolean;
    setShowControl: (show: boolean) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    setZoomLevel: (value: number) => void;
}

export function usePinchZoom(containerRef: React.RefObject<HTMLElement | null>): UsePinchZoomReturn {
    const [zoom, setZoom] = useState<number>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = parseFloat(saved);
                if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
                    return parsed;
                }
            }
        } catch (_) {}
        return 1.0;
    });

    const [isPinching, setIsPinching] = useState(false);
    const [showControl, setShowControl] = useState(false);

    const initialDistanceRef = useRef<number | null>(null);
    const initialZoomRef = useRef<number>(1.0);
    const hideTimeoutRef = useRef<any>(null);

    const triggerShowControl = useCallback(() => {
        setShowControl(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
            setShowControl(false);
        }, 3500);
    }, []);

    const updateZoom = useCallback((newZoom: number) => {
        const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(newZoom * 100) / 100));
        setZoom(clamped);
        try {
            localStorage.setItem(STORAGE_KEY, clamped.toString());
        } catch (_) {}
        triggerShowControl();
    }, [triggerShowControl]);

    const zoomIn = useCallback(() => {
        updateZoom(zoom + STEP);
    }, [zoom, updateZoom]);

    const zoomOut = useCallback(() => {
        updateZoom(zoom - STEP);
    }, [zoom, updateZoom]);

    const resetZoom = useCallback(() => {
        updateZoom(1.0);
    }, [updateZoom]);

    const setZoomLevel = useCallback((val: number) => {
        updateZoom(val);
    }, [updateZoom]);

    // Touch events for two-finger pinch gesture
    useEffect(() => {
        const element = containerRef.current || document.getElementById('main-scroll-container') || document.body;
        if (!element) return;

        const getDistance = (touch1: Touch, touch2: Touch) => {
            return Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                const dist = getDistance(e.touches[0], e.touches[1]);
                initialDistanceRef.current = dist;
                initialZoomRef.current = zoom;
                setIsPinching(true);
                triggerShowControl();
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && initialDistanceRef.current !== null) {
                const currentDist = getDistance(e.touches[0], e.touches[1]);
                if (initialDistanceRef.current > 0) {
                    const factor = currentDist / initialDistanceRef.current;
                    const calculatedZoom = initialZoomRef.current * factor;
                    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(calculatedZoom * 100) / 100));
                    setZoom(clamped);
                    try {
                        localStorage.setItem(STORAGE_KEY, clamped.toString());
                    } catch (_) {}
                    triggerShowControl();
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) {
                initialDistanceRef.current = null;
                setIsPinching(false);
            }
        };

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: true });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });
        element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchcancel', handleTouchEnd);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [containerRef, zoom, triggerShowControl]);

    return {
        zoom,
        isPinching,
        showControl,
        setShowControl,
        zoomIn,
        zoomOut,
        resetZoom,
        setZoomLevel
    };
}
