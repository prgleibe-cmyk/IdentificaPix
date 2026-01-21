
import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { UploadIcon, CheckCircleIcon, XMarkIcon } from './Icons';
import { useUI } from '../contexts/UIContext';

let pdfjsLib: any = null;
let XLSX: any = null;

export interface FileUploaderHandle {
    open: () => void;
}

interface FileUploaderProps {
  title: string;
  onFileUpload: (content: string, fileName: string, rawFile: File) => void | Promise<void>;
  id: string;
  isUploaded: boolean;
  uploadedFileName: string | null;
  disabled?: boolean;
  onDelete?: () => void;
  customTrigger?: (props: { onClick: (e: React.MouseEvent) => void, disabled: boolean, isParsing: boolean }) => React.ReactNode;
  onParsingStatusChange?: (isParsing: boolean) => void;
  useLocalLoadingOnly?: boolean; 
}

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
    useLocalLoadingOnly = false
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const { setIsLoading, setParsingProgress } = useUI() as any;

  useImperativeHandle(ref, () => ({
      open: () => {
          if (!disabled && !isParsing) {
              fileInputRef.current?.click();
          }
      }
  }));

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
        if (!XLSX) { try { const mod = await import('xlsx'); XLSX = mod.default || mod; } catch (e) {} }
    } catch (e) {}
  };

  useEffect(() => { ensureLibsLoaded(); }, []);

  useEffect(() => {
      if (onParsingStatusChange) {
          onParsingStatusChange(isParsing);
      }
      if (!useLocalLoadingOnly) {
          setIsLoading(isParsing);
      }
  }, [isParsing, onParsingStatusChange, setIsLoading, useLocalLoadingOnly]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    if (setParsingProgress) setParsingProgress({ current: 0, total: 0, label: 'Iniciando...' });
    
    try {
        await ensureLibsLoaded();
        const fileNameLower = file.name.toLowerCase();
        const fileBuffer = await file.arrayBuffer();
        let extractedText = '';

        if (fileNameLower.endsWith('.pdf')) {
             if (!pdfjsLib) throw new Error("Biblioteca PDF não carregada.");
             const loadingTask = pdfjsLib.getDocument(new Uint8Array(fileBuffer));
             const pdf = await loadingTask.promise;
             const totalPages = pdf.numPages;
             
             console.log(`[Ingestion:PDF] Iniciando leitura integral de ${file.name}. Total de páginas: ${totalPages}`);

             for (let i = 1; i <= totalPages; i++) {
                 if (setParsingProgress) setParsingProgress({ current: i, total: totalPages, label: `Extraindo texto: Página ${i}/${totalPages}` });
                 const page = await pdf.getPage(i);
                 const textContent = await page.getTextContent();
                 const items = textContent.items as any[];
                 extractedText += items.map(it => it.str).join(' ') + '\n';
             }
             
             console.log(`[Ingestion:PDF] Leitura concluída. Linhas brutas extraídas: ${extractedText.split('\n').length}`);
        } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
            if (!XLSX) throw new Error("Excel lib missing");
            const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            extractedText = XLSX.utils.sheet_to_csv(worksheet, { FS: ";" }); 
        } else {
            extractedText = new TextDecoder('utf-8').decode(fileBuffer);
        }

        // CRÍTICO: Aguardar o término do upload para garantir que o loadingGlobal não seja interrompido
        await onFileUpload(extractedText, file.name, file);

    } catch (error: any) {
        alert(`Erro: ${error.message}`);
    } finally {
        setIsParsing(false);
        if (setParsingProgress) setParsingProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled && !isParsing) fileInputRef.current?.click();
  };

  if (customTrigger) {
      return (
          <div className="flex-shrink-0">
              <input type="file" id={id} ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={disabled || isParsing} accept=".csv,.txt,.xlsx,.xls,.pdf" />
              {customTrigger({ onClick: handleClick, disabled: disabled || isParsing, isParsing })}
          </div>
      );
  }

  return (
    <div className="flex-shrink-0">
      <input type="file" id={id} ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={disabled || isParsing} accept=".csv,.txt,.xlsx,.xls,.pdf" />
      <button type="button" onClick={handleClick} disabled={disabled || isParsing} className={`group inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${disabled ? 'bg-slate-100 text-slate-400' : 'text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm'}`}>
         {isParsing ? <><svg className="animate-spin h-3 w-3 text-white mr-1" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Processando...</span></> : <><UploadIcon className="w-3 h-3" /><span>{title}</span></>}
      </button>
    </div>
  );
});
