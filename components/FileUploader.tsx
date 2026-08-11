
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

    const fileNameLower = file.name.toLowerCase();
    if (!fileNameLower.endsWith('.ofx')) {
       alert("O sistema aceita exclusivamente arquivos no formato OFX (.ofx). Por gentileza, selecione um arquivo de extrato .ofx.");
       if (fileInputRef.current) fileInputRef.current.value = '';
       return;
    }
    
    await processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (file: File) => {
    if (isBusyRef.current) return;
    
    isBusyRef.current = true;
    setIsParsing(true);
    
    try {
        const fileNameLower = file.name.toLowerCase();
        if (!fileNameLower.endsWith('.ofx')) {
            throw new Error("O sistema aceita exclusivamente arquivos no formato OFX (.ofx).");
        }
        const fileBuffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        const extractedText = new TextDecoder('utf-8').decode(fileBuffer);

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

  const acceptFilter = ".ofx";

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
