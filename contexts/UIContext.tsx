
import React, { createContext, useState, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { Theme, ViewType } from '../types';

interface ParsingProgress {
    current: number;
    total: number;
    label: string;
}

interface UIContextType {
    theme: Theme;
    toggleTheme: () => void;
    activeView: ViewType;
    setActiveView: React.Dispatch<React.SetStateAction<ViewType>>;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    parsingProgress: ParsingProgress | null;
    setParsingProgress: (progress: ParsingProgress | null) => void;
    toast: { message: string; type: 'success' | 'error' } | null;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

const UIContext = createContext<UIContextType>(null!);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = usePersistentState<Theme>('identificapix-theme', 'light');
    const [activeView, setActiveView] = useState<ViewType>('dashboard');
    const [isLoading, setIsLoadingState] = useState<boolean>(false);
    const [parsingProgress, setParsingProgress] = useState<ParsingProgress | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    const loadingTimeoutRef = useRef<any>(null);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = useCallback(() => setTheme(prev => (prev === 'light' ? 'dark' : 'light')), [setTheme]);

    const setIsLoading = useCallback((loading: boolean) => {
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        
        if (loading) {
            setIsLoadingState(true);
        } else {
            loadingTimeoutRef.current = setTimeout(() => {
                setIsLoadingState(false);
            }, 300);
        }
    }, []);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const value = useMemo(() => ({
        theme,
        toggleTheme,
        activeView,
        setActiveView,
        isLoading,
        setIsLoading,
        parsingProgress,
        setParsingProgress,
        toast,
        showToast
    }), [theme, toggleTheme, activeView, isLoading, setIsLoading, parsingProgress, setParsingProgress, toast, showToast]);

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
