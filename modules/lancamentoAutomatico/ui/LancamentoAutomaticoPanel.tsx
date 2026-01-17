
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
    
    const [activeId, setActiveId] = useState<string | null>(null);
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
            result = result.filter(item => item.nome.toLowerCase().includes(term) || formatarDataBR(item.data).includes(term));
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
        if (item.executionStatus === 'executando') return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-100 animate-pulse uppercase tracking-wide">Executando...</span>;
        if (selectedIds.includes(item.id)) return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-500 border border-indigo-100 uppercase tracking-wide">Na Fila</span>;
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-50 text-slate-400 border border-slate-100 uppercase tracking-wide">Aguardando</span>;
    };

    return (
        <div className="flex flex-col h-full gap-2 animate-fade-in pb-2 px-1">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 flex-shrink-0 min-h-[40px]">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-black text-brand-deep dark:text-white tracking-tight leading-none">Lançamento Automático</h2>
                    <div className="flex bg-slate-100 dark:bg-slate-900/50 p-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                        {(['OBSERVACAO', 'ASSISTIDO', 'AUTOMATICO'] as LancamentoModo[]).map(m => (
                            <button key={m} disabled={isAutoRunning} onClick={() => setModoAtivo(m)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${modoAtivo === m ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>{m}</button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    {selectedBankId && <button onClick={() => openInstructions(selectedBankId)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase hover:bg-white transition-all"><BrainIcon className="w-3.5 h-3.5" /> Tutor IA</button>}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200">
                        {(['pendentes', 'lancados'] as const).map(f => (
                            <button key={f} onClick={() => !isAutoRunning && setViewFilter(f)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${viewFilter === f ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>{f}</button>
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
                    <button onClick={() => setAutoRunning(!isAutoRunning)} disabled={selectedIds.length === 0} className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-black uppercase transition-all shadow-lg ${isAutoRunning ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white disabled:opacity-50'}`}><PlayCircleIcon className="w-4 h-4" /> {isAutoRunning ? 'Parar Fila' : `Executar Fila (${selectedIds.length})`}</button>
                )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {bancos.map(b => (
                    <button key={b.bankId} disabled={isAutoRunning} onClick={() => setSelectedBankId(b.bankId)} className={`flex items-center gap-3 px-4 py-2 rounded-full border transition-all whitespace-nowrap ${selectedBankId === b.bankId ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border-slate-200'}`}>
                        <span className="text-[10px] font-black uppercase">{b.bankName}</span>
                        <span className="text-[9px] font-bold opacity-70">{b.itens.length}</span>
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 shadow-card overflow-hidden flex flex-col">
                {activeBank ? (
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 border-b border-slate-100">
                                <tr>
                                    <th className="px-3 py-3 w-10 text-center"><div onClick={() => !isAutoRunning && setBulkSelection(filteredItems.map(i=>i.id), !isAllVisibleSelected)} className={`w-4 h-4 mx-auto rounded border flex items-center justify-center cursor-pointer ${isAllVisibleSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>{isAllVisibleSelected && <CheckCircleIcon className="w-2.5 h-2.5 text-white" />}</div></th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-center w-24">Data</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Nome / Descrição</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right w-32">Valor</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-center w-36">Destino</th>
                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-center w-32">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredItems.map(item => (
                                    <tr key={item.id} className={`group transition-all ${currentItemId === item.id ? 'bg-blue-50/50' : ''}`}>
                                        <td className="px-3 py-3 text-center"><div onClick={() => !isAutoRunning && toggleSelection(item.id)} className={`w-4 h-4 mx-auto rounded border flex items-center justify-center cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>{selectedIds.includes(item.id) && <CheckCircleIcon className="w-2.5 h-2.5 text-white" />}</div></td>
                                        <td className="px-4 py-3 text-center font-mono text-[10px] text-slate-500">{formatarDataBR(item.data)}</td>
                                        <td className="px-6 py-3"><div className="flex flex-col"><span className="font-bold text-xs text-slate-700">{item.nome}</span><span className="text-[9px] text-blue-500 font-bold uppercase">{item.bankName}</span></div></td>
                                        <td className="px-4 py-3 text-right font-black text-xs">{item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td className="px-4 py-3 text-center">
                                            {currentItemId === item.id ? <input type="text" value={item.igrejaSugerida} onChange={(e) => atualizarIgrejaSugerida(item.bankId, item.id, e.target.value)} className="w-full bg-white border border-blue-200 rounded px-2 py-0.5 text-[9px] font-black uppercase text-center" /> : <span className="text-[9px] font-black uppercase text-blue-600">{item.igrejaSugerida}</span>}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {item.status === 'PENDENTE' ? (currentItemId === item.id ? <button onClick={() => confirmarLancamento(item.bankId, item.id)} className="px-4 py-1.5 bg-emerald-600 text-white rounded-full text-[9px] font-black uppercase flex items-center gap-1 mx-auto"><CheckCircleIcon className="w-3" /> Confirmar</button> : <StatusBadge item={item} />) : <div className="flex items-center justify-center gap-1 text-emerald-600 text-[9px] font-black uppercase"><CheckCircleIcon className="w-3 h-3" /> Concluído</div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-bold uppercase">Selecione um banco para começar.</div>}
            </div>

            {isInstructionModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#0F172A] w-full max-w-lg rounded-[2rem] shadow-2xl border border-white/20 flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">Tutor da IA - {activeBank?.bankName}</h3>
                            <button onClick={closeInstructions} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6">
                            <textarea value={instructionText} onChange={(e) => setInstructionText(e.target.value)} placeholder="Ex: 'Sempre que o nome for Padaria Silva, lance como Administrativo'..." className="w-full h-48 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium" />
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-2">
                            <button onClick={closeInstructions} className="px-5 py-2 text-[10px] font-black text-slate-500 uppercase">Cancelar</button>
                            <button onClick={() => selectedBankId && saveInstructions(selectedBankId, instructionText)} className="px-6 py-2 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase shadow-lg shadow-blue-500/30">Salvar Instruções</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
