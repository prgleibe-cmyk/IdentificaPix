import React, { useState, useMemo } from 'react';
import { PenTool, CheckCircle2, Plus, Trash2, ShieldCheck, UserCheck, RefreshCw, Users, CheckSquare, Square, AlertCircle, Sparkles } from 'lucide-react';
import { Church, DigitalSignature } from '../../types/domain';
import { DigitalSignaturePadModal, RegisteredPersonOption } from './DigitalSignaturePadModal';

export interface ChurchSignerSlot {
    id: string;
    name: string;
    role: string;
    category: 'pastor' | 'tesouraria' | 'outro';
    hasRegisteredName: boolean;
}

interface DigitalSignatureCollectionSectionProps {
    signatures: DigitalSignature[];
    onChangeSignatures: (signatures: DigitalSignature[]) => void;
    church?: Church | null;
    defaultPastorName?: string;
    defaultTreasurerName?: string;
    readOnly?: boolean;
}

export const DigitalSignatureCollectionSection: React.FC<DigitalSignatureCollectionSectionProps> = ({
    signatures,
    onChangeSignatures,
    church = null,
    defaultPastorName = '',
    defaultTreasurerName = '',
    readOnly = false
}) => {
    const [padOpen, setPadOpen] = useState(false);
    const [activeRole, setActiveRole] = useState<string>('Pastor Presidente');
    const [activeInitialName, setActiveInitialName] = useState<string>('');
    const [editingSigId, setEditingSigId] = useState<string | null>(null);

    // Mapeamento de slots desativados/excluídos pelo usuário (para controle total)
    const [disabledSlotIds, setDisabledSlotIds] = useState<Set<string>>(new Set());

    // 1. Extração dinâmica de pessoas e cargos cadastrados na igreja
    const churchSigners = useMemo<ChurchSignerSlot[]>(() => {
        const slots: ChurchSignerSlot[] = [];

        // Pastores da Igreja
        if (church?.pastors && Array.isArray(church.pastors) && church.pastors.length > 0) {
            church.pastors.forEach((p, idx) => {
                const name = p.name?.trim() || '';
                const role = p.title?.trim() || (idx === 0 ? 'Pastor Presidente' : 'Pastor Auxiliar');
                slots.push({
                    id: `pastor-${idx}-${name || 'unnamed'}`,
                    name,
                    role,
                    category: 'pastor',
                    hasRegisteredName: Boolean(name)
                });
            });
        } else if (church?.pastor && church.pastor.trim()) {
            slots.push({
                id: 'pastor-main',
                name: church.pastor.trim(),
                role: 'Pastor Presidente',
                category: 'pastor',
                hasRegisteredName: true
            });
        } else if (defaultPastorName && defaultPastorName.trim()) {
            slots.push({
                id: 'pastor-default',
                name: defaultPastorName.trim(),
                role: 'Pastor Presidente',
                category: 'pastor',
                hasRegisteredName: true
            });
        } else {
            // Slot padrão se não houver pastor cadastrado
            slots.push({
                id: 'pastor-empty',
                name: '',
                role: 'Pastor Presidente',
                category: 'pastor',
                hasRegisteredName: false
            });
        }

        // Tesoureiros da Igreja
        if (church?.treasurers && Array.isArray(church.treasurers) && church.treasurers.length > 0) {
            church.treasurers.forEach((t, idx) => {
                const name = t.name?.trim() || '';
                const role = t.title?.trim() || (idx === 0 ? '1º Tesoureiro' : `${idx + 1}º Tesoureiro`);
                slots.push({
                    id: `treasurer-${idx}-${name || 'unnamed'}`,
                    name,
                    role,
                    category: 'tesouraria',
                    hasRegisteredName: Boolean(name)
                });
            });
        } else if (church?.treasurer && church.treasurer.trim()) {
            slots.push({
                id: 'treasurer-main',
                name: church.treasurer.trim(),
                role: '1º Tesoureiro',
                category: 'tesouraria',
                hasRegisteredName: true
            });
        } else if (defaultTreasurerName && defaultTreasurerName.trim()) {
            slots.push({
                id: 'treasurer-default',
                name: defaultTreasurerName.trim(),
                role: '1º Tesoureiro',
                category: 'tesouraria',
                hasRegisteredName: true
            });
        } else {
            // Slot padrão se não houver tesoureiro cadastrado
            slots.push({
                id: 'treasurer-empty',
                name: '',
                role: '1º Tesoureiro',
                category: 'tesouraria',
                hasRegisteredName: false
            });
        }

        return slots;
    }, [church, defaultPastorName, defaultTreasurerName]);

    // 2. Lista de opções de pessoas cadastradas na igreja para preenchimento ágil
    const registeredPeopleOptions = useMemo<RegisteredPersonOption[]>(() => {
        const list: RegisteredPersonOption[] = [];
        churchSigners.forEach(s => {
            if (s.name) {
                list.push({ name: s.name, role: s.role });
            }
        });
        return list;
    }, [churchSigners]);

    // 3. Cargos permitidos combinados (pastores, tesoureiros, conselho fiscal, etc.)
    const allowedRoles = useMemo(() => {
        const rolesSet = new Set<string>();
        // Cargos dos slots da igreja
        churchSigners.forEach(s => {
            if (s.role) rolesSet.add(s.role);
        });

        // Cargos salvos em localStorage no cadastro de igreja
        try {
            const pSaved = localStorage.getItem('iggestor_pastor_roles_v2');
            if (pSaved) {
                const parsed = JSON.parse(pSaved);
                if (Array.isArray(parsed)) parsed.forEach(r => typeof r === 'string' && rolesSet.add(r));
            }
            const tSaved = localStorage.getItem('iggestor_treasurer_roles_v2');
            if (tSaved) {
                const parsed = JSON.parse(tSaved);
                if (Array.isArray(parsed)) parsed.forEach(r => typeof r === 'string' && rolesSet.add(r));
            }
        } catch (e) {}

        // Cargos institucionais padrão
        rolesSet.add('Pastor Presidente');
        rolesSet.add('Pastor Auxiliar');
        rolesSet.add('1º Tesoureiro');
        rolesSet.add('2º Tesoureiro');
        rolesSet.add('Conselho Fiscal 1');
        rolesSet.add('Conselho Fiscal 2');
        rolesSet.add('Conselho Fiscal 3');
        rolesSet.add('Secretário(a)');
        rolesSet.add('Outro');

        return Array.from(rolesSet);
    }, [churchSigners]);

    // 4. Localiza assinatura correspondente a um slot da igreja
    const getSlotSignature = (slot: ChurchSignerSlot): DigitalSignature | undefined => {
        // Prioridade 1: Mesmo nome e mesmo cargo
        if (slot.name) {
            const exact = signatures.find(
                s => s.signerRole.trim().toLowerCase() === slot.role.trim().toLowerCase() &&
                     s.signerName.trim().toLowerCase() === slot.name.trim().toLowerCase()
            );
            if (exact) return exact;
        }

        // Prioridade 2: Mesmo cargo exato
        const byRole = signatures.find(
            s => s.signerRole.trim().toLowerCase() === slot.role.trim().toLowerCase()
        );
        if (byRole) return byRole;

        // Prioridade 3: Similaridade de categoria se for único
        if (slot.category === 'pastor') {
            const pastorSigs = signatures.filter(s => s.signerRole.toLowerCase().includes('pastor'));
            if (pastorSigs.length === 1 && churchSigners.filter(s => s.category === 'pastor').length === 1) {
                return pastorSigs[0];
            }
        }
        if (slot.category === 'tesouraria') {
            const treasSigs = signatures.filter(s => s.signerRole.toLowerCase().includes('tesour'));
            if (treasSigs.length === 1 && churchSigners.filter(s => s.category === 'tesouraria').length === 1) {
                return treasSigs[0];
            }
        }

        return undefined;
    };

    // Assinaturas que não estão vinculadas a nenhum dos slots cadastrados da igreja
    const matchedSignatures = useMemo(() => {
        const set = new Set<string>();
        churchSigners.forEach(slot => {
            const sig = getSlotSignature(slot);
            if (sig) set.add(sig.id);
        });
        return set;
    }, [churchSigners, signatures]);

    const additionalSignatures = signatures.filter(s => !matchedSignatures.has(s.id));

    const openPadForSlot = (slot: ChurchSignerSlot, sigToReplace?: DigitalSignature) => {
        if (readOnly) return;
        setActiveRole(slot.role);
        setActiveInitialName(sigToReplace?.signerName || slot.name || '');
        setEditingSigId(sigToReplace?.id || null);
        setPadOpen(true);
    };

    const openPadForAdditional = () => {
        if (readOnly) return;
        setActiveRole('Conselho Fiscal 1');
        setActiveInitialName('');
        setEditingSigId(null);
        setPadOpen(true);
    };

    const handleSaveSignature = (newSig: DigitalSignature) => {
        if (editingSigId) {
            onChangeSignatures(signatures.map(s => s.id === editingSigId ? newSig : s));
        } else {
            // Se já existe uma assinatura com o mesmo cargo e mesmo nome, atualiza
            const existingIndex = signatures.findIndex(
                s => s.signerRole.trim().toLowerCase() === newSig.signerRole.trim().toLowerCase() &&
                     s.signerName.trim().toLowerCase() === newSig.signerName.trim().toLowerCase()
            );
            if (existingIndex >= 0) {
                const updated = [...signatures];
                updated[existingIndex] = newSig;
                onChangeSignatures(updated);
            } else {
                onChangeSignatures([...signatures, newSig]);
            }
        }
    };

    const handleRemoveSignature = (sigId: string) => {
        if (readOnly) return;
        onChangeSignatures(signatures.filter(s => s.id !== sigId));
    };

    const toggleSlotRequirement = (slotId: string) => {
        if (readOnly) return;
        setDisabledSlotIds(prev => {
            const next = new Set(prev);
            if (next.has(slotId)) {
                next.delete(slotId);
            } else {
                next.add(slotId);
            }
            return next;
        });
    };

    // Estatísticas de assinaturas
    const activeSlots = churchSigners.filter(s => !disabledSlotIds.has(s.id));
    const signedSlotsCount = activeSlots.filter(s => Boolean(getSlotSignature(s))).length;
    const totalCollected = signatures.length;

    return (
        <div className="space-y-4 pt-1">
            {/* Header da Seção de Assinaturas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-xs">
                        <PenTool className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                Assinaturas Digitais do Fechamento
                            </h4>
                            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2 py-0.5 rounded-full border border-orange-200/50 dark:border-orange-800/40">
                                {church?.name || 'Igreja'}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Pessoas e cargos cadastrados na igreja com controle total de quem assina o fechamento
                        </p>
                    </div>
                </div>

                {!readOnly && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={openPadForAdditional}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors border border-orange-200/60 dark:border-orange-800/60 shadow-2xs cursor-pointer active:scale-95"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar Outro Signatário</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Banner de resumo / controle */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 text-[11px]">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Users className="w-3.5 h-3.5 text-orange-500" />
                    <span className="font-semibold">
                        Cargos Ativos no Cadastro: <strong className="text-slate-900 dark:text-white">{churchSigners.length}</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span>
                        Exigidos neste Mês: <strong className="text-slate-900 dark:text-white">{activeSlots.length}</strong>
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        signedSlotsCount === activeSlots.length && activeSlots.length > 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                    }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {signedSlotsCount} de {activeSlots.length} Assinados ({totalCollected} Total)
                    </span>
                </div>
            </div>

            {/* Grid de Pessoas e Cargos Cadastrados na Igreja */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />
                        Pessoas e Cargos da Igreja (Habilite ou Desabilite quem deve assinar)
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {churchSigners.map((slot) => {
                        const sig = getSlotSignature(slot);
                        const isRequired = !disabledSlotIds.has(slot.id);
                        const isSigned = Boolean(sig);

                        return (
                            <div
                                key={slot.id}
                                className={`rounded-xl border transition-all p-3.5 flex flex-col justify-between min-h-[140px] shadow-2xs ${
                                    !isRequired
                                        ? 'border-slate-200/50 dark:border-slate-800/50 bg-slate-50/40 dark:bg-slate-900/30 opacity-60'
                                        : isSigned
                                            ? 'border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 ring-1 ring-emerald-500/20'
                                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-300 dark:hover:border-orange-900/60'
                                }`}
                            >
                                {/* Topo do Card: Cargo & Toggle de Exigência */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                            <span className={`inline-block text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                                slot.category === 'pastor'
                                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40'
                                                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40'
                                            }`}>
                                                {slot.role}
                                            </span>
                                            {slot.hasRegisteredName ? (
                                                <span className="text-[9px] text-slate-400 font-medium">Cadastrado</span>
                                            ) : (
                                                <span className="text-[9px] text-amber-500 font-medium">A preencher</span>
                                            )}
                                        </div>
                                        <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                            {sig?.signerName || slot.name || (slot.category === 'pastor' ? 'Pastor Responsável' : 'Tesoureiro Responsável')}
                                        </h5>
                                    </div>

                                    {/* Controle de Ativação / Inclusão deste Signatário */}
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => toggleSlotRequirement(slot.id)}
                                            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                                isRequired
                                                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
                                                    : 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                            }`}
                                            title={isRequired ? 'Clique para desabilitar este signatário neste mês' : 'Clique para habilitar este signatário'}
                                        >
                                            {isRequired ? (
                                                <>
                                                    <CheckSquare className="w-3 h-3 text-emerald-600" />
                                                    <span>Exigido</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Square className="w-3 h-3 text-slate-400" />
                                                    <span>Dispensado</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Conteúdo Central do Card */}
                                {!isRequired ? (
                                    <div className="py-3 text-center text-slate-400 dark:text-slate-500">
                                        <p className="text-[11px] font-medium italic">
                                            Signatário dispensado deste fechamento pelo usuário
                                        </p>
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => toggleSlotRequirement(slot.id)}
                                                className="mt-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                                            >
                                                + Reativar assinatura para este cargo
                                            </button>
                                        )}
                                    </div>
                                ) : isSigned && sig ? (
                                    <div className="space-y-2 mt-1">
                                        {/* Visualizador da Assinatura Coletada */}
                                        <div className="h-14 flex items-center justify-center bg-slate-50 dark:bg-slate-800/60 rounded-xl p-1.5 border border-slate-100 dark:border-slate-800">
                                            <img
                                                src={sig.signatureDataUrl}
                                                alt={`Assinatura ${sig.signerRole}`}
                                                className="max-h-full max-w-full object-contain filter contrast-125"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between text-[10px]">
                                            <div className="truncate pr-1">
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                                        Assinado por {sig.signerName}
                                                    </span>
                                                </div>
                                                <p className="text-slate-400 text-[9px] pl-4">
                                                    {new Date(sig.signedAt).toLocaleDateString('pt-BR')} às {new Date(sig.signedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    {sig.signerDocument && ` • Doc: ${sig.signerDocument}`}
                                                </p>
                                            </div>

                                            {!readOnly && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => openPadForSlot(slot, sig)}
                                                        className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                        title="Refazer / Atualizar esta assinatura"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveSignature(sig.id)}
                                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                                        title="Remover assinatura"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-2 space-y-2">
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                                            <AlertCircle className="w-3 h-3" />
                                            <span>Aguardando Assinatura Digital</span>
                                        </div>

                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => openPadForSlot(slot)}
                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-95 transition-all shadow-xs cursor-pointer active:scale-98"
                                            >
                                                <PenTool className="w-3.5 h-3.5" />
                                                <span>Assinar na Tela</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sub-seção: Outros Signatários / Conselho Fiscal (se houver) */}
            {additionalSignatures.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                            Outros Signatários e Conselho Fiscal ({additionalSignatures.length})
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {additionalSignatures.map((sig) => (
                            <div
                                key={sig.id}
                                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-2xs"
                            >
                                <div className="h-12 w-24 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-1 border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0">
                                    <img
                                        src={sig.signatureDataUrl}
                                        alt={sig.signerRole}
                                        className="max-h-full max-w-full object-contain filter contrast-125"
                                    />
                                </div>
                                <div className="min-w-0 flex-1 text-[10px]">
                                    <span className="inline-block font-black text-slate-900 dark:text-white truncate uppercase tracking-wider text-[10px]">
                                        {sig.signerRole}
                                    </span>
                                    <p className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                                        {sig.signerName}
                                    </p>
                                    <p className="text-[9px] text-slate-400">
                                        {new Date(sig.signedAt).toLocaleDateString('pt-BR')} às {new Date(sig.signedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        {sig.signerDocument && ` • Doc: ${sig.signerDocument}`}
                                    </p>
                                </div>
                                {!readOnly && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSignature(sig.id)}
                                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                            title="Remover assinatura adicional"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal para desenhar e confirmar a assinatura na tela */}
            <DigitalSignaturePadModal
                isOpen={padOpen}
                onClose={() => {
                    setPadOpen(false);
                    setEditingSigId(null);
                }}
                onSaveSignature={handleSaveSignature}
                initialRole={activeRole}
                initialName={activeInitialName}
                allowedRoles={allowedRoles}
                registeredPeople={registeredPeopleOptions}
            />
        </div>
    );
};
