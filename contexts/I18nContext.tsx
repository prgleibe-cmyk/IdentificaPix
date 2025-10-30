import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { translations } from '../lib/translations';
import { Language } from '../types';

export type TranslationKey = keyof typeof translations.pt;

interface I18nContextType {
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Language) => void;
  language: Language;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export const useTranslation = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error("useTranslation must be used within an I18nProvider");
    }
    return context;
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = usePersistentState<Language>('identificapix-lang', 'pt');

    const t = useCallback(
        (key: TranslationKey) => translations[language][key] || key,
        [language]
    );

    const value: I18nContextType = { t, setLanguage, language };

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
};
