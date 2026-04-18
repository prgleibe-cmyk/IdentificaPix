
import { useContext } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppContext } from '../contexts/AppContext';

export const useSessionController = () => {
    const { session, loading } = useAuth();
    return { session, loading };
};

export const useContentController = () => {
    const { isLoading, toast } = useUI();
    const context = useContext(AppContext);
    
    // Fallback seguro se o context não estiver pronto (embora deva estar dentro do Provider)
    const initialDataLoaded = context?.initialDataLoaded ?? false;

    return { 
        isLoading, 
        initialDataLoaded,
        toast
    };
};
