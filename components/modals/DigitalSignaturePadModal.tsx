import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw, PenTool, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { DigitalSignature } from '../../types/domain';

interface DigitalSignaturePadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveSignature: (signature: DigitalSignature) => void;
    initialRole?: string;
    initialName?: string;
    initialDocument?: string;
    allowedRoles?: string[];
}

const DEFAULT_ROLES = [
    'Pastor Presidente',
    '1º Tesoureiro',
    '2º Tesoureiro',
    'Conselho Fiscal 1',
    'Conselho Fiscal 2',
    'Conselho Fiscal 3',
    'Secretário(a)',
    'Outro'
];

export const DigitalSignaturePadModal: React.FC<DigitalSignaturePadModalProps> = ({
    isOpen,
    onClose,
    onSaveSignature,
    initialRole = 'Pastor Presidente',
    initialName = '',
    initialDocument = '',
    allowedRoles = DEFAULT_ROLES
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [signerName, setSignerName] = useState(initialName);
    const [signerRole, setSignerRole] = useState(initialRole);
    const [signerDocument, setSignerDocument] = useState(initialDocument);
    const [inkColor, setInkColor] = useState<'#0f172a' | '#1e3a8a'>('#1e3a8a'); // Preto ardósia ou Azul Caneta clássico
    const [validationError, setValidationError] = useState<string | null>(null);

    // Redimensiona o canvas com resolução nítida
    const setupCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = inkColor;
        }
        setHasDrawn(false);
    }, [inkColor]);

    useEffect(() => {
        if (isOpen) {
            setSignerName(initialName);
            setSignerRole(initialRole);
            setSignerDocument(initialDocument);
            setValidationError(null);
            setTimeout(() => {
                setupCanvas();
            }, 100);
        }
    }, [isOpen, initialName, initialRole, initialDocument, setupCanvas]);

    if (!isOpen) return null;

    const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            const touch = e.touches[0];
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if ('touches' in e) {
            // Previne scroll acidental na tela de toque enquanto assina
            if (e.cancelable) e.preventDefault();
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const coords = getCanvasCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        setIsDrawing(true);
        setHasDrawn(true);
        setValidationError(null);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        if ('touches' in e && e.cancelable) {
            e.preventDefault();
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = inkColor;
        const coords = getCanvasCoordinates(e);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
        setValidationError(null);
    };

    const handleConfirm = () => {
        if (!signerName.trim()) {
            setValidationError('Por favor, informe o nome completo do signatário.');
            return;
        }
        if (!hasDrawn) {
            setValidationError('Por favor, faça a assinatura ou rubrica no quadro antes de confirmar.');
            return;
        }
        const canvas = canvasRef.current;
        if (!canvas) return;

        const signatureDataUrl = canvas.toDataURL('image/png');

        const signature: DigitalSignature = {
            id: 'sig_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
            signerName: signerName.trim(),
            signerRole: signerRole.trim(),
            signerDocument: signerDocument.trim() || undefined,
            signatureDataUrl,
            signedAt: new Date().toISOString(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
        };

        onSaveSignature(signature);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div 
                className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[95vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-850">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-orange-600 text-white shadow-xs">
                            <PenTool className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                                Assinatura Digital do Responsável
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Coleta de rubrica para homologação do fechamento contábil
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Inputs */}
                <div className="p-5 space-y-4 overflow-y-auto">
                    {validationError && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{validationError}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                Cargo / Função
                            </label>
                            <select
                                value={signerRole}
                                onChange={(e) => setSignerRole(e.target.value)}
                                className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-hidden cursor-pointer"
                            >
                                {allowedRoles.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                CPF / Documento (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="000.000.000-00"
                                value={signerDocument}
                                onChange={(e) => setSignerDocument(e.target.value)}
                                className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Nome Completo do Signatário *
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Pr. João da Silva / Carlos Eduardo"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                        />
                    </div>

                    {/* Canvas Pad */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <PenTool className="w-3.5 h-3.5 text-orange-500" />
                                Desenhe sua Assinatura / Rubrica Abaixo
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-semibold mr-1">Cor da caneta:</span>
                                <button
                                    type="button"
                                    onClick={() => setInkColor('#1e3a8a')}
                                    className={`w-4 h-4 rounded-full bg-blue-900 border-2 cursor-pointer transition-transform ${
                                        inkColor === '#1e3a8a' ? 'scale-125 border-orange-500' : 'border-transparent'
                                    }`}
                                    title="Azul Caneta"
                                />
                                <button
                                    type="button"
                                    onClick={() => setInkColor('#0f172a')}
                                    className={`w-4 h-4 rounded-full bg-slate-900 border-2 cursor-pointer transition-transform ${
                                        inkColor === '#0f172a' ? 'scale-125 border-orange-500' : 'border-transparent'
                                    }`}
                                    title="Preto"
                                />
                            </div>
                        </div>

                        <div className="relative rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden touch-none select-none">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                onTouchCancel={stopDrawing}
                                className="w-full h-44 cursor-crosshair block"
                                style={{ touchAction: 'none' }}
                            />
                            {!hasDrawn && (
                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-1">
                                    <PenTool className="w-6 h-6 opacity-40" />
                                    <span className="text-[11px] font-medium">Assine com o dedo no celular ou com o mouse</span>
                                    <div className="w-48 h-px bg-slate-300 dark:bg-slate-700 mt-3" />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                Vinculado ao carimbo de data, hora e hash SHA-256
                            </span>
                            <button
                                type="button"
                                onClick={handleClear}
                                className="flex items-center gap-1 font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Limpar Traço
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/80 dark:bg-slate-850">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-95 rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                        <Check className="w-4 h-4" />
                        <span>Confirmar Assinatura</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
