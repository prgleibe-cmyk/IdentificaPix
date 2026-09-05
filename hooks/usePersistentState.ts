
import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';

export function usePersistentState<T>(key: string, initialValue: T, isHeavy: boolean = false): [T, React.Dispatch<React.SetStateAction<T>>] {
    const isArrayExpected = Array.isArray(initialValue);

    const sanitize = (val: any): T => {
        if (val === undefined || val === null) return initialValue;
        if (isArrayExpected && !Array.isArray(val)) return initialValue;
        return val as T;
    };

    const parseRaw = (raw: string | null): T => {
        if (!raw) return initialValue;
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data !== undefined && parsed.data !== null) {
                return sanitize(parsed.data);
            }
            return sanitize(parsed);
        } catch {
            return initialValue;
        }
    };

    const [state, setState] = useState<T>(() => {
        try {
            if (typeof window === 'undefined') return initialValue;
            const cached = window.localStorage.getItem(key);
            return parseRaw(cached);
        } catch (error) {
            return initialValue;
        }
    });

    const isHydrated = useRef(false);
    const hasExternalUpdateRef = useRef(false);
    const isMounted = useRef(false);
    const timeoutRef = useRef<any>(null);
    const lastSavedValue = useRef<string>('');
    const currentKeyRef = useRef(key);

    // 🛡️ BLINDAGEM DE ISOLAMENTO: Redefine imediatamente o estado se a chave do usuário mudar
    if (currentKeyRef.current !== key) {
        currentKeyRef.current = key;
        isHydrated.current = false;
        hasExternalUpdateRef.current = false;
        lastSavedValue.current = '';
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        const cached = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
        setState(parseRaw(cached));
    }

    useEffect(() => {
        isMounted.current = true;
        isHydrated.current = false; // Reset hydration flag when key changes
        hasExternalUpdateRef.current = false; // Reset external update flag when key changes
        
        const hydrate = async () => {
            if (!isHeavy) {
                try {
                    if (typeof window !== 'undefined') {
                        const item = window.localStorage.getItem(key);
                        const value = parseRaw(item);
                        if (isMounted.current) {
                            if (!hasExternalUpdateRef.current) {
                                setState(value);
                                lastSavedValue.current = JSON.stringify(value);
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Erro hidratação leve ${key}:`, error);
                }
                isHydrated.current = true;
                return;
            }

            try {
                const idbPromise = get(key);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject("timeout"), 2500));
                const rawValue = await Promise.race([idbPromise, timeoutPromise]) as any;
                const value = sanitize(rawValue);

                if (isMounted.current && value !== undefined && value !== null) {
                    if (!hasExternalUpdateRef.current) {
                        setState(value);
                        lastSavedValue.current = JSON.stringify(value);
                    }
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

        // Persistência rápida e ágil para sincronização limpa em tempo real
        const delay = isHeavy ? 300 : 150;

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

    const setPersistedState: React.Dispatch<React.SetStateAction<T>> = React.useCallback((value) => {
        hasExternalUpdateRef.current = true;
        setState(value);
    }, []);

    return [state, setPersistedState];
}
