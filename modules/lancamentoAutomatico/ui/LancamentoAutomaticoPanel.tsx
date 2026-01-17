
import React, { useState, useEffect, useMemo } from 'react';
import { useLancamentoAutomatico } from '../useLancamentoAutomatico';
import { LancamentoModo, LancamentoItem } from '../types';
import { BoltIcon, CheckCircleIcon, SparklesIcon, BanknotesIcon, ClockIcon, MagnifyingGlassIcon, EyeIcon, ChevronUpIcon, ChevronDownIcon, InformationCircleIcon, PlayCircleIcon, BrainIcon, XMarkIcon, FloppyDiskIcon } from '../../../components/Icons';

const formatarDataBR = (dataISO: string): string => {
    if (!dataISO || !dataISO.includes('-')) return dataISO;
    const [year, month, day] = dataISO.split('-');
    return `${day}/${month}/${year}`;
};

export const LancamentoAutomaticoPanel: React.FC = () => {
    const { 
        bancos, modoAtivo, setModoAtivo, iniciarLancamento, confirmarLancamento, atualizarIgrejaSugerida,
        selectedIds, toggleSelection, setBulkSelection, isAutoRunning, setAutoRunning, currentItemId,
        isInstructionModalOpen, activeInstruction, openInstructions, saveInstructions, closeInstructions
    } = useLancamentoAutomatico();
    
    const [viewFilter, setViewFilter] = useState<'pendentes' | 'lancados'>('pendentes');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
    const [instructionText, setInstructionText] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'data', direction: 'desc' });

    useEffect(() => {
        if (!selectedBankId && bancos.length > 0) setSelectedBankId(bancos[0].bankId);
    }, [bancos, selectedBankId]);

    useEffect(() => {
        if (isInstructionModalOpen) setInstructionText(activeInstruction);
    }, [isInstructionModalOpen, activeInstruction]);

    const activeBank = bancos.find(b => b.bankId === selectedBankId);

    const filteredItems = useMemo(() => {
        if (!activeBank) return [];
        const baseList = viewFilter === 'lancados' ? activeBank.lancados : activeBank.itens;
        let result = baseList;
        
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(item => {
                const dataBR = formatarDataBR(item.data);
                const valorStr = item.valor.toString().replace('.', ',');
                const valorFormatado = item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).toLowerCase();
                
                return item.nome.toLowerCase().includes(term) || 
                       dataBR.includes(term) || 
                       valorStr.includes(term) ||
                       valorFormatado.includes(term);
            });
        }

        return [...result].sort((a, b) => {
            let valA: any = a[sortConfig.key as keyof LancamentoItem];
            let valB: any = b[sortConfig.key as keyof LancamentoItem];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valB < valA) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [activeBank, viewFilter, searchTerm, sortConfig]);

    const isAllVisibleSelected = useMemo(() => viewFilter === 'pendentes' && filteredItems.length > 0 && filteredItems.every(i => selectedIds.includes(i.id)), [filteredItems, selectedIds, viewFilter]);

    const StatusBadge = ({ item }: { item: LancamentoItem }) => {
        if (item.status === 'LANCADO') return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wide">Confirmado</span>;
        if (item.executionStatus === 'executando') return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 animate-pulse uppercase tracking-wide">Executando...</span>;
        if (selectedIds.includes(item.id)) return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-500 border border-indigo-100 uppercase tracking-wide">Na Fila</span>;
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-50 text-slate-400 border border-slate-100 uppercase tracking-wide">Aguardando</span>;
    };

    const getModoStyle = (m: LancamentoModo) => {
        if (modoAtivo !== m) return 'text-slate-500 hover:text-slate-700 bg-transparent';
        switch (m) {
            case 'AUTOMATICO': return 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md';
            case 'ASSISTIDO': return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md';
            case 'OBSERVACAO': return 'bg-gradient-to-r from-slate-500 to-slate-700 text-white shadow-md';
            default: return 'bg-blue-600 text-white';
        }
    };

    return (
        <div className="flex flex-col h-full gap-2 animate-fade-in pb-2 px-1">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 flex-shrink-0 min-h-[40px]">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-black text-brand-deep dark:text-white tracking-tight leading-none">Lançamento Automático</h2>
                    <div className="flex bg-slate-100 dark:bg-slate-900/50 p-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                        {(['OBSERVACAO', 'ASSISTIDO', 'AUTOMATICO'] as LancamentoModo[]).map(m => (
                            <button key={m} disabled={isAutoRunning} onClick={() => setModoAtivo(m)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${getModoStyle(m)}`}>{m}</button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                    <div className="relative group hidden md:block">
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-brand-blue transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Buscar na lista..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold focus:ring-1 focus:ring-brand-blue/30 focus:border-brand-blue outline-none w-48 transition-all"
                        />
                    </div>

                    {selectedBankId && <button onClick={() => openInstructions(selectedBankId)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-[10px] font-bold uppercase hover:bg-purple-50 transition-all"><BrainIcon className="w-3.5 h-3.5" /> Tutor IA</button>}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200">
                        {(['pendentes', 'lancados'] as const).map(f => (
                            <button key={f} onClick={() => !isAutoRunning && setViewFilter(f)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${viewFilter === f ? 'bg-white dark:bg-slate-700 text-brand-blue shadow-sm' : 'text-slate-500'}`}>{f}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-amber-50/40 dark:bg-amber-900/10 border border-amber-200/40 rounded-2xl px-5 py-2.5 flex items-center justify-between gap-3 shadow-sm backdrop-blur-sm mt-1">
                <div className="flex items-center gap-3">
                    <InformationCircleIcon className="w-4 h-4 text-amber-500/80" />
                    <p className="text-[13px] font-medium text-amber-800 dark:text-amber-200">
                        {modoAtivo === 'AUTOMATICO' ? "A IA processará a fila aplicando sua memória e as instruções do Tutor." : "Selecione e inicie os lançamentos para que a IA aprenda seus padrões."}
                    </p>
                </div>
                {modoAtivo === 'AUTOMATICO' && viewFilter === 'pendentes' && (
                    <button 
                        onClick={() => setAutoRunning(!isAutoRunning)} 
                        disabled={selectedIds.length === 0} 
                        className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-black uppercase transition-all shadow-lg text-white border border-white/10 ${isAutoRunning ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-50'}`}
                    >
                        <PlayCircleIcon className="w-4 h-4" /> 
                        {isAutoRunning ? 'Parar Fila' : `Executar Fila (${selectedIds.length})`}
                    </button>
                )}
            </div>

            {/* SELETOR DE LISTAS / BANCOS (RESTILIZADO) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                {bancos.map(b => {
                    const isSelected = selectedBankId === b.bankId;
                    const count = viewFilter === 'pendentes' ? b.itens.length : b.lancados.length;
                    
                    return (
                        <button 
                            key={b.bankId} 
                            disabled={isAutoRunning} 
                            onClick={() => setSelectedBankId(b.bankId)} 
                            className={`
                                flex items-center gap-2 px-5 py-2 rounded-full border transition-all whitespace-nowrap group
                                ${isSelected 
                                    ? 'bg-gradient-to-r from-brand-blue to-indigo-600 text-white shadow-lg shadow-blue-500/20 border-transparent transform scale-105' 
                                    : 'bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-500 shadow-sm'
                                }
                            `}
                        >
                            <span className="text-[10px] font-black uppercase tracking-wide">{b.bankName}</span>
                            <span className={`
                                px-2 py-0.5 rounded-full text-[10px] font-black
                                ${isSelected 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-brand-blue transition-colors'
                                }
                            `}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card overflow-hidden flex flex-col">
                {activeBank ? (
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-3 py-3 w-10 text-center"><div onClick={() => !isAutoRunning && setBulkSelection(filteredItems.map(i=>i.id), !isAllVisibleSelected)} className={`w-4 h-4 mx-auto rounded border flex items-center justify-center cursor-pointer ${isAllVisibleSelected ? 'bg-brand-blue border-brand-blue' : 'bg-white border-slate-300'}`}>{isAllVisibleSelected && <CheckCircleIcon className="w-2.5 h-2.5 text-white" />}</div></th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-center w-24">Data</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Nome / Descrição</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right w-32">Valor</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-center w-36">Destino</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-center w-32">Ação / Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                {filteredItems.length > 0 ? filteredItems.map(item => (
                                    <tr key={item.id} className={`group transition-all ${currentItemId === item.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                        <td className="px-3 py-3 text-center"><div onClick={() => !isAutoRunning && toggleSelection(item.id)} className={`w-4 h-4 mx-auto rounded border flex items-center justify-center cursor-pointer ${selectedIds.includes(item.id) ? 'bg-brand-blue border-brand-blue' : 'bg-white border-slate-300'}`}>{selectedIds.includes(item.id) && <CheckCircleIcon className="w-2.5 h-2.5 text-white" />}</div></td>
                                        <td className="px-4 py-3 text-center font-mono text-[10px] text-slate-500">{formatarDataBR(item.data)}</td>
                                        <td className="px-6 py-3"><div className="flex flex-col min-w-0"><span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">{item.nome}</span><span className="text-[9px] text-brand-blue font-bold uppercase truncate">{item.bankName}</span></div></td>
                                        <td className="px-4 py-3 text-right font-black text-xs dark:text-white">{item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td className="px-4 py-3 text-center">
                                            {currentItemId === item.id ? (
                                                <input 
                                                    type="text" 
                                                    value={item.igrejaSugerida} 
                                                    onChange={(e) => atualizarIgrejaSugerida(item.bankId, item.id, e.target.value)} 
                                                    className="w-full bg-white dark:bg-slate-900 border border-brand-blue rounded px-2 py-0.5 text-[9px] font-black uppercase text-center focus:ring-1 focus:ring-brand-blue outline-none" 
                                                />
                                            ) : (
                                                <span className="text-[9px] font-black uppercase text-brand-blue">{item.igrejaSugerida}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {item.status === 'PENDENTE' ? (
                                                currentItemId === item.id ? (
                                                    <button 
                                                        onClick={() => confirmarLancamento(item.bankId, item.id)} 
                                                        className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-full text-[9px] font-black uppercase flex items-center gap-1 mx-auto transition-all shadow-md active:scale-95 border border-white/10"
                                                    >
                                                        <CheckCircleIcon className="w-3 h-3" /> Confirmar
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => iniciarLancamento(item.bankId, item.id)} 
                                                            disabled={isAutoRunning || (currentItemId !== null)}
                                                            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
                                                            title="Iniciar Lançamento"
                                                        >
                                                            <PlayCircleIcon className="w-4 h-4" />
                                                        </button>
                                                        <StatusBadge item={item} />
                                                    </div>
                                                )
                                            ) : (
                                                <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase">
                                                    <CheckCircleIcon className="w-3 h-3" /> Concluído
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400 italic text-[11px]">Nenhum registro encontrado para esta busca.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-bold uppercase italic">Selecione um banco para começar.</div>}
            </div>

            {isInstructionModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-[#0F172A] w-full max-w-lg rounded-[2rem] shadow-2xl border border-white/20 flex flex-col overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">Tutor da IA - {activeBank?.bankName}</h3>
                            <button onClick={closeInstructions} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6">
                            <textarea value={instructionText} onChange={(e) => setInstructionText(e.target.value)} placeholder="Ex: 'Sempre que o nome for Padaria Silva, lance como Administrativo'..." className="w-full h-48 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-brand-blue resize-none font-medium text-slate-700 dark:text-slate-200" />
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-800 flex justify-end gap-2">
                            <button onClick={closeInstructions} className="px-5 py-2 text-[10px] font-black text-slate-500 uppercase hover:text-slate-700 transition-colors">Cancelar</button>
                            <button onClick={() => selectedBankId && saveInstructions(selectedBankId, instructionText)} className="px-6 py-2 bg-gradient-to-r from-brand-blue to-indigo-600 text-white rounded-full text-[10px] font-black uppercase shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 active:scale-95">Salvar Instruções</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
