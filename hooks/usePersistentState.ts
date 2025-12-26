

import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';

export function usePersistentState<T>(key: string, initialValue: T, isHeavy: boolean = false): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(initialValue);
    const isHydrated = useRef(false);
    const isMounted = useRef(false);
    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        isMounted.current = true;
        
        const hydrate = async () => {
            try {
                let value: T | undefined;
                if (isHeavy) {
                    // Timeout de 2s para IndexedDB (evita travamento infinito)
                    const idbPromise = get(key);
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject("timeout"), 2000));
                    value = await Promise.race([idbPromise, timeoutPromise]) as T | undefined;
                } else {
                    const item = window.localStorage.getItem(key);
                    if (item) value = JSON.parse(item);
                }

                if (isMounted.current && value !== undefined && value !== null) {
                    setState(value);
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
        // Só salva se já estiver hidratado e montado
        if (!isHydrated.current || !isMounted.current) return;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Debounce de salvamento para evitar loops agressivos
        timeoutRef.current = setTimeout(async () => {
            try {
                if (isHeavy) {
                    await set(key, state);
                } else {
                    window.localStorage.setItem(key, JSON.stringify(state));
                }
            } catch (error) {
                console.error(`Erro salvamento ${key}:`, error);
            }
        }, 1000);

        return () => clearTimeout(timeoutRef.current);
    }, [key, state, isHeavy]);

    return [state, setState];
}