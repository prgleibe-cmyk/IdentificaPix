
import React, { useState, useEffect, useRef, useMemo, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
    XMarkIcon, 
    WrenchScrewdriverIcon, 
    DocumentArrowDownIcon, 
    CodeBracketSquareIcon, 
    ArrowPathIcon, 
    FloppyDiskIcon, 
    CheckCircleIcon, 
    BrainIcon, 
    ShieldCheckIcon, 
    AdjustmentsHorizontalIcon, 
    PlayCircleIcon, 
    UploadIcon, 
    PhotoIcon, 
    ExclamationTriangleIcon, 
    SparklesIcon, 
    BoltIcon, 
    PencilIcon, 
    ClockIcon, 
    TableCellsIcon,
    BanknotesIcon,
    EyeIcon
} from '../Icons';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext'; 
import { useAuth } from '../../contexts/AuthContext';
import { detectDelimiter, generateFingerprint } from '../../services/processingService';
import { DateResolver } from '../../core/processors/DateResolver';
import { AmountResolver } from '../../core/processors/AmountResolver';
import { NameResolver } from '../../core/processors/NameResolver';
import { TypeResolver } from '../../core/processors/TypeResolver';
import { RowValidator } from '../../core/processors/RowValidator'; // Import RowValidator
import { modelService } from '../../services/modelService';
import { extractDataFromVisual, extractStructuredDataByExample } from '../../services/geminiService';
import { Transaction, FileModel } from '../../types';
import * as XLSX from 'xlsx';

/**
 * 🧪 LABORATÓRIO DE ARQUIVOS (AMBIENTE EXPERIMENTAL)
 * --------------------------------------------------------------------------
 * Este componente é um ambiente de SIMULAÇÃO e APRENDIZADO.
 * 
 * - A lógica executada aqui serve apenas para visualizar, ajustar e salvar modelos.
 * - O processamento real do sistema ocorre via `processingService.ts`.
 * - Alterações visuais ou lógicas aqui NÃO devem impactar o fluxo de "Lançar Dados".
 * 
 * ⚠️ ATENÇÃO: As simulações aqui rodam uma versão local das regras para feedback imediato.
 * Certifique-se de que qualquer nova lógica de parsing seja refletida no CORE_ESTAVEL.
 * --------------------------------------------------------------------------
 */

// --- Sub-componente: Renderizador de Imagem ---
const ImageRenderer: React.FC<{ file: File }> = ({ file }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    if (!previewUrl) return null;

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950/50 p-4 overflow-hidden">
            <div className="flex-1 w-full h-full relative">
                <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="absolute inset-0 w-full h-full object-contain" 
                />
            </div>
            <div className="mt-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-2 px-4 rounded-full shadow-lg border border-amber-100 dark:border-amber-900/30 text-center z-10 shrink-0">
                <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                    <PhotoIcon className="w-4 h-4" />
                    <span className="font-bold text-[10px] uppercase tracking-wide">Arquivo de Imagem</span>
                </div>
            </div>
        </div>
    );
};

// --- Sub-componente: Renderizador de PDF ---
const PDFRenderer: React.FC<{ file?: File }> = ({ file }) => {
    const [pages, setPages] = useState<number[]>([]);
    const [pdfInstance, setPdfInstance] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!file) return;

        const loadPDF = async () => {
            // Garante carregamento da lib
            let attempts = 0;
            while (!(window as any).pdfjsLib && attempts < 20) {
                await new Promise(r => setTimeout(r, 200));
                attempts++;
            }

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
                    // Escala ajustada para caber melhor na tela
                    const viewport = page.getViewport({ scale: 1.0 }); 
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
            <div className="bg-white p-1 shadow-sm border border-slate-200 mb-4 rounded-sm w-fit max-w-full overflow-hidden mx-auto">
                <canvas ref={canvasRef} className="max-w-full h-auto block" />
            </div>
        );
    };

    return (
        <div className="absolute inset-0 overflow-auto custom-scrollbar bg-slate-200 dark:bg-slate-950/50 p-4">
            {pages.map(p => <PageCanvas key={p} pageNum={p} pdf={pdfInstance} />)}
            {pages.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <ArrowPathIcon className="w-8 h-8 animate-spin mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Renderizando PDF...</p>
                </div>
            )}
        </div>
    );
};

// --- Sub-componente: Renderizador de Planilha (Excel Grid Style) ---
const SpreadsheetRenderer: React.FC<{ data: string[][], isLoading?: boolean, detectedMapping?: any, isAiProcessed?: boolean }> = ({ data, isLoading, detectedMapping, isAiProcessed }) => {
    
    const getColumnLabel = (index: number) => {
        let label = '';
        let i = index;
        while (i >= 0) {
            label = String.fromCharCode((i % 26) + 65) + label;
            i = Math.floor(i / 26) - 1;
        }
        return label;
    };

    const getColumnHighlight = (index: number) => {
        if (!detectedMapping) return '';
        if (index === detectedMapping.dateColumnIndex) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
        if (index === detectedMapping.amountColumnIndex) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
        if (index === detectedMapping.descriptionColumnIndex) return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
        return '';
    };

    const getColumnHeaderHighlight = (index: number) => {
        if (!detectedMapping) return '';
        if (index === detectedMapping.dateColumnIndex) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
        if (index === detectedMapping.amountColumnIndex) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300';
        if (index === detectedMapping.descriptionColumnIndex) return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
        return '';
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-brand-blue blur-xl opacity-20 rounded-full animate-pulse"></div>
                    <SparklesIcon className="w-12 h-12 text-brand-blue relative z-10 animate-bounce" />
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">Processando Documento</p>
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                        {isAiProcessed ? 'A inteligência artificial está interpretando o visual...' : 'Lendo estrutura do arquivo...'}
                    </p>
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50 dark:bg-slate-900/50">
                <ExclamationTriangleIcon className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-bold text-slate-500 dark:text-slate-300">Visualização indisponível</p>
                <p className="text-xs mt-2 max-w-xs mx-auto opacity-70">
                    Não foi possível renderizar o conteúdo deste arquivo.
                </p>
            </div>
        );
    }

    const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
    const colIndices = Array.from({ length: maxCols }, (_, i) => i);

    return (
        <div className="absolute inset-0 overflow-auto custom-scrollbar bg-[#f8f9fa] dark:bg-[#1e1e1e] select-text">
            {isAiProcessed && (
                <div className="sticky left-0 top-0 z-40 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1 text-[9px] font-bold uppercase tracking-wide border-b border-purple-200 dark:border-purple-800 flex items-center gap-2">
                    <SparklesIcon className="w-3 h-3" /> Conteúdo Interpretado por IA (Visual &rarr; Texto)
                </div>
            )}
            <table className="border-collapse table-fixed min-w-full">
                <thead className="sticky top-0 z-20">
                    <tr>
                        <th className="w-10 min-w-[40px] bg-[#e6e6e6] dark:bg-[#333] border-r border-b border-[#c0c0c0] dark:border-[#555] sticky left-0 z-30"></th>
                        {colIndices.map(colIndex => (
                            <th key={colIndex} className={`bg-[#f0f0f0] dark:bg-[#2d2d2d] border-r border-b border-[#d4d4d4] dark:border-[#555] text-center text-[10px] font-bold text-slate-600 dark:text-slate-300 h-6 min-w-[100px] select-none ${getColumnHeaderHighlight(colIndex)}`}>
                                {getColumnLabel(colIndex)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, 500).map((row, rowIndex) => (
                        <tr key={rowIndex} className="h-6">
                            <td className="sticky left-0 z-10 bg-[#f0f0f0] dark:bg-[#2d2d2d] border-r border-b border-[#d4d4d4] dark:border-[#555] text-center text-[10px] font-bold text-slate-600 dark:text-slate-300 select-none w-10">
                                {rowIndex + 1}
                            </td>
                            {colIndices.map(colIndex => (
                                <td 
                                    key={`${rowIndex}-${colIndex}`} 
                                    className={`border-r border-b border-[#e0e0e0] dark:border-[#444] px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis empty:bg-white dark:empty:bg-[#121212] focus:outline-none hover:bg-slate-100 dark:hover:bg-slate-800 cursor-cell ${getColumnHighlight(colIndex)}`}
                                    title={row[colIndex]}
                                >
                                    {row[colIndex]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const formatToBRL = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getColumnOptions = (count: number) => {
    return Array.from({ length: count }, (_, i) => {
        let label = '';
        let n = i;
        while (n >= 0) {
            label = String.fromCharCode((n % 26) + 65) + label;
            n = Math.floor(n / 26) - 1;
        }
        return { value: i, label: `Coluna ${label}` };
    });
};

// Interface estendida para suportar edição segura e status pendente
interface SafeTransaction extends Transaction {
    sourceIndex?: number; // Índice da linha original no gridData
    isValid?: boolean;    // Se a linha foi parseada com sucesso
    status?: 'valid' | 'error' | 'edited' | 'ignored' | 'pending'; // Adicionado 'pending'
}

export const FilePreprocessorModal: React.FC<{ 
    onClose: () => void; 
    initialFile?: any;
    initialModel?: FileModel; 
    onSuccess?: (model: FileModel, data: Transaction[]) => void;
    mode?: 'create' | 'test' | 'refine'; 
}> = ({ onClose, initialFile, initialModel, onSuccess, mode = 'create' }) => {
    const { showToast } = useUI();
    const { user } = useAuth(); 
    const { effectiveIgnoreKeywords, contributionKeywords } = useContext(AppContext);
    
    // --- STATE MANAGEMENT ---
    
    const [localFile, setLocalFile] = useState<{ content: string; fileName: string; rawFile?: File } | null>(null);
    const activeFile = initialFile || localFile;

    const [gridData, setGridData] = useState<string[][]>([]);
    const [isGridLoading, setIsGridLoading] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false); // Flag para indicar uso de IA
    
    const [processedTransactions, setProcessedTransactions] = useState<SafeTransaction[]>([]);
    const [strategyUsed, setStrategyUsed] = useState<string>('Aguardando Mapeamento...');
    
    // Stats State
    const [stats, setStats] = useState({ totalRaw: 0, potential: 0, grouped: 0 });

    const [isSavingModel, setIsSavingModel] = useState(false);
    
    // GOVERNANCE STATES (Modal & Name)
    const [showNameModal, setShowNameModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<'draft' | 'approved'>('draft');
    const [modelName, setModelName] = useState(initialModel?.name || '');
    const [modelDescription, setModelDescription] = useState('');

    const [activeMapping, setActiveMapping] = useState<any>(null); 
    const [detectedFingerprint, setDetectedFingerprint] = useState<any>(null);

    // --- ESTADOS PARA O MODO "ENSINO POR EXEMPLO" REATORADO ---
    const [isInferringMapping, setIsInferringMapping] = useState(false);
    
    // Estados de edição de linha
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editingRowData, setEditingRowData] = useState<SafeTransaction | null>(null);
    const [learnedPatternSource, setLearnedPatternSource] = useState<{ originalRaw: string[], corrected: SafeTransaction } | null>(null);

    // ESTADO EXPLÍCITO DE RESULTADO PARA ATIVAÇÃO DOS BOTÕES
    const hasStructuredResult = processedTransactions.length > 0;

    const isPdf = useMemo(() => activeFile?.fileName?.toLowerCase().endsWith('.pdf'), [activeFile]);
    const isImage = useMemo(() => /\.(jpg|jpeg|png|webp)$/i.test(activeFile?.fileName || ''), [activeFile]);
    const isTestMode = mode === 'test';

    const cleaningKeywords = useMemo(() => {
        return [...effectiveIgnoreKeywords, ...contributionKeywords];
    }, [effectiveIgnoreKeywords, contributionKeywords]);

    // Ensure libs loaded
    useEffect(() => {
        const ensureLibs = async () => {
            if (!(window as any).pdfjsLib) {
                try {
                    const pdfModule = await import('pdfjs-dist');
                    const lib = pdfModule.default || pdfModule;
                    if (!lib.GlobalWorkerOptions.workerSrc) {
                        const version = lib.version || '3.11.174';
                        lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
                    }
                    (window as any).pdfjsLib = lib;
                } catch (e) { console.error("Failed to load PDF lib", e); }
            }
            if (!(window as any).XLSX) {
                 try { const mod = await import('xlsx'); (window as any).XLSX = mod.default || mod; } catch (e) {}
            }
        };
        ensureLibs();
    }, []);

    // --- UPLOAD HANDLER (INTERNAL) ---
    const handleInternalFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsGridLoading(true);
        try {
            let content = '';
            const fName = file.name.toLowerCase();
            
            if (fName.endsWith('.pdf') || fName.endsWith('.xlsx') || fName.endsWith('.xls') || /\.(jpg|jpeg|png|webp)$/i.test(fName)) {
                content = '';
            } else {
                content = await file.text();
            }

            setLocalFile({
                content,
                fileName: file.name,
                rawFile: file
            });
        } catch (error: any) {
            console.error("Erro ao ler arquivo interno:", error);
            showToast("Erro ao ler arquivo: " + error.message, "error");
            setIsGridLoading(false);
        }
    };

    // --- SIMULADOR DE ESTRATÉGIA ---
    const runSimulation = useCallback(() => {
        if (!gridData.length) {
            return;
        }

        const { dateColumnIndex, descriptionColumnIndex, amountColumnIndex, typeColumnIndex, skipRowsStart } = activeMapping || {
            dateColumnIndex: -1, descriptionColumnIndex: -1, amountColumnIndex: -1, skipRowsStart: 0
        };
        
        const newTransactions: SafeTransaction[] = [];
        const yearAnchor = new Date().getFullYear();
        let potentialCount = 0;
        let groupedCount = 0;

        gridData.forEach((cols, index) => {
            const isPotential = RowValidator.isPotentialRow(cols);
            const isSkipped = index < (skipRowsStart || 0);

            if (!isPotential) return;

            potentialCount++;

            // Mapeamento de Colunas
            const rawDate = cols[dateColumnIndex] || '';
            const rawDesc = cols[descriptionColumnIndex] || '';
            const rawAmount = cols[amountColumnIndex] || '';
            const rawType = typeColumnIndex !== undefined ? cols[typeColumnIndex] : '';

            let isoDate = '';
            let amount = 0;
            let cleanedDesc = rawDesc;
            let finalType = rawType;
            let isValid = false;
            let status: SafeTransaction['status'] = 'pending'; 

            if (isSkipped) {
                status = 'ignored';
            } else if (activeMapping) {
                isoDate = DateResolver.resolveToISO(rawDate, yearAnchor);
                const amountStr = AmountResolver.clean(rawAmount);
                amount = parseFloat(amountStr);
                
                const hasAmount = !isNaN(amount) && amount !== 0;
                const hasDesc = rawDesc && rawDesc.trim().length > 0;
                const hasDate = !!isoDate && isoDate.length >= 10; 

                if (hasDate) {
                    groupedCount++; 
                }

                if (hasAmount && hasDesc && hasDate) {
                    cleanedDesc = NameResolver.clean(rawDesc, cleaningKeywords);
                    finalType = rawType ? rawType.trim().toUpperCase() : TypeResolver.resolveFromDescription(rawDesc);
                    isValid = true;
                    status = 'valid';
                } else if (hasAmount || hasDesc) {
                    status = 'pending';
                    if (hasAmount) {
                         cleanedDesc = NameResolver.clean(rawDesc, cleaningKeywords);
                    }
                } else {
                    status = 'ignored'; 
                }
            } else {
                cleanedDesc = cols.join(' | ');
                isValid = false;
                status = 'pending';
            }

            newTransactions.push({
                id: `sim-${index}`,
                date: isValid ? isoDate : rawDate,
                description: rawDesc,
                amount: amount,
                originalAmount: rawAmount,
                cleanedDescription: cleanedDesc,
                contributionType: finalType,
                sourceIndex: index,
                isValid: isValid,
                status: status
            });
        });

        setProcessedTransactions(newTransactions);
        setStats({
            totalRaw: gridData.length,
            potential: potentialCount,
            grouped: groupedCount
        });
        
        if (activeMapping) {
            setStrategyUsed("Mapeamento Ativo");
        } else {
            setStrategyUsed("Prévia do Arquivo (Bruto)");
        }

    }, [gridData, activeMapping, cleaningKeywords, isTestMode, initialModel, showToast]);

    // --- TRIGGER DE SIMULAÇÃO APÓS INFERÊNCIA ---
    useEffect(() => {
        if (gridData.length > 0) {
            runSimulation();
        }
    }, [activeMapping, gridData, runSimulation]);

    // --- EFFECT: Load and Process Content ---
    useEffect(() => {
        if (!activeFile) return;

        const loadContent = async () => {
            setIsGridLoading(true);
            setIsAiProcessing(false);
            let loadedRows: string[][] = [];
            let jsonRows: any[] = [];
            
            // Caso 1: Imagem - Uso direto da IA (JSON ESTRUTURADO)
            if (isImage && activeFile.rawFile) {
                try {
                    setIsAiProcessing(true);
                    const aiResult = await extractDataFromVisual(activeFile.rawFile);
                    
                    // Tenta parsear como JSON
                    try {
                        const parsed = JSON.parse(aiResult);
                        if (parsed && Array.isArray(parsed.rows)) {
                            jsonRows = parsed.rows;
                            // Converte para gridData plano para manter compatibilidade com engine
                            loadedRows = jsonRows.map((r: any) => [
                                r.date || '', 
                                r.description || '', 
                                r.amount ? String(r.amount) : '', 
                                r.reference || ''
                            ]);
                            
                            // Auto-set mapping para modo estruturado
                            setActiveMapping({
                                dateColumnIndex: 0,
                                descriptionColumnIndex: 1,
                                amountColumnIndex: 2,
                                typeColumnIndex: 3,
                                skipRowsStart: 0
                            });
                        } else {
                            // Fallback para texto plano se não vier JSON
                            const lines = aiResult.split(/\r?\n/).filter(l => l.trim().length > 0);
                            const delimiter = detectDelimiter(lines[0]);
                            loadedRows = lines.map(l => l.split(delimiter));
                        }
                    } catch (jsonErr) {
                        const lines = aiResult.split(/\r?\n/).filter(l => l.trim().length > 0);
                        if (lines.length > 0) {
                            const delimiter = detectDelimiter(lines[0]);
                            loadedRows = lines.map(l => l.split(delimiter));
                        }
                    }
                } catch (e: any) {
                    showToast("Falha na interpretação visual: " + e.message, "error");
                }
            }

            // Caso 2: PDF - Tentativa de texto -> Fallback para IA Visual
            else if (isPdf && activeFile.rawFile) {
                try {
                    let attempts = 0;
                    while (!(window as any).pdfjsLib && attempts < 20) {
                        await new Promise(r => setTimeout(r, 200));
                        attempts++;
                    }
                    const pdfjsLib = (window as any).pdfjsLib;

                    if (pdfjsLib) {
                        const buffer = await activeFile.rawFile.arrayBuffer();
                        const loadingTask = pdfjsLib.getDocument(new Uint8Array(buffer));
                        const pdf = await loadingTask.promise;
                        
                        let extractedText = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            const items = textContent.items as any[];
                            
                            const lineMap: Map<number, { str: string, x: number }[]> = new Map();
                            items.forEach(item => {
                                const y = Math.round(item.transform[5]); 
                                if (!lineMap.has(y)) lineMap.set(y, []);
                                lineMap.get(y)!.push({ str: item.str, x: item.transform[4] });
                            });

                            const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
                            for (const y of sortedY) {
                                const lineItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
                                const lineStr = lineItems.map(it => it.str).join(' '); 
                                if (lineStr.trim()) extractedText += lineStr + '\n';
                            }
                        }
                        
                        if (extractedText.trim().length < 50) {
                            console.log("PDF Escaneado detectado. Acionando Gemini Vision...");
                            setIsAiProcessing(true);
                            const aiResult = await extractDataFromVisual(activeFile.rawFile);
                            
                            try {
                                const parsed = JSON.parse(aiResult);
                                if (parsed && Array.isArray(parsed.rows)) {
                                    jsonRows = parsed.rows;
                                    loadedRows = jsonRows.map((r: any) => [
                                        r.date || '', 
                                        r.description || '', 
                                        r.amount ? String(r.amount) : '', 
                                        r.reference || ''
                                    ]);
                                    setActiveMapping({
                                        dateColumnIndex: 0,
                                        descriptionColumnIndex: 1,
                                        amountColumnIndex: 2,
                                        typeColumnIndex: 3,
                                        skipRowsStart: 0
                                    });
                                } else {
                                    const lines = aiResult.split(/\r?\n/).filter(l => l.trim().length > 0);
                                    const delimiter = detectDelimiter(lines[0]);
                                    loadedRows = lines.map(l => l.split(delimiter));
                                }
                            } catch (e) {
                                const lines = aiResult.split(/\r?\n/).filter(l => l.trim().length > 0);
                                const delimiter = detectDelimiter(lines[0]);
                                loadedRows = lines.map(l => l.split(delimiter));
                            }
                        } else {
                            const lines = extractedText.split(/\r?\n/).filter(l => l.trim().length > 0);
                            if (lines.length > 0) {
                                const delimiter = detectDelimiter(lines[0]);
                                loadedRows = lines.map(l => l.split(delimiter));
                            }
                        }
                    }
                } catch (e: any) {
                    console.error("PDF Extraction Error:", e);
                    try {
                        setIsAiProcessing(true);
                        const aiResult = await extractDataFromVisual(activeFile.rawFile);
                        try {
                            const parsed = JSON.parse(aiResult);
                            if (parsed && Array.isArray(parsed.rows)) {
                                loadedRows = parsed.rows.map((r: any) => [
                                    r.date || '', r.description || '', r.amount ? String(r.amount) : '', r.reference || ''
                                ]);
                                setActiveMapping({ dateColumnIndex: 0, descriptionColumnIndex: 1, amountColumnIndex: 2, typeColumnIndex: 3, skipRowsStart: 0 });
                            } else { throw new Error("Not JSON"); }
                        } catch {
                            const lines = aiResult.split(/\r?\n/).filter(l => l.trim().length > 0);
                            const delimiter = detectDelimiter(lines[0]);
                            loadedRows = lines.map(l => l.split(delimiter));
                        }
                    } catch (aiErr) {
                        showToast("Falha crítica ao ler PDF.", "error");
                    }
                }
            }

            // Caso 3: Excel Real
            else if (activeFile.rawFile && (activeFile.fileName.toLowerCase().endsWith('xls') || activeFile.fileName.toLowerCase().endsWith('xlsx'))) {
                try {
                    const buffer = await activeFile.rawFile.arrayBuffer();
                    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    loadedRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
                } catch (e) {
                    console.error("Erro ao ler Excel:", e);
                }
            } 
            // Caso 4: CSV/Texto
            else if (!isPdf && !isImage) {
                const lines = (activeFile.content || '').split(/\r?\n/).filter((l: string) => l.trim().length > 0);
                if (lines.length > 0) {
                    const delimiter = detectDelimiter(lines[0]);
                    loadedRows = lines.map((l: string) => l.split(delimiter));
                }
            }

            // Set Data if available
            if (loadedRows.length > 0) {
                setGridData(loadedRows);
                
                const contentForFp = (activeFile.content || loadedRows.slice(0, 5).map(r => r.join(';')).join('\n'));
                const fp = generateFingerprint(contentForFp);
                setDetectedFingerprint(fp);

                if (initialModel && initialModel.mapping) {
                    setActiveMapping(initialModel.mapping);
                } else if (!activeMapping) {
                    // Se não tiver mapeamento definido pelo processo de IA, deixa null para forçar setup manual
                    // a menos que tenha vindo de IA Estruturada (já tratado acima)
                }
            } else {
                setGridData([]);
                setDetectedFingerprint(null);
                setActiveMapping(null);
            }

            setIsGridLoading(false);
        };

        loadContent();

    }, [activeFile, isPdf, isImage, initialModel, showToast]);

    // --- ROW EDITING HANDLERS ---
    
    const handleStartEdit = (tx: SafeTransaction, index: number) => {
        setEditingRowIndex(index);
        setEditingRowData({ ...tx });
    };

    const handleCancelEdit = () => {
        setEditingRowIndex(null);
        setEditingRowData(null);
    };

    const handleSaveRow = () => {
        if (editingRowIndex === null || !editingRowData) return;

        setProcessedTransactions(prev => {
            const next = [...prev];
            next[editingRowIndex] = { ...editingRowData, status: 'edited', isValid: true };
            return next;
        });

        if (editingRowData.sourceIndex !== undefined && gridData[editingRowData.sourceIndex]) {
            const originalRaw = gridData[editingRowData.sourceIndex];
            setLearnedPatternSource({
                originalRaw,
                corrected: editingRowData
            });
        }

        setEditingRowIndex(null);
        setEditingRowData(null);
    };

    const handleApplyCorrectionPattern = async () => {
        if (!learnedPatternSource) return;

        setIsInferringMapping(true);
        try {
            const { originalRaw, corrected } = learnedPatternSource;
            
            // AJUSTE CRÍTICO: Enviar um chunk maior do documento fonte para a IA processar
            // Limitado a ~500 linhas ou 30k caracteres para não estourar o contexto da IA
            const rawSnippet = gridData
                .slice(0, 500) 
                .map(row => row.join(';'))
                .join('\n');

            const correctedString = `
                RAW ROW: [${originalRaw.join(' | ')}]
                TARGET OUTPUT:
                Data: ${corrected.date}
                Descrição: ${corrected.cleanedDescription}
                Valor: ${corrected.amount}
                Tipo: ${corrected.contributionType}
                
                Esta linha define o formato FINAL. Todas as demais devem seguir exatamente este padrão.
            `;

            // CHAMA A NOVA FUNÇÃO DE EXTRAÇÃO ESTRUTURADA
            const structuredResult = await extractStructuredDataByExample(rawSnippet, correctedString);
            
            if (structuredResult && structuredResult.rows.length > 0) {
                
                // VALIDAÇÃO DE SANIDADE: Se a IA retornou muito menos linhas do que o input, há algo errado.
                // 500 linhas de input -> esperamos pelo menos 100 linhas válidas (20%) em um extrato ruim,
                // ou idealmente > 80% em um extrato limpo.
                // Vamos usar um limiar seguro de 10% para evitar falsos positivos em arquivos com muito cabeçalho.
                const inputLineCount = Math.min(gridData.length, 500);
                if (structuredResult.rows.length < (inputLineCount * 0.1)) {
                    showToast(`Atenção: A IA detectou apenas ${structuredResult.rows.length} linhas de ${inputLineCount}. Verifique se o exemplo fornecido é representativo.`, "error");
                    // Não abortamos, mas avisamos. O usuário pode tentar corrigir outra linha.
                } else {
                    showToast(`Padrão aprendido! ${structuredResult.rows.length} linhas extraídas com sucesso.`, "success");
                }

                // Transforma o resultado estruturado em gridData plano
                const newGridData = structuredResult.rows.map(r => [
                    r.date || '', 
                    r.description || '', 
                    r.amount ? String(r.amount) : '', 
                    r.reference || ''
                ]);

                setGridData(newGridData);
                
                // Força mapeamento 1:1 pois agora os dados estão normalizados
                setActiveMapping({
                    dateColumnIndex: 0,
                    descriptionColumnIndex: 1,
                    amountColumnIndex: 2,
                    typeColumnIndex: 3,
                    skipRowsStart: 0
                });

                setLearnedPatternSource(null);
            } else {
                showToast("A IA não conseguiu replicar o padrão para outras linhas.", "error");
            }
            
        } catch (error: any) {
            console.error(error);
            showToast(error.message, "error");
        } finally {
            setIsInferringMapping(false);
        }
    };

    // --- GOVERNANCE & NAMING FLOW ---
    const initiateSave = (status: 'draft' | 'approved') => {
        setPendingAction(status);
        setShowNameModal(true);
    };

    const confirmSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modelName.trim()) {
            showToast("O nome do modelo é obrigatório.", "error");
            return;
        }
        setShowNameModal(false);
        await persistModel(pendingAction, modelName.trim());
    };

    // --- HANDLER: Persist Model (Unified Logic) ---
    const persistModel = async (approvalStatus: 'draft' | 'approved', finalName: string) => {
        if (!activeMapping || !detectedFingerprint) {
            showToast("Não foi possível detectar um padrão claro para salvar.", "error");
            return;
        }
        if (!user) {
            showToast("Você precisa estar logado.", "error");
            return;
        }

        setIsSavingModel(true);
        try {
            // GENERATE SNIPPET FROM GRID IF RAW CONTENT IS MISSING (PDF/IMG/EXCEL)
            // This ensures "Relearn" works for all file types by having a text representation
            let finalSnippet = activeFile?.content?.substring(0, 5000) || ''; 
            
            if (!finalSnippet && gridData.length > 0) {
                // Serialize first 50 rows of gridData to CSV format as snippet
                // Use semicolon as standard separator for snippet
                finalSnippet = gridData
                    .slice(0, 50)
                    .map(row => row.join(';')) 
                    .join('\n');
            }

            const newModel: Omit<FileModel, 'id' | 'createdAt'> = {
                name: finalName,
                user_id: user.id,
                version: initialModel ? initialModel.version + 1 : 1,
                lineage_id: initialModel ? initialModel.lineage_id : `mod-${Date.now()}`,
                is_active: true,
                fingerprint: detectedFingerprint,
                mapping: activeMapping,
                parsingRules: {
                    ignoredKeywords: initialModel?.parsingRules?.ignoredKeywords || [],
                    rowFilters: []
                },
                snippet: finalSnippet,
                lastUsedAt: new Date().toISOString(),
                status: approvalStatus,
                approvedBy: approvalStatus === 'approved' ? user.id : undefined,
                approvedAt: approvalStatus === 'approved' ? new Date().toISOString() : undefined
            };

            const saved = await modelService.saveModel(newModel);
            
            if (approvalStatus === 'approved') {
                showToast("Modelo aprovado e pronto para uso!", "success");
            } else {
                showToast("Rascunho salvo com sucesso.", "success");
            }
            
            if (onSuccess && saved) {
                const validOnly = processedTransactions.filter(t => t.isValid && t.status === 'valid');
                onSuccess(saved as FileModel, validOnly);
            } else {
                onClose(); 
            }
        } catch (error: any) {
            console.error("Erro ao salvar modelo:", error);
            showToast("Erro ao salvar modelo: " + error.message, "error");
        } finally {
            setIsSavingModel(false);
        }
    };

    const columnOptions = useMemo(() => {
        if (gridData.length === 0) return [];
        const maxCols = gridData.reduce((max, row) => Math.max(max, row.length), 0);
        return getColumnOptions(maxCols);
    }, [gridData]);

    if (!activeFile) {
        return createPortal(
            <div className="fixed inset-0 z-[9999] bg-[#050B14]/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-[#0F172A] w-full max-w-xl rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-scale-in relative p-8">
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">Criar Novo Modelo</h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group relative cursor-pointer min-h-[240px]">
                        <input 
                            type="file" 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                            onChange={handleInternalFileUpload}
                            accept=".csv,.txt,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.webp"
                        />
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-full text-indigo-500 group-hover:scale-110 transition-transform duration-300">
                            <UploadIcon className="w-8 h-8" />
                        </div>
                        <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                            Arraste ou clique para selecionar
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                            Suporta CSV, Excel (XLSX), PDF, TXT e Imagens
                        </p>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#050B14]/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in overflow-hidden">
            <div className="bg-white dark:bg-[#0F172A] w-full max-w-[1600px] h-full max-h-[95dvh] rounded-xl sm:rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-scale-in relative">
                
                {/* Header (Fixo) */}
                <div className="px-4 md:px-6 py-4 bg-slate-100 dark:bg-[#020610] border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-3 z-20">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className={`p-2.5 rounded-full ${isTestMode ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'} border`}>
                            {isTestMode ? <PlayCircleIcon className="w-5 h-5" /> : <WrenchScrewdriverIcon className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2 flex-wrap">
                                <span className="truncate">Laboratório</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider whitespace-nowrap ${isTestMode ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                    {isTestMode ? 'Validação' : 'Aprendizado'}
                                </span>
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-mono text-amber-600 dark:text-amber-400 truncate max-w-[200px]">{activeFile?.fileName}</span>
                                <span className="hidden sm:inline">•</span>
                                <span className="hidden sm:inline">Status: <strong className="text-emerald-600 dark:text-emerald-400">{strategyUsed}</strong></span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wide bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800">
                            <div className="flex gap-3">
                                <span>Total: {stats.totalRaw}</span>
                                <span className="text-amber-600 dark:text-amber-400">Potenciais: {stats.potential}</span>
                                <span className="text-emerald-600 dark:text-emerald-400">Agrupados: {stats.grouped}</span>
                            </div>
                        </div>

                        {hasStructuredResult && !isTestMode && (
                            <div className="flex gap-1 ml-2 shrink-0">
                                <button 
                                    onClick={() => initiateSave('draft')} 
                                    disabled={isSavingModel || !hasStructuredResult}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-full text-[10px] font-bold uppercase transition-all disabled:opacity-50"
                                >
                                    <span>Rascunho</span>
                                </button>
                                <button 
                                    onClick={() => initiateSave('approved')} 
                                    disabled={isSavingModel || !hasStructuredResult}
                                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-full text-[10px] font-bold uppercase transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                                >
                                    {isSavingModel ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <ShieldCheckIcon className="w-3 h-3" />}
                                    <span className="hidden sm:inline">Aprovar</span>
                                </button>
                            </div>
                        )}
                        
                        {isTestMode && (
                            <button 
                                onClick={onClose} 
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-2"
                            >
                                <XMarkIcon className="w-4 h-4" /> Fechar Teste
                            </button>
                        )}

                        {!isTestMode && (
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Workspace (Flexível) */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-0">
                    
                    {/* LEFT PANEL: RAW SOURCE */}
                    <div className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120] lg:w-1/2">
                        
                        {/* Controles de Mapeamento (Sticky Header do Painel) */}
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-wrap gap-3 items-center z-20 shrink-0">
                            {!activeMapping && gridData.length > 0 ? (
                                <div className="w-full flex justify-between items-center">
                                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                                        Modo Visualização (Leitura IA)
                                    </span>
                                    <button 
                                        onClick={() => setActiveMapping({ dateColumnIndex: 0, descriptionColumnIndex: 1, amountColumnIndex: 2, skipRowsStart: 0 })}
                                        className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-full text-[10px] font-bold uppercase transition-all shadow-md active:scale-95"
                                    >
                                        Criar Modelo de Mapeamento
                                    </button>
                                </div>
                            ) : activeMapping && (
                                <>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                        <AdjustmentsHorizontalIcon className="w-3 h-3" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500">Mapeamento:</span>
                                </div>

                                <div className="flex flex-wrap gap-2 items-center flex-1">
                                    {/* Data */}
                                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-full px-2 py-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <label className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase">Data</label>
                                        <select 
                                            value={activeMapping.dateColumnIndex}
                                            onChange={(e) => setActiveMapping({...activeMapping, dateColumnIndex: parseInt(e.target.value)})}
                                            disabled={isTestMode}
                                            className="bg-transparent text-xs outline-none w-20 sm:w-24 text-slate-700 dark:text-slate-200"
                                        >
                                            {columnOptions.map(opt => <option key={`d-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>

                                    {/* Desc */}
                                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-full px-2 py-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <label className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase">Desc</label>
                                        <select 
                                            value={activeMapping.descriptionColumnIndex}
                                            onChange={(e) => setActiveMapping({...activeMapping, descriptionColumnIndex: parseInt(e.target.value)})}
                                            disabled={isTestMode}
                                            className="bg-transparent text-xs outline-none w-20 sm:w-24 text-slate-700 dark:text-slate-200"
                                        >
                                            {columnOptions.map(opt => <option key={`desc-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>

                                    {/* Valor */}
                                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-full px-2 py-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <label className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Valor</label>
                                        <select 
                                            value={activeMapping.amountColumnIndex}
                                            onChange={(e) => setActiveMapping({...activeMapping, amountColumnIndex: parseInt(e.target.value)})}
                                            disabled={isTestMode}
                                            className="bg-transparent text-xs outline-none w-20 sm:w-24 text-slate-700 dark:text-slate-200"
                                        >
                                            {columnOptions.map(opt => <option key={`amt-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>

                                    {/* Pular Linhas */}
                                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-full px-2 py-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Pular</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max="50" 
                                            value={activeMapping.skipRowsStart}
                                            onChange={(e) => setActiveMapping({...activeMapping, skipRowsStart: parseInt(e.target.value)})}
                                            disabled={isTestMode}
                                            className="w-10 bg-transparent text-xs outline-none text-center text-slate-700 dark:text-slate-200"
                                        />
                                    </div>
                                </div>

                                <div className="ml-auto w-full sm:w-auto">
                                    <button 
                                        onClick={runSimulation}
                                        disabled={!activeMapping || gridData.length === 0}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-full text-[10px] font-bold uppercase shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Rodar simulação com o mapeamento atual"
                                    >
                                        <PlayCircleIcon className="w-3.5 h-3.5" />
                                        <span>Simular</span>
                                    </button>
                                </div>
                                </>
                            )}
                        </div>
                        
                        {/* Conteúdo (Scrollable Area) */}
                        <div className="flex-1 relative bg-white dark:bg-[#0B1120] overflow-hidden min-h-0">
                            {isPdf && activeFile?.rawFile && !isAiProcessing ? (
                                <div className="absolute inset-0">
                                    <PDFRenderer file={activeFile.rawFile} />
                                </div>
                            ) : isImage && activeFile?.rawFile && !isAiProcessing ? (
                                <ImageRenderer file={activeFile.rawFile} />
                            ) : (
                                <SpreadsheetRenderer data={gridData} isLoading={isGridLoading} detectedMapping={activeMapping} isAiProcessed={isAiProcessing} />
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: OUTPUT & TEACHING */}
                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0F172A] lg:w-1/2">
                        
                        {/* BANNER DE ENSINO (Aparece após corrigir uma linha) */}
                        {learnedPatternSource && (
                            <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50/50 dark:from-purple-900/30 dark:to-indigo-900/20 border-b border-purple-100 dark:border-purple-800 flex items-center justify-between gap-3 animate-fade-in">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                                        <BrainIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest">Modo Ensino Ativo</h4>
                                        <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80">
                                            Você corrigiu uma linha. Deseja usar isso para ensinar a IA?
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setLearnedPatternSource(null)}
                                        className="px-4 py-1.5 rounded-full border border-purple-200 text-purple-600 hover:bg-purple-100 text-[10px] font-bold uppercase transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={handleApplyCorrectionPattern}
                                        disabled={isInferringMapping}
                                        className="flex items-center gap-2 px-5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full text-[10px] font-bold uppercase shadow-sm transition-all active:scale-95"
                                    >
                                        {isInferringMapping ? (
                                            <>
                                                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Aprendendo...
                                            </>
                                        ) : (
                                            <>
                                                <BoltIcon className="w-3.5 h-3.5" /> Aplicar Padrão
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex justify-between items-center shadow-sm z-10 shrink-0">
                            <div className="flex items-center gap-2">
                                <CodeBracketSquareIcon className="w-4 h-4" />
                                <span>
                                    {!activeMapping ? 'Prévia do Arquivo (Somente Leitura)' : `Resultado Simulado ${isTestMode ? '(Validação)' : '(Tempo Real)'}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>Linhas estruturadas retornadas: {processedTransactions.length}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar p-0 min-h-0">
                            {processedTransactions.length > 0 ? (
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                                        <tr>
                                            <th className="p-3 font-bold text-slate-500 dark:text-slate-400 w-24 bg-white dark:bg-slate-900">Data</th>
                                            <th className="p-3 font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">Descrição (Limpa)</th>
                                            <th className="p-3 font-bold text-slate-500 dark:text-slate-400 w-24 bg-white dark:bg-slate-900">Tipo</th>
                                            <th className="p-3 font-bold text-slate-500 dark:text-slate-400 text-right w-28 bg-white dark:bg-slate-900">Valor</th>
                                            <th className="p-3 font-bold text-slate-500 dark:text-slate-400 text-center w-16 bg-white dark:bg-slate-900">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {processedTransactions.map((tx, idx) => {
                                            const isEditing = editingRowIndex === idx;
                                            const isPending = tx.status === 'pending';
                                            const isInvalid = !tx.isValid && tx.status === 'error'; 
                                            const isIgnored = tx.status === 'ignored';
                                            
                                            if (isEditing && editingRowData) {
                                                return (
                                                    <tr key={tx.id} className="bg-blue-50 dark:bg-blue-900/20">
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={editingRowData.date} 
                                                                onChange={(e) => setEditingRowData({...editingRowData, date: e.target.value})}
                                                                className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={editingRowData.cleanedDescription} 
                                                                onChange={(e) => setEditingRowData({...editingRowData, cleanedDescription: e.target.value})}
                                                                className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={editingRowData.contributionType || ''} 
                                                                onChange={(e) => setEditingRowData({...editingRowData, contributionType: e.target.value})}
                                                                className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={editingRowData.amount} 
                                                                onChange={(e) => setEditingRowData({...editingRowData, amount: parseFloat(e.target.value) || 0})}
                                                                className="w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 text-xs text-right"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={handleSaveRow} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"><CheckCircleIcon className="w-4 h-4" /></button>
                                                                <button onClick={handleCancelEdit} className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return (
                                                <tr key={tx.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isIgnored ? 'opacity-30 bg-slate-100 dark:bg-slate-900 pointer-events-none grayscale' : isInvalid ? 'opacity-60 bg-red-50/20' : isPending ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                                                    <td className="p-3 font-mono text-slate-600 dark:text-slate-300 truncate max-w-[100px]" title={tx.date}>
                                                        {activeMapping && tx.isValid ? tx.date.split('-').reverse().join('/') : tx.date}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className={`font-bold truncate max-w-[300px] ${isInvalid ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'} ${isIgnored ? 'line-through' : ''}`} title={tx.cleanedDescription}>
                                                            {tx.cleanedDescription}
                                                        </div>
                                                        {isIgnored && <span className="text-[8px] uppercase font-bold text-slate-400">Ignorado (Header)</span>}
                                                        {isPending && <span className="text-[8px] uppercase font-bold text-amber-500">Pendente (Verificar)</span>}
                                                        {activeMapping && !isIgnored && !isPending && (
                                                            <div className="text-[9px] text-slate-400 truncate max-w-[300px] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                Original: {tx.description}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${tx.contributionType === 'LEITURA_BRUTA' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                            {tx.contributionType || 'OUTROS'}
                                                        </span>
                                                    </td>
                                                    <td className={`p-3 text-right font-mono font-bold ${tx.amount < 0 ? 'text-red-500' : tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                        {activeMapping && (tx.isValid || isPending) ? formatToBRL(tx.amount) : (isInvalid ? '-' : '-')}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {!isIgnored && (
                                                            <button 
                                                                onClick={() => handleStartEdit(tx, idx)} 
                                                                className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                title="Corrigir linha"
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                                    <DocumentArrowDownIcon className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
                                        {strategyUsed.includes('Aguardando') ? 'Aguardando simulação' : 'Nenhum dado encontrado'}
                                    </p>
                                    <p className="text-xs mt-2 max-w-xs mx-auto opacity-70">
                                        {strategyUsed.includes('Aguardando') 
                                            ? 'Configure o mapeamento e clique em "Simular Resultado".' 
                                            : 'O mapeamento atual não retornou transações válidas.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer (Fixo) */}
                <div className="px-4 md:px-6 py-3 bg-slate-100 dark:bg-[#020610] border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex justify-between items-center shrink-0 z-20">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isTestMode ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></span>
                            {isTestMode ? 'Ambiente de Teste Seguro' : 'Visualização Fiel'}
                        </span>
                        
                        {/* NOVO: Contador de Linhas Detectadas vs Estruturadas */}
                        {gridData.length > 0 && (
                            <span className="flex items-center gap-2 border-l border-slate-300 dark:border-slate-700 pl-3 ml-2">
                                <span className="text-slate-400">Doc: <strong>{Math.min(gridData.length, 500)}</strong> linhas</span>
                                <span className="text-emerald-600 dark:text-emerald-400">IA: <strong>{processedTransactions.length}</strong> linhas</span>
                            </span>
                        )}
                    </div>
                    {!isTestMode && activeMapping && (
                        <div className="flex items-center gap-2">
                            <BrainIcon className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="hidden sm:inline">Ensine o sistema salvando este modelo.</span>
                            <span className="sm:hidden">Salvar modelo para aprender.</span>
                        </div>
                    )}
                </div>
            </div>

            {/* --- NAMING MODAL (PORTAL) --- */}
            {showNameModal && (
                <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Salvar Modelo</h3>
                            <form onSubmit={confirmSave} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nome do Modelo <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={modelName}
                                        onChange={(e) => setModelName(e.target.value)}
                                        placeholder="Ex: Extrato Itaú PJ"
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Descrição (Opcional)</label>
                                    <input 
                                        type="text" 
                                        value={modelDescription}
                                        onChange={(e) => setModelDescription(e.target.value)}
                                        placeholder="Ex: Usado para dízimos"
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowNameModal(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold uppercase hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                                    >
                                        Salvar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};
