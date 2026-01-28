
import React, { useState, useEffect, useRef } from 'react';

export const PDFRenderer: React.FC<{ file?: File }> = ({ file }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pages, setPages] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pdfInstance, setPdfInstance] = useState<any>(null);

    useEffect(() => {
        if (!file) return;

        const loadPDF = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                const WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

                if (!(window as any).pdfjsLib) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = PDFJS_URL;
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                const pdfjsLib = (window as any).pdfjsLib;
                pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;

                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                
                setPdfInstance(pdf);
                
                // @frozen-block-start: PDF_PAGE_LIMIT_2
                const pagesToRender = Math.min(pdf.numPages, 2);
                setPages(Array.from({ length: pagesToRender }, (_, i) => i + 1));
                // @frozen-block-end: PDF_PAGE_LIMIT_2

            } catch (err: any) {
                console.error("Erro ao carregar PDF:", err);
                setError("O ambiente restringiu a visualização. A extração IA ainda funciona normalmente.");
            } finally {
                setIsLoading(false);
            }
        };

        loadPDF();
    }, [file]);

    return (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-950 flex flex-col">
            {/* Header de Status */}
            {!isLoading && !error && pages.length > 0 && (
                <div className="flex-shrink-0 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center z-20 shadow-sm">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Amostra: {pages.length} {pages.length === 1 ? 'Página' : 'Páginas'} (Visualização Limitada)
                    </span>
                    <div className="px-3 py-1 bg-brand-blue/10 rounded-full">
                         <span className="text-[9px] font-bold text-brand-blue uppercase">Foco Estrutural</span>
                    </div>
                </div>
            )}

            {/* Área de Scroll Real */}
            <div 
                ref={containerRef} 
                className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-200 dark:bg-slate-950 p-4 md:p-8 flex flex-col items-center gap-6"
            >
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">Lendo Documento...</p>
                    </div>
                )}

                {error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center max-w-xs animate-fade-in">
                        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl mb-4">
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{error}</p>
                        </div>
                    </div>
                ) : (
                    pages.map(pageNum => (
                        <PDFPage 
                            key={pageNum} 
                            pdf={pdfInstance} 
                            pageNum={pageNum} 
                            containerWidth={containerRef.current?.clientWidth || 800} 
                        />
                    ))
                )}
                
                {!isLoading && !error && pages.length > 0 && (
                    <div className="pb-10 pt-4">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Fim da Amostra Visual</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-componente para renderizar cada página individualmente
const PDFPage: React.FC<{ pdf: any, pageNum: number, containerWidth: number }> = ({ pdf, pageNum, containerWidth }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isRendered, setIsRendered] = useState(false);

    useEffect(() => {
        if (!pdf || !canvasRef.current) return;

        const renderPage = async () => {
            const page = await pdf.getPage(pageNum);
            const canvas = canvasRef.current;
            if (!canvas) return;

            const context = canvas.getContext('2d');
            if (!context) return;

            // Escala para ocupar a largura do container mantendo proporção
            const unscaledViewport = page.getViewport({ scale: 1 });
            const targetWidth = Math.min(containerWidth - 64, 1000); // Max 1000px, 64px padding
            const scale = targetWidth / unscaledViewport.width;
            
            const outputScale = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale: scale * outputScale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            canvas.style.width = `${viewport.width / outputScale}px`;
            canvas.style.height = `${viewport.height / outputScale}px`;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            await page.render(renderContext).promise;
            setIsRendered(true);
        };

        renderPage();
    }, [pdf, pageNum, containerWidth]);

    return (
        <div className={`
            bg-white shadow-[0_10px_30px_rgba(0,0,0,0.15)] rounded-sm border border-slate-300 dark:border-slate-800 transition-opacity duration-500
            ${isRendered ? 'opacity-100' : 'opacity-0'}
        `}>
            <canvas ref={canvasRef} className="block" />
        </div>
    );
};
