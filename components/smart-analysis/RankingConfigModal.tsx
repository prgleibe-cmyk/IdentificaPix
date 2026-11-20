import React, { useState, useMemo, useEffect } from 'react';
import { Trophy, Landmark, Building2, CheckSquare, Square, Search, X, Layers, AlertCircle, Banknote } from 'lucide-react';
import { Church, Bank } from '../../types';

export interface RankingConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: {
        churchIds: string[];
        bankIds: string[];
        sourceType: 'session' | 'saved_report';
        selectedReportId?: string;
    }) => void;
    churches: Church[];
    banks: Bank[];
    hasActiveSession: boolean;
    sessionRecordCount: number;
    savedReports: any[];
    activeReportId: string | null;
    initialChurchIds?: string[];
    initialBankIds?: string[];
    isLoading?: boolean;
}

export const RankingConfigModal: React.FC<RankingConfigModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    churches,
    banks,
    hasActiveSession,
    sessionRecordCount,
    savedReports,
    activeReportId,
    initialChurchIds,
    initialBankIds,
    isLoading = false
}) => {
    // Opção extra para Caixa Físico (lançamentos sem vínculo de banco)
    const CAIXA_FISICO_ID = 'sem_banco';

    // Fonte de dados
    const [sourceType, setSourceType] = useState<'session' | 'saved_report'>(
        hasActiveSession ? 'session' : (savedReports.length > 0 ? 'saved_report' : 'session')
    );
    const [selectedReportId, setSelectedReportId] = useState<string>(
        activeReportId || (savedReports.length > 0 ? savedReports[0].id : '')
    );

    // Estados de seleção de Igrejas
    const allChurchIds = useMemo(() => churches.map(c => c.id), [churches]);
    const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>(() => {
        if (initialChurchIds && initialChurchIds.length > 0) {
            return initialChurchIds;
        }
        return allChurchIds;
    });
    const [churchSearch, setChurchSearch] = useState('');

    // Estados de seleção de Caixas
    const allBankIds = useMemo(() => [...banks.map(b => b.id), CAIXA_FISICO_ID], [banks]);
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>(() => {
        if (initialBankIds && initialBankIds.length > 0) {
            return initialBankIds;
        }
        return allBankIds;
    });
    const [bankSearch, setBankSearch] = useState('');

    // Sincroniza seleções quando a modal for aberta
    useEffect(() => {
        if (isOpen) {
            if (initialChurchIds && initialChurchIds.length > 0) {
                setSelectedChurchIds(initialChurchIds);
            } else {
                setSelectedChurchIds(allChurchIds);
            }
            if (initialBankIds && initialBankIds.length > 0) {
                setSelectedBankIds(initialBankIds);
            } else {
                setSelectedBankIds(allBankIds);
            }
            if (!hasActiveSession && savedReports.length > 0) {
                setSourceType('saved_report');
            } else if (hasActiveSession) {
                setSourceType('session');
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Filtros de busca
    const filteredChurches = churches.filter(c => 
        (c.name || '').toLowerCase().includes(churchSearch.toLowerCase())
    );

    const filteredBanks = banks.filter(b => {
        const name = b.account_name || b.name || '';
        return name.toLowerCase().includes(bankSearch.toLowerCase());
    });

    const isCaixaFisicoVisible = 'caixa físico sem vínculo'.includes(bankSearch.toLowerCase());

    // Handlers para seleção de Igrejas
    const toggleChurch = (id: string) => {
        setSelectedChurchIds(prev => 
            prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
        );
    };

    const selectAllChurches = () => setSelectedChurchIds(allChurchIds);
    const deselectAllChurches = () => setSelectedChurchIds([]);

    // Handlers para seleção de Caixas
    const toggleBank = (id: string) => {
        setSelectedBankIds(prev => 
            prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
        );
    };

    const selectAllBanks = () => setSelectedBankIds(allBankIds);
    const deselectAllBanks = () => setSelectedBankIds([]);

    const canGenerate = selectedChurchIds.length > 0 && selectedBankIds.length > 0;

    const handleGenerate = () => {
        if (!canGenerate) return;
        onConfirm({
            churchIds: selectedChurchIds,
            bankIds: selectedBankIds,
            sourceType,
            selectedReportId: sourceType === 'saved_report' ? selectedReportId : undefined
        });
    };

    return (
        <div
            className="fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px] animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onClose(); }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-elevated border border-slate-200/90 dark:border-slate-800 flex flex-col max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))] overflow-hidden animate-scale-in"
            >
                
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center gap-3 bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                            <Trophy className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                                Gerar Ranking Personalizado
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                                Escolha os caixas e as congregações para apurar os totais de saldo.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Conteúdo rolável */}
                <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>

                    {/* Origem dos Dados (Se houver tanto sessão quanto planilhas salvas) */}
                    {(hasActiveSession || savedReports.length > 0) && (
                        <div className="bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-4">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2.5 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                Base de Lançamentos para o Ranking
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setSourceType('session')}
                                    disabled={!hasActiveSession}
                                    className={`p-3 rounded-xl border text-left transition-colors flex items-start justify-between cursor-pointer ${
                                        sourceType === 'session'
                                            ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-500 text-orange-900 dark:text-orange-200'
                                            : !hasActiveSession 
                                            ? 'opacity-40 bg-white/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div>
                                        <p className="text-xs font-bold">Lançamentos Ativos / Livro Caixa</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                            {hasActiveSession 
                                                ? `${sessionRecordCount} lançamentos disponíveis para apuração` 
                                                : 'Nenhum lançamento encontrado'}
                                        </p>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                        sourceType === 'session' ? 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300 dark:border-slate-600'
                                    }`}>
                                        {sourceType === 'session' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSourceType('saved_report')}
                                    disabled={savedReports.length === 0}
                                    className={`p-3 rounded-xl border text-left transition-colors flex items-start justify-between cursor-pointer ${
                                        sourceType === 'saved_report'
                                            ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-500 text-orange-900 dark:text-orange-200'
                                            : savedReports.length === 0
                                            ? 'opacity-40 bg-white/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div>
                                        <p className="text-xs font-bold">Planilha / Relatório Salvo</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                            {savedReports.length > 0 
                                                ? `${savedReports.length} planilhas disponíveis` 
                                                : 'Nenhuma planilha salva'}
                                        </p>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                        sourceType === 'saved_report' ? 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300 dark:border-slate-600'
                                    }`}>
                                        {sourceType === 'saved_report' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                </button>
                            </div>

                            {/* Dropdown de relatórios salvos quando selecionado */}
                            {sourceType === 'saved_report' && savedReports.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
                                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                        Selecione a Planilha Salva:
                                    </label>
                                    <select
                                        value={selectedReportId}
                                        onChange={(e) => setSelectedReportId(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500 outline-none"
                                    >
                                        {savedReports.map(rep => (
                                            <option key={rep.id} value={rep.id}>
                                                {rep.name} • {new Date(rep.createdAt).toLocaleDateString()} ({rep.recordCount || 0} reg.)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SEÇÃO 1: SELEÇÃO DE CAIXAS (1 ou Mais Caixas) */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <Landmark className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                                    1. Caixas e Contas Bancárias
                                </h4>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${
                                    selectedBankIds.length === 0
                                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50'
                                        : selectedBankIds.length === allBankIds.length
                                        ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/80 dark:border-orange-900/50'
                                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/50'
                                }`}>
                                    {selectedBankIds.length === allBankIds.length 
                                        ? 'Todos os Caixas' 
                                        : `${selectedBankIds.length} de ${allBankIds.length} selecionados`}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={selectAllBanks}
                                    className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline px-2 py-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                                >
                                    Selecionar Todos
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <button
                                    type="button"
                                    onClick={deselectAllBanks}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:underline px-2 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                >
                                    Limpar
                                </button>
                            </div>
                        </div>

                        {/* Campo de Busca de Caixas */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={bankSearch}
                                onChange={(e) => setBankSearch(e.target.value)}
                                placeholder="Buscar caixa ou conta..."
                                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                            />
                        </div>

                        {/* Grid de Caixas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                            {/* Opção especial: Caixa Físico */}
                            {isCaixaFisicoVisible && (
                                <div
                                    onClick={() => toggleBank(CAIXA_FISICO_ID)}
                                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                                        selectedBankIds.includes(CAIXA_FISICO_ID)
                                            ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-200 shadow-2xs'
                                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                            <Banknote className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold truncate">Caixa Físico</p>
                                            <p className="text-[10px] text-slate-400 truncate">Sem vínculo de conta bancária</p>
                                        </div>
                                    </div>
                                    {selectedBankIds.includes(CAIXA_FISICO_ID) ? (
                                        <CheckSquare className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                                    ) : (
                                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                    )}
                                </div>
                            )}

                            {/* Lista de Caixas/Bancos Cadastrados */}
                            {filteredBanks.map(b => {
                                const isSelected = selectedBankIds.includes(b.id);
                                const displayName = b.account_name || b.name || 'Conta Bancária / Caixa';
                                return (
                                    <div
                                        key={b.id}
                                        onClick={() => toggleBank(b.id)}
                                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-200 shadow-2xs'
                                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex-shrink-0">
                                                <Landmark className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold truncate">{displayName}</p>
                                                {b.bank_key && (
                                                    <p className="text-[10px] text-slate-400 truncate">Chave: {b.bank_key}</p>
                                                )}
                                            </div>
                                        </div>
                                        {isSelected ? (
                                            <CheckSquare className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                                        ) : (
                                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SEÇÃO 2: SELEÇÃO DE IGREJAS (Igrejas / Congregações) */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                                    2. Igrejas / Congregações
                                </h4>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${
                                    selectedChurchIds.length === 0
                                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50'
                                        : selectedChurchIds.length === allChurchIds.length
                                        ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/80 dark:border-orange-900/50'
                                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/50'
                                }`}>
                                    {selectedChurchIds.length === allChurchIds.length 
                                        ? 'Todas as Igrejas' 
                                        : `${selectedChurchIds.length} de ${allChurchIds.length} selecionadas`}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={selectAllChurches}
                                    className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline px-2 py-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                                >
                                    Selecionar Todas
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <button
                                    type="button"
                                    onClick={deselectAllChurches}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:underline px-2 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                >
                                    Limpar
                                </button>
                            </div>
                        </div>

                        {/* Campo de Busca de Igrejas */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={churchSearch}
                                onChange={(e) => setChurchSearch(e.target.value)}
                                placeholder="Buscar igreja ou congregação..."
                                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                            />
                        </div>

                        {/* Grid de Igrejas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto custom-scrollbar p-1" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                            {filteredChurches.length === 0 ? (
                                <div className="col-span-2 text-center py-6 text-slate-400 text-xs italic">
                                    Nenhuma congregação encontrada.
                                </div>
                            ) : (
                                filteredChurches.map(c => {
                                    const isSelected = selectedChurchIds.includes(c.id);
                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => toggleChurch(c.id)}
                                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                                                isSelected
                                                    ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-200 shadow-2xs'
                                                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex-shrink-0">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold truncate">{c.name}</p>
                                                    {c.pastor && (
                                                        <p className="text-[10px] text-slate-400 truncate">Resp: {c.pastor}</p>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected ? (
                                                <CheckSquare className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                                            ) : (
                                                <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Alerta se não houver seleção */}
                    {!canGenerate && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-center gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>
                                {selectedBankIds.length === 0 && selectedChurchIds.length === 0
                                    ? 'Selecione ao menos 1 caixa e 1 igreja para gerar o ranking.'
                                    : selectedBankIds.length === 0
                                    ? 'Selecione ao menos 1 caixa ou conta bancária.'
                                    : 'Selecione ao menos 1 igreja ou congregação.'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {canGenerate && (
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                Apuração: <strong className="text-orange-600 dark:text-orange-400">{selectedChurchIds.length}</strong> igreja(s) e <strong className="text-slate-900 dark:text-white">{selectedBankIds.length}</strong> caixa(s).
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={!canGenerate || isLoading}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white transition-colors shadow-xs cursor-pointer ${
                                canGenerate && !isLoading
                                    ? 'bg-orange-600 hover:bg-orange-700'
                                    : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
                            }`}
                        >
                            <Trophy className="w-3.5 h-3.5 text-white" />
                            <span>{isLoading ? 'Processando...' : 'Gerar Ranking'}</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
