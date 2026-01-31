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
            <div className="bg-[#051024] rounded-[3rem] p-10 md:p-14 border border-white/10 relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none -mr-48 -mt-48"></div>
                
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
                    <div className="flex-1 text-center lg:text-left">
                        <div className="flex items-center justify-center lg:justify-start gap-5 mb-8">
                            <div className="p-5 bg-blue-600/20 text-cyan-400 rounded-3xl border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                                <PaintBrushIcon className="w-10 h-10" />
                            </div>
                            <div>
                                <h2 className="text-4xl font-black text-white tracking-tighter leading-none">Studio de Marca v5.0</h2>
                                <span className="text-[11px] uppercase tracking-[0.5em] text-cyan-400 font-black block mt-2 opacity-70">Identidade Visual Premium</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
                            {[
                                { id: 'full', label: 'Composição Logos', desc: 'IdentificaPix Full' },
                                { id: 'symbol', label: 'App Icon', desc: 'Símbolo 3D Puro' }
                            ].map((mode) => (
                                <button 
                                    key={mode.id}
                                    onClick={() => setRenderMode(mode.id as RenderMode)}
                                    className={`
                                        px-6 py-3 rounded-2xl transition-all border text-left
                                        ${renderMode === mode.id 
                                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/20 scale-105' 
                                            : 'bg-[#0F172A] border-white/5 text-slate-400 hover:bg-slate-800'
                                        }
                                    `}
                                >
                                    <span className="block text-xs font-black uppercase tracking-widest">{mode.label}</span>
                                    <span className="text-[9px] font-bold opacity-60 uppercase">{mode.desc}</span>
                                </button>
                            ))}
                        </div>

                        <p className="text-slate-400 text-lg leading-relaxed max-w-2xl font-medium">
                            Gere assets de marketing e ícones em alta resolução. A inteligência preserva o padrão de camadas 
                            vibrantes e a tipografia futurista da IdentificaPix.
                        </p>
                    </div>

                    <div className="flex-shrink-0">
                        {!hasKey ? (
                            <button 
                                onClick={handleSelectKey}
                                className="group flex items-center gap-4 px-10 py-6 bg-white text-brand-deep rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl hover:-translate-y-1 transition-all active:scale-95 ring-8 ring-white/5"
                            >
                                <LockClosedIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                Liberar Motor Gemini 3 Pro
                            </button>
                        ) : (
                            <button 
                                onClick={generateLogo} 
                                disabled={isGenerating}
                                className={`
                                    flex flex-col items-center gap-2 px-12 py-8 text-white rounded-[2.5rem] font-black uppercase transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group border border-white/20
                                    ${renderMode === 'full' 
                                        ? 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-[0_20px_50px_rgba(37,99,235,0.4)]' 
                                        : 'bg-gradient-to-br from-indigo-600 to-purple-700 shadow-[0_20px_50px_rgba(79,70,229,0.4)]'
                                    }
                                `}
                            >
                                {isGenerating ? (
                                    <ArrowPathIcon className="w-8 h-8 animate-spin" />
                                ) : (
                                    <SparklesIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                )}
                                <span className="text-xs tracking-[0.2em] mt-2">
                                    {isGenerating ? 'Materializando...' : `Gerar Asset 4K`}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Output */}
            <div className="relative min-h-[500px] bg-[#020610] rounded-[3rem] border border-white/5 shadow-2xl flex flex-col items-center justify-center overflow-hidden cinematic-spotlight">
                {generatedLogo ? (
                    <div className="h-full w-full p-8 flex flex-col items-center animate-scale-in">
                        <div className="max-w-4xl w-full rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(37,99,235,0.25)] border border-white/10 group relative">
                            <img src={generatedLogo} alt="Logo Render" className="w-full h-auto" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                                <button 
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = generatedLogo;
                                        link.download = `IdentificaPix-Branding-4K.png`;
                                        link.click();
                                    }}
                                    className="px-8 py-3 bg-white text-slate-900 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                                >
                                    <DocumentArrowDownIcon className="w-4 h-4" /> Baixar em Alta Resolução
                                </button>
                            </div>
                        </div>
                        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.5em] text-white/20">© IdentificaPix Enterprise Brand Management</p>
                    </div>
                ) : (
                    <div className="text-center space-y-6 opacity-30">
                        <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                            <PhotoIcon className="w-10 h-10 text-white" />
                        </div>
                        <h4 className="text-white font-black text-lg uppercase tracking-[0.3em]">Studio Pronto</h4>
                    </div>
                )}
            </div>
        </div>
    );
};