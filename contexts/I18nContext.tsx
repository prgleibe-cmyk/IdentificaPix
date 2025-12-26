
import React, { createContext, useState, useCallback, useContext } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { translations } from '../lib/translations';
import { Language } from '../types';

export type TranslationKey = keyof typeof translations.pt;

// Define the shape of the context
interface I18nContextType {
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Language) => void;
  language: Language;
};

// Create the context with a null default value
export const I18nContext = createContext<I18nContextType | null>(null);

// Custom hook to use the i18n context
export const useTranslation = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error("useTranslation must be used within an I18nProvider");
    }
    return context;
};

// Provider component that wraps the application
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = usePersistentState<Language>('identificapix-lang', 'pt');

    // useCallback ensures the translation function 't' is memoized
    const t = useCallback((key: TranslationKey) => {
        return translations[language][key] || key;
    }, [language]);
    
    const value = { t, setLanguage, language };

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
};