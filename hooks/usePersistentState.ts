
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { get, set } from 'idb-keyval';

/**
 * Hook otimizado para SaaS.
 * Dados leves (preferências, tema) -> LocalStorage (Síncrono, instantâneo)
 * Dados pesados (extratos, listas) -> IndexedDB (Assíncrono, não trava a tela)
 */
export function usePersistentState<T>(key: string, initialValue: T, isHeavy: boolean = false): [T, React.Dispatch<React.SetStateAction<T>>] {
    // Inicializa com o valor padrão
    const [state, setState] = useState<T>(initialValue);
    const [isHydrated, setIsHydrated] = useState(false);
    
    // Refs para evitar re-renders desnecessários e loops de dependência
    const isMounted = useRef(false);
    const stateRef = useRef(state);

    // Mantém o ref atualizado com o valor mais recente
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // 1. Hidratação (Carregar dados) - Executa ao montar ou mudar a chave
    useEffect(() => {
        isMounted.current = true;
        setIsHydrated(false);

        const hydrate = async () => {
            try {
                let value: T | undefined;

                if (isHeavy) {
                    // Leitura Assíncrona do IndexedDB
                    value = await get(key);
                } else {
                    // Leitura Síncrona do LocalStorage
                    const item = window.localStorage.getItem(key);
                    if (item) {
                        value = JSON.parse(item);
                    }
                }

                if (isMounted.current) {
                    if (value !== undefined && value !== null) {
                        // FIX CRÍTICO PARA LOOP:
                        // Compara o valor atual (via functional update) com o novo valor.
                        // Se o conteúdo JSON for idêntico, retorna o estado anterior (mesma referência).
                        // Isso impede que o React renderize novamente.
                        setState(prev => {
                            try {
                                if (JSON.stringify(prev) === JSON.stringify(value)) {
                                    return prev;
                                }
                            } catch (e) {
                                // Se falhar ao comparar (circular ref), atualiza assim mesmo
                            }
                            stateRef.current = value as T;
                            return value as T;
                        });
                    }
                    setIsHydrated(true);
                }
            } catch (error) {
                console.warn(`Erro ao carregar estado para ${key}:`, error);
                if (isMounted.current) setIsHydrated(true);
            }
        };

        hydrate();

        return () => { isMounted.current = false; };
    }, [key, isHeavy]);

    // 2. Persistência (Salvar dados)
    useEffect(() => {
        // Só salva se já estiver hidratado para evitar sobrescrever dados com o valor inicial
        if (!isHydrated) return;

        const save = async () => {
            try {
                if (isHeavy) {
                    await set(key, state);
                } else {
                    window.localStorage.setItem(key, JSON.stringify(state));
                }
            } catch (error) {
                console.error(`Erro ao salvar estado para ${key}:`, error);
            }
        };

        // Debounce aumentado para 1s para reduzir pressão no disco local durante edições rápidas
        const timeoutId = setTimeout(save, 1000);
        return () => clearTimeout(timeoutId);

    }, [key, state, isHeavy, isHydrated]);

    return [state, setState];
}
