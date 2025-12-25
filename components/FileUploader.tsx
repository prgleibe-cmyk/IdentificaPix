
import React, { useRef, useState, useEffect } from 'react';
import { UploadIcon, CheckCircleIcon, XMarkIcon } from './Icons';
import { Logger, Metrics } from '../services/monitoringService';

let pdfjsLib: any = null;
let mammoth: any = null;
let XLSX: any = null;

interface FileUploaderProps {
  title: string;
  onFileUpload: (content: string, fileName: string, rawFile: File) => void;
  id: string;
  isUploaded: boolean;
  uploadedFileName: string | null;
  disabled?: boolean;
  onDelete?: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ title, onFileUpload, id, isUploaded, uploadedFileName, disabled = false, onDelete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);

  const ensureLibsLoaded = async () => {
    try {
        if (!pdfjsLib) {
            try {
                const pdfModule = await import('pdfjs-dist');
                const lib = pdfModule.default || pdfModule;
                if (!lib.GlobalWorkerOptions.workerSrc) {
                    const version = lib.version || '3.11.174';
                    lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
                }
                pdfjsLib = lib;
            } catch (e) {}
        }
        if (!mammoth) { try { const mod = await import('mammoth'); mammoth = mod.default || mod; } catch (e) {} }
        if (!XLSX) { try { const mod = await import('xlsx'); XLSX = mod.default || mod; } catch (e) {} }
    } catch (e) {}
  };

  useEffect(() => { ensureLibsLoaded(); }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    try {
        await ensureLibsLoaded();
        const fileNameLower = file.name.toLowerCase();
        const fileBuffer = await file.arrayBuffer();
        let csvContent = '';

        if (fileNameLower.endsWith('.pdf')) {
             if (!pdfjsLib) throw new Error("PDF lib missing");
             const loadingTask = pdfjsLib.getDocument(new Uint8Array(fileBuffer));
             const pdf = await loadingTask.promise;
             let fullText = '';
             let firstPageTitles: string[] = []; 
             
             for (let i = 1; i <= pdf.numPages; i++) {
                 const page = await pdf.getPage(i);
                 const textContent = await page.getTextContent();
                 const items = textContent.items as any[];
                 
                 const lineTolerance = 2; 
                 const lineGroups: Map<number, any[]> = new Map();
                 
                 items.forEach(item => {
                     if (!item.str || item.str.trim() === '') return;
                     const y = Math.round(item.transform[5] / lineTolerance) * lineTolerance;
                     if (!lineGroups.has(y)) lineGroups.set(y, []);
                     lineGroups.get(y)!.push(item);
                 });

                 const sortedY = Array.from(lineGroups.keys()).sort((a, b) => b - a);
                 let pageLines: string[] = [];
                 
                 sortedY.forEach(y => {
                     const lineItems = lineGroups.get(y)!;
                     lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
                     
                     let lineStr = '';
                     let lastX = -1;
                     let lastWidth = 0;
                     
                     lineItems.forEach(item => {
                         const x = item.transform[4];
                         if (lastX !== -1) {
                             const gap = x - (lastX + lastWidth);
                             if (gap > 3) lineStr += '\t';
                             else if (gap > 1.2) lineStr += ' ';
                         }
                         lineStr += item.str;
                         lastX = x;
                         lastWidth = item.width || 0;
                     });

                     const cleanLine = lineStr.trim();
                     if (cleanLine === '') return;

                     // Filtros de metadados de página
                     const isPageIndicator = /p[áa]gina\s*\d+/i.test(cleanLine);
                     const isEmitDate = /emitido\s*em\s*|data\s*de\s*emiss[ãa]o/i.test(cleanLine);
                     const isBankBalanceLine = /saldo\s*anterior|saldo\s*atual|total\s*de\s*d[ée]bitos/i.test(cleanLine);
                     
                     if (!isPageIndicator && !isEmitDate) {
                         // Nas páginas subsequentes, ignorar o topo se for idêntico ao topo da página 1 (títulos de colunas)
                         if (i === 1 && pageLines.length < 4) {
                             firstPageTitles.push(cleanLine.toLowerCase());
                         } else if (i > 1 && pageLines.length < 4 && firstPageTitles.includes(cleanLine.toLowerCase())) {
                             return; 
                         }
                         pageLines.push(lineStr);
                     }
                 });
                 fullText += pageLines.join('\n') + '\n';
             }
             csvContent = fullText;
        } else if (fileNameLower.endsWith('.docx')) {
            if (!mammoth) throw new Error("Word lib missing");
            const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
            csvContent = result.value;
        } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
            if (!XLSX) throw new Error("Excel lib missing");
            const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            csvContent = XLSX.utils.sheet_to_csv(worksheet);
        } else {
            csvContent = new TextDecoder('utf-8').decode(fileBuffer);
        }

        if (!csvContent.trim()) throw new Error("Arquivo vazio");
        onFileUpload(csvContent, file.name, file);
    } catch (error: any) {
        alert(`Erro: ${error.message}`);
    } finally {
        setIsParsing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isParsing) fileInputRef.current?.click();
  };

  if (isUploaded) {
    return (
      <div className="flex-shrink-0 flex items-center justify-between space-x-2 bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full shadow-sm animate-fade-in w-full sm:w-auto transition-all">
        <div className="flex items-center space-x-1.5 min-w-0">
            <CheckCircleIcon className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
            <span className="text-[10px] font-bold truncate max-w-[100px]">{uploadedFileName}</span>
        </div>
        {onDelete && (
            <button type="button" onClick={onDelete} className="p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-600 dark:text-emerald-400 transition-colors">
                <XMarkIcon className="w-3 h-3" />
            </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-shrink-0">
      <input type="file" id={id} ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={disabled || isParsing} accept=".csv,.txt,.xlsx,.xls,.pdf,.docx" />
      <button type="button" onClick={handleClick} disabled={disabled || isParsing} className={`group inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-300 relative overflow-hidden ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' : 'text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-sm hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]'}`}>
         {isParsing ? <><svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="tracking-wide">Lendo...</span></> : <><UploadIcon className="w-3 h-3 opacity-90" /><span className="tracking-wide relative z-10">{title}</span></>}
      </button>
    </div>
  );
};
