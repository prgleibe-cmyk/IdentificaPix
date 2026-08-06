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
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4">
            <div className="bg-white p-8 rounded-2xl shadow-card text-center max-w-md border border-red-100">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-xl font-display font-bold text-brand-graphite mb-2">Algo deu errado</h2>
                <p className="text-slate-500 mb-4">Ocorreu um erro inesperado. Tente recarregar a página.</p>
                {this.state.error && (
                  <p className="text-xs text-red-600 bg-red-50 p-3 rounded-lg mb-4 font-mono text-left overflow-auto max-h-40 break-all whitespace-pre-wrap">
                    {String(this.state.error?.message || this.state.error)}
                  </p>
                )}
                <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-brand-blue text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">Recarregar</button>
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