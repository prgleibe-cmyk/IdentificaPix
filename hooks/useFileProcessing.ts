
import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { generateFingerprint } from '../services/processingService';
import { FileModel } from '../types';
import { useUI } from '../contexts/UIContext';
import { IngestionOrchestrator } from '../core/engine/IngestionOrchestrator';

interface UseFileProcessingProps {
    activeFile: { content: string; fileName: string; rawFile?: File; base64?: string } | null;
    initialModel?: FileModel;
    isPdf: boolean;
}

export const useFileProcessing = ({ activeFile, initialModel, isPdf }: UseFileProcessingProps) => {
    const [gridData, setGridData] = useState<string[][]>([]);
    const [isGridLoading, setIsGridLoading] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [activeMapping, setActiveMapping] = useState<any>(null);
    const [detectedFingerprint, setDetectedFingerprint] = useState<any>(null);
    const [rawBase64, setRawBase64] = useState<string | undefined>(undefined);
    
    const { showToast } = useUI();
    const processingRef = useRef<string | null>(null);

    useEffect(() => {
        const loadContent = async () => {
            setIsGridLoading(true);
            let loadedRows: string[][] = [];

            try {
                // Prioridade 1: Modelo Sendo Refinado (Snippet)
                if (initialModel && !activeFile?.rawFile) {
                    const content = initialModel.snippet || "";
                    if (content.trim()) {
                        const normalized = IngestionOrchestrator.normalizeRawContent(content);
                        loadedRows = normalized.split('\n').map(line => line.split(';'));
                        
                        // Reconstrói base64 se o modelo original for PDF (se disponível no snippet ou meta)
                        if (initialModel.mapping?.extractionMode === 'BLOCK' && content.includes('[DOCUMENTO_')) {
                           // No refine, o gridData terá o placeholder, o simulador usará o gridData para rodar o contrato
                        }
                    }
                } 
                // Prioridade 2: Novo Arquivo PDF
                else if (isPdf && activeFile) {
                    loadedRows = [['[DOCUMENTO_VISUAL]', 'Analise Visual Ativa', 'IA']];
                    setRawBase64(activeFile.base64);
                } 
                // Prioridade 3: Novo Arquivo Excel
                else if (activeFile?.rawFile && (activeFile.fileName.toLowerCase().endsWith('xls') || activeFile.fileName.toLowerCase().endsWith('xlsx'))) {
                    const buffer = await activeFile.rawFile.arrayBuffer();
                    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
                    loadedRows = rawData.filter(row => row.join('').trim().length > 0).map(row => row.map(cell => String(cell || '').trim()));
                } 
                // Prioridade 4: Novo Arquivo Texto/CSV
                else if (activeFile) {
                    const content = activeFile.content || "";
                    if (content.trim()) {
                        const normalized = IngestionOrchestrator.normalizeRawContent(content);
                        loadedRows = normalized.split('\n').map(line => line.split(';'));
                    }
                    setRawBase64(activeFile.base64);
                }

                if (loadedRows.length > 0) {
                    setGridData(loadedRows);
                    
                    const sampleContentForFp = isPdf || loadedRows[0]?.[0].includes('[DOCUMENTO_') 
                        ? (activeFile?.fileName || initialModel?.name || "pdf-doc") 
                        : loadedRows.slice(0, 30).map(r => r.join(';')).join('\n');
                    
                    const fp = generateFingerprint(sampleContentForFp);
                    setDetectedFingerprint(fp);
                    
                    if (initialModel?.mapping) {
                        setActiveMapping(initialModel.mapping);
                    } else {
                        setActiveMapping({
                            extractionMode: isPdf ? 'BLOCK' : 'COLUMNS',
                            dateColumnIndex: -1,
                            descriptionColumnIndex: -1,
                            amountColumnIndex: -1,
                            skipRowsStart: 0
                        });
                    }
                }
            } catch (err) {
                console.error("[FileProcessing] Load fail:", err);
                showToast("Erro ao ler estrutura do arquivo.", "error");
            } finally {
                setIsGridLoading(false);
            }
        };

        loadContent();
    }, [activeFile, isPdf, initialModel, showToast]);

    return {
        gridData, setGridData, isGridLoading, isAiProcessing,
        activeMapping, setActiveMapping, detectedFingerprint, rawBase64
    };
};
