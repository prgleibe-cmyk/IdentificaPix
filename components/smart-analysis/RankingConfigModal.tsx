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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-scale-in">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                            <Trophy className="w-6 h-6 stroke-[2.2]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                                Gerar Ranking Personalizado
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Escolha os caixas e as congregações para apurar os totais de saldo.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo rolável */}
                <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">

                    {/* Origem dos Dados (Se houver tanto sessão quanto planilhas salvas) */}
                    {(hasActiveSession || savedReports.length > 0) && (
                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-orange-500" />
                                Base de Lançamentos para o Ranking
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setSourceType('session')}
                                    disabled={!hasActiveSession}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between cursor-pointer ${
                                        sourceType === 'session'
                                            ? 'bg-amber-500/10 border-amber-500 dark:border-amber-500/80 ring-1 ring-amber-500/30 text-amber-900 dark:text-amber-200'
                                            : !hasActiveSession 
                                            ? 'opacity-40 bg-white/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div>
                                        <p className="text-xs font-black">Lançamentos Ativos / Livro Caixa</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            {hasActiveSession 
                                                ? `${sessionRecordCount} lançamentos disponíveis para apuração` 
                                                : 'Nenhum lançamento encontrado'}
                                        </p>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        sourceType === 'session' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'
                                    }`}>
                                        {sourceType === 'session' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSourceType('saved_report')}
                                    disabled={savedReports.length === 0}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between cursor-pointer ${
                                        sourceType === 'saved_report'
                                            ? 'bg-amber-500/10 border-amber-500 dark:border-amber-500/80 ring-1 ring-amber-500/30 text-amber-900 dark:text-amber-200'
                                            : savedReports.length === 0
                                            ? 'opacity-40 bg-white/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div>
                                        <p className="text-xs font-black">Planilha / Relatório Salvo</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            {savedReports.length > 0 
                                                ? `${savedReports.length} planilhas disponíveis` 
                                                : 'Nenhuma planilha salva'}
                                        </p>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        sourceType === 'saved_report' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'
                                    }`}>
                                        {sourceType === 'saved_report' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                </button>
                            </div>

                            {/* Dropdown de relatórios salvos quando selecionado */}
                            {sourceType === 'saved_report' && savedReports.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Selecione a Planilha Salva:
                                    </label>
                                    <select
                                        value={selectedReportId}
                                        onChange={(e) => setSelectedReportId(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
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
                                <Landmark className="w-4 h-4 text-blue-500" />
                                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                    1. Caixas e Contas Bancárias
                                </h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    selectedBankIds.length === 0
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : selectedBankIds.length === allBankIds.length
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
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
                                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                    Selecionar Todos
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <button
                                    type="button"
                                    onClick={deselectAllBanks}
                                    className="text-[11px] font-bold text-slate-500 hover:text-red-600 hover:underline px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        {/* Grid de Caixas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {/* Opção especial: Caixa Físico */}
                            {isCaixaFisicoVisible && (
                                <div
                                    onClick={() => toggleBank(CAIXA_FISICO_ID)}
                                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                        selectedBankIds.includes(CAIXA_FISICO_ID)
                                            ? 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 shadow-sm'
                                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex-shrink-0">
                                            <Banknote className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold truncate">Caixa Físico</p>
                                            <p className="text-[10px] text-slate-400 truncate">Sem vínculo de conta bancária</p>
                                        </div>
                                    </div>
                                    {selectedBankIds.includes(CAIXA_FISICO_ID) ? (
                                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
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
                                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                            isSelected
                                                ? 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 shadow-sm'
                                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex-shrink-0">
                                                <Landmark className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold truncate">{displayName}</p>
                                                {b.bank_key && (
                                                    <p className="text-[10px] text-slate-400 truncate">Chave: {b.bank_key}</p>
                                                )}
                                            </div>
                                        </div>
                                        {isSelected ? (
                                            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
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
                                <Building2 className="w-4 h-4 text-orange-500" />
                                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                    2. Igrejas / Congregações
                                </h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    selectedChurchIds.length === 0
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : selectedChurchIds.length === allChurchIds.length
                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
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
                                    className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline px-2 py-1 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                                >
                                    Selecionar Todas
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <button
                                    type="button"
                                    onClick={deselectAllChurches}
                                    className="text-[11px] font-bold text-slate-500 hover:text-red-600 hover:underline px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                            />
                        </div>

                        {/* Grid de Igrejas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto custom-scrollbar p-1">
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
                                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'bg-orange-50/70 dark:bg-orange-900/20 border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-200 shadow-sm'
                                                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex-shrink-0">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold truncate">{c.name}</p>
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
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs animate-shake">
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
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {canGenerate && (
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Apuração: <strong className="text-orange-600 dark:text-orange-400">{selectedChurchIds.length}</strong> igreja(s) e <strong className="text-blue-600 dark:text-blue-400">{selectedBankIds.length}</strong> caixa(s).
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={!canGenerate || isLoading}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-md cursor-pointer ${
                                canGenerate && !isLoading
                                    ? 'bg-gradient-to-r from-orange-500 via-amber-600 to-stone-900 hover:shadow-orange-500/25 hover:-translate-y-0.5 active:scale-95'
                                    : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
                            }`}
                        >
                            <Trophy className="w-4 h-4 text-amber-300" />
                            <span>{isLoading ? 'Processando...' : 'Gerar Ranking'}</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
