
import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';

export function usePersistentState<T>(key: string, initialValue: T, isHeavy: boolean = false): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        if (isHeavy) return initialValue;
        try {
            if (typeof window !== 'undefined') {
                const item = window.localStorage.getItem(key);
                return item ? JSON.parse(item) : initialValue;
            }
        } catch (error) {
            console.warn(`Erro ao ler ${key} do localStorage:`, error);
        }
        return initialValue;
    });

    const isHydrated = useRef(false);
    const isMounted = useRef(false);
    const timeoutRef = useRef<any>(null);
    const lastSavedValue = useRef<string>('');

    useEffect(() => {
        isMounted.current = true;
        
        const hydrate = async () => {
            if (!isHeavy) {
                isHydrated.current = true;
                return;
            }

            try {
                const idbPromise = get(key);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject("timeout"), 2500));
                const value = await Promise.race([idbPromise, timeoutPromise]) as T | undefined;

                if (isMounted.current && value !== undefined && value !== null) {
                    setState(value);
                    lastSavedValue.current = JSON.stringify(value);
                }
            } catch (error) {
                console.warn(`Erro hidratação ${key}:`, error);
            } finally {
                if (isMounted.current) isHydrated.current = true;
            }
        };

        hydrate();
        return () => { isMounted.current = false; };
    }, [key, isHeavy]);

    useEffect(() => {
        if (!isHydrated.current || !isMounted.current) return;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Otimização: Aumenta o delay para dados pesados (2s) vs leves (500ms)
        const delay = isHeavy ? 2000 : 500;

        timeoutRef.current = setTimeout(() => {
            // Executa em idle para não bloquear a UI
            const performSave = async () => {
                try {
                    const serialized = JSON.stringify(state);
                    // Evita escritas desnecessárias se o dado não mudou
                    if (serialized === lastSavedValue.current) return;

                    if (isHeavy) {
                        await set(key, state);
                    } else {
                        window.localStorage.setItem(key, serialized);
                    }
                    lastSavedValue.current = serialized;
                } catch (error) {
                    console.error(`Erro salvamento ${key}:`, error);
                }
            };

            // Fallback para requestIdleCallback
            if (typeof window !== 'undefined' && (window as any).requestIdleCallback) {
                (window as any).requestIdleCallback(performSave, { timeout: 1000 });
            } else {
                setTimeout(performSave, 0);
            }

        }, delay);

        return () => clearTimeout(timeoutRef.current);
    }, [key, state, isHeavy]);

    return [state, setState];
}
