import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useUI } from '../../contexts/UIContext';
import { 
    PaintBrushIcon, 
    SparklesIcon, 
    BoltIcon, 
    LockClosedIcon, 
    ShieldCheckIcon,
    ArrowPathIcon,
    PhotoIcon,
    InformationCircleIcon,
    LogoIcon,
    CheckBadgeIcon,
    DocumentArrowDownIcon
} from '../Icons';

type RenderMode = 'full' | 'symbol';

export const AdminBrandTab: React.FC = () => {
    const { showToast } = useUI();
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
    const [hasKey, setHasKey] = useState(false);
    const [renderMode, setRenderMode] = useState<RenderMode>('full');
    
    // MASTER PROMPTS - V8 (REPLICA PARA HIGH-END FINTECH)
    const FULL_BRAND_PROMPT = `High-end software company brand presentation for "IdentificaPix". 
        ICON: Three isometric stacked square plates with rounded corners (Super-Ellipse). 
        Top plate: Solid pearlescent white metal. 
        Middle plate: Semi-transparent sapphire glass with glowing cyan edges. 
        Bottom plate: Deep navy blue frosted glass. 
        TYPOGRAPHY: "Identifica" in Extra-Bold White modern sans-serif. "Pix" in Bold with a smooth Blue-to-Cyan gradient. 
        SUBTITLE: Below the text, "ENTERPRISE SYSTEM" in tiny all-caps cyan font with wide letter spacing. 
        BACKGROUND: Professional dark studio background, cinematic lighting, 8K resolution, volumetric glows, hyper-realistic textures.`;

    const SYMBOL_ONLY_PROMPT = `A premium 3D app icon design for "IdentificaPix". 
        OBJECT: A stack of three floating square plates with rounded corners in isometric view. 
        MATERIALS: Polished white ceramic top, radiant cyan glass middle, dark obsidian base. 
        EFFECTS: Light refracting through the glass layers, soft ambient occlusion, neon blue core glow. 
        STYLE: Apple Design Awards aesthetic, minimalist, clean, 4K render, dark mode background.`;

    const ACTIVE_PROMPT = useMemo(() => 
        renderMode === 'full' ? FULL_BRAND_PROMPT : SYMBOL_ONLY_PROMPT, 
    [renderMode]);

    const checkKeyStatus = useCallback(async () => {
        if (window.aistudio) {
            const result = await window.aistudio.hasSelectedApiKey();
            setHasKey(result);
            return result;
        }
        return false;
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setHasKey(true);
            showToast("Motor de renderização ativado!", "success");
        }
    };

    const generateLogo = async () => {
        setIsGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: {
                    parts: [{ text: ACTIVE_PROMPT }]
                },
                config: {
                    imageConfig: {
                        aspectRatio: "16:9",
                        imageSize: "4K"
                    }
                }
            });

            let imageUrl = null;
            if (response.candidates && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                        break;
                    }
                }
            }

            if (imageUrl) {
                setGeneratedLogo(imageUrl);
                showToast(`Asset materializado com sucesso!`, "success");
            } else {
                throw new Error("A IA não retornou o buffer de imagem.");
            }
        } catch (error: any) {
            console.error("Logo generation fail:", error);
            if (error.message?.includes("Requested entity was not found")) {
                setHasKey(false);
                showToast("Sessão expirada: Selecione sua chave novamente.", "error");
            } else {
                showToast("Erro na materialização: " + error.message, "error");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        checkKeyStatus();
    }, [checkKeyStatus]);

    return (
        <div className="w-full max-w-6xl mx-auto animate-fade-in pb-12 pt-4 space-y-6">
            
            {/* Header Lab */}
            <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-8 md:p-10 border border-slate-800 relative overflow-hidden group shadow-elevated">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none -mr-40 -mt-40"></div>
                
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
                    <div className="flex-1 text-center lg:text-left">
                        <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
                            <div className="w-12 h-12 bg-orange-500/15 text-orange-400 rounded-xl border border-orange-500/30 flex items-center justify-center shrink-0">
                                <PaintBrushIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-none">Studio de Marca v5.0</h2>
                                <span className="text-[11px] uppercase tracking-widest text-orange-400 font-semibold block mt-1.5">Identidade Visual Premium</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
                            {[
                                { id: 'full', label: 'Composição Logos', desc: 'IdentificaPix Full' },
                                { id: 'symbol', label: 'App Icon', desc: 'Símbolo 3D Puro' }
                            ].map((mode) => (
                                <button 
                                    key={mode.id}
                                    onClick={() => setRenderMode(mode.id as RenderMode)}
                                    className={`
                                        px-4 py-2.5 rounded-lg transition-colors border text-left cursor-pointer
                                        ${renderMode === mode.id 
                                            ? 'bg-orange-600 border-orange-500 text-white shadow-xs' 
                                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                                        }
                                    `}
                                >
                                    <span className="block text-xs font-semibold">{mode.label}</span>
                                    <span className="text-[10px] font-medium opacity-75">{mode.desc}</span>
                                </button>
                            ))}
                        </div>

                        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl font-normal">
                            Gere assets de marketing e ícones em alta resolução. A inteligência preserva o padrão de camadas 
                            vibrantes e a tipografia moderna da marca.
                        </p>
                    </div>

                    <div className="flex-shrink-0">
                        {!hasKey ? (
                            <button 
                                onClick={handleSelectKey}
                                className="group flex items-center gap-3 px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-semibold text-xs shadow-elevated transition-colors cursor-pointer"
                            >
                                <LockClosedIcon className="w-4 h-4 text-orange-600" />
                                Liberar Motor Gemini 3 Pro
                            </button>
                        ) : (
                            <button 
                                onClick={generateLogo} 
                                disabled={isGenerating}
                                className="flex flex-col items-center gap-2 px-8 py-5 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed group border border-orange-500/40 bg-orange-600 hover:bg-orange-700 shadow-elevated cursor-pointer"
                            >
                                {isGenerating ? (
                                    <ArrowPathIcon className="w-6 h-6 animate-spin" />
                                ) : (
                                    <SparklesIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                )}
                                <span className="text-xs tracking-wide mt-1">
                                    {isGenerating ? 'Materializando...' : 'Gerar Asset 4K'}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Output */}
            <div className="relative min-h-[460px] bg-slate-950 rounded-2xl border border-slate-800 shadow-elevated flex flex-col items-center justify-center overflow-hidden">
                {generatedLogo ? (
                    <div className="h-full w-full p-6 sm:p-8 flex flex-col items-center animate-scale-in">
                        <div className="max-w-4xl w-full rounded-xl overflow-hidden shadow-elevated border border-slate-800 group relative">
                            <img src={generatedLogo} alt="Logo Render" className="w-full h-auto" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                                <button 
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = generatedLogo;
                                        link.download = `IdentificaPix-Branding-4K.png`;
                                        link.click();
                                    }}
                                    className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                                >
                                    <DocumentArrowDownIcon className="w-4 h-4 text-orange-600" /> Baixar em Alta Resolução
                                </button>
                            </div>
                        </div>
                        <p className="mt-5 text-[11px] font-medium uppercase tracking-widest text-slate-500">© IdentificaPix Enterprise Brand Management</p>
                    </div>
                ) : (
                    <div className="text-center space-y-4 opacity-50">
                        <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto border border-slate-800">
                            <PhotoIcon className="w-8 h-8 text-slate-400" />
                        </div>
                        <h4 className="text-slate-300 font-semibold text-sm uppercase tracking-widest">Studio Pronto</h4>
                    </div>
                )}
            </div>
        </div>
    );
};