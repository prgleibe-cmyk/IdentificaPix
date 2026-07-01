
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Calendar, FileText, DollarSign } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { XMarkIcon, SparklesIcon, CheckBadgeIcon, BuildingOfficeIcon, ChevronDownIcon } from '../Icons';
import { Contributor, MatchResult, ReconciliationStatus, MatchMethod } from '../../types';
import { extractNameAndCpf, findSimilarContributors } from '../../utils/contributorHelper';

export const ManualIdModal: React.FC = () => {
    const { 
        bulkIdentificationTxs,
        churches,
        confirmBulkManualIdentification,
        closeManualIdentify,
        findMatchResult,
        contributionKeywords,
        paymentMethods,
        contributorFiles
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    
    const [selectedChurchId, setSelectedChurchId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>(contributionKeywords?.[0] || 'Dízimo');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(paymentMethods?.[0] || 'Transferência');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [manualDescription, setManualDescription] = useState<string>('');
    const [manualAmount, setManualAmount] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Auto-busca de contribuintes cadastrados ao digitar
    const [showSuggestions, setShowSuggestions] = useState(false);

    const allContributors = useMemo(() => {
        if (!contributorFiles) return [];
        return contributorFiles.flatMap(file => {
            const church = churches.find((c: any) => c.id === file.churchId);
            return file.contributors?.map(c => ({
                ...c, _churchName: church?.name || 'Desconhecida', _churchId: church?.id
            })) || [];
        });
    }, [contributorFiles, churches]);

    const filteredContributors = useMemo(() => {
        if (!manualDescription || manualDescription.trim().length < 2) return [];
        const query = manualDescription.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const seenNames = new Set<string>();
        const matches: any[] = [];
        
        for (const c of allContributors) {
            const name = c.name || '';
            const normName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (normName.includes(query)) {
                const key = `${name.toLowerCase().trim()}_${c._churchId || ''}`;
                if (!seenNames.has(key)) {
                    seenNames.add(key);
                    matches.push(c);
                }
            }
            if (matches.length >= 5) break;
        }
        return matches;
    }, [manualDescription, allContributors]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('#manual-description-container')) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Estados para unificação e similaridade
    const [similarMatches, setSimilarMatches] = useState<any[]>([]);
    const [selectedAssociationType, setSelectedAssociationType] = useState<'create_new' | 'unify'>('create_new');
    const [selectedUnifiedField, setSelectedUnifiedField] = useState<string>('');

    const isBulk = !!bulkIdentificationTxs && bulkIdentificationTxs.length > 0;
    const isManualLaunch = bulkIdentificationTxs?.some(tx => tx.id.startsWith('ghost-manual-'));

    // --- ANALISAR SIMILARIDADE DO LOTE AO DETECTAR ALTERAÇÕES ---
    useEffect(() => {
        if (bulkIdentificationTxs && bulkIdentificationTxs.length > 0 && contributorFiles && contributorFiles.length > 0) {
            const firstTx = bulkIdentificationTxs[0];
            const { name, cpf } = extractNameAndCpf(firstTx.description);
            if (name) {
                // Procurar contribuintes semelhantes nas igrejas cadastradas com pontuação de corte (40%)
                const matches = findSimilarContributors(name, cpf, contributorFiles, 40);
                setSimilarMatches(matches);
                if (matches.length > 0) {
                    // Se houver um match muito forte (ex: CPF idêntico ou similaridade > 80%), auto-seleciona "unificar"
                    const best = matches[0];
                    if (best.score >= 80) {
                        setSelectedAssociationType('unify');
                        setSelectedUnifiedField(best.contributor.id);
                        const chId = best.contributor._churchId || best.contributor.church_id || best.church?.id;
                        if (chId) {
                            setSelectedChurchId(chId);
                        }
                    } else {
                        setSelectedAssociationType('create_new');
                        setSelectedUnifiedField('');
                    }
                } else {
                    setSelectedAssociationType('create_new');
                    setSelectedUnifiedField('');
                }
            }
        } else {
            setSimilarMatches([]);
            setSelectedAssociationType('create_new');
            setSelectedUnifiedField('');
        }
    }, [bulkIdentificationTxs, contributorFiles]);

    // --- ATALHOS DE TECLADO ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeManualIdentify();
            if (e.key === 'Enter' && selectedChurchId && !isSaving) handleConfirm();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeManualIdentify, selectedChurchId, isSaving]);

    useEffect(() => {
        if (churches.length === 1) {
            setSelectedChurchId(churches[0].id);
        } else if (selectedAssociationType !== 'unify') {
            setSelectedChurchId('');
        }
    }, [churches, isBulk, selectedAssociationType]);

    if (!isBulk) return null;
    
    const handleConfirm = async () => {
        if (!selectedChurchId) return;
        setIsSaving(true);

        try {
            if (isBulk) {
                const ids = bulkIdentificationTxs.map(tx => tx.id);
                await confirmBulkManualIdentification(
                    ids, 
                    selectedChurchId, 
                    selectedType, 
                    selectedPaymentMethod,
                    selectedDate,
                    manualDescription,
                    manualAmount,
                    selectedAssociationType === 'unify' ? selectedUnifiedField : undefined
                );
            }
        } catch (error) {
            console.error("[ManualIdModal] Error confirming identification:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const count = bulkIdentificationTxs?.length || 0;
    const totalAmount = bulkIdentificationTxs?.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal w-full max-w-lg flex flex-col max-h-[90vh] md:max-h-[85vh] animate-scale-in rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-white/10 bg-white dark:bg-[#0F172A]">
                
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isBulk ? 'bg-blue-600 text-white shadow-lg' : 'bg-brand-blue text-white shadow-lg shadow-blue-500/20'}`}>
                            {isBulk ? <CheckBadgeIcon className="w-6 h-6" /> : <BuildingOfficeIcon className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                {isBulk ? 'Destinar Lote' : 'Escolher Destino'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Identificação Pendente</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[7px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-800 px-1 rounded">Esc</span>
                        <button type="button" onClick={closeManualIdentify} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-8 flex-1 overflow-y-auto w-full">
                    <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Registros Selecionados</span>
                                <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{count} <span className="text-xs font-medium text-slate-400">ítens</span></span>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block mb-1">Montante do Lote</span>
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(totalAmount, language)}</span>
                            </div>
                        </div>
                    </div>

                    {isManualLaunch && (
                        <>
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    Data
                                </label>
                                <div className="relative group">
                                    <Calendar className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 pl-12 pr-10 transition-all outline-none text-sm font-bold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3" id="manual-description-container">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    Nome / Descrição
                                </label>
                                <div className="relative group">
                                    <FileText className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                    <input
                                        type="text"
                                        value={manualDescription}
                                        onChange={e => {
                                            setManualDescription(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        placeholder="Ex: Doação / Oferta Especial"
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 pl-12 pr-10 transition-all outline-none text-sm font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    />
                                    {showSuggestions && filteredContributors.length > 0 && (
                                        <div className="absolute left-0 right-0 top-[105%] z-50 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                                            <div className="p-2 border-b border-slate-100 dark:border-white/5 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-4 py-2">
                                                Contribuintes VPS Cadastrados
                                            </div>
                                            {filteredContributors.map((col, cIdx) => (
                                                <button
                                                    key={col.id || cIdx}
                                                    type="button"
                                                    onClick={() => {
                                                        setManualDescription(col.name);
                                                        if (col._churchId) {
                                                            setSelectedChurchId(col._churchId);
                                                        }
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 text-sm font-semibold transition-colors flex justify-between items-center border-b border-slate-50 dark:border-white/5 last:border-none"
                                                >
                                                    <span className="truncate">{col.name}</span>
                                                    <span className="text-[9px] font-black bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md truncate max-w-[150px]">
                                                        {col._churchName}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    Valor (R$)
                                </label>
                                <div className="relative group">
                                    <DollarSign className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                    <input
                                        type="text"
                                        value={manualAmount}
                                        onChange={e => setManualAmount(e.target.value)}
                                        placeholder="0,00"
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 pl-12 pr-10 transition-all outline-none text-sm font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* SELEÇÃO DE ANÁLISE DE SIMILARIDADE E UNIFICAÇÃO DE CONTRIBUINTES */}
                    {similarMatches.length > 0 && (
                        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-6 rounded-[2.25rem] space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600">
                                    <SparklesIcon className="w-4 h-4" />
                                </div>
                                <h4 className="text-xs font-black text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                                    {similarMatches[0].score >= 80 ? '🎯 Contribuinte Correspondente Encontrado' : '⚡ Semelhança Possível Detectada'}
                                </h4>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                                Identificamos contribuintes similares cadastrados na VPS. Quer unificar com um existente ou cadastrar como NOVO?
                            </p>

                            <div className="grid grid-cols-2 gap-2 bg-slate-100/50 dark:bg-black/30 p-1 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedAssociationType('create_new');
                                        if (churches.length !== 1) {
                                            setSelectedChurchId('');
                                        } else {
                                            setSelectedChurchId(churches[0].id);
                                        }
                                    }}
                                    className={`py-2 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                                        selectedAssociationType === 'create_new'
                                            ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Cadastrar Novo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedAssociationType('unify');
                                        if (similarMatches.length > 0) {
                                            const match = similarMatches[0];
                                            setSelectedUnifiedField(match.contributor.id);
                                            const chId = match.contributor._churchId || match.contributor.church_id || match.church?.id;
                                            if (chId) setSelectedChurchId(chId);
                                        }
                                    }}
                                    className={`py-2 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                                        selectedAssociationType === 'unify'
                                            ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Unificar Cadastro
                                </button>
                            </div>

                            {selectedAssociationType === 'unify' && (
                                <div className="space-y-3 pt-2">
                                    <label className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                        Selecione o Contribuinte VPS Correspondente:
                                    </label>
                                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                                        {similarMatches.map((m, idx) => {
                                            const chId = m.contributor._churchId || m.contributor.church_id || m.church?.id;
                                            const churchName = m.church?.name || 'Igreja Vinculada';
                                            const isSelected = selectedUnifiedField === m.contributor.id;
                                            
                                            return (
                                                <div
                                                    key={m.contributor.id || idx}
                                                    onClick={() => {
                                                        setSelectedUnifiedField(m.contributor.id);
                                                        if (chId) setSelectedChurchId(chId);
                                                    }}
                                                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'border-blue-500/85 bg-blue-100/30 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                                                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-black uppercase tracking-tight">{m.contributor.name || m.contributor.canonical_name}</span>
                                                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 uppercase">
                                                            Score: {m.score}%
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 text-[9px] text-slate-400 font-semibold mt-1 uppercase">
                                                        <span>Igreja: {churchName}</span>
                                                        {m.contributor.cpf && (
                                                            <>
                                                                <span>•</span>
                                                                <span>CPF: {m.contributor.cpf}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                           Escolha a Igreja de Destino
                        </label>
                        <div className="relative group">
                            <BuildingOfficeIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                            <select
                                value={selectedChurchId}
                                onChange={e => setSelectedChurchId(e.target.value)}
                                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 pl-12 pr-10 transition-all outline-none text-sm font-bold appearance-none"
                            >
                                <option value="">-- Clique para ver as igrejas --</option>
                                {churches.map(church => (
                                    <option key={church.id} value={church.id}>
                                        {church.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDownIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                Tipo
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedType}
                                    onChange={e => setSelectedType(e.target.value)}
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold appearance-none"
                                >
                                    {contributionKeywords.map((type: string) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                Forma
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedPaymentMethod}
                                    onChange={e => setSelectedPaymentMethod(e.target.value)}
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold appearance-none"
                                >
                                    {paymentMethods.map((method: string) => (
                                        <option key={method} value={method}>{method}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 rounded-b-[2.5rem]">
                    <button 
                        type="button" 
                        onClick={closeManualIdentify} 
                        className="px-6 py-3 text-[10px] font-black rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all uppercase tracking-widest"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleConfirm} 
                        disabled={!selectedChurchId || isSaving} 
                        className="px-10 py-3 text-[10px] font-black text-white rounded-full shadow-xl shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest bg-gradient-to-l from-[#051024] to-[#0033AA] hover:from-[#020610] hover:to-[#002288] flex items-center gap-2"
                    >
                         {isSaving ? 'Processando...' : 'Confirmar Lote'}
                         {!isSaving && selectedChurchId && <span className="ml-1 text-[8px] opacity-70 bg-white/20 px-1 rounded">Enter</span>}
                    </button>
                </div>
            </div>
        </div>
    );
};
