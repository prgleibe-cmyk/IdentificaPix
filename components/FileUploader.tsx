
import React, { useRef, useState } from 'react';
import { UploadIcon, CheckCircleIcon, XMarkIcon } from './Icons';
import { Logger, Metrics } from '../services/monitoringService';

declare const pdfjsLib: any;
declare const mammoth: any;
declare const XLSX: any;


interface FileUploaderProps {
  title: string;
  onFileUpload: (content: string, fileName: string) => void;
  id: string;
  isUploaded: boolean;
  uploadedFileName: string | null;
  disabled?: boolean;
  onDelete?: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ title, onFileUpload, id, isUploaded, uploadedFileName, disabled = false, onDelete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (event.target) event.target.value = '';
      return;
    }
    processFile(file);
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    try {
        const fileNameLower = file.name.toLowerCase();
        const fileBuffer = await file.arrayBuffer();
        let csvContent = '';

        if (fileNameLower.endsWith('.pdf')) {
            if (typeof pdfjsLib === 'undefined') {
                throw new Error("Biblioteca PDF não inicializada. Verifique sua conexão com a internet.");
            }
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
            const typedarray = new Uint8Array(fileBuffer);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const lines = new Map();
                textContent.items.forEach((item: any) => {
                    const y = Math.round(item.transform[5]);
                    const x = Math.round(item.transform[4]);
                    if (!lines.has(y)) lines.set(y, []);
                    lines.get(y).push({ x: x, str: item.str, width: item.width });
                });
                const sortedY = Array.from(lines.keys()).sort((a, b) => b - a);
                sortedY.forEach(y => {
                    const lineItems = lines.get(y);
                    lineItems.sort((a: any, b: any) => a.x - b.x);
                    if (lineItems.length > 0) {
                        let lineText = lineItems[0].str;
                        for (let j = 1; j < lineItems.length; j++) {
                            const prevItem = lineItems[j - 1];
                            const currentItem = lineItems[j];
                            const gap = currentItem.x - (prevItem.x + prevItem.width);
                            // Increased gap threshold from 5 to 8 for banking PDFs which often have wide columns
                            if (gap > 8) lineText += ',';
                            else if (gap > 0) lineText += ' ';
                            lineText += currentItem.str;
                        }
                        const cleanedLine = lineText.trim().replace(/\s*,\s*/g, ',');
                        if (cleanedLine) csvContent += cleanedLine + '\n';
                    }
                });
            }
        } else if (fileNameLower.endsWith('.docx')) {
            if (typeof mammoth === 'undefined') {
                throw new Error("Biblioteca Word não inicializada.");
            }
            const result = await mammoth.convertToHtml({ arrayBuffer: fileBuffer });
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = result.value;
            const tables = tempDiv.querySelectorAll('table');
            if (tables.length > 0) {
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = Array.from(row.querySelectorAll('th, td'));
                        if (cells.every(cell => (cell.textContent || '').trim() === '')) return;
                        const rowText = cells.map(cell => '"' + (cell.textContent || '').replace(/"/g, '""').trim() + '"').join(',');
                        csvContent += rowText + '\n';
                    });
                });
            } else {
                const textResult = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
                csvContent = textResult.value.replace(/\r\n?/g, '\n');
            }
        } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
            if (typeof XLSX === 'undefined') {
                throw new Error("Biblioteca Excel não inicializada.");
            }
            const data = new Uint8Array(fileBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const rangeRef = worksheet['!ref'];
            if (rangeRef) {
                const range = XLSX.utils.decode_range(rangeRef);
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const row: string[] = [];
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                        const cell = worksheet[cellAddress];
                        
                        let cellText = '';
                        if (cell) {
                            const isNumber = cell.t === 'n';
                            const looksLikeDate = cell.w && /[\/\-:]/.test(cell.w);

                            if (isNumber && !looksLikeDate && cell.v !== undefined) {
                                try {
                                    const val = Number(cell.v);
                                    cellText = val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                } catch (e) {
                                    cellText = cell.w || String(cell.v);
                                }
                            } 
                            else if (cell.w !== undefined) {
                                cellText = cell.w;
                            } 
                            else if (cell.v !== undefined) {
                                cellText = String(cell.v);
                            }
                        }

                        const cleanedCellStr = cellText.replace(/"/g, '""');
                        if (/[;\n"]/.test(cellText)) {
                            row.push(`"${cleanedCellStr}"`);
                        } else {
                            row.push(cellText);
                        }
                    }
                    csvContent += row.join(';') + '\n';
                }
            }

        } else {
            csvContent = new TextDecoder().decode(fileBuffer);
        }

        onFileUpload(csvContent, file.name);
        Metrics.increment('filesParsed');
    } catch (error: any) {
        Logger.error("Error parsing file", error, { fileName: file.name });
        Metrics.increment('parsingErrors');
        // If onFileUpload handles errors by showing toast, this is fine. 
        // We could also call a prop onError here if needed.
        alert(`Erro ao processar arquivo: ${error.message}`);
    } finally {
        setIsParsing(false);
    }
  };

  const handleClick = () => {
    if (!disabled && !isParsing) {
      fileInputRef.current?.click();
    }
  };

  if (isUploaded) {
    return (
      <div className="flex-shrink-0 flex items-center justify-between space-x-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 rounded-2xl px-5 py-3 w-full sm:w-auto shadow-sm animate-fade-in">
        <div className="flex items-center space-x-3 min-w-0">
            <div className="bg-emerald-100 dark:bg-emerald-900 rounded-full p-1.5 shadow-sm">
                <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
            </div>
            <span className="truncate max-w-[150px] font-semibold tracking-tight" title={uploadedFileName || ''}>{uploadedFileName}</span>
        </div>
        {onDelete && (
            <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors focus:outline-none"
                aria-label="Remover arquivo"
            >
                <XMarkIcon className="w-4 h-4" />
            </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isParsing}
      className={`flex-shrink-0 group inline-flex items-center justify-center space-x-2.5 px-6 py-3 text-sm font-bold rounded-2xl shadow-sm transition-all duration-300 border
        ${disabled 
            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-600' 
            : 'text-white bg-gradient-to-r from-indigo-600 to-blue-600 border-transparent hover:shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5'
        }
      `}
    >
      <input
        type="file"
        id={id}
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isParsing}
        accept=".csv, .txt, .xlsx, .xls, .pdf, .docx"
      />
       {isParsing ? (
         <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Processando...</span>
        </>
       ) : (
        <>
            <UploadIcon className="w-5 h-5 opacity-90 group-hover:scale-110 transition-transform" />
            <span>{title}</span>
        </>
       )}
    </button>
  );
};
