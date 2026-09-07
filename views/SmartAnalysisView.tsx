
import React from 'react';
import { ArrowPathIcon } from '../components/Icons';
import { Trophy, SlidersHorizontal } from 'lucide-react';
import { analysisProcessor } from '../services/analysisProcessor';
import { printService } from '../services/printService';
import { useSmartAnalysisController } from '../hooks/useSmartAnalysisController';

// Sub-componentes
import { AnalysisToolbar } from '../components/smart-analysis/AnalysisToolbar';
import { ReportHeaderSection } from '../components/smart-analysis/ReportHeaderSection';
import { SpreadsheetTable } from '../components/smart-analysis/SpreadsheetTable';
import { SignaturesSection } from '../components/smart-analysis/SignaturesSection';
import { SummationModal } from '../components/smart-analysis/SummationModal';
import { ReportSelectorModal } from '../components/smart-analysis/ReportSelectorModal';
import { RankingConfigModal } from '../components/smart-analysis/RankingConfigModal';

export const SmartAnalysisView: React.FC = () => {
    const ctrl = useSmartAnalysisController();

    return (
        <div className="flex flex-col min-h-full animate-fade-in gap-3 pb-8 md:pb-4">
            <AnalysisToolbar 
                activeTemplate={ctrl.activeTemplate} 
                onRankingClick={ctrl.handleRankingClick} 
                onManualClick={ctrl.handleManualClick} 
                onPrint={() => printService.printSpreadsheet({ 
                    title: ctrl.reportTitle, 
                    logo: ctrl.reportLogo, 
                    columns: ctrl.columns, 
                    rows: ctrl.sortedRows, // CORREÇÃO: Enviando rows ordenadas conforme a visualização atual
                    signatures: ctrl.signatures 
                })} 
                onSave={ctrl.handleSave} 
                hasActiveReport={!!ctrl.activeReportId} 
                isDirty={ctrl.isDirty}
            />

            <div className="flex-1 bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col p-4 md:p-6 relative animate-fade-in-up">
                
                {/* Barra de Filtros Ativos do Ranking */}
                {ctrl.activeTemplate === 'ranking' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-xl mb-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-black">
                                <Trophy className="w-4 h-4 text-amber-500" />
                                <span>Filtros do Ranking:</span>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/80 dark:bg-slate-800 border border-amber-500/30 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                                {ctrl.selectedChurchIds.length === 0 || ctrl.selectedChurchIds.length === ctrl.availableChurches.length
                                    ? 'Todas as Igrejas'
                                    : ctrl.selectedChurchIds.length === 1
                                    ? (ctrl.availableChurches.find(c => c.id === ctrl.selectedChurchIds[0])?.name || '1 Igreja')
                                    : `${ctrl.selectedChurchIds.length} Igrejas Selecionadas`}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/80 dark:bg-slate-800 border border-amber-500/30 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                                {ctrl.selectedBankIds.length === 0 || ctrl.selectedBankIds.length >= (ctrl.availableBanks.length + 1)
                                    ? 'Todos os Caixas'
                                    : ctrl.selectedBankIds.length === 1
                                    ? (ctrl.selectedBankIds[0] === 'sem_banco' || ctrl.selectedBankIds[0] === 'caixa_fisico'
                                        ? 'Caixa Físico'
                                        : (ctrl.availableBanks.find(b => b.id === ctrl.selectedBankIds[0])?.account_name || ctrl.availableBanks.find(b => b.id === ctrl.selectedBankIds[0])?.name || '1 Caixa'))
                                    : `${ctrl.selectedBankIds.length} Caixas Selecionados`}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => ctrl.setIsRankingModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-lg text-[11px] shadow-sm transition-all cursor-pointer"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Alterar Caixas / Igrejas</span>
                        </button>
                    </div>
                )}

                <ReportHeaderSection 
                    logo={ctrl.reportLogo} title={ctrl.reportTitle} 
                    onLogoClick={() => ctrl.fileInputRef.current?.click()} 
                    onTitleChange={ctrl.setReportTitle} 
                    onAddColumn={() => ctrl.setColumns(prev => [...prev, { 
                        id: `custom_${Date.now()}`, label: 'Nova Coluna', type: 'text', 
                        editable: true, removable: true, visible: true 
                    }])} 
                    onAddRow={() => ctrl.setManualRows([...ctrl.manualRows, analysisProcessor.createEmptyRow(ctrl.columns)])} 
                    fileInputRef={ctrl.fileInputRef} handleLogoUpload={ctrl.handleLogoUpload} 
                />

                <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 dark:border-slate-700 rounded-2xl mb-4 bg-white dark:bg-slate-900/50 relative">
                    {ctrl.isRankingLoading && (
                        <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-500">
                            <ArrowPathIcon className="w-10 h-10 animate-spin mb-3 text-brand-blue" />
                            <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Processando Ranking...</p>
                        </div>
                    )}
                    
                    <SpreadsheetTable 
                        columns={ctrl.columns} 
                        rows={ctrl.sortedRows}
                        onSort={(id) => ctrl.setSortConfig(curr => ({ 
                            key: id, direction: curr?.key === id && curr.direction === 'asc' ? 'desc' : 'asc' 
                        }))}
                        sortConfig={ctrl.sortConfig}
                        onUpdateColumnLabel={(id, lbl) => ctrl.setColumns(prev => prev.map(c => c.id === id ? { ...c, label: lbl } : c))}
                        onRemoveColumn={(id) => ctrl.setColumns(prev => prev.filter(c => c.id !== id))}
                        onUpdateRow={(id, f, v) => ctrl.setManualRows(prev => prev.map(r => r.id !== id ? r : { ...r, [f]: v }))}
                        onDeleteRow={(id) => ctrl.setManualRows(prev => prev.filter(r => r.id !== id))}
                        onOpenSumModal={(rId, cId, val) => ctrl.setSumModal({ isOpen: true, rowId: rId, colId: cId, currentValue: val })}
                        summaryData={ctrl.summaryData}
                    />

                    {ctrl.manualRows.length === 0 && !ctrl.isRankingLoading && (
                        <div className="py-12 text-center text-slate-400 text-xs italic">Nenhuma linha adicionada.</div>
                    )}
                </div>

                <SignaturesSection 
                    signatures={ctrl.signatures}
                    onUpdateSignature={(idx, val) => { const n = [...ctrl.signatures]; n[idx] = val; ctrl.setSignatures(n); }}
                    onDeleteSignature={(idx) => ctrl.setSignatures(prev => prev.filter((_, i) => i !== idx))}
                    onAddSignature={() => ctrl.setSignatures(prev => [...prev, 'Nova Assinatura'])}
                />

                {ctrl.sumModal && (
                    <SummationModal 
                        sumModal={ctrl.sumModal} sumValue={ctrl.sumValue} 
                        onClose={() => ctrl.setSumModal(null)} onSumValueChange={ctrl.setSumValue} 
                        onConfirmSum={(e) => { 
                            e.preventDefault(); 
                            const newVal = ctrl.sumModal!.currentValue + analysisProcessor.parseBRLInput(ctrl.sumValue);
                            ctrl.setManualRows(prev => prev.map(r => r.id !== ctrl.sumModal!.rowId ? r : { ...r, [ctrl.sumModal!.colId]: newVal }));
                            ctrl.setSumModal(null); 
                            ctrl.setSumValue('');
                        }} 
                    />
                )}
            </div>

            {/* Modal de Configuração e Seleção de Caixas e Igrejas para o Ranking */}
            <RankingConfigModal 
                isOpen={ctrl.isRankingModalOpen}
                onClose={() => ctrl.setIsRankingModalOpen(false)}
                onConfirm={ctrl.handleConfirmRanking}
                churches={ctrl.availableChurches}
                banks={ctrl.availableBanks}
                hasActiveSession={(ctrl.effectiveRecords || []).length > 0}
                sessionRecordCount={(ctrl.effectiveRecords || []).length}
                savedReports={ctrl.savedReports}
                activeReportId={ctrl.activeReportId}
                initialChurchIds={ctrl.selectedChurchIds}
                initialBankIds={ctrl.selectedBankIds}
                isLoading={ctrl.isRankingLoading}
            />

            {ctrl.showReportSelector && (
                <ReportSelectorModal 
                    savedReports={ctrl.savedReports} 
                    onSelect={ctrl.handleSelectReport} 
                    onClose={() => ctrl.setShowReportSelector(false)} 
                />
            )}
        </div>
    );
};
