
import React, { useState, useEffect } from 'react';
import { getTestResults, clearTestResults, TestResult } from '../utils/testRunner';
import { CheckCircleIcon, XCircleIcon, BoltIcon } from '../components/Icons';

// Execução dinâmica das suítes de teste
const runTests = async () => {
    clearTestResults();
    // Importa apenas as suítes de teste que permanecem no projeto
    try {
        await import('../services/processingService.test');
    } catch (e) {
        console.error("Erro ao carregar suíte de testes:", e);
    }
    return getTestResults();
};

export const TestView: React.FC = () => {
    const [results, setResults] = useState<TestResult[]>([]);
    const [running, setRunning] = useState(true);

    useEffect(() => {
        runTests().then(res => {
            setResults(res as TestResult[]);
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

    const groupedEntries = Object.entries(groupedResults) as [string, TestResult[]][];

    return (
        <div className="flex flex-col h-full animate-fade-in gap-4 pb-6 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-2xl font-black text-brand-deep dark:text-white tracking-tight">QA & Integridade</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Validação automatizada das regras de negócio.</p>
                </div>
                {running ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase animate-pulse">
                        <BoltIcon className="w-3 h-3" /> Executando...
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold">
                            PASSOU: {passedCount}
                        </div>
                        <div className={`px-3 py-1.5 ${failedCount > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-400'} rounded-lg text-[10px] font-bold`}>
                            FALHOU: {failedCount}
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {groupedEntries.map(([suiteName, suiteResults]) => (
                    <div key={suiteName} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                        <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{suiteName}</h4>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {suiteResults.map((result, index) => (
                                <div key={index} className="px-5 py-3 flex items-start gap-4 group hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                                    {result.passed ? (
                                        <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                                    ) : (
                                        <XCircleIcon className="w-5 h-5 text-red-500 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold ${result.passed ? 'text-slate-700 dark:text-slate-300' : 'text-red-600'}`}>{result.test}</p>
                                        {!result.passed && (
                                            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/50">
                                                <code className="text-[10px] text-red-700 dark:text-red-400 font-mono break-all leading-relaxed">
                                                    {result.error}
                                                </code>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {!running && results.length === 0 && (
                    <div className="text-center py-12 text-slate-400 italic text-sm">
                        Nenhuma suíte de teste encontrada.
                    </div>
                )}
            </div>
        </div>
    );
};
