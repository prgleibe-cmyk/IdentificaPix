
import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';

export function usePersistentState<T>(key: string, initialValue: T, isHeavy: boolean = false): [T, React.Dispatch<React.SetStateAction<T>>] {
    // Inicialização "Lazy": Se não for pesado (localStorage), lê imediatamente antes do primeiro render.
    // Isso garante que os dados apareçam instantaneamente, sem efeito "pisca".
    const [state, setState] = useState<T>(() => {
        if (isHeavy) return initialValue; // Dados pesados (IndexedDB) ainda precisam ser assíncronos
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

    useEffect(() => {
        isMounted.current = true;
        
        const hydrate = async () => {
            // Se não for pesado, já lemos no useState inicial, então marcamos como hidratado.
            if (!isHeavy) {
                isHydrated.current = true;
                return;
            }

            try {
                // Timeout de 2s para IndexedDB (evita travamento infinito)
                const idbPromise = get(key);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject("timeout"), 2000));
                const value = await Promise.race([idbPromise, timeoutPromise]) as T | undefined;

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
