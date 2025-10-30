export const Logger = {
  info: (message, data) => console.log(`[INFO] ${new Date().toISOString()} | ${message}`, data || ''),
  warn: (message, data) => console.warn(`[WARN] ${new Date().toISOString()} | ${message}`, data || ''),
  error: (message, error, data) => {
    const errorData = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { error };
    console.error(`[ERROR] ${new Date().toISOString()} | ${message}`, { ...errorData, ...data });
  }
};

const metrics = { 
  totalTransactions: 0, 
  processingTimeMs: 0,
  filesParsed: 0,
  parsingErrors: 0,
  matches: 0,
  divergences: 0,
  apiErrors: 0
};

export const Metrics = {
  increment: (key, value = 1) => {
    if (metrics[key] !== undefined) metrics[key] += value;
  },
  set: (key, value) => {
    if (metrics[key] !== undefined) metrics[key] = value;
  },
  reset: () => {
    Object.keys(metrics).forEach(k => metrics[k] = 0);
  },
  get: () => ({ ...metrics })
};