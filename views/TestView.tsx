import React, { useState, useEffect } from 'react';
import { getTestResults, clearTestResults } from '../utils/testRunner';
import { CheckCircleIcon, XCircleIcon } from '../components/Icons';

// This is a dynamic import to trigger the test execution.
const runTests = async () => {
    clearTestResults();
    await import('../services/processingService.test');
    return getTestResults();
};

interface TestResult {
    suite: string;
    test: string;
    passed: boolean;
    error?: string;
}

export const TestView: React.FC = () => {
    const [results, setResults] = useState<TestResult[]>([]);
    const [running, setRunning] = useState(true);

    useEffect(() => {
        runTests().then(res => {
            setResults(res);
            setRunning(false);
        });
    }, []);

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;

    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.suite]) {
            acc[result.suite] = [];
        }
        acc[result.suite].push(result);
        return acc;
    }, {} as Record<string, TestResult[]>);

    return (
        <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Relatório de Testes</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Resultados da execução dos testes unitários.</p>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4 border-b pb-4 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Sumário</h3>
                    {running ? (
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Executando...</span>
                    ) : (
                        <div className="flex items-center space-x-4 text-sm">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">Total: {results.length}</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">Aprovados: {passedCount}</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">Reprovados: {failedCount}</span>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {Object.entries(groupedResults).map(([suiteName, suiteResults]: [string, TestResult[]]) => (
                        <div key={suiteName}>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">{suiteName}</h4>
                            <ul className="space-y-2">
                                {suiteResults.map((result, index) => (
                                    <li key={index} className="flex items-start p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                                        {result.passed ? (
                                            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5 mr-3" />
                                        ) : (
                                            <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5 mr-3" />
                                        )}
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{result.test}</p>
                                            {!result.passed && (
                                                <pre className="mt-1 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded-md overflow-x-auto">
                                                    <code>{result.error}</code>
                                                </pre>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};