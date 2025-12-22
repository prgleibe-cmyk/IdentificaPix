import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, DocumentArrowDownIcon, WrenchScrewdriverIcon, TrashIcon, PlusCircleIcon, UploadIcon, SparklesIcon, EyeIcon, ClipboardDocumentIcon, TableCellsIcon, PhotoIcon } from '../Icons';
import { useUI } from '../../contexts/UIContext';
import { extractDataFromText } from '../../services/geminiService';

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
    
    const pdfContainerRef = useRef<HTMLDivElement>(null);
    const [rawExcelData, setRawExcelData] = useState<string[][]>([]);
    const [fullRawText, setFullRawText] = useState<string>(''); 
    const [viewMode, setViewMode] = useState<'visual' | 'text'>('visual');
    
    const [cleanRows, setCleanRows] = useState<CleanRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAiWorking, setIsAiWorking] = useState(false);
    const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });

    const ensureLibsLoaded = async () => {
        try {
            if ((window as any).pdfjsLib) pdfjsLib = (window as any).pdfjsLib;
            else if (!pdfjsLib) {
                try {
                    const pdfModule = await import('pdfjs-dist');
                    pdfjsLib = pdfModule.default || pdfModule;
                } catch (e) {}
            }
            if (pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
            }
            if ((window as any).mammoth) mammoth = (window as any).mammoth;
            else if (!mammoth) { try { const mod = await import('mammoth'); mammoth = mod.default || mod; } catch (e) {} }
            if ((window as any).XLSX) XLSX = (window as any).XLSX;
            else if (!XLSX) { try { const mod = await import('xlsx'); XLSX = mod.default || mod; } catch (e) {} }
        } catch (e) {}
    };

    useEffect(() => { ensureLibsLoaded(); }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await processFile(selectedFile);
    };

    const triggerFileUpload = () => fileInputRef.current?.click();

    const extractInitialRows = (lines: string[]): CleanRow[] => {
        const extracted: CleanRow[] = [];
        lines.forEach((line) => {
            if (!line.trim() || line.length < 5) return;
            
            // Regra de validade: Deve ter data E deve ter valor
            const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
            const amountMatch = line.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|-?\d+(?:\.\d{2})?/g);
            
            if (dateMatch && amountMatch) { // Filtro estrito
                extracted.push({
                    id: Math.random().toString(36).substr(2, 9),
                    date: dateMatch[0],
                    description: line.replace(dateMatch[0], '').replace(amountMatch[amountMatch.length-1], '').trim().substring(0, 50),
                    amount: amountMatch[amountMatch.length - 1]
                });
            }
        });
        
        // Limitar a visualização inicial aos primeiros 30 registros válidos
        return extracted.length > 0 ? extracted.slice(0, 30) : [{ id: '1', date: '', description: '', amount: '' }];
    };

    const processFile = async (file: File) => {
        setIsProcessing(true);
        setCleanRows([]);
        if (pdfContainerRef.current) pdfContainerRef.current.innerHTML = '';
        try {
            await ensureLibsLoaded();
            const fileNameLower = file.name.toLowerCase();
            const fileBuffer = await file.arrayBuffer();
            if (fileNameLower.endsWith('.pdf')) {
                setFileType('pdf');
                const loadingTask = pdfjsLib.getDocument(new Uint8Array(fileBuffer));
                const pdf = await loadingTask.promise;
                const allTextLines: string[] = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 }); 
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.className = "mb-6 shadow-xl rounded-lg mx-auto bg-white w-full h-auto border border-slate-200";
                    pdfContainerRef.current?.appendChild(canvas);
                    await page.render({ canvasContext: context, viewport }).promise;
                    const textContent = await page.getTextContent();
                    const line = textContent.items.map((item: any) => item.str).join(' ');
                    allTextLines.push(line);
                }
                const fullText = allTextLines.join('\n');
                setFullRawText(fullText);
                setCleanRows(extractInitialRows(allTextLines));
            } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
                setFileType('excel');
                const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
                setRawExcelData(jsonData.slice(0, 100));
                const textLines = jsonData.map(row => row.join(' '));
                setFullRawText(textLines.join('\n'));
                setCleanRows(extractInitialRows(textLines));
            } else {
                setFileType('text');
                const text = new TextDecoder().decode(fileBuffer);
                setFullRawText(text);
                setCleanRows(extractInitialRows(text.split('\n')));
            }
        } catch (error: any) {
            showToast(`Erro: ${error.message}`, 'error');
        } finally { setIsProcessing(false); }
    };

    const handleAIAutoComplete = async () => {
        if (!fullRawText || isAiWorking) return;
        const exampleRow = cleanRows[0];
        if (!exampleRow.date && !exampleRow.description && !exampleRow.amount) {
            showToast("Edite a primeira linha manualmente para servir de padrão.", "error");
            return;
        }
        setIsAiWorking(true);
        setAiProgress({ current: 0, total: 0 });
        try {
            const extracted = await extractDataFromText(
                fullRawText, 
                exampleRow, 
                (current, total) => setAiProgress({ current, total })
            );
            if (Array.isArray(extracted)) {
                const newRows = extracted.map((r: any) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    date: r.date || '',
                    description: r.description || '',
                    amount: r.amount || ''
                }));
                setCleanRows([exampleRow, ...newRows]);
                showToast(`${newRows.length} registros extraídos com sucesso!`, 'success');
            }
        } catch (error: any) {
            showToast("Falha na extração paralela.", 'error');
        } finally { 
            setIsAiWorking(false); 
        }
    };

    const handleCellChange = (id: string, field: keyof CleanRow, value: string) => {
        setCleanRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const handleExportExcel = () => {
        if (cleanRows.length === 0) return;
        const baseFileName = file?.name.split('.')[0] || 'dados';
        const worksheet = XLSX.utils.json_to_sheet(cleanRows.map(r => ({ Data: r.date, Descrição: r.description, Valor: r.amount })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
        XLSX.writeFile(workbook, `${baseFileName}.xlsx`);
        showToast("Arquivo exportado!", "success");
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
            <div className="glass-modal rounded-3xl w-full max-w-[95vw] h-full sm:h-[90vh] flex flex-col overflow-hidden relative shadow-2xl border border-white/20">
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.csv,.xlsx,.xls,.docx,.txt" onChange={handleFileChange} />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 shrink-0 gap-3 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl text-white shadow-lg shrink-0">
                            <WrenchScrewdriverIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Laboratório de Arquivos</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{file ? `EDITANDO: ${file.name.toUpperCase()}` : 'Conversor de Documentos'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={triggerFileUpload} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-full transition-all text-[11px] font-bold border border-slate-200 shadow-sm">
                            <UploadIcon className="w-3.5 h-3.5" />
                            <span>Trocar Arquivo</span>
                        </button>
                        {cleanRows.length > 0 && (
                            <button 
                                onClick={handleExportExcel} 
                                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-full shadow-lg transition-all border border-emerald-500 hover:-translate-y-0.5"
                            >
                                <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                                <span>Exportar Excel</span>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 ml-2"><XMarkIcon className="w-6 h-6" /></button>
                    </div>
                </div>
                <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950">
                    <div className="w-full md:w-1/2 flex flex-col relative border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 min-w-0">
                        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2"><EyeIcon className="w-4 h-4 text-brand-blue" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">VISUALIZAÇÃO DE ORIGEM</span></div>
                            {file && (
                                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200">
                                    <button onClick={() => setViewMode('visual')} className={`px-4 py-1 text-[10px] font-bold rounded-full transition-all ${viewMode === 'visual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Gráfico</button>
                                    <button onClick={() => setViewMode('text')} className={`px-4 py-1 text-[10px] font-bold rounded-full transition-all ${viewMode === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Texto</button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
                            {!file ? (
                                <div onClick={triggerFileUpload} className="h-full flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-white transition-all border-2 border-dashed border-slate-200 rounded-3xl group">
                                    <div className="p-6 bg-slate-100 dark:bg-slate-900 rounded-full mb-4 group-hover:scale-110 transition-all shadow-sm"><UploadIcon className="w-10 h-10 text-brand-blue" /></div>
                                    <p className="text-base font-bold text-slate-600 dark:text-slate-300">Arraste ou clique para carregar o arquivo</p>
                                    <p className="text-xs text-slate-400 mt-2 font-medium">PDF, Excel, Word ou Texto</p>
                                </div>
                            ) : (
                                <div className="max-w-full overflow-x-hidden h-full">
                                    {isProcessing && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10"><div className="animate-spin h-10 w-10 text-brand-blue"></div></div>}
                                    <div className={`${viewMode === 'text' ? 'block' : 'hidden'} h-full`}><textarea className="w-full h-full p-6 bg-white dark:bg-slate-800 border border-slate-200 rounded-2xl font-mono text-[11px] resize-none focus:outline-none" value={fullRawText} readOnly /></div>
                                    <div className={`${viewMode === 'visual' ? 'block' : 'hidden'} w-full`}>
                                        <div ref={pdfContainerRef} className={`${fileType === 'pdf' ? 'block' : 'hidden'} w-full flex flex-col items-center`}></div>
                                        {fileType === 'excel' && (
                                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 overflow-x-auto">
                                                <table className="w-full text-[10px] text-left">
                                                    <tbody>{rawExcelData.map((row, i) => (<tr key={i} className="border-b border-slate-50 dark:border-slate-700">{row.map((cell, j) => <td key={j} className="p-2 whitespace-nowrap">{String(cell)}</td>)}</tr>))}</tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="w-full md:w-1/2 flex flex-col bg-white dark:bg-slate-900 relative min-w-0">
                        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 bg-white dark:bg-slate-900 z-10">
                            <div className="flex items-center gap-2"><ClipboardDocumentIcon className="w-4 h-4 text-emerald-500" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">EDITOR DE DADOS</span></div>
                            <div className="flex gap-2">
                                <button onClick={handleAIAutoComplete} disabled={!fullRawText || isAiWorking} className="text-[10px] flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-full font-bold shadow-lg transition-all disabled:opacity-50 uppercase">
                                    <SparklesIcon className="w-3.5 h-3.5" />{isAiWorking ? `PROCESSANDO (${aiProgress.current}/${aiProgress.total})...` : 'APLICAR PADRÃO DA IA'}
                                </button>
                                <button onClick={() => setCleanRows([{ id: Math.random().toString(), date: '', description: '', amount: '' }, ...cleanRows])} className="text-[10px] flex items-center gap-1.5 text-slate-500 font-bold px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors border border-slate-200 uppercase"><PlusCircleIcon className="w-3.5 h-3.5" />ADICIONAR</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar relative">
                            {cleanRows.length > 0 && !isAiWorking && <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 text-[10px] font-medium text-amber-800 dark:text-amber-200 flex items-start gap-2"><SparklesIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" /><p>Edite a <b>primeira linha</b> com data e valor corretos. A IA usará isso como padrão e descartará qualquer linha incompleta do arquivo.</p></div>}
                            {isAiWorking && (
                                <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                                    <div className="p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col items-center border border-indigo-100 max-w-sm text-center">
                                        <div className="relative mb-4">
                                            <SparklesIcon className="w-12 h-12 text-indigo-600 animate-pulse" />
                                        </div>
                                        <p className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">IA FILTRANDO REGISTROS</p>
                                        <p className="text-xs text-slate-500 mt-2 font-medium">Extraindo apenas transações válidas que contenham data e valor conforme seu exemplo.</p>
                                        {aiProgress.total > 0 && (
                                            <div className="w-full mt-6">
                                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-600 transition-all duration-500 rounded-full" style={{ width: `${(aiProgress.current / aiProgress.total) * 100}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <table className="w-full text-[11px] text-left border-collapse">
                                <thead className="bg-white dark:bg-slate-900 text-[9px] uppercase font-black text-slate-400 sticky top-0 z-10 border-b border-slate-100"><tr><th className="p-4 w-[120px]">DATA</th><th className="p-4">DESCRIÇÃO LIMPA (NOME)</th><th className="p-4 w-[110px] text-right">VALOR</th><th className="p-4 w-12"></th></tr></thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                    {cleanRows.map((row, index) => {
                                        const isNegative = row.amount.trim().startsWith('-');
                                        return (
                                            <tr key={row.id} className={`group ${index === 0 ? 'bg-indigo-50/30' : ''}`}>
                                                <td className="p-2 px-4"><input type="text" value={row.date} onChange={(e) => handleCellChange(row.id, 'date', e.target.value)} className={`w-full p-2 rounded-xl border border-transparent focus:border-brand-blue outline-none font-mono text-[10px] ${index === 0 ? 'bg-white ring-1 ring-indigo-200' : 'bg-slate-50'}`} placeholder="DD/MM/AAAA" /></td>
                                                <td className="p-2 px-4"><input type="text" value={row.description} onChange={(e) => handleCellChange(row.id, 'description', e.target.value)} className={`w-full p-2 rounded-xl border border-transparent focus:border-brand-blue outline-none font-bold text-[11px] ${index === 0 ? 'bg-white ring-1 ring-indigo-200' : 'bg-slate-50'}`} placeholder="Ex: JOAO DA SILVA" /></td>
                                                <td className="p-2 px-4">
                                                    <input 
                                                        type="text" 
                                                        value={row.amount} 
                                                        onChange={(e) => handleCellChange(row.id, 'amount', e.target.value)} 
                                                        className={`w-full p-2 rounded-xl border border-transparent focus:border-brand-blue outline-none text-right font-mono text-[10px] ${index === 0 ? 'bg-white ring-1 ring-indigo-200' : 'bg-slate-50'} ${isNegative ? 'text-red-600 dark:text-red-400 font-bold' : ''}`} 
                                                        placeholder="0,00" 
                                                    />
                                                </td>
                                                <td className="p-2 pr-4 text-center"><button onClick={() => setCleanRows(cleanRows.filter(r => r.id !== row.id))} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><TrashIcon className="w-4 h-4" /></button></td>
                                            </tr>
                                        );
                                    })}
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