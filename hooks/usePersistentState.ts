import React, { useState, useEffect, useRef } from 'react';

/**
 * A custom React hook that uses useState and syncs its state with localStorage.
 * This version is robust for dynamic keys (e.g., user-specific keys that change on login/logout)
 * and prevents race conditions that could wipe data on reload.
 * @param key The key to use in localStorage. Can be null to disable persistence.
 * @param initialValue The initial value to use if no value is found in localStorage.
 * @returns A stateful value, and a function to update it.
 */
export function usePersistentState<T>(key: string | null, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        // Attempt an initial read ONLY if the key is available during the first render.
        // This is an optimization for page reloads where the user session is restored quickly.
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
        // In all other cases (no key yet, or error), start with the initial value.
        return initialValue;
    });

    // Ref to track the previous key to detect changes (e.g., login/logout).
    const prevKeyRef = useRef(key);

    // This consolidated effect handles both reading on key change and writing on state change.
    useEffect(() => {
        const prevKey = prevKeyRef.current;

        // SCENARIO 1: The key has changed. This is the highest priority. We must READ from storage.
        if (key !== prevKey) {
            if (key) {
                // Key is now valid (e.g., user logged in). Load data for this new key.
                try {
                    const item = window.localStorage.getItem(key);
                    setState(item ? JSON.parse(item) : initialValue);
                } catch (error) {
                    console.error(`Error reading key “${key}” from localStorage on key change:`, error);
                    setState(initialValue);
                }
            } else {
                // Key became null (e.g., user logged out). Reset state.
                setState(initialValue);
            }
        } 
        // SCENARIO 2: The key is stable, so any change must be from the state itself. We WRITE to storage.
        else if (key) {
            try {
                window.localStorage.setItem(key, JSON.stringify(state));
            } catch (error) {
                console.error(`Error writing key “${key}” to localStorage:`, error);
            }
        }

        // After the effect has run, update the ref to the current key for the next render.
        prevKeyRef.current = key;
    }, [key, state, initialValue]);

    return [state, setState];
}