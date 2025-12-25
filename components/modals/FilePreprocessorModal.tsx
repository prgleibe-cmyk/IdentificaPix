
import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { createPortal } from 'react-dom';
import { 
    XMarkIcon, 
    TableCellsIcon, 
    ArrowPathIcon, 
    BrainIcon,
    AdjustmentsHorizontalIcon,
    SparklesIcon,
    TrashIcon,
    FloppyDiskIcon,
    PlusCircleIcon,
    BoltIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CheckCircleIcon,
    ClockIcon,
    CursorArrowRaysIcon
} from '../Icons';
import { useUI } from '../../contexts/UIContext';
import { AppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { learnAndTransformFile, performInitialInference } from '../../services/geminiService';
import { generateFingerprint, cleanTransactionDescriptionForDisplay, normalizeString, extractSnippet } from '../../services/processingService';
import { modelService } from '../../services/modelService';
import { FileModel, Transaction } from '../../types';

// CONFIGURAÇÃO DE SEGURANÇA E RESILIÊNCIA
const CHUNK_SIZE = 40; 
const BASE_DELAY = 2000; 
const ROWS_PER_PAGE = 50;

/**
 * RENDERIZADOR DE PDF CONTÍNUO
 */
const PDFRenderer: React.FC<{ file: File }> = ({ file }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pages, setPages] = useState<number[]>([]);
    const [pdfInstance, setPdfInstance] = useState<any>(null);

    useEffect(() => {
        const loadPDF = async () => {
            const pdfjsLib = (window as any).pdfjsLib;
            if (!pdfjsLib) return;
            try {
                const buffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument(new Uint8Array(buffer));
                const pdf = await loadingTask.promise;
                setPdfInstance(pdf);
                setPages(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
            } catch (err) { console.error("PDF Load error:", err); }
        };
        loadPDF();
    }, [file]);

    const PageCanvas: React.FC<{ pageNum: number, pdf: any }> = ({ pageNum, pdf }) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        useEffect(() => {
            const render = async () => {
                if (!pdf || !canvasRef.current) return;
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (context) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport }).promise;
                }
            };
            render();
        }, [pageNum, pdf]);
        return (
            <div className="bg-white p-2 shadow-xl border border-slate-200 mb-6 rounded-sm max-w-full overflow-hidden">
                <canvas ref={canvasRef} className="w-full h-auto" />
            </div>
        );
    };

    return (
        <div ref={containerRef} className="p-8 flex flex-col items-center bg-slate-200 dark:bg-slate-950/50 min-h-full">
            {pages.map(p => <PageCanvas key={p} pageNum={p} pdf={pdfInstance} />)}
            {pages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <ArrowPathIcon className="w-10 h-10 animate-spin mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">Processando visualização...</p>
                </div>
            )}
        </div>
    );
};

interface TreatedRow {
    id: string;
    originalIndex?: number;
    date: string;
    name: string;
    amount: string;
    type?: string; // Adicionado campo type
    status: 'manual' | 'inferred' | 'unrecognized' | 'original' | 'suspect' | 'deleted' | 'processing' | 'invalid';
}

type ColumnType = 'ignore' | 'date' | 'description' | 'amount' | 'type';

const formatDisplayAmount = (val: string) => {
    // Retorna vazio se não houver valor ou for zero irrelevante
    if (!val || val === "0.00" || val === "") return "";
    
    // Substitui ponto por vírgula para visualização BR simples (editável)
    // Não usamos toLocaleString aqui para evitar formatação agressiva durante a digitação
    return val.replace('.', ',');
};

const parseInputAmount = (val: string) => {
    // Remove pontos de milhar (se o usuário colar "1.000,00") e substitui vírgula decimal por ponto
    // Permite digitação livre sem quebrar o estado interno
    return val.replace(/\./g, '').replace(',', '.').trim();
};

export const FilePreprocessorModal: React.FC<{ 
    onClose: () => void; 
    initialFile?: any;
    onSuccess?: (model: FileModel, data: Transaction[]) => void;
}> = ({ onClose, initialFile, onSuccess }) => {
    const { showToast, setIsLoading } = useUI();
    const { user } = useAuth();
    const { fetchModels, customIgnoreKeywords } = useContext(AppContext);
    
    const [rawRows, setRawRows] = useState<string[][]>([]);
    const [treatedRows, setTreatedRows] = useState<TreatedRow[]>([]);
    const [referenceRowIdx, setReferenceRowIdx] = useState<number | null>(null);
    const [isAILoading, setIsAILoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [viewMode, setViewMode] = useState<'original' | 'cells'>('cells'); // Default to cells for mapping
    const [currentPage, setCurrentPage] = useState(1);
    const [columnMapping, setColumnMapping] = useState<Record<number, ColumnType>>({});
    
    const [coolingDownSeconds, setCoolingDownSeconds] = useState<number>(0);

    const isPdf = useMemo(() => initialFile?.fileName?.toLowerCase().endsWith('.pdf'), [initialFile]);

    useEffect(() => {
        if (!initialFile) return;
        const lines = initialFile.content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 0) {
            let delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
            const parsed = lines.map(l => l.split(delimiter));
            setRawRows(parsed);
            
            setTreatedRows(parsed.map((_, i) => ({ 
                id: `row-${i}`, 
                originalIndex: i, 
                date: '', 
                name: '', 
                amount: '0.00',
                type: '',
                status: 'unrecognized' 
            })));
        }
    }, [initialFile]);

    // Aplica mapeamento manual instantaneamente
    useEffect(() => {
        const dateIdx = Object.keys(columnMapping).find(k => columnMapping[parseInt(k)] === 'date');
        const descIdx = Object.keys(columnMapping).find(k => columnMapping[parseInt(k)] === 'description');
        const amountIdx = Object.keys(columnMapping).find(k => columnMapping[parseInt(k)] === 'amount');
        const typeIdx = Object.keys(columnMapping).find(k => columnMapping[parseInt(k)] === 'type');

        if (dateIdx && descIdx && amountIdx) {
            const newTreated = rawRows.map((row, i) => {
                const rawDate = row[parseInt(dateIdx)] || '';
                const rawDesc = row[parseInt(descIdx)] || '';
                const rawAmount = row[parseInt(amountIdx)] || '0';
                const rawType = typeIdx ? (row[parseInt(typeIdx)] || '') : '';

                // Limpeza básica rápida
                const cleanedAmount = rawAmount.replace(/[R$\s]/g, '').replace(',', '.');
                
                return {
                    id: `row-${i}`,
                    originalIndex: i,
                    date: rawDate,
                    name: cleanTransactionDescriptionForDisplay(rawDesc, customIgnoreKeywords),
                    amount: isNaN(parseFloat(cleanedAmount)) ? '0.00' : parseFloat(cleanedAmount).toFixed(2),
                    type: rawType.toUpperCase().trim(),
                    status: (isNaN(parseFloat(cleanedAmount)) || rawDesc.length < 2) ? 'invalid' : 'inferred'
                } as TreatedRow;
            });
            setTreatedRows(newTreated);
        }
    }, [columnMapping, rawRows, customIgnoreKeywords]);

    const handleColumnTypeChange = (colIndex: number, type: ColumnType) => {
        setColumnMapping(prev => {
            const next = { ...prev };
            // Remove o tipo de outras colunas se for único (date, desc, amount, type)
            if (type !== 'ignore') {
                Object.keys(next).forEach(k => {
                    if (next[parseInt(k)] === type) delete next[parseInt(k)];
                });
            }
            next[colIndex] = type;
            return next;
        });
    };

    const getColumnColor = (colIndex: number) => {
        const type = columnMapping[colIndex];
        if (type === 'date') return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300';
        if (type === 'description') return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300';
        if (type === 'amount') return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300';
        if (type === 'type') return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300';
        return 'border-transparent';
    };

    const smartPause = async (seconds: number) => {
        for (let i = seconds; i > 0; i--) {
            setCoolingDownSeconds(i);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setCoolingDownSeconds(0);
    };

    const handleRunAIExtraction = async () => {
        // Limpa mapeamento manual se usar IA
        setColumnMapping({});
        setIsAILoading(true);
        const total = rawRows.length;
        setProgress({ current: 0, total });

        setTreatedRows(prev => prev.map(r => ({ ...r, status: 'processing' })));

        let i = 0;
        let consecutiveErrors = 0;

        while (i < total) {
            const chunk = rawRows.slice(i, i + CHUNK_SIZE);
            try {
                if (i > 0) await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
                
                const results = await performInitialInference(chunk);
                consecutiveErrors = 0;
                
                setTreatedRows(prev => {
                    const next = [...prev];
                    results.forEach((res: any) => {
                        const realIdx = i + res.originalIndex;
                        const targetPos = next.findIndex(r => r.originalIndex === realIdx);
                        if (targetPos !== -1) {
                            const isValid = res.date && res.amount && res.date !== "N/A" && res.amount !== "0.00";
                            next[targetPos] = {
                                ...next[targetPos],
                                date: res.date || '',
                                name: cleanTransactionDescriptionForDisplay(res.name || '', customIgnoreKeywords),
                                amount: res.amount || '0.00',
                                status: isValid ? 'inferred' : 'invalid'
                            };
                        }
                    });
                    return next;
                });
                
                i += CHUNK_SIZE;
                setProgress(p => ({ ...p, current: Math.min(total, i) }));

            } catch (err: any) {
                console.error("Erro na extração IA:", err);
                const msg = err?.message?.toLowerCase() || '';
                
                if (msg.includes('quota') || msg.includes('429') || msg.includes('limit') || msg.includes('exceeded')) {
                    await smartPause(15); 
                } else {
                    consecutiveErrors++;
                    if (consecutiveErrors > 3) {
                        showToast("Muitos erros consecutivos. Parando.", "error");
                        break;
                    }
                    i += CHUNK_SIZE; 
                }
            }
        }
        setIsAILoading(false);
    };

    const handleApplyReference = async () => {
        // Verifica se há linhas manuais para usar de exemplo
        const manual = treatedRows.filter(r => r.status === 'manual' && r.originalIndex !== undefined).map(r => ({
            originalRow: rawRows[r.originalIndex!],
            corrected: { date: r.date, name: r.name, amount: r.amount }
        }));

        if (manual.length === 0) {
            // Se o usuário já selecionou colunas, o arquivo já está processado com status 'inferred'
            const hasMappedColumns = Object.keys(columnMapping).length >= 3; // Min: Date, Desc, Amount
            if (hasMappedColumns) {
                showToast("Colunas já mapeadas! Você pode Salvar o Modelo diretamente.", "success");
            } else {
                showToast("Edite pelo menos uma linha manualmente para a IA aprender, ou selecione as colunas acima.", "error");
            }
            return;
        }
        
        setIsAILoading(true);
        const total = rawRows.length;
        setProgress({ current: 0, total });

        let i = 0;
        let consecutiveErrors = 0;

        while (i < total) {
            const chunk = rawRows.slice(i, i + CHUNK_SIZE);
            try {
                if (i > 0) await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
                
                const results = await learnAndTransformFile(chunk, manual);
                
                consecutiveErrors = 0;

                setTreatedRows(prev => {
                    const next = [...prev];
                    results.forEach((res: any) => {
                        const realIdx = i + Number(res.originalIndex);
                        const targetPos = next.findIndex(r => r.originalIndex === realIdx);
                        if (targetPos !== -1 && next[targetPos].status !== 'manual') {
                            const isValid = res.date && res.amount && res.date !== "N/A" && res.amount !== "0.00";
                            next[targetPos] = { 
                                ...next[targetPos], 
                                date: res.date || '', 
                                name: cleanTransactionDescriptionForDisplay(res.name || '', customIgnoreKeywords), 
                                amount: res.amount || '0.00', 
                                status: isValid ? 'original' : 'invalid' 
                            };
                        }
                    });
                    return next;
                });
                
                i += CHUNK_SIZE;
                setProgress(p => ({ ...p, current: Math.min(total, i) }));

            } catch (err: any) { 
                console.error("Erro treinamento:", err);
                const msg = err?.message?.toLowerCase() || '';
                
                if (msg.includes('quota') || msg.includes('429') || msg.includes('limit') || msg.includes('exceeded')) {
                    await smartPause(15);
                } else {
                    consecutiveErrors++;
                    if (consecutiveErrors > 3) {
                        showToast("Falha crítica no processamento. Tente novamente.", "error");
                        break;
                    }
                    i += CHUNK_SIZE;
                }
            }
        }
        setIsAILoading(false);
    };

    const updateRowField = (id: string, field: keyof TreatedRow, value: string) => {
        setTreatedRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            let processedValue = value;
            if (field === 'amount') processedValue = parseInputAmount(value);
            return { ...r, [field]: processedValue, status: 'manual' };
        }));
    };

    const handleFinalize = async () => {
        if (!user || !initialFile) return;
        
        // Verifica se há linhas válidas (seja manual, inferida ou original)
        const validRows = treatedRows.filter(r => r.status !== 'invalid' && r.status !== 'deleted' && r.status !== 'unrecognized');
        if (validRows.length === 0) {
            showToast("Processe o arquivo ou edite linhas antes de salvar.", "error");
            return;
        }

        setIsLoading(true);
        try {
            const fingerprint = generateFingerprint(initialFile.content);
            if (fingerprint) {
                // Modelo: Agora com contexto (qual entidade) se possível no nome
                const entitySuffix = initialFile.type === 'contributor' ? '(Lista)' : '(Extrato)';
                const snippet = extractSnippet(initialFile.content); // Captura o snippet para uso futuro
                
                // Mapeamento: Busca os índices das colunas. Retorna string, converte para int. Se não achar, undefined.
                // IMPORTANTE: Object.keys retorna strings ('0', '1'). parseInt resolve.
                const findColIndex = (type: ColumnType) => {
                    const key = Object.keys(columnMapping).find(k => columnMapping[parseInt(k)] === type);
                    return key !== undefined ? parseInt(key) : -1;
                };

                const dateCol = findColIndex('date');
                const descCol = findColIndex('description');
                const amountCol = findColIndex('amount');
                const typeCol = findColIndex('type');

                // Se houver mapeamento manual válido (3 colunas principais), usamos ele.
                // Se não, usamos valores "dummy" (0,1,2) pois a IA pode ter aprendido via few-shot sem mapeamento explícito.
                const hasExplicitMapping = dateCol !== -1 && descCol !== -1 && amountCol !== -1;
                
                const finalMapping = hasExplicitMapping
                    ? { 
                        dateColumnIndex: dateCol, 
                        descriptionColumnIndex: descCol, 
                        amountColumnIndex: amountCol, 
                        typeColumnIndex: typeCol !== -1 ? typeCol : undefined, // Só inclui se for diferente de -1
                        skipRowsStart: 1, 
                        skipRowsEnd: 0, 
                        decimalSeparator: ',' as const, 
                        thousandsSeparator: '.' as const 
                      }
                    : { dateColumnIndex: 0, descriptionColumnIndex: 1, amountColumnIndex: 2, skipRowsStart: 1, skipRowsEnd: 0, decimalSeparator: ',' as const, thousandsSeparator: '.' as const };

                const modelData: Omit<FileModel, 'id' | 'createdAt'> = {
                    name: `Modelo Auto - ${initialFile.fileName} ${entitySuffix}`,
                    user_id: user.id, version: 1, lineage_id: `lin-${Date.now()}`, is_active: true,
                    fingerprint,
                    snippet, // Armazena o snippet no modelo
                    mapping: finalMapping,
                    parsingRules: { ignoredKeywords: customIgnoreKeywords, rowFilters: treatedRows.filter(r => r.status === 'deleted').map(r => r.name) }
                };
                
                const savedModel = await modelService.saveModel(modelData);
                
                // Atualiza o contexto global para que outras partes do app saibam do novo modelo
                await fetchModels();
                
                if (savedModel) {
                    showToast("Modelo salvo e ativado com sucesso!", "success");
                    
                    // Converte as linhas tratadas em Transações limpas
                    const processedData: Transaction[] = validRows.map((r, i) => ({
                        id: `tx-lab-${i}-${Date.now()}`,
                        date: r.date,
                        description: r.name,
                        amount: parseFloat(r.amount),
                        cleanedDescription: r.name,
                        originalAmount: r.amount,
                        contributionType: r.type // Passa o tipo adiante
                    }));

                    // Se houver callback de sucesso, invoca-o para atualizar a view pai sem reload
                    if (onSuccess) {
                        onSuccess(savedModel, processedData);
                    }
                    onClose();
                } else {
                    showToast("Erro ao gravar modelo no banco de dados.", "error");
                }
            } else {
                showToast("Não foi possível gerar a assinatura do arquivo.", "error");
            }
        } catch (e) { 
            console.error(e);
            showToast("Erro crítico ao salvar modelo.", "error"); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const visibleRows = useMemo(() => treatedRows.filter(r => r.status !== 'unrecognized' || r.originalIndex! < 20), [treatedRows]);
    const totalPages = Math.ceil(visibleRows.length / ROWS_PER_PAGE);
    const paginatedRows = useMemo(() => visibleRows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE), [visibleRows, currentPage]);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-fade-in font-sans">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-[1800px] h-[95vh] flex flex-col overflow-hidden shadow-2xl border border-white/10">
                <div className="flex items-center justify-between px-10 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-50">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl"><BrainIcon className="w-7 h-7" /></div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none">Laboratório de Layouts</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{initialFile?.fileName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleFinalize} className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95"><FloppyDiskIcon className="w-4 h-4" /> Salvar Modelo</button>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"><XMarkIcon className="w-8 h-8" /></button>
                    </div>
                </div>
                
                <div className="flex-1 flex overflow-hidden bg-[#F1F5F9] dark:bg-[#020610]">
                    <div className="basis-1/2 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 relative bg-slate-100 dark:bg-[#080c14] min-w-0">
                        <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 z-10">
                             <div className="flex items-center gap-2"><TableCellsIcon className="w-4 h-4 text-slate-500" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Documento Original</span></div>
                             <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
                                <button onClick={() => setViewMode('original')} className={`px-4 py-1 rounded-full text-[9px] font-black uppercase transition-all ${viewMode === 'original' ? 'bg-white dark:bg-slate-700 text-brand-blue shadow-md' : 'text-slate-400'}`}>Visualização</button>
                                <button onClick={() => setViewMode('cells')} className={`px-4 py-1 rounded-full text-[9px] font-black uppercase transition-all ${viewMode === 'cells' ? 'bg-white dark:bg-slate-700 text-brand-blue shadow-md' : 'text-slate-400'}`}>Células</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            {viewMode === 'original' ? (isPdf && initialFile?.rawFile ? <PDFRenderer file={initialFile.rawFile} /> : <div className="p-10"><pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre bg-white dark:bg-slate-800 p-10 rounded-2xl shadow-xl leading-relaxed select-all">{initialFile?.content}</pre></div>) : (
                                <table className="w-full text-[11px] border-collapse bg-white dark:bg-slate-900">
                                    <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-sm">
                                        <tr>
                                            <th className="w-12 px-3 py-2 text-center text-slate-400 uppercase font-black border-r border-b">#</th>
                                            {rawRows[0]?.map((_, i) => (
                                                <th key={i} className={`px-3 py-2 text-left font-black uppercase border-r border-b min-w-[150px] relative group transition-colors ${getColumnColor(i)}`}>
                                                    <div className="flex items-center justify-between">
                                                        <span className="opacity-70 group-hover:opacity-100">Col {i+1}</span>
                                                        <select 
                                                            value={columnMapping[i] || 'ignore'} 
                                                            onChange={(e) => handleColumnTypeChange(i, e.target.value as ColumnType)}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        >
                                                            <option value="ignore">Ignorar</option>
                                                            <option value="date">Data (DD/MM/AAAA)</option>
                                                            <option value="description">Descrição</option>
                                                            <option value="amount">Valor</option>
                                                            <option value="type">Tipo (Dízimo/Oferta)</option>
                                                        </select>
                                                        <div className="pointer-events-none p-1 rounded hover:bg-black/10">
                                                            <CursorArrowRaysIcon className="w-3 h-3" />
                                                        </div>
                                                    </div>
                                                    <div className="text-[8px] font-medium opacity-60 mt-0.5">
                                                        {columnMapping[i] ? columnMapping[i].toUpperCase() : '---'}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>{rawRows.map((row, idx) => (
                                            <tr key={idx} onClick={() => setReferenceRowIdx(idx)} className={`group cursor-pointer ${referenceRowIdx === idx ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-50'}`}>
                                                <td className={`text-center font-mono text-[10px] font-bold py-2 border-r ${referenceRowIdx === idx ? 'bg-indigo-600 text-white' : 'text-slate-400 bg-slate-50'}`}>{idx + 1}</td>
                                                {row.map((cell, cIdx) => (
                                                    <td key={cIdx} className={`px-3 py-2 border-r border-slate-100 whitespace-nowrap ${getColumnColor(cIdx).includes('bg-') ? getColumnColor(cIdx) : 'text-slate-500'}`}>
                                                        {cell || '---'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}</tbody>
                                </table>
                            )}
                        </div>
                    </div>
                    <div className="basis-1/2 shrink-0 flex flex-col bg-white dark:bg-slate-900 shadow-[-10px_0_30px_rgba(0,0,0,0.05)] relative z-20 min-w-0">
                        <div className="px-8 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2"><AdjustmentsHorizontalIcon className="w-4 h-4 text-emerald-500" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Extração Inteligente</span></div>
                                <div className="flex gap-2">
                                     <button onClick={handleRunAIExtraction} disabled={isAILoading} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50">
                                        <SparklesIcon className="w-4 h-4" /> Sugerir com IA
                                    </button>
                                    <button onClick={handleApplyReference} disabled={isAILoading} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50">
                                        <BoltIcon className="w-4 h-4" /> Aplicar Exemplo
                                    </button>
                                </div>
                            </div>
                            
                            {isAILoading && (
                                <div className="flex flex-col gap-2 mt-2 animate-fade-in bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                    {coolingDownSeconds > 0 ? (
                                        <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide animate-pulse">
                                                <ClockIcon className="w-3.5 h-3.5" />
                                                Pausa de Segurança (Cota). Retomando em...
                                            </div>
                                            <span className="text-xl font-black tabular-nums">{coolingDownSeconds}s</span>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center text-[9px] font-black text-indigo-600 uppercase tracking-tighter">
                                            <span className="flex items-center gap-1.5">
                                                <BoltIcon className="w-3.5 h-3.5 text-blue-500 animate-pulse" /> 
                                                <span>Processando Lote {progress.current}/{progress.total}...</span>
                                            </span>
                                            <span>{Math.round((progress.current/progress.total)*100)}%</span>
                                        </div>
                                    )}
                                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-300 ${coolingDownSeconds > 0 ? 'bg-amber-500' : 'bg-indigo-600'}`} 
                                            style={{ width: `${(progress.current/progress.total)*100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-xs border-collapse">
                                <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b">
                                    <tr>
                                        <th className="px-6 py-4 text-left w-32 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificação</th>
                                        <th className="px-6 py-4 text-right w-32 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                                        <th className="px-6 py-4 text-left w-24 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                                        <th className="px-6 py-4 w-12 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedRows.map((row) => (
                                        <tr key={row.id} className={`h-[48px] group transition-all ${referenceRowIdx === row.originalIndex ? 'bg-indigo-50/70 dark:bg-indigo-900/10' : ''}`}>
                                            <td className="px-6 py-0">
                                                {row.status === 'processing' ? (
                                                    <div className="w-16 h-3 bg-slate-100 animate-pulse rounded"></div>
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        value={row.date} 
                                                        placeholder="DD/MM/AAAA"
                                                        onChange={(e) => updateRowField(row.id, 'date', e.target.value)} 
                                                        className="w-full bg-transparent border-none outline-none font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 focus:text-indigo-600" 
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-0">
                                                {row.status === 'processing' ? (
                                                    <div className="flex-1 h-3 bg-slate-100 animate-pulse rounded"></div>
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        value={row.name} 
                                                        placeholder="Nome ou Descrição..."
                                                        onChange={(e) => updateRowField(row.id, 'name', e.target.value)} 
                                                        className="w-full bg-transparent border-none outline-none text-[12px] font-black text-slate-900 dark:text-white focus:text-indigo-600" 
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-0">
                                                {row.status === 'processing' ? (
                                                    <div className="w-12 h-3 bg-slate-100 animate-pulse rounded ml-auto"></div>
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        value={formatDisplayAmount(row.amount)} 
                                                        placeholder="0,00"
                                                        onChange={(e) => updateRowField(row.id, 'amount', e.target.value)} 
                                                        className={`w-full bg-transparent border-none outline-none text-right font-mono text-[12px] font-black focus:text-indigo-600 ${parseFloat(row.amount) < 0 ? 'text-red-600' : 'text-emerald-600'}`} 
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-0">
                                                {row.status === 'processing' ? (
                                                    <div className="w-10 h-3 bg-slate-100 animate-pulse rounded"></div>
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        value={row.type || ''} 
                                                        placeholder="---"
                                                        onChange={(e) => updateRowField(row.id, 'type', e.target.value)} 
                                                        className="w-full bg-transparent border-none outline-none text-[10px] font-bold text-slate-500 dark:text-slate-400 focus:text-indigo-600 uppercase" 
                                                    />
                                                )}
                                            </td>
                                            <td className="px-4 py-0 text-center">
                                                <div className="flex items-center justify-center">
                                                    {row.status === 'manual' ? (
                                                        <CheckCircleIcon className="w-4 h-4 text-emerald-500" title="Editado Manualmente" />
                                                    ) : row.status === 'inferred' || row.status === 'original' ? (
                                                        <BoltIcon className="w-3.5 h-3.5 text-indigo-500 opacity-50" title="Extraído Automaticamente" />
                                                    ) : (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-8 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mostrando {visibleRows.length > 0 ? (currentPage - 1) * ROWS_PER_PAGE + 1 : 0}-{Math.min(visibleRows.length, currentPage * ROWS_PER_PAGE)} de {visibleRows.length} registros</span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"><ChevronLeftIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                                <span className="text-[10px] font-black min-w-[50px] text-center">{currentPage} / {totalPages || 1}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"><ChevronRightIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
