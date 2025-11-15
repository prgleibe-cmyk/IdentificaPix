// --- Basic Logger ---
// A simple logger for structured console output.
export const Logger = {
    info: (message: string, data?: object) => {
        console.log(`[INFO] ${new Date().toISOString()} | ${message}`, data || '');
    },
    warn: (message: string, data?: object) => {
        console.warn(`[WARN] ${new Date().toISOString()} | ${message}`, data || '');
    },
    error: (message: string, error?: any, data?: object) => {
        const errorData = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { error };
        console.error(`[ERROR] ${new Date().toISOString()} | ${message}`, { ...errorData, ...data });
    }
};

// --- Basic Metrics Collector ---
// An in-memory store for simple metrics. In a real app, this would send data to a monitoring service.
interface AppMetrics {
    processingTimeMs: number;
    filesParsed: number;
    parsingErrors: number;
    matches: number;
    divergences: number; // Unidentified transactions
    apiErrors: number;
    totalTransactions: number;
}

const metrics: AppMetrics = {
    processingTimeMs: 0,
    filesParsed: 0,
    parsingErrors: 0,
    matches: 0,
    divergences: 0,
    apiErrors: 0,
    totalTransactions: 0,
};

export const Metrics = {
    increment: (key: keyof AppMetrics, value: number = 1) => {
        if (Object.prototype.hasOwnProperty.call(metrics, key)) {
            (metrics[key] as number) += value;
        }
    },
    set: (key: keyof AppMetrics, value: number) => {
         if (Object.prototype.hasOwnProperty.call(metrics, key)) {
            (metrics[key] as number) = value;
        }
    },
    reset: () => {
        Object.keys(metrics).forEach(key => {
            metrics[key as keyof AppMetrics] = 0;
        });
    },
    get: (): Readonly<AppMetrics> => {
        return { ...metrics };
    }
};
