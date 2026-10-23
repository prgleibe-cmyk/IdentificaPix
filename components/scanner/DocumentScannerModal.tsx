import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Camera, 
    X, 
    Check, 
    RotateCw, 
    Trash2, 
    Plus, 
    Sparkles, 
    FileText, 
    Zap, 
    ZapOff, 
    Upload, 
    Maximize2,
    Sliders,
    Layers
} from 'lucide-react';
import { 
    Point, 
    DocumentCorners, 
    getDefaultCorners, 
    warpDocumentPerspective 
} from '../../utils/scanner/perspectiveWarp';
import { 
    DocumentFilterMode, 
    enhanceDocumentCanvas, 
    canvasToOptimizedBlob 
} from '../../utils/scanner/documentEnhancer';
import { 
    ScannedPageItem, 
    compilePagesToPdf, 
    CompiledPdfResult 
} from '../../utils/scanner/pdfCompiler';

export interface DocumentScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (result: {
        file: File;
        dataUrl: string;
        pageCount: number;
        fileSize: number;
    }) => void;
    maxPages?: number;
}

type ScannerStep = 'camera' | 'crop' | 'filter' | 'review';

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
    isOpen,
    onClose,
    onComplete,
    maxPages = 10
}) => {
    // Estado do fluxo
    const [step, setStep] = useState<ScannerStep>('camera');
    const [pages, setPages] = useState<ScannedPageItem[]>([]);
    const [activePageIndex, setActivePageIndex] = useState<number>(0);

    // Câmera WebRTC
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const [cameraActive, setCameraActive] = useState<boolean>(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [torchSupported, setTorchSupported] = useState<boolean>(false);
    const [torchOn, setTorchOn] = useState<boolean>(false);

    // Fallback nativo (Input File)
    const fileFallbackInputRef = useRef<HTMLInputElement>(null);

    // Imagem capturada para recorte / ajuste de perspectiva
    const [rawCapturedImage, setRawCapturedImage] = useState<HTMLImageElement | null>(null);
    const [corners, setCorners] = useState<DocumentCorners | null>(null);
    const [activeCorner, setActiveCorner] = useState<keyof DocumentCorners | null>(null);
    const cropContainerRef = useRef<HTMLDivElement>(null);

    // Imagem retificada para filtro
    const [rectifiedCanvas, setRectifiedCanvas] = useState<HTMLCanvasElement | null>(null);
    const [currentFilter, setCurrentFilter] = useState<DocumentFilterMode>('color');
    const [filteredPreviewUrl, setFilteredPreviewUrl] = useState<string>('');

    // Estados de processamento
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [processingMessage, setProcessingMessage] = useState<string>('');

    // -------------------------------------------------------------
    // GERENCIAMENTO DA CÂMERA (WebRTC com Fallback Nativo)
    // -------------------------------------------------------------
    const stopCamera = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (_) {}
            });
            mediaStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
        setTorchOn(false);
        setTorchSupported(false);
    }, []);

    const startCamera = useCallback(async () => {
        setCameraError(null);
        stopCamera();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('Câmera direta indisponível neste navegador. Use a captura nativa.');
            return;
        }

        try {
            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920, min: 1024 },
                    height: { ideal: 1080, min: 720 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraActive(true);
            }

            // Verifica suporte a Lanterna / Torch
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
                if (capabilities && capabilities.torch) {
                    setTorchSupported(true);
                }
            }
        } catch (err: any) {
            console.warn('[Scanner] Falha ao iniciar WebRTC:', err);
            const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
            setCameraError(
                isDenied 
                    ? 'Acesso à câmera não autorizado. Use a opção "Câmera do Celular / Galeria" abaixo.'
                    : 'Não foi possível inicializar a câmera direta. Use a captura nativa do aparelho.'
            );
            setCameraActive(false);
        }
    }, [stopCamera]);

    // Alternar lanterna
    const toggleTorch = async () => {
        if (!mediaStreamRef.current) return;
        const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
        if (!videoTrack) return;

        try {
            const nextState = !torchOn;
            await (videoTrack as any).applyConstraints({
                advanced: [{ torch: nextState }]
            });
            setTorchOn(nextState);
        } catch (err) {
            console.warn('[Scanner] Falha ao alternar lanterna:', err);
        }
    };

    // Inicialização da câmera ao abrir modal ou voltar para captura
    useEffect(() => {
        if (isOpen && step === 'camera') {
            startCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isOpen, step, startCamera, stopCamera]);

    // Fechamento e limpeza geral
    const handleCloseModal = () => {
        stopCamera();
        pages.forEach(p => {
            if (p.dataUrl && p.dataUrl.startsWith('blob:')) {
                try { URL.revokeObjectURL(p.dataUrl); } catch (_) {}
            }
        });
        setPages([]);
        setRawCapturedImage(null);
        setCorners(null);
        setRectifiedCanvas(null);
        setStep('camera');
        onClose();
    };

    // -------------------------------------------------------------
    // CAPTURA DA IMAGEM
    // -------------------------------------------------------------
    // 1. Captura via WebRTC
    const handleCaptureFromVideo = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;

        // Limita tamanho para no máximo 1600px na maior dimensão para proteção de memória
        const maxDim = 1600;
        let scale = 1;
        if (Math.max(vw, vh) > maxDim) {
            scale = maxDim / Math.max(vw, vh);
        }
        const tw = Math.round(vw * scale);
        const th = Math.round(vh * scale);

        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, tw, th);
        stopCamera();

        const img = new Image();
        img.onload = () => {
            setRawCapturedImage(img);
            setCorners(getDefaultCorners(tw, th));
            setStep('crop');
        };
        img.src = canvas.toDataURL('image/jpeg', 0.92);
    };

    // 2. Captura via Fallback Nativo (Input file com capture="environment")
    const handleNativeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setProcessingMessage('Carregando foto...');

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const dataUrl = loadEvent.target?.result as string;
            const img = new Image();
            img.onload = () => {
                const maxDim = 1600;
                let tw = img.width;
                let th = img.height;
                if (Math.max(tw, th) > maxDim) {
                    const scale = maxDim / Math.max(tw, th);
                    tw = Math.round(tw * scale);
                    th = Math.round(th * scale);
                }

                const canvas = document.createElement('canvas');
                canvas.width = tw;
                canvas.height = th;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, tw, th);
                    const resizedImg = new Image();
                    resizedImg.onload = () => {
                        stopCamera();
                        setRawCapturedImage(resizedImg);
                        setCorners(getDefaultCorners(tw, th));
                        setIsProcessing(false);
                        setStep('crop');
                    };
                    resizedImg.src = canvas.toDataURL('image/jpeg', 0.92);
                } else {
                    stopCamera();
                    setRawCapturedImage(img);
                    setCorners(getDefaultCorners(img.width, img.height));
                    setIsProcessing(false);
                    setStep('crop');
                }
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // -------------------------------------------------------------
    // AJUSTE DE BORDAS E PERSPECTIVA (CROP INTERATIVO)
    // -------------------------------------------------------------
    const handleResetCorners = () => {
        if (!rawCapturedImage) return;
        setCorners(getDefaultCorners(rawCapturedImage.width, rawCapturedImage.height));
    };

    // Arrastar vértices (Mouse e Touch)
    const updateCornerPosition = (clientX: number, clientY: number) => {
        if (!activeCorner || !corners || !cropContainerRef.current || !rawCapturedImage) return;

        const rect = cropContainerRef.current.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;

        const relativeX = Math.max(0, Math.min(1, (clientX - rect.left) / displayWidth));
        const relativeY = Math.max(0, Math.min(1, (clientY - rect.top) / displayHeight));

        const imgX = Math.round(relativeX * rawCapturedImage.width);
        const imgY = Math.round(relativeY * rawCapturedImage.height);

        setCorners({
            ...corners,
            [activeCorner]: { x: imgX, y: imgY }
        });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!activeCorner) return;
        const touch = e.touches[0];
        updateCornerPosition(touch.clientX, touch.clientY);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!activeCorner) return;
        updateCornerPosition(e.clientX, e.clientY);
    };

    // Confirmar recorte e aplicar homografia
    const handleApplyWarp = async () => {
        if (!rawCapturedImage || !corners) return;

        setIsProcessing(true);
        setProcessingMessage('Corrigindo perspectiva e enquadramento...');

        try {
            await new Promise(resolve => setTimeout(resolve, 30));

            // Desenha a imagem capturada em um canvas temporário
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = rawCapturedImage.width;
            tempCanvas.height = rawCapturedImage.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) throw new Error('Não foi possível obter contexto 2D');
            tempCtx.drawImage(rawCapturedImage, 0, 0);

            // Executa a transformação planar matemática
            const warpedCanvas = warpDocumentPerspective(tempCanvas, corners, 1400);
            setRectifiedCanvas(warpedCanvas);

            // Aplica filtro padrão ('color' - Documento Nítido)
            setCurrentFilter('color');
            const previewUrl = generateFilteredPreview(warpedCanvas, 'color');
            setFilteredPreviewUrl(previewUrl);

            setStep('filter');
        } catch (err) {
            console.error('[Scanner] Erro na retificação de perspectiva:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // Girar imagem original em 90 graus
    const handleRotateRawImage = () => {
        if (!rawCapturedImage) return;
        setIsProcessing(true);
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = rawCapturedImage.height;
            canvas.height = rawCapturedImage.width;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((90 * Math.PI) / 180);
                ctx.drawImage(rawCapturedImage, -rawCapturedImage.width / 2, -rawCapturedImage.height / 2);
                const rotatedImg = new Image();
                rotatedImg.onload = () => {
                    setRawCapturedImage(rotatedImg);
                    setCorners(getDefaultCorners(rotatedImg.width, rotatedImg.height));
                    setIsProcessing(false);
                };
                rotatedImg.src = canvas.toDataURL('image/jpeg', 0.92);
            } else {
                setIsProcessing(false);
            }
        }, 30);
    };

    // -------------------------------------------------------------
    // FILTROS E MELHORIA DE LEGIBILIDADE
    // -------------------------------------------------------------
    const generateFilteredPreview = (baseCanvas: HTMLCanvasElement, filter: DocumentFilterMode): string => {
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = baseCanvas.width;
        previewCanvas.height = baseCanvas.height;
        const ctx = previewCanvas.getContext('2d');
        if (!ctx) return baseCanvas.toDataURL('image/jpeg', 0.85);

        ctx.drawImage(baseCanvas, 0, 0);
        enhanceDocumentCanvas(previewCanvas, filter);
        return previewCanvas.toDataURL('image/jpeg', 0.85);
    };

    const handleSelectFilter = (filter: DocumentFilterMode) => {
        if (!rectifiedCanvas) return;
        setCurrentFilter(filter);
        const previewUrl = generateFilteredPreview(rectifiedCanvas, filter);
        setFilteredPreviewUrl(previewUrl);
    };

    // Confirmar página e adicionar à lista
    const handleSaveCurrentPage = async () => {
        if (!rectifiedCanvas) return;

        setIsProcessing(true);
        setProcessingMessage('Otimizando página do documento...');

        try {
            await new Promise(resolve => setTimeout(resolve, 30));

            // Cria cópia do canvas retificado para aplicar o filtro selecionado
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = rectifiedCanvas.width;
            finalCanvas.height = rectifiedCanvas.height;
            const ctx = finalCanvas.getContext('2d');
            if (!ctx) throw new Error('Não foi possível inicializar canvas');

            ctx.drawImage(rectifiedCanvas, 0, 0);
            enhanceDocumentCanvas(finalCanvas, currentFilter);

            // Comprime em JPEG leve (~80KB - 140KB)
            const { dataUrl } = await canvasToOptimizedBlob(finalCanvas, 0.78);

            const newPage: ScannedPageItem = {
                id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                dataUrl,
                width: finalCanvas.width,
                height: finalCanvas.height
            };

            const updatedPages = [...pages, newPage];
            setPages(updatedPages);
            setActivePageIndex(updatedPages.length - 1);

            // Limpa buffers temporários para garantia anti-OOM
            setRawCapturedImage(null);
            setCorners(null);
            setRectifiedCanvas(null);
            setFilteredPreviewUrl('');

            // Vai para a tela de revisão
            setStep('review');
        } catch (err) {
            console.error('[Scanner] Erro ao salvar página:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // -------------------------------------------------------------
    // GESTÃO DE MÚLTIPLAS PÁGINAS E REVISÃO
    // -------------------------------------------------------------
    const handleDeletePage = (indexToDelete: number) => {
        const remaining = pages.filter((_, i) => i !== indexToDelete);
        setPages(remaining);

        if (remaining.length === 0) {
            setStep('camera');
        } else {
            setActivePageIndex(Math.max(0, Math.min(activePageIndex, remaining.length - 1)));
        }
    };

    const handleAddMorePages = () => {
        if (pages.length >= maxPages) {
            alert(`Limite máximo de ${maxPages} páginas atingido para este documento.`);
            return;
        }
        setStep('camera');
    };

    // -------------------------------------------------------------
    // FINALIZAR E GERAR PDF
    // -------------------------------------------------------------
    const handleCompileAndComplete = async () => {
        if (pages.length === 0) return;

        setIsProcessing(true);
        setProcessingMessage('Compilando PDF padrão A4 otimizado...');

        try {
            await new Promise(resolve => setTimeout(resolve, 50));

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `documento_digitalizado_${timestamp}.pdf`;

            const pdfResult: CompiledPdfResult = await compilePagesToPdf(pages, { fileName });

            // Cria objeto File padrão compatível com a infraestrutura existente
            const compiledFile = new File([pdfResult.blob], pdfResult.fileName, {
                type: 'application/pdf',
                lastModified: Date.now()
            });

            onComplete({
                file: compiledFile,
                dataUrl: pdfResult.dataUrl,
                pageCount: pdfResult.pageCount,
                fileSize: pdfResult.size
            });

            handleCloseModal();
        } catch (err) {
            console.error('[Scanner] Falha na compilação do PDF:', err);
            alert('Não foi possível gerar o PDF. Verifique se as páginas são válidas.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    const cornerKeys: (keyof DocumentCorners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 select-none touch-manipulation">
            {/* Input oculto para captura nativa / fallback de qualquer celular */}
            <input 
                ref={fileFallbackInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleNativeFileSelect}
            />

            {/* Container Principal do Scanner */}
            <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl bg-slate-900 text-white flex flex-col sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50">
                
                {/* 1. CABEÇALHO */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700/60 z-20">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                            <FileText className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                                Digitalizar Comprovante
                                {pages.length > 0 && (
                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                        {pages.length} {pages.length === 1 ? 'pág' : 'págs'}
                                    </span>
                                )}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                {step === 'camera' && 'Enquadre o documento e capture'}
                                {step === 'crop' && 'Ajuste os 4 cantos para alinhar'}
                                {step === 'filter' && 'Escolha o melhor realce de leitura'}
                                {step === 'review' && 'Revise as páginas do PDF final'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {step === 'camera' && torchSupported && (
                            <button
                                type="button"
                                onClick={toggleTorch}
                                className={`p-2 rounded-lg transition-colors ${
                                    torchOn 
                                        ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50' 
                                        : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                                }`}
                                title={torchOn ? 'Desligar Lanterna' : 'Ligar Lanterna'}
                            >
                                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="p-2 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-700 transition-colors"
                            title="Fechar Scanner"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 2. ÁREA CENTRAL DE CONTEÚDO */}
                <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[360px] sm:min-h-[460px]">
                    
                    {/* PASSO 1: CÂMERA */}
                    {step === 'camera' && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
                            {cameraActive && !cameraError ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover sm:object-contain"
                                    />

                                    {/* Guia visual de enquadramento de documento */}
                                    <div className="absolute inset-8 sm:inset-12 border-2 border-dashed border-blue-400/70 rounded-2xl pointer-events-none flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                                        <div className="bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-[11px] text-blue-200 border border-blue-500/40 font-medium">
                                            Alinhe o comprovante no retângulo
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="p-6 text-center max-w-sm flex flex-col items-center">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-4">
                                        <Camera className="w-7 h-7" />
                                    </div>
                                    <h4 className="text-sm font-semibold text-slate-200 mb-1">
                                        Captura de Comprovante
                                    </h4>
                                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                                        {cameraError || 'Iniciando câmera... Toque abaixo para abrir a câmera do celular com garantia total de compatibilidade.'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => fileFallbackInputRef.current?.click()}
                                        className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                                    >
                                        <Camera className="w-4 h-4" />
                                        Abrir Câmera do Celular
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASSO 2: AJUSTE DE BORDAS / PERSPECTIVA (CROP) */}
                    {step === 'crop' && rawCapturedImage && corners && (
                        <div 
                            ref={cropContainerRef}
                            className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden"
                            onMouseMove={handleMouseMove}
                            onMouseUp={() => setActiveCorner(null)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={() => setActiveCorner(null)}
                        >
                            <img
                                src={rawCapturedImage.src}
                                alt="Documento para alinhamento"
                                className="max-w-full max-h-full object-contain pointer-events-none"
                            />

                            <svg 
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                viewBox={`0 0 ${rawCapturedImage.width} ${rawCapturedImage.height}`}
                                preserveAspectRatio="xMidYMid meet"
                            >
                                <polygon
                                    points={`${corners.topLeft.x},${corners.topLeft.y} ${corners.topRight.x},${corners.topRight.y} ${corners.bottomRight.x},${corners.bottomRight.y} ${corners.bottomLeft.x},${corners.bottomLeft.y}`}
                                    fill="rgba(59, 130, 246, 0.22)"
                                    stroke="#3b82f6"
                                    strokeWidth="6"
                                    strokeDasharray="12,6"
                                />
                                <line 
                                    x1={corners.topLeft.x} y1={corners.topLeft.y} 
                                    x2={corners.bottomRight.x} y2={corners.bottomRight.y} 
                                    stroke="rgba(59, 130, 246, 0.3)" strokeWidth="2" 
                                />
                                <line 
                                    x1={corners.topRight.x} y1={corners.topRight.y} 
                                    x2={corners.bottomLeft.x} y2={corners.bottomLeft.y} 
                                    stroke="rgba(59, 130, 246, 0.3)" strokeWidth="2" 
                                />
                            </svg>

                            {cropContainerRef.current && (
                                <>
                                    {cornerKeys.map((cornerKey) => {
                                        const pt = corners[cornerKey];
                                        const leftPercent = (pt.x / rawCapturedImage.width) * 100;
                                        const topPercent = (pt.y / rawCapturedImage.height) * 100;

                                        return (
                                            <div
                                                key={String(cornerKey)}
                                                style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                                                className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center cursor-pointer touch-none transition-transform ${
                                                    activeCorner === cornerKey 
                                                        ? 'bg-blue-500 scale-125 ring-4 ring-blue-400/50' 
                                                        : 'bg-blue-600 hover:scale-110'
                                                }`}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setActiveCorner(cornerKey);
                                                }}
                                                onTouchStart={(e) => {
                                                    e.stopPropagation();
                                                    setActiveCorner(cornerKey);
                                                }}
                                            >
                                                <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    )}

                    {/* PASSO 3: FILTRO / REALCE DO DOCUMENTO */}
                    {step === 'filter' && filteredPreviewUrl && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-4 bg-slate-950">
                            <div className="relative max-w-full max-h-[60vh] rounded-lg overflow-hidden border border-slate-700 shadow-2xl bg-white">
                                <img
                                    src={filteredPreviewUrl}
                                    alt="Pré-visualização do Documento Retificado"
                                    className="max-w-full max-h-[60vh] object-contain"
                                />
                            </div>

                            <div className="mt-4 flex items-center gap-2 bg-slate-800/90 p-1.5 rounded-xl border border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => handleSelectFilter('color')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                        currentFilter === 'color'
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                                    }`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Nítido (Recomendado)
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectFilter('grayscale')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                        currentFilter === 'grayscale'
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                                    }`}
                                >
                                    <Sliders className="w-3.5 h-3.5" />
                                    Preto & Branco
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectFilter('original')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                        currentFilter === 'original'
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                                    }`}
                                >
                                    Original
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PASSO 4: REVISÃO DE PÁGINAS ESCANEADAS */}
                    {step === 'review' && pages.length > 0 && (
                        <div className="relative w-full h-full flex flex-col items-center justify-between p-4 bg-slate-950 overflow-y-auto">
                            <div className="relative flex-1 flex items-center justify-center w-full min-h-[280px]">
                                <div className="relative max-h-[50vh] rounded-lg overflow-hidden border border-slate-700 shadow-2xl bg-white">
                                    <img
                                        src={pages[activePageIndex]?.dataUrl}
                                        alt={`Página ${activePageIndex + 1}`}
                                        className="max-w-full max-h-[50vh] object-contain"
                                    />
                                    <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] text-white font-medium border border-slate-700">
                                        Página {activePageIndex + 1} de {pages.length}
                                    </div>
                                </div>
                            </div>

                            <div className="w-full mt-4">
                                <div className="flex items-center gap-2 overflow-x-auto pb-2 px-1">
                                    {pages.map((p, idx) => (
                                        <div
                                            key={p.id}
                                            onClick={() => setActivePageIndex(idx)}
                                            className={`relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                                activePageIndex === idx
                                                    ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/20'
                                                    : 'border-slate-700 opacity-70 hover:opacity-100'
                                            }`}
                                        >
                                            <img
                                                src={p.dataUrl}
                                                alt={`Miniatura ${idx + 1}`}
                                                className="w-full h-full object-cover bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeletePage(idx);
                                                }}
                                                className="absolute top-0.5 right-0.5 p-1 rounded bg-red-600/90 text-white hover:bg-red-500 transition-colors"
                                                title="Remover Página"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                            <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold px-1 rounded bg-black/70 text-white">
                                                {idx + 1}
                                            </span>
                                        </div>
                                    ))}

                                    {pages.length < maxPages && (
                                        <button
                                            type="button"
                                            onClick={handleAddMorePages}
                                            className="flex-shrink-0 w-16 h-20 rounded-lg border-2 border-dashed border-slate-600 hover:border-blue-500 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-400 transition-all bg-slate-800/40"
                                            title="Adicionar outra página"
                                        >
                                            <Plus className="w-5 h-5" />
                                            <span className="text-[10px] font-medium">+ Página</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* OVERLAY DE PROCESSAMENTO / LOADING */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
                            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3" />
                            <p className="text-xs text-slate-200 font-medium">
                                {processingMessage || 'Processando...'}
                            </p>
                        </div>
                    )}
                </div>

                {/* 3. BARRA INFERIOR DE AÇÕES / BOTOES */}
                <div className="px-4 py-3 bg-slate-800/95 border-t border-slate-700/60 flex items-center justify-between gap-3 z-20">
                    
                    {step === 'camera' && (
                        <>
                            <button
                                type="button"
                                onClick={() => fileFallbackInputRef.current?.click()}
                                className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                title="Abrir Câmera Nativa ou Galeria"
                            >
                                <Upload className="w-4 h-4 text-slate-300" />
                                <span className="hidden sm:inline">Galeria /</span> Câmera Nativa
                            </button>

                            {cameraActive && (
                                <button
                                    type="button"
                                    onClick={handleCaptureFromVideo}
                                    className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
                                >
                                    <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                                    Capturar Foto
                                </button>
                            )}

                            {pages.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setStep('review')}
                                    className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                    <Layers className="w-4 h-4 text-blue-400" />
                                    Ver Páginas ({pages.length})
                                </button>
                            )}
                        </>
                    )}

                    {step === 'crop' && (
                        <>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleResetCorners}
                                    className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                    title="Redefinir Bordas"
                                >
                                    <Maximize2 className="w-4 h-4" />
                                    <span className="hidden sm:inline">Redefinir</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRotateRawImage}
                                    className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                    title="Girar 90°"
                                >
                                    <RotateCw className="w-4 h-4" />
                                    <span className="hidden sm:inline">Girar</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStep('camera')}
                                    className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
                                >
                                    Recapturar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyWarp}
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all"
                                >
                                    <Check className="w-4 h-4" />
                                    Ajustar e Continuar
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'filter' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setStep('crop')}
                                className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
                            >
                                Voltar ao Ajuste
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveCurrentPage}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all"
                            >
                                <Check className="w-4 h-4" />
                                Confirmar Página
                            </button>
                        </>
                    )}

                    {step === 'review' && (
                        <>
                            <button
                                type="button"
                                onClick={handleAddMorePages}
                                disabled={pages.length >= maxPages}
                                className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                            >
                                <Plus className="w-4 h-4 text-blue-400" />
                                + Outra Página
                            </button>

                            <button
                                type="button"
                                onClick={handleCompileAndComplete}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
                            >
                                <FileText className="w-4 h-4" />
                                Gerar PDF ({pages.length} {pages.length === 1 ? 'página' : 'páginas'})
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
};
