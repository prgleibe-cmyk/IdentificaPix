
import React, { useRef, useState, useEffect } from 'react';
import { UploadIcon, CheckCircleIcon, XMarkIcon } from './Icons';

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
                // EXPOSIÇÃO GLOBAL CRÍTICA PARA O LAB DE ARQUIVOS
                (window as any).pdfjsLib = lib; 
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
        let extractedText = '';

        // ESTRATÉGIA DE LEITURA PURA:
        // O objetivo aqui é APENAS extrair o texto/conteúdo cru do arquivo.
        // A interpretação (parsing de colunas, identificação de banco) é responsabilidade do StrategyEngine.

        if (fileNameLower.endsWith('.pdf')) {
             if (!pdfjsLib) throw new Error("Biblioteca PDF não carregada. Tente recarregar a página.");
             const loadingTask = pdfjsLib.getDocument(new Uint8Array(fileBuffer));
             const pdf = await loadingTask.promise;
             
             // Extração linha a linha preservando layout visual aproximado
             for (let i = 1; i <= pdf.numPages; i++) {
                 const page = await pdf.getPage(i);
                 const textContent = await page.getTextContent();
                 const items = textContent.items as any[];
                 
                 // Agrupa por Y para reconstruir linhas visuais
                 const lineMap: Map<number, { str: string, x: number }[]> = new Map();
                 
                 items.forEach(item => {
                     const y = Math.round(item.transform[5]); 
                     if (!lineMap.has(y)) lineMap.set(y, []);
                     lineMap.get(y)!.push({ str: item.str, x: item.transform[4] });
                 });

                 // Ordena linhas de cima para baixo
                 const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);

                 for (const y of sortedY) {
                     // Ordena itens da esquerda para a direita na mesma linha
                     const lineItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
                     const lineStr = lineItems.map(it => it.str).join(' '); // Junta com espaço simples
                     if (lineStr.trim()) extractedText += lineStr + '\n';
                 }
             }

        } else if (fileNameLower.endsWith('.docx')) {
            if (!mammoth) throw new Error("Word lib missing");
            const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
            extractedText = result.value;

        } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
            if (!XLSX) throw new Error("Excel lib missing");
            const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            // Converte para CSV usando ponto-e-vírgula para facilitar a vida do StrategyEngine
            extractedText = XLSX.utils.sheet_to_csv(worksheet, { FS: ";" }); 

        } else {
            // TXT, CSV
            extractedText = new TextDecoder('utf-8').decode(fileBuffer);
        }

        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error("O arquivo parece estar vazio.");
        }
        
        // Passa o texto cru para o Pai (que chamará o StrategyEngine)
        onFileUpload(extractedText, file.name, file);

    } catch (error: any) {
        console.error(error);
        alert(`Erro ao ler arquivo: ${error.message}`);
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
