
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Calendar, FileText, DollarSign } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency, isPeriodClosed } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { XMarkIcon, SparklesIcon, CheckBadgeIcon, BuildingOfficeIcon, ChevronDownIcon } from '../Icons';
import { Contributor, MatchResult, ReconciliationStatus, MatchMethod } from '../../types';
import { extractNameAndCpf, findSimilarContributors } from '../../utils/contributorHelper';
import { getStoredWhatsAppSettings } from './WhatsAppReceiptModal';

const formatCpfCnpj = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length === 11) {
        return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (clean.length === 14) {
        return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return value;
};

export const ManualIdModal: React.FC = () => {
    const { 
        bulkIdentificationTxs,
        setBulkIdentificationTxs,
        setMatchResults,
        churches,
        confirmBulkManualIdentification,
        closeManualIdentify,
        findMatchResult,
        contributionKeywords,
        paymentMethods,
        contributorFiles,
        matchResults,
        openWhatsAppReceiptModal
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    const { subscription, user } = useAuth();

    const isSecondaryUser = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
        subscription?.role !== 'owner' &&
        subscription?.role !== 'admin' &&
        subscription?.role !== 'principal';
    
    const [selectedChurchId, setSelectedChurchId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>(contributionKeywords?.[0] || 'Dízimo');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('DINHEIRO');
    const [isCustomType, setIsCustomType] = useState(false);
    const [isCustomPaymentMethod, setIsCustomPaymentMethod] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [manualDescription, setManualDescription] = useState<string>('');
    const [manualAmount, setManualAmount] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Auto-busca de contribuintes cadastrados ao digitar
    const [showSuggestions, setShowSuggestions] = useState(false);

    const paymentMethodsOptions = useMemo(() => {
        const list = Array.isArray(paymentMethods) ? [...paymentMethods] : [];
        if (!list.some(m => m.toUpperCase() === 'DINHEIRO')) {
            list.unshift('DINHEIRO');
        } else {
            const idx = list.findIndex(m => m.toUpperCase() === 'DINHEIRO');
            if (idx > 0) {
                const [item] = list.splice(idx, 1);
                list.unshift(item);
            }
        }
        if (!list.some(m => m.toUpperCase() === 'PIX')) {
            list.push('PIX');
        }
        return list;
    }, [paymentMethods]);

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
        if (!manualDescription || manualDescription.trim().length < 1) {
            const seenNames = new Set<string>();
            const matches: any[] = [];
            for (const c of allContributors) {
                const name = c.name || '';
                if (!name) continue;
                const key = `${name.toLowerCase().trim()}_${c._churchId || ''}`;
                if (!seenNames.has(key)) {
                    seenNames.add(key);
                    matches.push(c);
                }
                if (matches.length >= 10) break;
            }
            return matches;
        }
        const query = manualDescription.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const queryDigits = query.replace(/\D/g, '');
        
        const seenNames = new Set<string>();
        const matches: any[] = [];
        
        for (const c of allContributors) {
            const name = c.name || '';
            const normName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            const matchesName = normName.includes(query);
            
            const cpfClean = (c.cpf || '').replace(/\D/g, '');
            const matchesCpf = queryDigits.length > 0 && cpfClean.includes(queryDigits);
            
            if (matchesName || matchesCpf) {
                const key = `${name.toLowerCase().trim()}_${c._churchId || ''}`;
                if (!seenNames.has(key)) {
                    seenNames.add(key);
                    matches.push(c);
                }
            }
            if (matches.length >= 12) break;
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

    const [manualType, setManualType] = useState<'entrada' | 'saida'>('entrada');
    const activeTxId = bulkIdentificationTxs?.[0]?.id;
    const initializedTxIdRef = React.useRef<string | null>(null);

    // --- INICIALIZAR TODOS OS CAMPOS ---
    useEffect(() => {
        if (!bulkIdentificationTxs || bulkIdentificationTxs.length === 0) {
            initializedTxIdRef.current = null;
            return;
        }

        const tx = bulkIdentificationTxs[0];
        const isManual = tx.id?.startsWith('ghost-manual-');

        // Se já foi inicializado para a mesma transação, não sobreescreve escolhas do usuário
        if (initializedTxIdRef.current === activeTxId) return;
        initializedTxIdRef.current = activeTxId || null;

        if (isManual) {
            const matchedResult = findMatchResult ? findMatchResult(tx.id) : null;
            
            // 1. Data/Date
            if (tx.date) {
                setSelectedDate(tx.date);
            } else if (matchedResult?.transaction?.date) {
                setSelectedDate(matchedResult.transaction.date);
            } else {
                setSelectedDate(new Date().toISOString().split('T')[0]);
            }

            // 2. Amount
            if (tx.amount) {
                setManualAmount(Math.abs(tx.amount).toString().replace('.', ','));
            } else {
                setManualAmount('');
            }

            // 3. Description
            const desc = tx.description || '';
            if (desc === 'Lançamento Manual Entrada' || desc === 'Lançamento Manual Saída') {
                setManualDescription('');
            } else {
                setManualDescription(desc);
            }

            // 4. Church ID
            if (matchedResult?.church?.id) {
                setSelectedChurchId(matchedResult.church.id);
            } else if (churches.length === 1) {
                setSelectedChurchId(churches[0].id);
            }

            // 5. Manual Type
            const descLower = (desc || '').toLowerCase();
            const isSaida = descLower.includes('saída') || descLower.includes('saida') || tx.amount < 0;
            const initType: 'entrada' | 'saida' = isSaida ? 'saida' : 'entrada';
            setManualType(initType);

            // 6. Type
            if (matchedResult?.contributionType) {
                setSelectedType(matchedResult.contributionType);
            } else if (initType === 'saida') {
                setSelectedType('Despesa Geral');
            } else {
                setSelectedType(contributionKeywords?.[0] || 'Dízimo');
            }

            // 7. Payment Method
            if (matchedResult?.paymentMethod) {
                setSelectedPaymentMethod(matchedResult.paymentMethod);
            } else {
                setSelectedPaymentMethod('DINHEIRO');
            }
        } else {
            // É transação bancária original.
            const matchedResult = findMatchResult ? findMatchResult(tx.id) : null;
            if (matchedResult && matchedResult.contributor) {
                setManualDescription(matchedResult.contributor.name || matchedResult.contributor.cleanedName || '');
            } else {
                const { name } = extractNameAndCpf(tx.description);
                setManualDescription(name || '');
            }
            setManualAmount('');
        }
    }, [activeTxId, bulkIdentificationTxs, findMatchResult, churches, contributionKeywords]);

    // --- FUNÇÃO PARA ALTERNAR ENTRE ENTRADA E SAÍDA ---
    const handleTypeSwitch = (type: 'entrada' | 'saida') => {
        setManualType(type);
        if (type === 'saida') {
            if (!selectedType || (contributionKeywords && contributionKeywords.includes(selectedType))) {
                setSelectedType('Despesa Geral');
            }
        } else {
            if (!selectedType || selectedType === 'Despesa Geral' || selectedType === 'Fatura / Conta') {
                setSelectedType(contributionKeywords?.[0] || 'Dízimo');
            }
        }
    };

    // --- OPÇÕES DINÂMICAS DE TIPO / CATEGORIA ---
    const typeOptions = useMemo(() => {
        if (manualType === 'saida') {
            return [
                'Despesa Geral',
                'Fatura / Conta',
                'Adiantamento',
                'Fornecedor / Compra',
                'Manutenção',
                'Aluguel',
                'Energia / Água',
                'Folha / Preletor',
                'Outros'
            ];
        }
        const list = Array.isArray(contributionKeywords) ? [...contributionKeywords] : ['Dízimo', 'Oferta'];
        if (!list.includes('Dízimo')) list.unshift('Dízimo');
        if (!list.includes('Oferta')) list.push('Oferta');
        return list;
    }, [manualType, contributionKeywords]);

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
        if (churches.length === 1 && !selectedChurchId) {
            setSelectedChurchId(churches[0].id);
        }
    }, [churches, selectedChurchId]);

    if (!isBulk) return null;
    
    const handleConfirm = async () => {
        if (!selectedChurchId) return;

        const targetDate = selectedDate || (bulkIdentificationTxs && bulkIdentificationTxs[0]?.date) || new Date().toISOString().split('T')[0];
        if (isSecondaryUser && isPeriodClosed(targetDate, matchResults)) {
            alert("Este período já foi fechado de forma definitiva pelo usuário principal. Não é permitido realizar novos lançamentos.");
            return;
        }

        setIsSaving(true);

        try {
            if (isBulk) {
                const ids = bulkIdentificationTxs.map(tx => tx.id);
                const churchObj = churches?.find((c: any) => c.id === selectedChurchId);
                const firstTx = bulkIdentificationTxs[0];
                const contributorName = manualDescription || firstTx?.contributor?.name || firstTx?.description || 'Contribuinte';
                const calculatedTotalAmount = isManualLaunch ? (parseFloat(manualAmount) || 0) : bulkIdentificationTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

                await confirmBulkManualIdentification(
                    ids, 
                    selectedChurchId, 
                    selectedType, 
                    selectedPaymentMethod,
                    selectedDate,
                    manualDescription,
                    manualAmount,
                    selectedAssociationType === 'unify' ? selectedUnifiedField : undefined,
                    isManualLaunch ? manualType : undefined
                );

                const waSettings = getStoredWhatsAppSettings();
                if (waSettings.autoOpenOnReconcile && openWhatsAppReceiptModal) {
                    openWhatsAppReceiptModal({
                        contributorName,
                        amount: calculatedTotalAmount,
                        contributionType: selectedType,
                        churchName: churchObj?.name || 'Igreja',
                        date: selectedDate
                    });
                }
            }
        } catch (error) {
            console.error("[ManualIdModal] Error confirming identification:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const count = bulkIdentificationTxs?.length || 0;
    const totalAmount = bulkIdentificationTxs?.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    if (isManualLaunch) {
        return (
            <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-row flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-brand-blue text-white shadow-lg shadow-blue-500/20">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    Novo Lançamento
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                    Lançamento Manual
                                </p>
                            </div>
                        </div>

                        {/* Selector buttons right in front of the name, matching exact size and style of Cadastros top buttons */}
                        <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-[10px]">
                            <button
                                type="button"
                                onClick={() => handleTypeSwitch('entrada')}
                                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                                    manualType === 'entrada'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                                id="modal-btn-entrada"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                                <span>• Entrada</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTypeSwitch('saida')}
                                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                                    manualType === 'saida'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                                id="modal-btn-saida"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-300"></span>
                                <span>• Saída</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <span className="text-[7px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-800 px-1 rounded">Esc</span>
                        <button type="button" onClick={closeManualIdentify} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Form fields in full width container for elegant layout */}
                <div className="p-8 flex-1 overflow-y-auto w-full">
                    <div className="space-y-6 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        </div>

                        <div className="space-y-3" id="manual-description-container">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    Buscar Contribuinte Cadastrado / Nome
                                </label>
                                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    ⚡ Selecionar preenche a igreja automaticamente
                                </span>
                            </div>
                            <div className="relative group">
                                <FileText className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                <input
                                    type="text"
                                    value={manualDescription}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setManualDescription(val);
                                        setShowSuggestions(true);
                                        
                                        // Se o usuário digitou algo diferente do cadastro unificado selecionado, desfaz unificação automática
                                        if (selectedAssociationType === 'unify') {
                                            const matchedCol = allContributors.find(c => c.id === selectedUnifiedField);
                                            if (matchedCol && matchedCol.name !== val) {
                                                setSelectedAssociationType('create_new');
                                                setSelectedUnifiedField('');
                                            }
                                        }
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    placeholder="Digite o nome ou CPF do contribuinte..."
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 pl-12 pr-10 transition-all outline-none text-sm font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                                {showSuggestions && filteredContributors.length > 0 && (
                                    <div className="absolute left-0 right-0 top-[105%] z-50 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                                        <div className="p-2 border-b border-slate-100 dark:border-white/5 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-4 py-2 flex justify-between items-center">
                                            <span>🔍 Pessoas / Empresas Cadastradas</span>
                                            <span className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400">Preenche a Igreja</span>
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
                                                    setSelectedAssociationType('unify');
                                                    setSelectedUnifiedField(col.id);
                                                    setShowSuggestions(false);
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 text-sm font-semibold transition-colors flex justify-between items-center border-b border-slate-50 dark:border-white/5 last:border-none cursor-pointer"
                                            >
                                                <div className="flex flex-col min-w-0 pr-2">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{col.name}</span>
                                                    {col.cpf && (
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                                            {col.cpf.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'}: {formatCpfCnpj(col.cpf)}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50 shrink-0 max-w-[170px] truncate">
                                                    🏛️ {col._churchName}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Feedback de Vínculo Automático */}
                            {selectedAssociationType === 'unify' && selectedUnifiedField && (
                                <div className="flex items-center justify-between gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <CheckBadgeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        <span className="truncate">
                                            Contribuinte vinculado: <strong className="font-extrabold">{manualDescription}</strong>
                                            {churches.find(c => c.id === selectedChurchId) && (
                                                <span className="ml-1 text-[11px] font-medium opacity-90">
                                                    • Igreja: <strong className="font-bold">{churches.find(c => c.id === selectedChurchId)?.name}</strong>
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedAssociationType('create_new');
                                            setSelectedUnifiedField('');
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white underline cursor-pointer shrink-0"
                                    >
                                        Desvincular
                                    </button>
                                </div>
                            )}
                        </div>

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
                                                const churchName = m.church?.name || 'Igreja Desconhecida';
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
                            <div className="flex items-center justify-between flex-wrap gap-1">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    Escolha a Igreja de Destino
                                </label>
                                {selectedAssociationType === 'unify' && selectedChurchId && (
                                    <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                        ✓ Auto-preenchida pelo contribuinte
                                    </span>
                                )}
                            </div>
                            <div className="relative group">
                                <BuildingOfficeIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                <select
                                    value={selectedChurchId}
                                    onChange={e => setSelectedChurchId(e.target.value)}
                                    className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 pl-12 pr-10 transition-all outline-none text-sm font-bold appearance-none cursor-pointer"
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                    Tipo
                                </label>
                                {isCustomType ? (
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={selectedType}
                                            onChange={e => setSelectedType(e.target.value)}
                                            placeholder="Digite o tipo (ex: Dízimo, Oferta)"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCustomType(false);
                                                setSelectedType(contributionKeywords?.[0] || 'Dízimo');
                                            }}
                                            className="py-4 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-2xl text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                        >
                                            Lista
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <select
                                            value={selectedType}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '__CUSTOM__') {
                                                    setIsCustomType(true);
                                                    setSelectedType('');
                                                } else {
                                                    setSelectedType(val);
                                                }
                                            }}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold appearance-none cursor-pointer"
                                        >
                                            {typeOptions.map((type: string) => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                            <option value="__CUSTOM__">✍️ Outro (Digitar manual...)</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                        Forma de Pagamento
                                    </label>
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/50 dark:border-amber-800/50">
                                        💵 Padrão Dinheiro (Lançamento Manual)
                                    </span>
                                </div>
                                {isCustomPaymentMethod ? (
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={selectedPaymentMethod}
                                            onChange={e => setSelectedPaymentMethod(e.target.value.toUpperCase())}
                                            placeholder="Digite a forma (ex: DINHEIRO, PIX)"
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCustomPaymentMethod(false);
                                                setSelectedPaymentMethod('DINHEIRO');
                                            }}
                                            className="py-4 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-2xl text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                        >
                                            Lista
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <select
                                            value={selectedPaymentMethod}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '__CUSTOM__') {
                                                    setIsCustomPaymentMethod(true);
                                                    setSelectedPaymentMethod('');
                                                } else {
                                                    setSelectedPaymentMethod(val);
                                                }
                                            }}
                                            className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold appearance-none cursor-pointer"
                                        >
                                            {paymentMethodsOptions.map((method: string) => (
                                                <option key={method} value={method}>{method}</option>
                                            ))}
                                            <option value="__CUSTOM__">✍️ Outro (Digitar manual...)</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={closeManualIdentify} 
                        className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleConfirm} 
                        disabled={!selectedChurchId || isSaving} 
                        className="px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                    >
                         {isSaving ? 'Processando...' : 'Salvar Lançamento'}
                         {!isSaving && selectedChurchId && <span className="ml-1 text-[8px] opacity-70 bg-white/20 px-1 rounded">Enter</span>}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-overlay animate-fade-in">
            <div className="glass-modal animate-scale-in">
                
                <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isManualLaunch ? 'bg-brand-blue text-white shadow-lg shadow-blue-500/20' : isBulk ? 'bg-blue-600 text-white shadow-lg' : 'bg-brand-blue text-white shadow-lg shadow-blue-500/20'}`}>
                            {isManualLaunch ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> : isBulk ? <CheckBadgeIcon className="w-6 h-6" /> : <BuildingOfficeIcon className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                {isManualLaunch ? 'Novo Lançamento' : isBulk ? 'Destinar Lote' : 'Escolher Destino'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                {isManualLaunch ? 'Lançamento Manual' : 'Identificação Pendente'}
                            </p>
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
                    {isManualLaunch ? (
                        /* Selector buttons matching exact size and style of Cadastros top buttons */
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => handleTypeSwitch('entrada')}
                                className={`relative flex-shrink-0 flex items-center gap-2 px-5 py-2 rounded-xl transition-all duration-300 text-[10px] font-bold uppercase tracking-wide cursor-pointer ${
                                    manualType === 'entrada'
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 transform scale-105 z-10 border-transparent'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                }`}
                                id="modal-btn-entrada"
                            >
                                <svg className={`w-3.5 h-3.5 ${manualType === 'entrada' ? 'text-white' : 'text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                </svg>
                                <span>Entrada</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTypeSwitch('saida')}
                                className={`relative flex-shrink-0 flex items-center gap-2 px-5 py-2 rounded-xl transition-all duration-300 text-[10px] font-bold uppercase tracking-wide cursor-pointer ${
                                    manualType === 'saida'
                                        ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/30 transform scale-105 z-10 border-transparent'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                }`}
                                id="modal-btn-saida"
                            >
                                <svg className={`w-3.5 h-3.5 ${manualType === 'saida' ? 'text-white' : 'text-rose-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                                <span>Saída</span>
                            </button>
                        </div>
                    ) : (
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
                    )}

                    {count === 1 && !isManualLaunch && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-black/25 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    Dados Recebidos do Banco
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Descrição</span>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase break-all block">
                                            {bulkIdentificationTxs[0].description}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Valor</span>
                                        <span className={`text-xs font-black font-mono block ${bulkIdentificationTxs[0].amount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {formatCurrency(bulkIdentificationTxs[0].amount, language)}
                                        </span>
                                    </div>
                                </div>
                                {/* Mostrar destinação atual se já estiver identificado */}
                                {(() => {
                                    const matchedResult = findMatchResult ? findMatchResult(bulkIdentificationTxs[0].id) : null;
                                    if (matchedResult && matchedResult.contributor) {
                                        return (
                                            <div className="pt-2 border-t border-slate-200/50 dark:border-white/5 flex flex-col gap-1">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-wider">
                                                    Lançamento Atual (Pode Corrigir abaixo)
                                                </span>
                                                <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    <span className="uppercase">{matchedResult.contributor.name}</span>
                                                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded uppercase">
                                                        {matchedResult.church?.name || '---'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            <div className="space-y-3" id="manual-description-container">
                                <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.25em] ml-1">
                                    Identificar Verdadeiro Contribuinte
                                </label>
                                <div className="relative group">
                                    <FileText className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                                    <input
                                        type="text"
                                        value={manualDescription}
                                        onChange={e => {
                                            setManualDescription(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        placeholder="Digite o nome do verdadeiro contribuinte"
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-indigo-500/10 py-4 pl-12 pr-10 transition-all outline-none text-sm font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600"
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
                                                        setSelectedAssociationType('unify');
                                                        setSelectedUnifiedField(col.id);
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
                                <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                    Se o PIX recebido está no nome de um terceiro, altere ou selecione o nome do verdadeiro contribuinte acima. Ambos os registros serão mantidos.
                                </p>
                            </div>
                        </div>
                    )}

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
                                            const churchName = m.church?.name || 'Igreja Desconhecida';
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
                            {isCustomType ? (
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={selectedType}
                                        onChange={e => setSelectedType(e.target.value)}
                                        placeholder="Digite o tipo (ex: Dízimo, Oferta)"
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCustomType(false);
                                            setSelectedType(contributionKeywords?.[0] || 'Dízimo');
                                        }}
                                        className="py-4 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-2xl text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                    >
                                        Lista
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={selectedType}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '__CUSTOM__') {
                                                setIsCustomType(true);
                                                setSelectedType('');
                                            } else {
                                                setSelectedType(val);
                                            }
                                        }}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold appearance-none"
                                    >
                                        {typeOptions.map((type: string) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                        <option value="__CUSTOM__">✍️ Outro (Digitar manual...)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ChevronDownIcon className="w-4 h-4" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] ml-1">
                                Forma
                            </label>
                            {isCustomPaymentMethod ? (
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={selectedPaymentMethod}
                                        onChange={e => setSelectedPaymentMethod(e.target.value.toUpperCase())}
                                        placeholder="Digite a forma (ex: PIX, DINHEIRO)"
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCustomPaymentMethod(false);
                                            setSelectedPaymentMethod(paymentMethods?.[0] || 'Transferência');
                                        }}
                                        className="py-4 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-2xl text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                    >
                                        Lista
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={selectedPaymentMethod}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '__CUSTOM__') {
                                                setIsCustomPaymentMethod(true);
                                                setSelectedPaymentMethod('');
                                            } else {
                                                setSelectedPaymentMethod(val);
                                            }
                                        }}
                                        className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-4 focus:ring-brand-blue/10 py-4 px-4 transition-all outline-none text-sm font-bold appearance-none"
                                    >
                                        {paymentMethods.map((method: string) => (
                                            <option key={method} value={method}>{method}</option>
                                        ))}
                                        <option value="__CUSTOM__">✍️ Outro (Digitar manual...)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ChevronDownIcon className="w-4 h-4" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 rounded-b-[2.5rem]">
                    <button 
                        type="button" 
                        onClick={closeManualIdentify} 
                        className="px-6 py-2.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-2xl shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleConfirm} 
                        disabled={!selectedChurchId || isSaving} 
                        className="px-8 py-2.5 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-2xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                    >
                         {isSaving ? 'Processando...' : isManualLaunch ? 'Salvar Lançamento' : 'Confirmar Lote'}
                         {!isSaving && selectedChurchId && <span className="ml-1 text-[8px] opacity-70 bg-white/20 px-1 rounded">Enter</span>}
                    </button>
                </div>
            </div>
        </div>
    );
};
