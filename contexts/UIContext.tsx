
import React, { createContext, useState, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { Theme, ViewType } from '../types';

interface UIContextType {
    theme: Theme;
    toggleTheme: () => void;
    activeView: ViewType;
    setActiveView: React.Dispatch<React.SetStateAction<ViewType>>;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    toast: { message: string; type: 'success' | 'error' } | null;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

const UIContext = createContext<UIContextType>(null!);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // MUDANÇA: Padrão alterado para 'light' para criar o contraste (Sidebar Escura / Conteúdo Claro)
    const [theme, setTheme] = usePersistentState<Theme>('identificapix-theme', 'light');
    const [activeView, setActiveView] = useState<ViewType>('dashboard');
    const [isLoading, setIsLoadingState] = useState<boolean>(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    // Ref para controlar timeouts do loading
    const loadingTimeoutRef = useRef<any>(null);

    useEffect(() => {
        // Garante que a classe dark seja aplicada no HTML
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
        toast,
        showToast
    }), [theme, toggleTheme, activeView, isLoading, setIsLoading, toast, showToast]);

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
