import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// 🔥 Log para confirmar carregamento
console.log('✅ AppContext.tsx foi carregado!');

// Tipos do contexto
interface AppContextType {
  banco: string | null;
  igreja: string | null;
  setBanco: (valor: string | null) => void;
  setIgreja: (valor: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [banco, setBanco] = useState<string | null>(() => localStorage.getItem('banco'));
  const [igreja, setIgreja] = useState<string | null>(() => localStorage.getItem('igreja'));

  // 🔥 Logar sempre que for renderizado
  useEffect(() => {
    console.log('🔥 AppProvider foi inicializado');
  }, []);

  // Persistência local (simples, sem Supabase ainda)
  useEffect(() => {
    if (banco) localStorage.setItem('banco', banco);
  }, [banco]);

  useEffect(() => {
    if (igreja) localStorage.setItem('igreja', igreja);
  }, [igreja]);

  return (
    <AppContext.Provider value={{ banco, igreja, setBanco, setIgreja }}>
      {children}
    </AppContext.Provider>
  );
};

// Hook auxiliar para usar o contexto
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext deve ser usado dentro de um <AppProvider>');
  }
  return context;
};