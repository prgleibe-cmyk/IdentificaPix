import React, { useState } from 'react';
import { PenTool, CheckCircle2, Plus, Trash2, ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';
import { DigitalSignature } from '../../types/domain';
import { DigitalSignaturePadModal } from './DigitalSignaturePadModal';

interface DigitalSignatureCollectionSectionProps {
    signatures: DigitalSignature[];
    onChangeSignatures: (signatures: DigitalSignature[]) => void;
    defaultPastorName?: string;
    defaultTreasurerName?: string;
    readOnly?: boolean;
}

export const DigitalSignatureCollectionSection: React.FC<DigitalSignatureCollectionSectionProps> = ({
    signatures,
    onChangeSignatures,
    defaultPastorName = '',
    defaultTreasurerName = '',
    readOnly = false
}) => {
    const [padOpen, setPadOpen] = useState(false);
    const [activeRole, setActiveRole] = useState<string>('Pastor Presidente');
    const [activeInitialName, setActiveInitialName] = useState<string>('');
    const [editingSigId, setEditingSigId] = useState<string | null>(null);

    const openPadForRole = (role: string, defaultName: string = '', sigIdToReplace?: string) => {
        if (readOnly) return;
        setActiveRole(role);
        setActiveInitialName(defaultName);
        setEditingSigId(sigIdToReplace || null);
        setPadOpen(true);
    };

    const handleSaveSignature = (newSig: DigitalSignature) => {
        if (editingSigId) {
            onChangeSignatures(signatures.map(s => s.id === editingSigId ? newSig : s));
        } else {
            // Remove assinatura anterior do mesmo cargo se já existia
            const filtered = signatures.filter(s => s.signerRole !== newSig.signerRole);
            onChangeSignatures([...filtered, newSig]);
        }
    };

    const handleRemoveSignature = (sigId: string) => {
        if (readOnly) return;
        onChangeSignatures(signatures.filter(s => s.id !== sigId));
    };

    const pastorSig = signatures.find(s => s.signerRole === 'Pastor Presidente' || s.signerRole.toLowerCase().includes('pastor'));
    const treasurerSig = signatures.find(s => s.signerRole === '1º Tesoureiro' || s.signerRole.toLowerCase().includes('tesour'));
    const councilSignatures = signatures.filter(s => s.signerRole.toLowerCase().includes('conselho') || s.signerRole.toLowerCase().includes('fiscal'));
    const otherSignatures = signatures.filter(s => s !== pastorSig && s !== treasurerSig && !councilSignatures.includes(s));

    return (
        <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
                        <PenTool className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            Assinaturas Digitais do Fechamento
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Elimina o papel e confere autenticidade contábil e fiscal com carimbo de integridade
                        </p>
                    </div>
                </div>

                {!readOnly && (
                    <button
                        type="button"
                        onClick={() => openPadForRole('Conselho Fiscal', '')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors border border-orange-200/60 dark:border-orange-800/60 cursor-pointer"
                    >
                        <Plus className="w-3 h-3" />
                        <span>Adicionar Conselheiro / Fiscal</span>
                    </button>
                )}
            </div>

            {/* Grid dos Signatários Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Pastor Presidente */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Pastor Presidente
                        </span>
                        {pastorSig ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Assinado
                            </span>
                        ) : (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                                Pendente
                            </span>
                        )}
                    </div>

                    {pastorSig ? (
                        <div className="space-y-1.5">
                            <div className="h-12 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1 border border-slate-100 dark:border-slate-800">
                                <img 
                                    src={pastorSig.signatureDataUrl} 
                                    alt="Assinatura Pastor" 
                                    className="max-h-full max-w-full object-contain" 
                                />
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <div className="truncate pr-1">
                                    <p className="font-bold text-slate-900 dark:text-white truncate">{pastorSig.signerName}</p>
                                    <p className="text-slate-400 text-[9px]">
                                        {new Date(pastorSig.signedAt).toLocaleDateString('pt-BR')} às {new Date(pastorSig.signedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                {!readOnly && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => openPadForRole('Pastor Presidente', pastorSig.signerName, pastorSig.id)}
                                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                            title="Refazer assinatura"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSignature(pastorSig.id)}
                                            className="p-1 text-rose-400 hover:text-rose-600 transition-colors"
                                            title="Remover assinatura"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col justify-center items-center py-2 space-y-1.5">
                            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                {defaultPastorName || 'Pastor Responsável'}
                            </p>
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => openPadForRole('Pastor Presidente', defaultPastorName)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors shadow-2xs cursor-pointer"
                                >
                                    <PenTool className="w-3 h-3" />
                                    <span>Assinar na Tela</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* 2. Tesoureiro */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            1º Tesoureiro / Financeiro
                        </span>
                        {treasurerSig ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Assinado
                            </span>
                        ) : (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                                Pendente
                            </span>
                        )}
                    </div>

                    {treasurerSig ? (
                        <div className="space-y-1.5">
                            <div className="h-12 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1 border border-slate-100 dark:border-slate-800">
                                <img 
                                    src={treasurerSig.signatureDataUrl} 
                                    alt="Assinatura Tesoureiro" 
                                    className="max-h-full max-w-full object-contain" 
                                />
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                                <div className="truncate pr-1">
                                    <p className="font-bold text-slate-900 dark:text-white truncate">{treasurerSig.signerName}</p>
                                    <p className="text-slate-400 text-[9px]">
                                        {new Date(treasurerSig.signedAt).toLocaleDateString('pt-BR')} às {new Date(treasurerSig.signedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                {!readOnly && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => openPadForRole('1º Tesoureiro', treasurerSig.signerName, treasurerSig.id)}
                                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                            title="Refazer assinatura"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSignature(treasurerSig.id)}
                                            className="p-1 text-rose-400 hover:text-rose-600 transition-colors"
                                            title="Remover assinatura"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col justify-center items-center py-2 space-y-1.5">
                            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                {defaultTreasurerName || 'Tesoureiro Responsável'}
                            </p>
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => openPadForRole('1º Tesoureiro', defaultTreasurerName)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors shadow-2xs cursor-pointer"
                                >
                                    <PenTool className="w-3 h-3" />
                                    <span>Assinar na Tela</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Lista de Conselho Fiscal e Outros */}
            {(councilSignatures.length > 0 || otherSignatures.length > 0) && (
                <div className="space-y-2 pt-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Conselho Fiscal / Outros Signatários ({councilSignatures.length + otherSignatures.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[...councilSignatures, ...otherSignatures].map((sig) => (
                            <div key={sig.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 shadow-2xs">
                                <div className="h-10 w-24 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-0.5 border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0">
                                    <img src={sig.signatureDataUrl} alt={sig.signerRole} className="max-h-full max-w-full object-contain" />
                                </div>
                                <div className="min-w-0 flex-1 text-[10px]">
                                    <p className="font-black text-slate-900 dark:text-white truncate">{sig.signerRole}</p>
                                    <p className="font-semibold text-slate-600 dark:text-slate-300 truncate">{sig.signerName}</p>
                                    <p className="text-[9px] text-slate-400">
                                        {new Date(sig.signedAt).toLocaleDateString('pt-BR')} às {new Date(sig.signedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSignature(sig.id)}
                                        className="p-1 text-rose-400 hover:text-rose-600 transition-colors shrink-0"
                                        title="Remover assinatura"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <DigitalSignaturePadModal
                isOpen={padOpen}
                onClose={() => setPadOpen(false)}
                onSaveSignature={handleSaveSignature}
                initialRole={activeRole}
                initialName={activeInitialName}
            />
        </div>
    );
};
