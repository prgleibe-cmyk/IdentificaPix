
import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { generateFingerprint } from '../services/processingService';
import { FileModel } from '../types';
import { useUI } from '../contexts/UIContext';
import { IngestionOrchestrator } from '../core/engine/IngestionOrchestrator';

interface UseFileProcessingProps {
    activeFile: { content: string; fileName: string; rawFile?: File } | null;
    initialModel?: FileModel;
    isPdf: boolean;
}

export const useFileProcessing = ({ activeFile, initialModel, isPdf }: UseFileProcessingProps) => {
    const [gridData, setGridData] = useState<string[][]>([]);
    const [isGridLoading, setIsGridLoading] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [activeMapping, setActiveMapping] = useState<any>(null);
    const [detectedFingerprint, setDetectedFingerprint] = useState<any>(null);
    const { showToast } = useUI();
    
    const processingRef = useRef<string | null>(null);

    useEffect(() => {
        if (!activeFile) {
            setGridData([]);
            setActiveMapping(null);
            setDetectedFingerprint(null);
            processingRef.current = null;
            return;
        }

        const fileKey = `${activeFile.fileName}-${activeFile.content?.length || 0}`;
        if (processingRef.current === fileKey) return;
        processingRef.current = fileKey;

        const loadContent = async () => {
            setIsGridLoading(true);
            setIsAiProcessing(false);
            let loadedRows: string[][] = [];

            try {
                if (activeFile.rawFile && (activeFile.fileName.toLowerCase().endsWith('xls') || activeFile.fileName.toLowerCase().endsWith('xlsx'))) {
                    const buffer = await activeFile.rawFile.arrayBuffer();
                    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                    loadedRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
                } 
                else {
                    const content = activeFile.content || "";
                    if (content.trim()) {
                        // USA A MESMA LÓGICA DA PRODUÇÃO
                        const normalized = IngestionOrchestrator.normalizeRawContent(content);
                        loadedRows = normalized.split('\n').map(line => line.split(';'));
                    }
                }

                if (loadedRows.length > 0) {
                    setGridData(loadedRows);
                    const sampleContentForFp = loadedRows.slice(0, 30).map(r => r.join(';')).join('\n');
                    const fp = generateFingerprint(sampleContentForFp);
                    setDetectedFingerprint(fp);
                    
                    if (initialModel?.mapping) {
                        setActiveMapping(initialModel.mapping);
                    } else {
                        // FIX: Sempre inicializa mapping para evitar undefined
                        setActiveMapping({
                            extractionMode: 'COLUMNS',
                            dateColumnIndex: -1,
                            descriptionColumnIndex: -1,
                            amountColumnIndex: -1,
                            skipRowsStart: 0
                        });
                    }
                }
            } catch (err) {
                console.error("Erro no laboratório:", err);
                showToast("Erro ao ler estrutura do arquivo.", "error");
            } finally {
                setIsGridLoading(false);
            }
        };

        loadContent();
    }, [activeFile, isPdf, initialModel, showToast]);

    return {
        gridData,
        setGridData,
        isGridLoading,
        isAiProcessing,
        activeMapping,
        setActiveMapping,
        detectedFingerprint
    };
};
