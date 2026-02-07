
import React from 'react';
import { ArrowPathIcon } from '../components/Icons';
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

export const SmartAnalysisView: React.FC = () => {
    const ctrl = useSmartAnalysisController();

    return (
        <div className="flex flex-col h-full animate-fade-in gap-3 pb-2">
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

                < SignaturesSection 
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
