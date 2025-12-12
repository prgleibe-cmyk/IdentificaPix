import React, { useRef, useState, useEffect } from 'react';
import { UploadIcon, CheckCircleIcon, XMarkIcon } from './Icons';
import { Logger, Metrics } from '../services/monitoringService';

// Importações dinâmicas
let pdfjsLib: any = null;
let mammoth: any = null;
let XLSX: any = null;

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

  // Carregamento Lazy das bibliotecas com verificação robusta
  const ensureLibsLoaded = async () => {
    try {
        if (!pdfjsLib) {
            try {
                // Tenta importar a lib instalada
                const pdfModule = await import('pdfjs-dist');
                const lib = pdfModule.default || pdfModule;
                
                // Configura o worker. 
                // Tenta usar o arquivo local node_modules se disponível no build, ou fallback CDN
                if (!lib.GlobalWorkerOptions.workerSrc) {
                    const version = lib.version || '3.11.174';
                    
                    // Correção: Se a versão for 5.x (carregada via esm.sh), usa o worker do esm.sh
                    if (String(version).startsWith('5.')) {
                        lib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
                    } else {
                        // Fallback para versões anteriores (ex: 3.11.174 do index.html)
                        lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
                    }
                }
                pdfjsLib = lib;
            } catch (e) {
                console.warn("Falha ao carregar PDF.js via import, tentando fallback", e);
            }
        }

        if (!mammoth) {
            try {
                const mod = await import('mammoth');
                mammoth = mod.default || mod;
            } catch (e) {
                console.warn("Falha ao carregar Mammoth", e);
            }
        }

        if (!XLSX) {
            try {
                const mod = await import('xlsx');
                XLSX = mod.default || mod;
            } catch (e) {
                console.warn("Falha ao carregar XLSX", e);
            }
        }
    } catch (e) {
        console.error("Erro crítico ao carregar bibliotecas de arquivo", e);
    }
  };

  useEffect(() => {
    ensureLibsLoaded();
  }, []);

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
        await ensureLibsLoaded();

        const fileNameLower = file.name.toLowerCase();
        const fileBuffer = await file.arrayBuffer();
        let csvContent = '';

        if (fileNameLower.endsWith('.pdf')) {
            if (!pdfjsLib) {
                 throw new Error("Biblioteca PDF não carregada. Por favor, recarregue a página e tente novamente.");
            }
            
            const typedarray = new Uint8Array(fileBuffer);
            const loadingTask = pdfjsLib.getDocument(typedarray);
            const pdf = await loadingTask.promise;
            
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                const lines: { y: number; text: string }[] = [];
                
                textContent.items.forEach((item: any) => {
                    const y = Math.round(item.transform[5]);
                    const text = item.str;
                    
                    const existingLine = lines.find(l => Math.abs(l.y - y) < 5);
                    if (existingLine) {
                        existingLine.text += ' ' + text;
                    } else {
                        lines.push({ y, text });
                    }
                });

                lines.sort((a, b) => b.y - a.y);
                const pageText = lines.map(l => l.text).join('\n');
                fullText += pageText + '\n';
            }
            csvContent = fullText;

        } else if (fileNameLower.endsWith('.docx')) {
            if (!mammoth) throw new Error("Biblioteca Word não carregada.");
            const textResult = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
            csvContent = textResult.value.replace(/\r\n?/g, '\n');

        } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
            if (!XLSX) throw new Error("Biblioteca Excel não carregada.");
            const data = new Uint8Array(fileBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            csvContent = XLSX.utils.sheet_to_csv(worksheet);

        } else {
            csvContent = new TextDecoder('utf-8').decode(fileBuffer);
        }

        if (!csvContent.trim()) {
            throw new Error("O arquivo parece estar vazio ou ilegível.");
        }

        onFileUpload(csvContent, file.name);
        Metrics.increment('filesParsed');
    } catch (error: any) {
        Logger.error("Error parsing file", error, { fileName: file.name });
        Metrics.increment('parsingErrors');
        alert(`Erro ao processar arquivo: ${error.message || 'Formato desconhecido'}`);
    } finally {
        setIsParsing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled && !isParsing) {
      fileInputRef.current?.click();
    }
  };

  if (isUploaded) {
    return (
      <div className="flex-shrink-0 flex items-center justify-between space-x-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 rounded-xl px-3 py-2 w-full sm:w-auto shadow-sm animate-fade-in">
        <div className="flex items-center space-x-2 min-w-0">
            <div className="bg-emerald-100 dark:bg-emerald-900 rounded-full p-1 shadow-sm">
                <CheckCircleIcon className="w-3 h-3 flex-shrink-0" />
            </div>
            <span className="truncate max-w-[120px] font-bold tracking-tight" title={uploadedFileName || ''}>{uploadedFileName}</span>
        </div>
        {onDelete && (
            <button
                type="button"
                onClick={onDelete}
                className="p-1 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors focus:outline-none"
                aria-label="Remover arquivo"
            >
                <XMarkIcon className="w-3 h-3" />
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
      className={`flex-shrink-0 group inline-flex items-center justify-center space-x-2 px-5 py-2.5 text-xs font-bold rounded-xl shadow-sm transition-all duration-300 border uppercase tracking-wide
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
        accept=".csv,.txt,.xlsx,.xls,.pdf,.docx"
      />
       {isParsing ? (
         <>
            <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Lendo...</span>
        </>
       ) : (
        <>
            <UploadIcon className="w-4 h-4 opacity-90 group-hover:scale-110 transition-transform" />
            <span>{title}</span>
        </>
       )}
    </button>
  );
};