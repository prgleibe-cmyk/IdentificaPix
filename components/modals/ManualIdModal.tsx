
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Calendar, FileText, DollarSign } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import { useUI } from '../../contexts/UIContext';
import { useTranslation } from '../../contexts/I18nContext';
import { formatCurrency, isPeriodClosed } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { XMarkIcon, SparklesIcon, CheckBadgeIcon, BuildingOfficeIcon, ChevronDownIcon } from '../Icons';
import { Contributor, MatchResult, ReconciliationStatus, MatchMethod } from '../../types';
import { extractNameAndCpf, findSimilarContributors } from '../../utils/contributorHelper';
import { getStoredWhatsAppSettings } from './WhatsAppReceiptModal';
import { getCachedContributors } from '../../services/contributorsCache';

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
        banks,
        confirmBulkManualIdentification,
        closeManualIdentify,
        findMatchResult,
        contributionTypes,
        contributionKeywords,
        paymentMethods,
        contributorFiles,
        matchResults,
        openWhatsAppReceiptModal
    } = useContext(AppContext);
    const { t, language } = useTranslation();
    const { setActiveView } = useUI();
    const { subscription, user } = useAuth();

    const isSecondaryUser = (subscription?.ownerId && subscription.ownerId !== user?.id) &&
        subscription?.role !== 'owner' &&
        subscription?.role !== 'admin' &&
        subscription?.role !== 'principal';
    
    const [selectedChurchId, setSelectedChurchId] = useState<string>('');
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>(contributionKeywords?.[0] || 'Dízimo');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(() => {
        const isManual = bulkIdentificationTxs?.some(tx => tx.id.startsWith('ghost-manual-'));
        return isManual ? 'DINHEIRO' : 'PIX';
    });
    const [isCustomType, setIsCustomType] = useState(false);
    const [isCustomPaymentMethod, setIsCustomPaymentMethod] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [manualDescription, setManualDescription] = useState<string>('');
    const [manualAmount, setManualAmount] = useState<string>('');
    const [manualType, setManualType] = useState<'entrada' | 'saida' | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawDigits = e.target.value.replace(/\D/g, '');
        if (!rawDigits || parseInt(rawDigits, 10) === 0) {
            setManualAmount('');
            return;
        }
        const truncated = rawDigits.slice(0, 11);
        const numericValue = parseInt(truncated, 10) / 100;
        const formatted = numericValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        setManualAmount(formatted);
    };

    // Auto-busca de contribuintes cadastrados ao digitar
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [dbContributors, setDbContributors] = useState<any[]>([]);

    useEffect(() => {
        let isMounted = true;
        getCachedContributors().then(list => {
            if (isMounted && Array.isArray(list)) {
                setDbContributors(list);
            }
        }).catch(err => {
            console.error('[ManualIdModal] Erro ao carregar contribuintes do banco:', err);
        });
        return () => { isMounted = false; };
    }, []);

    const allowedBankIds = useMemo(() => {
        if (!isSecondaryUser) return null;
        return subscription?.bankIds || [];
    }, [isSecondaryUser, subscription?.bankIds]);

    const availableBanks = useMemo(() => {
        const raw = banks || [];
        if (!isSecondaryUser || !allowedBankIds || allowedBankIds.length === 0) return raw;
        return raw.filter((b: any) => allowedBankIds.includes(b.id));
    }, [banks, isSecondaryUser, allowedBankIds]);

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

    // --- OPÇÕES DINÂMICAS DE DESCRIÇÃO / CATEGORIA (CADASTRADAS NO SISTEMA) ---
    const defaultEntradaType = useMemo(() => {
        const active = (contributionTypes || []).find((ct: any) => (ct.type === 'entrada' || !ct.type) && ct.is_active !== false);
        return active?.name || contributionKeywords?.[0] || 'Dízimo';
    }, [contributionTypes, contributionKeywords]);

    const defaultSaidaType = useMemo(() => {
        const active = (contributionTypes || []).find((ct: any) => ct.type === 'saida' && ct.is_active !== false);
        return active?.name || 'Despesa Geral';
    }, [contributionTypes]);

    const typeOptions = useMemo(() => {
        if (manualType === 'saida') {
            const registeredSaidas = (contributionTypes || [])
                .filter((ct: any) => ct.type === 'saida' && ct.is_active !== false)
                .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || (a.name || '').localeCompare(b.name || ''))
                .map((ct: any) => ct.name)
                .filter(Boolean);

            if (registeredSaidas.length > 0) {
                return registeredSaidas;
            }

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

        const registeredEntradas = (contributionTypes || [])
            .filter((ct: any) => (ct.type === 'entrada' || !ct.type) && ct.is_active !== false)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || (a.name || '').localeCompare(b.name || ''))
            .map((ct: any) => ct.name)
            .filter(Boolean);

        if (registeredEntradas.length > 0) {
            return registeredEntradas;
        }

        const list = Array.isArray(contributionKeywords) && contributionKeywords.length > 0 
            ? [...contributionKeywords] 
            : ['Dízimo', 'Oferta'];
        if (!list.includes('Dízimo')) list.unshift('Dízimo');
        if (!list.includes('Oferta')) list.push('Oferta');
        return list;
    }, [manualType, contributionTypes, contributionKeywords]);

    // --- FUNÇÃO PARA ALTERNAR ENTRE ENTRADA E SAÍDA ---
    const handleTypeSwitch = (type: 'entrada' | 'saida') => {
        setManualType(type);
        if (type === 'saida') {
            setSelectedType(defaultSaidaType);
        } else {
            setSelectedType(defaultEntradaType);
        }
    };

    const allContributors = useMemo(() => {
        const map = new Map<string, any>();
        const churchMap = new Map<string, any>();
        (churches || []).forEach((ch: any) => {
            if (ch?.id) churchMap.set(ch.id, ch);
        });

        // 1. Cadastros persistidos no banco de dados VPS (Geral)
        if (Array.isArray(dbContributors)) {
            dbContributors.forEach(c => {
                if (c.status === 'inactive') return;
                const churchId = c.church_id || c._churchId;
                const ch = churchId ? churchMap.get(churchId) : null;
                const displayName = c.canonical_name || c.name || c.trade_name || c.cleanedName || '';
                if (!displayName) return;

                const item = {
                    ...c,
                    id: c.id,
                    name: displayName,
                    canonical_name: c.canonical_name || displayName,
                    cleanedName: c.cleanedName || displayName,
                    trade_name: c.trade_name || '',
                    cpf: c.cpf || '',
                    phone: c.phone || '',
                    email: c.email || '',
                    _churchId: churchId || '',
                    _churchName: ch?.name || (c.is_global ? 'Todas as Congregações' : 'Geral')
                };
                map.set(c.id, item);
            });
        }

        // 2. Mescla com contributorFiles locais da sessão caso existam
        if (Array.isArray(contributorFiles)) {
            contributorFiles.forEach(file => {
                const church = churches.find((c: any) => c.id === file.churchId);
                file.contributors?.forEach((c: any) => {
                    const churchId = c._churchId || file.churchId;
                    const ch = churchId ? churchMap.get(churchId) : church;
                    const displayName = c.name || c.canonical_name || c.cleanedName || '';
                    if (!displayName) return;

                    const idKey = c.id || `${displayName.toLowerCase().trim()}_${churchId || ''}`;
                    if (!map.has(idKey)) {
                        map.set(idKey, {
                            ...c,
                            id: c.id || idKey,
                            name: displayName,
                            canonical_name: c.canonical_name || displayName,
                            cleanedName: c.cleanedName || displayName,
                            _churchName: ch?.name || 'Desconhecida',
                            _churchId: churchId
                        });
                    }
                });
            });
        }

        return Array.from(map.values());
    }, [dbContributors, contributorFiles, churches]);

    const filteredContributors = useMemo(() => {
        if (!manualDescription || manualDescription.trim().length < 1) {
            return allContributors.slice(0, 15);
        }
        const rawQuery = manualDescription.trim();
        const queryNorm = rawQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const queryDigits = rawQuery.replace(/\D/g, '');
        const queryTokens = queryNorm.split(/\s+/).filter(Boolean);

        const seenKeys = new Set<string>();
        const matches: any[] = [];

        for (const c of allContributors) {
            const name = c.name || c.canonical_name || c.cleanedName || '';
            const normName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const normTrade = (c.trade_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const normEmail = (c.email || '').toLowerCase();
            const cpfClean = (c.cpf || '').replace(/\D/g, '');
            const phoneClean = (c.phone || '').replace(/\D/g, '');

            // 1. Correspondência por tokens/palavras do nome, razão social ou email
            const matchesTokens = queryTokens.length > 0 && queryTokens.every(tok => 
                normName.includes(tok) || normTrade.includes(tok) || normEmail.includes(tok)
            );

            // 2. Correspondência por CPF/CNPJ ou telefone
            const matchesCpf = queryDigits.length >= 3 && cpfClean.includes(queryDigits);
            const matchesPhone = queryDigits.length >= 4 && phoneClean.includes(queryDigits);

            if (matchesTokens || matchesCpf || matchesPhone) {
                const uniqueKey = c.id || `${name.toLowerCase().trim()}_${c._churchId || ''}`;
                if (!seenKeys.has(uniqueKey)) {
                    seenKeys.add(uniqueKey);
                    matches.push(c);
                }
            }

            if (matches.length >= 30) break;
        }

        matches.sort((a, b) => {
            const aName = (a.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const bName = (b.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const aStarts = aName.startsWith(queryNorm);
            const bStarts = bName.startsWith(queryNorm);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return aName.localeCompare(bName);
        });

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
            const { name: name1, cpf: cpf1 } = extractNameAndCpf(firstTx.description || '');
            const { name: name2, cpf: cpf2 } = extractNameAndCpf(firstTx.rawDescription || '');
            const targetCpf = cpf1 || cpf2;
            const targetName = name1 || name2;
            if (targetName || targetCpf) {
                // Procurar contribuintes semelhantes nas igrejas cadastradas com pontuação de corte (40%)
                const matches = findSimilarContributors(targetName, targetCpf, contributorFiles, 40);
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
                const num = Math.abs(tx.amount);
                setManualAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            } else {
                setManualAmount('');
            }

            // 3. Description
            const desc = tx.description || '';
            if (desc === 'Lançamento Manual Entrada' || desc === 'Lançamento Manual Saída' || desc === 'Lançamento Manual') {
                setManualDescription('');
            } else {
                setManualDescription(desc);
            }

            // 4. Church ID & Bank ID
            if (matchedResult?.church?.id) {
                setSelectedChurchId(matchedResult.church.id);
            } else if (churches.length === 1) {
                setSelectedChurchId(churches[0].id);
            }

            if (tx.bank_id) {
                setSelectedBankId(tx.bank_id);
            } else if (matchedResult?.transaction?.bank_id) {
                setSelectedBankId(matchedResult.transaction.bank_id);
            } else if (availableBanks.length === 1) {
                setSelectedBankId(availableBanks[0].id);
            }

            // 5. Manual Type (Se não foi explicitamente marcado, exige seleção do usuário)
            const descLower = (desc || '').toLowerCase();
            const isExplicitSaida = descLower.includes('saída') || descLower.includes('saida') || tx.amount < 0;
            const isExplicitEntrada = (descLower.includes('entrada') && desc !== 'Lançamento Manual Entrada') || (tx.amount > 0 && desc !== 'Lançamento Manual');
            
            if (isExplicitSaida) {
                setManualType('saida');
                setSelectedType(matchedResult?.contributionType || defaultSaidaType);
            } else if (isExplicitEntrada) {
                setManualType('entrada');
                setSelectedType(matchedResult?.contributionType || defaultEntradaType);
            } else {
                setManualType(null);
                setSelectedType('');
            }

            // 7. Payment Method
            if (matchedResult?.paymentMethod) {
                setSelectedPaymentMethod(matchedResult.paymentMethod);
            } else {
                setSelectedPaymentMethod('DINHEIRO');
            }
        } else {
            // É transação bancária original (selecionada do relatório/extrato para identificação).
            const matchedResult = findMatchResult ? findMatchResult(tx.id) : null;
            if (matchedResult && matchedResult.contributor) {
                setManualDescription(matchedResult.contributor.name || matchedResult.contributor.cleanedName || '');
            } else {
                const { name } = extractNameAndCpf(tx.description);
                setManualDescription(name || '');
            }
            setManualAmount('');

            // 7. Payment Method (Padrão PIX para transações do relatório)
            if (matchedResult?.paymentMethod) {
                setSelectedPaymentMethod(matchedResult.paymentMethod);
            } else {
                setSelectedPaymentMethod('PIX');
            }

            if (matchedResult?.contributionType) {
                setSelectedType(matchedResult.contributionType);
            } else {
                setSelectedType(defaultEntradaType);
            }

            // Inicializa a data de referência com a data da transação ou a reference_date existente
            const initialDate = matchedResult?.reference_date || tx.reference_date || tx.date || new Date().toISOString().split('T')[0];
            setSelectedDate(initialDate);

            if (matchedResult?.church?.id) {
                setSelectedChurchId(matchedResult.church.id);
            } else if (churches.length === 1) {
                setSelectedChurchId(churches[0].id);
            }

            if (tx.bank_id) {
                setSelectedBankId(tx.bank_id);
            } else if (matchedResult?.transaction?.bank_id) {
                setSelectedBankId(matchedResult.transaction.bank_id);
            } else if (availableBanks.length === 1) {
                setSelectedBankId(availableBanks[0].id);
            }
        }
    }, [activeTxId, bulkIdentificationTxs, findMatchResult, churches, defaultEntradaType, defaultSaidaType, availableBanks]);

    // --- ATALHOS DE TECLADO ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeManualIdentify();
            if (e.key === 'Enter' && selectedChurchId && (!isManualLaunch || (selectedBankId && manualType)) && !isSaving) handleConfirm();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeManualIdentify, selectedChurchId, selectedBankId, isManualLaunch, manualType, isSaving]);

    useEffect(() => {
        if (churches.length === 1 && !selectedChurchId) {
            setSelectedChurchId(churches[0].id);
        }
    }, [churches, selectedChurchId]);

    useEffect(() => {
        if (availableBanks.length === 1 && !selectedBankId) {
            setSelectedBankId(availableBanks[0].id);
        }
    }, [availableBanks, selectedBankId]);

    if (!isBulk) return null;
    
    const handleConfirm = async () => {
        if (!selectedChurchId) return;

        if (isManualLaunch && !manualType) {
            alert("Por favor, selecione se este lançamento é uma Entrada ou Saída antes de salvar.");
            return;
        }

        if (isManualLaunch && !selectedBankId) {
            alert("Por favor, selecione uma Conta / Caixa de Destino para direcionar o lançamento.");
            return;
        }

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
                const parsedManualAmt = manualAmount ? (parseFloat(manualAmount.replace(/\./g, '').replace(',', '.')) || 0) : 0;
                const calculatedTotalAmount = isManualLaunch ? parsedManualAmt : bulkIdentificationTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

                await confirmBulkManualIdentification(
                    ids, 
                    selectedChurchId, 
                    selectedType, 
                    selectedPaymentMethod,
                    selectedDate,
                    manualDescription,
                    manualAmount,
                    selectedAssociationType === 'unify' ? selectedUnifiedField : undefined,
                    isManualLaunch ? manualType : undefined,
                    selectedBankId || undefined
                );

                if (setActiveView) {
                    setActiveView('reports');
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
                <div className="px-6 py-4.5 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                    <div className="flex flex-row flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-brand-blue text-white shadow-md shadow-blue-500/20">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    Novo Lançamento
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                    Lançamento Manual
                                </p>
                            </div>
                        </div>

                        {/* Selector buttons right in front of the name */}
                        {manualType === null ? (
                            <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 shadow-xs">
                                <span className="text-[9px] font-black text-amber-700 dark:text-amber-300 uppercase px-1 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                    Tipo:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleTypeSwitch('entrada')}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1.5 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 shadow-xs hover:scale-105"
                                    id="modal-btn-entrada"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span>• Entrada</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleTypeSwitch('saida')}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1.5 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 shadow-xs hover:scale-105"
                                    id="modal-btn-saida"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    <span>• Saída</span>
                                </button>
                            </div>
                        ) : (
                            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-[10px]">
                                <button
                                    type="button"
                                    onClick={() => handleTypeSwitch('entrada')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
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
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
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
                        )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <span className="text-[8px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded">Esc</span>
                        <button type="button" onClick={closeManualIdentify} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Form fields */}
                <div className="p-5 sm:p-6 flex-1 overflow-y-auto w-full custom-scrollbar">
                    <div className="space-y-4 max-w-5xl mx-auto">
                        {/* Banner Obrigatório para Escolha de Entrada ou Saída */}
                        {!manualType ? (
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 shadow-2xs text-center space-y-2">
                                <div className="flex items-center justify-center gap-1.5">
                                    <span className="text-sm">⚠️</span>
                                    <h4 className="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                                        Selecione o Tipo do Lançamento
                                    </h4>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-0.5">
                                    <button
                                        type="button"
                                        onClick={() => handleTypeSwitch('entrada')}
                                        className="flex items-center justify-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] uppercase tracking-wide shadow-xs active:scale-95 transition-all cursor-pointer"
                                        id="banner-btn-entrada"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-white"></span>
                                        <span>Entrada (Receita)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTypeSwitch('saida')}
                                        className="flex items-center justify-center gap-2 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] uppercase tracking-wide shadow-xs active:scale-95 transition-all cursor-pointer"
                                        id="banner-btn-saida"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-white"></span>
                                        <span>Saída (Despesa)</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                                manualType === 'entrada'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${manualType === 'entrada' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                    <span>Tipo Selecionado: <strong>{manualType === 'entrada' ? 'ENTRADA (Receitas / Dízimos / Ofertas)' : 'SAÍDA (Despesas / Pagamentos)'}</strong></span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleTypeSwitch(manualType === 'entrada' ? 'saida' : 'entrada')}
                                    className="text-[9px] font-black underline hover:opacity-80 cursor-pointer ml-2"
                                >
                                    Mudar para {manualType === 'entrada' ? 'Saída' : 'Entrada'}
                                </button>
                            </div>
                        )}
                        {/* Linha 1: Data e Valor */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                    Data
                                </label>
                                <div className="relative group">
                                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 pl-10 pr-3 transition-all outline-none text-xs font-bold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                    Valor (R$)
                                </label>
                                <div className="relative group">
                                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={manualAmount}
                                        onChange={handleAmountChange}
                                        placeholder="0,00"
                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 pl-10 pr-3 transition-all outline-none text-xs font-bold font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        id="manual-launch-amount-input"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Linha 2: Busca de Contribuinte */}
                        <div className="space-y-1.5" id="manual-description-container">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                    Buscar Contribuinte Cadastrado / Nome
                                </label>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    ⚡ Selecionar preenche a igreja automaticamente
                                </span>
                            </div>
                            <div className="relative group">
                                <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                <input
                                    type="text"
                                    value={manualDescription}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setManualDescription(val);
                                        setShowSuggestions(true);
                                        
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
                                    className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 pl-10 pr-3 transition-all outline-none text-xs font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                                {showSuggestions && filteredContributors.length > 0 && (
                                    <div className="absolute left-0 right-0 top-[105%] z-50 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                                        <div className="p-2 border-b border-slate-100 dark:border-white/5 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-1.5 flex justify-between items-center bg-slate-50 dark:bg-slate-900/80">
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
                                                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex justify-between items-center border-b border-slate-50 dark:border-white/5 last:border-none cursor-pointer"
                                            >
                                                <div className="flex flex-col min-w-0 pr-2">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{col.name}</span>
                                                    {col.cpf && (
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                                            {col.cpf.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'}: {formatCpfCnpj(col.cpf)}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50 shrink-0 max-w-[170px] truncate">
                                                    🏛️ {col._churchName}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Feedback de Vínculo Automático */}
                            {selectedAssociationType === 'unify' && selectedUnifiedField && (
                                <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <CheckBadgeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        <span className="truncate text-xs">
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
                            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-4 rounded-2xl space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600">
                                        <SparklesIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <h4 className="text-xs font-black text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                                        {similarMatches[0].score >= 80 ? '🎯 Contribuinte Correspondente Encontrado' : '⚡ Semelhança Possível Detectada'}
                                    </h4>
                                </div>

                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                                    Identificamos contribuintes similares cadastrados na VPS. Quer unificar com um existente ou cadastrar como NOVO?
                                </p>

                                <div className="grid grid-cols-2 gap-2 bg-slate-100/50 dark:bg-black/30 p-1 rounded-xl">
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
                                        className={`py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                            selectedAssociationType === 'create_new'
                                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs'
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
                                        className={`py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                            selectedAssociationType === 'unify'
                                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs'
                                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        Unificar Cadastro
                                    </button>
                                </div>

                                {selectedAssociationType === 'unify' && (
                                    <div className="space-y-2 pt-1">
                                        <label className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                            Selecione o Contribuinte VPS Correspondente:
                                        </label>
                                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
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
                                                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
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
                                                        <div className="flex gap-2 text-[9px] text-slate-400 font-semibold mt-0.5 uppercase">
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

                        {/* Linha 3: Igreja e Conta / Caixa */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                        Escolha a Igreja de Destino
                                    </label>
                                    {selectedAssociationType === 'unify' && selectedChurchId && (
                                        <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                            ✓ Auto-preenchida
                                        </span>
                                    )}
                                </div>
                                <div className="relative group">
                                    <BuildingOfficeIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                    <select
                                        value={selectedChurchId}
                                        onChange={e => setSelectedChurchId(e.target.value)}
                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 pl-10 pr-9 transition-all outline-none text-xs font-bold appearance-none cursor-pointer"
                                    >
                                        <option value="">-- Clique para ver as igrejas --</option>
                                        {churches.map(church => (
                                            <option key={church.id} value={church.id}>
                                                {church.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ChevronDownIcon className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                                        Conta / Caixa de Destino <span className="text-amber-500 font-bold">*</span>
                                    </label>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                        !selectedBankId 
                                            ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 animate-pulse' 
                                            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/60'
                                    }`}>
                                        {!selectedBankId ? '⚠️ Seleção Obrigatória' : '✓ Destino Selecionado'}
                                    </span>
                                </div>
                                <div className="relative group">
                                    <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                    <select
                                        value={selectedBankId}
                                        onChange={e => setSelectedBankId(e.target.value)}
                                        className={`block w-full rounded-xl border ${
                                            !selectedBankId 
                                                ? 'border-amber-300/80 dark:border-amber-700/80 bg-amber-50/30 dark:bg-amber-950/20' 
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                        } text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 pl-10 pr-9 transition-all outline-none text-xs font-bold appearance-none cursor-pointer`}
                                    >
                                        <option value="">-- Selecione a Conta / Caixa (Obrigatório) --</option>
                                        {availableBanks.map((bank: any) => (
                                            <option key={bank.id} value={bank.id}>
                                                {bank.account_name || bank.name || 'Conta Bancária / Caixa'}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ChevronDownIcon className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Linha 4: Descrição e Forma de Pagamento */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between flex-wrap gap-1.5">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                        Descrição / Categoria
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value=""
                                            onChange={e => {
                                                if (e.target.value) {
                                                    setSelectedType(e.target.value);
                                                }
                                            }}
                                            className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold py-0.5 px-2 rounded-lg border border-indigo-200/70 dark:border-indigo-800/70 cursor-pointer outline-none transition-colors"
                                            title="Escolher modelo ou categoria pré-definida"
                                        >
                                            <option value="" disabled>📋 Carregar Modelo...</option>
                                            {typeOptions.map((type: string) => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="relative w-full">
                                    <input
                                        type="text"
                                        value={selectedType}
                                        onChange={e => setSelectedType(e.target.value)}
                                        placeholder="Digite a descrição detalhada ou selecione um modelo..."
                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 px-3.5 transition-all outline-none text-xs font-bold"
                                    />
                                </div>
                                {/* Atalhos rápidos de modelos mais frequentes */}
                                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar">
                                    {typeOptions.slice(0, 6).map((type: string) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setSelectedType(type)}
                                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                                                selectedType === type
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                        Forma de Pagamento
                                    </label>
                                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-800/50">
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
                                            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 px-3 transition-all outline-none text-xs font-bold"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCustomPaymentMethod(false);
                                                setSelectedPaymentMethod('DINHEIRO');
                                            }}
                                            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold rounded-xl text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all shrink-0"
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
                                            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 px-3 pr-9 transition-all outline-none text-xs font-bold appearance-none cursor-pointer"
                                        >
                                            {paymentMethodsOptions.map((method: string) => (
                                                <option key={method} value={method}>{method}</option>
                                            ))}
                                            <option value="__CUSTOM__">✍️ Outro (Digitar manual...)</option>
                                        </select>
                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDownIcon className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 shrink-0">
                    <button 
                        type="button" 
                        onClick={closeManualIdentify} 
                        className="px-5 py-2 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        type="button" 
                        onClick={handleConfirm} 
                        disabled={!manualType || !selectedChurchId || !selectedBankId || isSaving} 
                        className={`px-6 py-2 text-[10px] font-black text-white rounded-xl shadow-md transition-all tracking-wider uppercase flex items-center gap-2 ${
                            !manualType || !selectedChurchId || !selectedBankId || isSaving
                                ? 'bg-slate-400 dark:bg-slate-700 opacity-60 cursor-not-allowed'
                                : 'bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
                        }`}
                    >
                         {isSaving ? 'Processando...' : !manualType ? '⚠️ Selecione Entrada ou Saída' : 'Salvar Lançamento'}
                         {!isSaving && selectedChurchId && selectedBankId && manualType && <span className="ml-1 text-[8px] opacity-70 bg-white/20 px-1 rounded">Enter</span>}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 z-40 bg-white dark:bg-[#0F172A] flex flex-col animate-fade-in w-full h-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isBulk ? 'bg-brand-blue text-white shadow-md shadow-blue-500/20' : 'bg-brand-blue text-white shadow-md shadow-blue-500/20'}`}>
                        {count > 1 ? <CheckBadgeIcon className="w-5 h-5" /> : <BuildingOfficeIcon className="w-5 h-5" />}
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase">
                            {count > 1 ? 'Destinar Lote' : 'Identificação de Lançamento'}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                            {count > 1 ? 'Reconciliação em Lote' : 'Identificação Pendente'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-[8px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded">Esc</span>
                    <button type="button" onClick={closeManualIdentify} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Form fields */}
            <div className="p-5 sm:p-6 flex-1 overflow-y-auto w-full custom-scrollbar">
                <div className="space-y-4 max-w-5xl mx-auto">
                    {count > 1 ? (
                        <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Registros Selecionados</span>
                                    <span className="text-xl font-black text-slate-800 dark:text-white leading-none">{count} <span className="text-xs font-medium text-slate-400">ítens</span></span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Montante do Lote</span>
                                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(totalAmount, language)}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {count === 1 && !isManualLaunch && (
                        <div className="space-y-3">
                            <div className="bg-slate-50 dark:bg-black/25 p-3.5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2.5">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    Dados Recebidos do Banco
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
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
                                            <div className="pt-2 border-t border-slate-200/50 dark:border-white/5 flex flex-col gap-0.5">
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

                            <div className="space-y-1.5" id="manual-description-container">
                                <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] ml-1">
                                    Identificar Verdadeiro Contribuinte
                                </label>
                                <div className="relative group">
                                    <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                                    <input
                                        type="text"
                                        value={manualDescription}
                                        onChange={e => {
                                            setManualDescription(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        placeholder="Digite o nome do verdadeiro contribuinte"
                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 py-2.5 pl-10 pr-3 transition-all outline-none text-xs font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    />
                                    {showSuggestions && filteredContributors.length > 0 && (
                                        <div className="absolute left-0 right-0 top-[105%] z-50 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                                            <div className="p-2 border-b border-slate-100 dark:border-white/5 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 flex justify-between items-center">
                                                <span>🔍 Cadastros Encontrados</span>
                                                <span className="text-[8px] font-semibold text-indigo-600 dark:text-indigo-400">{filteredContributors.length} encontrados</span>
                                            </div>
                                            {filteredContributors.map((col, cIdx) => {
                                                const chosenName = col.name || col.canonical_name || col.cleanedName || '';
                                                return (
                                                    <button
                                                        key={col.id || cIdx}
                                                        type="button"
                                                        onClick={() => {
                                                            setManualDescription(chosenName);
                                                            if (col._churchId) {
                                                                setSelectedChurchId(col._churchId);
                                                            }
                                                            setSelectedAssociationType('unify');
                                                            setSelectedUnifiedField(col.id);
                                                            setShowSuggestions(false);
                                                        }}
                                                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex justify-between items-center border-b border-slate-50 dark:border-white/5 last:border-none cursor-pointer"
                                                    >
                                                        <div className="flex flex-col min-w-0 pr-2">
                                                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{chosenName}</span>
                                                            {col.cpf && (
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                                                    {col.cpf.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'}: {formatCpfCnpj(col.cpf)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50 shrink-0 max-w-[160px] truncate">
                                                            🏛️ {col._churchName}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium ml-1">
                                    Se o PIX recebido está no nome de um terceiro, altere ou selecione o nome do verdadeiro contribuinte acima. Ambos os registros serão mantidos.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* SELEÇÃO DE ANÁLISE DE SIMILARIDADE E UNIFICAÇÃO DE CONTRIBUINTES */}
                    {similarMatches.length > 0 && (
                        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-4 rounded-2xl space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600">
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                </div>
                                <h4 className="text-xs font-black text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                                    {similarMatches[0].score >= 80 ? '🎯 Contribuinte Correspondente Encontrado' : '⚡ Semelhança Possível Detectada'}
                                </h4>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                                Identificamos contribuintes similares cadastrados na VPS. Quer unificar com um existente ou cadastrar como NOVO?
                            </p>

                            <div className="grid grid-cols-2 gap-2 bg-slate-100/50 dark:bg-black/30 p-1 rounded-xl">
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
                                    className={`py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                        selectedAssociationType === 'create_new'
                                            ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs'
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
                                    className={`py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                        selectedAssociationType === 'unify'
                                            ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Unificar Cadastro
                                </button>
                            </div>

                            {selectedAssociationType === 'unify' && (
                                <div className="space-y-2 pt-1">
                                    <label className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                        Selecione o Contribuinte VPS Correspondente:
                                    </label>
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
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
                                                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
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
                                                    <div className="flex gap-2 text-[9px] text-slate-400 font-semibold mt-0.5 uppercase">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                    Data de Referência (Competência)
                                </label>
                                {bulkIdentificationTxs && bulkIdentificationTxs[0]?.date && (
                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        Data do Banco: {new Date(bulkIdentificationTxs[0].date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                )}
                            </div>
                            <div className="relative group">
                                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 pl-10 pr-3 transition-all outline-none text-xs font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                               Escolha a Igreja de Destino
                            </label>
                            <div className="relative group">
                                <BuildingOfficeIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                <select
                                    value={selectedChurchId}
                                    onChange={e => setSelectedChurchId(e.target.value)}
                                    className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 pl-10 pr-9 transition-all outline-none text-xs font-bold appearance-none cursor-pointer"
                                >
                                    <option value="">-- Clique para ver as igrejas --</option>
                                    {churches.map(church => (
                                        <option key={church.id} value={church.id}>
                                            {church.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDownIcon className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                                   Conta / Caixa de Destino {isManualLaunch && <span className="text-amber-500 font-bold">*</span>}
                                </label>
                                {isManualLaunch && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                        !selectedBankId 
                                            ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 animate-pulse' 
                                            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/60'
                                    }`}>
                                        {!selectedBankId ? '⚠️ Obrigatório' : '✓ Selecionado'}
                                    </span>
                                )}
                            </div>
                            <div className="relative group">
                                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                <select
                                    value={selectedBankId}
                                    onChange={e => setSelectedBankId(e.target.value)}
                                    className={`block w-full rounded-xl border ${
                                        isManualLaunch && !selectedBankId 
                                            ? 'border-amber-300/80 dark:border-amber-700/80 bg-amber-50/30 dark:bg-amber-950/20' 
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                    } text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 pl-10 pr-9 transition-all outline-none text-xs font-bold appearance-none cursor-pointer`}
                                >
                                    <option value="">{isManualLaunch ? '-- Selecione a Conta / Caixa (Obrigatório) --' : '-- Sem Conta / Caixa Principal --'}</option>
                                    {availableBanks.map((bank: any) => (
                                        <option key={bank.id} value={bank.id}>
                                            {bank.account_name || bank.name || 'Conta Bancária / Caixa'}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDownIcon className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between flex-wrap gap-1.5">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                    Descrição / Categoria
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value=""
                                        onChange={e => {
                                            if (e.target.value) {
                                                setSelectedType(e.target.value);
                                            }
                                        }}
                                        className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold py-0.5 px-2 rounded-lg border border-indigo-200/70 dark:border-indigo-800/70 cursor-pointer outline-none transition-colors"
                                        title="Escolher modelo ou categoria pré-definida"
                                    >
                                        <option value="" disabled>📋 Carregar Modelo...</option>
                                        {typeOptions.map((type: string) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    value={selectedType}
                                    onChange={e => setSelectedType(e.target.value)}
                                    placeholder="Digite a descrição detalhada ou selecione um modelo..."
                                    className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 px-3.5 transition-all outline-none text-xs font-bold"
                                />
                            </div>
                            {/* Atalhos rápidos de modelos mais frequentes */}
                            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar">
                                {typeOptions.slice(0, 6).map((type: string) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setSelectedType(type)}
                                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                                            selectedType === type
                                                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">
                                    Forma de Pagamento
                                </label>
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50">
                                    ⚡ Padrão Pix (Extrato / Relatório)
                                </span>
                            </div>
                            {isCustomPaymentMethod ? (
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={selectedPaymentMethod}
                                        onChange={e => setSelectedPaymentMethod(e.target.value.toUpperCase())}
                                        placeholder="Digite a forma (ex: PIX, DINHEIRO)"
                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 px-3 transition-all outline-none text-xs font-bold"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCustomPaymentMethod(false);
                                            setSelectedPaymentMethod('PIX');
                                        }}
                                        className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold rounded-xl text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all shrink-0"
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
                                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue py-2.5 px-3 pr-9 transition-all outline-none text-xs font-bold appearance-none cursor-pointer"
                                    >
                                        {paymentMethodsOptions.map((method: string) => (
                                            <option key={method} value={method}>{method}</option>
                                        ))}
                                        <option value="__CUSTOM__">✍️ Outro (Digitar manual...)</option>
                                    </select>
                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ChevronDownIcon className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 shrink-0">
                <button 
                    type="button" 
                    onClick={closeManualIdentify} 
                    className="px-5 py-2 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer"
                >
                    {t('common.cancel')}
                </button>
                <button 
                    type="button" 
                    onClick={handleConfirm} 
                    disabled={!selectedChurchId || (isManualLaunch && !selectedBankId) || isSaving} 
                    className="px-6 py-2 text-[10px] font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 rounded-xl shadow-md shadow-orange-500/20 hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                >
                     {isSaving ? 'Processando...' : count > 1 ? 'Confirmar Lote' : 'Salvar Identificação'}
                     {!isSaving && selectedChurchId && (!isManualLaunch || selectedBankId) && <span className="ml-1 text-[8px] opacity-70 bg-white/20 px-1 rounded">Enter</span>}
                </button>
            </div>
        </div>
    );
};
