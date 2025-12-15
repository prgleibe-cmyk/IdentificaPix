
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, DocumentArrowDownIcon, WrenchScrewdriverIcon, TrashIcon, PlusCircleIcon, UploadIcon, SparklesIcon, EyeIcon, ClipboardDocumentIcon } from '../Icons';
import { useUI } from '../../contexts/UIContext';

// Referências locais para bibliotecas
let pdfjsLib: any = null;
let mammoth: any = null;
let XLSX: any = null;

interface FilePreprocessorModalProps {
    onClose: () => void;
}

interface CleanRow {
    id: string;
    date: string;
    description: string;
    amount: string; 
}

export const FilePreprocessorModal: React.FC<FilePreprocessorModalProps> = ({ onClose }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useUI();
    
    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<'pdf' | 'excel' | 'docx' | 'text' | null>(null);
    
    // Estado do Painel Esquerdo
    const pdfContainerRef = useRef<HTMLDivElement>(null);
    const [rawExcelData, setRawExcelData] = useState<string[][]>([]);
    const [rawHtmlData, setRawHtmlData] = useState<string>('');
    const [fullRawText, setFullRawText] = useState<string>(''); 
    const [viewMode, setViewMode] = useState<'visual' | 'text'>('visual');
    
    // Estado do Painel Direito
    const [cleanRows, setCleanRows] = useState<CleanRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAiWorking, setIsAiWorking] = useState(false);

    // Carregador Robusto de Bibliotecas
    const ensureLibsLoaded = async () => {
        try {
            // 1. PDF.js
            if ((window as any).pdfjsLib) {
                pdfjsLib = (window as any).pdfjsLib;
            } 
            if (!pdfjsLib) {
                try {
                    const pdfModule = await import('pdfjs-dist');
                    pdfjsLib = pdfModule.default || pdfModule;
                } catch (e) {
                    console.warn("PDF.js import failed", e);
                }
            }
            if (pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                const version = pdfjsLib.version || '3.11.174';
                if (String(version).startsWith('5.')) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
                } else {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
                }
            }

            // 2. Mammoth
            if ((window as any).mammoth) {
                mammoth = (window as any).mammoth;
            } else if (!mammoth) {
                try {
                    const mod = await import('mammoth');
                    mammoth = mod.default || mod;
                } catch (e) { console.warn("Mammoth import failed", e); }
            }

            // 3. XLSX
            if ((window as any).XLSX) {
                XLSX = (window as any).XLSX;
            } else if (!XLSX) {
                try {
                    const mod = await import('xlsx');
                    XLSX = mod.default || mod;
                } catch (e) { console.warn("XLSX import failed", e); }
            }
        } catch (e) {
            console.error("Critical error loading libraries", e);
        }
    };

    useEffect(() => {
        ensureLibsLoaded();
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        
        setFile(selectedFile);
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        await processFile(selectedFile);
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const extractCleanRows = (lines: string[]): CleanRow[] => {
        const extracted: CleanRow[] = [];
        
        lines.forEach((line) => {
            if (!line.trim()) return;
            const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
            const amountMatches = line.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|-?\d+(?:\.\d{2})?/g);
            
            if (dateMatch || amountMatches) {
                const date = dateMatch ? dateMatch[0] : '';
                let amount = '';
                if (amountMatches && amountMatches.length > 0) {
                    amount = amountMatches[amountMatches.length - 1]; 
                }

                let description = line;
                if (date) description = description.replace(date, '');
                if (amount) description = description.replace(amount, '');
                
                description = description.replace(/[";]/g, '').trim();

                extracted.push({
                    id: Math.random().toString(36).substr(2, 9),
                    date,
                    description,
                    amount
                });
            }
        });

        return extracted;
    };

    const processFile = async (file: File) => {
        setIsProcessing(true);
        setCleanRows([]);
        setRawExcelData([]);
        setRawHtmlData('');
        setFullRawText('');
        setViewMode('visual');
        
        if (pdfContainerRef.current) {
            pdfContainerRef.current.innerHTML = '';
        }

        try {
            await ensureLibsLoaded();

            const fileNameLower = file.name.toLowerCase();
            const fileBuffer = await file.arrayBuffer();

            if (fileNameLower.endsWith('.pdf')) {
                setFileType('pdf');
                if (!pdfjsLib) throw new Error("Biblioteca PDF não carregada. Verifique sua conexão.");
                
                const loadingTask = pdfjsLib.getDocument(new Uint8Array(fileBuffer));
                const pdf = await loadingTask.promise;
                const totalPages = pdf.numPages;
                const allTextLines: string[] = [];

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.className = "mb-4 shadow-md rounded-lg mx-auto bg-white";
                    canvas.style.maxWidth = "100%";
                    
                    if (pdfContainerRef.current) {
                        pdfContainerRef.current.appendChild(canvas);
                    }

                    await page.render({ canvasContext: context, viewport: viewport }).promise;

                    const textContent = await page.getTextContent();
                    const items = textContent.items.map((item: any) => ({
                        str: item.str,
                        x: item.transform[4],
                        y: item.transform[5]
                    }));
                    
                    const linesMap = new Map<number, string[]>();
                    items.forEach((item: any) => {
                        const y = Math.round(item.y);
                        if (!linesMap.has(y)) linesMap.set(y, []);
                        linesMap.get(y)?.push(item);
                    });

                    const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
                    sortedY.forEach(y => {
                        const lineItems = linesMap.get(y) || [];
                        lineItems.sort((a: any, b: any) => a.x - b.x);
                        const lineStr = lineItems.map((i: any) => i.str).join(' ');
                        allTextLines.push(lineStr);
                    });
                }
                
                const fullText = allTextLines.join('\n');
                setFullRawText(fullText);
                setCleanRows(extractCleanRows(allTextLines));

            } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
                setFileType('excel');
                if (!XLSX) throw new Error("Biblioteca Excel não carregada.");
                
                const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
                setRawExcelData(jsonData.slice(0, 100));

                const textLines = jsonData.map(row => row.join(' '));
                const fullText = textLines.join('\n');
                setFullRawText(fullText);
                setCleanRows(extractCleanRows(textLines));

            } else if (fileNameLower.endsWith('.docx')) {
                setFileType('docx');
                if (!mammoth) throw new Error("Biblioteca Word não carregada.");
                
                const result = await mammoth.convertToHtml({ arrayBuffer: fileBuffer });
                setRawHtmlData(result.value);
                
                const rawText = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
                setFullRawText(rawText.value);
                setCleanRows(extractCleanRows(rawText.value.split('\n')));

            } else {
                setFileType('text');
                const text = new TextDecoder().decode(fileBuffer);
                setRawHtmlData(`<pre class="whitespace-pre-wrap font-mono text-xs">${text}</pre>`);
                setFullRawText(text);
                setCleanRows(extractCleanRows(text.split('\n')));
            }

        } catch (error: any) {
            console.error(error);
            showToast(`Erro: ${error.message || 'Falha ao ler arquivo'}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCellChange = (id: string, field: keyof CleanRow, value: string) => {
        setCleanRows(prev => prev.map(row => 
            row.id === id ? { ...row, [field]: value } : row
        ));
    };

    const handleDeleteRow = (id: string) => {
        setCleanRows(prev => prev.filter(row => row.id !== id));
    };

    const handleAddRow = () => {
        setCleanRows(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            date: '',
            description: '',
            amount: ''
        }, ...prev]);
    };

    const handleAIAutoComplete = async () => {
        if (!fullRawText) {
            showToast("Nenhum texto para analisar.", "error");
            return;
        }

        setIsAiWorking(true);

        try {
            const examples = cleanRows.filter(r => r.date.trim() && r.amount.trim() && r.description.trim());
            
            const response = await fetch('/api/ai/extract-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: fullRawText,
                    examples: examples.length > 0 ? examples.slice(0, 3) : undefined
                })
            });

            if (!response.ok) throw new Error("Erro no servidor de IA");

            const extractedRows = await response.json();
            
            const newRows: CleanRow[] = extractedRows.map((r: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                date: r.date || '',
                description: r.description || '',
                amount: r.amount || ''
            }));

            setCleanRows(newRows);
            showToast(`${newRows.length} linhas extraídas!`, 'success');

        } catch (error: any) {
            console.error(error);
            showToast("Erro na análise de IA.", 'error');
        } finally {
            setIsAiWorking(false);
        }
    };

    const handleDownloadCleanCsv = () => {
        const header = "Data,Descrição,Valor\n";
        const rows = cleanRows.map(r => {
            const desc = r.description.replace(/"/g, '""');
            return `${r.date},"${desc}",${r.amount}`;
        }).join('\n');
        
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `formatado_${file?.name || 'dados'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-md animate-fade-in">
            <div className="glass-modal rounded-2xl w-full max-w-[95vw] lg:max-w-[90vw] xl:max-w-7xl h-[85vh] flex flex-col overflow-hidden relative shadow-2xl border border-white/10">
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf,.csv,.xlsx,.xls,.docx,.txt" 
                    onChange={handleFileChange} 
                />

                {/* Top Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 shrink-0 gap-4 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg text-white shadow-lg shadow-violet-500/20">
                            <WrenchScrewdriverIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">Laboratório de Arquivos</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {file ? 'Edite os dados extraídos ou use a IA para limpar.' : 'Carregue arquivos difíceis (PDF, Imagens) para extrair dados.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={triggerFileUpload}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer transition-colors text-sm font-bold border border-slate-200 dark:border-slate-600"
                        >
                            <span>Carregar Arquivo</span>
                        </button>
                        
                        {cleanRows.length > 0 && (
                            <button 
                                onClick={handleDownloadCleanCsv}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg hover:-translate-y-0.5 transition-all"
                            >
                                <DocumentArrowDownIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Baixar CSV Limpo</span>
                            </button>
                        )}

                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors ml-2">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700">
                    
                    {/* LEFT PANEL: Original Viewer */}
                    <div className="w-full md:w-1/2 flex flex-col bg-slate-100/50 dark:bg-slate-900/50 relative">
                        <div className="px-4 py-3 bg-slate-200/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 backdrop-blur-sm">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                                1. Visualização Original {file ? `(${file.name})` : ''}
                            </span>
                            
                            {file && (
                                <div className="flex bg-slate-300 dark:bg-slate-700 rounded-lg p-0.5">
                                    <button 
                                        onClick={() => setViewMode('visual')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'visual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'}`}
                                    >
                                        <EyeIcon className="w-3 h-3 inline mr-1" />
                                        Visual
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('text')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'}`}
                                    >
                                        <ClipboardDocumentIcon className="w-3 h-3 inline mr-1" />
                                        Texto
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar select-text">
                            {!file ? (
                                <div 
                                    onClick={triggerFileUpload}
                                    className="h-full flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 m-4 rounded-xl group"
                                >
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-3 group-hover:scale-110 transition-transform shadow-sm">
                                        <UploadIcon className="w-8 h-8 text-indigo-500" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Clique para carregar</p>
                                    <p className="text-xs text-slate-400">PDF, Excel, Word</p>
                                </div>
                            ) : (
                                <>
                                    {isProcessing && (
                                        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center z-10">
                                            <div className="flex flex-col items-center">
                                                <svg className="animate-spin h-8 w-8 text-indigo-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                <span className="text-sm font-bold text-indigo-600 animate-pulse">Lendo arquivo...</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`${viewMode === 'text' ? 'block' : 'hidden'} h-full`}>
                                        <textarea 
                                            className="w-full h-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs text-slate-600 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={fullRawText}
                                            readOnly
                                            placeholder="O texto extraído aparecerá aqui..."
                                        />
                                    </div>

                                    <div className={`${viewMode === 'visual' ? 'block' : 'hidden'}`}>
                                        <div ref={pdfContainerRef} className={`${fileType === 'pdf' ? 'block' : 'hidden'} w-full flex flex-col items-center`}></div>
                                        
                                        {fileType === 'excel' && (
                                            <div className="bg-white dark:bg-slate-800 shadow-sm rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                                <table className="w-full text-xs text-left">
                                                    <tbody>
                                                        {rawExcelData.map((row, i) => (
                                                            <tr key={i} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                                                                <td className="p-2 bg-slate-50 dark:bg-slate-700/50 font-mono text-slate-400 border-r border-slate-100 dark:border-slate-700 select-none w-8 text-center">{i + 1}</td>
                                                                {row.map((cell, j) => (
                                                                    <td key={j} className="p-2 border-r border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 whitespace-nowrap overflow-hidden max-w-[150px] text-ellipsis" title={String(cell)}>
                                                                        {String(cell)}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {(fileType === 'docx' || fileType === 'text') && (
                                            <div 
                                                className="bg-white dark:bg-slate-800 p-8 shadow-sm rounded-lg min-h-full prose prose-sm dark:prose-invert max-w-none select-text"
                                                dangerouslySetInnerHTML={{ __html: rawHtmlData }}
                                            />
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Clean Data Editor */}
                    <div className="w-full md:w-1/2 flex flex-col bg-white/80 dark:bg-slate-800/80 relative backdrop-blur-md">
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                2. Dados Extraídos
                            </span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleAIAutoComplete} 
                                    disabled={!fullRawText || isAiWorking}
                                    className="text-xs flex items-center gap-1.5 text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg font-bold shadow-md hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isAiWorking ? (
                                        <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <SparklesIcon className="w-3.5 h-3.5" />
                                    )}
                                    Extrair com IA
                                </button>
                                <button onClick={handleAddRow} className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-bold px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                    <PlusCircleIcon className="w-4 h-4" />
                                    Add
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar relative">
                            {isAiWorking && (
                                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center">
                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col items-center border border-indigo-100 dark:border-indigo-900">
                                        <div className="relative w-12 h-12 mb-3">
                                            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900"></div>
                                            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                                            <SparklesIcon className="absolute inset-0 m-auto w-5 h-5 text-indigo-600 animate-pulse" />
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-white text-sm">IA Analisando Padrões...</p>
                                    </div>
                                </div>
                            )}

                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-brand-bg/40 dark:bg-slate-700/30 text-xs uppercase font-bold text-slate-400 dark:text-slate-500 sticky top-0 z-10 shadow-sm backdrop-blur-md">
                                    <tr>
                                        <th className="p-4 border-b border-r border-slate-100 dark:border-slate-700 w-32">Data</th>
                                        <th className="p-4 border-b border-r border-slate-100 dark:border-slate-700">Descrição / Nome</th>
                                        <th className="p-4 border-b border-r border-slate-100 dark:border-slate-700 w-32 text-right">Valor</th>
                                        <th className="p-4 border-b border-slate-100 dark:border-slate-700 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                    {cleanRows.map((row) => (
                                        <tr key={row.id} className="group hover:bg-brand-blue/5 dark:hover:bg-indigo-900/10 transition-colors">
                                            <td className="p-2 border-r border-slate-50 dark:border-slate-700/50">
                                                <input 
                                                    type="text" 
                                                    value={row.date} 
                                                    onChange={(e) => handleCellChange(row.id, 'date', e.target.value)}
                                                    className="w-full bg-transparent p-2 rounded focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 font-mono text-xs"
                                                    placeholder="DD/MM/AAAA"
                                                />
                                            </td>
                                            <td className="p-2 border-r border-slate-50 dark:border-slate-700/50">
                                                <input 
                                                    type="text" 
                                                    value={row.description} 
                                                    onChange={(e) => handleCellChange(row.id, 'description', e.target.value)}
                                                    className="w-full bg-transparent p-2 rounded focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 font-medium"
                                                    placeholder="Descrição"
                                                />
                                            </td>
                                            <td className="p-2 border-r border-slate-50 dark:border-slate-700/50">
                                                <input 
                                                    type="text" 
                                                    value={row.amount} 
                                                    onChange={(e) => handleCellChange(row.id, 'amount', e.target.value)}
                                                    className="w-full bg-transparent p-2 rounded focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 text-right font-mono text-xs"
                                                    placeholder="0,00"
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button 
                                                    onClick={() => handleDeleteRow(row.id)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Remover linha"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {cleanRows.length === 0 && !isProcessing && (
                                        <tr>
                                            <td colSpan={4} className="p-10 text-center text-slate-400 text-sm">
                                                <div className="flex flex-col items-center gap-2">
                                                    <WrenchScrewdriverIcon className="w-8 h-8 opacity-30" />
                                                    <p>Nenhum dado identificado.</p>
                                                    <button onClick={handleAddRow} className="mt-2 text-indigo-600 font-bold hover:underline">Adicionar Linha</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
