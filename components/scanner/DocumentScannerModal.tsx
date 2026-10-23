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
    Layers,
    Scan
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
import { autoDetectDocumentCorners } from '../../utils/scanner/documentDetector';

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
    const [shutterFlash, setShutterFlash] = useState<boolean>(false);

    // Fallback nativo (Input File)
    const fileFallbackInputRef = useRef<HTMLInputElement>(null);

    // Imagem capturada para recorte / ajuste de perspectiva
    const [rawCapturedImage, setRawCapturedImage] = useState<HTMLImageElement | null>(null);
    const [corners, setCorners] = useState<DocumentCorners | null>(null);
    const [activeCorner, setActiveCorner] = useState<keyof DocumentCorners | null>(null);
    
    // Contêineres para dimensionamento pixel-perfect do crop
    const cropContainerRef = useRef<HTMLDivElement>(null);
    const innerCropRef = useRef<HTMLDivElement>(null);
    const [displayDimensions, setDisplayDimensions] = useState<{
        width: number;
        height: number;
        scale: number;
    }>({ width: 320, height: 420, scale: 1 });

    // Imagem retificada para filtro
    const [rectifiedCanvas, setRectifiedCanvas] = useState<HTMLCanvasElement | null>(null);
    const [currentFilter, setCurrentFilter] = useState<DocumentFilterMode>('color');
    const [filteredPreviewUrl, setFilteredPreviewUrl] = useState<string>('');

    // Estados de processamento
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [processingMessage, setProcessingMessage] = useState<string>('');

    // -------------------------------------------------------------
    // DIMENSIONAMENTO PRECISO DO CROP CONTAINER
    // -------------------------------------------------------------
    const updateDisplayDimensions = useCallback(() => {
        if (!cropContainerRef.current || !rawCapturedImage) return;

        const containerRect = cropContainerRef.current.getBoundingClientRect();
        // Margem de respiro para os marcadores não cortarem nas bordas
        const availableW = Math.max(100, containerRect.width - 24);
        const availableH = Math.max(100, containerRect.height - 24);

        const imgAspect = rawCapturedImage.width / rawCapturedImage.height;
        let w = availableW;
        let h = availableW / imgAspect;

        if (h > availableH) {
            h = availableH;
            w = availableH * imgAspect;
        }

        const finalW = Math.round(w);
        const finalH = Math.round(h);
        const scale = finalW / rawCapturedImage.width;

        setDisplayDimensions({
            width: finalW,
            height: finalH,
            scale
        });
    }, [rawCapturedImage]);

    useEffect(() => {
        if (step === 'crop' && rawCapturedImage) {
            // Executa imediatamente e no próximo frame para garantir medidas do container
            updateDisplayDimensions();
            const timer = setTimeout(updateDisplayDimensions, 50);
            window.addEventListener('resize', updateDisplayDimensions);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', updateDisplayDimensions);
            };
        }
    }, [step, rawCapturedImage, updateDisplayDimensions]);

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
                    width: { ideal: 3840, min: 1280 },
                    height: { ideal: 2160, min: 720 },
                    advanced: [
                        { focusMode: 'continuous' }
                    ]
                } as any,
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
    // CAPTURA DA IMAGEM EM ALTA DEFINIÇÃO (ImageCapture ou Frame HD)
    // -------------------------------------------------------------
    const handleCaptureFromVideo = async () => {
        // Efeito de obturador óptico (flash branco suave)
        setShutterFlash(true);
        setTimeout(() => setShutterFlash(false), 180);

        setIsProcessing(true);
        setProcessingMessage('Capturando em alta definição e auto-enquadrando...');

        // 1. Tenta API ImageCapture.takePhoto() direto do sensor óptico da câmera (hardware full resolution)
        if (typeof (window as any).ImageCapture !== 'undefined' && mediaStreamRef.current) {
            const track = mediaStreamRef.current.getVideoTracks()[0];
            if (track && track.readyState === 'live') {
                try {
                    // Força autofoco contínuo antes da foto
                    try {
                        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
                        if (caps?.focusMode?.includes('continuous')) {
                            await (track as any).applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
                        }
                    } catch (_) {}

                    const imageCapture = new (window as any).ImageCapture(track);
                    const photoBlob = await imageCapture.takePhoto({ fillLightMode: 'auto' });

                    const img = new Image();
                    const objectUrl = URL.createObjectURL(photoBlob);
                    img.onload = () => {
                        URL.revokeObjectURL(objectUrl);
                        stopCamera();
                        processImageAndAutoWarp(img);
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        fallbackCaptureVideoFrame();
                    };
                    img.src = objectUrl;
                    return;
                } catch (photoErr) {
                    console.warn('[Scanner] takePhoto falhou, usando captura direta do frame:', photoErr);
                }
            }
        }

        // Fallback robusto direto do elemento <video>
        fallbackCaptureVideoFrame();
    };

    const fallbackCaptureVideoFrame = () => {
        if (!videoRef.current) {
            setIsProcessing(false);
            return;
        }
        const video = videoRef.current;
        const vw = video.videoWidth || 1920;
        const vh = video.videoHeight || 1080;

        // Limita tamanho para 1800px para máxima nitidez de texto com total segurança de memória
        const maxDim = 1800;
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
        if (!ctx) {
            setIsProcessing(false);
            return;
        }

        ctx.drawImage(video, 0, 0, tw, th);
        stopCamera();

        const img = new Image();
        img.onload = () => {
            processImageAndAutoWarp(img);
        };
        img.src = canvas.toDataURL('image/jpeg', 0.95);
    };

    // Processa a imagem capturada, detecta bordas, retifica e aplica filtro nítido automaticamente
    const processImageAndAutoWarp = (targetImg: HTMLImageElement) => {
        setRawCapturedImage(targetImg);
        const detectedCorners = autoDetectDocumentCorners(targetImg);
        setCorners(detectedCorners);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetImg.width;
        tempCanvas.height = targetImg.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
            setIsProcessing(false);
            setStep('crop');
            return;
        }
        tempCtx.drawImage(targetImg, 0, 0);

        try {
            // Retifica perspectiva em alta definição (1600px para texto perfeitamente nítido)
            const warpedCanvas = warpDocumentPerspective(tempCanvas, detectedCorners, 1600);
            setRectifiedCanvas(warpedCanvas);
            setCurrentFilter('color');
            const previewUrl = generateFilteredPreview(warpedCanvas, 'color');
            setFilteredPreviewUrl(previewUrl);
            setStep('filter');
        } catch (err) {
            console.warn('[Scanner] Fallback para ajuste manual:', err);
            setStep('crop');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleNativeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setProcessingMessage('Carregando foto e digitalizando documento...');

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
                        processImageAndAutoWarp(resizedImg);
                    };
                    resizedImg.src = canvas.toDataURL('image/jpeg', 0.92);
                } else {
                    stopCamera();
                    processImageAndAutoWarp(img);
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
    const handleAutoDetect = () => {
        if (!rawCapturedImage) return;
        const detected = autoDetectDocumentCorners(rawCapturedImage);
        setCorners(detected);
    };

    const handleFullImageCorners = () => {
        if (!rawCapturedImage) return;
        setCorners({
            topLeft: { x: 0, y: 0 },
            topRight: { x: rawCapturedImage.width, y: 0 },
            bottomRight: { x: rawCapturedImage.width, y: rawCapturedImage.height },
            bottomLeft: { x: 0, y: rawCapturedImage.height }
        });
    };

    const handleResetCorners = () => {
        if (!rawCapturedImage) return;
        setCorners(getDefaultCorners(rawCapturedImage.width, rawCapturedImage.height));
    };

    // Arrastar vértices com mapeamento exato de escala
    const updateCornerPosition = (clientX: number, clientY: number) => {
        if (!activeCorner || !corners || !innerCropRef.current || !rawCapturedImage) return;

        const rect = innerCropRef.current.getBoundingClientRect();
        const scale = displayDimensions.scale;
        if (!scale || scale <= 0) return;

        // Converte pixel da tela diretamente para coordenadas da imagem
        const rawX = (clientX - rect.left) / scale;
        const rawY = (clientY - rect.top) / scale;

        const clampedX = Math.round(Math.max(0, Math.min(rawCapturedImage.width, rawX)));
        const clampedY = Math.round(Math.max(0, Math.min(rawCapturedImage.height, rawY)));

        setCorners({
            ...corners,
            [activeCorner]: { x: clampedX, y: clampedY }
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

    const handleApplyWarp = async () => {
        if (!rawCapturedImage || !corners) return;

        setIsProcessing(true);
        setProcessingMessage('Corrigindo perspectiva e enquadramento...');

        try {
            await new Promise(resolve => setTimeout(resolve, 30));

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = rawCapturedImage.width;
            tempCanvas.height = rawCapturedImage.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) throw new Error('Não foi possível obter contexto 2D');
            tempCtx.drawImage(rawCapturedImage, 0, 0);

            const warpedCanvas = warpDocumentPerspective(tempCanvas, corners, 1400);
            setRectifiedCanvas(warpedCanvas);

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

    const handleRotateRawImage = () => {
        if (!rawCapturedImage) return;
        setIsProcessing(true);
        setProcessingMessage('Girando imagem...');
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
                    const detected = autoDetectDocumentCorners(rotatedImg);
                    setCorners(detected);
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

    const handleSaveCurrentPage = async () => {
        if (!rectifiedCanvas) return;

        setIsProcessing(true);
        setProcessingMessage('Otimizando página do documento...');

        try {
            await new Promise(resolve => setTimeout(resolve, 30));

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = rectifiedCanvas.width;
            finalCanvas.height = rectifiedCanvas.height;
            const ctx = finalCanvas.getContext('2d');
            if (!ctx) throw new Error('Não foi possível inicializar canvas');

            ctx.drawImage(rectifiedCanvas, 0, 0);
            enhanceDocumentCanvas(finalCanvas, currentFilter);

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

            setRawCapturedImage(null);
            setCorners(null);
            setRectifiedCanvas(null);
            setFilteredPreviewUrl('');

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
                                {step === 'camera' && 'Aponte a câmera para o documento e toque em Capturar e Digitalizar'}
                                {step === 'filter' && 'Documento digitalizado e enquadrado. Revise ou confirme a página'}
                                {step === 'crop' && 'Ajuste os 4 cantos arrastando os marcadores se necessário'}
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
                <div 
                    ref={cropContainerRef}
                    className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[360px] sm:min-h-[460px] p-2"
                >
                    
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

                                    {/* Molde Inteligente A4 Iluminado (Guia Ativa de Enquadramento) */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3 sm:p-6">
                                        <div className="relative w-full max-w-[320px] sm:max-w-[400px] aspect-[1/1.414] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex flex-col items-center justify-between p-3 border border-cyan-400/30">
                                            
                                            {/* 4 Cantos Iluminados (Luminous Brackets em Neon Cyan) */}
                                            <div className="absolute -top-1 -left-1 w-7 h-7 border-t-[3.5px] border-l-[3.5px] border-cyan-400 rounded-tl-xl drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                                            <div className="absolute -top-1 -right-1 w-7 h-7 border-t-[3.5px] border-r-[3.5px] border-cyan-400 rounded-tr-xl drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                                            <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-[3.5px] border-l-[3.5px] border-cyan-400 rounded-bl-xl drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                                            <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-[3.5px] border-r-[3.5px] border-cyan-400 rounded-br-xl drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]" />

                                            {/* Linha de Varredura Laser Suave */}
                                            <div className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 animate-pulse pointer-events-none top-1/2 -translate-y-1/2" />

                                            {/* Mira Central */}
                                            <div className="w-5 h-5 border border-cyan-400/30 rounded-full flex items-center justify-center my-auto opacity-50">
                                                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                                            </div>

                                            {/* Badge Superior: Molde Inteligente A4 */}
                                            <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] text-cyan-200 border border-cyan-500/40 font-medium flex items-center gap-1.5 shadow-xl">
                                                <Scan className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                                                <span>Molde Inteligente A4 Ativo</span>
                                            </div>

                                            {/* Dica Inferior */}
                                            <div className="bg-black/75 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] text-slate-200 border border-white/10 text-center font-medium shadow-lg">
                                                Alinhe o comprovante na moldura e dispare
                                            </div>
                                        </div>
                                    </div>

                                    {/* Flash visual suave do obturador ao disparar a foto */}
                                    {shutterFlash && (
                                        <div className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 opacity-90 z-40" />
                                    )}
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

                    {/* PASSO 2: AJUSTE DE BORDAS / PERSPECTIVA (CROP COM ESCALA EXATA) */}
                    {step === 'crop' && rawCapturedImage && corners && (
                        <div 
                            className="relative flex items-center justify-center w-full h-full select-none"
                            onMouseMove={handleMouseMove}
                            onMouseUp={() => setActiveCorner(null)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={() => setActiveCorner(null)}
                        >
                            {/* Contêiner interno dimensionado exatamente na proporção da imagem */}
                            <div 
                                ref={innerCropRef}
                                style={{ 
                                    width: `${displayDimensions.width}px`, 
                                    height: `${displayDimensions.height}px` 
                                }}
                                className="relative rounded-lg overflow-hidden shadow-2xl border border-slate-700 bg-slate-900"
                            >
                                <img
                                    src={rawCapturedImage.src}
                                    alt="Documento capturado"
                                    className="w-full h-full object-fill pointer-events-none"
                                />

                                {/* Overlay SVG com polígono de recorte alinhado em coordenadas reais de tela */}
                                <svg 
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                    viewBox={`0 0 ${displayDimensions.width} ${displayDimensions.height}`}
                                >
                                    {/* Máscara semi-transparente escurecida fora do documento */}
                                    <polygon
                                        points={`
                                            ${corners.topLeft.x * displayDimensions.scale},${corners.topLeft.y * displayDimensions.scale} 
                                            ${corners.topRight.x * displayDimensions.scale},${corners.topRight.y * displayDimensions.scale} 
                                            ${corners.bottomRight.x * displayDimensions.scale},${corners.bottomRight.y * displayDimensions.scale} 
                                            ${corners.bottomLeft.x * displayDimensions.scale},${corners.bottomLeft.y * displayDimensions.scale}
                                        `}
                                        fill="rgba(59, 130, 246, 0.28)"
                                        stroke="#3b82f6"
                                        strokeWidth="3"
                                        strokeDasharray="6,4"
                                    />
                                    {/* Linhas diagonais cruzadas sutis */}
                                    <line 
                                        x1={corners.topLeft.x * displayDimensions.scale} 
                                        y1={corners.topLeft.y * displayDimensions.scale} 
                                        x2={corners.bottomRight.x * displayDimensions.scale} 
                                        y2={corners.bottomRight.y * displayDimensions.scale} 
                                        stroke="rgba(59, 130, 246, 0.35)" 
                                        strokeWidth="1.5" 
                                    />
                                    <line 
                                        x1={corners.topRight.x * displayDimensions.scale} 
                                        y1={corners.topRight.y * displayDimensions.scale} 
                                        x2={corners.bottomLeft.x * displayDimensions.scale} 
                                        y2={corners.bottomLeft.y * displayDimensions.scale} 
                                        stroke="rgba(59, 130, 246, 0.35)" 
                                        strokeWidth="1.5" 
                                    />
                                </svg>

                                {/* 4 Marcadores Circulares Interativos Arrastáveis */}
                                {cornerKeys.map((cornerKey) => {
                                    const pt = corners[cornerKey];
                                    const screenX = pt.x * displayDimensions.scale;
                                    const screenY = pt.y * displayDimensions.scale;

                                    return (
                                        <div
                                            key={String(cornerKey)}
                                            style={{ 
                                                left: `${screenX}px`, 
                                                top: `${screenY}px` 
                                            }}
                                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none z-10 transition-transform ${
                                                activeCorner === cornerKey 
                                                    ? 'scale-125' 
                                                    : 'hover:scale-110'
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
                                            <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center ring-4 ring-blue-500/40">
                                                <div className="w-2 h-2 rounded-full bg-white" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* PASSO 3: FILTRO / REALCE DO DOCUMENTO */}
                    {step === 'filter' && filteredPreviewUrl && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-2 bg-slate-950">
                            <div className="relative max-w-full max-h-[58vh] rounded-lg overflow-hidden border border-slate-700 shadow-2xl bg-white">
                                <img
                                    src={filteredPreviewUrl}
                                    alt="Pré-visualização do Documento Retificado"
                                    className="max-w-full max-h-[58vh] object-contain"
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
                <div className="px-4 py-3 bg-slate-800/95 border-t border-slate-700/60 flex items-center justify-between gap-2 sm:gap-3 z-20 flex-wrap">
                    
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
                                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-95 text-white font-semibold text-xs flex items-center gap-2.5 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer ring-2 ring-cyan-400/40"
                                >
                                    <Camera className="w-4 h-4 text-white" />
                                    <span>Capturar em Alta Definição</span>
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
                                    onClick={handleAutoDetect}
                                    className="px-2.5 py-1.5 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:bg-blue-600/50 text-xs font-medium flex items-center gap-1 transition-colors"
                                    title="Detectar Bordas do Documento Automaticamente"
                                >
                                    <Scan className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Auto Enquadrar</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFullImageCorners}
                                    className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                    title="Enquadrar Foto Inteira"
                                >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Total</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRotateRawImage}
                                    className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                    title="Girar 90°"
                                >
                                    <RotateCw className="w-3.5 h-3.5" />
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
                                    Confirmar Enquadramento
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'filter' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setStep('crop')}
                                className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Ajustar os 4 cantos do documento manualmente"
                            >
                                <Scan className="w-3.5 h-3.5 text-blue-400" />
                                Reajustar Bordas
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveCurrentPage}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
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
