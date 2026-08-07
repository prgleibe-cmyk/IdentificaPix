import React, { ReactNode } from 'react';
import { I18nProvider } from './I18nContext';
import { AuthProvider } from './AuthContext';
import { UIProvider } from './UIContext';
import { AppProvider } from './AppContext';
import { ExclamationTriangleIcon } from '../components/Icons';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: any;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error in SessionProvider:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || String(this.state.error || 'Erro desconhecido');
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl text-center max-w-lg border border-red-100 dark:border-red-900/30 w-full">
                <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mb-4">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2">Algo deu errado</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">Ocorreu um erro inesperado ao carregar a aplicação.</p>
                
                {errorMsg && (
                    <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl text-left">
                        <p className="text-xs font-mono text-red-700 dark:text-red-300 break-words">{errorMsg}</p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="w-full sm:w-auto px-6 py-2.5 bg-brand-blue text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 text-sm"
                    >
                        Recarregar Página
                    </button>
                    <button 
                        onClick={() => {
                            try {
                                localStorage.clear();
                                sessionStorage.clear();
                            } catch (e) {}
                            window.location.href = '/';
                        }} 
                        className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                    >
                        Limpar Cache e Recarregar
                    </button>
                </div>
            </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Providers Wrappers ---

export const RootProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <I18nProvider>
        <AuthProvider>
            {children}
        </AuthProvider>
    </I18nProvider>
);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ErrorBoundary>
        <AppProvider>
            {children}
        </AppProvider>
    </ErrorBoundary>
);