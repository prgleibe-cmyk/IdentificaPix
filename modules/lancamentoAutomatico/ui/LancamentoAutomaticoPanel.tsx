
import React, { useState, useEffect, useMemo } from 'react';
import { useLancamentoAutomatico } from '../useLancamentoAutomatico';
import { MODOS_LANCAMENTO } from '../constants';
import { LancamentoModo, BancoLancamento, LancamentoItem } from '../types';
import { BoltIcon, CheckCircleIcon, SparklesIcon, BanknotesIcon, ClockIcon, MagnifyingGlassIcon, EyeIcon, ChevronUpIcon, ChevronDownIcon, InformationCircleIcon, PlayCircleIcon } from '../../../components/Icons';

type ViewFilter = 'pendentes' | 'lancados';
type SortKey = 'data' | 'nome' | 'valor' | 'status';
type SortDirection = 'asc' | 'desc';

const formatarDataBR = (dataISO: string): string => {
    if (!dataISO || !dataISO.includes('-')) return dataISO;
    const [year, month, day] = dataISO.split('-');
    return `${day}/${month}/${year}`;
};

const calcularEstatisticasBanco = (banco: BancoLancamento) => {
    const pendentes = banco.itens.length;
    const lancados = banco.lancados.length;
    return {
        pendentes,
        lancados,
        total: pendentes + lancados
    };
};

const getInstrucaoPorModo = (modo: LancamentoModo): string => {
    switch (modo) {
        case 'OBSERVACAO':
            return "A IA apenas observa seus lançamentos. Trabalhe normalmente no outro sistema e confirme aqui quando concluir.";
        case 'ASSISTIDO':
            return "A IA sugere ações e pede sua confirmação antes de cada lançamento.";
        case 'AUTOMATICO':
            return "Selecione os itens e clique em 'Executar' para que a IA realize os lançamentos sozinha.";
        default:
            return "";
    }
};

export const LancamentoAutomaticoPanel: React.FC = () => {
    const { 
        bancos, 
        modoAtivo, 
        setModoAtivo, 
        iniciarLancamento,
        confirmarLancamento,
        atualizarIgrejaSugerida,
        selectedIds,
        toggleSelection,
        setBulkSelection,
        isAutoRunning,
        setAutoRunning,
        currentItemId,
        obterSugestoesDoItem
    } = useLancamentoAutomatico();
    
    const [activeId, setActiveId] = useState<string | null>(null);
    const [viewFilter, setViewFilter] = useState<ViewFilter>('pendentes');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
    
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
        key: 'data', 
        direction: 'desc' 
    });

    useEffect(() => {
        if (!selectedBankId && bancos.length > 0) {
            setSelectedBankId(bancos[0].bankId);
        }
    }, [bancos, selectedBankId]);

    const activeBank = bancos.find(b => b.bankId === selectedBankId);

    const sortItems = (items: LancamentoItem[], key: SortKey, direction: SortDirection) => {
        return [...items].sort((a, b) => {
            let valA: any = a[key as keyof LancamentoItem];
            let valB: any = b[key as keyof LancamentoItem];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valB < valA) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const filteredItems = useMemo(() => {
        if (!activeBank) return [];
        const baseList = viewFilter === 'lancados' ? activeBank.lancados : activeBank.itens;
        let result = baseList;
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(item => {
                const dataBR = formatarDataBR(item.data);
                return item.nome.toLowerCase().includes(term) || dataBR.includes(term) || item.data.includes(term) || item.valor.toString().includes(term) || item.valor.toLocaleString('pt-BR').includes(term);
            });
        }
        return sortItems(result, sortConfig.key, sortConfig.direction);
    }, [activeBank, viewFilter, searchTerm, sortConfig]);

    // Checkbox Master State
    const isAllVisibleSelected = useMemo(() => {
        if (viewFilter !== 'pendentes' || filteredItems.length === 0) return false;
        return filteredItems.every(item => selectedIds.includes(item.id));
    }, [filteredItems, selectedIds, viewFilter]);

    const handleToggleAll = () => {
        if (isAutoRunning || viewFilter !== 'pendentes' || filteredItems.length === 0) return;
        const visibleIds = filteredItems.map(i => i.id);
        setBulkSelection(visibleIds, !isAllVisibleSelected);
    };

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIndicator = ({ column }: { column: SortKey }) => {
        if (sortConfig.key !== column) return <ChevronDownIcon className="w-3 h-3 opacity-20 group-hover:opacity-50" />;
        return sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3 text-blue-600" /> : <ChevronDownIcon className="w-3 h-3 text-blue-600" />;
    };

    const ModeButton = ({ modo, label, icon: Icon }: { modo: LancamentoModo, label: string, icon: any }) => {
        const isSelected = modoAtivo === modo;
        let colorClass = "from-slate-600 to-slate-800 shadow-slate-500/30";
        if (modo === 'ASSISTIDO') colorClass = "from-indigo-600 to-blue-600 shadow-blue-500/30";
        if (modo === 'AUTOMATICO') colorClass = "from-emerald-600 to-teal-600 shadow-emerald-500/30";

        return (
            <button
                disabled={isAutoRunning}
                onClick={() => setModoAtivo(modo)}
                className={`
                    relative flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-wide border
                    ${isSelected 
                        ? `bg-gradient-to-r ${colorClass} text-white transform scale-105 z-10 border-transparent shadow-md` 
                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }
                    ${isAutoRunning ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <Icon className="w-3.5 h-3.5" />
                <span>{label.split(' ')[1]}</span>
            </button>
        );
    };

    const handleStart = (bankId: string, itemId: string) => {
        setActiveId(itemId);
        iniciarLancamento(bankId, itemId);
    };

    const handleConfirm = (bankId: string, itemId: string) => {
        handleConfirmInternal(bankId, itemId);
    };

    const handleConfirmInternal = (bankId: string, itemId: string) => {
        confirmarLancamento(bankId, itemId);
        if (activeId === itemId) setActiveId(null);
    }

    return (
        <div className="flex flex-col h-full gap-2 animate-fade-in pb-2 px-1">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 flex-shrink-0 min-h-[40px]">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-black text-brand-deep dark:text-white tracking-tight leading-none">Lançamento Automático</h2>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                        <ModeButton modo="OBSERVACAO" label="Modo Observação" icon={EyeIcon} />
                        <ModeButton modo="ASSISTIDO" label="Modo Assistido" icon={BoltIcon} />
                        <ModeButton modo="AUTOMATICO" label="Modo Automático" icon={SparklesIcon} />
                    </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {(['pendentes', 'lancados'] as ViewFilter[]).map(f => (
                            <button
                                key={f}
                                onClick={() => { if(!isAutoRunning) { setViewFilter(f); setActiveId(null); } }}
                                className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isAutoRunning ? 'cursor-not-allowed opacity-50' : ''} ${
                                    viewFilter === f 
                                    ? 'bg-white dark:bg-slate-700 text-brand-blue dark:text-blue-400 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="relative group">
                        <MagnifyingGlassIcon className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Pesquisar..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-7 pr-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-medium focus:ring-1 focus:ring-brand-blue/30 focus:border-brand-blue outline-none w-32 focus:w-48 transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-shrink-0 animate-fade-in-down mt-1">
                <div className="bg-amber-50/40 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/20 rounded-2xl px-5 py-2.5 flex items-center justify-between gap-3 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-amber-100/50 dark:border-amber-900/30 shadow-sm">
                            <InformationCircleIcon className="w-4 h-4 text-amber-500/80 dark:text-amber-400/70 shrink-0" />
                        </div>
                        <p className="text-[13px] font-medium text-amber-800/80 dark:text-amber-200/70 leading-relaxed">
                            {getInstrucaoPorModo(modoAtivo)}
                        </p>
                    </div>
                    
                    {modoAtivo === 'AUTOMATICO' && viewFilter === 'pendentes' && (
                        <button
                            onClick={() => setAutoRunning(!isAutoRunning)}
                            disabled={selectedIds.length === 0}
                            className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                                isAutoRunning 
                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed'
                            }`}
                        >
                            {isAutoRunning ? (
                                <><div className="w-2 h-2 rounded-full bg-white animate-pulse"></div> Parar Automático</>
                            ) : (
                                <><PlayCircleIcon className="w-4 h-4" /> Executar Automático ({selectedIds.length})</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {bancos.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-shrink-0">
                    {bancos.map(banco => {
                        const isSelected = selectedBankId === banco.bankId;
                        const stats = calcularEstatisticasBanco(banco);
                        return (
                            <button
                                key={banco.bankId}
                                disabled={isAutoRunning}
                                onClick={() => setSelectedBankId(banco.bankId)}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-full border transition-all whitespace-nowrap ${isAutoRunning ? 'opacity-50 cursor-not-allowed' : ''} ${isSelected ? 'bg-blue-600 text-white border-transparent shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-300'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <BanknotesIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{banco.bankName}</span>
                                </div>
                                <div className="h-3 w-px bg-current opacity-20"></div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-300' : 'bg-amber-400'}`}></div><span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>{stats.pendentes}</span></div>
                                    <div className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`}></div><span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>{stats.lancados}</span></div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card overflow-hidden flex flex-col">
                {activeBank ? (
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-3 py-3 w-10 text-center">
                                        <div className="flex items-center justify-center">
                                            {viewFilter === 'pendentes' && (
                                                <div 
                                                    onClick={handleToggleAll}
                                                    className={`w-4 h-4 mx-auto rounded border flex items-center justify-center transition-all cursor-pointer ${isAutoRunning ? 'cursor-not-allowed opacity-50' : ''} ${isAllVisibleSelected ? 'bg-blue-600 border-blue-600 shadow-sm' : 'bg-white border-slate-300 hover:border-blue-400'}`}
                                                >
                                                    {isAllVisibleSelected && <CheckCircleIcon className="w-2.5 h-2.5 text-white" />}
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-24">
                                        <button onClick={() => handleSort('data')} className="flex items-center justify-center gap-1.5 mx-auto group hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none">
                                            Data <SortIndicator column="data" />
                                        </button>
                                    </th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">
                                        <button onClick={() => handleSort('nome')} className="flex items-center gap-1.5 group hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none">
                                            Nome / Descrição <SortIndicator column="nome" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-32">
                                        <button onClick={() => handleSort('valor')} className="flex items-center justify-end gap-1.5 ml-auto group hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none">
                                            Valor <SortIndicator column="valor" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-36">
                                        <button onClick={() => handleSort('status')} className="flex items-center justify-center gap-1.5 mx-auto group hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none">
                                            Destino <SortIndicator column="status" />
                                        </button>
                                    </th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-32">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {filteredItems.length > 0 ? (
                                    filteredItems.map(item => {
                                        const isRunning = currentItemId === item.id;
                                        const isQueued = selectedIds.includes(item.id) && !isRunning;
                                        const isActive = activeId === item.id || isRunning;
                                        const isSelected = selectedIds.includes(item.id);
                                        const sugestoes = obterSugestoesDoItem(item.id);
                                        const hasAISuggestion = sugestoes.length > 0;
                                        
                                        // Dynamic classes for row
                                        const rowClass = `
                                            group transition-all
                                            ${isRunning ? 'bg-blue-100/40 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-500/20' : ''}
                                            ${isQueued ? 'bg-slate-50/80 dark:bg-slate-800/40 opacity-90' : ''}
                                            ${isActive && !isRunning ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                                            ${!isRunning && !isQueued ? 'hover:bg-slate-50/30 dark:hover:bg-slate-700/10' : ''}
                                        `;

                                        return (
                                            <tr key={item.id} className={rowClass}>
                                                <td className="px-3 py-3 text-center">
                                                    {viewFilter === 'pendentes' && item.status === 'PENDENTE' && (
                                                        <div 
                                                            onClick={() => !isAutoRunning && toggleSelection(item.id)}
                                                            className={`w-4 h-4 mx-auto rounded border flex items-center justify-center transition-all cursor-pointer ${isAutoRunning ? 'cursor-not-allowed opacity-50' : ''} ${isSelected ? 'bg-blue-600 border-blue-600 shadow-sm' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}
                                                        >
                                                            {isSelected && <CheckCircleIcon className="w-2.5 h-2.5 text-white" />}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center"><span className="text-[10px] font-bold font-mono text-slate-500 whitespace-nowrap">{formatarDataBR(item.data)}</span></td>
                                                <td className="px-6 py-3"><div className="flex flex-col min-w-0"><span className={`font-bold text-xs leading-snug line-clamp-2 ${isRunning ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>{item.nome}</span><span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold uppercase mt-0.5">{item.tipoContribuicao || 'Outros'}</span></div></td>
                                                <td className="px-4 py-3 text-right"><span className={`text-xs font-black font-mono ${item.valor < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {isRunning ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm animate-pulse">
                                                                <ClockIcon className="w-2.5 h-2.5" /> Executando
                                                            </span>
                                                        ) : isQueued ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                                                Aguardando
                                                            </span>
                                                        ) : (
                                                            <div className="w-full flex flex-col gap-1 items-center">
                                                                {isActive ? (
                                                                    <input 
                                                                        type="text" 
                                                                        value={item.igrejaSugerida}
                                                                        onChange={(e) => atualizarIgrejaSugerida(activeBank.bankId, item.id, e.target.value)}
                                                                        className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter text-blue-700 dark:text-blue-300 focus:ring-1 focus:ring-blue-500 outline-none text-center"
                                                                    />
                                                                ) : (
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter truncate max-w-full ${item.status === 'LANCADO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20' : 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20'}`}>
                                                                        {item.igrejaSugerida}
                                                                    </span>
                                                                )}
                                                                
                                                                {hasAISuggestion && !isRunning && (
                                                                    <span className="inline-flex items-center gap-0.5 text-[7px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest bg-purple-50 dark:bg-purple-900/20 px-1 rounded">
                                                                        <SparklesIcon className="w-2 h-2" /> Sugestão IA ({sugestoes[0].confianca}%)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {isRunning && <span className="text-[8px] text-blue-500 font-bold animate-pulse">Lançando...</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <div className="flex justify-center">
                                                        {item.status === 'PENDENTE' ? (!isRunning && !isQueued && !activeId ? (
                                                            <button disabled={isAutoRunning} onClick={() => handleStart(activeBank.bankId, item.id)} className={`px-4 py-1.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm hover:bg-brand-blue hover:text-white transition-all active:scale-95 ${isAutoRunning ? 'opacity-30 cursor-not-allowed' : ''}`}>Iniciar</button>
                                                        ) : (isRunning || activeId === item.id ? (
                                                            <button onClick={() => handleConfirm(activeBank.bankId, item.id)} className="px-4 py-1.5 bg-emerald-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-1.5">
                                                                <CheckCircleIcon className="w-3" /> Confirmar
                                                            </button>
                                                        ) : (<div className="w-20 h-6"></div>))) : (
                                                            <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase border border-emerald-100 dark:bg-emerald-900/30">
                                                                <CheckCircleIcon className="w-3" /> Lançado
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr><td colSpan={6} className="py-20 text-center text-slate-400"><MagnifyingGlassIcon className="w-10 h-10 mx-auto mb-3 opacity-10" /><p className="text-xs font-bold uppercase tracking-widest">Nenhum item corresponde à busca.</p></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400"><ClockIcon className="w-12 h-12 mb-4 opacity-10" /><p className="text-xs font-bold uppercase tracking-widest">{bancos.length === 0 ? 'Nenhum extrato ativo para lançamento.' : 'Selecione um banco para visualizar os itens.'}</p></div>
                )}
            </div>
        </div>
    );
};
