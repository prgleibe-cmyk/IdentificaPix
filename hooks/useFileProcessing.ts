
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { detectDelimiter, generateFingerprint } from '../services/processingService';
import { extractDataFromVisual } from '../services/geminiService';
import { FileModel } from '../types';

interface UseFileProcessingProps {
    activeFile: { content: string; fileName: string; rawFile?: File } | null;
    initialModel?: FileModel;
    isImage: boolean;
    isPdf: boolean;
}

export const useFileProcessing = ({ activeFile, initialModel, isImage, isPdf }: UseFileProcessingProps) => {
    const [gridData, setGridData] = useState<string[][]>([]);
    const [isGridLoading, setIsGridLoading] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [activeMapping, setActiveMapping] = useState<any>(null);
    const [detectedFingerprint, setDetectedFingerprint] = useState<any>(null);

    useEffect(() => {
        if (!activeFile) return;

        const loadContent = async () => {
            setIsGridLoading(true);
            setIsAiProcessing(false);
            let loadedRows: string[][] = [];

            try {
                if (isImage && activeFile.rawFile) {
                    setIsAiProcessing(true);
                    const aiResult = await extractDataFromVisual(activeFile.rawFile);
                    try {
                        const parsed = JSON.parse(aiResult);
                        if (parsed?.rows) {
                            loadedRows = parsed.rows.map((r: any) => [
                                r.date || '',
                                r.description || '',
                                r.amount ? String(r.amount) : '',
                                r.reference || ''
                            ]);
                            setActiveMapping({
                                dateColumnIndex: 0,
                                descriptionColumnIndex: 1,
                                amountColumnIndex: 2,
                                typeColumnIndex: 3,
                                skipRowsStart: 0
                            });
                        }
                    } catch (e) {
                        console.error("AI Parse error", e);
                    }
                } else if (activeFile.rawFile && (activeFile.fileName.endsWith('xls') || activeFile.fileName.endsWith('xlsx'))) {
                    const buffer = await activeFile.rawFile.arrayBuffer();
                    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                    loadedRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
                } else if (!isPdf && !isImage) {
                    const lines = (activeFile.content || '').split(/\r?\n/).filter((l: string) => l.trim().length > 0);
                    if (lines.length > 0) {
                        const delimiter = detectDelimiter(lines[0]);
                        loadedRows = lines.map((l: string) => l.split(delimiter));
                    }
                }

                if (loadedRows.length > 0) {
                    setGridData(loadedRows);
                    const fp = generateFingerprint(activeFile.content || loadedRows.slice(0, 5).map(r => r.join(';')).join('\n'));
                    setDetectedFingerprint(fp);
                    
                    if (initialModel?.mapping) {
                        setActiveMapping(initialModel.mapping);
                    }
                }
            } catch (err) {
                console.error("Error loading grid data:", err);
            } finally {
                setIsGridLoading(false);
            }
        };

        loadContent();
    }, [activeFile, isPdf, isImage, initialModel]);

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
