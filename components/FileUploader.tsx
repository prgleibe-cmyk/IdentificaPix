
import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { UploadIcon } from './Icons';
import { useUI } from '../contexts/UIContext';
import { resolveBankKey } from '../utils/bankHelper';
import { PDFAdapter } from '../core/adapters/PDFAdapter';

let XLSX: any = null;

export interface FileUploaderHandle {
    open: () => void;
}

interface FileUploaderProps {
  title: string;
  onFileUpload: (content: string, fileName: string, rawFile: File, base64?: string) => void | Promise<void>;
  id: string;
  isUploaded: boolean;
  uploadedFileName: string | null;
  disabled?: boolean;
  onDelete?: () => void;
  customTrigger?: (props: { onClick: (e: React.MouseEvent) => void, disabled: boolean, isParsing: boolean }) => React.ReactNode;
  onParsingStatusChange?: (isParsing: boolean) => void;
  useLocalLoadingOnly?: boolean; 
  bank?: any;
}

const SUPPORTED_FORMATS = ".pdf,.xlsx,.xls,.csv,.txt,.ofx";

export const FileUploader = forwardRef<FileUploaderHandle, FileUploaderProps>(({ 
    title, 
    onFileUpload, 
    id, 
    isUploaded, 
    uploadedFileName, 
    disabled = false, 
    onDelete, 
    customTrigger,
    onParsingStatusChange,
    useLocalLoadingOnly = false,
    bank
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const { setIsLoading, setParsingProgress } = useUI() as any;

  const isBusyRef = useRef(false);

  useImperativeHandle(ref, () => ({
      open: () => {
          if (!disabled && !isParsing && !isBusyRef.current) {
              fileInputRef.current?.click();
          }
      }
  }));

  const ensureLibsLoaded = async () => {
    try {
        if (!XLSX) { try { const mod = await import('xlsx'); XLSX = mod.default || mod; } catch (e) {} }
    } catch (e) {}
  };

  const ensurePdfjsLoaded = async () => {
    const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    if (!(window as any).pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = PDFJS_URL;
            script.onload = () => resolve();
            script.onerror = (err) => reject(new Error('Failed to load PDF.js script'));
            document.head.appendChild(script);
        });
    }

    const pdfjsLib = (window as any).pdfjsLib;
    if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
    }
  };

  useEffect(() => { ensureLibsLoaded(); }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isBusyRef.current) return;
    
    const isSicoob = bank && resolveBankKey(bank) === 'SICOOB';
    if (isSicoob) {
      const fileNameLower = file.name.toLowerCase();
      if (!fileNameLower.endsWith('.pdf')) {
         alert("O banco Sicoob aceita exclusivamente arquivos PDF.");
         if (fileInputRef.current) fileInputRef.current.value = '';
         return;
      }
    }

    const isSicredi = bank && resolveBankKey(bank) === 'SICREDI';
    if (isSicredi) {
      const fileNameLower = file.name.toLowerCase();
      if (!fileNameLower.endsWith('.ofx')) {
         alert("O banco Sicredi aceita exclusivamente arquivos OFX.");
         if (fileInputRef.current) fileInputRef.current.value = '';
         return;
      }
    }
    
    await processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (file: File) => {
    if (isBusyRef.current) return;
    
    isBusyRef.current = true;
    setIsParsing(true);
    
    try {
        await ensureLibsLoaded();
        const fileNameLower = file.name.toLowerCase();
        const fileBuffer = await file.arrayBuffer();
        
        // 🚀 CAPTURA BINÁRIA PARA IA (SEM OCR LOCAL)
        const base64 = btoa(new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        let extractedText = '';

        if (fileNameLower.endsWith('.pdf')) {
             console.log(`[PDF:PHASE:1:READING] START -> ${file.name} (${file.size} bytes)`);
             console.log(`[PDF:PHASE:1:READING] Extracting text locally using PDFAdapter.`);
             try {
                 await ensurePdfjsLoaded();
                 const adapter = new PDFAdapter();
                 const rawDoc = await adapter.readRaw(file);
                 extractedText = rawDoc.content.join('\n');
                 console.log(`[PDF:PHASE:1:READING] PDF text extracted successfully (${extractedText.length} chars)`);
             } catch (adapterError: any) {
                 console.error("[PDFAdapter] Error extracting PDF text:", adapterError);
                 throw new Error("Não foi possível ler as linhas do PDF localmente de forma determinística.");
             }
             console.log(`[PDF:PHASE:2:RAW_TEXT] PDF_TEXT -> (length: ${extractedText.length})`);
        } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
            if (!XLSX) throw new Error("Excel lib missing");
            const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
            extractedText = jsonData
                .map(row => row.map(cell => cell === null || cell === undefined ? '' : String(cell).trim()).join(';'))
                .filter(line => line.replace(/;/g, '').trim().length > 0)
                .join('\n');
        } else {
            extractedText = new TextDecoder('utf-8').decode(fileBuffer);
        }

        await onFileUpload(extractedText, file.name, file, base64);

    } catch (error: any) {
        console.error("[Uploader] Fail:", error);
        alert(`Erro ao carregar arquivo: ${error.message}`);
    } finally {
        isBusyRef.current = false;
        setIsParsing(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled && !isParsing && !isBusyRef.current) fileInputRef.current?.click();
  };

  const isSicoob = bank && resolveBankKey(bank) === 'SICOOB';
  const isSicredi = bank && resolveBankKey(bank) === 'SICREDI';
  const acceptFilter = isSicoob 
    ? ".pdf,application/pdf" 
    : isSicredi 
      ? ".ofx" 
      : SUPPORTED_FORMATS;

  if (customTrigger) {
      return (
          <div className="flex-shrink-0">
              <input type="file" id={id} ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={disabled || isParsing} accept={acceptFilter} />
              {customTrigger({ onClick: handleClick, disabled: disabled || isParsing, isParsing })}
          </div>
      );
  }

  return (
    <div className="flex-shrink-0">
      <input type="file" id={id} ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={disabled || isParsing} accept={acceptFilter} />
      <button type="button" onClick={handleClick} disabled={disabled || isParsing} className={`group inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${disabled ? 'bg-slate-100 text-slate-400' : 'text-white bg-emerald-600 hover:bg-emerald-50 shadow-sm'}`}>
         {isParsing ? <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-2"></div> : <UploadIcon className="w-3 h-3" />}
         <span>{isParsing ? 'Carregando...' : title}</span>
      </button>
    </div>
  );
});
