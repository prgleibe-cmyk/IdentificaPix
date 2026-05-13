
import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';

const bootResetedKeys = new Set<string>();

export function usePersistentState<T>(key: string, initialValue: T, isHeavy: boolean = false, resetOnBoot: boolean = false): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        try {
            if (typeof window === 'undefined') return initialValue;
            
            // Se resetOnBoot estiver ativo, ignoramos o localStorage no primeiro render (bootstrap)
            if (resetOnBoot && !bootResetedKeys.has(key)) {
                return initialValue;
            }

            const cached = window.localStorage.getItem(key);
            if (!cached) return initialValue;
            
            const parsed = JSON.parse(cached);
            
            // Suporte ao formato de cache versionado { data: ... } solicitado em auditoria
            if (parsed && typeof parsed === 'object' && 'data' in parsed) {
                return parsed.data;
            }
            
            // Fallback para o formato padrão (dado puro) para compatibilidade
            return parsed;
        } catch (error) {
            return initialValue;
        }
    });

    const isHydrated = useRef(false);
    const isMounted = useRef(false);
    const timeoutRef = useRef<any>(null);
    const lastSavedValue = useRef<string>('');

    useEffect(() => {
        isMounted.current = true;
        isHydrated.current = false; // Reset hydration flag when key changes
        
        const hydrate = async () => {
            // 🛡️ RESET CONTROLADO: Se a chave deve ser resetada no boot e ainda não foi nesta sessão JS
            if (resetOnBoot && !bootResetedKeys.has(key)) {
                console.log(`[COLD_BOOT:RESET_START] Ignorando persistência de runtime para ${key}`);
                bootResetedKeys.add(key);
                if (isMounted.current) {
                    setState(initialValue);
                    lastSavedValue.current = JSON.stringify(initialValue);
                    isHydrated.current = true; // Marca como hidratado (com o valor inicial)
                    console.log(`[COLD_BOOT:RESET_DONE] Reset visual concluído para ${key}`);
                }
                return;
            } else if (resetOnBoot) {
                console.log(`[COLD_BOOT:RESET_SKIPPED] Reset já realizado para ${key} nesta sessão.`);
            }

            if (!isHeavy) {
                try {
                    if (typeof window !== 'undefined') {
                        const item = window.localStorage.getItem(key);
                        if (item) {
                            console.log(`[COLD_BOOT:HYDRATE] Hidratando ${key} de localStorage`);
                        }
                        const value = item ? JSON.parse(item) : initialValue;
                        if (isMounted.current) {
                            setState(value);
                            lastSavedValue.current = JSON.stringify(value);
                        }
                    }
                } catch (error) {
                    console.warn(`Erro hidratação leve ${key}:`, error);
                }
                isHydrated.current = true;
                return;
            }

            try {
                console.log(`[COLD_BOOT:HYDRATE] Iniciando hidratação pesada (IndexedDB) de ${key}`);
                const idbPromise = get(key);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject("timeout"), 2500));
                const value = await Promise.race([idbPromise, timeoutPromise]) as T | undefined;

                if (isMounted.current && value !== undefined && value !== null) {
                    console.log(`[COLD_BOOT:RESTORE] Restaurado ${key} de IndexedDB`);
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
    }, [key, isHeavy, resetOnBoot, initialValue]);

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
