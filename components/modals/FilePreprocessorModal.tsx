
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
                const pdfModule = await import('pdfjs-dist');
                pdfjsLib = pdfModule.default || pdfModule;
            }
            if (pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
            }
            if (!mammoth) { const mod = await import('mammoth'); mammoth = mod.default || mod; }
            if (!XLSX) { const mod = await import('xlsx'); XLSX = mod.default || mod; }
        } catch (e) {}
    };

    useEffect(() => { ensureLibsLoaded(); }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        await processFile(selectedFile);
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
                    const viewport = page.getViewport({ scale: 1.5 }); 
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.className = "mb-4 rounded-lg shadow-sm w-full h-auto bg-white";
                    pdfContainerRef.current?.appendChild(canvas);
                    await page.render({ canvasContext: context, viewport }).promise;
                    const textContent = await page.getTextContent();
                    allTextLines.push(textContent.items.map((item: any) => item.str).join(' '));
                }
                setFullRawText(allTextLines.join('\n'));
            } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
                setFileType('excel');
                const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as string[][];
                setRawExcelData(jsonData.slice(0, 50));
                setFullRawText(jsonData.map(row => row.join(' ')).join('\n'));
            } else {
                setFileType('text');
                setFullRawText(new TextDecoder().decode(fileBuffer));
            }
        } catch (error: any) {
            showToast(`Erro: ${error.message}`, 'error');
        } finally { setIsProcessing(false); }
    };

    const handleAIAutoComplete = async () => {
        if (!fullRawText || isAiWorking) return;
        const exampleRow = cleanRows[0];
        if (!exampleRow || (!exampleRow.date && !exampleRow.amount)) {
            showToast("Edite a primeira linha como padrão.", "error");
            return;
        }
        setIsAiWorking(true);
        try {
            const extracted = await extractDataFromText(fullRawText, exampleRow, (c, t) => setAiProgress({ current: c, total: t }));
            setCleanRows([exampleRow, ...extracted.map(r => ({ id: Math.random().toString(36).substr(2,9), date: r.date, description: r.description, amount: r.amount }))]);
        } catch (e) { showToast("Falha na IA.", "error"); }
        finally { setIsAiWorking(false); }
    };

    const handleExportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(cleanRows.map(r => ({ Data: r.date, Descrição: r.description, Valor: r.amount })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
        XLSX.writeFile(workbook, `Limpo_${file?.name || 'arquivo'}.xlsx`);
    };

    return createPortal(
        <div className="glass-overlay">
            <div className="glass-modal w-full max-w-[1400px] animate-scale-in">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                
                {/* Header */}
                <div className="px-6 py-4 glass-header flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shrink-0"><WrenchScrewdriverIcon className="w-5 h-5" /></div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight leading-none">Laboratório de Arquivos</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 truncate">{file ? file.name : 'Selecione um arquivo'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[11px] font-bold rounded-full hover:bg-slate-200 transition-all uppercase">Carregar Novo</button>
                        {cleanRows.length > 0 && <button onClick={handleExportExcel} className="px-6 py-2 bg-emerald-600 text-white text-[11px] font-bold rounded-full shadow-lg transition-all uppercase">Exportar</button>}
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 ml-2"><XMarkIcon className="w-6 h-6" /></button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                    {/* View Origem */}
                    <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VISUALIZAÇÃO DE ORIGEM</span>
                            <div className="flex bg-white dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700">
                                <button onClick={() => setViewMode('visual')} className={`px-4 py-1 text-[9px] font-bold rounded-full ${viewMode === 'visual' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>GRÁFICO</button>
                                <button onClick={() => setViewMode('text')} className={`px-4 py-1 text-[9px] font-bold rounded-full ${viewMode === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>TEXTO</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-100/30 dark:bg-black/20">
                            {file ? (
                                <div className="max-w-full">
                                    <div className={`${viewMode === 'text' ? 'block' : 'hidden'}`}>
                                        <textarea className="w-full min-h-[500px] p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] focus:outline-none" value={fullRawText} readOnly />
                                    </div>
                                    <div className={`${viewMode === 'visual' ? 'block' : 'hidden'}`}>
                                        <div ref={pdfContainerRef} className={`${fileType === 'pdf' ? 'block' : 'hidden'} w-full`}></div>
                                        {fileType === 'excel' && (
                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 rounded-xl overflow-hidden">
                                                <table className="w-full text-[10px] text-left border-collapse">
                                                    <tbody>{rawExcelData.map((row, i) => (<tr key={i} className="border-b border-slate-50 dark:border-slate-800">{row.map((c, j) => <td key={j} className="p-2 whitespace-nowrap">{String(c)}</td>)}</tr>))}</tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50"><UploadIcon className="w-12 h-12 mb-2" /><p className="text-sm font-bold uppercase">Aguardando Arquivo</p></div>
                            )}
                        </div>
                    </div>

                    {/* Editor de Dados */}
                    <div className="w-full md:w-1/2 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
                        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10 shrink-0">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EDITOR DE DADOS</span>
                            <div className="flex gap-2">
                                <button onClick={handleAIAutoComplete} disabled={!fullRawText || isAiWorking} className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase shadow-md disabled:opacity-50">
                                    <SparklesIcon className="w-3 h-3" /> {isAiWorking ? 'Lendo...' : 'IA Sugerir'}
                                </button>
                                <button onClick={() => setCleanRows([{ id: Math.random().toString(), date: '', description: '', amount: '' }, ...cleanRows])} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"><PlusCircleIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar relative">
                            {isAiWorking && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm"><div className="text-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div><p className="text-sm font-black text-slate-800 dark:text-white uppercase">IA Extraindo Dados...</p></div></div>}
                            <table className="w-full text-left border-collapse min-w-[500px]">
                                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                                    <tr><th className="p-3 w-32">Data</th><th className="p-3">Descrição</th><th className="p-3 w-32 text-right">Valor</th><th className="w-10"></th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {cleanRows.map((row, idx) => (
                                        <tr key={row.id} className={`${idx === 0 ? 'bg-indigo-50/20' : ''}`}>
                                            <td className="p-2"><input type="text" value={row.date} onChange={e => setCleanRows(cleanRows.map(r => r.id === row.id ? {...r, date: e.target.value} : r))} className="w-full p-2 text-[11px] font-mono font-bold bg-transparent focus:bg-white dark:focus:bg-slate-800 border-transparent focus:border-indigo-500 rounded-lg outline-none transition-all" placeholder="DD/MM/AAAA" /></td>
                                            <td className="p-2"><input type="text" value={row.description} onChange={e => setCleanRows(cleanRows.map(r => r.id === row.id ? {...r, description: e.target.value} : r))} className="w-full p-2 text-[11px] font-bold bg-transparent focus:bg-white dark:focus:bg-slate-800 border-transparent focus:border-indigo-500 rounded-lg outline-none transition-all" placeholder="Ex: JOÃO DA SILVA" /></td>
                                            <td className="p-2"><input type="text" value={row.amount} onChange={e => setCleanRows(cleanRows.map(r => r.id === row.id ? {...r, amount: e.target.value} : r))} className="w-full p-2 text-[11px] font-mono font-black text-right bg-transparent focus:bg-white dark:focus:bg-slate-800 border-transparent focus:border-indigo-500 rounded-lg outline-none transition-all" placeholder="0,00" /></td>
                                            <td className="p-2"><button onClick={() => setCleanRows(cleanRows.filter(r => r.id !== row.id))} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4" /></button></td>
                                        </tr>
                                    ))}
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
