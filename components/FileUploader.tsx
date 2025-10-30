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

export const FileUploader: React.FC<FileUploaderProps> = ({
  title,
  onFileUpload,
  id,
  isUploaded,
  uploadedFileName,
  disabled = false,
  onDelete
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (event.target) event.target.value = '';
      return;
    }

    setIsParsing(true);

    try {
      const fileNameLower = file.name.toLowerCase();
      const fileBuffer = await file.arrayBuffer();
      let csvContent = '';

      if (fileNameLower.endsWith('.pdf')) {
        const typedarray = new Uint8Array(fileBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const lines = new Map<number, any[]>();
          textContent.items.forEach((item: any) => {
            const y = Math.round(item.transform[5]);
            const x = Math.round(item.transform[4]);
            if (!lines.has(y)) lines.set(y, []);
            lines.get(y).push({ x, str: item.str, width: item.width });
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
                if (gap > 5) lineText += ',';
                else if (gap > 0) lineText += ' ';
                lineText += currentItem.str;
              }
              const cleanedLine = lineText.trim().replace(/\s*,\s*/g, ',');
              if (cleanedLine) csvContent += cleanedLine + '\n';
            }
          });
        }
      } else if (fileNameLower.endsWith('.docx')) {
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
              const rowText = cells.map(cell => `"${(cell.textContent || '').replace(/"/g, '""').trim()}"`).join(',');
              csvContent += rowText + '\n';
            });
          });
        } else {
          const textResult = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
          csvContent = textResult.value.replace(/\r\n?/g, '\n');
        }
      } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
        const data = new Uint8Array(fileBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        csvContent = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        csvContent = new TextDecoder().decode(fileBuffer);
      }

      onFileUpload(csvContent, file.name);
      Metrics.increment('filesParsed');
    } catch (error: any) {
      Logger.error("Error parsing file", error, { fileName: file?.name });
      Metrics.increment('parsingErrors');
    } finally {
      setIsParsing(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled && !isParsing) fileInputRef.current?.click();
  };

  if (isUploaded) {
    return (
      <div className="flex-shrink-0 flex items-center justify-between space-x-2 text-xs font-medium text-green-800 bg-green-100 dark:bg-green-900/50 dark:text-green-300 rounded-md px-3 py-1.5 w-full sm:w-auto">
        <div className="flex items-center space-x-2 min-w-0">
          <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate" title={uploadedFileName || ''}>{uploadedFileName}</span>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-2 -mr-1 p-0.5 rounded-full text-green-700 hover:text-green-900 hover:bg-green-200 dark:text-green-300 dark:hover:text-white dark:hover:bg-green-700/50 transition-colors"
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
      className="flex-shrink-0 inline-flex items-center space-x-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Processando...</span>
        </>
      ) : (
        <>
          <UploadIcon className="w-4 h-4" />
          <span>{title}</span>
        </>
      )}
    </button>
  );
};
