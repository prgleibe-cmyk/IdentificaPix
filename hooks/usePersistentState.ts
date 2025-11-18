import React, { useState, useEffect, useRef } from 'react';

/**
 * A custom React hook that uses useState and syncs its state with localStorage.
 * This version supports 'isHeavy' for async hydration to prevent blocking the main thread
 * during initial render, and debouncing for writes.
 * @param key The key to use in localStorage. Can be null to disable persistence.
 * @param initialValue The initial value to use if no value is found in localStorage.
 * @param isHeavy If true, the state initializes empty and hydrates asynchronously.
 * @returns A stateful value, and a function to update it.
 */
export function usePersistentState<T>(key: string | null, initialValue: T, isHeavy: boolean = false): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        // If marked as heavy, return initialValue immediately to unblock the UI.
        // We will read from storage in a useEffect.
        if (isHeavy) {
            return initialValue;
        }

        // For light data, read synchronously to prevent UI flash.
        if (key) {
            try {
                const item = window.localStorage.getItem(key);
                if (item) {
                    return JSON.parse(item);
                }
            } catch (error) {
                console.error(`Error reading key “${key}” from localStorage on init:`, error);
            }
        }
        return initialValue;
    });

    // Ref to track if we have finished reading from disk.
    // Important to prevent overwriting disk data with empty initial state before read completes.
    const isHydrated = useRef(!isHeavy);
    const prevKeyRef = useRef(key);

    // Async Hydration Effect (only for isHeavy=true)
    useEffect(() => {
        if (isHeavy && key) {
            // Use setTimeout with 100ms to push this task to the end of the event loop
            // AND ensure the browser has time to paint the initial skeleton UI.
            const timer = setTimeout(() => {
                try {
                    const item = window.localStorage.getItem(key);
                    if (item) {
                        setState(JSON.parse(item));
                    }
                } catch (error) {
                    console.error(`Error hydrating key “${key}” from localStorage:`, error);
                } finally {
                    isHydrated.current = true;
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [key, isHeavy]);

    // Write / Sync Effect
    useEffect(() => {
        const prevKey = prevKeyRef.current;

        // SCENARIO 1: Key changed (User switch)
        if (key !== prevKey) {
            if (key) {
                // If heavy, we might want to clear state first or handle differently, 
                // but for simplicity, we treat key change as a re-read trigger in standard logic.
                // However, standard hook logic usually resets state here.
                // For this app's specific use case, we rely on the component unmounting/remounting
                // or specific logic. Here we just update the ref.
                try {
                     const item = window.localStorage.getItem(key);
                     setState(item ? JSON.parse(item) : initialValue);
                } catch (e) {
                    setState(initialValue);
                }
            } else {
                setState(initialValue);
            }
            prevKeyRef.current = key;
            isHydrated.current = true; // Assume hydrated after explicit switch
        } 
        // SCENARIO 2: State changed. Write to storage.
        else if (key) {
            // CRITICAL: Do not write if we are waiting for async hydration.
            // Otherwise we overwrite the user's saved data with 'initialValue'.
            if (!isHydrated.current) return;

            const timeoutId = setTimeout(() => {
                try {
                    window.localStorage.setItem(key, JSON.stringify(state));
                } catch (error) {
                    console.error(`Error writing key “${key}” to localStorage:`, error);
                }
            }, 1000); // Debounce 1s

            return () => clearTimeout(timeoutId);
        }
    }, [key, state, initialValue]);

    return [state, setState];
}