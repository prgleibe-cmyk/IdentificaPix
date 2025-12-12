
import React, { createContext, useState, useContext, useCallback, useEffect, useMemo } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { Theme, ViewType } from '../types';

interface UIContextType {
    theme: Theme;
    toggleTheme: () => void;
    activeView: ViewType;
    setActiveView: React.Dispatch<React.SetStateAction<ViewType>>;
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    toast: { message: string; type: 'success' | 'error' } | null;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

const UIContext = createContext<UIContextType>(null!);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = usePersistentState<Theme>('identificapix-theme', 'light');
    const [activeView, setActiveView] = useState<ViewType>('dashboard');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    const toggleTheme = useCallback(() => setTheme(prev => (prev === 'light' ? 'dark' : 'light')), [setTheme]);

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
    }), [theme, toggleTheme, activeView, isLoading, toast, showToast]);

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
