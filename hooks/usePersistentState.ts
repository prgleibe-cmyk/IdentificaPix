
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { get, set } from 'idb-keyval';

/**
 * Hook otimizado para SaaS.
 * Dados leves (preferências, tema) -> LocalStorage (Síncrono, instantâneo)
 * Dados pesados (extratos, listas) -> IndexedDB (Assíncrono, não trava a tela)
 */
export function usePersistentState<T>(key: string, initialValue: T, isHeavy: boolean = false): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(initialValue);
    const [isHydrated, setIsHydrated] = useState(false);
    const isFirstRender = useRef(true);

    // 1. Hidratação (Leitura Inicial e Mudança de Chave)
    useEffect(() => {
        let isActive = true;
        // Resetar status de hidratação ao mudar a chave para evitar salvar dados antigos na nova chave
        setIsHydrated(false);

        const hydrate = async () => {
            try {
                let value: T | undefined;

                if (isHeavy) {
                    // Leitura Assíncrona do IndexedDB (Não bloqueia UI)
                    value = await get(key);
                } else {
                    // Leitura Síncrona do LocalStorage (Instantânea para UI)
                    const item = window.localStorage.getItem(key);
                    if (item) {
                        value = JSON.parse(item);
                    }
                }

                if (isActive) {
                    if (value !== undefined) {
                        setState(value);
                    } else {
                        // SE A CHAVE MUDOU E NÃO TEM DADOS, RESETA PARA O INICIAL.
                        // Isso é crucial para o multi-usuário funcionar corretamente.
                        // Se User A sai e User B entra, 'key' muda. Se User B não tem dados,
                        // ele deve começar com 'initialValue', e não herdar o estado do User A.
                        setState(initialValue);
                    }
                }
            } catch (error) {
                console.warn(`Erro ao carregar estado para ${key}:`, error);
                if (isActive) setState(initialValue);
            } finally {
                if (isActive) setIsHydrated(true);
            }
        };

        hydrate();

        return () => { isActive = false; };
    }, [key, isHeavy]); // initialValue intencionalmente omitido para evitar loops se for objeto literal

    // 2. Persistência (Escrita)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Não salvar se ainda não leu do disco ou se a chave acabou de mudar (evita sobrescrever com estado errado)
        if (!isHydrated) return;

        const save = async () => {
            try {
                if (isHeavy) {
                    // Escrita Assíncrona no IndexedDB
                    await set(key, state);
                } else {
                    // Escrita Síncrona no LocalStorage
                    window.localStorage.setItem(key, JSON.stringify(state));
                }
            } catch (error) {
                console.error(`Erro ao salvar estado para ${key}:`, error);
            }
        };

        // Debounce para evitar escritas excessivas (aguarda 500ms após última mudança)
        const timeoutId = setTimeout(save, 500);
        return () => clearTimeout(timeoutId);

    }, [key, state, isHeavy, isHydrated]);

    return [state, setState];
}
