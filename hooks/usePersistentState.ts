import React, { useState, useEffect } from 'react';

/**
 * A custom React hook that uses useState and syncs its state with localStorage.
 * This ensures that the state persists across browser sessions.
 * @param key The key to use in localStorage.
 * @param initialValue The initial value to use if no value is found in localStorage.
 * @returns A stateful value, and a function to update it.
 */
export function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    // Initialize state from localStorage or with the initial value.
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return initialValue;
        }
    });

    // Use useEffect to update localStorage whenever the state changes.
    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Could not save key "${key}" to localStorage:`, error);
        }
    }, [key, state]); // Dependency array ensures this runs only when state or key changes.

    return [state, setState];
}