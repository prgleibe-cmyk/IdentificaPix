interface TestResult {
    suite: string;
    test: string;
    passed: boolean;
    error?: string;
}

const results: TestResult[] = [];
let currentSuite = '';

export const describe = (name: string, fn: () => void) => {
    currentSuite = name;
    fn();
};

export const it = (name: string, fn: () => void) => {
    try {
        fn();
        results.push({ suite: currentSuite, test: name, passed: true });
    } catch (e: any) {
        results.push({ suite: currentSuite, test: name, passed: false, error: e.message });
    }
};

export const expect = (actual: any) => ({
    toBe: (expected: any) => {
        if (actual !== expected) {
            throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
        }
    },
    toEqual: (expected: any) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
        }
    },
    toBeCloseTo: (expected: number, precision = 2) => {
        const actualNum = Number(actual);
        if (isNaN(actualNum)) {
             throw new Error(`Expected ${actual} to be a number`);
        }
        const pass = Math.abs(expected - actualNum) < (Math.pow(10, -precision) / 2);
        if (!pass) {
            throw new Error(`Expected ${actualNum} to be close to ${expected}`);
        }
    },
    toBeNull: () => {
        if (actual !== null) {
            throw new Error(`Expected ${JSON.stringify(actual)} to be null`);
        }
    },
    toBeDefined: () => {
        if (actual === undefined) {
             throw new Error(`Expected value to be defined but it was undefined`);
        }
    },
    toBeTruthy: () => {
        if (!actual) {
            throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`);
        }
    },
    toBeFalsy: () => {
        if (actual) {
            throw new Error(`Expected ${JSON.stringify(actual)} to be falsy`);
        }
    },
    toBeGreaterThan: (expected: number) => {
         if (actual <= expected) {
             throw new Error(`Expected ${actual} to be greater than ${expected}`);
         }
    },
});

export const getTestResults = () => {
    return results;
};

export const clearTestResults = () => {
    results.length = 0;
};
