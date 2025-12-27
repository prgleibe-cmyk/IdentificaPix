
import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { 
    XMarkIcon, 
    TableCellsIcon, 
    ArrowPathIcon, 
    WrenchScrewdriverIcon,
    DocumentArrowDownIcon,
    EyeIcon,
    CodeBracketSquareIcon
} from '../Icons';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { AppContext } from '../../contexts/AppContext'; // Import context
import { processFileContent, detectDelimiter } from '../../services/processingService';
import { Transaction, FileModel } from '../../types';

const PDFRenderer: React.FC<{ file?: File }> = ({ file }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pages, setPages] = useState<number[]>([]);
    const [pdfInstance, setPdfInstance] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!file) return;

        const loadPDF = async () => {
            const pdfjsLib = (window as any).pdfjsLib;
            if (!pdfjsLib) {
                setError("Biblioteca PDF não carregada. Recarregue a página.");
                return;
            }
            try {
                const buffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument(new Uint8Array(buffer));
                const pdf = await loadingTask.promise;
                setPdfInstance(pdf);
                setPages(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
            } catch (err: any) { 
                console.error("PDF Load error:", err); 
                setError("Erro ao renderizar PDF. Use a visualização de tabela.");
            }
        };
        loadPDF();
    }, [file]);

    if (!file) return null;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <XMarkIcon className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-xs">{error}</p>
            </div>
        );
    }

    const PageCanvas: React.FC<{ pageNum: number, pdf: any }> = ({ pageNum, pdf }) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        useEffect(() => {
            const render = async () => {
                if (!pdf || !canvasRef.current) return;
                try {
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 1.2 }); // Scale slightly reduced for side-by-side
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: context, viewport }).promise;
                    }
                } catch (e) { console.error(e); }
            };
            render();
        }, [pageNum, pdf]);
        return (
            <div className="bg-white p-2 shadow-sm border border-slate-200 mb-4 rounded-sm max-w-full overflow-hidden">
                <canvas ref={canvasRef} className="w-full h-auto" />
            </div>
        );
    };

    return (
        <div ref={containerRef} className="p-6 flex flex-col items-center bg-slate-200 dark:bg-slate-950/50 min-h-full">
            {pages.map(p => <PageCanvas key={p} pageNum={p} pdf={pdfInstance} />)}
            {pages.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <ArrowPathIcon className="w-10 h-10 animate-spin mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">Processando visualização...</p>
                </div>
            )}
        </div>
    );
};

// Helper para converter float em BRL string
const formatToBRL = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const FilePreprocessorModal: React.FC<{ 
    onClose: () => void; 
    initialFile?: any;
    // Props legados mantidos para compatibilidade de interface, mas não usados neste modo "Inspector"
    initialModel?: FileModel; 
    onSuccess?: (model: FileModel, data: Transaction[]) => void;
}> = ({ onClose, initialFile }) => {
    const { showToast } = useUI();
    const { effectiveIgnoreKeywords, contributionKeywords } = useContext(AppContext);
    
    // State para visualização Esquerda (RAW)
    const [rawRows, setRawRows] = useState<string[][]>([]);
    
    // State para visualização Direita (PROCESSED)
    const [processedTransactions, setProcessedTransactions] = useState<Transaction[]>([]);
    const [strategyUsed, setStrategyUsed] = useState<string>('Analisando...');
    
    const isPdf = useMemo(() => initialFile?.fileName?.toLowerCase().endsWith('.pdf'), [initialFile]);
    const hasRawFile = !!initialFile?.rawFile;

    // Mescla as palavras-chave para o Lab refletir a mesma lógica do processamento principal
    const cleaningKeywords = useMemo(() => {
        return [...effectiveIgnoreKeywords, ...contributionKeywords];
    }, [effectiveIgnoreKeywords, contributionKeywords]);

    // --- EFFECT: Load and Process Immediately ---
    useEffect(() => {
        if (!initialFile) return;

        // 1. Prepare Left Panel Data (Raw Visualization)
        const content = initialFile.content || '';
        const lines = content.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
        
        if (lines.length > 0) {
            let delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
            if (!isPdf) delimiter = detectDelimiter(lines[0]);
            const parsed = lines.map((l: string) => l.split(delimiter));
            setRawRows(parsed);
        }

        // 2. Prepare Right Panel Data (Strategy Execution)
        try {
            // Executa o motor real imediatamente usando a lista combinada de limpeza
            const result = processFileContent(content, initialFile.fileName, [], cleaningKeywords);
            setProcessedTransactions(result.transactions);
            setStrategyUsed(result.method);
        } catch (e: any) {
            console.error("Erro no processamento:", e);
            setStrategyUsed("Erro na Execução");
            showToast("Falha ao executar estratégias: " + e.message, "error");
        }

    }, [initialFile, isPdf, cleaningKeywords]);

    return (
        // z-[1000] garante prioridade absoluta sobre Sidebar (z-50) e Toasts
        <div className="fixed inset-0 z-[1000] bg-[#050B14]/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            
            {/* 
                Container Responsivo Seguro:
                - w-[95vw]: Ocupa 95% da largura da tela (centralizado)
                - h-[90vh]: Ocupa 90% da altura (evita cortes verticais)
                - max-w-[1600px]: Evita distorção em telas gigantes
            */}
            <div className="bg-white dark:bg-[#0F172A] w-[95vw] max-w-[1600px] h-[90vh] rounded-[2rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-scale-in relative">
                
                {/* Header Inspector */}
                <div className="px-6 py-4 bg-slate-100 dark:bg-[#020610] border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
                            <WrenchScrewdriverIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                                Laboratório de Inspeção 
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-500 uppercase tracking-wider">Modo Leitura</span>
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-mono text-amber-600 dark:text-amber-400">{initialFile?.fileName}</span>
                                <span>•</span>
                                <span>Estratégia Ativa: <strong className="text-emerald-600 dark:text-emerald-400">{strategyUsed}</strong></span>
                            </div>
                        </div>
                    </div>
                    
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Main Comparision Workspace - Divide 50% / 50% */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                    
                    {/* LEFT PANEL: RAW SOURCE */}
                    <div className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120] lg:w-1/2">
                        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 text-[10px] font-bold uppercase tracking-widest text-slate-500 flex justify-between">
                            <span>Arquivo Original (Raw Input)</span>
                            <span>{rawRows.length} Linhas</span>
                        </div>
                        
                        <div className="flex-1 overflow-auto custom-scrollbar relative">
                            {isPdf && hasRawFile ? (
                                <PDFRenderer file={initialFile.rawFile} />
                            ) : (
                                <div className="p-4">
                                    <table className="w-full text-xs text-left border-collapse font-mono">
                                        <tbody>
                                            {rawRows.slice(0, 100).map((row, rowIndex) => (
                                                <tr key={rowIndex} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800/50">
                                                    <td className="p-2 w-8 text-slate-400 text-right select-none bg-slate-100 dark:bg-slate-900/30 border-r border-slate-200 dark:border-slate-800">{rowIndex + 1}</td>
                                                    <td className="p-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300 break-all">
                                                        {row.join(' | ')}
                                                    </td>
                                                </tr>
                                            ))}
                                            {rawRows.length > 100 && (
                                                <tr>
                                                    <td colSpan={2} className="p-4 text-center text-slate-400 italic text-[10px]">
                                                        ... mais {rawRows.length - 100} linhas ocultas ...
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: NATIVE STRATEGY OUTPUT */}
                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0F172A] lg:w-1/2">
                        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex justify-between items-center shadow-sm z-10">
                            <div className="flex items-center gap-2">
                                <CodeBracketSquareIcon className="w-4 h-4" />
                                <span>Resultado do Processamento</span>
                            </div>
                            <span>{processedTransactions.length} Transações Extraídas</span>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar p-0">
                            {processedTransactions.length > 0 ? (
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                                        <tr>
                                            <th className="p-3 font-bold text-slate-500 dark:text-slate-400 w-24">Data</th>
                                            <th className="p-3 font-bold text-slate-500 dark:text-slate-400">Descrição (Limpa)</th>
                                            <th className="p-3 font-bold text-slate-500 dark:text-slate-400 w-24">Tipo</th>
                                            <th className="p-3 font-bold text-slate-500 dark:text-slate-400 text-right w-28">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {processedTransactions.map((tx, idx) => (
                                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                                                    {tx.date.split('-').reverse().join('/')}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{tx.cleanedDescription}</div>
                                                    <div className="text-[9px] text-slate-400 truncate max-w-[300px] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Original: {tx.description}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold rounded uppercase">
                                                        {tx.contributionType || 'OUTROS'}
                                                    </span>
                                                </td>
                                                <td className={`p-3 text-right font-mono font-bold ${tx.amount < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {formatToBRL(tx.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                                    <DocumentArrowDownIcon className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-300">Nenhum dado extraído</p>
                                    <p className="text-xs mt-2 max-w-xs mx-auto opacity-70">
                                        A estratégia nativa não encontrou transações válidas neste arquivo. Verifique o código em <code>core/strategies.ts</code>.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Status */}
                <div className="px-6 py-3 bg-slate-100 dark:bg-[#020610] border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Engine v3.0
                        </span>
                        <span className="hidden md:inline">Modo de Inspeção Ativo • Nenhuma alteração é salva aqui.</span>
                    </div>
                    <div>
                        Use seu IDE para ajustar <code>core/strategies.ts</code> se necessário.
                    </div>
                </div>
            </div>
        </div>
    );
};