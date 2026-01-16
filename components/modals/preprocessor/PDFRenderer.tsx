
import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ArrowPathIcon } from '../../Icons';

export const PDFRenderer: React.FC<{ file?: File }> = ({ file }) => {
    const [pages, setPages] = useState<number[]>([]);
    const [pdfInstance, setPdfInstance] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!file) return;

        const loadPDF = async () => {
            let attempts = 0;
            while (!(window as any).pdfjsLib && attempts < 20) {
                await new Promise(r => setTimeout(r, 200));
                attempts++;
            }

            const pdfjsLib = (window as any).pdfjsLib;
            if (!pdfjsLib) {
                setError("Biblioteca PDF não carregada. Recarregue a página.");
                return;
            }
            try {
                const buffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument(new Uint8Array(buffer));
                const pdf = await loadingTask.promise;
                setPdfInstance(pdf);
                setPages(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
            } catch (err: any) { 
                console.error("PDF Load error:", err); 
                setError("Erro ao renderizar PDF. Use a visualização de tabela.");
            }
        };
        loadPDF();
    }, [file]);

    if (!file) return null;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <XMarkIcon className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-xs">{error}</p>
            </div>
        );
    }

    const PageCanvas: React.FC<{ pageNum: number, pdf: any }> = ({ pageNum, pdf }) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        useEffect(() => {
            const render = async () => {
                if (!pdf || !canvasRef.current) return;
                try {
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 1.0 }); 
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: context, viewport }).promise;
                    }
                } catch (e) { console.error(e); }
            };
            render();
        }, [pageNum, pdf]);
        return (
            <div className="bg-white p-1 shadow-sm border border-slate-200 mb-4 rounded-sm w-fit max-w-full overflow-hidden mx-auto">
                <canvas ref={canvasRef} className="max-w-full h-auto block" />
            </div>
        );
    };

    return (
        <div className="absolute inset-0 overflow-auto custom-scrollbar bg-slate-200 dark:bg-slate-950/50 p-4">
            {pages.map(p => <PageCanvas key={p} pageNum={p} pdf={pdfInstance} />)}
            {pages.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <ArrowPathIcon className="w-8 h-8 animate-spin mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Renderizando PDF...</p>
                </div>
            )}
        </div>
    );
};
